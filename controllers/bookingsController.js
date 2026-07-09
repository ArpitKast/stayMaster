'use strict';
const Response = require("../helpers/responseHelper");
const ezeeHelper = require('../helpers/ezeeHelperImproved');
const RoomService = require('../services/roomService');
const roomService = new RoomService();
const property = require("../models/propertyModel");
const Property = new property;
const bookingHelper = require("../helpers/bookingHelper");
const BookingHelper = new bookingHelper;
const booking = require("../models/bookingModel");
const Booking = new booking;
const conciergeCatalogModel = require("../models/conciergeCatalogModel");
const user = require("../models/userModel");
const User = new user;
const smModel = require("../models/smModel");
const SMModel = new smModel;
const settingModel = require("../models/settingModel");
const Setting = new settingModel;
const razorPayHelper = require("../helpers/razorPayHelper");
const RazorPayHelper = new razorPayHelper;
const fieldNames = require('../config/tableFieldNames');
const CREATE_BOOKING = "createBooking";
const PROCESS_POST_BOOKING = "processPostBooking";
const fields = require('../config/configs');
const {ezee_bookByInfo_fields,ezee_BookingTran_fields,ezee_RentalInfo_fields,ezee_TaxDetails_fields,ezee_PaymentDetails_fields, booking_tables} = fields;
const utility = require("../helpers/utility");
const Utility = new utility;
const bookingTableMappings = require('../config/ezeeTableConfig');
const {bookingTables,transactionTables} = bookingTableMappings;

const { format,addDays,differenceInDays,eachDayOfInterval} = require("date-fns");

const xml2js = require("xml2js");
const { json } = require('body-parser');
const S3Helper = require('../helpers/s3Helper');
const settingHelper = require("../helpers/settingsHelper");
const SettingsHelper = new settingHelper();
const s3Helper = new S3Helper();
const notificationsController = require("../controllers/notificationsController");
const NotificationsController = new notificationsController();
const hostModel = require("../models/hostModel");
const HostModel = new hostModel();
const LimechatService = require("../services/limechatService");
const limechatService = new LimechatService();
const db = require('../config/dbConnection');
const { decodeSecureGuestId } = require('../helpers/urlHelper');
const { generateRandomCouponCode, generateRandomDiscount } = require('../helpers/couponHelper');
const GooglePlacesHelper = require('../helpers/googlePlacesHelper');
const googlePlacesHelper = new GooglePlacesHelper();

const DEFAULT_NEARBY_RADIUS = Number(process.env.GOOGLE_PLACES_RADIUS_METERS) || 2000;
const DEFAULT_NEARBY_LIMIT = Number(process.env.GOOGLE_PLACES_MAX_RESULTS) || 5;
const EmailHelper = require('../helpers/emailHelper');
const {
    precheckinPortalWhere,
    precheckinPortalParams,
} = require('../helpers/portalBookingSql');

