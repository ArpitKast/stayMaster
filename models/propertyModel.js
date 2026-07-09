var pool = require('../config/dbConnection');
const S3Helper = require('../helpers/s3Helper');
//const BaseModel = require('./baseModel');
const {
    propertyBucketRaw,
    propertyBucketName,
    propertyBucketPrefix,
    propertyImageBaseUrl,
    propertyCdnPrefix,
    hasUsableCdnBaseUrl,
    buildCdnUrl
} = require('../config/cdnConfig');
const bucket = propertyBucketRaw;
const baseModel = require("../models/baseModel");
class Property extends baseModel{
    getPropertyMediaKey(propertyId, mediaFilename) {
        return [propertyBucketPrefix, `${propertyId}/${mediaFilename}`].filter(Boolean).join('/');
    }

    getPropertyMediaCdnKey(propertyId, mediaFilename) {
        return [propertyCdnPrefix, `${propertyId}/${mediaFilename}`].filter(Boolean).join('/');
    }

    async getPropertyMediaUrl(propertyId, mediaFilename) {
        if (!mediaFilename) return null;
        if (hasUsableCdnBaseUrl) {
            return buildCdnUrl(this.getPropertyMediaCdnKey(propertyId, mediaFilename));
        }
        const key = this.getPropertyMediaKey(propertyId, mediaFilename);
        const urlParams = { Bucket: propertyBucketName || bucket, Key: key, Expires: 3600 };
        return S3Helper.getSignedUrlPromise(urlParams);
    }

    async _propertiesColumnSet() {
        if (this._propertyColumns) return this._propertyColumns;
        const result = await pool.query('SHOW COLUMNS FROM properties');
        this._propertyColumns = new Set((result[0] || []).map((row) => row.Field));
        return this._propertyColumns;
    }

    _toArray(value) {
        if (value === undefined || value === null) return [];
        if (Array.isArray(value)) return value.filter(v => v !== undefined && v !== null && `${v}`.trim() !== '');
        if (typeof value === 'string') return value.split(',').map(v => v.trim()).filter(Boolean);
        return [value];
    }

    async getAll(params={}) {
        try{
            var query = 'SELECT * FROM properties WHERE id IN (SELECT DISTINCT property_id FROM property_media WHERE media_type_id = 4)';
            var values = [];
            var whereAppended = true;
            if(params.id || params.slug){
                if(params.id){
                    query += ' AND id = ?';
                    values.push(params.id);
                }else{
                    query += ' AND slug = ?';
                    values.push(params.slug);
                }
            }else{
                if(params.ids){
                    const ids = Array.isArray(params.ids) ? params.ids : [params.ids];
                    const normalizedIds = ids
                        .map((id) => parseInt(id, 10))
                        .filter((id) => !Number.isNaN(id));
                    if (normalizedIds.length > 0) {
                        const placeholders = normalizedIds.map(() => '?').join(',');
                        query += ` AND id in (${placeholders})`;
                        values.push(...normalizedIds);
                    }
                }
                if(params.collection){
                    const collections = Array.isArray(params.collection) ? params.collection : [params.collection].filter(c => c && c.toString().trim() !== '');
                    if (collections.length > 0) {
                        const placeholders = collections.map(() => '?').join(',');
                        var matchingProperties = await pool.query(`select * from property_collections where collection_id in (select id from collections where slug in (${placeholders}))`, collections);
                        const propertyIds = (matchingProperties[0] || []).map(item => item.property_id);
                        if(propertyIds.length === 0){
                            return [];
                        }
                        query += ` AND id in (${propertyIds.map(()=>'?').join(',')})`;
                        values.push(...propertyIds);
                    }
                }
                if(params.channelIds){
                    const ids = Array.isArray(params.channelIds) ? params.channelIds : params.channelIds.toString().split(',').filter(id => id.trim() !== '');
                    if (ids.length > 0) {
                        const placeholders = ids.map(()=>'?').join(',');
                        query += whereAppended ? ` and channel_id in (${placeholders})` : ` where channel_id in (${placeholders})`;
                        values.push(...ids);
                        whereAppended = true;
                    }
                }
                if(params.destination){
                    query += whereAppended ? ' and destination = ?' : ' where destination = ?';
                    values.push(params.destination);
                    whereAppended = true;
                }
                if(params.featured){
                    query += whereAppended ? ' and featured_property = ?' : ' where featured_property = ?';
                    values.push(params.featured);
                    whereAppended = true;
                }
                if (parseInt(params.bedrooms, 10) > 0) {
                    query += ' AND number_of_bedrooms >= ?';
                    values.push(parseInt(params.bedrooms, 10));
                }
                const propertyTypes = this._toArray(params.property_types);
                if (propertyTypes.length > 0) {
                    const ids = propertyTypes
                        .map((v) => parseInt(v, 10))
                        .filter((v) => !Number.isNaN(v));
                    if (ids.length > 0) {
                        query += ` AND property_type IN (${ids.map(() => '?').join(',')})`;
                        values.push(...ids);
                    } else {
                        const typeMatches = await pool.query(
                            `SELECT id FROM settings WHERE setting = 'property_type' AND (value IN (${propertyTypes.map(() => '?').join(',')}) OR display IN (${propertyTypes.map(() => '?').join(',')}))`,
                            [...propertyTypes, ...propertyTypes]
                        );
                        const matchedIds = (typeMatches[0] || []).map((row) => row.id);
                        if (matchedIds.length === 0) return [];
                        query += ` AND property_type IN (${matchedIds.map(() => '?').join(',')})`;
                        values.push(...matchedIds);
                    }
                }
                const amenityIds = this._toArray(params.amenities)
                    .map((v) => parseInt(v, 10))
                    .filter((v) => !Number.isNaN(v));
                if (amenityIds.length > 0) {
                    query += ` AND id IN (
                        SELECT DISTINCT property_id
                        FROM property_amenities
                        WHERE amenity_id IN (${amenityIds.map(() => '?').join(',')})
                    )`;
                    values.push(...amenityIds);
                }
                if (params.staymaster_select) {
                    query += ' AND staymaster_select = 1';
                }
                const columns = await this._propertiesColumnSet();
                const brands = this._toArray(params.brands);
                if (brands.length > 0 && columns.has('brand')) {
                    query += ` AND brand IN (${brands.map(() => '?').join(',')})`;
                    values.push(...brands);
                }
                const clusters = this._toArray(params.clusters);
                if (clusters.length > 0 && columns.has('cluster')) {
                    query += ` AND cluster IN (${clusters.map(() => '?').join(',')})`;
                    values.push(...clusters);
                }
                if (params.filterKey && ['for_events', 'for_corporate_offsite'].includes(params.filterKey)) {
                    query += whereAppended ? ` and ${params.filterKey} = ?` : ` where ${params.filterKey} = ?`;
                    values.push(parseInt(params.filterValue ?? 1));
                    whereAppended = true;
                }
            }
                if(params.pets){
                    query += ' AND id in (select property_id from property_collections where collection_id in (select id from collections where slug = "pet-friendly"))';
                }
                query += ' ORDER BY display_order ASC';
                if (params.limit !== undefined && params.limit !== null) {
                query += ' LIMIT ? OFFSET ?';
                values.push(parseInt(params.limit));
                values.push(parseInt(params.offset || 0));
            }
            const results = await pool.query(query, values);
            return results[0];
        }catch(error){
            console.log("error in get all");
            throw error;
        }
    }

