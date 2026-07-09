const Response = require("../helpers/responseHelper");
const settingsModel = require('../models/settingModel');
const SettingsModel = new settingsModel();
const settingsHelper = require('../helpers/settingsHelper');
const SettingsHelper = new settingsHelper();
const MASTER_KEY_URL_SETTING = 'master_key_url';
const MASTER_KEY_URL_CATEGORY = 'api';
const MASTER_KEY_URL_DISPLAY = 'Master Key URL';
const INVESTOR_APP_URL_SETTING = 'investor_app_url';
const INVESTOR_APP_URL_CATEGORY = 'api';
const INVESTOR_APP_URL_DISPLAY = 'Investor App URL';

class SettingsController{
    
    async getSettings(req, res){
        const {setting, category} = req.params;
        try{
            const result = await SettingsModel.getSettings(setting,category);
            if(result.length === 0){
                return Response.error(res, "ERROR", "No settings found", 404);
            }
            return Response.success(res, result, 200);
        }catch(err){
            return Response.error(res, "ERROR", "No settings found", 500);
        }
    }

    async index(req,res){
        var { type,flash } = req.params;
        if(!flash){
            flash="";
        }
        var discount = await SettingsHelper.webDiscount();
        if(discount === undefined){
            discount = 0;
        }
        const masterKeyUrlSetting = await SettingsModel.getSettingValue(
            MASTER_KEY_URL_SETTING,
            MASTER_KEY_URL_CATEGORY
        );
        const masterKeyUrl = masterKeyUrlSetting && masterKeyUrlSetting.value ? masterKeyUrlSetting.value : '';
        const investorAppUrlSetting = await SettingsModel.getSettingValue(
            INVESTOR_APP_URL_SETTING,
            INVESTOR_APP_URL_CATEGORY
        );
        const investorAppUrl = investorAppUrlSetting && investorAppUrlSetting.value ? investorAppUrlSetting.value : '';
        
        // Fetch properties list and hero property ID for the settings panel
        const propertyModel = require('../models/propertyModel');
        const PropertyModel = new propertyModel();
        const properties = await PropertyModel.propertiesList();
        const heroPropertySetting = await SettingsModel.getSettingValue(
            'hero_property_id',
            'home'
        );
        const heroPropertyId = heroPropertySetting && heroPropertySetting.value ? heroPropertySetting.value : '';

        await res.render('settings/settings.ejs',{
            discount: discount,
            flash: flash,
            masterKeyUrl: masterKeyUrl,
            investorAppUrl: investorAppUrl,
            properties: properties,
            heroPropertyId: heroPropertyId
        }); 
    }

    async updateHeroProperty(req, res) {
        const { hero_property_id } = req.body;
        try {
            await SettingsModel.upsertSettingValue(
                'hero_property_id',
                'home',
                hero_property_id,
                'Hero Property',
                'Hero property'
            );
            
            // Clear home Redis cache if Redis is configured
            try {
                const redisClient = require('../config/redisConnection');
                if (redisClient && redisClient.isOpen) {
                    await redisClient.del('home:data_payload');
                    console.log('[updateHeroProperty] Cleared Redis cache home:data_payload');
                }
            } catch (redisErr) {
                console.error('[updateHeroProperty] Error clearing Redis cache:', redisErr);
            }

            return res.status(200).json({ success: true, flash: 'Hero Property Updated' });
        } catch (error) {
            console.log(error);
            return res.status(500).json({ success: false, error: 'Failed to update Hero Property.' });
        }
    }

    async updateDiscount(req,res){  
        const {new_discount} = req.body;
        try{
            const result = await SettingsHelper.updateWebDiscount(new_discount);
            if(result.affectedRows === 0){
                return Response.error(res, "ERROR", "No settings found", 404);
            }
            return Response.success(res, {flash:`Website Discount Updated`}, 200);
        }catch(error){
            console.log(error);
            return Response.error(res, "ERROR", 'Failed to update discount', 400);
        }
    }

    async edit(req,res){

    }

    async add(req,res){

    }

    async setWebDiscount(req,res){
        const {web_discount} = req.body;
        try{
            const result = await SettingsModel.setWebDiscount(web_discount);
            if(result.affectedRows === 0){
                return Response.error(res, "ERROR", "No settings found", 404);
            }
            return Response.success(res, result, 200);
        }catch(err){
            return Response.error(res, "ERROR", "No settings found", 500);
        }
    }

    async check(req, res){
        try{
            const result = await SettingsHelper.consolidatedSettings();
            /*if(result.length === 0){
                return Response.error(res, "ERROR", "No settings found", 404);
            }*/
            return Response.success(res, result, 200);
        }catch(err){
            return Response.error(res, "ERROR", "No settings found", 500);
            
        }
    }

     async updateMasterKeyUrl(req, res) {
        const { master_key_url } = req.body;
        const normalizedUrl = master_key_url ? String(master_key_url).trim() : '';

        try {
            await SettingsModel.upsertSettingValue(
                MASTER_KEY_URL_SETTING,
                MASTER_KEY_URL_CATEGORY,
                normalizedUrl,
                MASTER_KEY_URL_DISPLAY,
                'Project master key URL'
            );
            return res.status(200).json({ success: true, flash: 'Master Key URL Updated' });
        } catch (error) {
            console.log(error);
            return res.status(500).json({ success: false, error: 'Failed to update Master Key URL.' });
        }
    }

    async getMasterKeyUrl(req, res) {
        try {
            const setting = await SettingsModel.getSettingValue(
                MASTER_KEY_URL_SETTING,
                MASTER_KEY_URL_CATEGORY
            );
            const url = setting && setting.value ? setting.value : '';
            return res.status(200).json({ master_key_url: url });
        } catch (error) {
            console.log(error);
            return res.status(500).json({ master_key_url: '' });
        }
    }

    async updateInvestorAppUrl(req, res) {
        const { investor_app_url } = req.body;
        const normalizedUrl = investor_app_url ? String(investor_app_url).trim() : '';

        try {
            await SettingsModel.upsertSettingValue(
                INVESTOR_APP_URL_SETTING,
                INVESTOR_APP_URL_CATEGORY,
                normalizedUrl,
                INVESTOR_APP_URL_DISPLAY,
                'Investor app URL'
            );
            return res.status(200).json({ success: true, flash: 'Investor App URL Updated' });
        } catch (error) {
            console.log(error);
            return res.status(500).json({ success: false, error: 'Failed to update Investor App URL.' });
        }
    }

    async getInvestorAppUrl(req, res) {
        try {
            const setting = await SettingsModel.getSettingValue(
                INVESTOR_APP_URL_SETTING,
                INVESTOR_APP_URL_CATEGORY
            );
            const url = setting && setting.value ? setting.value : '';
            return res.status(200).json({ investor_app_url: url });
        } catch (error) {
            console.log(error);
            return res.status(500).json({ investor_app_url: '' });
        }
    }
}
module.exports = SettingsController;
