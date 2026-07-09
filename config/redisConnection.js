let createClient;

try {
    ({ createClient } = require('redis'));
} catch (err) {
    console.warn('[Redis] Package not found. Falling back to in-memory cache only.');
    createClient = null;
}

if (!createClient) {
    module.exports = null;
} else {
    const redisUrl = process.env.REDIS_URL;
    const redisEnabled = process.env.REDIS_ENABLED === 'true' || Boolean(redisUrl);

    if (!redisEnabled) {
        console.log('[Redis] Disabled. Set REDIS_ENABLED=true (and optionally REDIS_URL) to enable it.');
        module.exports = null;
        return;
    }

    const redisClient = createClient({
        url: redisUrl || 'redis://127.0.0.1:6379',
        disableOfflineQueue: true, // Fail fast immediately if Redis is down rather than queuing commands
        socket: {
            reconnectStrategy: () => false // Do not retry endlessly when Redis is unavailable
        }
    });

    redisClient.on('error', (err) => {
        const message = err && err.message ? err.message : String(err);
        console.error('Redis connection error:', message);
    });

    redisClient.on('connect', () => {
        console.log('Redis connected successfully');
    });

    // Immediately invoke connection in the background so it doesn't block startup
    redisClient.connect().catch((err) => {
        console.error('Failed to initialize Redis client connection:', err.message || err);
    });

    module.exports = redisClient;
}