    async getCount(params={}) {
        try {
            var query = 'SELECT COUNT(*) as total FROM properties WHERE id IN (SELECT DISTINCT property_id FROM property_media WHERE media_type_id = 4)';
            var values = [];
            var whereAppended = true;
            if(params.id || params.slug){
                if(params.id){
                    query += ' AND id = ?';
                    values.push(params.id);
                }else{
                    query += ' AND slug = ?';
                    values.push(params.slug);
                }
            }else{
                if(params.collection){
                    const collections = Array.isArray(params.collection) ? params.collection : [params.collection].filter(c => c && c.toString().trim() !== '');
                    if (collections.length > 0) {
                        const placeholders = collections.map(() => '?').join(',');
                        var matchingProperties = await pool.query(`select * from property_collections where collection_id in (select id from collections where slug in (${placeholders}))`, collections);
                        const propertyIds = (matchingProperties[0] || []).map(item => item.property_id);
                        if(propertyIds.length === 0){ return 0; }
                        query += ` AND id in (${propertyIds.map(()=>'?').join(',')})`;
                        values.push(...propertyIds);
                    }
                }
                if(params.channelIds){
                    const ids = Array.isArray(params.channelIds) ? params.channelIds : params.channelIds.toString().split(',').filter(id => id.trim() !== '');
                    if (ids.length > 0) {
                        const placeholders = ids.map(()=>'?').join(',');
                        query += whereAppended ? ` and channel_id in (${placeholders})` : ` where channel_id in (${placeholders})`;
                        values.push(...ids);
                        whereAppended = true;
                    }
                }
                if(params.destination){
                    query += whereAppended ? ' and destination = ?' : ' where destination = ?';
                    values.push(params.destination);
                    whereAppended = true;
                }
                if(params.featured){
                    query += whereAppended ? ' and featured_property = ?' : ' where featured_property = ?';
                    values.push(params.featured);
                    whereAppended = true;
                }
                if (parseInt(params.bedrooms, 10) > 0) {
                    query += ' AND number_of_bedrooms >= ?';
                    values.push(parseInt(params.bedrooms, 10));
                }
                const propertyTypes = this._toArray(params.property_types);
                if (propertyTypes.length > 0) {
                    const ids = propertyTypes
                        .map((v) => parseInt(v, 10))
                        .filter((v) => !Number.isNaN(v));
                    if (ids.length > 0) {
                        query += ` AND property_type IN (${ids.map(() => '?').join(',')})`;
                        values.push(...ids);
                    } else {
                        const typeMatches = await pool.query(
                            `SELECT id FROM settings WHERE setting = 'property_type' AND (value IN (${propertyTypes.map(() => '?').join(',')}) OR display IN (${propertyTypes.map(() => '?').join(',')}))`,
                            [...propertyTypes, ...propertyTypes]
                        );
                        const matchedIds = (typeMatches[0] || []).map((row) => row.id);
                        if (matchedIds.length === 0) return 0;
                        query += ` AND property_type IN (${matchedIds.map(() => '?').join(',')})`;
                        values.push(...matchedIds);
                    }
                }
                const amenityIds = this._toArray(params.amenities)
                    .map((v) => parseInt(v, 10))
                    .filter((v) => !Number.isNaN(v));
                if (amenityIds.length > 0) {
                    query += ` AND id IN (
                        SELECT DISTINCT property_id
                        FROM property_amenities
                        WHERE amenity_id IN (${amenityIds.map(() => '?').join(',')})
                    )`;
                    values.push(...amenityIds);
                }
                if (params.staymaster_select) {
                    query += ' AND staymaster_select = 1';
                }
                const columns = await this._propertiesColumnSet();
                const brands = this._toArray(params.brands);
                if (brands.length > 0 && columns.has('brand')) {
                    query += ` AND brand IN (${brands.map(() => '?').join(',')})`;
                    values.push(...brands);
                }
                const clusters = this._toArray(params.clusters);
                if (clusters.length > 0 && columns.has('cluster')) {
                    query += ` AND cluster IN (${clusters.map(() => '?').join(',')})`;
                    values.push(...clusters);
                }
                if (params.filterKey && ['for_events', 'for_corporate_offsite'].includes(params.filterKey)) {
                    query += whereAppended ? ` and ${params.filterKey} = ?` : ` where ${params.filterKey} = ?`;
                    values.push(parseInt(params.filterValue ?? 1));
                    whereAppended = true;
                }
                if(params.pets){
                    query += ' AND id in (select property_id from property_collections where collection_id in (select id from collections where slug = "pet-friendly"))';
                }
            }
            const results = await pool.query(query, values);
            return results[0][0].total;
        } catch(error) {
            console.log("error in getCount");
            throw error;
        }
    }

