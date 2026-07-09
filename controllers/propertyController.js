'use strict';
const Response = require("../helpers/responseHelper");
const S3Helper = require('../helpers/s3Helper');
const property = require("../models/propertyModel");
const Property = new property;
const setting = require("../models/settingModel");
const Setting = new setting;
const settingHelper = require("../helpers/settingsHelper");
const SettingsHelper = new settingHelper();
const fields = require('../config/configs');
const {propertyFields} = fields;
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
const path = require('path');
const xFiles = ['display_image','meals_menu','virtual_tour'];
const ImageHelper = require('../helpers/imageHelper');
const smModel = require("../models/smModel");
const SMModel = new smModel;
const host = require('../models/hostModel');
const Host = new host;
const utility = require("../helpers/utility");
const Utility = new utility;

const { format,startOfMonth,endOfMonth,subMonths,addMonths,eachDayOfInterval } = require("date-fns");
const ezeeHelper = require('../helpers/ezeeHelper');
const EzeeHelper = new ezeeHelper;

class PropertyController{
    async optimizeImageToWebp(buffer, options = {}) {
        return ImageHelper.optimizeToWebp(buffer, options);
    }

    getPropertyImageKey(propertyId, mediaFilename) {
        const filePath = `${propertyId}/${mediaFilename}`;
        return [propertyBucketPrefix, filePath].filter(Boolean).join('/');
    }

    getPropertyCdnKey(propertyId, mediaFilename) {
        const filePath = `${propertyId}/${mediaFilename}`;
        return [propertyCdnPrefix, filePath].filter(Boolean).join('/');
    }

    async getPropertyImageUrl(propertyId, mediaFilename) {
        if (!mediaFilename) return '';
        if (hasUsableCdnBaseUrl) {
            return buildCdnUrl(this.getPropertyCdnKey(propertyId, mediaFilename));
        }
        const key = this.getPropertyImageKey(propertyId, mediaFilename);
        const urlParams = {
            Bucket: propertyBucketName || propertyBucketRaw,
            Key: key,
            Expires: 3600
        };
        return S3Helper.getSignedUrlPromise(urlParams);
    }

    /*constructor(ezeeHelper){
        this.ezeeHelper = ezeeHelper;
    }*/

    /*async temp(req,res){
        const propertyId = 2;
        const mapping = {Bedroom:271,Bathrooms:7,LivingAndDining:8,KitchenAndPantry:9,Pool:10,GardenOrOutdoorAreas:11,	SharedSpaces:12,FascadeAndExterior:13};		
        const values = {Bedroom:15,Bathrooms:5,LivingAndDining:10,KitchenAndPantry:2,Pool:6,GardenOrOutdoorAreas:1,	SharedSpaces:3,FascadeAndExterior:1};
        var imgCategories = Object.keys(values);
        imgCategories.forEach(cat => {
            for(var i=1; i <= values[cat]; i++){
                var str = propertyId+"_"+mapping[cat]+"_file"+i+".jpg";
                var query = "insert into property_media (property_id, media_type_id, display_order, title, media_filename, description) values ("+propertyId+","+mapping[cat]+","+i+",'Title "+i+"','"+str+"','Description "+i+"');";
                console.log(query);
            }
        })
        return Response.success(res, "", 200);
    }*/

    async propertySettings(req, res){
        try{
            const result = await SettingsHelper.consolidatedSettings();
            return Response.success(res, result, 200);
        }catch(err){
            return Response.error(res, "ERROR", "Settings not found", 400);
        }
    }

    async propertySettingsWithUsers(req, res){
        try{
            const result = await SettingsHelper.consolidatedSettingsWithUsers();
            return Response.success(res, result, 200);
        }catch(err){
            return Response.error(res, "ERROR", err, 400);
        }
    }

    async add(req, res){
        const results = await SettingsHelper.consolidatedSettingsWithUsers();
        res.render('propertyAdd.ejs', { results });
    }

    async edit(req, res){
        console.log(req.params);
        const { id } = req.params;
        const settings = await SettingsHelper.consolidatedSettingsWithUsers();
        const property = await Property.listPropertiesDetails({id:id});
        res.render('propertyEdit.ejs', { results:settings,property:property[0] });
    }

    async newListing(req,res){
        await res.render('list.ejs');
    }

    async otaListing(req,res){
        const { id } = req.params;
        const property = await Property.find('properties',id);
        await res.render('propertyListings.ejs',{property});
    }

    async listing(req,res){
        const settings = await SettingsHelper.consolidatedSettingsWithUsers();
        const results = await Property.listing();
        const properties = await Promise.all(results.map(async (object) => {
            if (!object.display_image) {
                try {
                    object.display_image = await this.getPropertyImageUrl(object.id, object.media_filename);
                } catch (error) {
                    console.log(`Failed image URL generation for property ${object.id}:`, error.message);
                    object.display_image = '';
                }
            }
            return object;
        }));
        const property_types = settings.property_types;
        const hosts = settings.hosts;
        const propertyHosts = await SMModel.getFromTable('property_hosts');
        properties.map(p =>{
            const property_type = property_types.find(pt => pt.id == p.property_type);
            p.property_type = property_type.display;
            const propHosts = propertyHosts.filter(ph => ph.property_id == p.id).map(phmap => phmap.host_id);
            const pHosts = hosts.filter(h => propHosts.includes(h.id));
            p.hosts = pHosts.map(host => `${host.name}`).join('<br>');
            p.guests = `Guests: ${p.number_of_guests}<br> Extra: ${p.number_of_extra_guests}`;
            return p;
        });
        const frontendBaseUrl = (process.env.FRONTEND_URL || 'https://thestaymaster.com').replace(/\/$/, '');
        await res.render('properties.ejs', { properties, frontendBaseUrl });
    }

