'use strict';
const Response = require("../helpers/responseHelper");
const settingsModel = require('../models/settingModel');
const SettingsModel = new settingsModel();
const hostModel = require('../models/hostModel');
const Host = new hostModel();
const twilioHelper = require('../helpers/twilioHelper');
const TwilioHelper = new twilioHelper;
const utility = require("../helpers/utility");
const Utility = new utility;
const { formatPhoneForSms } = require("../helpers/phoneFormat");

class HostsController{

    async hostCalculatorSettings(req, res){
        try{
            const results = await SettingsModel.hostCalculatorSettings();
            if(results.length === 0){
                return Response.error(res, "ERROR", "No settings found", 404);
            }

            var settingCategories = results.flatMap(setting => setting.category);
            settingCategories = settingCategories.filter(function(item, pos){
                return settingCategories.indexOf(item)== pos;
            });
            var hostSettings = {};
            settingCategories.forEach(category => {
                var settings = results.filter(result => result.category == category); 
                var arr = [];
                settings.forEach(setting => {
                    arr.push({'id':setting.id,'name':setting.name});
                });
                hostSettings[category] = arr;
            });

            return Response.success(res, hostSettings, 200);
        }catch(err){
            return Response.error(res, "ERROR", "Settings not found", 400);
        }
    }

    async generateOTP(req,res){
        try {
            const {phone, email} = req.body;
            if(!phone && !email) {
                return Response.error(res, "ERROR", "Phone number or email missing or invalid!", 400);
            }
            
            //generate otp
            var minm = 100000;
            var maxm = 999999;
            var otp = Math.floor(Math.random() * (maxm - minm + 1)) + minm;
            const expires_at = Math.round(Date.now() / 1000) + (60 * 60); //60 minutes expiry
            
            var body = "Your staymaster OTP is: " + otp;
            
            if(phone) {
                await Host.saveOTP(phone, otp, expires_at);
                try {
                    const formattedPhone = formatPhoneForSms(phone);
                    await TwilioHelper.sendSMS(body, process.env.TWILIO_FROM_NUMBER || "+12163036560", formattedPhone);
                } catch (smsError) {
                    console.error("SMS sending error:", smsError);
                    // Continue execution even if SMS fails
                }
            }
            
            if(email) {
                // For email OTP
                await Host.saveOTP(null, otp, expires_at, email);
                try {
                    await Utility.sendEMail(email, 'OTP from Staymaster', body);
                } catch (emailError) {
                    console.error("Email sending error:", emailError);
                    // Continue execution even if email fails
                }
            }
            
            return Response.success(res, {message: "OTP sent successfully"}, 201);
        } catch (error) {
            console.error("OTP generation error:", error);
            return Response.error(res, "ERROR", "OTP could not be sent. Please try again.", 400);
        }
    };

    async hostEnquiry(req, res){
        try {
            const {location, property_type, bedrooms, pool_type, name, email, phone, otp} = req.body;
            if(!location || !property_type || !bedrooms || !pool_type || !name || !email || !otp || (!phone && !email)){
                return Response.error(res, "ERROR", "One or more mandatory parameters missing!", 400);
            }
            
            // OTP verification
            let userAvailable;
            if (phone) {
                userAvailable = await Host.hostExists(phone, otp);
            } else if (email) {
                userAvailable = await Host.hostExistsByEmail(email, otp);
            }
            
            if(!userAvailable) {
                return Response.error(res, "ERROR", "Contact information not found or OTP invalid!", 400);
            }
            
            const currentTime = Math.round(Date.now() / 1000);
            if(currentTime >= userAvailable[0].expires_at){
                res.status(400);
                throw new Error("OTP invalid or expired!");
            } 
            
            await Host.saveHostDetails(userAvailable[0].id, location, property_type, bedrooms, pool_type, name, email);
            const results = await SettingsModel.hostSettingsByParams(location, property_type, bedrooms, pool_type);
            var base_rental = 5000 * 91.25;
            var location_record;
            results.forEach(result => {
                base_rental = base_rental * result.multiplier;
                if(result.setting_id == location){
                    location_record = result;
                }
            });
            var rentals = {};
            const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
            months.forEach(month => {
                rentals[month] = base_rental*location_record[month];
            });
            base_rental = Math.round(base_rental);
            return Response.success(res, {rentals, base_rental}, 200);
        } catch (error) {
            return Response.error(res, "ERROR", "Issue with fetching", 400);
        }
    }

    async hostsByProperty(req, res){
        const { propertyId } = req.params;
        const hosts = await Host.hostsByProperty(propertyId);
        return Response.success(res, { hosts }, 200);
    }
}
module.exports = HostsController; 