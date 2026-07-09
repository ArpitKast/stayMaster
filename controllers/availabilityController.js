'use strict';
const dotenv = require("dotenv").config();
const HotelCode = process.env.EZEE_HOTEL_CODE;
const APIKey = process.env.EZEE_API_KEY;
const availability_request_type = 'RoomList';
const property = require("../models/propertyModel");
const Property = new property;
const collection = require("../models/collectionModel");
const User = require('../models/userModel');
const Collection = new collection();
const booking = require("../models/bookingModel");
const Booking = new booking;
const settingHelper = require("../helpers/settingsHelper");
const SettingsHelper = new settingHelper();
const S3Helper = require('../helpers/s3Helper');
const {
    propertyBucketRaw,
    propertyBucketName,
    propertyBucketPrefix,
    propertyImageBaseUrl,
    propertyCdnPrefix,
    hasUsableCdnBaseUrl,
    buildCdnUrl
} = require('../config/cdnConfig');
const settingModel = require("../models/settingModel");
const Setting = new settingModel();
const Banner = require("../models/bannerModel");
const BannerModel = new Banner();
const pool = require('../config/dbConnection');
const GooglePlacesHelper = require('../helpers/googlePlacesHelper');
const googlePlacesHelper = new GooglePlacesHelper();

const { format,addDays,differenceInMilliseconds,getTime, eachDayOfInterval,differenceInDays,isBefore,isPast,subDays } = require("date-fns");
const Response = require('../helpers/responseHelper');
const redisClient = require('../config/redisConnection');

const LEAD_FORM_IMAGE_SETTING = 'lead_form_image';
const LEAD_FORM_IMAGE_CATEGORY = 'lead_form';

class AvailabilityController{
    constructor(ezeeHelper){
        this.ezeeHelper = ezeeHelper;
        // In-memory cache for Ezee API results (avoids repeat Ezee calls on page 2, 3, ...)
        this._ezeeCache = new Map();
        // Non-Redis fallback payload for home API when Ezee is temporarily unavailable.
        this._homeLatestPayload = null;
    }

    async getPropertyAssetUrl(propertyId, mediaFilename){
        if (!mediaFilename) return '';
        const filePath = `${propertyId}/${mediaFilename}`;
        if (hasUsableCdnBaseUrl) {
            return buildCdnUrl(filePath, propertyCdnPrefix);
        }
        const key = [propertyBucketPrefix, filePath].filter(Boolean).join('/');
        const urlParams = { Bucket: propertyBucketName || propertyBucketRaw, Key: key, Expires: 3600 };
        return S3Helper.getSignedUrlPromise(urlParams);
    }

    _getCacheKey(params) {
        return `${params.check_in_date}_${params.check_out_date}_${params.number_adults}_${params.number_children}_${params.destination || 1}_${params.collection || ''}_${params.is_pet_friendly ? 1 : 0}`;
    }