    /*async listPropertiesDetails1(params={}){
        try {
            var properties = await this.getAll(params);
            const propertysWithDetails = [];
            if(properties.length == 0){
                return propertysWithDetails;
            }
            var propertyIDs = properties.map(item => `${item.id}`).join(',');
            var amenityResults = await pool.query(`select ac.id as category_id, ac.name as category,pa.property_id,pa.amenity_id,a.name,pa.amenity_description,a.icon FROM amenities a, property_amenities pa, amenity_categories ac where pa.amenity_id = a.id and a.category_id = ac.id and pa.property_id in (${propertyIDs}) order by category_id`);
            var collectionResults = await pool.query(`select pc.property_id,pc.collection_id from property_collections pc, collections c where pc.property_id in (${propertyIDs}) and pc.collection_id = c.id and c.active=1`);
            var mediaResults = await pool.query(`select pm.*,s.display from property_media pm, settings s where pm.property_id in (${propertyIDs}) and pm.media_type_id = s.id order by pm.display_order`);
            var presignedURLs = await this.getPresignedURLs(mediaResults[0]);
            var photoCategories = await pool.query("select id,display from settings where setting = 'media_type' and category='photos'");
            properties.forEach(property => {
                var ams = amenityResults[0].filter(am => am.property_id == property.id);
                
                var amenities = [];
                var amenitiesWithDescriptions = [];
                ams.forEach(amenity =>{
                    amenitiesWithDescriptions.push({"amenity_id":amenity.amenity_id,"name":amenity.name,"category":amenity.category_id,"category_name":amenity.category,"description":amenity.amenity_description,"icon":amenity.icon});
                    amenities.push(amenity.amenity_id);
                });
                property.amenitiesWithDescriptions = amenitiesWithDescriptions;
                property.amenities = amenities;
                property.pool = false;
                if(amenities.includes(1));{
                    property.pool = true;
                }
                
                var colls = collectionResults[0].filter(col => col.property_id == property.id);
                var collections = [];
                colls.forEach(collection => {
                    collections.push(collection.collection_id);
                });
                property.collections = collections;

                var xFileIds = [4,5,6];
                var xFileMap = {4:'display_image',5:'virtual_tour',6:'meals_menu'};
                var meds = mediaResults[0].filter(m => m.property_id == property.id && xFileIds.includes(m.media_type_id));
                meds.forEach(med =>{
                    var presigned = presignedURLs.find(psu => psu.fileName == med.media_filename);
                    var fName = xFileMap[med.media_type_id];
                    property[fName] = presigned.url;
                    if(med.media_type_id == 4){
                        property["display_image_id"] = med.id;
                    }
                });
                meds = mediaResults[0].filter(m => m.property_id == property.id && !xFileIds.includes(m.media_type_id));
                var medCats = meds.flatMap(m=>m.display);
                medCats = medCats.filter(function(item, pos){
                    return medCats.indexOf(item)== pos;
                });
                var medias = [];
                meds.forEach(med =>{
                    var presigned = presignedURLs.find(psu => psu.fileName == med.media_filename);
                    medias.push({"media_id":med.id,"catgeory_name":med.display,"order":med.display_order,"title":med.title,"description":med.description,"filename":presigned.url});
                });
                var mediaByCategory = {};
                var mediaByCategoryId = {};
                medCats.forEach(medCat =>{
                    mediaByCategory[medCat] = medias.filter(m=> m.catgeory_name == medCat);
                    var catIdSetting = photoCategories[0].find(c => c.display == medCat);
                    if(catIdSetting){
                        mediaByCategoryId[catIdSetting.id] = medias.filter(m=> m.catgeory_name == medCat);
                    }
                });
                property.medias = mediaByCategory;
                property.mediasById = mediaByCategoryId;
                propertysWithDetails.push(property);
            });
            return propertysWithDetails;
        } catch (error) {
            console.log("error in listPropertiesDetails");
            console.log(error);
            throw error;
        }
    }*/

    async listPropertiesDetails(params={}){
        try {
            var properties = await this.getAll(params);
            const propertysWithDetails = [];
            if(properties.length == 0){
                return propertysWithDetails;
            }
            var propertyIDs = properties.map(item => `${item.id}`).join(',');
            var amenityResults = await pool.query(`select ac.id as category_id, ac.name as category,pa.property_id,pa.amenity_id,a.name,pa.amenity_description,a.icon FROM amenities a, property_amenities pa, amenity_categories ac where pa.amenity_id = a.id and a.category_id = ac.id and pa.property_id in (${propertyIDs}) order by category_id`);
            //var collectionResults = await pool.query(`select pc.property_id,pc.collection_id from property_collections pc, collections c where pc.property_id in (${propertyIDs}) and pc.collection_id = c.id and c.active=1`);
            var collectionResults = await pool.query(`select pc.property_id,pc.collection_id,c.active from property_collections pc, collections c where pc.property_id in (${propertyIDs}) and pc.collection_id = c.id`);
            
            var mediaResults = [[]];
            var presignedURLs = [];
            var photoCategories = [[]];
            
            if (!params || !params.noMedia) {
                let mediaQuery = `select pm.*,s.display from property_media pm, settings s where pm.property_id in (${propertyIDs}) and pm.media_type_id = s.id`;
                if (params && params.onlyDisplayImage) {
                    mediaQuery += ` and pm.media_type_id = 4`;
                }
                mediaQuery += ` order by s.value,pm.display_order`;
                mediaResults = await pool.query(mediaQuery);
                presignedURLs = await this.getPresignedURLs(mediaResults[0]);
                photoCategories = await pool.query("select id,display from settings where setting = 'media_type' and category='photos'");
            }
            
            var hosts = await pool.query(`select property_id,host_id from property_hosts where property_id in (${propertyIDs})`);
            for(let i=0; i< properties.length; i++){
                var property = properties[i];
                property = await this.propertyDetailsAmenities(property,amenityResults[0]);
                property = await this.propertyDetailsCollections(property,collectionResults[0]);
                property = await this.propertyDetailsFiles(property,mediaResults[0] || [],presignedURLs || []);
                property = await this.propertyDetailsPhotos(property,mediaResults[0] || [],presignedURLs || [],photoCategories[0] || []);
                property = await this.propertyHosts(property,hosts[0]);
                propertysWithDetails.push(property);
            }
            return propertysWithDetails;
        } catch (error) {
            console.log("error in listPropertiesDetails");
            console.log(error);
            throw error;
        }
    }

