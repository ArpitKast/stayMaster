'use strict';
const dotenv = require("dotenv").config();
const pool = require('../config/dbConnection');
const property = require("../models/propertyModel");
const Property = new property;
const collection = require("../models/collectionModel");
const Collection = new collection();
const settingModel = require("../models/settingModel");
const Setting = new settingModel();
const settingHelper = require("../helpers/settingsHelper");
const SettingsHelper = new settingHelper();
const S3Helper = require('../helpers/s3Helper');
const GooglePlacesHelper = require('../helpers/googlePlacesHelper');
const googlePlacesHelper = new GooglePlacesHelper();
const Response = require('../helpers/responseHelper');
const redisClient = require('../config/redisConnection');

const {
    propertyBucketRaw,
    propertyBucketName,
    propertyBucketPrefix,
    propertyImageBaseUrl,
    propertyCdnPrefix,
    hasUsableCdnBaseUrl,
    buildCdnUrl
} = require('../config/cdnConfig');

const { format, addDays, isBefore } = require("date-fns");

class PropertyDetailsController {
    constructor(ezeeHelper) {
        this.ezeeHelper = ezeeHelper;
        this._ezeeCache = new Map();
        this._petFriendlyCollectionId = undefined;
    }

    async getPropertyAssetUrl(propertyId, mediaFilename) {
        if (!mediaFilename) return '';
        const filePath = `${propertyId}/${mediaFilename}`;
        if (hasUsableCdnBaseUrl) {
            return buildCdnUrl(filePath, propertyCdnPrefix);
        }
        const key = [propertyBucketPrefix, filePath].filter(Boolean).join('/');
        const urlParams = { Bucket: propertyBucketName || propertyBucketRaw, Key: key, Expires: 3600 };
        return S3Helper.getSignedUrlPromise(urlParams);
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

    async attachBrochure(property) {
        try {
            const brochureSetting = await this.ensureBrochureMediaType();
            if (!brochureSetting || !brochureSetting.id) {
                return property;
            }
            const [rows] = await pool.query(
                'select media_filename from property_media where property_id = ? and media_type_id = ? limit 1',
                [property.id, brochureSetting.id]
            );
            if (rows && rows.length) {
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

        this._ezeeCache.set(key, { data, expiresAt: Date.now() + ttlMs });
    }

    async availabilityParams(inputs) {
        let { check_in_date, check_out_date, number_adults, number_children, adults, kids } = inputs;
        number_adults = number_adults || adults;
        number_children = number_children || kids;
        if (!check_in_date) {
            check_in_date = format(new Date(), 'yyyy-MM-dd');
            check_out_date = format(addDays(new Date(), 2), 'yyyy-MM-dd');
        }
        if (!check_out_date) {
            check_out_date = format(addDays(check_in_date, 2), 'yyyy-MM-dd');
        }
        if (!number_adults || number_adults == 0) {
            number_adults = 2;
        }
        if (number_children === undefined || number_children === null) {
            number_children = 0;
        }
        return { check_in_date, check_out_date, number_adults, number_children };
    }

    async pricingCalcs(ezeeProp, number_adults, number_children, property) {
        var webDiscount = await SettingsHelper.webDiscount();
        var extraAdults = number_adults - parseInt(ezeeProp.base_adult_occupancy);
        var extraChildren = number_children - parseInt(ezeeProp.base_child_occupancy);
        
        var extra_adults_charges = 0;
        var extra_children_charges = 0;
        var price_per_night = Math.round(ezeeProp.room_rates_info.avg_per_night_without_tax * (100 - webDiscount) / 100);
        
        if (extraAdults > 0) {
            Object.values(ezeeProp.extra_adult_rates_info.exclusive_tax).forEach(value => {
                extra_adults_charges += extraAdults * value;
            });
        }
        if (extraChildren > 0) {
            Object.values(ezeeProp.extra_child_rates_info.exclusive_tax).forEach(value => {
                extra_children_charges += extraChildren * value;
            });
        }
        
        var base_total_room_charges = price_per_night * property["number_of_nights"];
        var extra_charges_per_night = (extra_adults_charges + extra_children_charges) / property["number_of_nights"];
        var total_per_night = price_per_night + extra_charges_per_night;
        
        var gstRate = total_per_night <= 7500 ? 0.05 : 0.18;
        var total_room_charges = price_per_night * property["number_of_nights"] + extra_adults_charges + extra_children_charges;
        var totalTaxes = total_room_charges * gstRate;
        
        property["base_price_per_night"] = price_per_night;
        property["base_total_room_charges"] = base_total_room_charges;
        property["price_per_night"] = total_per_night;
        property["extra_person_charges_per_night"] = extra_charges_per_night;
        property["extra_adults_charges"] = extra_adults_charges;
        property["extra_children_charges"] = extra_children_charges;
        property["total_taxes"] = totalTaxes;
        property["totalprice_room_only"] = total_room_charges;
        property["totalprice_inclusive_all"] = total_room_charges + totalTaxes;
        return property;
    }

    /**
     * GET /api/ext/properties/:slug/basic
     * Returns basic details, amenities, and main display image
     */
    async basicDetails(req, res) {
        try {
            const { slug } = req.params;
            if (!slug) {
                return Response.error(res, "ERROR", "Property slug is required", 400);
            }

            const properties = await Property.listPropertiesDetails({ slug, noMedia: true });
            const dbProp = properties.find(p => p.slug === slug);
            if (!dbProp) {
                return Response.error(res, "ERROR", "Property not found", 404);
            }

            const petFriendlyCollectionId = await this._getPetFriendlyCollectionId();
            const isPetFriendly = petFriendlyCollectionId
                ? (dbProp.collections || []).map(id => parseInt(id, 10)).includes(parseInt(petFriendlyCollectionId, 10))
                : !!dbProp.is_pet_friendly;

            const finalizedProp = await this.attachBrochure(dbProp);

            const basicResponse = {
                id: dbProp.id,
                slug: dbProp.slug,
                listing_name: dbProp.listing_name,
                city: dbProp.city,
                state: dbProp.state,
                country: dbProp.country,
                address_line_1: dbProp.address_line_1,
                address_line_2: dbProp.address_line_2,
                description_summary: dbProp.description_summary,
                number_of_bedrooms: dbProp.number_of_bedrooms,
                number_of_bathrooms: dbProp.number_of_bathrooms,
                number_of_guests: dbProp.number_of_guests,
                number_of_extra_guests: dbProp.number_of_extra_guests,
                display_image: null,
                check_in: dbProp.check_in,
                check_out: dbProp.check_out,
                google_latitude: dbProp.google_latitude,
                google_longitude: dbProp.google_longitude,
                google_rating: dbProp.google_rating,
                google_review_count: dbProp.google_review_count,
                house_rules: dbProp.house_rules,
                cancellation_policy: dbProp.cancellation_policy,
                brochure_url: finalizedProp.brochure_url || null,
                brochure_filename: finalizedProp.brochure_filename || null,
                amenitiesWithDescriptions: (dbProp.amenitiesWithDescriptions || []).map(amenity => ({
                    amenity_id: amenity.amenity_id,
                    name: amenity.name,
                    category: amenity.category,
                    category_name: amenity.category_name,
                    icon: amenity.icon,
                    description: amenity.description || ""
                })),
                collections: dbProp.collections || [],
                is_pet_friendly: isPetFriendly,
                petCare: isPetFriendly,
                meals_available: dbProp.meals_available || 0,
                pool: dbProp.pool,
                pooltype: dbProp.pooltype
            };

            return Response.success(res, basicResponse, 200, "Basic property details retrieved successfully");
        } catch (error) {
            console.error('[basicDetails] Error:', error);
            return Response.error(res, "ERROR", error.message, 500);
        }
    }

    /**
     * POST /api/ext/properties/:slug/media
     * Returns categorized gallery images with presigned URLs
     */
    async media(req, res) {
        try {
            const { slug } = req.params;
            if (!slug) {
                return Response.error(res, "ERROR", "Property slug is required", 400);
            }

            const dbProperties = await Property.getBySlug(slug);
            if (!dbProperties || dbProperties.length === 0) {
                return Response.error(res, "ERROR", "Property not found", 404);
            }
            const property = dbProperties[0];

            const mediaResults = await pool.query(
                `select pm.*,s.display from property_media pm, settings s where pm.property_id = ? and pm.media_type_id = s.id order by s.value,pm.display_order`,
                [property.id]
            );

            const presignedURLs = await Property.getPresignedURLs(mediaResults[0]);
            const photoCategories = await pool.query("select id,display from settings where setting = 'media_type' and category='photos'");

            const propertyWithFiles = await Property.propertyDetailsFiles(property, mediaResults[0], presignedURLs);
            const propertyWithMedias = await Property.propertyDetailsPhotos(propertyWithFiles, mediaResults[0], presignedURLs, photoCategories[0]);

            return Response.success(res, {
                display_image: propertyWithMedias.display_image || null,
                display_image_id: propertyWithMedias.display_image_id || null,
                virtual_tour: propertyWithMedias.virtual_tour || null,
                meals_menu: propertyWithMedias.meals_menu || null,
                medias: propertyWithMedias.medias || {}
            }, 200, "Property media gallery retrieved successfully");
        } catch (error) {
            console.error('[media] Error:', error);
            return Response.error(res, "ERROR", error.message, 500);
        }
    }

    /**
     * POST /api/ext/properties/:slug/price
     * Returns dynamic Ezee prices, taxes and check availability status
     */
    async pricing(req, res) {
        try {
            const { slug } = req.params;
            const { check_in_date, check_out_date, number_adults, number_children } = req.body;

            if (!slug) {
                return Response.error(res, "ERROR", "Property slug is required", 400);
            }

            const dbProperties = await Property.getBySlug(slug);
            if (!dbProperties || dbProperties.length === 0) {
                return Response.error(res, "ERROR", "Property not found", 404);
            }
            const property = dbProperties[0];

            const adjustedParams = await this.availabilityParams(req.body);
            const cacheKey = `singleProperty:${property.channel_id}_${adjustedParams.check_in_date}_${adjustedParams.check_out_date}`;

            const isRefresh = req.query.refresh === 'true' || req.body.refresh === true;
            if (isRefresh) {
                const CacheService = require('../services/CacheService');
                await CacheService.delete(`ezee:${cacheKey}`);
                this._ezeeCache.delete(cacheKey);
            }

            let ezeeProp = null;
            try {
                const cached = await this._getCachedEzee(cacheKey);
                if (cached) {
                    console.log(`[propertyDetailsPricing] Ezee Cache hit for channel_id ${property.channel_id}`);
                    ezeeProp = cached;
                } else {
                    console.log(`[propertyDetailsPricing] Ezee Cache miss for channel_id ${property.channel_id}. Fetching...`);
                    const params = {
                        check_in_date: adjustedParams.check_in_date,
                        check_out_date: adjustedParams.check_out_date,
                        roomtypeunkid: property.channel_id
                    };
                    const result = await this.ezeeHelper.getProperty(params);
                    if (result && result.property) {
                        ezeeProp = result.property;
                        await this._setCachedEzee(cacheKey, result.property, 5 * 60 * 1000); // 5 min TTL
                    }
                }
            } catch (ezeeError) {
                console.log('Failed to fetch/cache Ezee property in sectional API:', ezeeError.message || ezeeError);
            }

            const pricingResult = {};
            pricingResult["id"] = property.id;
            pricingResult["slug"] = property.slug;

            if (!ezeeProp) {
                pricingResult["max_adults_allowed"] = property.number_of_guests || 2;
                pricingResult["max_children_allowed"] = property.number_of_extra_guests || 0;
                pricingResult["adults"] = adjustedParams.number_adults;
                pricingResult["child"] = adjustedParams.number_children;
                pricingResult["price_per_night"] = 0;
                pricingResult["totalprice_room_only"] = 0;
                pricingResult["totalprice_inclusive_all"] = 0;
                pricingResult["min_ava_rooms"] = 0;
                pricingResult["ezee_available"] = false;

                return Response.success(res, pricingResult, 200, "Ezee pricing service unavailable, basic placeholders returned");
            }

            pricingResult["max_adults_allowed"] = ezeeProp.max_adult_occupancy;
            pricingResult["max_children_allowed"] = ezeeProp.max_child_occupancy;
            pricingResult["adults"] = adjustedParams.number_adults;
            pricingResult["child"] = adjustedParams.number_children;

            if (adjustedParams.number_adults > ezeeProp.max_adult_occupancy || adjustedParams.number_children > ezeeProp.max_child_occupancy) {
                pricingResult["ezee_available"] = true;
                pricingResult["min_ava_rooms"] = ezeeProp.min_ava_rooms;
                return Response.success(res, pricingResult, 200, "Not available for this occupancy search criteria");
            }

            if (!check_in_date || !check_out_date) {
                pricingResult["ezee_available"] = true;
                pricingResult["price_per_night"] = 0;
                pricingResult["min_ava_rooms"] = ezeeProp.min_ava_rooms;
                return Response.success(res, pricingResult, 200, "Dates not specified");
            }

            const number_of_nights = ((new Date(check_out_date)).getTime() - (new Date(check_in_date)).getTime()) / (1000 * 60 * 60 * 24);
            pricingResult["number_of_nights"] = number_of_nights;

            if (ezeeProp.min_ava_rooms == 0) {
                pricingResult["ezee_available"] = true;
                pricingResult["min_ava_rooms"] = 0;
                return Response.success(res, pricingResult, 200, "Not available for selected dates");
            }

            pricingResult["min_ava_rooms"] = ezeeProp.min_ava_rooms;
            pricingResult["ezee_available"] = true;
            pricingResult["price_per_night"] = ezeeProp.room_rates_info.avg_per_night_without_tax;

            const finalizedPricing = await this.pricingCalcs(ezeeProp, adjustedParams.number_adults, adjustedParams.number_children, pricingResult);

            const cleanPricing = {
                id: finalizedPricing.id,
                slug: finalizedPricing.slug,
                max_adults_allowed: finalizedPricing.max_adults_allowed,
                max_children_allowed: finalizedPricing.max_children_allowed,
                adults: finalizedPricing.adults,
                child: finalizedPricing.child,
                price_per_night: finalizedPricing.price_per_night,
                base_price_per_night: finalizedPricing.base_price_per_night,
                base_total_room_charges: finalizedPricing.base_total_room_charges,
                extra_person_charges_per_night: finalizedPricing.extra_person_charges_per_night,
                extra_adults_charges: finalizedPricing.extra_adults_charges,
                extra_children_charges: finalizedPricing.extra_children_charges,
                total_taxes: finalizedPricing.total_taxes,
                totalprice_room_only: finalizedPricing.totalprice_room_only,
                totalprice_inclusive_all: finalizedPricing.totalprice_inclusive_all,
                number_of_nights: finalizedPricing.number_of_nights,
                min_ava_rooms: finalizedPricing.min_ava_rooms,
                ezee_available: finalizedPricing.ezee_available
            };

            return Response.success(res, cleanPricing, 200, "Property pricing calculated successfully");
        } catch (error) {
            console.error('[pricing] Error:', error);
            return Response.error(res, "ERROR", error.message, 500);
        }
    }

    /**
     * POST /api/ext/properties/:slug/poi
     * Returns Google Places points of interest near the property
     */
    async poi(req, res) {
        try {
            const { latitude, longitude } = req.body;
            if (!latitude || !longitude) {
                return Response.error(res, "ERROR", "Latitude and Longitude are required", 400);
            }

            const pois = await googlePlacesHelper.fetchNearby({
                latitude: Number(latitude),
                longitude: Number(longitude),
                limit: 9
            }).catch(poiError => {
                console.log('Failed to fetch Google POIs:', poiError.message || poiError);
                return [];
            });

            const cleanPois = pois.map(item => ({
                name: item.name,
                distanceKm: item.distanceKm || item.distance_km || null,
                googleMapsUrl: item.googleMapsUrl || item.google_maps_url || null
            }));

            return Response.success(res, cleanPois, 200, "Local points of interest retrieved successfully");
        } catch (error) {
            console.error('[poi] Error:', error);
            return Response.error(res, "ERROR", error.message, 500);
        }
    }

    /**
     * POST /api/ext/properties/:slug/nearby
     * Returns 3 nearby similar properties utilizing basic details only (fast)
     */
    async nearby(req, res) {
        try {
            const { slug } = req.params;
            const { latitude, longitude, propertyId } = req.body;

            if (!latitude || !longitude || !propertyId) {
                return Response.error(res, "ERROR", "latitude, longitude and propertyId are required", 400);
            }

            const nearbyBase = await Property.getNearbyProperties(propertyId, Number(latitude), Number(longitude), 3);
            const nearbyIds = (nearbyBase || []).map((item) => item.id);

            if (nearbyIds.length === 0) {
                return Response.success(res, [], 200, "No nearby properties found");
            }

            const nearbyDetails = await Property.listPropertiesDetails({ ids: nearbyIds, onlyDisplayImage: true });
            const nearbyById = new Map((nearbyDetails || []).map((item) => [Number(item.id), item]));
            const petFriendlyId = await this._getPetFriendlyCollectionId();

            const formattedNearby = nearbyIds
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

            return Response.success(res, formattedNearby, 200, "Nearby properties retrieved successfully");
        } catch (error) {
            console.error('[nearby] Error:', error);
            return Response.error(res, "ERROR", error.message, 500);
        }
    }
}

module.exports = PropertyDetailsController;
