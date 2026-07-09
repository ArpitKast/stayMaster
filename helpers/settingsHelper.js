'use strict';
var pool = require('../config/dbConnection');
const destination = require("../models/destinationModel");
const Destination = new destination();
const settingsModel = require('../models/settingModel');
const SettingsModel = new settingsModel();
const collectionModel = require('../models/collectionModel');
const CollectionModel = new collectionModel();
const amenityModel = require('../models/amenityModel');
const AmenityModel = new amenityModel();
const userModel = require('../models/userModel');
const UserModel = new userModel();
const property = require("../models/propertyModel");
const Property = new property;
const CacheService = require('../services/CacheService');

// Cache TTL in seconds (5 minutes for settings, 1 minute for user data)
const SETTINGS_CACHE_TTL = 300;
const USERS_CACHE_TTL = 60;

// Cache keys
const CACHE_KEYS = {
    CONSOLIDATED_SETTINGS: 'settings:consolidated',
    CONSOLIDATED_SETTINGS_WITH_USERS: 'settings:consolidated_with_users',
    WEB_DISCOUNT: 'settings:web_discount'
};

class SettingsHelper{
    
    async getSettingValues(settingId){
        const result = await pool.query("Select id,setting,category,display,value from settings where setting = ? and active = 1",[settingId]);
        return result[0];
    }

    async webDiscount(){
        try{
            // Try to get from cache first
            return await CacheService.getOrSet(CACHE_KEYS.WEB_DISCOUNT, async () => {
                const result = await pool.query("Select * from settings where setting = 'website_discount' and active = 1 ");
                return result[0][0].value;
            }, SETTINGS_CACHE_TTL);
        }catch (error){
            console.log(error);
        }
    }

    async updateWebDiscount(discount){
        try{
            const result = await pool.query("update settings set value = ? where setting = 'website_discount' and active = 1 ",[discount]);
            // Invalidate cache after update
            await CacheService.delete(CACHE_KEYS.WEB_DISCOUNT);
            await CacheService.delete(CACHE_KEYS.CONSOLIDATED_SETTINGS);
            await CacheService.delete(CACHE_KEYS.CONSOLIDATED_SETTINGS_WITH_USERS);
            return result;
        }catch (error){
            console.log(error);
        }
    }

    async formSettings(){
        const options = {};
        try{
            options['property_types'] = await SettingsModel.list('property_type'); //property_types
        }catch (error){
            console.log(error);
        }
        return options;
    }

    async settings(type){
        try{
            return await SettingsModel.list(type);
        }catch (error){
            console.log(error);
        }
    }

    async consolidatedSettings(){
        try{
            // Use cache for frequently accessed settings (5 minute TTL)
            return await CacheService.getOrSet(CACHE_KEYS.CONSOLIDATED_SETTINGS, async () => {
                const options = {};
                options['destinations'] = await Destination.list(); //destinations
                options['countries'] = await SettingsModel.list('countries'); //countries
                options['property_types'] = await SettingsModel.list('property_type'); //property_types
                options['collections'] = await CollectionModel.list(); //collections
                options['amenities'] = await AmenityModel.amenitiesGroupedByCategory();//amenities
                options['photo_categories'] = await SettingsModel.list('media_type','photos');//media_types
                return options;
            }, SETTINGS_CACHE_TTL);
        }catch (error){
            console.log(error);
            return {};
        }
    }

    async consolidatedSettingsWithUsers(){
        try{
            // Use shorter TTL (1 minute) for data that includes users which may change more frequently
            return await CacheService.getOrSet(CACHE_KEYS.CONSOLIDATED_SETTINGS_WITH_USERS, async () => {
                const options = await this.consolidatedSettings();
                options['hosts'] = await UserModel.getHosts();
                options['staffs'] = await UserModel.getStaff();
                options['managers'] = await UserModel.getManagers();
                options['nextOrder'] = await Property.getMaxDisplayOrder();
                return options;
            }, USERS_CACHE_TTL);
        }catch (error){
            console.log(error);
            return {};
        }
    }

    async invalidateCache(){
        await CacheService.delete(CACHE_KEYS.CONSOLIDATED_SETTINGS);
        await CacheService.delete(CACHE_KEYS.CONSOLIDATED_SETTINGS_WITH_USERS);
        await CacheService.delete(CACHE_KEYS.WEB_DISCOUNT);
    }
}
module.exports = SettingsHelper;