    async propertyDetailsAmenities(property,amenityResults){
        var ams = amenityResults.filter(am => am.property_id == property.id);
        var amenities = [];
        var amenitiesWithDescriptions = [];
        ams.forEach(amenity =>{
            amenitiesWithDescriptions.push({"amenity_id":amenity.amenity_id,"name":amenity.name,"category":amenity.category_id,"category_name":amenity.category,"description":amenity.amenity_description,"icon":amenity.icon});
            amenities.push(amenity.amenity_id);
        });
        property.amenitiesWithDescriptions = amenitiesWithDescriptions;
        property.amenities = amenities;
        property.pool = false;
        if(amenities.includes(1)){
            property.pool = true;
        }
        property.pooltype = "";
        if(amenities.includes(67)){
            property.pooltype = "Private Pool";
        }
        if(amenities.includes(68)){
            property.pooltype = "Shared Pool";
        }
        return property;
    }

    async propertyDetailsCollections(property,collectionResults){
        var colls = collectionResults.filter(col => col.property_id == property.id);
        var collections = [];
        colls.forEach(collection => {
            collections.push(collection.collection_id);
        });
        property.collections = collections;
        return property;
    }

    async propertyHosts(property,hostResults){
        var colls = hostResults.filter(col => col.property_id == property.id);
        var hosts = [];
        colls.forEach(host => {
            hosts.push(host.host_id);
        });
        property.hosts = hosts;
        return property;
    }

    async propertyDetailsFiles(property,mediaResults,presignedURLs){
        var xFileIds = [4,5,6];
        var xFileMap = {4:'display_image',5:'virtual_tour',6:'meals_menu'};
        var meds = mediaResults.filter(m => m.property_id == property.id && xFileIds.includes(m.media_type_id));
        meds.forEach(med =>{
            var presigned = presignedURLs?.find(psu => psu.fileName == med.media_filename);
            var fName = xFileMap[med.media_type_id];
            property[fName] = presigned?.url;
            if(med?.media_type_id == 4){
                property["display_image_id"] = med.id;
            }
        });
        return property;
    }

    async propertyDetailsPhotos(property,mediaResults,presignedURLs,photoCategories){
        var xFileIds = [4,5,6];
        var meds = mediaResults.filter(m => m.property_id == property.id && !xFileIds.includes(m.media_type_id));
        var flatCats = meds.flatMap(m=>m.display);
        var medCats = ['Pool','Living & Dining Space','Kitchen & Pantry','Bedroom','Bathrooms','Shared Spaces','Garden or Outdoor Areas','Facade & Exterior'];

        medCats = medCats.filter(function(item) {
            return flatCats.indexOf(item) > -1;
        });
        /*medCats = medCats.filter(function(item, pos){
            return medCats.indexOf(item)== pos;
        });*/
        var medias = [];
        meds.forEach(med =>{
            var presigned = presignedURLs?.find(psu => psu.fileName == med.media_filename);
            medias.push({"media_id":med.id,"catgeory_name":med.display,"order":med.display_order,"title":med.title,"description":med.description,"filename":presigned?.url});
        });
        var mediaByCategory = {};
        var mediaByCategoryId = {};
        medCats.forEach(medCat =>{
            mediaByCategory[medCat] = medias.filter(m=> m.catgeory_name == medCat);
            var catIdSetting = photoCategories.find(c => c.display == medCat);
            if(catIdSetting){
                mediaByCategoryId[catIdSetting.id] = medias.filter(m=> m.catgeory_name == medCat);
            }
        });
        property.medias = mediaByCategory;
        property.mediasById = mediaByCategoryId;
        return property;
    }

    async getPresignedURLs(meds){
        const presignedUrlPromises = meds.map(async(object)=>{
            try {
                const url = await this.getPropertyMediaUrl(object.property_id, object.media_filename);
                return { fileName: object.media_filename, url };
            } catch (error) {
                console.log(`Failed to get presigned URL for ${object.media_filename}:`, error.message);
                return { fileName: object.media_filename, url: null };
            }
        });
        try {
            const presignedUrls = await Promise.all(presignedUrlPromises);
            return presignedUrls;
        } catch (error) {
            console.log(error);
            return [];
        }
    }

    async getAmenityImageURLs(amenities){
        const presignedUrlPromises = amenities.map(async(object)=>{
            const urlParams = { Bucket: amenityBucket, Key: object.media_filename, Expires: 3600 };
            const url = await S3Helper.getSignedUrlPromise(urlParams);
            return { fileName: object.media_filename, url };
        });
        try {
            const presignedUrls = await Promise.all(presignedUrlPromises);
            return presignedUrls;
        } catch (error) {
            console.log(error);
        }
    }

    async getDisplayImage(id){
        return this.getMediaURL(id,4);
    }