    async replaceDisplayImage(req,res){
        try {
            const {photoId} = req.body;
            const propertyId = req.body.id;
            const { files } = req;

            if (!files || files.length === 0) {
                return Response.error(res, "ERROR", "No files uploaded", 400);
            }

            let displayImageId = photoId;
            // If displayImageId is not valid/missing, search database for existing display image record (media_type_id = 4)
            if (!displayImageId || displayImageId === 'undefined' || displayImageId === 'null' || displayImageId === '') {
                if (!propertyId) {
                    return Response.error(res, "ERROR", "Property ID or Photo ID is required to replace display image", 400);
                }
                const existingMedia = await Property.find('property_media', { property_id: propertyId, media_type_id: 4 });
                if (existingMedia) {
                    displayImageId = existingMedia.id;
                }
            }

            let media;
            if (displayImageId && displayImageId !== 'undefined' && displayImageId !== 'null' && displayImageId !== '') {
                media = await Property.getMediaById(displayImageId);
            }

            const { buffer, ext, contentType } = await ImageHelper.processUpload(files[0]);
            const finalPropertyId = media ? media.property_id : propertyId;

            // Generate unique filename to bypass CDN/browser caches (cache busting)
            const webpFilename = `${finalPropertyId}_display_image_${Date.now()}${ext}`;

            if (media) {
                const media_filename = media.media_filename;
                if (media_filename) {
                    try {
                        await S3Helper.deleteFile(bucket, finalPropertyId + "/" + media_filename);
                    } catch (s3DelErr) {
                        console.log("Failed to delete old display image from S3:", s3DelErr.message);
                    }
                }
                await Property.updateMediaById(displayImageId, webpFilename);
            } else {
                // Create a new record in property_media table
                const value = this.fileRecord(finalPropertyId, 4, 1, 'Display Picture', 'Display Picture', webpFilename);
                displayImageId = await Property.setPropertyMedia(value);
            }

            await S3Helper.uploadFile(bucket, finalPropertyId + "/" + webpFilename, buffer, {
                ContentType: contentType
            });

            return Response.success(res, { replaced: displayImageId }, 200);
        } catch (error) {
            console.log("Error in replaceDisplayImage:", error);
            return Response.error(res, "ERROR", error.message || error, 500);
        }
    }


    async deleteImage(req,res){
        const {id} = req.body;
        console.log("Image id is: " + id);
        var media = await Property.getMediaById(id);
        //console.log(media);
        await S3Helper.deleteFile(bucket, media.property_id+"/"+media.media_filename);
        await Property.deleteMediaFile(id);
        return Response.success(res, { deleted: id }, 200);
    }

    async deleteProperty(req,res){
        try {
            const {propertyId} = req.body;
            console.log("=== Delete Property Request ===");
            console.log("Property ID to delete:", propertyId);
            
            if (!propertyId) {
                console.log("No property ID provided");
                return Response.error(res, "ERROR", 'Property ID is required', 400);
            }
            
            // Check if property exists
            const property = await Property.getById(propertyId);
            if (!property) {
                console.log(`Property ${propertyId} not found`);
                return Response.error(res, "ERROR", 'Property not found', 404);
            }
            
            console.log(`Property ${propertyId} found, proceeding with deletion`);
            
            // Delete the property and all related records
            const deleted = await Property.deleteProperty(propertyId);
            
            if (deleted) {
                console.log(`Property ${propertyId} deleted successfully`);
                return Response.success(res, { 
                    message: 'Property deleted successfully',
                    propertyId: propertyId 
                }, 200);
            } else {
                console.log(`Property ${propertyId} deletion failed`);
                return Response.error(res, "ERROR", 'Failed to delete property', 500);
            }
            
        } catch (error) {
            console.log("Error in deleteProperty:", error);
            console.log("Error stack:", error.stack);
            return Response.error(res, "ERROR", error.message || 'Internal server error', 500);
        }
    }

    async uploadImage(req,res){
        const { files } = req;
        const {propertyId,categoryId} = req.body;
        var order = await Property.nextDisplayOrder(propertyId,categoryId);
        const { buffer, ext, contentType } = await ImageHelper.processUpload(files[0]);
        var filename = `${propertyId}_${categoryId}_file${order}${ext}`;
        var value = this.fileRecord(propertyId,categoryId,order,'','',filename);
        console.log(value);
        var newId = await Property.setPropertyMedia(value);
        await S3Helper.uploadFile(bucket, propertyId+"/"+filename, buffer, {
            ContentType: contentType
        });
        return Response.success(res, { newId: newId }, 200);
    }