function buildCouponEmailHtml(firstName, couponCode, discountPercent, expiryDate) {
    const formattedExpiry = expiryDate
        ? new Date(expiryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
        : 'N/A';
    const name = firstName ? String(firstName) : 'Guest';
    return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr><td style="background:#1a1a2e;padding:28px 40px;text-align:center;">
          <h1 style="color:#ffffff;margin:0;font-size:24px;letter-spacing:1px;">Stay Master</h1>
          <p style="color:#aaa;margin:6px 0 0;font-size:13px;">Your exclusive booking reward</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:36px 40px;">
          <p style="font-size:16px;color:#333;margin:0 0 10px;">Dear ${name},</p>
          <p style="font-size:15px;color:#555;margin:0 0 24px;">Thank you for your feedback! As a token of our appreciation, here is your exclusive discount coupon for your next booking with us.</p>
          <!-- Coupon Box -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
            <tr><td style="background:#f0f7ff;border:2px dashed #4a90d9;border-radius:8px;padding:24px;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;color:#666;text-transform:uppercase;letter-spacing:1px;">Your Coupon Code</p>
              <p style="margin:0 0 16px;font-size:32px;font-weight:bold;color:#1a1a2e;letter-spacing:4px;">${couponCode}</p>
              <p style="margin:0 0 8px;font-size:28px;font-weight:bold;color:#4a90d9;">${discountPercent}% OFF</p>
              <p style="margin:0;font-size:13px;color:#888;">on your next booking</p>
            </td></tr>
          </table>
          <!-- Details -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;background:#fafafa;border-radius:6px;padding:16px;">
            <tr>
              <td style="padding:6px 0;font-size:14px;color:#555;width:50%;"><strong>Discount:</strong></td>
              <td style="padding:6px 0;font-size:14px;color:#333;">${discountPercent}% off on booking amount</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:14px;color:#555;"><strong>Valid Until:</strong></td>
              <td style="padding:6px 0;font-size:14px;color:#e74c3c;font-weight:bold;">${formattedExpiry}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:14px;color:#555;"><strong>Applicable On:</strong></td>
              <td style="padding:6px 0;font-size:14px;color:#333;">All bookings</td>
            </tr>
          </table>
          <p style="font-size:13px;color:#888;margin:0 0 24px;">To redeem, use the coupon code above at the time of your next booking. This coupon is valid for 1 year from the date of issue.</p>
          <p style="font-size:15px;color:#333;margin:0;">We look forward to hosting you again!</p>
          <p style="font-size:15px;color:#333;margin:4px 0 0;">— The Stay Master Team</p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f9f9f9;padding:18px 40px;text-align:center;border-top:1px solid #eee;">
          <p style="margin:0;font-size:12px;color:#aaa;">This is an automated email from Stay Master. Please do not reply to this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

class BookingsController{
    constructor(ezeeHelper){
        this.ezeeHelper = ezeeHelper;
    }

    // Map user reason to Ezee-compatible reason codes
    mapToEzeeReasonCode(userReason, blockType) {
        // Common Ezee reason codes that are typically accepted
        const ezeeReasonCodes = {
            'maintenance': 'Maintenance',
            'repair': 'Maintenance', 
            'cleaning': 'Maintenance',
            'renovation': 'Maintenance',
            'owner': 'Owner Block',
            'personal': 'Owner Block',
            'family': 'Owner Block',
            'testing': 'Maintenance',
            'test': 'Maintenance',
            'demo': 'Maintenance',
            'inspection': 'Maintenance',
            'upgrade': 'Maintenance',
            'fix': 'Maintenance',
            'broken': 'Maintenance',
            'damage': 'Maintenance',
            'out of order': 'Out of Order',
            'unavailable': 'Out of Order',
            'closed': 'Out of Order',
            'emergency': 'Emergency',
            'urgent': 'Emergency'
        };

        // Clean and normalize the user reason
        const cleanReason = userReason ? userReason.toLowerCase().trim() : '';
        
        // Check if user reason matches any known patterns
        for (const [pattern, ezeeCode] of Object.entries(ezeeReasonCodes)) {
            if (cleanReason.includes(pattern)) {
                return ezeeCode;
            }
        }
        
        // If no match found, use blockType-based mapping
        if (blockType === 'Owner block') {
            return 'Owner Block';
        } else if (blockType === 'Maintainance Block' || blockType === 'Maintenance Block') {
            return 'Maintenance';
        } else {
            // Default to Maintenance for any other cases
            return 'Maintenance';
        }
    }

    async nearbyAttractions(req, res) {
        try {
            const guestId = req.guest?.id;
            const bookingId = Number(req.params?.id || req.query?.bookingId);
            const radius = Number(req.query?.radius) || undefined;
            const limit = Number(req.query?.limit) || undefined;
            const type = req.query?.type || 'tourist_attraction';

            let latitude;
            let longitude;

            if (req.query?.lat && req.query?.lng) {
                latitude = Number(req.query.lat);
                longitude = Number(req.query.lng);
                if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
                    return Response.error(res, 'ERROR', 'Invalid lat/lng query parameters', 400);
                }
            } else if (bookingId) {
                if (!guestId) {
                    return Response.error(res, 'UNAUTHORIZED', 'Guest authentication required', 401);
                }

                const bookingRow = await Booking.bookingForGuest(bookingId, guestId);
                if (!bookingRow) {
                    return Response.error(res, 'NOT_FOUND', 'Booking not found for this guest', 404);
                }

                const property = await Property.forBookingInfoDisplay(bookingRow.property_id);
                if (!property || property.google_latitude === null || property.google_longitude === null) {
                    return Response.error(res, 'NOT_FOUND', 'Property coordinates unavailable', 404);
                }

                latitude = Number(property.google_latitude);
                longitude = Number(property.google_longitude);
            } else {
                return Response.error(res, 'ERROR', 'Provide bookingId or lat/lng parameters', 400);
            }

            if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
                return Response.error(res, 'ERROR', 'Invalid property coordinates', 500);
            }

            const places = await googlePlacesHelper.fetchNearby({
                latitude,
                longitude,
                radius,
                limit,
                type,
            });

            return Response.success(res, { places, meta: { latitude, longitude, radius, limit, type } }, 200);
        } catch (error) {
            console.error('Error fetching nearby attractions:', error);
            const status = error.code === 'MISSING_API_KEY' ? 500 : 502;
            return Response.error(res, error.code || 'GOOGLE_PLACES_ERROR', error.message || 'Failed to fetch nearby attractions', status);
        }
    }

    async generateFeedbackCoupon(req, res) {
        try {
            const { bookingId } = req.body;
            if (!bookingId) {
                return Response.error(res, "ERROR", "bookingId is required", 400);
            }

            const existing = await Booking.fetchFromTable('bookings', 'id', bookingId, true);
            if (!existing) {
                return Response.error(res, "ERROR", "Booking not found", 404);
            }

            if (req.guest?.id) {
                const ok =
                    existing.user_id != null &&
                    Number(existing.user_id) === Number(req.guest.id);
                if (!ok) {
                    return Response.error(res, "ERROR", "You are not authorized to access this booking", 403);
                }
            }

            if (existing.feedback_coupon_code) {
                return Response.success(res, {
                    coupon: {
                        code: existing.feedback_coupon_code,
                        discountPercent: existing.feedback_coupon_discount,
                        generatedAt: existing.feedback_coupon_generated_at,
                        expiryDate: existing.feedback_coupon_expiry,
                        alreadyGenerated: true
                    }
                }, 200);
            }

            const code = generateRandomCouponCode(bookingId);
            const discountPercent = generateRandomDiscount(); // Fixed at 10%

            const generatedAt = new Date();
            const expiryDate = new Date(generatedAt);
            expiryDate.setFullYear(expiryDate.getFullYear() + 1); // 1-year validity

            await Booking.updateBookingTable('bookings', {
                feedback_coupon_code: code,
                feedback_coupon_discount: discountPercent,
                feedback_coupon_generated_at: generatedAt,
                feedback_coupon_expiry: expiryDate
            }, existing.id);

            // Send coupon via email to the guest
            try {
                let guestEmail = null;
                let guestFirstName = 'Guest';

                if (existing.guest_id) {
                    const [[guestUser]] = await db.query(
                        'SELECT email, firstname FROM users WHERE id = ? LIMIT 1',
                        [existing.guest_id]
                    );
                    if (guestUser && guestUser.email) {
                        guestEmail = guestUser.email;
                        guestFirstName = guestUser.firstname || 'Guest';
                    }
                }

                if (guestEmail) {
                    const emailHelper = new EmailHelper();
                    const html = buildCouponEmailHtml(guestFirstName, code, discountPercent, expiryDate);
                    await emailHelper.sendMail(
                        guestEmail,
                        `Your ${discountPercent}% Discount Coupon for Your Next Stay!`,
                        html
                    );
                    console.log(`Coupon email sent to ${guestEmail} for booking ${bookingId}`);
                } else {
                    console.warn(`No guest email found for booking ${bookingId} — skipping coupon email`);
                }
            } catch (emailError) {
                // Email failure should not break the coupon generation response
                console.error('Failed to send coupon email:', emailError?.message || emailError);
            }

            return Response.success(res, {
                coupon: {
                    code,
                    discountPercent,
                    generatedAt: generatedAt.toISOString(),
                    expiryDate: expiryDate.toISOString(),
                    alreadyGenerated: false
                }
            }, 200);
        } catch (error) {
            console.error('Failed to generate feedback coupon:', error);
            return Response.error(res, "ERROR", "Failed to generate coupon", 500);
        }
    }

    // Alternative method to try different Ezee reason codes if the first one fails
    getAlternativeEzeeReasonCode(originalReason, blockType) {
        // Try different variations that might work with Ezee
        const alternatives = [
            'Maintenance',
            'Out of Order', 
            'OOO',
            'Block',
            'Unavailable',
            'Closed'
        ];
        
        // Return the first alternative (Maintenance is most commonly accepted)
        return alternatives[0];
    }

    async index(req,res){
        await res.render('bookings/list.ejs');
    }

    async edit(req, res){
        const { id } = req.params;
        res.render('bookings/edit.ejs', {});
        //res.render('bookingEdit.ejs', { results:settings,property:property[0] });
    }

    async channelIds(req, res){
        const results = await this.ezeeHelper.getPropertyTypes();
        res.render('channelIds.ejs', { results });
    }

    async importEzeeSyncLogs(req,res){
        const syncLogs = await Booking.getAllSyncLogs();
        for (const sl of syncLogs) {
            var log = JSON.parse(sl.log);
            var data = log.data.Reservations;
            for(let i=0; i<data.Reservation.length; i++){
                const reservation = data.Reservation[i];
                const uniqueId = reservation.UniqueID;
                const retrievedReservation = await this.ezeeHelper.retrieveSingleBooking(reservation.UniqueID);
                try {
                    if(uniqueId && uniqueId != ''){
                        await Booking.clearEzeeBooking(uniqueId);
                    }
                } catch (error) {
                    console.log("error while deleting");
                    console.log(error);
                }
                await this.retrieveAndImport(retrievedReservation,uniqueId);
            }
            await Booking.markAsImported(sl.id);
        }
        return Response.success(res, {}, 200);
    }

    async missedOutBookings(req,res){
        console.log("------------- start of missedOutBookings");
        const missed = await Booking.missing5();
        var data = [];
        for(let i=0; i< missed.length; i++){
            const missedBooking = missed[i];
            console.log("Starting: " + missedBooking.UniqueID);
            data.push(missedBooking.UniqueID);
            const retrievedReservation = await this.ezeeHelper.retrieveSingleBooking(missedBooking.UniqueID);
            await this.retrieveAndImport(retrievedReservation,missedBooking.UniqueID);
            await Booking.markMissedAsImported(missedBooking.UniqueID);
            console.log("Finished: " + missedBooking.UniqueID);
        }
        console.log("------------- end of missedOutBookings");
        return Response.success(res, {data:data}, 200);
    }

    async generateOrderId(req,res){
        const { amount, currency = 'INR', receipt, notes = {}, booking_id } = req.body;

        if(amount === undefined || amount === null){
            return Response.error(res, "ERROR", "Amount is required", 400);
        }

        const numericAmount = Number(amount);
        if(Number.isNaN(numericAmount) || numericAmount <= 0){
            return Response.error(res, "ERROR", "Amount must be a positive number", 400);
        }

        // Frontend already sends the amount in paise (rupees × 100).
        // Do NOT multiply again — Razorpay expects paise as an integer.
        const amountInPaise = Math.round(numericAmount);

        const sanitizeNotes = (obj = {}) => {
            if(!obj || typeof obj !== 'object'){
                return {};
            }
            const cleaned = {};
            Object.entries(obj).forEach(([key,value]) => {
                if(value !== undefined && value !== null){
                    cleaned[key] = String(value);
                }
            });
            return cleaned;
        };

        const metadata = sanitizeNotes(notes);
        if(booking_id){
            metadata.booking_id = String(booking_id);
        }
        if(req.guest?.id){
            metadata.guest_id = String(req.guest.id);
        }

        if (booking_id && req.guest?.id) {
            const owned = await Booking.bookingForGuest(parseInt(booking_id, 10), req.guest.id);
            if (!owned) {
                return Response.error(res, "FORBIDDEN", "You cannot pay for this booking", 403);
            }
        }

        try {
            const order = await RazorPayHelper.getOrderId(amountInPaise, currency, {
                receipt,
                notes: metadata
            });
            return Response.success(res, { ...order, key: process.env.RAZORPAY_KEY }, 200);
        } catch (error) {
            console.error('Razorpay order creation failed:', error.message || error);
            return Response.error(res, "ERROR", error.message || 'Could not generate orderId!', 400);
        }
    }

    async retrieveAndImport(retrievedReservation,uniqueId){
        var extraFields = {UniqueId:uniqueId};
        const reservations = retrievedReservation.Reservations;
        if(reservations){
            for(let i=0; i<reservations.Reservation.length; i++){
                const reservation = reservations.Reservation[i];
                console.log(`***** Importing booking with UniqueId: ${uniqueId} *****`);
                //console.log("insert into temp_BookByInfo");
                //await Booking.writeEzeeBookingTable('temp_BookByInfo',await this.populateFields(ezee_bookByInfo_fields,reservation));
                const bookingTrans = reservation.BookingTran;
                for(let j=0;j<bookingTrans.length; j++){
                    const bookingTran = bookingTrans[j];
                    /*Save bookingTran*/
                    //console.log("insert into temp_BookingTran");
                    /*await Booking.writeEzeeBookingTable('temp_BookingTran',await this.populateFields(ezee_BookingTran_fields,bookingTran,extraFields))
                    
                    const taxDetails = bookingTran.TaxDeatil;
                    
                    if(taxDetails){
                        for(let k=0;k<taxDetails.length; k++){
                            const taxDetail = taxDetails[k];
                            /*Save taxDetail*
                            //console.log("insert into temp_taxDetails");
                            await Booking.writeEzeeBookingTable('temp_taxDetails',await this.populateFields(ezee_TaxDetails_fields,taxDetail,{UniqueId:uniqueId,SubBookingId:bookingTran.SubBookingId}));
                        }
                    }
                    const paymentDetails = bookingTran.PaymentDetail;
                    if(paymentDetails){
                        for(let l=0;l<paymentDetails.length; l++){
                            const paymentDetail = paymentDetails[l];
                            /*Save paymentDetail*
                            //console.log("insert into temp_paymentDetails");
                            await Booking.writeEzeeBookingTable('temp_paymentDetails',await this.populateFields(ezee_PaymentDetails_fields,paymentDetail,{UniqueId:uniqueId,SubBookingId:bookingTran.SubBookingId}));
                        }
                    }*/
                    const rentalInfos = bookingTran.RentalInfo;
                    
                    if(rentalInfos){
                        for(let m=0;m<rentalInfos.length; m++){
                            const rentalInfo = rentalInfos[m];
                            /*Save rentalInfo*/
                            //console.log("insert into temp_RentalInfo");
                            await Booking.writeEzeeBookingTable('temp_RentalInfo',await this.populateFields(ezee_RentalInfo_fields,rentalInfo,{UniqueId:uniqueId,SubBookingId:bookingTran.SubBookingId}))
                        }
                    }
                }
            }
        }else{
            console.log("no reservation found");
        }
        return;
    }

    /* This function should move to some kind of util */
    async populateFields(fieldsList,fieldSet,extraFields=null){
        const values = {};
        fieldsList.forEach(fieldName => {
            if(Object.hasOwnProperty.bind(fieldSet)(fieldName)){
                values[fieldName] = fieldSet[fieldName];
            }
        });
        if(extraFields){
            for (var fieldName in extraFields) {
                values[fieldName] = extraFields[fieldName];
            }
        }
        return values;
    }

    /** called by the ezee booking webhook*/
    async ezeeBookingSync(req,res){
        console.log("Booking Webhook called by ezee request");
        let logId = 0;
        try {
            logId = await Booking.logEzeeBookingInput(req.body);
        } catch (error) {
            console.log("error while logging ezee booking");
            console.log(error);
        }

        const handleLimechatWebhook = async () => {
            let limechatLogId = null;
            try {
                limechatLogId = await Booking.logEzeeLimechatWebhook(req.body);
            } catch (error) {
                console.log("error while logging ezee limechat webhook");
                console.log(error);
            }

            try {
                const limechatPayload = limechatService.buildBookingConfirmationPayload(req.body);
                const limechatResult = await limechatService.sendEvent(limechatPayload);
                if (limechatResult?.skipped) {
                    console.log("Limechat webhook skipped: missing credentials");
                } else {
                    console.log("Limechat webhook status:", limechatResult?.status || "unknown");
                }
                if (limechatLogId) {
                    await Booking.updateEzeeLimechatWebhookLog(limechatLogId, {
                        limechatStatus: limechatResult?.status || null,
                        limechatSuccess: !!(limechatResult && !limechatResult.skipped && limechatResult.status >= 200 && limechatResult.status < 300),
                        limechatResponse: JSON.stringify(limechatResult?.data ?? limechatResult ?? null, null, 2)
                    });
                }
            } catch (error) {
                const errorDetail = error?.response?.data || error?.message || error;
                console.log("Limechat webhook failed:", errorDetail);
                if (limechatLogId) {
                    await Booking.updateEzeeLimechatWebhookLog(limechatLogId, {
                        limechatStatus: error?.response?.status || null,
                        limechatSuccess: false,
                        limechatResponse: JSON.stringify(errorDetail ?? null, null, 2)
                    });
                }
            }
        };

        await handleLimechatWebhook();

        // Declare before try so it's accessible in the response regardless of outcome
        let success = false;
        try {
            const reservation = req.body.data.Reservations.Reservation[0];
            const bookingTran = reservation.BookingTran[0];
            const uniqueId = reservation.UniqueID;
            if(uniqueId && uniqueId != ''){
                await Booking.clearEzeeBooking(uniqueId);
                console.log("deleted existing booking");
            }
            console.log("Beginning quick import");
            const rentalInfos = bookingTran.RentalInfo;
            if(rentalInfos){
                for(let m=0;m<rentalInfos.length; m++){
                    const rentalInfo = rentalInfos[m];
                    await Booking.writeEzeeBookingTable('temp_RentalInfo',await this.populateFields(ezee_RentalInfo_fields,rentalInfo,{UniqueId:uniqueId,SubBookingId:bookingTran.SubBookingId}))
                }
            }
            console.log("Finished quick import");
            console.log("Beginning detailed import");
            success = await this.importBooking(logId);
            if(success){
                await Booking.markImported(logId);
                console.log("✅ Booking imported successfully and marked as imported");
            } else {
                console.error("❌ Failed to import booking. Check logs for details.");
            }
            console.log("Finished detailed import");
        } catch (error) {
            console.error("❌ Error while importing ezee booking:", error);
            await Booking.writeTableEntry('bookings_log_errors', {
                log_id: logId || 0,
                error: error.message || String(error)
            });
        }
        // Clear Redis Cache
        try {
            const CacheService = require('../services/CacheService');
            await CacheService.deleteByPrefix('ezee:');
            await CacheService.delete('home:data_payload');
            console.log('[ezeeBookingSync] Cleared Redis caches');
        } catch (cacheErr) {
            console.error('[ezeeBookingSync] Error clearing Redis cache:', cacheErr);
        }

        return Response.success(res, {
            message: 'Webhook received and processed',
            logId: logId,
            imported: success
        }, 200);
    }

    async historicalCrossCheck(req,res){
        const from = await Booking.doneUpto();
        const to = format(addDays(from, 2),'yyyy-MM-dd');
        var data = await this.ezeeHelper.historicalBookings(from,to);
        var reservations;
        var i=0;
        await xml2js.parseString(data,
            async (err, result) => {
                if (err) {
                    console.error(err);
                    return;
                }
                var bookByInfo;
                try {
                    var errors = result.RES_Response.Errors[0];
                    console.log("Error code: " + errors.ErrorCode);
                    if(errors && errors.ErrorCode != 0){
                        console.log("Found non zero error code");
                        return {status:400,data:errors.ErrorMessage};
                    }
                    reservations = result.RES_Response.Reservations[0].Reservation;
                    if(!reservations || reservations.length == 0){
                        console.log("No reservations found");
                        await Booking.updateUpto(format(addDays(from, 1),'yyyy-MM-dd'));
                        return {status:400,data:data};
                    }
                    
                    for (i = 0; i < reservations.length; i++) {
                        bookByInfo = reservations[i].BookByInfo[0];
                        await Booking.insertTempCheck(bookByInfo['UniqueID']);
                    }
                    await Booking.updateUpto(format(addDays(from, 1),'yyyy-MM-dd'));
                    await Booking.manageTempCheck();
                } catch (error) {
                    console.log("Some error happened. Probably no records found");
                    console.log(error);
                    return {status:400,data:error};
                }         
        });
        
        return Response.success(res, {total:i,from:from,to:to}, 200);
    }

    async historicalBookings(req,res){
        var data = await this.ezeeHelper.historicalBookings(req.body.start,req.body.end);
        var reservations;
        await xml2js.parseString(data,
            async (err, result) => {
                if (err) {
                    console.error(err);
                    return;
                }
                var bookByInfo;
                var errors = result.RES_Response.Errors[0];
                console.log("Error code: " + errors.ErrorCode);
                if(errors && errors.ErrorCode != 0){
                    console.log("Found non zero error code");
                    return {status:400,data:errors.ErrorMessage};
                }
                reservations = result.RES_Response.Reservations[0].Reservation;
                if(!reservations || reservations.length == 0){
                    console.log("No reservations found");
                    return {status:400,data:data};
                }
                var i;
                for (i = 0; i < reservations.length; i++) {
                    bookByInfo = reservations[i].BookByInfo[0];
                    const uniqueId = bookByInfo['UniqueID'];
                    try {
                        if(uniqueId && uniqueId != ''){
                            await Booking.clearEzeeBooking(uniqueId);
                            console.log("deleted existing booking");
                        }
                    } catch (error) {
                        console.log("error while deleting");
                        console.log(error);
                    }
                    
                    const bookByInfoValues = {};
                    ezee_bookByInfo_fields.forEach(fieldName => {
                        if(Object.hasOwnProperty.bind(bookByInfo)(fieldName)){
                            bookByInfoValues[fieldName] = bookByInfo[fieldName];
                        }
                    });
                    var temp_booking_id = await Booking.writeEzeeBookingTable('temp_BookByInfo',bookByInfoValues);

                     bookingTrans = bookByInfo.BookingTran;
                     for(let bt=0; bt<bookingTrans.length; bt++){
                        const bookingTran = bookingTrans[bt];
                        const SubBookingId = bookingTran.SubBookingId;
                        const bookingTranValues = {};
                        ezee_BookingTran_fields.forEach(fieldName => {
                            if(Object.hasOwnProperty.bind(bookingTran)(fieldName)){
                                bookingTranValues[fieldName] = bookingTran[fieldName];
                            }
                        });
                        bookingTranValues['temp_booking_id'] = temp_booking_id;
                        bookingTranValues['uniqueId'] = uniqueId;
                        var temp_tran_id = await Booking.writeEzeeBookingTable('temp_BookingTran',bookingTranValues);

                        const rentalInfos = bookingTran.RentalInfo;
                        for(let j =0; j<rentalInfos.length; j++){
                            
                            const rentalInfo = rentalInfos[j];
                            const rentalInfoValues = {};
                            rentalInfoValues['temp_booking_id'] = temp_tran_id;
                            rentalInfoValues['uniqueId'] = uniqueId;
                            rentalInfoValues['SubBookingId'] = SubBookingId;
                            ezee_RentalInfo_fields.forEach(fieldName => {
                                if(Object.hasOwnProperty.bind(rentalInfo)(fieldName)){
                                    rentalInfoValues[fieldName] = rentalInfo[fieldName];
                                }
                            });
                            await Booking.writeEzeeBookingTable('temp_RentalInfo',rentalInfoValues);
                        }
                    }
                }
                console.log("Total Reservations: " + i);
        });
        return Response.success(res, data, 200);
    }

    async bookingOnEzee(params,property,lead_guest){
        var bookingDataString = await this.createBookingDataString(params,property,lead_guest);
        console.log(bookingDataString);
        //make booking on ezee
        var results = await this.ezeeHelper.createBooking({BookingData:bookingDataString});
        if(results.status != 200){
            return {status:400,data:results.output};
        }
        var ezeeBooking = results.data;
        if(ezeeBooking.hasOwnProperty("ErrorCode")){
            return {status:400,data:results.output};
        }

        results = await this.ezeeHelper.processPostBooking({Process_Data:'{"Action":"ConfirmBooking","ReservationNo": "'+ezeeBooking.ReservationNo+'","Inventory_Mode":"'+ezeeBooking.Inventory_Mode+'","Error_Text":""}'});
        if(results.status != 200){
            return {status:400,data:results.output};
        }
        var postBooking = results.data;
        if(!postBooking.hasOwnProperty("result") || postBooking.result != "success"){
            return {status:400,data:results.output};
        }
        return {status:200,ReservationNo:ezeeBooking.ReservationNo}
    }

    async create(req, res) {
        try {
            /* check if webUser is logged in */
            var loggedInUser = req.guest;
            if (!loggedInUser) {
                return Response.error(res, "ERROR", "User not authenticated!", 400);
            }

            const {
                check_in_date,
                check_out_date,
                property_id,
                number_adults,
                number_children,
                main_guest,
                breakfast_included,
                bookingForSelf,
                transaction_id
            } = req.body;

            if (
                check_in_date == null ||
                check_out_date == null ||
                property_id == null ||
                number_adults == null
            ) {
                return Response.error(res, "ERROR", "Mandatory booking parameters missing or incorrect!", 400);
            }
            //* Validate payment transaction id */
            if (!transaction_id || transaction_id == null || transaction_id == "") {
                return Response.error(res, "ERROR", "Payment information missing or incorrect!", 400);
            }
            /* Validate main guest details */
            if (!main_guest) {
                return Response.error(res, "ERROR", "Incomplete or incorrect guest information!!", 400);
            }
            let parsedMainGuest = {};
            try {
                parsedMainGuest = JSON.parse(main_guest);
            } catch (e) {
                return Response.error(res, "ERROR", "Incomplete or incorrect guest information!", 400);
            }

            // Fallback from logged-in user profile when any field is missing.
            let profile = null;
            try {
                const profileRows = await User.getById(loggedInUser.id);
                profile = Array.isArray(profileRows) ? profileRows[0] : profileRows;
            } catch (_) {}

            parsedMainGuest.firstname = (parsedMainGuest.firstname || profile?.firstname || '').trim();
            parsedMainGuest.lastname = (parsedMainGuest.lastname || profile?.lastname || '').trim();
            parsedMainGuest.email = (parsedMainGuest.email || profile?.email || '').trim();
            parsedMainGuest.phone = String(parsedMainGuest.phone || profile?.phone || '').trim();

            if (!parsedMainGuest.firstname || !parsedMainGuest.lastname || !parsedMainGuest.email || !parsedMainGuest.phone) {
                return Response.error(res, "ERROR", "Incomplete or incorrect guest information!", 400);
            }
            /* Validate property exists */
            var propertyResult = await Property.getById(req.body.property_id);
            if (!propertyResult || propertyResult.length == 0) {
                return Response.error(res, "ERROR", "Property not found", 400);
            }
            var dbProp = propertyResult[0];
            var breakfst_available = dbProp.meals_available;
            const arrivalTime = String(dbProp.check_in || '14:00:00').trim();
            const departureTime = String(dbProp.check_out || '11:00:00').trim();

            //create params object for Ezee
            const params = {
                check_in_date: req.body.check_in_date,
                check_out_date: req.body.check_out_date,
                number_adults: req.body.number_adults,
                number_children: req.body.number_children,
                roomtypeunkid: dbProp.channel_id
            }

            // Fetch pricing and availability from Ezee
            var ezeeRes = await this.ezeeHelper.getProperty(params);
            var ezeeProp = ezeeRes.property;

            let calculatedPrices;
            if (!ezeeProp || ezeeProp == null) {
                return Response.error(res, "ERROR", "Property unavailable for the selected criteria", 400);
            } else {
                if (ezeeProp.min_ava_rooms == 0) {
                    return Response.error(res, "ERROR", "No availability for the selected dates", 400);
                }
                calculatedPrices = await this.pricingCalcs(ezeeProp, number_adults, number_children, { check_in_date, check_out_date });
            }

            /* Make reservation on Ezee */
            let uniqueId;
            var reservation = await this.bookingOnEzee(params, ezeeProp, parsedMainGuest);
            if (reservation.status != 200) {
                return Response.error(res, "ERROR", reservation.data, 400);
            }
            uniqueId = reservation.ReservationNo;

            // Prepare values for main bookings table
            var booking_values = {
                uniqueId: uniqueId,
                subBookingId: 'SUB' + uniqueId,
                transaction_id: transaction_id || '0',
                property_id: dbProp.id, // Use validated ID from DB
                guest_id: loggedInUser.id,
                start: req.body.check_in_date,
                end: req.body.check_out_date,
                arrivalTime: arrivalTime,
                departureTime: departureTime,
                status: 'Confirmed',
                isConfirmed: 1,
                currentStatus: 'Confirmed',
                bookedBy: 'Guest',
                source: 'Staymaster Website',
                paymentMethod: 'Razorpay',
                isChannelBooking: 0,
                security_deposit: req.body.security_deposit || dbProp.security_deposit_percentage || 0.00,
                security_deposit_paid: req.body.security_deposit_paid || 0,
                security_deposit_status: req.body.security_deposit_status || 'unpaid',
                security_deposit_reference: req.body.security_deposit_reference || null,
                createDatetime: new Date(),
                modifyDatetime: new Date(),
                updated_at: new Date()
            };

            // Backward compatibility: some DBs don't have bookings.user_id.
            try {
                const [cols] = await db.query("SHOW COLUMNS FROM bookings LIKE 'user_id'");
                if (Array.isArray(cols) && cols.length > 0) {
                    booking_values.user_id = loggedInUser.id;
                }
            } catch (schemaErr) {
                console.warn("Could not verify bookings.user_id column; proceeding without user_id:", schemaErr.message);
            }

            const savedBooking = await Booking.save(booking_values);
            const bookingLocalId = savedBooking.id;

            // Save Tariff Info
            const tariff_values = {
                booking_id: bookingLocalId,
                currencyCode: req.body.currencyCode || 'INR',
                totalAmountBeforeTax: calculatedPrices.totalprice_room_only,
                totalTax: calculatedPrices.total_taxes,
                totalAmountAfterTax: calculatedPrices.totalprice_inclusive_all,
                totalDiscount: 0.00,
                totalExtraCharge: Number(calculatedPrices.extra_adults_charges || 0) + Number(calculatedPrices.extra_children_charges || 0),
                totalPayment: calculatedPrices.totalprice_inclusive_all,
                taCommision: 0.00, // Handle commission if needed
                created_at: new Date(),
                updated_at: new Date()
            };
            await Booking.saveBookingTariff(tariff_values);

            // Save Rental Info (Nightly breakdown)
            const numNights = differenceInDays(new Date(check_out_date), new Date(check_in_date));
            const baseRentPerNight = calculatedPrices.base_price_per_night;
            const extraPerNight = calculatedPrices.extra_person_charges_per_night;
            
            for (let i = 0; i < numNights; i++) {
                const effectiveDate = addDays(new Date(check_in_date), i);
                const rental_values = {
                    booking_id: bookingLocalId,
                    effectiveDate: format(effectiveDate, 'yyyy-MM-dd'),
                    adult: number_adults,
                    child: number_children,
                    rent: baseRentPerNight + extraPerNight,
                    rentPreTax: baseRentPerNight + extraPerNight,
                    discount: 0.00,
                    created_at: new Date(),
                    updated_at: new Date()
                };
                await Booking.saveBookingRentalInfo(rental_values);
            }

            // Handle lead guest
            var lead_guest_data = parsedMainGuest;
            lead_guest_data['lead_guest'] = 1;
            lead_guest_data['user_id'] = loggedInUser.id;
            lead_guest_data['role'] = 268;
            lead_guest_data['booking_id'] = bookingLocalId;
            await this.bookingGuests(lead_guest_data);

            // Handle additional guests
            if (req.body.guests) {
                var guests = JSON.parse(req.body.guests);
                for (const guest of guests) {
                    guest['booking_id'] = bookingLocalId;
                    guest['lead_guest'] = 0;
                    guest['role'] = 268;
                    await this.bookingGuests(guest);
                }
            }

            // Get display info for response
            var info = await BookingHelper.getBookingDisplayInfo(uniqueId);

            // Send push notification to property hosts about the new booking
            try {
                const hosts = await hostModel.hostsByProperty(req.body.property_id);
                if (hosts && hosts.length > 0) {
                    const hostIds = hosts.map(host => host.id);
                    const propertyName = dbProp.listing_name || dbProp.name || 'Property';
                    const guestName = `${parsedMainGuest.firstname || ''} ${parsedMainGuest.lastname || ''}`.trim() || 'Guest';
                    
                    await NotificationsController.sendBookingConfirmationNotification(hostIds, {
                        propertyName: propertyName,
                        bookingId: uniqueId,
                        checkIn: req.body.check_in_date,
                        checkOut: req.body.check_out_date,
                        guestName: guestName
                    });
                }
            } catch (notificationError) {
                console.error('Error sending host notifications:', notificationError);
            }

            // Send notification to the guest
            try {
                const propertyName = dbProp.listing_name || dbProp.name || 'Property';
                const guestName = `${parsedMainGuest.firstname || ''} ${parsedMainGuest.lastname || ''}`.trim() || 'Guest';
                await NotificationsController.sendBookingConfirmationNotification([loggedInUser.id], {
                    propertyName: propertyName,
                    bookingId: uniqueId,
                    checkIn: req.body.check_in_date,
                    checkOut: req.body.check_out_date,
                    guestName: guestName
                });
            } catch (guestNotifError) {
                console.error('Error sending guest notifications:', guestNotifError);
            }

            // Clear Redis Cache
            try {
                const CacheService = require('../services/CacheService');
                await CacheService.deleteByPrefix('ezee:');
                await CacheService.delete('home:data_payload');
                console.log('[createBooking] Cleared Redis caches');
            } catch (cacheErr) {
                console.error('[createBooking] Error clearing Redis cache:', cacheErr);
            }

            return Response.success(res, { info: info, booking_id: bookingLocalId }, 200, "Booking created successfully");
        } catch (error) {
            console.error(error);
            return Response.error(res, "ERROR", error.message, 500);
        }
    }

    async pricingCalcs(ezeeProp, number_adults, number_children, property) {
        var webDiscount = await SettingsHelper.webDiscount();
        var extraAdults = number_adults - parseInt(ezeeProp.base_adult_occupancy);
        var extraChildren = number_children - parseInt(ezeeProp.base_child_occupancy);

        var extra_adult_charges = 0;
        var extra_children_charges = 0;
        var price_per_night = Math.round(ezeeProp.room_rates_info.avg_per_night_without_tax * (100 - webDiscount) / 100);

        if (extraAdults > 0) {
            Object.values(ezeeProp.extra_adult_rates_info.exclusive_tax).forEach(value => {
                extra_adult_charges += extraAdults * value;
            });
        }
        if (extraChildren > 0) {
            Object.values(ezeeProp.extra_child_rates_info.exclusive_tax).forEach(value => {
                extra_children_charges += extraChildren * value;
            });
        }

        var number_of_nights = differenceInDays(new Date(property["check_out_date"]), new Date(property["check_in_date"]));
        var base_total_room_charges = price_per_night * number_of_nights;
        var extra_charges_per_night = (extra_adult_charges + extra_children_charges) / number_of_nights;
        var total_per_night = price_per_night + extra_charges_per_night;

        var gstRate = total_per_night <= 7500 ? 0.05 : 0.18;
        var total_room_charges = price_per_night * number_of_nights + extra_adult_charges + extra_children_charges;
        var totalTaxes = total_room_charges * gstRate;

        var prices = {};
        prices["base_price_per_night"] = price_per_night;
        prices["base_total_room_charges"] = base_total_room_charges;
        prices["price_per_night"] = total_per_night;
        prices["extra_person_charges_per_night"] = extra_charges_per_night;
        prices["extra_adults_charges"] = extra_adult_charges;
        prices["extra_children_charges"] = extra_children_charges;
        prices["total_taxes"] = totalTaxes;
        prices["totalprice_room_only"] = total_room_charges;
        prices["totalprice_inclusive_all"] = total_room_charges + totalTaxes;
        prices["gstRate"] = gstRate;
        
        return prices;
    }

    async bookingGuests(guest) {
        try {
            var userValues = {};
            fieldNames['user_fields'].forEach(fieldName => {
                if (Object.hasOwnProperty.bind(guest)(fieldName)) {
                    userValues[fieldName] = guest[fieldName];
                }
            });

            let userId = guest.user_id;
            if (!userId) {
                var userResult = await User.store(userValues);
                userId = userResult.id;
            } else {
                await User.updateUser(userValues, userId);
            }

            // Map and Save to guest_details
            const guestValues = {
                booking_id: guest.booking_id,
                first_name: userValues.firstname,
                last_name: userValues.lastname,
                email: userValues.email,
                mobile: userValues.phone,
                is_lead: guest.lead_guest || 0,
                updated_at: new Date()
            };
            
            await Booking.saveBookingGuests(guestValues);
        } catch (error) {
            console.error("error in bookingGuests consolidation:", error);
        }
    }

    async saveBookerDetails(req, res){
        try {
            const guestId = req.guest?.id;
            if (!guestId) {
                return Response.error(res, "ERROR", "User is not authorized.", 401);
            }

            const bookingId = parseInt(req.body.booking_id || req.body.bookingId, 10);
            const rawName = (req.body.booker_name || req.body.bookerName || '').trim();
            const rawPhone = (req.body.booker_phone || req.body.bookerPhone || '').trim();

            if (!bookingId) {
                return Response.error(res, "ERROR", "Valid booking_id is required", 400);
            }

            let normalizedPhone = '';
            if (rawName || rawPhone) {
                if (!rawName) {
                    return Response.error(res, "ERROR", "Booker name is required", 400);
                }
                if (!rawPhone) {
                    return Response.error(res, "ERROR", "Booker phone is required", 400);
                }

                const compactPhone = rawPhone.replace(/\s+/g, '');
                const hasPlus = compactPhone.startsWith('+');
                const digitsOnly = compactPhone.replace(/[^0-9]/g, '');

                if (digitsOnly.length < 10 || digitsOnly.length > 15) {
                    return Response.error(res, "ERROR", "Phone must include country code and 10 digits", 400);
                }
                normalizedPhone = hasPlus ? `+${digitsOnly}` : digitsOnly;
            }


            const bookingRecord = await Booking.bookingForGuest(bookingId, guestId);
            if (!bookingRecord) {
                return Response.error(res, "ERROR", "Booking not found for this guest", 404);
            }

            await db.query(
                `UPDATE bookings SET booker_name = ?, booker_phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [rawName.slice(0, 255), normalizedPhone.slice(0, 20), bookingId]
            );

            return Response.success(res, {
                booker: {
                    name: rawName,
                    phone: normalizedPhone
                }
            }, 200);
        } catch (error) {
            console.error('Error saving booker details:', error);
            return Response.error(res, "ERROR", error.message || 'Failed to save booker details', 500);
        }
    }

    async createBookingDataString(params,property,guest){
        try {
            const{firstname,lastname,email,phone} = guest;
            var webDiscount = await SettingsHelper.webDiscount();
            var baseRates = await this.commaSeparatedValues(property.room_rates_info.exclusivetax_baserate,webDiscount);
            var extraAdultRates = await this.commaSeparatedValues(property.extra_adult_rates_info.exclusive_tax);
            var extraChildRates = await this.commaSeparatedValues(property.extra_child_rates_info.exclusive_tax);
            return '{"Room_Details":{"Room_1":{"Rateplan_Id":"'+property.roomrateunkid+'","Ratetype_Id":"'+property.ratetypeunkid+'","Roomtype_Id":"'+property.roomtypeunkid+'","baserate":"'+baseRates+'","extradultrate":"'+extraAdultRates+'","extrachildrate":"'+extraChildRates+'","number_adults":"'+ params.number_adults +'","number_children":"'+ params.number_children +'","ExtraChild_Age":"0","Title":"","First_Name":"'+firstname+'","Last_Name":"'+lastname+'","Gender":"","SpecialRequest":""}},"check_in_date":"'+params.check_in_date+'","check_out_date":"'+params.check_out_date+'","Booking_Payment_Mode":"3","Email_Address":"'+email+'","Source_Id":"","MobileNo":"'+phone+'","Address":"","State":"","Country":"","City":"","Zipcode":"","Fax":"","Device":"","Languagekey":"en","paymenttypeunkid":"4058300000000000182"}';
        } catch (error) {
            console.log("error in createBookingDataString");
        }
    }

    async commaSeparatedValues(prop,discountPercentage=0){
        var arrObject = Object.keys(prop).map(function(key) {
            if(discountPercentage && discountPercentage > 0){
                return prop[key] - (prop[key] * discountPercentage / 100);
            }else{
                return prop[key];
            }
        });
        return arrObject.map(item => item).join(',');
    }

    async amountPaidByCustomer(property,adults,children){
        var webDiscount = await SettingsHelper.webDiscount();
        var totalPrice = property.room_rates_info.totalprice_room_only * (100 - webDiscount) / 100;
        
        var extraAdults = adults - parseInt(property.base_adult_occupancy);
        var extraChildren = children - parseInt(property.base_child_occupancy);
        if(extraAdults > 0){
            Object.values(property.extra_adult_rates_info.exclusive_tax).forEach(value => {
                totalPrice += extraAdults * value;
            });
        }
        if(extraChildren > 0){
            Object.values(property.extra_child_rates_info.exclusive_tax).forEach(value => {
                totalPrice += extraChildren * value;
            });
        }
        totalPrice += totalPrice * 0.18;
        return totalPrice;
    }

    async displayInfo(req, res){
        const { id } = req.params;
        const guestId = req.guest?.id || req.user?.id;

        if (!guestId) {
            return Response.error(res, "UNAUTHORIZED", "Please sign in to view this booking.", 401);
        }

        var info = await BookingHelper.getBookingDisplayInfoByLocalId(id);

        if (!info) {
             return Response.error(res, "NOT_FOUND", "Booking not found", 404);
        }

        const bookingRow = info.booking || {};
        const portalUid = bookingRow.user_id;
        if (portalUid == null || Number(portalUid) !== Number(guestId)) {
            return Response.error(res, "FORBIDDEN", "You do not have access to this booking.", 403);
        }

        return Response.success(res, { info:info}, 200);
    }

    async myTrips(req, res){
        try {
            const userId = req.guest.id;
            //const userId = 2179;
            const {trips,occupancy} = await Booking.myTrips(userId);
            //console.log(trips);
            //console.log(trips.map(trip => {return {bucket:`${process.env.AWS_PROPERTY_BUCKET}/${trip.property_id}`, key:trip.media_filename}}));
            const s3Urls = await s3Helper.getFilesFromBucket(
                process.env.AWS_PROPERTY_BUCKET,
                trips.filter(trip => trip.media_filename).map(trip => `${trip.property_id}/${trip.media_filename}`)
            );
            trips.forEach(trip => {
                const s3Url = s3Urls.find(s3Url => s3Url.fileName == `${trip.property_id}/${trip.media_filename}`);
                trip['s3Url'] = s3Url ? s3Url.url : '';
                trip['guests'] = 0;
                const occ = occupancy.find(o => o.booking_id == trip.id);
                if(occ){
                    trip['guests'] = occ.adults + occ.children;
                }
            });
            const cancelled = trips.filter(trip => trip.status == 'Void' || trip.status == 'Cancel');
            const nonCancelled = trips.filter(trip => trip.status != 'Void' && trip.status != 'Cancel');
            const today = format(new Date(), 'yyyy-MM-dd');
            const upcoming = nonCancelled.filter(trip => differenceInDays(trip.start,today) > 0);
            const past = nonCancelled.filter(trip => differenceInDays(trip.end,today) <= 0);
            const ongoing = nonCancelled.filter(trip => differenceInDays(trip.start,today) <= 0 && differenceInDays(trip.end,today) >= 0);
            return Response.success(res, { cancelled, upcoming, past, ongoing }, 200);
        } catch (error) {
            return Response.error(res, "ERROR", "Error while fetching my trips", 400);
        }
    }

    async concierge(req, res){
        try {
            const rawParent = req.body != null && req.body.parent != null ? req.body.parent : 0;
            const parent = Number(rawParent);
            const parentId = Number.isFinite(parent) ? parent : 0;
            let services = await conciergeCatalogModel.listActiveByParent(parentId);
            if (parentId !== 0) {
                services = conciergeCatalogModel.dedupeByName(services);
            }
            return Response.success(res, { services }, 200);
        } catch (error) {
            return Response.error(res, "ERROR", "Error while fetching concierge services", 400);
        }
    }
    
    /** START - Importing Bookings into real booking tables from booking logs */
    async importBookingBulk(req, res){
        const ids = await Booking.getLogsForImport(500);
        for(let i=0;i<ids.length;i++){
            console.log(`Importing: ${ids[i].id}`);
            var success = await this.importBooking(ids[i].id);
            if(success){
                await Booking.markImported(ids[i].id);
            }else{
                console.log("stopping due to error on " +ids[i].id);
                break;
            }
        }
        return Response.success(res, {}, 200);
    }

    async importBooking(id){
        //id = 15127;
        //id = 14588;
        console.log(`\n🔄 Starting importBooking for log ID: ${id}`);
        try {
            const logRecord = await Booking.readBookingLog(id);
            if(!logRecord || !logRecord[0]){
                console.error(`❌ Log record not found for ID: ${id}`);
                await Booking.writeTableEntry('bookings_log_errors',{log_id:id,error:'Log record not found'});
                await Booking.markImported(id,3);
                return false;
            }
            const log = JSON.parse(logRecord[0].log);
            if(!log.data){
                console.error(`❌ Empty booking log data for ID: ${id}`);
                await Booking.writeTableEntry('bookings_log_errors',{log_id:id,error:'Empty Booking Log'});
                await Booking.markImported(id,3);
                return false;
            }
            console.log(`✅ Log data found for ID: ${id}`);
            var booking = await this.bookingFromLog(id);
            const uniqueId = booking.booking.uniqueId;
            if(!uniqueId){
                console.error(`❌ UniqueId missing in booking data for log ID: ${id}`);
                await Booking.writeTableEntry('bookings_log_errors',{log_id:id,error:'UniqueId missing'});
                await Booking.markImported(id,3);
                return false;
            }
            const subBookingId = booking.booking.subBookingId;
            console.log(`🔍 Checking for existing booking: uniqueId=${uniqueId}, subBookingId=${subBookingId}`);
            var existingBooking = await Booking.bookingByEzeeIds(uniqueId,subBookingId);
            var booking_id;
            if(existingBooking && existingBooking.length > 0){
                console.log(`✅ Booking already exists: uniqueId=${uniqueId}, subBookingId=${subBookingId}, booking_id=${existingBooking[0].id}`);
                var dbBooking = {};
                dbBooking['booking'] = existingBooking[0];
                for (const [key] of Object.entries(transactionTables)){
                    const table = transactionTables[key];
                    var single = table.type == 'single';
                    dbBooking[table.tableName] = await Booking.fetchFromTable(table.tableName,'booking_id',dbBooking['booking'].id,single);
                }
                booking_id = dbBooking['booking'].id;
                console.log(`🔄 Comparing and updating existing booking ID: ${booking_id}`);
                await this.compare(booking,dbBooking);
                console.log(`✅ Booking updated successfully: ID=${booking_id}`);
            }else{
                console.log(`📝 Inserting new booking: uniqueId=${uniqueId}, subBookingId=${subBookingId}`);
                try {
                    // Verify booking data before insert
                    if(!booking.booking || Object.keys(booking.booking).length === 0){
                        throw new Error('Booking data is empty');
                    }
                    console.log(`📋 Booking data keys: ${Object.keys(booking.booking).join(', ')}`);
                    booking_id = await Booking.writeTableEntry('bookings',booking.booking);
                    if(!booking_id || booking_id === 0){
                        throw new Error('Failed to get booking ID after insert');
                    }
                    console.log(`✅ Booking inserted successfully: ID=${booking_id}, uniqueId=${uniqueId}`);
                    await this.saveTransactionTables(booking,booking_id);
                    console.log(`✅ Transaction tables saved for booking ID: ${booking_id}`);
                    
                    // Verify the booking was actually saved
                    const verifyBooking = await Booking.bookingByEzeeIds(uniqueId,subBookingId);
                    if(verifyBooking && verifyBooking.length > 0){
                        console.log(`✅ Verified: Booking saved to database with ID: ${verifyBooking[0].id}`);
                    } else {
                        console.error(`❌ Warning: Booking not found after insert! ID: ${booking_id}, uniqueId: ${uniqueId}`);
                    }
                } catch (error) {
                    console.error(`❌ Error inserting booking ${uniqueId}:`, error.message);
                    console.error("Error details:", error);
                    console.error("Error stack:", error.stack);
                    throw error; // Re-throw to be caught by outer try-catch
                }
            }
            await this.updateLeadGuest(booking_id,booking.booking.guest_id);
            console.log(`✅ Import completed successfully for log ID: ${id}, booking_id: ${booking_id}`);
            return true;
        } catch (error) {
            console.error(`❌ Error in importBooking for log ID ${id}:`, error.message);
            console.error("Full error:", error);
            console.error("Error stack:", error.stack);
            await Booking.writeTableEntry('bookings_log_errors',{
                log_id:id,
                error: error.message || String(error)
            });
            return false;
        }
    }

    async bookingFromLog(id){
        const logRecord = await Booking.readBookingLog(id);
        const log = JSON.parse(logRecord[0].log);
        const reservations = log.data.Reservations;
        const reservation0 = reservations.Reservation[0];
        const bookingTran = reservation0.BookingTran[0];
        bookingTran.property_id = 0;
        const property = await Property.getByEzeeId(bookingTran.RoomTypeCode);
        if(property){
            bookingTran.property_id = property.id;
        }
        bookingTran.guest_id = await this.guestFromLog(bookingTran,reservation0);
        //bookingTran.guest_id = guest.id;
        var extraFields = {lastOperation:log.operation};
        var booking = {}
        booking['booking'] = Object.assign(await this.createFromLog(reservation0,"bookings"), await this.createFromLog(bookingTran,"bookings",extraFields),await this.createFromLog(log,"bookings"));
        booking = await this.compileTransactionsTables(booking,bookingTran);
        return booking;
    }

    async guestFromLog(log,res=null){
        var guest = {};
        guest['salutation'] = log.Salutation;
        guest['firstname'] = log.FirstName;
        guest['lastname'] = log.LastName;
        //guest['date_of_birth'] = log.DateOfBirth;
        guest['address_line_1'] = log.Address;
        guest['city'] = log.City;
        guest['state'] = log.State;
        guest['postcode'] = log.Zipcode;
        guest['role'] = 268;
        guest['phone'] = '';
        var mobile = log.Mobile && log.Mobile != '';
        var phone = log.Phone && log.Phone != '';
        if(!mobile && !phone){
            mobile = res.Mobile && res.Mobile != '';
            phone = res.Phone && res.Phone != '';
        }
        if(mobile || phone){
            if(mobile){
                guest['phone'] = await this.prunePhoneNumber(log.Mobile);
                if(phone){
                    guest['phone1'] = await this.prunePhoneNumber(log.Phone);
                }
            }else{
                guest['phone'] = await this.prunePhoneNumber(log.Phone);
            }
        }
        var existingGuest = await Booking.guestFromPhone(guest['phone'],guest['phone1']);
        if(existingGuest && existingGuest.length > 0){
            guest = await Booking.updateBookingTable('users',guest,existingGuest[0].id);
            return existingGuest[0].id;
        }else{
            console.log('NO guest');
            guest = await User.store(guest);
            return guest.id;
        }
    }

    async prunePhoneNumber(number){
        number = number.replaceAll(" ","");
        number = number.replaceAll("-","");
        return number;
    }
    async compare(booking,dbBooking){
        var updates = [];
        updates = await this.compareSingle(booking['booking'],dbBooking['booking'],'bookings',updates);
        for (const [key] of Object.entries(transactionTables)) {
            const table = transactionTables[key];
            if(table.type == 'single'){
                updates = await this.compareSingle(booking[table.tableName],dbBooking[table.tableName],table.tableName,updates);
            }else{
                //console.log(table.tableName);
                await this.compareMultiple(booking[table.tableName],dbBooking[table.tableName],bookingTables[table.tableName],table.tableName,dbBooking.booking.id);
            }
        }
        for(let i=0;i<updates.length;i++){
            var update = updates[i];
            if(update.table == 'bookings'){
                await Booking.updateBookingTable('bookings',update.values,update.id);
            }else{
                await Booking.updateBookingTable(update.table,update.values,update.id);
            }
        }
    }

    async updateLeadGuest(booking_id, guest_id) {
        const [[user]] = await db.query('SELECT firstname, lastname, email, phone FROM users WHERE id = ?', [guest_id]);
        if (!user) return;

        const [leadGuests] = await db.query('SELECT id FROM guest_details WHERE booking_id = ? AND is_lead = 1', [booking_id]);

        const guestData = {
            first_name: user.firstname,
            last_name: user.lastname,
            email: user.email,
            mobile: user.phone,
            is_lead: 1,
            updated_at: new Date()
        };

        if (leadGuests && leadGuests.length > 0) {
            await db.query('UPDATE guest_details SET ? WHERE id = ?', [guestData, leadGuests[0].id]);
        } else {
            await db.query('INSERT INTO guest_details SET ?', { ...guestData, booking_id });
        }
    }

    async compareSingle(logTable,dbTable,table,updates){
        console.log(`Comparing ${table}`);
        //console.log(logTable);
        //console.log(dbTable);
        if(!dbTable){
            return updates
        }
        var changed = false;
        var changes = {};
        const fieldMappings = bookingTables[table];
        for (const [key] of Object.entries(fieldMappings)){
            //console.log(`Field: ${key}=> db: ${dbTable[key]} log: ${logTable[key]}`);
            if(key == 'property_id' && !logTable[key]){
                continue;
            }
            if(dbTable[key] != logTable[key]){
                changes[key] = logTable[key];
                //console.log(`value of ${key} changed from ${dbTable[key]} to ${logTable[key]}`);
                changed = true;
            }
        }
        if(changed){
            console.log("--%% changes %%--");
            console.log(changes);
            updates.push({type:'update',table:table,id:dbTable.id,values:changes});
        }
        return updates;
    }

    areRecordsEqual(logTable,dbTable,fieldMappings){
        for (const [key] of Object.entries(fieldMappings)){
            if(dbTable[key] != logTable[key]){
                return false;
            }
        }
        return true;
    }

    async compareMultiple(logTable,dbTable,fieldMappings,table,booking_id){
        //console.log(fieldMappings);
        if(logTable.length != dbTable.length){
            if(dbTable.length > 0){
                await Booking.deleteFromBookingTable(table,booking_id);
            }
            if(logTable.length > 0){
                for(let i=0;i<logTable.length;i++){
                    var logRecord = logTable[i];
                    logRecord['booking_id'] = booking_id;
                    await Booking.writeTableEntry(table,logRecord);
                }
            }
        }else{
            for(let i=0;i<logTable.length;i++){
                var matched=false;
                for(let j=0;j<dbTable.length;j++){
                    if(this.areRecordsEqual(logTable[i],dbTable[j],fieldMappings)){
                        matched = true;
                        break;
                    }
                }
                if(!matched){
                    if(dbTable.length > 0){
                        await Booking.deleteFromBookingTable(table,booking_id);
                    }
                    if(logTable.length > 0){
                        for(let i=0;i<logTable.length;i++){
                            var logRecord = logTable[i];
                            logRecord[booking_id] = booking_id;
                            await Booking.writeTableEntry(table,logRecord);
                        }
                    }
                }
            }
        }
    }

    async compileTransactionsTables(booking,bookingTran){
        for (const [key] of Object.entries(transactionTables)) {
            const table = transactionTables[key];
            booking[table.tableName] = [];
            if(table.type == 'single'){
                //booking[table.tableName].push(await this.createFromLog(bookingTran,table.tableName));
                booking[table.tableName] = await this.createFromLog(bookingTran,table.tableName);
            }else{
                booking[table.tableName] = await this.createMultiple(bookingTran[table.logElement],table.tableName);
            }
        }
        return booking;
    }

    async saveTransactionTables(booking,booking_id){
        for (const [key] of Object.entries(transactionTables)){
            const table = transactionTables[key];
            const set = booking[table.tableName];

            if(table.type == 'single'){
                if(Object.keys(set).length > 0){//save only if non empty object
                    set['booking_id'] = booking_id;
                    await Booking.writeTableEntry(table.tableName,set);
                }
            }else{
                for(let i=0;i<set.length;i++){
                    const record = set[i];
                    if(Object.keys(record).length > 0){//save only if non empty object
                        record['booking_id'] = booking_id;
                        await Booking.writeTableEntry(table.tableName,record);
                    }
                }
            }
            
        }
    }

    async createMultiple(log,table,extraFields=null){
        //console.log("inside createMultiple");
        var records = [];
        if(!log){
            console.log(`No ${table} found`);
            return records;
        }
        for(let i=0;i<log.length; i++){
            records[i] = await this.createFromLog(log[i],table,extraFields);
        }
        return records;
    }

    async createFromLog(bookingFromLog,table,extraFields=null){
        const fieldMappings = bookingTables[table];
        var record = {};
        for (const [key, value] of Object.entries(fieldMappings)) {
            if(bookingFromLog[value]){
                record[key] = bookingFromLog[value];
            }
        }
        if(extraFields){
            for (var fieldName in extraFields) {
                record[fieldName] = extraFields[fieldName];
            }
        }
        return record;
    }
    /** END - Importing Bookings into real booking tables from booking logs */

    /** START - Admin panel booking screen functions */
    async bookingsList(req,res){
        try {
            const bookings = await Booking.adminBookingsList();
            console.log("Bookings Listankit:", bookings);
            await res.render('bookings/list.ejs', { bookings });
        } catch (error) {
            console.error(error);
            return Response.error(res, "ERROR", "Internal server error", 500);
        }
    }

    async manageBookingsList(req,res){
        try {
            const bookings = await Booking.adminManageBookingsList();
            bookings.forEach(booking => {
                booking['nights'] = differenceInDays(new Date(booking.end),new Date(booking.start));
                booking['price_per_night'] = (booking.totalAmountBeforeTax / booking.nights).toFixed(2);
                booking['net_booking_amount'] = booking.totalAmountBeforeTax - booking.taCommision;
            });
            await res.render('bookings/bookings.ejs', { bookings });
        } catch (error) {
            console.error(error);
            return Response.error(res, "ERROR", "Internal server error", 500);
        }
    }

    async bookingDetails(req,res){
        const { id } = req.params;//3350
        try {
            const booking = await SMModel.getRowByUniqueId('bookings',id);
            
            if (!booking) {
                return Response.error(res, "ERROR", "Booking not found", 404);
            }
            
            booking['formated_reservation_date'] = booking.createDatetime ? format(booking.createDatetime, 'dd/MM/yyyy') : 'N/A';
            booking['formated_start_date'] = booking.start ? format(booking.start, 'dd/MM/yyyy') : 'N/A';
            booking['formated_end_date'] = booking.end ? format(booking.end, 'dd/MM/yyyy') : 'N/A';
            booking['nights'] = booking.start && booking.end ? differenceInDays(booking.end,booking.start) : 0;
            
            const user = booking.guest_id ? await SMModel.getRowByUniqueId('users',booking.guest_id) : null;
            let property = null;
            let property_type = null;
            let destination = null;
            let amenities = [];
            
            // Only fetch property if property_id is valid (> 0)
            if (booking.property_id && booking.property_id > 0) {
                property = await SMModel.getRowByUniqueId('properties',booking.property_id);
                if (property) {
                    amenities = await Property.aminitiesByProperty(booking.property_id);
                    property_type = await Setting.display('property_type',property.property_type);
                    if (property.destination) {
                        destination = await SMModel.getRowByUniqueId('destinations',property.destination);
                    }
                }
            }
            
            const registration = await SMModel.getRowByUniqueId('booking_registrations',id,'booking_id');
            const rental = booking.start ? await SMModel.getFromTable('booking_rentalInfo',{booking_id:id,effectiveDate:format(booking.start, 'yyyy-MM-dd')}) : [];
            
            await res.render('bookings/edit.ejs', {
                booking,
                user: user || {},
                property: property || {},
                registration: registration || {},
                rental: rental && rental.length > 0 ? rental[0] : {},
                amenities: amenities || [],
                property_type: property_type || 'N/A',
                destination: destination ? destination.name : 'N/A'
            });
        } catch (error) {
            console.error('Booking Details Error:', error);
            return Response.error(res, "ERROR", "Error while fetching details", 400);
        }
    }

    async adjustPrices(req,res){
        const { id } = req.params;
        try {
            const booking = await Booking.bookingWithPricing(id);
            await res.render('bookings/adjust.ejs', {booking});
        } catch (error) {
            console.log(error);
            return Response.error(res, "ERROR", "Error while fetching details", 400);
        }
    }
    /** END - Admin panel booking screen functions */

    /** START - block and unblock properties */
    async block(req,res){
        try {
            const {property_id,start,end,reason,blockType} = req.body;
            if(!req.guest && !req.user){
                return Response.error(res, "ERROR", "Request not allowed!", 400);
            }
            var userId;
            if(req.guest){
                userId = req.guest.id || 0;
            }else{
                userId = req.user.id || 0;
            }

            if(await Utility.checkEmpty({property_id, userId, start, end, blockType})){
                return Response.error(res, "ERROR", "One or more mandatory parameters missing!", 400);
            }

            if (!reason || reason.trim() === '') {
                return Response.error(res, "ERROR", "Reason for blocking is required!", 400);
            }

            console.log("property_id",property_id);

            // First, validate and fix property inventory if needed
            console.log(`Validating property ${property_id} inventory...`);
            const inventoryValidation = await roomService.validateAndFixPropertyInventory(property_id);
            
            if (!inventoryValidation.success) {
                console.log(`Failed to validate/fix inventory for property ${property_id}:`, inventoryValidation.error);
                return Response.error(res, "ERROR", `Property inventory validation failed: ${inventoryValidation.error}`, 400);
            }

            // Get updated inventory
            const inventories = await Property.select('property_inventory',{property_id:property_id});
            console.log("inventories",inventories);
            console.log("inventories length",inventories ? inventories.length : 0);
            
            // Check if there are any rooms in inventory
            if (!inventories || inventories.length === 0) {
                console.log(`No rooms found in inventory for property ${property_id}`);
                return Response.error(res, "ERROR", "No rooms available for blocking. Please contact administrator to set up room inventory.", 400);
            }
            
            // Filter out invalid/default room entries
            const validInventories = inventories.filter(inventory => 
                inventory.room_id && 
                inventory.room_type_id && 
                inventory.room_id !== 'default_room' && 
                inventory.room_type_id !== 'default_room_type' &&
                inventory.room_id.trim() !== '' &&
                inventory.room_type_id.trim() !== '' &&
                inventory.room_id.startsWith('40583') // Ensure it's a valid Ezee room ID
            );
            
            if (validInventories.length === 0) {
                console.log(`No valid Ezee room IDs found in inventory for property ${property_id}`);
                return Response.error(res, "ERROR", "Property room inventory is not properly configured with Ezee room IDs. Please contact administrator to set up valid room inventory.", 400);
            }
            
            const params = [];
            for(let i=0;i<validInventories.length;i++){
                const inventory = validInventories[i];
                
                // Map user reason to Ezee-compatible reason codes
                // Ezee PMS has predefined reason codes, so we need to map user input to valid ones
                let ezeeReason = this.mapToEzeeReasonCode(reason, blockType);
                console.log(`Reason mapping: "${reason}" + "${blockType}" -> "${ezeeReason}"`);
                
                const param = {
                    RoomID:inventory.room_id,
                    RoomtypeID:inventory.room_type_id,
                    FromDate:start,
                    ToDate:end,
                    Reason: ezeeReason
                }; 
                params.push(param);
            }
            console.log(params);
            
            // Call external PMS to block property with retry for 500 errors
            let ezeeResponse;
            let retryCount = 0;
            const maxRetries = 2;
            let ezeeSuccess = false;
            
            while (retryCount <= maxRetries) {
                ezeeResponse = await this.ezeeHelper.blockProperty(params);
                console.log("ezeeResponse",ezeeResponse);
                console.log("ezeeResponse.params ----->>>>>",params);
                
                // If successful or not a 500 error, break out of retry loop
                if (!ezeeResponse || ezeeResponse.status !== 500) {
                    ezeeSuccess = true;
                    break;
                }
                
                retryCount++;
                if (retryCount <= maxRetries) {
                    console.log(`Ezee 500 error, retrying... (${retryCount}/${maxRetries})`);
                    // Wait 1 second before retry
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
            // If Ezee is consistently failing, proceed with local blocking only
            if (!ezeeSuccess) {
                console.log('Ezee PMS is experiencing issues. Proceeding with local blocking only...');
            }
            
            // Check if ezeeResponse is valid - but allow fallback if Ezee is down
            if (!ezeeResponse || !ezeeResponse.data) {
                console.log('Invalid response from ezeeHelper.blockProperty:', ezeeResponse);
                if (!ezeeSuccess) {
                    console.log('Ezee PMS is down, proceeding with local blocking only...');
                    // Continue with local blocking instead of failing
                } else {
                    return Response.error(res, "ERROR", "Unable to connect to the PMS system. Please check your internet connection and try again.", 500);
                }
            }
            
            // Extract status and data from ezeeResponse if available
            let status, data;
            if (ezeeResponse && ezeeResponse.data) {
                status = ezeeResponse.status;
                data = ezeeResponse.data;
                
                // Check for HTTP errors (like 500 from Ezee)
                if (status >= 400) {
                    console.log('External PMS HTTP error:', status, data);
                    
                    // If Ezee is failing, proceed with local blocking only
                    if (!ezeeSuccess) {
                        console.log('Ezee PMS is down, proceeding with local blocking only...');
                        // Continue with local blocking instead of failing
                    } else {
                        // Handle specific Ezee 500 errors
                        if (status === 500) {
                            // Check if it's the specific count() error we're seeing
                            if (data && data.Errors && data.Errors.ErrorMessage && 
                                data.Errors.ErrorMessage.includes('count(): Argument #1 ($value) must be of type Countable|array, string given')) {
                                return Response.error(res, "ERROR", "The PMS system is experiencing technical difficulties. Please try again in a few minutes or contact support if the issue persists.", 500);
                            } else {
                                return Response.error(res, "ERROR", "The PMS system is temporarily unavailable. Please try again in a few minutes.", 503);
                            }
                        } else if (status === 408 || status === 504) {
                            return Response.error(res, "ERROR", "Request timed out. Please try again.", 408);
                        } else {
                            return Response.error(res, "ERROR", "Failed to communicate with external system. Please try again.", 500);
                        }
                        return;
                    }
                }
            }
            
            // Check for errors in the response data - but allow fallback if Ezee is down
            if (ezeeResponse && ezeeResponse.data && data && data.Errors && data.Errors.ErrorCode && data.Errors.ErrorCode != 0) {
                console.log('External PMS error:', data.Errors.ErrorMessage);
                
                // If Ezee is failing, proceed with local blocking only
                if (!ezeeSuccess) {
                    console.log('Ezee PMS is down, proceeding with local blocking only...');
                    // Continue with local blocking instead of failing
                } else {
                    // Check if it's a reason code error and provide helpful message
                    if (data.Errors.ErrorMessage && data.Errors.ErrorMessage.includes('Room block reason is not available')) {
                        return Response.error(res, "ERROR", "The reason you provided is not recognized by the PMS system. Please try using: Maintenance, Owner Block, Out of Order, or Emergency.", 400);
                    } else {
                        return Response.error(res, "ERROR", `External system error: ${data.Errors.ErrorMessage}`, 400);
                    }
                }
            }
            
            // Only check status if we have a valid Ezee response
            if (ezeeResponse && ezeeResponse.data && ezeeResponse.status != 200) {
                console.log('External PMS returned non-200 status:', ezeeResponse.status);
                if (!ezeeSuccess) {
                    console.log('Ezee PMS is down, proceeding with local blocking only...');
                    // Continue with local blocking instead of failing
                } else {
                    return Response.error(res, "ERROR", "Failed to block property in external system. Please try again.", 500);
                    return;
                }
            }
            const blocks = [];
            const datesToBeBlocked = eachDayOfInterval({
                start: start,
                end: end
              });
            for(let i=0;i<inventories.length;i++){
                const inventory = inventories[i];
                const booking = {
                    uniqueId:0,
                    subBookingId:0,
                    property_id:property_id,
                    roomTypeCode:inventory.room_type_id,
                    roomId:inventory.room_id,
                    start:start,
                    end:end,
                    currentStatus:'Block',
                    status:blockType,
                    comment: reason,
                    guest_id: 0,
                    isConfirmed:0,
                    arrivalTime:0,
                    departureTime:0,
                    bookedBy:0,
                    isChannelBooking:0
                }
                const block_id = await Booking.insert('bookings',booking);
                for(let j=0;j<datesToBeBlocked.length;j++){
                    const effectiveDate = format(datesToBeBlocked[j], 'yyyy-MM-dd');
                    await Booking.insert('booking_rentalInfo',{booking_id:block_id,effectiveDate:effectiveDate});
                    await Booking.insert('temp_RentalInfo',{block_id: block_id,uniqueId:0,subBookingId:0,EffectiveDate:effectiveDate,RoomTypeCode:inventory.room_type_id,RoomId:inventory.room_id,Discount:0.0,Rent:0,Adult:0,Child:0,PackageCode:0,PackageName:0,RoomTypeName:0});
                }
                blocks.push({block_id,property:inventory.room_type_id,start,end,room_id:inventory.room_id,blockType});
            }
            // Calculate potential revenue loss
            const revenueLoss = await this.calculateRevenueLoss(property_id, start, end);
            
            // Prepare success message
            let successMessage = `Dates blocked successfully. Potential revenue loss: ₹${revenueLoss.totalLoss}`;
            if (!ezeeSuccess) {
                successMessage = `Dates blocked successfully (local only - PMS system is temporarily unavailable). Potential revenue loss: ₹${revenueLoss.totalLoss}`;
            }
            
            // Clear Redis Cache
            try {
                const CacheService = require('../services/CacheService');
                await CacheService.deleteByPrefix('ezee:');
                await CacheService.delete('home:data_payload');
                console.log('[blockProperty] Cleared Redis caches');
            } catch (cacheErr) {
                console.error('[blockProperty] Error clearing Redis cache:', cacheErr);
            }

            return Response.success(res, { 
                blocks,
                revenueLoss: revenueLoss,
                message: successMessage 
            }, 200);
        } catch (error) {
            console.log(error);
            return Response.error(res, "ERROR", "Error while blocking property", 400);
        }
    }

    async unblock(req,res){
        try {
            const {block_id} = req.body;
            if(!block_id){
                console.log("block_id missing");
                return Response.error(res, "ERROR", "Mandatory parameters missing or incorrect!", 400);
            }
            console.log("block_id found");
            const block = await Booking.find('bookings',{id:block_id, currentStatus:'Block'});
            if(!block){
                console.log("block missing");
                return Response.error(res, "ERROR", "Block not found", 404);
            }
            console.log("block found");
            const params = [];
            const param = {
                RoomID:block.roomId,
                RoomtypeID:block.roomTypeCode,
                FromDate: format(block.start, 'yyyy-MM-dd'),
                ToDate: format(block.end, 'yyyy-MM-dd'),
                Reason: block.status
            };
            params.push(param);

            // Try Ezee unblock with retry for 500 errors
            let ezeeResponse;
            let retryCount = 0;
            const maxRetries = 2;
            let ezeeSuccess = false;
            
            while (retryCount <= maxRetries) {
                ezeeResponse = await this.ezeeHelper.unblockProperty(params);
                console.log("data after ezee call");
                console.log(ezeeResponse);
                
                // If successful or not a 500 error, break out of retry loop
                if (!ezeeResponse || ezeeResponse.status !== 500) {
                    break;
                }
                
                retryCount++;
                if (retryCount <= maxRetries) {
                    console.log(`Ezee 500 error during unblock, retrying... (${retryCount}/${maxRetries})`);
                    // Wait 1 second before retry
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
            // If Ezee is consistently failing, proceed with local unblocking only
            if (!ezeeSuccess) {
                console.log('Ezee PMS is experiencing issues during unblock. Proceeding with local unblocking only...');
            }
            
            // Check Ezee response only if we have a valid response
            if (ezeeResponse && ezeeResponse.data) {
                const {status, data} = ezeeResponse;
                
                if(data.Errors.ErrorCode && data.Errors.ErrorCode != 0){
                    // Check if it's the "no block" error (expected when block was created locally only)
                    if (data.Errors.ErrorMessage && data.Errors.ErrorMessage.includes('There is no block on this room')) {
                        console.log('Block was created locally only, proceeding with local unblock...');
                        ezeeSuccess = false; // We'll proceed with local unblock
                    } else if (!ezeeSuccess) {
                        console.log('Ezee PMS is down, proceeding with local unblocking only...');
                        // Continue with local unblocking instead of failing
                    } else {
                        return Response.error(res, "ERROR", data.Errors.ErrorMessage, 400);
                        return;
                    }
                } else if (status === 200) {
                    ezeeSuccess = true;
                }
                
                if(status != 200){
                    if (!ezeeSuccess) {
                        console.log('Ezee PMS is down, proceeding with local unblocking only...');
                        // Continue with local unblocking instead of failing
                    } else {
                        return Response.error(res, "ERROR", "Error while unblocking property", 500);
                        return;
                    }
                }
            }
            // Calculate revenue recovery
            const revenueRecovery = await this.calculateRevenueLoss(block.property_id, format(block.start, 'yyyy-MM-dd'), format(block.end, 'yyyy-MM-dd'));
            
            await Booking.delete('bookings',{id:block_id});
            await Booking.delete('booking_rentalInfo',{booking_id:block_id});
            await Booking.delete('temp_RentalInfo',{block_id:block_id});
            
            // Prepare success message
            let successMessage = `Dates unblocked successfully. Potential revenue recovery: ₹${revenueRecovery.totalLoss}`;
            if (!ezeeSuccess) {
                successMessage = `Dates unblocked successfully (local only - PMS system is temporarily unavailable). Potential revenue recovery: ₹${revenueRecovery.totalLoss}`;
            }
            
            // Clear Redis Cache
            try {
                const CacheService = require('../services/CacheService');
                await CacheService.deleteByPrefix('ezee:');
                await CacheService.delete('home:data_payload');
                console.log('[unblockProperty] Cleared Redis caches');
            } catch (cacheErr) {
                console.error('[unblockProperty] Error clearing Redis cache:', cacheErr);
            }

            return Response.success(res, { 
                revenueRecovery: revenueRecovery,
                message: successMessage
            }, 200);
        } catch (error) {
            console.log(error);
            return Response.error(res, "ERROR", "Error while unblocking property", 400); 
        }
    }
    /** END - block and unblock properties */

    async bookingDetailsForHost(req,res){
        const { booking_id } = req.body;
        try {
            const {booking,rentalInfo,tariff,property,guest} = await Booking.bookingDetailsForHost(booking_id);
            return Response.success(res, {booking,rentalInfo,tariff,property,guest}, 200);
        } catch (error) {
            console.log(error);
            return Response.error(res, "ERROR", "Error while fetching details", 400);
        }
    }

    async removeBlock(req,res){
        const { id } = req.params;
        try {
            const booking = await Booking.bookingWithPricing(id);
            if(!booking){
                return Response.error(res, "ERROR", "Booking not found", 404);
            }
            await Booking.delete('bookings',{id});
            await Booking.delete('booking_rentalInfo',{booking_id:id});
            await Booking.delete('temp_RentalInfo',{block_id:id});
            return Response.success(res, {}, 200);
        } catch (error) {
            console.log(error);
            return Response.error(res, "ERROR", "Error while removing block", 400);
        }
    }

    // Calculate potential revenue loss for blocked dates
    async calculateRevenueLoss(propertyId, startDate, endDate) {
        try {
            // Get property details
            const property = await Property.find('properties', { id: propertyId });
            if (!property) {
                return { totalLoss: 0, dailyBreakdown: [], averageRate: 0 };
            }

            // Get historical pricing data for similar dates
            const historicalData = await Booking.getHistoricalPricing(propertyId, startDate, endDate);
            
            // Calculate number of nights
            const startDateObj = new Date(startDate);
            const endDateObj = new Date(endDate);
            const timeDiff = endDateObj.getTime() - startDateObj.getTime();
            const numberOfNights = Math.ceil(timeDiff / (1000 * 3600 * 24));

            let totalLoss = 0;
            let averageRate = 0;
            const dailyBreakdown = [];

            if (historicalData && historicalData.length > 0) {
                // Use historical average
                averageRate = historicalData.reduce((sum, record) => sum + record.avgRate, 0) / historicalData.length;
            } else {
                // Fallback to market average or property base rate
                averageRate = await this.getMarketAverageRate(propertyId);
            }

            // Calculate daily breakdown
            for (let i = 0; i < numberOfNights; i++) {
                const currentDate = new Date(startDateObj);
                currentDate.setDate(startDateObj.getDate() + i);
                
                // Apply seasonal adjustments
                const seasonalMultiplier = this.getSeasonalMultiplier(currentDate);
                const dailyRate = Math.round(averageRate * seasonalMultiplier);
                
                totalLoss += dailyRate;
                dailyBreakdown.push({
                    date: currentDate.toISOString().split('T')[0],
                    potentialRate: dailyRate,
                    dayOfWeek: currentDate.toLocaleDateString('en-US', { weekday: 'long' })
                });
            }

            return {
                totalLoss: Math.round(totalLoss),
                averageRate: Math.round(averageRate),
                numberOfNights,
                dailyBreakdown,
                propertyName: property.listing_name
            };

        } catch (error) {
            console.error('Error calculating revenue loss:', error);
            return { totalLoss: 0, dailyBreakdown: [], averageRate: 0 };
        }
    }

    // Get market average rate for property
    async getMarketAverageRate(propertyId) {
        try {
            const property = await Property.find('properties', { id: propertyId });
            // Use property-specific base rate or market average
            // This could be enhanced with more sophisticated pricing logic
            return property?.base_price || 3000; // Default fallback rate
        } catch (error) {
            return 3000; // Default fallback rate
        }
    }

    // Apply seasonal multipliers
    getSeasonalMultiplier(date) {
        const month = date.getMonth() + 1; // 1-12
        const dayOfWeek = date.getDay(); // 0-6 (Sunday = 0)
        
        let multiplier = 1.0;
        
        // Seasonal adjustments
        if (month >= 11 || month <= 2) { // Winter season
            multiplier *= 1.2;
        } else if (month >= 6 && month <= 8) { // Summer season
            multiplier *= 1.1;
        }
        
        // Weekend premium
        if (dayOfWeek === 5 || dayOfWeek === 6) { // Friday, Saturday
            multiplier *= 1.15;
        }
        
        return multiplier;
    }

    // Public API: estimate revenue loss for a block window (no side effects)
    async revenueLossEstimate(req, res) {
        try {
            const { property_id, start, end } = req.body;

            // --- Required Params ---
            if (!property_id || !start || !end) {
                return Response.error(res, "ERROR", "Mandatory parameters missing or incorrect!", 400);
            }

            // --- Date Validation ---
            const startDate = new Date(start);
            const endDate = new Date(end);

            if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
                return Response.error(res, "ERROR", "Invalid date format", 400);
            }

            if (endDate < startDate) {
                return Response.error(res, "ERROR", "End date cannot be before start date", 400);
            }

            // --- Normalize Dates ---
            const normalizedStart = format(startDate, 'yyyy-MM-dd');
            const normalizedEnd = format(endDate, 'yyyy-MM-dd');

            // --- Calculate Loss (use live Ezee pricing like availabilityAndDetails) ---
            const revenueLoss = await this.calculateRevenueLossFromEzee(property_id, normalizedStart, normalizedEnd);

            // --- Normalize Response Structure ---
            const totalLoss =
                revenueLoss?.totalLoss ??
                revenueLoss?.estimatedLoss ??
                revenueLoss?.estimated_loss ??
                revenueLoss?.loss ??
                0;

            return Response.success(res, {
                estimatedLoss: typeof totalLoss === "number" ? totalLoss : 0,
                revenueLoss,
                meta: {
                    property_id,
                    start: normalizedStart,
                    end: normalizedEnd
                }
            }, 200);

        } catch (error) {
            console.error("❌ Error estimating revenue loss:", error);

            return Response.error(res, "ERROR", "Error calculating revenue loss", 500);
        }
    }

    // Ezee-driven revenue loss using live avg_per_night_without_tax (with web discount)
    async calculateRevenueLossFromEzee(propertyId, startDate, endDate) {
        try {
            const property = await Property.find('properties', { id: propertyId });
            if (!property || !this.ezeeHelper || !property.channel_id) {
                return null;
            }

            const startObj = new Date(startDate);
            const endObj = new Date(endDate);

            // Align with availabilityAndDetails: nights are check-in inclusive, check-out exclusive
            const endExclusive = addDays(endObj, -1);
            if (endExclusive < startObj) {
                return null;
            }

            const stayNights = eachDayOfInterval({ start: startObj, end: endExclusive });
            if (stayNights.length === 0) {
                return null;
            }

            const ezeeResp = await this.ezeeHelper.getProperty({
                check_in_date: startDate,
                check_out_date: endDate,
                roomtypeunkid: property.channel_id
            });
            const ezeeProp = ezeeResp?.property;
            const baseRate = ezeeProp?.room_rates_info?.avg_per_night_without_tax;
            if (!baseRate || Number.isNaN(baseRate)) {
                return null;
            }

            const webDiscount = await SettingsHelper.webDiscount();
            const pricePerNight = Math.round(baseRate * (100 - webDiscount) / 100);

            const dailyBreakdown = stayNights.map(date => ({
                date: format(date, 'yyyy-MM-dd'),
                potentialRate: pricePerNight,
                dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'long' })
            }));

            const totalLoss = pricePerNight * stayNights.length;

            return {
                totalLoss: Math.round(totalLoss),
                averageRate: Math.round(pricePerNight),
                numberOfNights: stayNights.length,
                dailyBreakdown,
                propertyName: property.listing_name,
                source: 'ezee'
            };
        } catch (error) {
            console.log('Ezee revenue loss calc failed, falling back', error?.message || error);
            return null;
        }
    }

    // Get guest details for logged in user or via secureId
    async getGuestDetails(req, res) {
        try {
            const userObj = req.user;
            let userId = userObj?.id || userObj?.user?.id;
            
            const secureId = req.query.secureId || req.headers['x-secure-id'];
            let bookingId = req.query.bookingId;
            let bookingGuestId = null;

            if (secureId) {
                const decoded = decodeSecureGuestId(secureId);
                if (decoded) {
                    bookingId = decoded.tripId;
                    bookingGuestId = decoded.guestId;
                }
            }

            const queryGuestId = req.query.guestId || req.query.guestDetailsId;
            const perStayGuestId = bookingGuestId || queryGuestId || null;

            if (!userId && !bookingId) {
                return Response.error(res, "ERROR", "Unauthorized - Invalid token or secure link. Please login or use a valid link.", 401);
            }

            console.log('=== getGuestDetails API Called (BookingsController) ===');

            // 1. Get user basic info if userId exists
            let userData = { id: null, firstname: '', lastname: '', email: '', phone: '' };
            if (userId) {
                const [userRows] = await db.query(
                    "SELECT id, firstname, lastname, email, phone, city FROM users WHERE id = ?", 
                    [userId]
                );
                if (userRows && userRows.length > 0) {
                    userData = userRows[0];
                }
            }

            // 2. Get permanent profile from guest_details table
            let guestRows = [];
            if (bookingId) {
                [guestRows] = await db.query("SELECT * FROM guest_details WHERE booking_id = ? AND is_lead = 1", [bookingId]);
            }
            
            let guestData = guestRows && guestRows.length > 0 ? guestRows[0] : null;

            // 2b. If we have a specific per-stay guest ID, look it up in guest_details
            const finalBookingId = bookingId || req.query.bookingId;
            if (finalBookingId && perStayGuestId) {
                const [infoRows] = await db.query(`
                    SELECT * FROM guest_details 
                    WHERE id = ? AND booking_id = ?
                `, [perStayGuestId, finalBookingId]);
                
                if (infoRows && infoRows.length > 0) {
                    guestData = infoRows[0];
                }
            }

            // 3. Get stay-specific identifiers and data from bookings
            let bookingData = null;
            let tariffData = null;
            // finalBookingId already computed above

            if (finalBookingId) {
                const [bookingRows] = await db.query(
                    `SELECT b.id, b.declaration, b.gst_bill, b.gst_number, b.business_name,
                            b.stayed_before, b.purpose_of_visit, b.group_type,
                            b.esign_status, b.esign_request_id, b.guest_id, b.user_id,
                            b.security_deposit, b.security_deposit_paid,
                            b.security_deposit_status, b.security_deposit_reference,
                            p.security_deposit_percentage
                     FROM bookings b
                     LEFT JOIN booking_temp bt ON bt.uniqueId = b.uniqueId
                     LEFT JOIN properties p ON p.id = bt.property_id
                     WHERE b.id = ? LIMIT 1`,
                    [finalBookingId]
                );
                bookingData = bookingRows && bookingRows.length > 0 ? bookingRows[0] : null;

                if (bookingData) {
                    const [tariffRows] = await db.query(
                        "SELECT totalAmountAfterTax, totalPayment FROM booking_tariffs WHERE booking_id = ?",
                        [finalBookingId]
                    );
                    tariffData = tariffRows && tariffRows.length > 0 ? tariffRows[0] : { totalAmountAfterTax: 0, totalPayment: 0 };
                }
            }

            // Fallback: trip id may be live_bookings.id — resolve via prechekin trip list only.
            if (!bookingData && finalBookingId && userId) {
                try {
                    const userTrips = await Booking.myTripsNewPrecheckin(userId);
                    const liveTrip = (userTrips?.trips || []).find(t => String(t.id) === String(finalBookingId));
                    if (liveTrip && liveTrip.ReservationNo) {
                        const [bRows] = await db.query(
                            `SELECT id, declaration, gst_bill, gst_number, business_name,
                                    stayed_before, purpose_of_visit, group_type,
                                    esign_status, esign_request_id, guest_id, user_id,
                                    security_deposit, security_deposit_paid,
                                    security_deposit_status, security_deposit_reference
                             FROM bookings WHERE uniqueId = ? LIMIT 1`,
                            [liveTrip.ReservationNo]
                        );
                        if (bRows && bRows.length > 0) {
                            bookingData = bRows[0];
                            const [tariffRows] = await db.query(
                                "SELECT totalAmountAfterTax, totalPayment FROM booking_tariffs WHERE booking_id = ?",
                                [bookingData.id]
                            );
                            tariffData = tariffRows && tariffRows.length > 0 ? tariffRows[0] : { totalAmountAfterTax: 0, totalPayment: 0 };
                        }
                    }
                } catch (_e) { /* ignore */ }
            }

            // Lead Guest City Fallback
            let leadGuestCity = '';
            if (bookingData) {
                const [leadGuestRows] = await db.query("SELECT city FROM guest_details WHERE booking_id = ? AND is_lead = 1 LIMIT 1", [bookingData.id || finalBookingId]);
                leadGuestCity = leadGuestRows[0]?.city || '';
            }

            /** Precheckin: only portal owner (bookings.user_id) gets lead-style access when logged in. */
            let isLead = false;
            if (userId && bookingData) {
                if (bookingData.user_id == null || Number(bookingData.user_id) !== Number(userId)) {
                    return Response.error(
                        res,
                        "FORBIDDEN",
                        "You do not have access to this booking in the check-in app. Sign in with the Staymaster account used to book, or complete your reservation on the main website.",
                        403
                    );
                }
                isLead = true;
            }

            const finalDetails = {
                id: userData.id,
                firstName: guestData?.first_name || userData?.firstname || '',
                lastName: guestData?.last_name || userData?.lastname || '',
                email: guestData?.email || userData?.email || '',
                mobile: guestData?.mobile || userData?.phone || '',
                gender: guestData?.gender || '',
                dob: guestData ? (guestData.dob || null) : null,
                city: guestData?.city || userData?.city || leadGuestCity || '',
                state: guestData ? (guestData.state || '') : '',
                country: guestData ? (guestData.country || '') : '',
                address: guestData ? (guestData.address || '') : '',
                zip: guestData ? (guestData.zip || '') : '',
                idFile: guestData ? (guestData.id_file || '') : '',
                hasIdDocument: guestData ? (!!guestData.id_file) : true,
                declaration: bookingData ? (bookingData.declaration || 0) : (guestData ? (guestData.declaration || 0) : 0),
                gstBill: bookingData ? (bookingData.gst_bill || 0) : (guestData ? (guestData.gst_bill || 0) : 0),
                gstNumber: bookingData ? (bookingData.gst_number || '') : (guestData ? (guestData.gst_number || '') : ''),
                businessName: bookingData ? (bookingData.business_name || '') : (guestData ? (guestData.business_name || '') : ''),
                purposeOfVisit: ((bookingData?.purpose_of_visit || guestData?.purpose_of_visit || '')).charAt(0).toUpperCase() + ((bookingData?.purpose_of_visit || guestData?.purpose_of_visit || '')).slice(1),
                groupType: ((bookingData?.group_type || guestData?.group_type || '')).charAt(0).toUpperCase() + ((bookingData?.group_type || guestData?.group_type || '')).slice(1),
                stayedBefore: ((bookingData?.stayed_before || guestData?.stayed_before || '')).charAt(0).toUpperCase() + ((bookingData?.stayed_before || guestData?.stayed_before || '')).slice(1),
                bookerName: bookingData?.booker_name || '',
                bookerPhone: bookingData?.booker_phone || '',
                esignStatus: bookingData ? (bookingData.esign_status || 'pending') : 'pending',
                esignRequestId: bookingData ? (bookingData.esign_request_id || null) : null,
                securityDeposit: bookingData ? (bookingData.security_deposit || bookingData.security_deposit_percentage || 0) : 0,
                securityDepositPaid: bookingData ? (bookingData.security_deposit_paid || 0) : 0,
                securityDepositStatus: bookingData ? (bookingData.security_deposit_status || 'unpaid') : 'unpaid',
                securityDepositReference: bookingData ? (bookingData.security_deposit_reference || null) : null,
                hasGuestProfile: guestData ? true : false,
                isLead: isLead,
                tariff: tariffData
            };

            return Response.success(res, finalDetails, 200);

        } catch (error) {
            console.error('GETGUESTDETAILS ERROR:', error);
            return res.status(500).json({
                success: false,
                error: "Unable to fetch guest details",
                message: error.message
            });
        }
    }

    // Update guest details for logged in user or via secureId
    async updateGuestDetails(req, res) {
        try {
            const userObj = req.user;
            let userId = userObj?.id || userObj?.user?.id;
            
            const secureId = req.body.secureId || req.query.secureId || req.headers['x-secure-id'];
            let bookingIdFromSecure = null;
            let bookingGuestIdFromSecure = null;

            if (secureId) {
                const decoded = decodeSecureGuestId(secureId);
                if (decoded) {
                    bookingIdFromSecure = decoded.tripId;
                    bookingGuestIdFromSecure = decoded.guestId;
                }
            }

            if (!userId && !bookingIdFromSecure) {
                return Response.error(res, "ERROR", "Unauthorized - Invalid token or secure link.", 401);
            }

            // Flatten any array values (multer may produce arrays when a field is
            // submitted twice, e.g. via a bug in the frontend FormData builder)
            const flatBody = Object.fromEntries(
                Object.entries(req.body).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])
            );
            const {
                firstName, lastName, email, mobile, gender, dob, city, state, country,
                address, zip, declaration, gstBill, gstNumber, businessName, stayedBefore, purposeOfVisit, groupType,
                stayed_before, purpose_of_visit, group_type, hasIdDocument,
                idProofType, idProofNumber,
                bookingId, guestDetailsId, guestId: guestIdFromBody
            } = flatBody;
            
            const bId = bookingId || bookingIdFromSecure || req.query.bookingId;

            const guestDetailsIdFromBody = guestDetailsId || guestIdFromBody || req.query.guestDetailsId;

            const hasValue = (val) => {
                if (val === undefined || val === null) return false;
                if (typeof val === 'string') {
                    return val.trim() !== '';
                }
                return true;
            };

            const mergeText = (incoming, existing, fallback = '') => {
                if (hasValue(incoming)) {
                    return typeof incoming === 'string' ? incoming.trim() : incoming;
                }
                if (hasValue(existing)) {
                    return existing;
                }
                return fallback;
            };

            const mergeDate = (incoming, existing) => {
                if (hasValue(incoming)) return incoming;
                return existing || null;
            };

            const mergeBoolean = (incoming, existing) => {
                if (incoming === undefined || incoming === null || (typeof incoming === 'string' && incoming.trim() === '')) {
                    if (existing === undefined || existing === null) return 0;
                    return existing ? 1 : 0;
                }
                if (typeof incoming === 'boolean') return incoming ? 1 : 0;
                if (typeof incoming === 'number') return incoming ? 1 : 0;
                if (typeof incoming === 'string') {
                    const value = incoming.trim().toLowerCase();
                    if (value === 'true' || value === '1') return 1;
                    if (value === 'false' || value === '0') return 0;
                }
                return existing ? 1 : 0;
            };

            console.log(`=== updateGuestDetails API Called (BookingsController) for booking ${bId} ===`);

            let existingProfile = null;
            let profileId = null;

            if (bId) {
                if (guestDetailsIdFromBody) {
                    const [rows] = await db.query(`SELECT * FROM guest_details WHERE id = ? AND booking_id = ? LIMIT 1`, [guestDetailsIdFromBody, bId]);
                    if (rows && rows.length > 0) {
                        existingProfile = rows[0];
                        profileId = rows[0].id;
                    }
                }

                if (!existingProfile && bookingGuestIdFromSecure) {
                    const [rows] = await db.query(`SELECT * FROM guest_details WHERE id = ? AND booking_id = ? LIMIT 1`, [bookingGuestIdFromSecure, bId]);
                    if (rows && rows.length > 0) {
                        existingProfile = rows[0];
                        profileId = rows[0].id;
                    }
                }

                if (!existingProfile && userId) {
                    const [rows] = await db.query("SELECT * FROM guest_details WHERE booking_id = ? AND is_lead = 1 LIMIT 1", [bId]);
                    if (rows && rows.length > 0) {
                        existingProfile = rows[0];
                        profileId = rows[0].id;
                    }
                }
            }

            let existingBooking = null;
            if (bId) {
                const [bookingRows] = await db.query("SELECT declaration, gst_bill, gst_number, business_name, purpose_of_visit, group_type FROM bookings WHERE id = ? LIMIT 1", [bId]);
                if (bookingRows && bookingRows.length > 0) {
                    existingBooking = bookingRows[0];
                }
            }

            const normalizedStayedBeforeInput = hasValue(stayedBefore) ? stayedBefore : stayed_before;
            const normalizedPurposeInput = hasValue(purposeOfVisit) ? purposeOfVisit : purpose_of_visit;
            const normalizedGroupTypeInput = hasValue(groupType) ? groupType : group_type;

            let finalIdFile = existingProfile?.id_file || '';
            if (typeof req.body.idFile === 'string') {
                const trimmed = req.body.idFile.trim();
                if (trimmed && trimmed.toLowerCase() !== 'uploaded') {
                    finalIdFile = trimmed;
                }
            }

            // Handle ID file upload
            if (req.file) {
                const identifier = userId || `guest_${bookingIdFromSecure}_${bookingGuestIdFromSecure}`;
                const fileName = `guest_ids/${identifier}_${Date.now()}_${req.file.originalname}`;
                try {
                    const uploadResult = await S3Helper.uploadFile(
                        process.env.AWS_BUCKET || 'staymaster',
                        fileName,
                        req.file.buffer,
                        { ContentType: req.file.mimetype }
                    );
                    finalIdFile = uploadResult.Location || fileName;
                } catch (s3Error) {
                    console.error('S3 Upload Error:', s3Error);
                }
            }

            // 2. Update persistent profile (guest_details)
            let checkResult = [];
            if (guestDetailsIdFromBody && bId) {
                [checkResult] = await db.query(`
                    SELECT id
                    FROM guest_details
                    WHERE id = ? AND booking_id = ?
                    LIMIT 1
                `, [guestDetailsIdFromBody, bId]);
            } else if (bookingGuestIdFromSecure && bId) {
                // Check if this specific stay guest already has a record for this booking
                [checkResult] = await db.query(`
                    SELECT id 
                    FROM guest_details
                    WHERE id = ? AND booking_id = ?
                `, [bookingGuestIdFromSecure, bId]);
            }

            const profileData = {
                first_name: mergeText(firstName, existingProfile?.first_name, ''),
                last_name: mergeText(lastName, existingProfile?.last_name, ''),
                email: mergeText(email, existingProfile?.email, ''),
                mobile: mergeText(mobile, existingProfile?.mobile, ''),
                gender: mergeText(gender, existingProfile?.gender, ''),
                dob: mergeDate(dob, existingProfile?.dob),
                city: mergeText(city, existingProfile?.city, ''),
                state: mergeText(state, existingProfile?.state, ''),
                country: mergeText(country, existingProfile?.country, ''),
                address: mergeText(address, existingProfile?.address, ''),
                zip: mergeText(zip, existingProfile?.zip, ''),
                id_file: finalIdFile,
                declaration: mergeBoolean(declaration, existingProfile?.declaration),
                gst_bill: mergeBoolean(gstBill, existingProfile?.gst_bill),
                gst_number: mergeText(gstNumber, existingProfile?.gst_number, ''),
                business_name: mergeText(businessName, existingProfile?.business_name, ''),
                stayed_before: mergeText(normalizedStayedBeforeInput, existingProfile?.stayed_before, ''),
                purpose_of_visit: mergeText(normalizedPurposeInput, existingProfile?.purpose_of_visit, ''),
                group_type: mergeText(normalizedGroupTypeInput, existingProfile?.group_type, ''),
                id_proof_type: mergeText(idProofType, existingProfile?.id_proof_type, ''),
                id_proof_number: mergeText(idProofNumber, existingProfile?.id_proof_number, ''),
                document_status: existingProfile?.document_status || 'pending'
            };

            if (userId) {
                profileData.booking_id = bId;
                profileData.is_lead = 1;
            }

            if (checkResult && checkResult.length > 0) {
                profileId = checkResult[0].id;
                await db.query(`UPDATE guest_details SET ? WHERE id = ?`, [profileData, profileId]);
            } else {
                const insertResult = await db.query(`INSERT INTO guest_details SET ?`, [profileData]);
                profileId = insertResult[0].insertId;
            }

            // 2b. The synchronization with booking_guests_info is no longer needed as we only use guest_details

            // 3. Update per-stay data (bookings table) - ONLY if this is the LEAD guest
            if (bId && (userId || (bookingGuestIdFromSecure && Number(bookingGuestIdFromSecure) === 1))) {
                const bookingPayload = {
                    declaration: mergeBoolean(declaration, existingBooking?.declaration),
                    gst_bill: mergeBoolean(gstBill, existingBooking?.gst_bill),
                    gst_number: mergeText(gstNumber, existingBooking?.gst_number, ''),
                    business_name: mergeText(businessName, existingBooking?.business_name, ''),
                    purpose_of_visit: mergeText(normalizedPurposeInput, existingBooking?.purpose_of_visit, existingBooking?.purpose_of_visit || ''),
                    group_type: mergeText(normalizedGroupTypeInput, existingBooking?.group_type, existingBooking?.group_type || ''),
                    updated_at: new Date()
                };
                
                if (userId) {
                    await db.query(
                        `UPDATE bookings SET ? WHERE id = ? AND ${precheckinPortalWhere()}`,
                        [bookingPayload, bId, ...precheckinPortalParams(userId)]
                    );
                } else {
                    await db.query("UPDATE bookings SET ? WHERE id = ?", [bookingPayload, bId]);
                }
            }

            return res.status(200).json({
                success: true,
                message: "Guest details updated successfully"
            });

        } catch (error) {
            console.error('UPDATEGUESTDETAILS ERROR:', error);
            return res.status(500).json({
                success: false,
                error: "Unable to update guest details",
                message: error.message
            });
        }
    }

    // Clear guest check-in data for a specific booking (soft reset)
    async clearGuestBookingData(req, res) {
        try {
            const userObj = req.user;
            let userId = userObj?.id || userObj?.user?.id;
            
            const secureId = req.body.secureId || req.query.secureId || req.headers['x-secure-id'];
            let bookingIdFromSecure = null;
            let bookingGuestIdFromSecure = null;

            if (secureId) {
                const decoded = decodeSecureGuestId(secureId);
                if (decoded) {
                    bookingIdFromSecure = decoded.tripId;
                    bookingGuestIdFromSecure = decoded.guestId;
                }
            }

            if (!userId && !bookingIdFromSecure) {
                return Response.error(res, "ERROR", "Unauthorized - Invalid token or secure link.", 401);
            }

            const bId = req.body.bookingId || bookingIdFromSecure;
            const guestIdToClear = req.body.bookingGuestId || bookingGuestIdFromSecure;

            if (!bId) {
                return Response.error(res, "ERROR", "Booking ID is required.", 400);
            }

            // 1. Verify permission/ownership
            if (userId) {
                const [ownerCheck] = await db.query(
                    `SELECT id FROM bookings WHERE id = ? AND ${precheckinPortalWhere()}`,
                    [bId, ...precheckinPortalParams(userId)]
                );
                if (!ownerCheck || ownerCheck.length === 0) {
                    return Response.error(res, "ERROR", "You don't have permission for this booking.", 403);
                }
            }

            // 2. Clear stay-specific info in guest_details
            if (guestIdToClear) {
                await db.query(
                    `UPDATE guest_details 
                     SET id_proof_type = '', id_proof_number = '', updated_at = CURRENT_TIMESTAMP 
                     WHERE id = ? AND booking_id = ?`, 
                    [guestIdToClear, bId]
                );
            }

            // 3. Clear stay-specific flags in bookings table (if lead guest or lead guest is clearing for everyone)
            // If guestIdToClear is 1 (assumed primary) or we are the lead booker
            if (userId || (guestIdToClear && Number(guestIdToClear) === 1)) {
                const resetPayload = {
                    declaration: 0,
                    esign_status: 'pending',
                    esign_request_id: null,
                    gst_bill: 0,
                    gst_number: null,
                    business_name: null,
                    updated_at: new Date()
                };
                
                await db.query("UPDATE bookings SET ? WHERE id = ?", [resetPayload, bId]);
            }

            return res.status(200).json({
                success: true,
                message: "Guest booking data cleared successfully"
            });

        } catch (error) {
            console.error('CLEARGUESTDETAILS ERROR:', error);
            return res.status(500).json({
                success: false,
                error: "Unable to clear guest details",
                message: error.message
            });
        }
    }

    async saveGuestQuestionnaire(req, res){
        try {
            if(!req.guest){
                return Response.error(res, "ERROR", "User is not authorized.", 401);
            }

            const guestId = req.guest.id;
            const {
                bookingId, booking_id,
                hasStayedBefore, has_stayed_before,
                purposeOfTrip, purpose_of_trip,
                groupType, group_type,
                declaration,
                city
            } = req.body;

            const bId = booking_id || bookingId;
            const hsb = has_stayed_before || hasStayedBefore;
            const pot = purpose_of_trip || purposeOfTrip;
            const gt  = group_type || groupType;

            const finalBookingId = parseInt(bId, 10);
            if(!finalBookingId){
                return Response.error(res, "ERROR", "Invalid booking_id provided", 400);
            }

            const bookingRecord = await Booking.bookingForGuest(finalBookingId, guestId);
            if(!bookingRecord){
                return Response.error(res, "ERROR", "Booking not found for this guest", 404);
            }

            // Sync with guest_details (Profile) - Assuming guestId here is the guest_details.id or we use booking_id
            // Sync with guest_details (Profile) - Only update declaration if provided as true
            const guestUpdateData = {
                stayed_before: hsb || '',
                purpose_of_visit: pot || '',
                group_type: gt || '',
                city: city || ''
            };
            if (declaration === true || declaration === 1 || declaration === 'true') {
                guestUpdateData.declaration = 1;
            }

            await db.query(
                `UPDATE guest_details SET ? WHERE booking_id = ? AND is_lead = 1`,
                [guestUpdateData, finalBookingId]
            );

            // Sync with bookings (Per-stay)
            const bookingPayload = {
                stayed_before: hsb || '',
                purpose_of_visit: pot || '',
                group_type: gt || '',
                updated_at: new Date()
            };
            if (declaration === true || declaration === 1 || declaration === 'true') {
                bookingPayload.declaration = 1;
            }
            await db.query(
                `UPDATE bookings SET ? WHERE id = ? AND ${precheckinPortalWhere()}`,
                [bookingPayload, finalBookingId, ...precheckinPortalParams(guestId)]
            );

            return Response.success(res, "Questionnaire saved successfully");
        } catch (error) {
            console.error('saveGuestQuestionnaire error:', error);
            return Response.error(res, "ERROR", error.message || "Failed to save questionnaire", 500);
        }
    }

    async getInvoice(req, res) {
        const bookingId = req.params.bookingId;
        const userObj = req.user;
        const userId = userObj?.id || userObj?.user?.id;

        if (!bookingId) {
            return Response.error(res, "ERROR", "bookingId is required", 400);
        }

        try {
            // Booking + property in one query
            const [bookingRows] = await db.query(
                `SELECT b.*,
                        p.listing_name, p.address_line_1, p.address_line_2, p.city AS property_city,
                        p.state AS property_state, p.security_deposit_percentage
                 FROM bookings b
                 LEFT JOIN properties p ON b.property_id = p.id
                 WHERE b.id = ?`,
                [bookingId]
            );

            if (!bookingRows || bookingRows.length === 0) {
                return Response.error(res, "NOT_FOUND", "Booking not found", 404);
            }
            const booking = bookingRows[0];

            if (userId) {
                const portalOk =
                    booking.user_id != null &&
                    Number(booking.user_id) === Number(userId);
                if (!portalOk) {
                    return Response.error(res, "FORBIDDEN", "Access denied to this invoice", 403);
                }
            }

            // Guest user details (lead guest record on booking)
            const [userRows] = await db.query(
                "SELECT id, firstname, lastname, email, phone FROM users WHERE id = ?",
                [booking.guest_id]
            );
            const user = userRows[0] || {};

            // Tariff (financial summary created by eZee sync)
            const [tariffRows] = await db.query(
                "SELECT * FROM booking_tariffs WHERE booking_id = ? ORDER BY id DESC LIMIT 1",
                [bookingId]
            );
            const tariff = tariffRows[0] || {};

            // Most recent payment record
            const [paymentRows] = await db.query(
                "SELECT * FROM booking_payments WHERE booking_id = ? ORDER BY created_at DESC LIMIT 1",
                [bookingId]
            );
            const payment = paymentRows[0] || {};

            // Guest count from guest_details
            const [guestCountRows] = await db.query(
                "SELECT COUNT(*) AS cnt FROM guest_details WHERE booking_id = ?",
                [bookingId]
            );
            const guestCount = Number(guestCountRows[0]?.cnt) || 1;

            // --- Calculations ---
            const checkIn  = new Date(booking.start);
            const checkOut = new Date(booking.end);
            const nights   = Math.max(1, Math.round((checkOut - checkIn) / 86400000));

            const totalBeforeTax = Number(tariff.totalAmountBeforeTax) || 0;
            const totalTax       = Number(tariff.totalTax)             || 0;
            const extraCharge    = Number(tariff.totalExtraCharge)     || 0;
            const accommodation  = Math.max(0, totalBeforeTax - extraCharge);

            // Security deposit: use the recorded amount first (column is 'security_deposit'),
            // then fall back to the flat deposit value stored in security_deposit_percentage
            // (that field stores a flat rupee amount, NOT a multiplier percentage)
            let securityDeposit = Number(booking.security_deposit) || 0;
            if (securityDeposit === 0) {
                securityDeposit = Number(booking.security_deposit_percentage) || 0;
            }

            // Feedback coupon discount (negative amount)
            const couponPct        = Number(booking.feedback_coupon_discount) || 0;
            const feedbackDiscount = couponPct > 0
                ? -Math.round(totalBeforeTax * couponPct / 100)
                : 0;

            // Date formatting helper
            const fmtDate = (d) => {
                if (!d) return '';
                try {
                    return new Date(d).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'long', year: 'numeric'
                    });
                } catch { return String(d); }
            };

            const invoiceData = {
                invoiceNumber: `INV-${String(bookingId).padStart(6, '0')}`,
                bookingId:     booking.subBookingId || `STM-${bookingId}`,
                issueDate:     fmtDate(booking.created_at || new Date()),
                status:        payment.id ? 'Paid' : (booking.currentStatus || 'Confirmed'),
                currency:      tariff.currencyCode || 'INR',
                company: {
                    name:    process.env.COMPANY_NAME    || 'Staymaster',
                    tagline: process.env.COMPANY_TAGLINE || 'Premium Vacation Rentals',
                    address: process.env.COMPANY_ADDRESS || 'The Staymaster\nIndia',
                    contact: `${process.env.COMPANY_EMAIL || 'contact@thestaymaster.com'}\n${process.env.COMPANY_PHONE || ''}`,
                },
                billTo: {
                    name:  `${user.firstname || ''} ${user.lastname || ''}`.trim() || 'Guest',
                    email: user.email || '',
                    phone: user.phone || '',
                },
                property: {
                    name:     booking.listing_name || booking.roomTypeName || 'Property',
                    address:  [
                        booking.address_line_1, booking.address_line_2,
                        booking.property_city,  booking.property_state,
                    ].filter(Boolean).join(', '),
                    checkIn:  fmtDate(booking.start),
                    checkOut: fmtDate(booking.end),
                    nights,
                    guests:   guestCount,
                },
                charges: {
                    accommodation,
                    cleaningFee:       0,
                    serviceFee:        extraCharge,
                    feedbackDiscount,
                    taxesAndFees:      totalTax,
                    securityDeposit,
                },
                payment: {
                    method:        payment.method || booking.paymentMethod || 'Online',
                    transactionId: booking.transaction_id || (payment.id ? `TXN-${bookingId}` : 'N/A'),
                    date:          fmtDate(payment.datetime || booking.created_at),
                    status:        payment.id ? 'Completed' : 'Pending',
                },
                securityDepositRefund: {
                    status:   booking.security_deposit_status === 'paid' ? 'Paid' : 'Processing Refund',
                    expected: '3-5 business days',
                },
            };

            return Response.success(res, invoiceData, 200);
        } catch (error) {
            console.error('getInvoice error:', error);
            return Response.error(res, "ERROR", error.message || "Failed to fetch invoice", 500);
        }
    }

    async verifyPayment(req, res) {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, booking_id, security_deposit_amount } = req.body;

        if (!razorpay_payment_id) {
            return Response.error(res, "ERROR", "razorpay_payment_id is required", 400);
        }

        try {
            // Mandatory signature verification — both fields required
            if (!razorpay_order_id || !razorpay_signature) {
                return Response.error(res, "SIGNATURE_MISSING", "razorpay_order_id and razorpay_signature are required for payment verification", 400);
            }

            const isValid = RazorPayHelper.verifySignature(
                razorpay_order_id,
                razorpay_payment_id,
                razorpay_signature
            );

            if (!isValid) {
                return Response.error(res, "SIGNATURE_INVALID", "Payment signature verification failed", 400);
            }

            // Signature valid (or skipped) — update the booking's payment status
            if (booking_id) {
                const gid = req.guest?.id || req.user?.id;
                if (gid) {
                    const owned = await Booking.bookingForGuest(parseInt(booking_id, 10), gid);
                    if (!owned) {
                        return Response.error(res, "FORBIDDEN", "You cannot record payment for this booking", 403);
                    }
                }
                // 1. Mark security deposit as paid and record the amount
                await db.query(
                    `UPDATE bookings
                     SET security_deposit_paid = 1,
                         security_deposit_status = 'paid',
                         security_deposit_reference = ?,
                         security_deposit = COALESCE(NULLIF(?, 0), security_deposit)
                     WHERE id = ?`,
                    [razorpay_payment_id, security_deposit_amount || 0, booking_id]
                );

                // 2. Sync booking balance (tariff) as paid
                // We assume if they reached this point and paid, they paid the full balance shown on DeclarationPage
                await db.query(
                    `UPDATE booking_tariffs
                     SET totalPayment = totalAmountAfterTax
                     WHERE booking_id = ?`,
                    [booking_id]
                );
            }

            return Response.success(res, {
                verified: true,
                razorpay_order_id,
                razorpay_payment_id,
            }, 200);
        } catch (error) {
            console.error('verifyPayment error:', error.message || error);
            return Response.error(res, "ERROR", error.message || "Payment verification failed", 500);
        }
    }

    async submitFeedback(req, res) {
        const { bookingId, overallRating, cleanliness, comfort, location, amenities, service, comment, caretaker, propertyManager } = req.body;

        if (!bookingId || !overallRating) {
            return Response.error(res, "ERROR", "Booking ID and overall rating are required", 400);
        }

        try {
            const gid = req.guest?.id || req.user?.id;
            if (gid) {
                const owned = await Booking.bookingForGuest(parseInt(bookingId, 10), gid);
                if (!owned) {
                    return Response.error(res, "FORBIDDEN", "You cannot submit feedback for this booking", 403);
                }
            }

            // Check if booking exists
            const [bookingCheck] = await db.query('SELECT id FROM bookings WHERE id = ?', [bookingId]);
            if (!bookingCheck || bookingCheck.length === 0) {
                return Response.error(res, "NOT_FOUND", "Booking not found", 404);
            }

            // Create table if it doesn't exist (schema matches migrations/create_stay_feedbacks_table.sql)
            await db.query(`
                CREATE TABLE IF NOT EXISTS stay_feedbacks (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    booking_id INT NOT NULL,
                    overall_rating INT NOT NULL,
                    cleanliness INT DEFAULT 0,
                    comfort INT DEFAULT 0,
                    location INT DEFAULT 0,
                    amenities INT DEFAULT 0,
                    service INT DEFAULT 0,
                    caretaker INT DEFAULT 0,
                    property_manager INT DEFAULT 0,
                    comment TEXT DEFAULT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_booking (booking_id)
                )
            `);

            // Ensure the unique key exists on older table instances created without it
            try {
                await db.query(`ALTER TABLE stay_feedbacks ADD UNIQUE KEY uq_booking (booking_id)`);
            } catch (_) { /* key already exists — safe to ignore */ }

            // Upsert: insert or update if same booking submits again
            await db.query(`
                INSERT INTO stay_feedbacks
                    (booking_id, overall_rating, cleanliness, comfort, location, amenities, service, caretaker, property_manager, comment)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    overall_rating   = VALUES(overall_rating),
                    cleanliness      = VALUES(cleanliness),
                    comfort          = VALUES(comfort),
                    location         = VALUES(location),
                    amenities        = VALUES(amenities),
                    service          = VALUES(service),
                    caretaker        = VALUES(caretaker),
                    property_manager = VALUES(property_manager),
                    comment          = VALUES(comment)
            `, [
                bookingId,
                Number(overallRating)    || 0,
                Number(cleanliness)      || 0,
                Number(comfort)          || 0,
                Number(location)         || 0,
                Number(amenities)        || 0,
                Number(service)          || 0,
                Number(caretaker)        || 0,
                Number(propertyManager)  || 0,
                comment || '',
            ]);

            return Response.success(res, { success: true }, 200);
        } catch (error) {
            console.error('submitFeedback error:', error.message || error);
            return Response.error(res, "ERROR", error.message || "Failed to submit feedback", 500);
        }
    }

    async requestCancellation(req, res) {
        const { id } = req.params;
        const { reason } = req.body;
        const gid = req.guest?.id || req.user?.id;

        try {
            if (gid) {
                const owned = await Booking.bookingForGuest(parseInt(id, 10), gid);
                if (!owned) {
                    return Response.error(res, "FORBIDDEN", "You cannot request cancellation for this booking", 403);
                }
            }

            // Check if booking exists
            const [bookingCheck] = await db.query('SELECT id, status FROM bookings WHERE id = ?', [id]);
            if (!bookingCheck || bookingCheck.length === 0) {
                return Response.error(res, "NOT_FOUND", "Booking not found", 404);
            }
            
            const booking = bookingCheck[0];
            
            if (booking.status === 'Cancel' || booking.status === 'Void') {
                return Response.error(res, "ERROR", "Booking is already cancelled", 400);
            }

            // In a real scenario, this might trigger an email or change status to 'Cancellation_Requested'
            // We'll mark the cancellation request in dedicated columns
            await db.query(
                `UPDATE bookings 
                 SET cancellation_requested = 1, 
                     cancellation_reason = ?, 
                     cancellation_requested_at = NOW() 
                 WHERE id = ?`,
                [reason || 'User requested cancellation', id]
            );

            console.log(`[Cancellation Requested] Booking: ${id}. Reason: ${reason}`);

            return Response.success(res, { success: true, message: "Cancellation request submitted successfully" }, 200);
        } catch (error) {
            console.error('requestCancellation error:', error.message || error);
            return Response.error(res, "ERROR", error.message || "Failed to process cancellation request", 500);
        }
    }
}
module.exports = BookingsController;
