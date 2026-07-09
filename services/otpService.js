'use strict';
/**
 * Centralized OTP Service
 * Consolidates all OTP generation, sending, and verification logic
 */
const crypto = require('crypto');
const constants = require('../config/constants');
const gmailer = require('../config/gmail');
const twilioHelper = require('../helpers/twilioHelper');
const TwilioHelper = new twilioHelper();
const { formatPhoneForSms } = require('../helpers/phoneFormat');

class OTPService {
    /**
     * Generate a 6-digit OTP with expiry time
     * @param {number} expiryMinutes - OTP expiry time in minutes (default from constants)
     * @returns {Object} - { otp: string, expires_at: number (unix timestamp) }
     */
    generateOTP(expiryMinutes = constants.OTP_EXPIRY.GUEST) {
        const otp = crypto.randomInt(100000, 1000000); // cryptographically secure 6-digit OTP
        const expires_at = Math.round(Date.now() / 1000) + (60 * expiryMinutes);
        return { otp: otp.toString(), expires_at };
    }

    /**
     * Send OTP via SMS
     * @param {string} phone - Phone number (with or without + prefix)
     * @param {string} otp - OTP to send
     * @returns {Promise<boolean>} - Success status
     */
    async sendOTPviaSMS(phone, otp) {
        try {
            const formattedPhone = formatPhoneForSms(phone);
            const body = `Your staymaster OTP is: ${otp}`;
            await TwilioHelper.sendSMS(body, process.env.TWILIO_FROM_NUMBER || "+12163036560", formattedPhone);
            console.log(`OTP sent via SMS to ${formattedPhone}`);
            return true;
        } catch (error) {
            console.error("SMS sending error:", error);
            return false;
        }
    }

    /**
     * Send OTP via Email
     * @param {string} email - Email address
     * @param {string} otp - OTP to send
     * @param {string} subject - Email subject (optional)
     * @returns {Promise<boolean>} - Success status
     */
    async sendOTPviaEmail(email, otp, subject = 'OTP from StayMaster') {
        try {
            const body = `Your staymaster OTP is: ${otp}`;
            await gmailer.sendMail({
                from: `"Stay Master" <${process.env.SMTP_USER || 'tech@thestaymaster.com'}>`,
                to: email,
                subject: subject,
                text: body,
                html: body,
            });
            console.log(`OTP sent via email to ${email}`);
            return true;
        } catch (error) {
            console.error("Email sending error:", error);
            return false;
        }
    }

    /**
     * Verify OTP - checks if OTP matches and is not expired
     * Also handles test OTP bypass for development
     * @param {string} providedOTP - OTP provided by user
     * @param {Object} storedOTPRecord - Record from database { otp, expires_at }
     * @returns {Object} - { valid: boolean, error?: string }
     */
    verifyOTP(providedOTP, storedOTPRecord) {
        // Check for test OTP bypass (only in development)
        if (this.isTestOTPAllowed() && this.isTestOTP(providedOTP)) {
            return { valid: true };
        }

        // Validate stored record exists
        if (!storedOTPRecord || !storedOTPRecord.otp) {
            return { valid: false, error: constants.ERROR_MESSAGES.INVALID_OTP };
        }

        // Check if OTP has expired
        const currentTime = Math.round(Date.now() / 1000);
        if (currentTime >= storedOTPRecord.expires_at) {
            return { valid: false, error: 'OTP has expired' };
        }

        // Verify OTP matches
        if (storedOTPRecord.otp.toString() !== providedOTP.toString()) {
            return { valid: false, error: constants.ERROR_MESSAGES.INVALID_OTP };
        }

        return { valid: true };
    }

    /**
     * Check if test OTP is allowed (development environment only)
     * @returns {boolean}
     */
    isTestOTPAllowed() {
        return process.env.NODE_ENV === 'development' && process.env.ALLOW_TEST_OTP === 'true';
    }

    /**
     * Check if provided OTP is a test OTP
     * @param {string} otp - OTP to check
     * @returns {boolean}
     */
    isTestOTP(otp) {
        const testOTPs = (process.env.TEST_OTP || '').split(',').map(o => o.trim());
        return testOTPs.includes(otp.toString());
    }

    /**
     * Get expiry time for different OTP types
     * @param {string} type - 'guest', 'host', or 'reset_password'
     * @returns {number} - Expiry time in minutes
     */
    getExpiryTime(type) {
        switch (type) {
            case 'host':
                return constants.OTP_EXPIRY.HOST;
            case 'reset_password':
                return constants.OTP_EXPIRY.RESET_PASSWORD;
            case 'guest':
            default:
                return constants.OTP_EXPIRY.GUEST;
        }
    }
}

module.exports = new OTPService();