    async check(req, res){
        try{
            const fileGroups = [
                { bucket: 'staymaster', prefix: 'prop/' },
                { bucket: 'staymaster', prefix: 'prop2/' },
            ];
            // Array to store pre-signed URLs for all files
            const allPresignedUrls = [];

            // Iterate over fileGroups to generate pre-signed URLs
            for (const group of fileGroups) {
                // List all objects under the prefix
                const listParams = {
                    Bucket: group.bucket,
                    Prefix: group.prefix,
                };

                const data = await S3Helper.listFiles(group.bucket,group.prefix);

                // Generate pre-signed URLs for each listed object
                const presignedUrls = await Promise.all(data.Contents.map(async (object) => {
                    const urlParams = { Bucket: group.bucket, Key: object.Key, Expires: 3600 };
                    const url = await S3Helper.getSignedUrlPromise(urlParams);
                    return { fileName: object.Key.replace(group.prefix, ''), url }; // Remove prefix from file name
                }));

                allPresignedUrls.push(...presignedUrls); // Add pre-signed URLs to the array
            }
            for(const pres of allPresignedUrls){
                console.log(pres['fileName'],": ",pres['url']);
            }
            res.render('form1', { allPresignedUrls });
        }catch(error){
            console.error(error);
            res.status(500).send('Internal Server Error');
        }
    }
    
    async list(req,res){
        try{
            const results = await Property.listPropertiesDetails();
            return Response.success(res, results, 200);
        }catch(err){
            return Response.error(res, "ERROR", err, 500);
        }
    }

    async basicList(req,res){
        try{
            const results = await Property.propertiesList();
            return results;
        }catch(err){
            console.log(err);
            return Response.error(res, "ERROR", err, 500);
        }
    }

