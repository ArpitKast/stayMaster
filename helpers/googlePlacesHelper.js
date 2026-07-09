const axios = require('axios');
const redisClient = require('../config/redisConnection');

const DEFAULT_RADIUS = Number(process.env.GOOGLE_PLACES_RADIUS_METERS) || 2000;
const DEFAULT_LIMIT = Number(process.env.GOOGLE_PLACES_MAX_RESULTS) || 5;
const DEFAULT_CACHE_TTL = Number(process.env.GOOGLE_PLACES_CACHE_TTL_MS) || 60 * 60 * 1000; // 1 hour
const BASE_URL = process.env.GOOGLE_PLACES_BASE_URL || 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';

class GooglePlacesHelper {
  constructor() {
    this.apiKey = process.env.GOOGLE_PLACES_API_KEY || '';
    this.cache = new Map();
  }

  async setCache(key, data, ttl = DEFAULT_CACHE_TTL) {
    try {
      if (redisClient && redisClient.isOpen) {
        await redisClient.set(`places:${key}`, JSON.stringify(data), {
          EX: Math.round(ttl / 1000)
        });
        return;
      }
    } catch (err) {
      console.error('[GooglePlacesHelper Cache Set Error] falling back to memory:', err.message || err);
    }

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
    });
  }

  async getCache(key) {
    try {
      if (redisClient && redisClient.isOpen) {
        const cached = await redisClient.get(`places:${key}`);
        if (cached) {
          return JSON.parse(cached);
        }
        return null;
      }
    } catch (err) {
      console.error('[GooglePlacesHelper Cache Get Error] falling back to memory:', err.message || err);
    }

    const record = this.cache.get(key);
    if (!record) return null;
    if (Date.now() > record.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return record.data;
  }

  buildCacheKey({ latitude, longitude, radius, limit, type }) {
    return `${latitude}:${longitude}:${radius || DEFAULT_RADIUS}:${limit || DEFAULT_LIMIT}:${type || 'tourist_attraction'}`;
  }

  ensureConfigured() {
    if (!this.apiKey) {
      const error = new Error('GOOGLE_PLACES_API_KEY is not configured');
      error.code = 'MISSING_API_KEY';
      throw error;
    }
  }

  metersToKm(meters) {
    if (typeof meters !== 'number' || Number.isNaN(meters)) return null;
    return Math.round((meters / 1000) * 10) / 10; // one decimal
  }

  haversineDistanceMeters(lat1, lng1, lat2, lng2) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const earthRadiusMeters = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(earthRadiusMeters * c);
  }

  estimateTravelTime(distanceMeters) {
    if (typeof distanceMeters !== 'number' || Number.isNaN(distanceMeters)) return null;
    const walkingSpeedMps = 1.4; // approx 5 km/h
    const seconds = distanceMeters / walkingSpeedMps;
    const minutes = Math.round(seconds / 60);
    if (minutes < 1) return '<1 min walk';
    if (minutes < 60) return `${minutes} min walk`;
    const hours = Math.floor(minutes / 60);
    const rem = minutes % 60;
    return `${hours} hr${hours > 1 ? 's' : ''}${rem ? ` ${rem} min` : ''} walk`;
  }

  normalizePlace(place, origin = null) {
    const photoReference = place?.photos?.[0]?.photo_reference;
    const photoUrl = photoReference
      ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photoReference}&key=${this.apiKey}`
      : null;

    const placeLat = place?.geometry?.location?.lat;
    const placeLng = place?.geometry?.location?.lng;
    const hasOrigin = origin && typeof origin.latitude === 'number' && typeof origin.longitude === 'number';
    const hasPlaceCoords = typeof placeLat === 'number' && typeof placeLng === 'number';
    const fallbackDistanceMeters = hasOrigin && hasPlaceCoords
      ? this.haversineDistanceMeters(origin.latitude, origin.longitude, placeLat, placeLng)
      : null;
    const computedDistanceMeters = place.distance_meters ?? fallbackDistanceMeters;

    return {
      id: place.place_id,
      name: place.name,
      rating: place.rating ?? null,
      userRatingsTotal: place.user_ratings_total ?? 0,
      address: place.vicinity || place.formatted_address || '',
      location: place.geometry?.location || null,
      types: place.types || [],
      photoUrl,
      icon: place.icon,
      openNow: place.opening_hours?.open_now ?? null,
      googleMapsUrl: place.place_id
        ? `https://www.google.com/maps/place/?q=place_id:${place.place_id}`
        : null,
      distanceMeters: computedDistanceMeters,
      distanceKm: this.metersToKm(computedDistanceMeters),
      travelTimeText: computedDistanceMeters ? this.estimateTravelTime(computedDistanceMeters) : null,
    };
  }

  async fetchNearby({ latitude, longitude, radius = DEFAULT_RADIUS, limit = DEFAULT_LIMIT, type = 'tourist_attraction' }) {
    this.ensureConfigured();

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      throw new Error('Valid latitude and longitude are required');
    }

    const cacheKey = this.buildCacheKey({ latitude, longitude, radius, limit, type });
    const cached = await this.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const params = {
      key: this.apiKey,
      location: `${latitude},${longitude}`,
      radius,
      type,
      rankby: radius ? undefined : 'distance',
    };

    const response = await axios.get(BASE_URL, { params });
    if (response.data?.status !== 'OK' && response.data?.status !== 'ZERO_RESULTS') {
      const error = new Error(response.data?.error_message || 'Failed to fetch nearby places');
      error.code = response.data?.status || 'GOOGLE_PLACES_ERROR';
      throw error;
    }

    const places = Array.isArray(response.data?.results) ? response.data.results : [];
    const normalized = places
      .slice(0, limit)
      .map((place) => this.normalizePlace(place, { latitude, longitude }));

    await this.setCache(cacheKey, normalized);
    return normalized;
  }
}

module.exports = GooglePlacesHelper;
