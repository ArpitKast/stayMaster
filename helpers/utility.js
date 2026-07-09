'use strict';
//var pool = require('../config/dbConnection');
const gmailer = require("../config/gmail");
/*
const propertyModel = require('../models/propertyModel');
const Property = new propertyModel();
const bookingModel = require('../models/bookingModel');
const Booking = new bookingModel;
const user = require('../models/userModel');
const User = new user;
const { format,addDays,startOfMonth,addMonths, endOfMonth, eachDayOfInterval,differenceInDays,isBefore,isPast,subDays } = require("date-fns");
*/
class Utility{

    generateOTP(expiry_in_minutes = 10){
        //generate otp
        var minm = 100000;
        var maxm = 999999;
        var otp = Math.floor(Math.random() * (maxm - minm + 1)) + minm;
        const expires_at = Math.round(Date.now() / 1000) + (60 * expiry_in_minutes); //expiry after expiry_in_minutes
        return {otp,expires_at};
    }

    async sendEMail(to, subject,body){
        try {
            await gmailer.sendMail({
                from: '"Stay Master" <tech@thestaymaster.com>', // sender address
                to: to, // list of receivers
                subject: subject, // Subject line
                text: body, // plain text body
                html: body, // html body
              })
        } catch (error) {
            throw error;
        }
    }

    async checkEmpty(data){      
        for(const[key,value] of Object.entries(data)){
            if(!value || value == ""){
                return true;
            }
        }
        return false;
    }
}
module.exports = Utility;