    async paginatedFilteredProperties(req, res){
        try{
            const allowedKeys = ['for_events', 'for_corporate_offsite'];
            const key = req.body?.key || req.query?.key;

            if(!key || !allowedKeys.includes(key)){
                return Response.error(res, "ERROR", "Invalid key. Allowed keys: for_events, for_corporate_offsite", 400);
            }

            const page = Math.max(parseInt(req.body?.page || req.query?.page || '1', 10), 1);
            const limit = Math.min(Math.max(parseInt(req.body?.limit || req.query?.limit || '10', 10), 1), 100);
            const offset = (page - 1) * limit;

            const filters = {
                filterKey: key,
                filterValue: 1,
                limit,
                offset
            };

            const [total, properties] = await Promise.all([
                Property.getCount(filters),
                Property.listPropertiesDetails(filters)
            ]);

            const totalPages = Math.ceil(total / limit);
            const mappedProperties = properties.map((item) => ({
                id: item.id,
                title: item.listing_name,
                slug: item.slug,
                rating: item.rating,
                image: item.display_image || null,
                description: item.description_summary || "",
                location_name: item.location_name || item.city || null,
                bedrooms: item.bedrooms ?? item.number_of_bedrooms ?? 0,
                bathrooms: item.bathrooms ?? item.number_of_bathrooms ?? 0,
                max_capacity: item.max_capacity ?? item.number_of_guests ?? 0,
                pool: item.pool,
                petCare: item.is_pet_friendly,
                amenities: (item.amenitiesWithDescriptions || []).map((amenity) => ({
                    id: amenity.amenity_id,
                    name: amenity.name,
                    category_id: amenity.category,
                    category_name: amenity.category_name,
                    icon: amenity.icon,
                    description: amenity.description || "",
                })),
            }));

            return Response.success(res, {
                key,
                properties: mappedProperties,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                }
            }, 200);
        }catch(err){
            console.log(err);
            return Response.error(res, "ERROR", err.message || err, 500);
        }
    }

    async create(req,res){
        /* Step 1: Validate */
        /* Step 1.1: Validate if there is at least one file */
        const { files } = req;/* Get all files from request */
        
        // Debug logging
        console.log("=== Property Creation Debug ===");
        console.log("Request method:", req.method);
        console.log("Files received:", files ? files.length : 0);
        console.log("Body fields:", Object.keys(req.body));
        console.log("================================");
        
        /* Error if no files */
        if (!files || files.length === 0) {
            return Response.error(res, "ERROR", 'No files uploaded', 400);
        }

        /* Step 1.2: Validate Cover photo */
        const displayImageFile = files.find(file => file.fieldname === 'display_image');
        if (!displayImageFile) {
            return Response.error(res, "ERROR", 'Display picture file not found', 400);
        }
        
        // Validate file type
        if (!displayImageFile.mimetype || !displayImageFile.mimetype.startsWith('image/')) {
            return Response.error(res, "ERROR", 'Display picture must be an image file', 400);
        }

        /* Step 1.3: Validate Menu file if meals available */
        const {meals_available} = req.body;
        const menuFile = files.find(file => file.fieldname === 'meals_menu');
        
        // If meals are available, require menu file
        if(meals_available === '1' && !menuFile) {
            return Response.error(res, "ERROR", 'Menu file is required when meals are available', 400);
        }

        const virtualTourFile = files.find(file => file.fieldname === 'virtual_tour');
        const {hosts} = req.body;
        
        // Better validation for hosts field
        if(!hosts || hosts === 'null' || hosts === '' || (Array.isArray(hosts) && hosts.length === 0)){
            console.log("Hosts validation failed. Received:", hosts, "Type:", typeof hosts);
            return Response.error(res, "ERROR", 'Host not selected', 400);
        }
        
        // Additional validation for hosts array
        if(Array.isArray(hosts) && hosts.some(host => !host || host === 'null' || host === '')){
            console.log("Invalid host in array:", hosts);
            return Response.error(res, "ERROR", 'Invalid host selection', 400);
        }
        
        // Log the final hosts value that will be used
        console.log("Final hosts value for processing:", hosts);

        var property_id;
        try {
            const fieldValues = {};
            const checkboxFields = ['featured_property', 'for_events', 'for_corporate_offsite'];
            propertyFields.forEach(fieldName => {
                if (checkboxFields.includes(fieldName)) {
                    const rawValue = req.body[fieldName];
                    fieldValues[fieldName] = (rawValue === 'on' || rawValue === '1' || rawValue === 1 || rawValue === true) ? 1 : 0;
                    return;
                }
                if(Object.hasOwnProperty.bind(req.body)(fieldName)){
                    fieldValues[fieldName] = req.body[fieldName];
                }
            });
            console.log("Field values prepared:", Object.keys(fieldValues));
            property_id = await Property.store(fieldValues);
            console.log("Property stored with ID:", property_id);
            
            /* Save amenities for the property - Handle case when no amenities selected */
            const {amenities} = req.body;
            if(amenities && Array.isArray(amenities) && amenities.length > 0){
                console.log(`Processing ${amenities.length} amenities`);
                for (const amenity of amenities) {
                    try {
                        const desc = amenity+"_description";
                        const values = {};
                        values['property_id'] = property_id;
                        values['amenity_id'] = amenity;
                        values['amenity_description'] = req.body[desc] || '';
                        await Property.setPropertyAmenity(values);
                        console.log(`Amenity ${amenity} saved successfully`);
                    } catch (amenityError) {
                        console.error('[Property] Non-critical save error:', { error: amenityError?.message || String(amenityError) });
                        // Continue with other amenities
                    }
                }
            } else {
                console.log("No amenities selected or amenities is not an array");
            }
            
            /* Save collections for the property */
            const {property_collections} = req.body;
            if(property_collections){
                var props = property_collections;
                if(!Array.isArray(property_collections)){
                    props = [property_collections];
                }
                console.log(`Processing ${props.length} collections`);
                for (const collection of props) {
                    try {
                        const values = {};
                        values['property_id'] = property_id;
                        values['collection_id'] = collection;
                        await Property.setPropertyCollection(values);
                        console.log(`Collection ${collection} saved successfully`);
                    } catch (collectionError) {
                        console.error('[Property] Non-critical save error:', { error: collectionError?.message || String(collectionError) });
                        // Continue with other collections
                    }
                }
            } else {
                console.log("No collections selected");
            }
            
            /* Save hosts for the property */
            if(hosts){
                var propHosts = hosts;
                if(!Array.isArray(hosts)){
                    propHosts = [hosts];
                }
                console.log(`Processing ${propHosts.length} hosts`);
                for (const host of propHosts) {
                    try {
                        const values = {};
                        values['property_id'] = property_id;
                        values['host_id'] = host;
                        await Property.setPropertyHosts(values);
                        console.log(`Host ${host} saved successfully`);
                    } catch (hostError) {
                        console.error('[Property] Non-critical save error:', { error: hostError?.message || String(hostError) });
                        // Continue with other hosts
                    }
                }
            } else {
                console.log("No hosts to process");
            }
        } catch (error) {
            console.log("Error in property creation:", error);
            console.log("Error stack:", error.stack);
            return Response.error(res, "ERROR", error.message || error, 400);
        }

        try {
            await this.savePropertyMedia(property_id,req);
        } catch (mediaError) {
            console.error('[Property] Non-critical save error:', { error: mediaError?.message || String(mediaError) });
            // Don't fail the entire request if media save fails
        }

        console.log(`Property ${property_id} created successfully`);
        return Response.success(res, { property_id: property_id }, 200);
    }

    async savePropertyMedia(property_id,req){
        try {
            const { files } = req;
            var settings;
            try {
                settings = await Setting.getSettings('media_type');
                console.log(`Retrieved ${settings.length} media type settings`);
            } catch (settingsError) {
                console.error('[Property] Non-critical save error:', { error: settingsError?.message || String(settingsError) });
                // Continue with empty settings
                settings = [];
            }
            const values = [];
            const S3Files = [];
            
            // Handle xFiles (display_image, meals_menu, virtual_tour)
            if (settings && settings.length > 0) {
                for (const xFile of xFiles) {
                    var fileSetting = settings.find(set => set.value == xFile);
                    var theFile = files.find(file => file.fieldname == xFile);
                    if(theFile && fileSetting){
                        try {
                            const isDisplayImage = xFile === 'display_image';
                            const { buffer, ext, contentType } = await ImageHelper.processUpload(theFile);
                            var media_filename = isDisplayImage
                                ? `${property_id}_${fileSetting.value}${ext}`
                                : `${property_id}_${fileSetting.value}${ext}`;
                            values.push(this.fileRecord(property_id,fileSetting.id,1,fileSetting.display,fileSetting.description,media_filename));
                            var S3File = {};
                            S3File['media_filename'] = media_filename;
                            S3File['buffer'] = buffer;
                            S3File['contentType'] = contentType;
                            S3Files.push(S3File);
                            console.log(`Successfully processed ${xFile} file`);
                        } catch (fileError) {
                            console.error('[Property] Non-critical save error:', { error: fileError?.message || String(fileError) });
                            // Continue with other files
                        }
                    } else if(theFile && !fileSetting) {
                        console.log(`File ${xFile} found but no setting found for it`);
                    }
                }
            } else {
                console.log("No media type settings available for xFiles processing");
            }

            // Handle other photo files
            try {
                settings = await Setting.getSettings('media_type','photos');
                console.log(`Retrieved ${settings.length} photo settings`);
            } catch (photoSettingsError) {
                console.error('[Property] Non-critical save error:', { error: photoSettingsError?.message || String(photoSettingsError) });
                settings = [];
            }
            
            if (settings && settings.length > 0) {
                for (const setting of settings) {
                    var other_files = req.files.filter(file => file.fieldname == 'photos_'+setting.id);
                    console.log(`Found ${other_files.length} files for category ${setting.id}`);
                    for (let index = 0; index < other_files.length; index++) {
                        try {
                            const theFile = other_files[index];
                            var order = index + 1;
                            const { buffer, ext, contentType } = await ImageHelper.processUpload(theFile);
                            var media_filename = `${property_id}_${setting.id}_file${order}${ext}`;
                            values.push(this.fileRecord(property_id,setting.id,order,'','',media_filename));
                            var S3File = {};
                            S3File['media_filename'] = media_filename;
                            S3File['buffer'] = buffer;
                            S3File['contentType'] = contentType;
                            S3Files.push(S3File);
                            console.log(`Successfully processed photo ${order} for category ${setting.id}`);
                        } catch (photoError) {
                            console.error('[Property] Non-critical save error:', { error: photoError?.message || String(photoError) });
                            // Continue with other photos
                        }
                    }
                }
            } else {
                console.log("No photo settings available or error occurred");
            }
            
            // Save media records to database
            for (const value of values) {
                try {
                    await Property.setPropertyMedia(value);
                    console.log(`Successfully saved media record for ${value.media_filename}`);
                } catch (dbError) {
                    console.error('[Property] Non-critical save error:', { error: dbError?.message || String(dbError) });
                    // Don't fail the entire request for database issues
                }
            }
            
            // Upload files to S3
            for (const file of S3Files) {
                try {
                    await S3Helper.uploadFile(bucket, property_id+"/"+file['media_filename'], file['buffer'], {
                        ContentType: file['contentType']
                    });
                    console.log(`Successfully uploaded ${file['media_filename']} to S3`);
                } catch (s3Error) {
                    console.error('[Property] Non-critical save error:', { error: s3Error?.message || String(s3Error) });
                    // Don't fail the entire request for S3 upload issues
                }
            }
        } catch (error) {
            console.log("Save Media - Error:", error);
            throw error; // Re-throw to be handled by caller
        }
    }
    
    async save(req,res){
        const { id,amenities,property_collections,hosts } = req.body;
        try {
            const fieldValues = {};
            const checkboxFields = ['featured_property', 'for_events', 'for_corporate_offsite'];
            propertyFields.forEach(fieldName => {
                if (checkboxFields.includes(fieldName)) {
                    const rawValue = req.body[fieldName];
                    fieldValues[fieldName] = (rawValue === 'on' || rawValue === '1' || rawValue === 1 || rawValue === true) ? 1 : 0;
                    return;
                }
                if(Object.hasOwnProperty.bind(req.body)(fieldName)){
                    fieldValues[fieldName] = req.body[fieldName];
                }
            });
            await Property.save(fieldValues,id);

            /* Save amenities for the property */
            await Property.clearAmenitiesForProperty(id);
            if(amenities && Array.isArray(amenities) && amenities.length > 0){
                await Promise.all(amenities.map(async(amenity) => {
                    const desc = amenity+"_description";
                    const values = {};
                    values['property_id'] = id;
                    values['amenity_id'] = amenity;
                    values['amenity_description'] = req.body[desc];
                    await Property.setPropertyAmenity(values);
                }));
            }
            /* Save collections for the property */
            await Property.clearCollectionsForProperty(id);
            if(property_collections && Array.isArray(property_collections) && property_collections.length > 0){
                await Promise.all(property_collections.map(async(collection) => {
                    const values = {};
                    values['property_id'] = id;
                    values['collection_id'] = collection;
                    await Property.setPropertyCollection(values);
                }));
            }
            /* Save hosts for the property */
            await Property.clearHostsForProperty(id);
            if(Array.isArray(hosts)){
                await Promise.all(hosts.map(async(host) => {
                    const values = {};
                    values['property_id'] = id;
                    values['host_id'] = host;
                    await Property.setPropertyHosts(values);
                }));
            }else{
                const values = {};
                values['property_id'] = id;
                values['host_id'] = hosts;
                await Property.setPropertyHosts(values);
            }
            
            var settings = await Setting.getSettings('media_type','photos');
            for(let s=0;s<settings.length;s++){
                var setting = settings[s];
                var setting_names = req.body[`photos_${setting.id}`];
                if(setting_names){
                    // multer gives a string when only one value is sent — always treat as array
                    if (!Array.isArray(setting_names)) setting_names = [setting_names];
                    for (let i = 0; i < setting_names.length; i++){
                        const mediaId = parseInt(setting_names[i], 10);
                        if (!isNaN(mediaId)) {
                            // Pass propertyId and categoryId so the UPDATE is scoped to the correct row
                            await Property.updateMediaOrder(mediaId, (i+1), id, setting.id);
                        }
                    }
                }
            }
        } catch (error) {
            console.log("Error in property save:", error);
            return Response.error(res, "ERROR", error.message || error, 400);
        }
        return Response.success(res, { status: 'Changes saved successfully' }, 200);
    }

    fileRecord(property_id,media_type_id,display_order,title,description,media_filename){
        var value = {};
        value['property_id'] = property_id;
        value['media_type_id'] = media_type_id;
        value['display_order'] = display_order;
        value['title'] = title;
        value['description'] = description;
        value['media_filename'] = media_filename;
        return value;
    }

    async propertiesByHost(req,res){
        try {
            var totalGBV = 0.00;
            var totalNBV = 0.00;
            var totalNights = 0;
            const {properties,gbvs,nights} = await Property.propertiesByHost(req.guest.id);
            await Promise.all(properties.map(async (property) => {
                try {
                    property['url'] = property.media_filename
                        ? await this.getPropertyImageUrl(property.id, property.media_filename)
                        : '';
                } catch (_) {
                    property['url'] = '';
                }
                const propertyGBV = gbvs.find(g => property.id == g.property);
                //property['gbv'] = 0.00;
                property['nbv'] = 0.00;
                if(propertyGBV){
                    //property['gbv'] = propertyGBV.gbv;
                    var nbv = Math.round(propertyGBV.gbv - propertyGBV.taCommision);
                    property['nbv'] = nbv;
                    totalGBV += propertyGBV.gbv;
                    totalNBV += nbv;
                }
                const propertyNight = nights.find(n => property.id == n.property);
                property['nights'] = 0;
                if(propertyNight){
                    property['nights'] = propertyNight.nights;
                    totalNights += propertyNight.nights;
                }
            }));
            return Response.success(res, {totalNBV:Math.round(totalNBV),totalNights,properties}, 200);
        } catch (error) {
            console.log(error);
            return Response.error(res, "ERROR", error, 400);
        }
    }

    async propertyPerformance(req,res){
        try {
            const {property_id,start,end} = req.body;
            if(!property_id){
                return Response.error(res, "ERROR", 'Missing property id', 400);
            }
            if(!start){
                start = format(startOfMonth(new Date()),"yyyy-MM-dd");
            }
            if(!end){
                end = format(endOfMonth(new Date()),"yyyy-MM-dd");
            }
            const {performance,serviceRequests,nights} = await Property.propertyPerformance(property_id,start,end);
            performance['serviceRequests'] = serviceRequests.count;
            performance['serviceRequestsAmount'] = serviceRequests.amount;
            performance['nights'] = nights.count;
            return Response.success(res, performance, 200);
        } catch (error) {
            console.log(error);
            return Response.error(res, "ERROR", error, 400);
        }
    }

    async earningsByMonth(req,res){
        try {
            const {property_id} = req.body;
            if(!property_id){
                return Response.error(res, "ERROR", 'Missing property id', 400);
            }
            
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
            
            // Use current financial year instead of last 5 months to next 5 months
            const start = financialYearStart;
            const end = format(endOfMonth(new Date()),"yyyy-MM-dd");
            const {earnings,nights} = await Property.earningsByMonth(property_id,start,end); 
            return Response.success(res, { earnings,nights }, 200);
        } catch (error) {
            console.log(error);
            return Response.error(res, "ERROR", error, 400);
        }
    }

    // New method for stacked earnings data by month
    async stackedEarningsByMonth(req,res){
        try {
            const {property_id, month, year} = req.body;
            if(!property_id){
                return Response.error(res, "ERROR", 'Missing property id', 400);
            }
            
            // Use provided month/year or default to current month
            let targetMonth, targetYear;
            if (month && year) {
                targetMonth = parseInt(month) - 1; // month is 0-indexed in Date constructor
                targetYear = parseInt(year);
            } else {
                const now = new Date();
                targetMonth = now.getMonth();
                targetYear = now.getFullYear();
            }
            
            // Get the specified month data
            const monthStart = format(startOfMonth(new Date(targetYear, targetMonth)), "yyyy-MM-dd");
            const monthEnd = format(endOfMonth(new Date(targetYear, targetMonth)), "yyyy-MM-dd");
            
            // Get stacked earnings data for specified month
            const stackedData = await Property.stackedEarningsByMonth(property_id, monthStart, monthEnd);
            
            return Response.success(res, { 
                data: stackedData,
                month: targetMonth + 1,
                year: targetYear,
                monthStart,
                monthEnd
            }, 200);
        } catch (error) {
            console.log(error);
            return Response.error(res, "ERROR", error, 400);
        }
    }

    // New method to get detailed booking information for owners app
    async getDetailedBookingsForMonth(req, res) {
        try {
            const {property_id, month, year} = req.body;
            if(!property_id){
                return Response.error(res, "ERROR", 'Missing property id', 400);
            }
            
            // Use provided month/year or default to current month
            let targetMonth, targetYear;
            if (month && year) {
                targetMonth = parseInt(month) - 1; // month is 0-indexed in Date constructor
                targetYear = parseInt(year);
            } else {
                const now = new Date();
                targetMonth = now.getMonth();
                targetYear = now.getFullYear();
            }
            
            // Get the specified month data
            const monthStart = format(startOfMonth(new Date(targetYear, targetMonth)), "yyyy-MM-dd");
            const monthEnd = format(endOfMonth(new Date(targetYear, targetMonth)), "yyyy-MM-dd");
            
            // Get detailed booking information for specified month
            const detailedBookings = await Property.getDetailedBookingsForMonth(property_id, monthStart, monthEnd);
            
            return Response.success(res, { 
                data: detailedBookings,
                month: targetMonth + 1,
                year: targetYear,
                monthStart,
                monthEnd
            }, 200);
        } catch (error) {
            console.log(error);
            return Response.error(res, "ERROR", error, 400);
        }
    }

    async otaLinks(req,res){
        try {
            const {property_id} = req.body;
            if(!property_id){
                return Response.error(res, "ERROR", 'Missing property id', 400);
            }
            const links = await Property.otaLinks(property_id);
            return Response.success(res, links, 200);
        } catch (error) {
            console.log(error);
            return Response.error(res, "ERROR", error, 400);  
        }
    }

    async referAProperty(req,res){
        try {
            const {owner_name,property_name,property_type,rooms,pool,owner_contact,url_address} = req.body;
            console.log(req.body);
            if(!owner_name || !owner_contact){       
                return Response.error(res, "ERROR", 'Missing mandatory fields', 400);
            }
            if(property_type && (property_type != 'Villa' && property_type != 'Apartment' && property_type != 'Condo')){
                return Response.error(res, "ERROR", 'Invalid property type. Must be one of Villa, Condo or Apartment', 400);
            }
            if(rooms && (rooms < 1 || rooms > 100)){
                return Response.error(res, "ERROR", 'Invalid number of rooms', 400);
            }
            if(pool && (pool != 'None' && pool != 'Private' && pool != 'Shared')){
                return Response.error(res, "ERROR", 'Invalid pool value. Must be one of None, Private or Shared', 400);
            }
            await Property.referAProperty({owner_name,property_name,property_type,rooms,pool,owner_contact,url_address});
            
            // Send SMS notification using Twilio instead of email
            const twilioHelper = require('../helpers/twilioHelper');
            const TwilioHelper = new twilioHelper();
            
            // Format phone number for Twilio
            const formattedPhone = owner_contact.startsWith('+') ? owner_contact : `+91${owner_contact}`;
            
            // Create SMS message
            const smsBody = `Property Referral Received!\n\nOwner: ${owner_name}\nProperty: ${property_name || 'N/A'}\nType: ${property_type || 'N/A'}\nRooms: ${rooms || 'N/A'}\nPool: ${pool || 'N/A'}\nContact: ${owner_contact}\nAddress: ${url_address || 'N/A'}\n\nThank you for referring!`;
            
            // Send SMS to property owner
            await TwilioHelper.sendSMS(smsBody, "+12163036560", formattedPhone);
            
            // Send SMS to admin numbers
            const adminNumbers = ["+919370174647", "+919876543210","+916377966657"]; // Add your admin numbers here
            const adminSmsBody = `New Property Referral!\n\nOwner: ${owner_name}\nProperty: ${property_name || 'N/A'}\nContact: ${owner_contact}\n\nCheck dashboard for details.`;
            
            for (const adminNumber of adminNumbers) {
                try {
                    await TwilioHelper.sendSMS(adminSmsBody, "+12163036560", adminNumber);
                } catch (smsError) {
                    console.log(`Failed to send SMS to admin ${adminNumber}:`, smsError);
                }
            }
            
            return Response.success(res, { status: 'Property referral saved successfully and SMS sent' }, 200);
        }catch (error) {
            console.log(error);
            return Response.error(res, "ERROR", error, 400);
        }   
    }

    async calendar(req,res){
        try {
            const {property_id} = req.body;
            if(!property_id){
                return Response.error(res, "ERROR", 'Missing property id', 400);
            }
            const start = req.body.start || format(startOfMonth(new Date()),"yyyy-MM-dd");
            const end = req.body.end || format(endOfMonth(new Date()),"yyyy-MM-dd");
            //const days = eachDayOfInterval({start: start,end: end}).map(day => format(day,"yyyy-MM-dd"));
            const calendar = await Property.calendar(property_id,start,end);
            calendar.forEach(booking => {
                booking['start'] = format(booking['start'],"yyyy-MM-dd");
                booking['end'] = format(booking['end'],"yyyy-MM-dd");
                booking['type'] = 'Booking';
                if(booking['currentStatus'] == 'Block'){
                    booking['type'] = booking['status'];
                }
            });
            return Response.success(res, {calendar}, 200);
        } catch (error) {
            console.log(error);
            return Response.error(res, "ERROR", error, 400);
        }
    }

    async propertyRatings(req,res){
        const {property_id} = req.body;
        if(!property_id){
            return Response.error(res, "ERROR", 'Missing property id', 400);
        }
        return Response.success(res, {Airbnb:4.5,Booking:4.3,MakeMyTrip:4.7,Expedia:3.7,Agoda:1.6,Hostelworld:0.2}, 200);
    }

    async getPropertyById(req,res){
        try {
            const {id} = req.params;
            if(!id){
                return Response.error(res, "ERROR", 'Missing property id', 400);
            }
            
            if(!req.user || !req.user.id) {
                return Response.error(res, "ERROR", 'User not authenticated or user ID missing', 401);
            }
            
            // Check if user has access to this property
            const hasAccess = await Property.checkPropertyAccess(id, req.user.id);
            if(!hasAccess){
                return Response.error(res, "ERROR", 'Access denied to this property', 403);
            }
            
            const property = await Property.getById(id);
            if(!property){
                return Response.error(res, "ERROR", 'Property not found', 404);
            }
            
            // Get property earnings
            const earnings = await Property.getPropertyEarnings(id);
            
            // Get property media
            const media = await Property.getPropertyMedia(id);
            
            // Combine all data
            const propertyData = {
                ...property,
                earnings: earnings || [],
                media: media || []
            };
            
            return Response.success(res, propertyData, 200);
        } catch (error) {
            console.log(error);
            return Response.error(res, "ERROR", error, 400);
        }
    }

    async roomsInfo(req,res){
        try {
            const roomsInfo = await EzeeHelper.roomsInfo({});
            if(roomsInfo.status != 200){
                return Response.error(res, "ERROR", "some error", 400);
            }
            const rooms = roomsInfo.data.RoomInfo.RoomTypes.RoomType;
            const dbRooms = await Property.select('properties');
            rooms.forEach(room => { 
                const dbRoom = dbRooms.find(dbRoom => dbRoom.channel_id == room.ID);
                if(dbRoom){
                    room.property_id = dbRoom.id;
                    room.channel_id = dbRoom.channel_id;
                    if(room.Rooms){
                        room.Rooms.forEach(r => {
                            console.log(`insert into property_inventory (property_id, room_type_id, room_id) values (${dbRoom.id},${room.ID},${r.RoomID});`);
                        });
                    }
                }
            });
            rooms.forEach(room => { 
                if(room.Rooms && room.Rooms.length > 1){
                    console.log(`update properties set inventory = ${room.Rooms.length} where id = ${room.property_id};`);
                }
            });
            res.render('utils/roomsInfo.ejs', { rooms: rooms});
        } catch (error) {
            return Response.error(res, "ERROR", error, 400);
        }
        
    }

    async refreshRoomInventory(req, res) {
        try {
            const { property_id } = req.body;
            
            if (!property_id) {
                return Response.error(res, "ERROR", "Property ID is required", 400);
            }

            const RoomService = require('../services/roomService');
            const roomService = new RoomService();

            console.log(`Refreshing room inventory for property ${property_id}...`);
            const result = await roomService.validateAndFixPropertyInventory(property_id);

            if (result.success) {
                return Response.success(res, {
                    message: result.message,
                    updated: result.updated,
                    roomCount: result.roomCount,
                    channelId: result.channelId
                }, 200);
            } else {
                return Response.error(res, "ERROR", result.error || 'Failed to refresh room inventory', 400);
            }
        } catch (error) {
            console.error('Error refreshing room inventory:', error);
            return Response.error(res, "ERROR", 'Internal server error', 500);
        }
    }

    async fixAllPropertyInventories(req, res) {
        try {
            const Property = require('../models/propertyModel');
            const property = new Property();
            const RoomService = require('../services/roomService');
            const roomService = new RoomService();

            // Get all properties
            const properties = await property.select('properties');
            const results = [];
            let successCount = 0;
            let errorCount = 0;

            console.log(`Fixing room inventory for ${properties.length} properties...`);

            for (const prop of properties) {
                try {
                    console.log(`Processing property ${prop.id} (${prop.listing_name})...`);
                    const result = await roomService.validateAndFixPropertyInventory(prop.id);
                    
                    results.push({
                        property_id: prop.id,
                        property_name: prop.listing_name,
                        channel_id: prop.channel_id,
                        success: result.success,
                        message: result.message,
                        updated: result.updated
                    });

                    if (result.success) {
                        successCount++;
                    } else {
                        errorCount++;
                    }
                } catch (error) {
                    console.error(`Error processing property ${prop.id}:`, error);
                    results.push({
                        property_id: prop.id,
                        property_name: prop.listing_name,
                        channel_id: prop.channel_id,
                        success: false,
                        message: error.message
                    });
                    errorCount++;
                }
            }

            return Response.success(res, {
                message: `Processed ${properties.length} properties. Success: ${successCount}, Errors: ${errorCount}`,
                totalProperties: properties.length,
                successCount,
                errorCount,
                results
            }, 200);
        } catch (error) {
            console.error('Error fixing all property inventories:', error);
            return Response.error(res, "ERROR", 'Internal server error', 500);
        }
    }
}
module.exports = PropertyController;