    async getMediaURL(property_id,media_type_id){
        const result = await pool.query('SELECT * FROM property_media WHERE property_id = ? and media_type_id = ?', [property_id,media_type_id]);
        if (!result[0] || result[0].length === 0) {
            return '';
        }
        const media = result[0][0];
        return await this.getPropertyMediaUrl(media.property_id, media.media_filename);
    }

    async getById(id) {
        const result = await pool.query('SELECT * FROM properties WHERE id = ?', [id]);
        return result[0];
    }

    async getNearbyProperties(propertyId, latitude, longitude, limit = 3) {
        const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 3;
        const sql = `
            SELECT
                p.id,
                p.listing_name,
                p.slug,
                p.city,
                p.state,
                p.country,
                p.google_latitude,
                p.google_longitude,
                pm.media_filename,
                (
                    6371 * ACOS(
                        COS(RADIANS(?)) * COS(RADIANS(p.google_latitude))
                        * COS(RADIANS(p.google_longitude) - RADIANS(?))
                        + SIN(RADIANS(?)) * SIN(RADIANS(p.google_latitude))
                    )
                ) AS distance_km
            FROM properties p
            LEFT JOIN property_media pm
                ON pm.property_id = p.id
                AND pm.media_type_id = 4
            WHERE p.id <> ?
                AND p.google_latitude IS NOT NULL
                AND p.google_longitude IS NOT NULL
            ORDER BY distance_km ASC
            LIMIT ?
        `;

        const result = await pool.query(sql, [latitude, longitude, latitude, propertyId, safeLimit]);
        return result[0];
    }
    
    async getBySlug(slug) {
        const result = await pool.query('SELECT * FROM properties WHERE slug = ?', [slug]);
        return result[0];
    }

