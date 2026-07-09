'use strict';
/**
 * Simple In-Memory / Redis Caching Service
 * Provides caching for frequently accessed, rarely changing data like settings
 * Does NOT change any API response format - purely internal optimization
 */
const redisClient = require('../config/redisConnection');

class CacheService {
    constructor() {
        this.cache = new Map();
        this.defaultTTL = 300; // 5 minutes default TTL in seconds

        // Passive eviction: sweep expired in-memory entries every 5 minutes.
        // Without this, entries set and never retrieved accumulate indefinitely.
        this._evictionTimer = setInterval(() => this._evictExpired(), 300_000);
        this._evictionTimer.unref(); // don't prevent process exit
    }

    _evictExpired() {
        const now = Date.now();
        for (const [key, item] of this.cache) {
            if (now > item.expiresAt) this.cache.delete(key);
        }
    }

    /**
     * Get item from cache
     * @param {string} key - Cache key
     * @returns {Promise<*>} - Cached value or undefined if not found/expired
     */
    async get(key) {
        if (redisClient && redisClient.isOpen) {
            try {
                const data = await redisClient.get(key);
                if (data) {
                    return JSON.parse(data);
                }
                return undefined;
            } catch (err) {
                console.error('[CacheService Get Redis Error] falling back to memory:', err.message || err);
            }
        }

        const item = this.cache.get(key);
        if (!item) {
            return undefined;
        }

        // Check if expired
        if (Date.now() > item.expiresAt) {
            this.cache.delete(key);
            return undefined;
        }

        return item.value;
    }

    /**
     * Set item in cache
     * @param {string} key - Cache key
     * @param {*} value - Value to cache
     * @param {number} ttlSeconds - Time to live in seconds (default: 300)
     */
    async set(key, value, ttlSeconds = this.defaultTTL) {
        if (redisClient && redisClient.isOpen) {
            try {
                await redisClient.set(key, JSON.stringify(value), {
                    EX: Math.round(ttlSeconds)
                });
                return;
            } catch (err) {
                console.error('[CacheService Set Redis Error] falling back to memory:', err.message || err);
            }
        }

        this.cache.set(key, {
            value,
            expiresAt: Date.now() + (ttlSeconds * 1000)
        });
    }

    /**
     * Delete item from cache
     * @param {string} key - Cache key
     * @returns {Promise<boolean>} - True if item was deleted
     */
    async delete(key) {
        if (redisClient && redisClient.isOpen) {
            try {
                await redisClient.del(key);
                return true;
            } catch (err) {
                console.error('[CacheService Del Redis Error] falling back to memory:', err.message || err);
            }
        }
        return this.cache.delete(key);
    }

    /**
     * Delete items matching a pattern (prefix)
     * @param {string} prefix - Key prefix to match
     * @returns {Promise<number>} - Number of items deleted
     */
    async deleteByPrefix(prefix) {
        if (redisClient && redisClient.isOpen) {
            try {
                // Use SCAN instead of KEYS — KEYS is O(N) and blocks Redis while scanning
                let cursor = 0;
                const keysToDelete = [];
                do {
                    const result = await redisClient.scan(cursor, { MATCH: `${prefix}*`, COUNT: 100 });
                    cursor = result.cursor;
                    keysToDelete.push(...result.keys);
                } while (cursor !== 0);

                if (keysToDelete.length > 0) {
                    // Delete in chunks to avoid oversized single commands
                    for (let i = 0; i < keysToDelete.length; i += 100) {
                        await redisClient.del(keysToDelete.slice(i, i + 100));
                    }
                }
                return keysToDelete.length;
            } catch (err) {
                console.error('[CacheService DeleteByPrefix Redis Error] falling back to memory:', err.message || err);
            }
        }

        let count = 0;
        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                this.cache.delete(key);
                count++;
            }
        }
        return count;
    }

    /**
     * Clear all cached items
     */
    async clear() {
        if (redisClient && redisClient.isOpen) {
            try {
                await redisClient.flushDb();
                return;
            } catch (err) {
                console.error('[CacheService Clear Redis Error] falling back to memory:', err.message || err);
            }
        }
        this.cache.clear();
    }

    /**
     * Get or set pattern - fetch from cache or execute function and cache result
     * @param {string} key - Cache key
     * @param {Function} fetchFn - Async function to fetch data if not cached
     * @param {number} ttlSeconds - Time to live in seconds
     * @returns {*} - Cached or freshly fetched value
     */
    async getOrSet(key, fetchFn, ttlSeconds = this.defaultTTL) {
        let value = await this.get(key);

        if (value !== undefined) {
            return value;
        }

        // Fetch fresh data
        value = await fetchFn();
        await this.set(key, value, ttlSeconds);
        return value;
    }

    /**
     * Get cache statistics
     * @returns {Object} - Cache stats
     */
    getStats() {
        let validCount = 0;
        let expiredCount = 0;
        const now = Date.now();

        for (const item of this.cache.values()) {
            if (now > item.expiresAt) {
                expiredCount++;
            } else {
                validCount++;
            }
        }

        return {
            totalItems: this.cache.size,
            validItems: validCount,
            expiredItems: expiredCount
        };
    }
}

// Export singleton instance
module.exports = new CacheService();