    _toBoolean(value) {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value === 1;
        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase();
            return ['1', 'true', 'yes'].includes(normalized);
        }
        return false;
    }

    async _getCachedEzee(key) {
        try {
            if (redisClient && redisClient.isOpen) {
                const cached = await redisClient.get(`ezee:${key}`);
                if (cached) {
                    return JSON.parse(cached);
                }
                return null;
            }
        } catch (err) {
            console.error('[Redis Cache Get Error] falling back to in-memory:', err);
        }

        // Fallback to in-memory Map
        const cached = this._ezeeCache.get(key);
        if (!cached) return null;
        if (Date.now() > cached.expiresAt) { this._ezeeCache.delete(key); return null; }
        return cached.data;
    }

    async _setCachedEzee(key, data, ttlMs = 1 * 60 * 1000) {
        try {
            if (redisClient && redisClient.isOpen) {
                await redisClient.set(`ezee:${key}`, JSON.stringify(data), {
                    EX: Math.round(ttlMs / 1000)
                });
                return;
            }
        } catch (err) {
            console.error('[Redis Cache Set Error] falling back to in-memory:', err);
        }

        // Fallback to in-memory Map
        this._ezeeCache.set(key, { data, expiresAt: Date.now() + ttlMs });
    }

    _toArray(value) {
        if (value === undefined || value === null) return [];
        if (Array.isArray(value)) return value.filter(v => v !== undefined && v !== null && `${v}`.trim() !== '');
        if (typeof value === 'string') return value.split(',').map(v => v.trim()).filter(Boolean);
        return [value];
    }

    _extractS3Key(value) {
        if (!value) return null;
        let key = `${value}`.trim();
        if (!key) return null;

        try {
            const parsed = new URL(key);
            key = parsed.pathname || '';
        } catch (_) {
            if (key.includes('.com/')) {
                key = key.split('.com/')[1];
            }
        }

        key = key.replace(/^\/+/, '');
        const queryIndex = key.indexOf('?');
        if (queryIndex !== -1) {
            key = key.substring(0, queryIndex);
        }

        return key || null;
    }

    _buildBannerImageUrl(req, key) {
        const cdnBaseUrl = process.env.AWS_PROPERTY_CDN_BASE_URL;
        if (cdnBaseUrl && !cdnBaseUrl.includes('your-cloudfront-domain')) {
            const cleanCdn = cdnBaseUrl.replace(/\/$/, '');
            const cleanKey = key.replace(/^\/+/, '');
            return `${cleanCdn}/${cleanKey}`;
        }

        if (process.env.BASE_URL) {
            const cleanBaseUrl = process.env.BASE_URL.replace(/\/$/, '');
            return `${cleanBaseUrl}/api/banners/images/${encodeURIComponent(key)}`;
        }

        const protocol = req.get('x-forwarded-proto') || req.protocol;
        const host = req.get('x-forwarded-host') || req.get('host');
        return `${protocol}://${host}/api/banners/images/${encodeURIComponent(key)}`;
    }

    async _getHomeBanners(req) {
        try {
            const banners = await BannerModel.select('banners', { active: 1 });
            if (!Array.isArray(banners)) return [];
            
            banners.sort((a, b) => (a.order || 0) - (b.order || 0));

            for (let i = 0; i < banners.length; i++) {
                const key = this._extractS3Key(banners[i].image_url);
                banners[i].image_url_key = key;
                if (key) {
                    banners[i].image_url = this._buildBannerImageUrl(req, key);
                }
            }

            return banners;
        } catch (err) {
            console.error('[homeAvailability] Failed to fetch home banners from database:', err.message || err);
            return []; // Safe fallback
        }
    }

    async _getLeadBanner() {
        const leadBanner = { url: null, key: null, alt: 'Lead banner' };
        try {
            const setting = await Setting.getSettingValue(
                LEAD_FORM_IMAGE_SETTING,
                LEAD_FORM_IMAGE_CATEGORY
            );

            if (setting && setting.value) {
                const leadBannerUrl = await S3Helper.generatePreSignedUrl(process.env.AWS_BUCKET, setting.value);
                leadBanner.url = leadBannerUrl || null;
                leadBanner.key = setting.value;
            }
        } catch (err) {
            console.error('[homeAvailability] Failed to fetch lead banner setting from database:', err.message || err);
        }

        return leadBanner;
    }

    async _filterEzeeByPrice(ezeeResults, minPrice, maxPrice) {
        const hasMin = minPrice !== undefined && minPrice !== null && !Number.isNaN(parseInt(minPrice, 10));
        const hasMax = maxPrice !== undefined && maxPrice !== null && !Number.isNaN(parseInt(maxPrice, 10));
        if (!hasMin && !hasMax) return ezeeResults;

        const min = hasMin ? parseInt(minPrice, 10) : 0;
        const max = hasMax ? parseInt(maxPrice, 10) : Number.MAX_SAFE_INTEGER;
        const webDiscount = await SettingsHelper.webDiscount();
        const discount = Number.isNaN(parseInt(webDiscount, 10)) ? 0 : parseInt(webDiscount, 10);

        return (ezeeResults || []).filter((item) => {
            const avg = parseFloat(item?.room_rates_info?.avg_per_night_without_tax || 0);
            const perNight = Math.round(avg * (100 - discount) / 100);
            return perNight >= min && perNight <= max;
        });
    }

    async _getPetFriendlyCollectionId() {
        if (this._petFriendlyCollectionId !== undefined) {
            return this._petFriendlyCollectionId;
        }
        try {
            const collections = await Collection.getAllCollections();
            const petFriendly = (collections[0] || []).find(c => c.slug === 'pet-friendly');
            this._petFriendlyCollectionId = petFriendly ? parseInt(petFriendly.id) : null;
            return this._petFriendlyCollectionId;
        } catch (_) {
            this._petFriendlyCollectionId = null;
            return null;
        }
    }

    async findPaginated(req, res) {
        try {
            const page = parseInt(req.body.page) || 1;
            const limit = parseInt(req.body.limit) || 20;
            const offset = (page - 1) * limit;

            // When no dates are selected, call Ezee with default dates but skip
            // the availability filter so ALL properties get pricing + max_capacity
            const hasDateFilter = !!req.body.check_in_date;
            if (!hasDateFilter) {
                const adjustedParams = await this.availabilityParams(req.body);
                const cacheKey = this._getCacheKey(adjustedParams);

                const isRefresh = req.query.refresh === 'true' || req.body.refresh === true;
                if (isRefresh) {
                    const CacheService = require('../services/CacheService');
                    await CacheService.delete(`ezee:${cacheKey}`);
                    this._ezeeCache.delete(cacheKey);
                }

                let ezeeResults = await this._getCachedEzee(cacheKey);
                if (!ezeeResults) {
                    console.log('[stayListing] No-date fetch from Ezee (cache miss)');
                    const ezeeParams = {
                        request_type: availability_request_type,
                        HotelCode: HotelCode,
                        APIKey: APIKey,
                        check_in_date: adjustedParams.check_in_date,
                        check_out_date: adjustedParams.check_out_date,
                        number_adults: adjustedParams.number_adults,
                        number_children: adjustedParams.number_children,
                        destination: adjustedParams.destination,
                        collection: adjustedParams.collection
                    };
                    ezeeResults = await this.ezeeHelper.fetchData('booking/reservation_api/listing.php', 'GET', ezeeParams);
                    if (!ezeeResults || ezeeResults.length === 0) {
                        return Response.success(res, { available: [], total: 0, page, limit, hasMore: false, featured: [], favourites: [] }, 200);
                    }
                    await this._setCachedEzee(cacheKey, ezeeResults);
                } else {
                    console.log('[stayListing] No-date using cached Ezee results');
                }

                const priceFilteredResults = await this._filterEzeeByPrice(
                    ezeeResults,
                    req.body.min_price,
                    req.body.max_price
                );
                if (priceFilteredResults.length === 0) {
                    return Response.success(res, { available: [], total: 0, page, limit, hasMore: false, featured: [], favourites: [] }, 200);
                }

                // Use ALL Ezee results (no min_ava_rooms filter) so every property gets pricing + max_capacity
                const dbFilters = {
                    channelIds: priceFilteredResults.map(r => r.roomtypeunkid).join(','),
                    destination: adjustedParams.destination,
                    limit,
                    offset,
                    onlyDisplayImage: true
                };
                if (adjustedParams.collection) dbFilters.collection = adjustedParams.collection;
                if (this._toBoolean(req.body.staymaster_select)) dbFilters.staymaster_select = true;
                if (req.body.bedrooms) dbFilters.bedrooms = req.body.bedrooms;
                if (this._toArray(req.body.property_types).length > 0) dbFilters.property_types = this._toArray(req.body.property_types);
                if (this._toArray(req.body.amenities).length > 0) dbFilters.amenities = this._toArray(req.body.amenities);
                if (this._toArray(req.body.brands).length > 0) dbFilters.brands = this._toArray(req.body.brands);
                if (this._toArray(req.body.clusters).length > 0) dbFilters.clusters = this._toArray(req.body.clusters);

                const [total, properties] = await Promise.all([
                    Property.getCount(dbFilters),
                    Property.listPropertiesDetails(dbFilters)
                ]);

                const petFriendlyCollectionId = await this._getPetFriendlyCollectionId();
                const allProperties = await this.ezeePropertyParameters(ezeeResults, properties, petFriendlyCollectionId);

                const featuredProps = await Property.listPropertiesDetails({ featured: 1, onlyDisplayImage: true });
                const featuredProperties = featuredProps.map(a => a.id);
                let userFavourites = {};
                if (req.guest) {
                    const favourites = await Property.userFavourites(req.guest.id);
                    userFavourites = favourites.map(a => a.property_id);
                }

                return Response.success(res, {
                    available: allProperties,
                    total: parseInt(total),
                    page, limit,
                    hasMore: (offset + allProperties.length) < parseInt(total),
                    featured: featuredProperties,
                    favourites: userFavourites
                }, 200);
            }

            const adjustedParams = await this.availabilityParams(req.body);
            const cacheKey = this._getCacheKey(adjustedParams);

            const isRefresh = req.query.refresh === 'true' || req.body.refresh === true;
            if (isRefresh) {
                const CacheService = require('../services/CacheService');
                await CacheService.delete(`ezee:${cacheKey}`);
                this._ezeeCache.delete(cacheKey);
            }

            // Try cache first, otherwise call Ezee API
            let ezeeResults = await this._getCachedEzee(cacheKey);
            if (!ezeeResults) {
                console.log('[stayListing] Fetching from Ezee (cache miss)');
                const ezeeParams = {
                    request_type: availability_request_type,
                    HotelCode: HotelCode,
                    APIKey: APIKey,
                    check_in_date: adjustedParams.check_in_date,
                    check_out_date: adjustedParams.check_out_date,
                    number_adults: adjustedParams.number_adults,
                    number_children: adjustedParams.number_children,
                    destination: adjustedParams.destination,
                    collection: adjustedParams.collection
                };
                ezeeResults = await this.ezeeHelper.fetchData('booking/reservation_api/listing.php', 'GET', ezeeParams);
                if (!ezeeResults || ezeeResults.length === 0) {
                    return Response.success(res, { available: [], total: 0, page, limit, hasMore: false, featured: [], favourites: [] }, 200);
                }
                await this._setCachedEzee(cacheKey, ezeeResults);
            } else {
                console.log('[stayListing] Using cached Ezee results (cache hit)');
            }

            // Filter to only available rooms
            const availableResults = ezeeResults.filter(r => r.min_ava_rooms > 0);
            if (availableResults.length === 0) {
                return Response.success(res, { available: [], total: 0, page, limit, hasMore: false, featured: [], favourites: [] }, 200);
            }

            const priceFilteredResults = await this._filterEzeeByPrice(
                availableResults,
                req.body.min_price,
                req.body.max_price
            );
            if (priceFilteredResults.length === 0) {
                return Response.success(res, { available: [], total: 0, page, limit, hasMore: false, featured: [], favourites: [] }, 200);
            }

            const dbFilters = {
                channelIds: priceFilteredResults.map(r => r.roomtypeunkid).join(','),
                destination: adjustedParams.destination,
                limit,
                offset,
                onlyDisplayImage: true
            };
            if (adjustedParams.collection) {
                dbFilters.collection = adjustedParams.collection;
            }
            if (this._toBoolean(req.body.staymaster_select)) dbFilters.staymaster_select = true;
            if (req.body.bedrooms) dbFilters.bedrooms = req.body.bedrooms;
            if (this._toArray(req.body.property_types).length > 0) dbFilters.property_types = this._toArray(req.body.property_types);
            if (this._toArray(req.body.amenities).length > 0) dbFilters.amenities = this._toArray(req.body.amenities);
            if (this._toArray(req.body.brands).length > 0) dbFilters.brands = this._toArray(req.body.brands);
            if (this._toArray(req.body.clusters).length > 0) dbFilters.clusters = this._toArray(req.body.clusters);

            // Parallel: get total count + paginated property details
            const [total, properties] = await Promise.all([
                Property.getCount(dbFilters),
                Property.listPropertiesDetails(dbFilters)
            ]);

            // Merge Ezee pricing with DB property details
            const petFriendlyCollectionId = await this._getPetFriendlyCollectionId();
            const availableProperties = await this.ezeePropertyParameters(ezeeResults, properties, petFriendlyCollectionId);

            // Featured + favourites
            const featuredProps = await Property.listPropertiesDetails({ featured: 1, onlyDisplayImage: true });
            const featuredProperties = featuredProps.map(a => a.id);
            let userFavourites = {};
            if (req.guest) {
                const favourites = await Property.userFavourites(req.guest.id);
                userFavourites = favourites.map(a => a.property_id);
            }

            return Response.success(res, {
                available: availableProperties,
                total: parseInt(total),
                page,
                limit,
                hasMore: (offset + availableProperties.length) < parseInt(total),
                featured: featuredProperties,
                favourites: userFavourites
            }, 200);
        } catch (error) {
            console.error('[stayListing] Error:', error);
            return Response.error(res, "ERROR", error.message, 500);
        }
    }

    async availabilityParams(inputs,forDetailsPage = false){
        var {check_in_date, check_out_date, destination,number_adults, number_children,home,collection,propertyId, pets, adults, kids } = inputs;
        number_adults = number_adults || adults;
        number_children = number_children || kids;
        if(!check_in_date){
            check_in_date = format(new Date(), 'yyyy-MM-dd');
            check_out_date = format(addDays(new Date(), 2),'yyyy-MM-dd');
            if(!forDetailsPage){
                home = 1;
            }   
        }
        if(!check_out_date){
            check_out_date = format(addDays(check_in_date, 2),'yyyy-MM-dd');
        }
        if(!number_adults || number_adults == 0){
            number_adults = 2;
        }
        if(!number_children){
            number_children = 0; 
        }
        const petFriendly = this._toBoolean(pets);
        if (petFriendly) {
            if (!collection) {
                collection = 'pet-friendly';
            } else {
                // If collection is already set, we want to ensure 'pet-friendly' is included.
                // Property.getAll handles arrays of collections.
                if (Array.isArray(collection)) {
                    if (!collection.includes('pet-friendly')) {
                        collection.push('pet-friendly');
                    }
                } else if (collection !== 'pet-friendly') {
                    collection = [collection, 'pet-friendly'];
                }
            }
        }

        if(!forDetailsPage){
            if(!destination){
                destination = 1;
            }
        }
        return {check_in_date, check_out_date, destination,number_adults, number_children,home,collection,propertyId, pets: petFriendly };
    }

    async home(req,res){
        try {
            const cacheKey = 'home:data_payload';
            let cachedPayload = null;

            try {
                if (redisClient && redisClient.isOpen) {
                    const cached = await redisClient.get(cacheKey);
                    if (cached) {
                        cachedPayload = JSON.parse(cached);
                        console.log('[homeAvailability] Using Redis cached home data');
                    }
                }
            } catch (err) {
                console.error('[Redis Cache Get Error for Home] falling back to local memory:', err);
            }

            if (!cachedPayload && this._homeLatestPayload) {
                cachedPayload = this._homeLatestPayload;
                console.log('[homeAvailability] Using local memory cached home data');
            }

            let responseData;

            if (cachedPayload) {
                responseData = { ...cachedPayload };
            } else {
                console.log('[homeAvailability] Cache miss. Fetching fresh DB, settings & banners data (no Ezee PMS sync)...');
                
                const heroPropertySetting = await Setting.getSettingValue('hero_property_id', 'home');
                const heroPropertyId = heroPropertySetting && heroPropertySetting.value ? parseInt(heroPropertySetting.value, 10) : null;

                // Set up database promises running in parallel
                const promises = [
                    Property.listPropertiesDetails({destination:1, onlyDisplayImage: true}),
                    this._getPetFriendlyCollectionId(),
                    Collection.activeCollections(),
                    Property.listPropertiesDetails({featured:1, onlyDisplayImage: true}),
                    SettingsHelper.formSettings(),
                    SettingsHelper.consolidatedSettings(),
                    this._getHomeBanners(req),
                    this._getLeadBanner(),
                    heroPropertyId ? Property.listPropertiesDetails({ id: heroPropertyId }) : Promise.resolve(null)
                ];

                const [
                    destProperties,
                    petFriendlyCollectionId,
                    activeCollections,
                    featuredProps,
                    formSettings,
                    settings,
                    banners,
                    leadBanner,
                    heroProps
                ] = await Promise.all(promises);

                // Format properties directly from database without Ezee sync
                const availableProperties = await this.dbPropertyParameters(destProperties, petFriendlyCollectionId);
                const propertiesByCollection = await this.propertiesByCollection(destProperties, activeCollections);
                const featuredProperties = featuredProps.map(a => a.id);

                let heroProperty = null;
                if (heroProps && heroProps.length > 0) {
                    const heroPropParams = await this.dbPropertyParameters(heroProps, petFriendlyCollectionId);
                    heroProperty = heroPropParams[0];
                } else if (availableProperties.length > 0) {
                    // Fallback to formatting the first available property with all media
                    const fallbackProps = await Property.listPropertiesDetails({ id: availableProperties[0].id });
                    if (fallbackProps && fallbackProps.length > 0) {
                        const heroPropParams = await this.dbPropertyParameters(fallbackProps, petFriendlyCollectionId);
                        heroProperty = heroPropParams[0];
                    }
                }

                cachedPayload = {
                    available: availableProperties,
                    heroProperty: heroProperty,
                    featured: featuredProperties,
                    propertiesByCollection: propertiesByCollection,
                    formSettings: formSettings,
                    settings: settings,
                    banners: banners,
                    lead_banner: leadBanner
                };

                // Store in memory fallback
                this._homeLatestPayload = cachedPayload;

                // Cache in Redis for 1 hour
                try {
                    if (redisClient && redisClient.isOpen) {
                        await redisClient.set(cacheKey, JSON.stringify(cachedPayload), {
                            EX: 3600 // 1 hour
                        });
                        console.log('[homeAvailability] Saved home data to Redis cache');
                    }
                } catch (err) {
                    console.error('[Redis Cache Set Error for Home]:', err);
                }

                responseData = { ...cachedPayload };
            }

            // Dynamically inject user-specific favourites
            let userFavourites = [];
            if (req.guest) {
                const favouritesList = await Property.userFavourites(req.guest.id);
                userFavourites = favouritesList.map(a => a.property_id);
            }

            responseData.favourites = userFavourites;

            // Allow browser/reverse proxy caching for 10 min
            res.set('Cache-Control', 'public, max-age=600, stale-while-revalidate=60');

            return Response.success(res, responseData, 200);

        } catch (error) {
            console.error('[homeAvailability] Error:', error);
            return Response.error(res, "ERROR", error.message, 500);
        }
    }

    async find(req,res){
        try {
            const adjustedParams = await this.availabilityParams(req.body);
            const method = 'GET';
            const params = {
                request_type: availability_request_type,
                HotelCode: HotelCode,
                APIKey: APIKey,
                check_in_date: adjustedParams.check_in_date,
                check_out_date: adjustedParams.check_out_date,
                number_adults: adjustedParams.number_adults,
                number_children: adjustedParams.number_children,
                destination: adjustedParams.destination,
                collection: adjustedParams.collection
            };
            var filters = {};
            if(req.body.propertyId || req.body.slug){
                var property;
                if(req.body.propertyId){
                    property = await Property.getById(req.body.propertyId);
                }else{
                    property = await Property.getBySlug(req.body.slug);
                }
                if(property[0]){
                    params['roomtypeunkid'] = property[0].channel_id;
                    filters['id'] = req.body.propertyId;
                }else{
                    return Response.error(res, "ERROR", "Property does not exist", 400);
                }
            }
            if(adjustedParams.destination){
                filters['destination'] = adjustedParams.destination;
            }
            if(adjustedParams.collection){
                filters['collection'] = adjustedParams.collection;
            }
            var homePageRequest = false;
            if(adjustedParams.home && adjustedParams.home == 1){
                homePageRequest = true;
            }
            // Cache Ezee availability results — same params = same result within 5 min
            const cacheKey = this._getCacheKey(params);

            const isRefresh = req.query.refresh === 'true' || req.body.refresh === true;
            if (isRefresh) {
                const CacheService = require('../services/CacheService');
                await CacheService.delete(`ezee:${cacheKey}`);
                this._ezeeCache.delete(cacheKey);
            }

            let results = await this._getCachedEzee(cacheKey);
            if (!results) {
                results = await this.ezeeHelper.fetchData('booking/reservation_api/listing.php', method, params);
                if (results && results.length > 0) {
                    await this._setCachedEzee(cacheKey, results);
                }
            }
            if(!results || results.length == 0){
                return Response.error(res, "ERROR", "No properties available", 400);
            }
            if(!homePageRequest){
                var availableResults = results.filter(res => res.min_ava_rooms > 0);
                if(availableResults.length === 0){
                    var featuredProps = await Property.listPropertiesDetails({featured:1, onlyDisplayImage: true});
                    var featuredProperties = featuredProps.map(a => a.id);
                    var userFavourites = {};
                    if(req.guest){
                        var favourites = await Property.userFavourites(req.guest.id);
                        userFavourites = favourites.map(a => a.property_id);
                    }
                    return Response.success(res, {available:[],featured:featuredProperties,
                        propertiesByCollection:{}, favourites:userFavourites},200);
                }
                filters['channelIds'] = availableResults.map(item => item.roomtypeunkid).join(',');
            }
            console.log('Filters for DB query:', filters);
            // filters['channelIds'] = null;
            filters['onlyDisplayImage'] = true;
            var properties = await Property.listPropertiesDetails(filters);
            // console.log('Properties found in DB:', properties.length);
            
            const petFriendlyCollectionId = await this._getPetFriendlyCollectionId();
            var availableProperties = await this.ezeePropertyParameters(results,properties, petFriendlyCollectionId);
            // console.log('Available properties count after processing:', availableProperties.length);
            var propertiesByCollection = await this.propertiesByCollection(properties);
            properties = await Property.listPropertiesDetails({featured:1, onlyDisplayImage: true});
            var featuredProperties = properties.map(a => a.id);
            var userFavourites = {};
            if(req.guest){
                var favourites = await Property.userFavourites(req.guest.id);
                userFavourites = favourites.map(a => a.property_id);
            }
            return Response.success(res, {available:availableProperties,featured:featuredProperties,
                propertiesByCollection:propertiesByCollection, favourites:userFavourites},200);
        } catch (error) {
            console.error(error);
            return Response.error(res, "ERROR", error.message, 500);
        }
    }

    async propertiesByCollection(properties, activeCollections = null){        
        var propertiesByCollection = {};
        var collections = properties.flatMap(p => p.collections);
        if (!activeCollections) {
            activeCollections = await Collection.activeCollections();
        }
        collections = collections.filter(function(col){
            if(activeCollections.includes(col)){
                return col;
            }
        });
        collections = collections.filter(function(item, pos){
            return collections.indexOf(item)== pos;
        });
        collections.forEach(collection => {
            var props = properties.filter(property => property.collections.includes(collection));
            propertiesByCollection[collection] = props.map(a => a.id);
        });
        return propertiesByCollection;
    }

    async dbPropertyParameters(filteredProperties, petFriendlyCollectionId = null) {
        var properties = filteredProperties.map(dbProp => {
            var property = {};
            property["id"] = dbProp.id;
            property["display_order"] = dbProp.display_order;
            property["channel_id"] = dbProp.channel_id;
            property["listing_name"] = dbProp.listing_name;
            property["slug"] = dbProp.slug;
            property["destination"] = dbProp.destination;
            property["display_image"] = dbProp.display_image;
            property["rating"] = dbProp.google_rating;
            property["google_rating"] = dbProp.google_rating;
            property["google_review_count"] = dbProp.google_review_count;
            property["featured_property"] = dbProp.featured_property;
            property["bedrooms"] = dbProp.number_of_bedrooms;
            property["bathrooms"] = dbProp.number_of_bathrooms;
            property["pool"] = dbProp.pool;
            property["max_capacity"] = parseInt(dbProp.number_of_guests || 0);
            property["price_per_night"] = null;
            //favorite
            property["totalprice_room_only"] = null;
            property["totalprice_inclusive_all"] = null;
            property["property_type"] = dbProp.property_type;
            property["amenities"] = dbProp.amenitiesWithDescriptions;
            property["collections"] = dbProp.collections;
            property["is_pet_friendly"] = petFriendlyCollectionId
                ? (dbProp.collections || []).map(id => parseInt(id)).includes(parseInt(petFriendlyCollectionId))
                : false;
            property["medias"] = dbProp.medias;
            return property;
        });
        properties.sort((a,b)=>a.display_order - b.display_order);
        return properties;
    }

    async ezeePropertyParameters(results,filteredProperties,petFriendlyCollectionId = null, webDiscount = null){
        var propertiesMap = {};
        if (webDiscount === null) {
            webDiscount = await SettingsHelper.webDiscount();
        }

        results.forEach(ezeeProp => {
            var dbProp = filteredProperties.find(p => p.channel_id == ezeeProp.roomtypeunkid);
            if(!dbProp){
                return;
            }
            var price_per_night = Math.round(ezeeProp.room_rates_info.avg_per_night_without_tax * (100 - webDiscount)/100);
            // If this channel_id already exists, keep the one with the lower price
            if(propertiesMap[dbProp.channel_id] && propertiesMap[dbProp.channel_id].price_per_night <= price_per_night){
                return;
            }
            var property = {};
            property["id"] = dbProp.id;
            property["display_order"] = dbProp.display_order;
            property["channel_id"] = dbProp.channel_id;
            property["listing_name"] = dbProp.listing_name;
            property["slug"] = dbProp.slug;
            property["destination"] = dbProp.destination;
            property["display_image"] = dbProp.display_image;
            property["rating"] = dbProp.google_rating;
            property["google_rating"] = dbProp.google_rating;
            property["google_review_count"] = dbProp.google_review_count;
            property["featured_property"] = dbProp.featured_property;
            property["bedrooms"] = dbProp.number_of_bedrooms;
            property["bathrooms"] = dbProp.number_of_bathrooms;
            property["pool"] = dbProp.pool;
            property["max_capacity"] = parseInt(ezeeProp.base_adult_occupancy) + parseInt(ezeeProp.base_child_occupancy);
            property["price_per_night"] = price_per_night;
            //favorite
            property["totalprice_room_only"] = Math.round(ezeeProp.room_rates_info.totalprice_room_only);
            property["totalprice_inclusive_all"] = ezeeProp.room_rates_info.totalprice_inclusive_all;
            property["property_type"] = dbProp.property_type;
            property["amenities"] = dbProp.amenitiesWithDescriptions;
            property["collections"] = dbProp.collections;
            property["is_pet_friendly"] = petFriendlyCollectionId
                ? (dbProp.collections || []).map(id => parseInt(id)).includes(parseInt(petFriendlyCollectionId))
                : false;
            property["medias"] = dbProp.medias;
            propertiesMap[dbProp.channel_id] = property;
        });
        var properties = Object.values(propertiesMap);
        properties.sort((a,b)=>a.display_order - b.display_order);
        return properties;
    }

    async calendarAvailabilityForProperty(req,res){
        var {propertyId} = req.body;
        var dbProperty = await Property.getBySlug(propertyId);
        var property = await this.calendarAvailability_v3(dbProperty[0].channel_id);
        if(property == null){
            return Response.error(res, "ERROR", "Property not available", 400);
        }
        return Response.success(res, {property: property}, 200);
    }

    async calendarAvailability_v2(check_in_date, check_out_date, propertyId){
        var calendar = {};
        const days = eachDayOfInterval({start: check_in_date,end: check_out_date});
        var formattedDay;
        var availability = 0;//unavailable
        for(let day in days){
            formattedDay = format(days[day],'yyyy-MM-dd');
            if(!isBefore(formattedDay,format(new Date(),'yyyy-MM-dd'))){
                availability = 1;//availablle
            }
            calendar[formattedDay] = availability;
        }
        
        if(isBefore(check_in_date,format(new Date(),'yyyy-MM-dd'))){
            check_in_date = format(new Date(),'yyyy-MM-dd');
        }
        const booked = await Booking.calendarAvailability(check_in_date,check_out_date,propertyId);
        booked.forEach(book=>{
            calendar[book.EffectiveDate] = 0;
        });
        return calendar;
    }

    async calendarAvailability_v3(propertyId){
        var calendar = {};
        const results = await Booking.futureOccupiedDates(propertyId);
        results.forEach(result=>{
            calendar[result.EffectiveDate] = 0;
        });
        return calendar;
    }

    async pricingAndDetails(req,res){
       
        try {
            const {check_in_date, check_out_date, propertyId,number_adults, number_children,slug, detailsOnly } = req.body;
           
            
            if(!propertyId && !slug){
                res.status(400).json({ success: false, error: "Mandatory parameters propertyId is missing!" });
                return;
            }
            
            /* Get property details from DB */
            var filters = {};
            if(propertyId){
                filters['id'] = propertyId;
            }else{
                filters['slug'] = slug;
            }
            
            var properties = await Property.listPropertiesDetails(filters);
     
            
            var dbProp = properties.find(p => p.id == propertyId || p.slug == slug);
            if(!dbProp){//no property is found for the propertyId
                console.log('Property not found in database');
                return Response.error(res, "ERROR", "Property not available", 400);
            }

            const latitude = Number(dbProp.google_latitude);
            const longitude = Number(dbProp.google_longitude);
            const hasValidCoordinates = !Number.isNaN(latitude) && !Number.isNaN(longitude);

            // Construct promises to run concurrently
            const attachBrochurePromise = this.attachBrochure(dbProp);
            const petFriendlyCollectionIdPromise = this._getPetFriendlyCollectionId();

            let poiPromise = Promise.resolve([]);
            if (hasValidCoordinates && !detailsOnly) {
                poiPromise = googlePlacesHelper.fetchNearby({
                    latitude,
                    longitude,
                    limit: 9
                }).catch(poiError => {
                    console.log('Failed to fetch nearby Google POIs:', poiError.message || poiError);
                    return [];
                });
            }

            let nearbyPropertiesPromise = Promise.resolve([]);
            if (hasValidCoordinates) {
                nearbyPropertiesPromise = (async () => {
                    try {
                        const nearbyBase = await Property.getNearbyProperties(dbProp.id, latitude, longitude, 3);
                        const nearbyIds = (nearbyBase || []).map((item) => item.id);

                        if (nearbyIds.length > 0) {
                            const nearbyDetails = await Property.listPropertiesDetails({ ids: nearbyIds });
                            const nearbyById = new Map((nearbyDetails || []).map((item) => [Number(item.id), item]));
                            const petFriendlyId = await this._getPetFriendlyCollectionId();

                            return nearbyIds
                                .map((id) => {
                                    const detail = nearbyById.get(Number(id));
                                    if (!detail) return null;
                                    const distanceRow = nearbyBase.find((row) => Number(row.id) === Number(id));

                                    return {
                                        id: detail.id,
                                        title: detail.listing_name,
                                        slug: detail.slug,
                                        rating: detail.google_rating,
                                        image: detail.display_image || null,
                                        description: detail.description_summary || "",
                                        location_name: detail.location_name || detail.city || null,
                                        bedrooms: detail.bedrooms ?? detail.number_of_bedrooms ?? 0,
                                        bathrooms: detail.bathrooms ?? detail.number_of_bathrooms ?? 0,
                                        max_capacity: detail.max_capacity ?? detail.number_of_guests ?? 0,
                                        pool: detail.pool,
                                        petCare: petFriendlyId
                                            ? (detail.collections || []).map(cid => parseInt(cid, 10)).includes(parseInt(petFriendlyId, 10))
                                            : !!detail.is_pet_friendly,
                                        amenities: (detail.amenitiesWithDescriptions || []).map((amenity) => ({
                                            id: amenity.amenity_id,
                                            name: amenity.name,
                                            category_id: amenity.category,
                                            category_name: amenity.category_name,
                                            icon: amenity.icon,
                                            description: amenity.description || "",
                                        })),
                                        distance_km: distanceRow?.distance_km ?? null
                                    };
                                })
                                .filter(Boolean);
                        }
                        return [];
                    } catch (nearbyDbError) {
                        console.log('Failed to fetch nearby properties:', nearbyDbError.message || nearbyDbError);
                        return [];
                    }
                })();
            }

            var adjustedParams = await this.availabilityParams(req.body,true);
            const cacheKey = `singleProperty:${dbProp.channel_id}_${adjustedParams.check_in_date}_${adjustedParams.check_out_date}`;

            const ezeePropPromise = (async () => {
                if (detailsOnly) {
                    return { status: false, property: null };
                }
                try {
                    const cached = await this._getCachedEzee(cacheKey);
                    if (cached) {
                        console.log(`[pricingAndDetails] Ezee Cache hit for channel_id ${dbProp.channel_id}`);
                        return { status: true, property: cached };
                    }
                    console.log(`[pricingAndDetails] Ezee Cache miss for channel_id ${dbProp.channel_id}. Fetching...`);
                    const params = {
                        check_in_date: adjustedParams.check_in_date,
                        check_out_date: adjustedParams.check_out_date,
                        roomtypeunkid: dbProp.channel_id
                    };
                    const result = await this.ezeeHelper.getProperty(params);
                    if (result && result.property) {
                        await this._setCachedEzee(cacheKey, result.property, 5 * 60 * 1000); // 5 min TTL
                    }
                    return result;
                } catch (ezeeError) {
                    console.log('Failed to fetch/cache Ezee property:', ezeeError.message || ezeeError);
                    return { status: false, property: null };
                }
            })();

            // Execute all asynchronous promises concurrently
            const [
                _brochureResult,
                petFriendlyCollectionId,
                pois,
                nearbyProps,
                ezeeResult
            ] = await Promise.all([
                attachBrochurePromise,
                petFriendlyCollectionIdPromise,
                poiPromise,
                nearbyPropertiesPromise,
                ezeePropPromise
            ]);

            const isPetFriendly = petFriendlyCollectionId
                ? (dbProp.collections || []).map(id => parseInt(id, 10)).includes(parseInt(petFriendlyCollectionId, 10))
                : !!dbProp.is_pet_friendly;
            dbProp.is_pet_friendly = isPetFriendly;
            dbProp.petCare = isPetFriendly;
            dbProp.nearby_points_of_interest = pois;
            dbProp.nearby_properties = nearbyProps;

            var ezeeProp = ezeeResult ? ezeeResult.property : null;

            if(!ezeeProp || ezeeProp == null){
                // If Ezee is not available or property doesn't exist in Ezee,
                // we can still show the property with basic information
                dbProp["max_adults_allowed"] = dbProp.number_of_guests || 2;
                dbProp["max_children_allowed"] = dbProp.number_of_extra_guests || 0;
                dbProp["adults"] = adjustedParams.number_adults;
                dbProp["child"] = adjustedParams.number_children;
                dbProp["price_per_night"] = 0; // No pricing available
                dbProp["totalprice_room_only"] = 0;
                dbProp["totalprice_inclusive_all"] = 0;
                dbProp["min_ava_rooms"] = 0; // Not available
                dbProp["ezee_available"] = false; // Flag to indicate Ezee data not available

                // Return the property with basic information
                return Response.success(res, dbProp, 200, "Property found but pricing not available");

            }

            dbProp["max_adults_allowed"] = ezeeProp.max_adult_occupancy;
            dbProp["max_children_allowed"] = ezeeProp.max_child_occupancy;
            dbProp["adults"] = adjustedParams.number_adults;
            dbProp["child"] = adjustedParams.number_children;
            if(adjustedParams.number_adults > ezeeProp.max_adult_occupancy || adjustedParams.number_children > ezeeProp.max_child_occupancy){
                /* Doesn't accommodate that many*/
                return Response.success(res, dbProp, 200, "Not available for the search criteria");
            }
            if(!check_in_date || !check_out_date){
                //if no dates specified, then don't give out prices
                return Response.success(res, dbProp, 200, "No check-in or check-out dates specified");
            }
            var number_of_nights = ((new Date(check_out_date)).getTime() - (new Date(check_in_date)).getTime())/ (1000 * 60 * 60 * 24);
            dbProp["number_of_nights"] = number_of_nights;
            if(ezeeProp.min_ava_rooms == 0){
                return Response.success(res, dbProp, 200, "Not available for the selected dates");
            }

            dbProp["price_per_night"] = ezeeProp.room_rates_info.avg_per_night_without_tax;
            dbProp = await this.pricingCalcs(ezeeProp,number_adults,number_children,dbProp);
            return Response.success(res, dbProp, 200, "Property details retrieved successfully");
        } catch (error) {
            console.error(error);
             return Response.error(res, "ERROR", error.message, 500);
        }
    }

    async ensureBrochureMediaType() {
        let setting = await Setting.getMediaTypeByValue('brochure');
        if (!setting) {
            const insertedId = await Setting.createMediaType(
                'brochure',
                'Brochure',
                'files',
                'Property brochure PDF'
            );
            setting = await Setting.getMediaTypeByValue('brochure');
            if (!setting && insertedId) {
                setting = { id: insertedId, value: 'brochure' };
            }
        }
        return setting;
    }

    async attachBrochure(property){
        try {
            const brochureSetting = await this.ensureBrochureMediaType();
            if(!brochureSetting || !brochureSetting.id){
                return property;
            }
            const [rows] = await pool.query(
                'select media_filename from property_media where property_id = ? and media_type_id = ? limit 1',
                [property.id, brochureSetting.id]
            );
            if(rows && rows.length){
                const url = await this.getPropertyAssetUrl(property.id, rows[0].media_filename);
                property.brochure_url = url;
                property.brochure_filename = rows[0].media_filename;
            }
            return property;
        } catch (error) {
            console.log('Error attaching brochure:', error);
            return property;
        }
    }

    async pricingCalcs(ezeeProp,number_adults,number_children,property){
        var webDiscount = await SettingsHelper.webDiscount();
        console.log(`[PricingCalcs] property=${property.slug} webDiscount=${webDiscount}% ezee_avg_per_night=${ezeeProp.room_rates_info?.avg_per_night_without_tax} nights=${property.number_of_nights} adults=${number_adults} children=${number_children}`);
        var extraAdults = number_adults - parseInt(ezeeProp.base_adult_occupancy);
        var extraChildren = number_children - parseInt(ezeeProp.base_child_occupancy);
        
        //var totalprice_room_only = ezeeProp.room_rates_info.totalprice_room_only;
        //var totalprice_inclusive_all = ezeeProp.room_rates_info.totalprice_inclusive_all;
        var extra_adults_charges = 0;
        var extra_children_charges = 0;
        var price_per_night = Math.round(ezeeProp.room_rates_info.avg_per_night_without_tax * (100-webDiscount)/100);
        
        // Calculate extra charges first
        if(extraAdults > 0){
            Object.values(ezeeProp.extra_adult_rates_info.exclusive_tax).forEach(value => {
                //totalprice_room_only +=  extraAdults * value;
                extra_adults_charges += extraAdults * value;
            });
            Object.values(ezeeProp.extra_adult_rates_info.inclusive_tax_adjustment).forEach(value => {
                //totalprice_inclusive_all += extraAdults * value;
                //totalTaxes += extraAdults * value;
            });
        }
        if(extraChildren > 0){
            Object.values(ezeeProp.extra_child_rates_info.exclusive_tax).forEach(value => {
                //totalprice_room_only +=  extraChildren * value;
                extra_children_charges += extraChildren * value;
            });
            Object.values(ezeeProp.extra_child_rates_info.inclusive_tax_adjustment).forEach(value => {
                //totalprice_inclusive_all += extraChildren * value;
                //totalTaxes += extraChildren * value;
            });
        }
        
        // Calculate base amounts (without extra charges)
        var base_total_room_charges = price_per_night * property["number_of_nights"];
        
        // Calculate total per night including extra charges
        var extra_charges_per_night = (extra_adults_charges + extra_children_charges) / property["number_of_nights"];
        var total_per_night = price_per_night + extra_charges_per_night;
        
        // Determine GST rate based on total per night (including extra charges)
        var gstRate = total_per_night <= 7500 ? 0.05 : 0.18;
        
        // Calculate total room charges for all nights
        var total_room_charges = price_per_night * property["number_of_nights"] + extra_adults_charges + extra_children_charges;
        
        // Apply tax on the total amount
        var totalTaxes = total_room_charges * gstRate;
        
        //var total_taxes = totalprice_inclusive_all - totalprice_room_only;
        property["base_price_per_night"] = price_per_night;
        property["base_total_room_charges"] = base_total_room_charges;
        property["price_per_night"] = total_per_night;
        property["extra_person_charges_per_night"] = extra_charges_per_night;
        property["extra_adults_charges"] = extra_adults_charges;
        property["extra_children_charges"] = extra_children_charges;
        //property["totalprice_room_only"] = totalprice_room_only;
        //property["total_taxes"] = total_taxes;
        //property["totalprice_inclusive_all"] = totalprice_inclusive_all;
        property["total_taxes"] = totalTaxes;
        property["totalprice_room_only"] = total_room_charges;
        property["totalprice_inclusive_all"] = total_room_charges + totalTaxes;
        console.log(`[PricingCalcs] RESULT price_per_night=${property.price_per_night} total_room=${total_room_charges} gst=${totalTaxes} total_inclusive=${total_room_charges+totalTaxes}`);
        return property;
    }

    async findByDates(req, res){
        try{
            const method = 'GET';
            const params = {
                request_type: 'RoomTypeList',
                HotelCode: process.env.EZEE_HOTEL_CODE,
                APIKey: process.env.EZEE_API_KEY,
            };
            const result = await this.ezeeHelper.fetchData('booking/reservation_api/listing.php', method, params);
            return Response.success(res, result, 200, "Room types retrieved successfully");
        }catch(error){
            console.error(error);
            return Response.error(res, "ERROR", error.message, 500);
        }
    }

    async pricingInfo(req,res){
        try{
            const {start, end, property_id} = req.body;
            var property = await Property.getById(property_id);
            if(!property[0]){
                return Response.error(res, "ERROR", "Property does not exist", 400);
            }
            var ezeeProp = await this.ezeeHelper.getProperty({check_in_date:start, check_out_date:end, roomtypeunkid:property[0].channel_id});
            if(!ezeeProp || ezeeProp == null){
                return Response.error(res, "ERROR", "Property not available", 400);
            }
            const rates = ezeeProp.property.room_rates_info.exclusive_tax;
            return Response.success(res, rates, 200, "Pricing information retrieved successfully");
        }catch(error){
            console.error(error);
            return Response.error(res, "ERROR", error.message, 500);
        }
    }

    async datesByProperty(req,res){
        const { year, month, propertyId } = req.query;
        try {
            if (!propertyId) {
                return Response.error(res, "ERROR", "Property ID is required", 400);
            }

            const unavailableRanges = await Booking.propertyCalendar(propertyId); // Fetch from DB
            return Response.success(res, unavailableRanges, 200, "Unavailable dates retrieved successfully");
        } catch (error) {
            return Response.error(res, "ERROR", error.message, 500);
        }
    }
}
module.exports = AvailabilityController;