    async getByEzeeId(uniqueId){
        try {
            const result = await pool.query('SELECT * FROM properties WHERE channel_id = ?', [uniqueId]);
            return result[0][0];
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    async store(fieldValues) {
        try {
            const result = await pool.query('INSERT INTO properties SET ?', fieldValues);
            return result[0].insertId;
        } catch (error) {
            console.log(error);
            throw error;
        }
    }
  
    async save(fieldValues,id){
        return await pool.query('UPDATE properties SET ? WHERE id = ?',[fieldValues, id]);
    }

    async getMediaById(id){
        const media = await pool.query('select * from property_media where id = ?',[id]);
        return media[0][0];
    }

    async updateMediaById(id,filename){
        return await pool.query('update property_media set media_filename = ? where id = ?',[filename,id]);
    }

    async deleteMediaFile(id){
        await pool.query('delete from property_media where id = ?',[id]);
        return;
    }

    async clearAmenitiesForProperty(propertyId){
        return await pool.query('delete from property_amenities where property_id = ?',[propertyId]);
    }

    async clearCollectionsForProperty(propertyId){
        return await pool.query('delete from property_collections where property_id = ?',[propertyId]);
    }

    async clearHostsForProperty(propertyId){
        return await pool.query('delete from property_hosts where property_id = ?',[propertyId]);
    }

    async deleteProperty(propertyId){
        try {
            console.log(`=== Deleting Property ${propertyId} ===`);
            
            // First delete all related records
            await this.clearAmenitiesForProperty(propertyId);
            console.log(`Amenities cleared for property ${propertyId}`);
            
            await this.clearCollectionsForProperty(propertyId);
            console.log(`Collections cleared for property ${propertyId}`);
            
            await this.clearHostsForProperty(propertyId);
            console.log(`Hosts cleared for property ${propertyId}`);
            
            // Delete all media records for this property in a single query (not a per-row loop)
            await pool.query('DELETE FROM property_media WHERE property_id = ?', [propertyId]);
            
            // Finally delete the main property record
            const result = await pool.query('delete from properties where id = ?', [propertyId]);
            console.log(`Property ${propertyId} deleted successfully`);
            
            return result[0].affectedRows > 0;
        } catch (error) {
            console.log(`Error deleting property ${propertyId}:`, error);
            throw error;
        }
    }

    async nextDisplayOrder(propertyId,categoryId){
        const result = await pool.query('select max(display_order) as max_display from property_media where property_id = ? and media_type_id = ?',[propertyId,categoryId]);
        return result[0][0].max_display + 1;
    }

    async updateMediaOrder(id, order, propertyId = null, categoryId = null){
        console.log(`changing order of ${id} to ${order}`);
        if (propertyId && categoryId) {
            return await pool.query(
                'update property_media set display_order = ? where id = ? and property_id = ? and media_type_id = ?',
                [order, id, propertyId, categoryId]
            );
        }
        return await pool.query('update property_media set display_order = ? where id = ?',[order,id]);
    }

    async update(id, { name, description,photo }) {
        return await pool.query('UPDATE destinations SET name = ?, description = ?, photo = ? WHERE id = ?', [name, description, photo, id]);
    }
  
    async updatePhotoLink(id, photo) {
        return await pool.query('UPDATE destinations SET photo = ? WHERE id = ?', [photo, id]);
    }

    async deleteDestination(id) {
        return await pool.query('DELETE FROM destinations WHERE id = ?', [id]);
    }

    async setPropertyAmenity(values){
        const result = await pool.query('INSERT INTO property_amenities SET ?', values);
        return result[0].insertId;
    }

    async setPropertyCollection(values){
        const result = await pool.query('INSERT INTO property_collections SET ?', values);
        return result[0].insertId;
    }

    async setPropertyHosts(values){
        const result = await pool.query('INSERT INTO property_hosts SET ?', values);
        return result[0].insertId;
    }

    async setPropertyMedia(values){
        const result = await pool.query('INSERT INTO property_media SET ?', values);
        return result[0].insertId;
    }

    async userFavourites(userId){
        const results = await pool.query('select property_id from user_favourites where user_id = ?',[userId]);
        return results[0];
    }

    async favourite(userId,propertyId){
        const deleteRecord = await pool.query('DELETE FROM user_favourites WHERE user_id = ? and property_id', [userId,propertyId]);
        const result = await pool.query('INSERT INTO user_favourites (user_id,property_id) values (?,?)', [userId,propertyId]);
        return result[0].insertId;
    }

    async unFavourite(userId,propertyId){
        return await pool.query('DELETE FROM user_favourites WHERE user_id = ? and property_id', [userId,propertyId]);
    }

    async forBookingInfoDisplay(id){
        const result = await pool.query(
            `SELECT
               p.listing_name            AS property_name,
               p.address_line_1          AS address,
               p.address_line_2,
               p.city,
               p.state,
               p.country,
               p.postcode,
               p.google_latitude,
               p.google_longitude,
               p.places_around,
               p.house_rules,
               p.google_rating,
               p.google_review_count,
               COALESCE(
                 NULLIF(TRIM(p.property_manager_name), ''),
                 NULLIF(TRIM(CONCAT_WS(' ', u.firstname, u.lastname)), '')
               )                         AS property_manager_name,
               COALESCE(
                 NULLIF(TRIM(p.property_manager_phone), ''),
                 NULLIF(TRIM(u.phone), ''),
                 NULLIF(TRIM(u.phone1), '')
               )                         AS property_manager_phone,
               COALESCE(
                 NULLIF(TRIM(p.property_manager_email), ''),
                 NULLIF(TRIM(u.email), '')
               )                         AS property_manager_email,
               p.maintenance_number,
               p.nearby_places,
               u.profile_pic_link        AS property_manager_image
             FROM properties p
             LEFT JOIN users u ON u.id = p.property_manager_user_id
             WHERE p.id = ?`,
            [id]
        );
        var property = result[0][0];
        property.cover_image = await this.getMediaURL(id,4);
        if (property.nearby_places && typeof property.nearby_places === 'string') {
            try { property.nearby_places = JSON.parse(property.nearby_places); } catch(_) { property.nearby_places = []; }
        }
        return property;
    }

    /* Admin panel functions */
    async listing(){
        //const results = await pool.query('select pm.media_filename,p.id,p.channel_id,p.listing_name,p.internal_name,p.slug,p.display_order from properties p,property_media pm where p.id = pm.property_id and pm.media_type_id = 4 order by p.display_order');
        const results = await pool.query('select pm.media_filename,p.* from properties p,property_media pm where p.id = pm.property_id and pm.media_type_id = 4 order by p.display_order');
        return results[0];
    }

    async getMaxDisplayOrder(){
        const results = await pool.query('select max(display_order) as maxOrder from properties');
        return results[0][0].maxOrder + 1;
    }

    async propertiesList(){
        try{
            const results = await pool.query("select id,channel_id, listing_name,internal_name from properties");
            return results[0];
        }catch(error){
            console.log(error);
            throw error;
        }
    }

    async aminitiesByProperty(propertyId){
        try{
            const results = await pool.query("select * from amenities where id in (select amenity_id from property_amenities where property_id = ?)",[propertyId]);
            return results[0];
        }catch(error){
            console.log(error);
            throw error;
        }
    }

    async propertiesByHost(hostId){
        try{
            const results = await pool.query("select p.id,p.listing_name,p.internal_name,p.slug,p.number_of_bedrooms,p.number_of_bathrooms,p.number_of_guests,p.number_of_extra_guests,p.google_latitude,p.google_longitude,p.address_line_1,p.address_line_2,p.city,p.state,p.country,pm.media_filename from properties p, property_media pm where p.id in (select property_id from property_hosts where host_id = ?) and p.id = pm.property_id and pm.media_type_id = 4",[hostId]);
            
            // Calculate current financial year start date (April 1st of current year or previous year)
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11, so add 1
            
            let financialYearStart;
            if (currentMonth >= 4) {
                // If current month is April or later, financial year started this year
                financialYearStart = `${currentYear}-04-01`;
            } else {
                // If current month is before April, financial year started last year
                financialYearStart = `${currentYear - 1}-04-01`;
            }
            
            // Filter for current financial year only
            const gbvs = await pool.query("SELECT count(bt.id) as count,sum(bt.totalAmountBeforeTax) as gbv,sum(bt.taCommision) as taCommision,p.id as property FROM booking_tariffs bt,bookings b, properties p, property_hosts ph where bt.booking_id = b.id and b.property_id = p.id and b.currentStatus not in ('Void','Cancel') and p.id = ph.property_id and ph.host_id = ? and b.end >= ? group by property",[hostId, financialYearStart]);
            const nights = await pool.query("SELECT count(br.id) as nights,p.id as property FROM booking_rentalInfo br,bookings b, properties p, property_hosts ph where br.booking_id = b.id and b.property_id = p.id and b.currentStatus not in ('Void','Cancel') and p.id = ph.property_id and ph.host_id = ? and b.end >= ? group by property",[hostId, financialYearStart]);
            return {properties:results[0],gbvs:gbvs[0],nights:nights[0]};
        }catch(error){
            console.log(error);
            throw error;
        }
    }

    async propertyPerformance(propertyId,start,end){
        try{
            const performance = await pool.query("SELECT count(bt.id) as count, sum(totalAmountAfterTax) as totalAmountAfterTax, sum(totalAmountBeforeTax) as totalAmountBeforeTax, sum(totalTax) as totalTax, sum(taCommision) as taCommision FROM bookings b, booking_tariffs bt where b.property_id = ? and b.end >= ? and b.end <= ? and b.id = bt.booking_id",[propertyId,start,end]);
            const serviceRequests = await pool.query("SELECT count(id) as count, sum(amount) as amount FROM `service_requests` where property_id = ? and created_at >= ? and created_at <= ?",[propertyId,start,end]);
            const nights = await pool.query("SELECT count(*) as count FROM booking_rentalInfo where booking_id in (select id from bookings where property_id = ? and end >= ? and end <= ?)",[propertyId,start,end]);
            return {performance:performance[0][0],serviceRequests:serviceRequests[0][0],nights:nights[0][0]};
        }catch(error){
            console.log(error);
            throw error;
        }
    }

    async earningsByMonth(propertyId,start,end){
        try{
            // Use same logic as propertiesByHost: include bookings that ended during the financial year
            // Also use same calculation: gbv - taCommision (net booking value)
            const earnings = await pool.query("SELECT count(bt.id) as count, sum(bt.totalAmountBeforeTax - bt.taCommision) amount,DATE_FORMAT(b.end,'%m-%Y') as date FROM booking_tariffs bt, bookings b where b.property_id = ? and b.end >= ? and b.currentStatus not in ('Void','Cancel') and b.id = bt.booking_id group by date",[propertyId,start]);
            const nights = await pool.query("select count(id) as count,DATE_FORMAT(effectiveDate,'%m-%Y') as date from booking_rentalInfo where booking_id in (select id from bookings where property_id = ? and end >= ? and currentStatus not in ('Void','Cancel')) and effectiveDate >= ? group by date",[propertyId,start,start]); 
            
            console.log(`Earnings data for property ${propertyId}:`, earnings[0]);
            console.log(`Nights data for property ${propertyId}:`, nights[0]);
            
            return {earnings:earnings[0],nights:nights[0]};
        }catch(error){
            console.log(error);
            throw error;
        }
    }

    // New method for stacked earnings data by month with proper owner earnings calculation
    async stackedEarningsByMonth(propertyId, start, end) {
        try {
            // Get checkout earnings (completed bookings) with proper owner earnings calculation
            const checkoutEarnings = await pool.query(`
                SELECT 
                    DATE_FORMAT(b.end, '%d') as day,
                    SUM(bt.totalAmountBeforeTax + bt.totalTax - bt.taCommision) as amount,
                    COUNT(bt.id) as count,
                    'checkedOut' as status,
                    SUM(bt.totalAmountBeforeTax + bt.totalTax) as totalCharges,
                    SUM(bt.taCommision) as totalCommission,
                    SUM(bt.totalTax) as totalGST
                FROM booking_tariffs bt 
                JOIN bookings b ON b.id = bt.booking_id 
                WHERE b.property_id = ? 
                AND b.end BETWEEN ? AND ? 
                AND b.currentStatus NOT IN ('Void', 'Cancel', 'Block')
                GROUP BY DATE_FORMAT(b.end, '%d')
            `, [propertyId, start, end]);

            // Get currently hosting earnings (ongoing bookings) with proper owner earnings calculation
            // These are bookings that started before the month and ended after the month (ongoing during the month)
            const currentlyHostingEarnings = await pool.query(`
                SELECT 
                    DATE_FORMAT(?, '%d') as day,
                    SUM(bt.totalAmountBeforeTax + bt.totalTax - bt.taCommision) as amount,
                    COUNT(bt.id) as count,
                    'currentlyHosting' as status,
                    SUM(bt.totalAmountBeforeTax + bt.totalTax) as totalCharges,
                    SUM(bt.taCommision) as totalCommission,
                    SUM(bt.totalTax) as totalGST
                FROM booking_tariffs bt 
                JOIN bookings b ON b.id = bt.booking_id 
                WHERE b.property_id = ? 
                AND b.start < ? 
                AND b.end > ?
                AND b.currentStatus NOT IN ('Void', 'Cancel', 'Block')
            `, [start, propertyId, start, end]);

            // Get checking in earnings (upcoming bookings starting in this month) with proper owner earnings calculation
            // Only include upcoming bookings if the selected month is current or future
            const currentDate = new Date();
            const selectedDate = new Date(start);
            const isCurrentOrFutureMonth = selectedDate >= new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            
            let checkingInEarnings = { 0: [] }; // Default empty result
            
            if (isCurrentOrFutureMonth) {
                checkingInEarnings = await pool.query(`
                    SELECT 
                        DATE_FORMAT(b.start, '%d') as day,
                        SUM(bt.totalAmountBeforeTax + bt.totalTax - bt.taCommision) as amount,
                        COUNT(bt.id) as count,
                        'checkingIn' as status,
                        SUM(bt.totalAmountBeforeTax + bt.totalTax) as totalCharges,
                        SUM(bt.taCommision) as totalCommission,
                        SUM(bt.totalTax) as totalGST
                    FROM booking_tariffs bt 
                    JOIN bookings b ON b.id = bt.booking_id 
                    WHERE b.property_id = ? 
                    AND b.start BETWEEN ? AND ? 
                    AND b.currentStatus NOT IN ('Void', 'Cancel', 'Block')
                    GROUP BY DATE_FORMAT(b.start, '%d')
                `, [propertyId, start, end]);
            }

            return {
                checkout: checkoutEarnings[0],
                currentlyHosting: currentlyHostingEarnings[0],
                checkingIn: checkingInEarnings[0]
            };
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    // New method to get detailed booking information for owners app (similar to admin panel)
    async getDetailedBookingsForMonth(propertyId, start, end) {
        try {
            const bookings = await pool.query(`
                SELECT 
                    b.id,
                    b.uniqueId,
                    CONCAT(b.firstname, ' ', b.lastname) as guestName,
                    DATE_FORMAT(b.start, '%d %b %y') as checkInDate,
                    DATE_FORMAT(b.end, '%d %b %y') as checkOutDate,
                    b.nights,
                    b.currentStatus,
                    b.listing_name as propertyName,
                    bt.totalAmountBeforeTax / b.nights as price_per_night,
                    bt.totalAmountBeforeTax + bt.totalTax as totalCharges,
                    bt.totalAmountBeforeTax,
                    bt.totalTax as gstAmount,
                    bt.taCommision as otaCommission,
                    bt.totalAmountBeforeTax + bt.totalTax - bt.taCommision as ownerEarnings,
                    b.source,
                    CASE 
                        WHEN (bt.totalAmountBeforeTax / b.nights) <= 7500 THEN '5%'
                        ELSE '18%'
                    END as gstRate,
                    b.start,
                    b.end,
                    CASE 
                        WHEN b.end BETWEEN ? AND ? THEN 'checkedOut'
                        WHEN b.start < ? AND b.end > ? THEN 'currentlyHosting'
                        WHEN b.start BETWEEN ? AND ? THEN 'checkingIn'
                        ELSE 'other'
                    END as bookingStatus
                FROM bookings b
                JOIN booking_tariffs bt ON b.id = bt.booking_id
                WHERE b.property_id = ? 
                AND (
                    (b.end BETWEEN ? AND ?) OR 
                    (b.start BETWEEN ? AND ?) OR
                    (b.start < ? AND b.end > ?)
                )
                AND b.currentStatus NOT IN ('Void', 'Cancel', 'Block')
                ORDER BY b.start DESC
            `, [start, end, start, end, start, end, propertyId, start, end, start, end, start, end]);
            
            return bookings[0];
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    async calendar(propertyId,start,end){
        try{
            //const bookings1 = await pool.query("SELECT booking_id,effectiveDate,adult as adults, child as children, rentPreTax as value FROM booking_rentalInfo where booking_id in (select id from bookings where property_id = ?) and effectiveDate >= ? and effectiveDate <= ?",[propertyId,start,end]);
            //const blocks = await pool.query("SELECT id,start,end,status FROM bookings where property_id = ? and currentStatus = 'Block' and (DATE(start) BETWEEN ? AND ? OR DATE(end) BETWEEN ? AND ?)",[propertyId,start,end,start,end]);
            const bookings = await pool.query("SELECT id,start,end,currentStatus,status FROM bookings where property_id = ? and currentStatus not in ('Void','Cancel') and (DATE(start) BETWEEN ? AND ? OR DATE(end) BETWEEN ? AND ?)",[propertyId,start,end,start,end]);
            return bookings[0];
        }catch(error){
            console.log(error);
            throw error;
        }
    }

    async otaLinks(propertyId){
        try{
            const links = await pool.query("SELECT p.property_id,s.display as channel,p.link FROM property_listings p, settings s where p.property_id = ? and p.ota_id = s.id;",[propertyId]);
            return links[0];
        }catch(error){
            console.log(error);
            throw error;
        }
    }

    async referAProperty(values){
        const result = await pool.query('INSERT INTO property_referrals SET ?', values);
        return result[0].insertId;
    }

    async getPropertyEarnings(propertyId) {
        try {
            const earnings = await pool.query(`
                SELECT 
                    DATE_FORMAT(b.start, '%Y-%m') as month,
                    SUM(bt.totalAmountBeforeTax) as amount,
                    COUNT(b.id) as count
                FROM booking_tariffs bt 
                JOIN bookings b ON b.id = bt.booking_id 
                WHERE b.property_id = ? 
                AND b.currentStatus NOT IN ('Void', 'Cancel', 'Block')
                GROUP BY DATE_FORMAT(b.start, '%Y-%m')
                ORDER BY month DESC
                LIMIT 12
            `, [propertyId]);
            return earnings[0];
        } catch (error) {
            console.log(error);
            return [];
        }
    }

    async getPropertyMedia(propertyId) {
        try {
            const media = await pool.query(`
                SELECT 
                    pm.*,
                    s.display as media_type_name
                FROM property_media pm 
                JOIN settings s ON pm.media_type_id = s.id 
                WHERE pm.property_id = ? 
                ORDER BY pm.display_order
            `, [propertyId]);
            return media[0];
        } catch (error) {
            console.log(error);
            return [];
        }
    }

    async checkPropertyAccess(propertyId, userId) {
        try {
            const result = await pool.query(`
                SELECT COUNT(*) as count
                FROM property_hosts
                WHERE property_id = ? AND host_id = ?
            `, [propertyId, userId]);

            return result[0][0].count > 0;
        } catch (error) {
            console.log(error);
            return false;
        }
    }

    /** ===== PROPERTY MANAGER METHODS ===== */

    /**
     * Returns all properties where the given user is assigned as any manager role.
     */
    async propertiesForManager(managerId) {
        try {
            const [rows] = await pool.query(`
                SELECT p.id, p.listing_name, p.internal_name, p.address_line_1, p.address_line_2,
                       p.city, p.state, p.country, p.number_of_bedrooms, p.number_of_bathrooms,
                       pm.media_filename AS cover_image,
                       p.reservation_executive, p.hospitality_manager, p.revenue_manager, p.general_manager,
                       p.property_manager_user_id, p.property_manager_name, p.property_manager_phone, p.property_manager_email
                FROM properties p
                LEFT JOIN property_media pm ON pm.property_id = p.id AND pm.media_type_id = 4
                WHERE p.reservation_executive = ? OR p.hospitality_manager = ? OR
                      p.revenue_manager = ? OR p.general_manager = ? OR p.property_manager_user_id = ?
                ORDER BY p.listing_name
            `, [managerId, managerId, managerId, managerId, managerId]);
            return rows;
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    /**
     * Assigns a manager user to a property.
     * managerType: 'reservation_executive' | 'hospitality_manager' | 'revenue_manager' | 'general_manager' | 'property_manager_user_id'
     */
    async assignManager(propertyId, managerId, managerType = 'property_manager_user_id') {
        const allowedTypes = ['reservation_executive','hospitality_manager','revenue_manager','general_manager','property_manager_user_id'];
        if (!allowedTypes.includes(managerType)) throw new Error('Invalid manager type');
        try {
            await pool.query(`UPDATE properties SET ${managerType} = ? WHERE id = ?`, [managerId, propertyId]);
            return true;
        } catch (error) {
            console.log(error);
            throw error;
        }
    }
}
module.exports = Property;
