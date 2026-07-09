const asyncHandler = require("express-async-handler");
const Response = require("../helpers/responseHelper");
const user = require("../models/userModel");
const User = new user;
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const utility = require("../helpers/utility");
const Utility = new utility;
const constants = require("../config/constants");

const dotenv = require("dotenv").config();
const mode = process.env.MODE || 'dev';


const twilioHelper = require('../helpers/twilioHelper');
const UserValidator = require("../validation/userValidator");
const TwilioHelper = new twilioHelper;
const otpService = require('../services/otpService');
const BookingModel = require('../models/bookingModel');
const bookingModel = new BookingModel();
const db = require('../config/dbConnection');
const { format } = require('date-fns');
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
const {
    precheckinPortalWhere,
    precheckinPortalParams,
} = require('../helpers/portalBookingSql');

const buildPropertyImageUrl = async (propertyId, mediaFilename) => {
    if (!mediaFilename) return '';
    const filePath = `${propertyId}/${mediaFilename}`;
    if (hasUsableCdnBaseUrl) {
        return buildCdnUrl(filePath, propertyCdnPrefix);
    }
    const key = [propertyBucketPrefix, filePath].filter(Boolean).join('/');
    const urlParams = {
        Bucket: propertyBucketName || propertyBucketRaw,
        Key: key,
        Expires: 3600
    };
    return S3Helper.getSignedUrlPromise(urlParams);
};

// Convert phone to +<country><number> format
const normalizePhone = (phone) => {
    phone = phone.toString().replace(/\s+/g, "");
    return phone.startsWith("+") ? phone : `+${phone}`;
};

//@access public
const registerUser =  asyncHandler(async (req, res) =>{
    
    const {firstname, lastname, email, password, role} = req.body;
    if(!firstname || !lastname || !email || !password) {
        return Response.error(res, "ERROR", "Please fill required fields!", 400);
    }
    const userAvailable = await User.userExists(email);
    console.log(userAvailable);
    if(userAvailable) {
        return Response.error(res, "ERROR", "User already registered.", 400);
    }

    //Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ firstname, lastname, email, password:hashedPassword,role });
    if(user) {
        return Response.success(res, {_id: user.id, email: user.email, name: user.firstname+" "+user.lastname}, 201);
    } else {
        return Response.error(res, "ERROR", "Invalid user data", 400);
    } 
});

const registerWithPhone =  asyncHandler(async (req, res) =>{
    const {phone} = req.body;
    if(!phone) {
        return Response.error(res, "ERROR", "Phone number missing or invalid!", 400);
    }
    const userAvailable = await User.userPhoneExists(phone);
    if(userAvailable) {
        return Response.error(res, "ERROR", "User already registered. Please login", 400);
    }
    const user = await User.createWithPhone(phone,'268');
    if(user) {
        return Response.success(res, {_id: user.id}, 201);
    } else {
        return Response.error(res, "ERROR", "Invalid user data", 400);
    } 
});

const check = asyncHandler(async (req,res)=>{ 
    const user = req.user || req.guest;
    if (!user) {
        return Response.error(res, "ERROR", "User not authenticated!", 401);
    }
    return Response.success(res, {user}, 200);
});

const getProfile = asyncHandler(async (req,res)=>{
    const id = req.user?.id || req.guest?.id;
    if(!id){
        return Response.error(res, "ERROR", "Unauthorized - token missing or invalid", 401);
    }
    const userAvailable = await User.getById(id);
    if(!userAvailable || userAvailable.length == 0) {
        return Response.error(res, "ERROR", "User not found", 400);
    }
    const u = userAvailable[0];
    return Response.success(res, {id:u.id,firstname:u.firstname,lastname:u.lastname,email:u.email,phone:u.phone}, 200);
});

const updateProfile = asyncHandler(async (req,res)=>{
    // Always use the authenticated user's ID from the JWT — never from the request body
    // (prevents horizontal privilege escalation / IDOR)
    const id = req.user?.id || req.guest?.id;
    if (!id) {
        return Response.error(res, "ERROR", "Unauthorized", 401);
    }
    const {firstname, lastname, email, phone} = req.body;
    if(!firstname || !lastname || !email || !phone){
        return Response.error(res, "ERROR", "Fill required fields!", 400);
    }
    const userAvailable = await User.getById(id);
    if(!userAvailable || userAvailable.length == 0) {
        return Response.error(res, "ERROR", "User not found", 400);
    }
    await User.updateProfile(id, firstname, lastname, email, phone);
    return Response.success(res, {message:"Updated successfully"}, 200);
});

//@desc Login a user
//@route POST api/users/login
//@access public
const loginUser = async (req, res) => {
  try {    
    const { email, password } = req.body;
    if (!email || !password) {
      return Response.error(res, "ERROR", "Please fill required fields!", 400);
    }
    const userAvailable = await User.getByEmail(email);
    if (userAvailable && (await bcrypt.compare(password, userAvailable.password))) {
      const accessToken = jwt.sign(
        {
          user: {
            email: userAvailable.email,
            id: userAvailable.id,
          },
        },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "300m" }
      );
      return Response.success(res, { accessToken }, 200);
    } else {
      return Response.error(res, "ERROR", "Wrong email or password", 401);
    }
  } catch (error) {
    return Response.error(res, "ERROR", "Internal server error", 500);
  }
};

// generateToken was a public unauthenticated endpoint that issued never-expiring admin JWTs.
// Removed: it was a critical security vulnerability. Generate service tokens offline via scripts/gen_dev_token.js.

//@access public
const currentUser =  asyncHandler(async (req, res) =>{
    return Response.success(res, req.user, 200);
});


//pricheckin_user flow
const registerWithPhone_user = async (req, res) => {
    try {
        const { phone } = req.body;

        if (!UserValidator.isValidPhone(phone)) {
            return Response.error(res, "ERROR", "Invalid phone number", 400);
        }

        const formattedPhone = normalizePhone(phone);

        // Always generate a real random OTP using the OTP service
        const generated = otpService.generateOTP();
        const otp = generated.otp;
        const expires_at = generated.expires_at;

        await User.saveOTP(formattedPhone, otp, expires_at);

        // SMS only in production
        if (process.env.NODE_ENV !== "development") {
            await otpService.sendOTPviaSMS(formattedPhone, otp);
        }

        const responseData = { message: "OTP sent successfully" };
        // Only expose OTP in response when test mode is explicitly enabled
        if (otpService.isTestOTPAllowed()) responseData.otp = otp;
        return Response.success(res, responseData, 200);

    } catch (error) {
        console.error("SEND OTP ERROR:", error);
        return Response.error(res, "ERROR", "Internal Server Error", 500);
    }
};

const verifyOTP = async (req, res) => {
    try {
        const { phone, otp } = req.body;

        if (!UserValidator.isValidPhone(phone)) {
            return res.status(400).json({
                success: false,
                message: "Invalid phone number format"
            });
        }

        if (!UserValidator.isValidOTP(otp)) {
            return res.status(400).json({
                success: false,
                message: "Invalid OTP format"
            });
        }

        const formattedPhone = normalizePhone(phone);

        let user;

        // Use OTP service for validation (handles test OTP bypass via env flags)
        const otpRecord = await User.validatePhoneOTP(formattedPhone, otp);
        const record = otpRecord && otpRecord.length ? otpRecord[0] : null;
        const otpResult = otpService.verifyOTP(otp.toString(), record);

        if (!otpResult.valid) {
            return res.status(400).json({
                success: false,
                message: otpResult.error || "Invalid or expired OTP"
            });
        }

        // Same phone may exist on multiple users rows — pick the portal account that actually
        // owns bookings (bookings.user_id), else newest guest row for that phone.
        const _digits = formattedPhone.replace(/[^0-9]/g, '');
        const _ten = _digits.slice(-10);
        if (_ten.length === 10) {
            const _variants = [...new Set([
                formattedPhone, _ten, `+91${_ten}`, `91${_ten}`, `+${_ten}`, `0${_ten}`,
                `+91-${_ten}`, `91-${_ten}`
            ])];
            const _phs = _variants.map(() => '?').join(',');
            const [_rows] = await db.query(
                `SELECT u.*,
                    (SELECT COUNT(*) FROM bookings b WHERE b.user_id = u.id) AS _portal_cnt
                 FROM users u
                 WHERE u.phone IN (${_phs}) AND u.role = ?
                 ORDER BY _portal_cnt DESC, u.id DESC
                 LIMIT 1`,
                [..._variants, constants.ROLE_GUEST]
            );
            user = (_rows && _rows[0]) ? _rows[0] : null;
        }

        // Fallback: exact match (any role) then variant match
        if (!user) {
            user = await User.getByPhone(formattedPhone);
        }
        if (!user) {
            user = await User.getByPhoneVariants(formattedPhone);
        }

        if (!user) {
            try {
                user = await User.createWithPhone(formattedPhone, constants.ROLE_GUEST);
            } catch (createErr) {
                const isDup =
                    createErr.code === "ER_DUP_ENTRY" || createErr.errno === 1062;
                if (isDup) {
                    user = await User.getByPhone(formattedPhone) || await User.getByPhoneVariants(formattedPhone);
                } else {
                    throw createErr;
                }
            }
        }

        if (!user || !user.id) {
            return res.status(500).json({
                success: false,
                message: "Could not create or load your account. Please try again.",
            });
        }

        const roleNum = Number(user.role);
        const precheckinBlockedRoles = new Set([
            constants.ROLE_HOST,
            constants.ROLE_ADMIN,
            constants.ROLE_STAFF,
            constants.ROLE_MANAGER,
            constants.ROLE_API_USER,
        ]);
        if (precheckinBlockedRoles.has(roleNum)) {
            return res.status(403).json({
                success: false,
                message:
                    "This check-in app is only for guest accounts. Host, staff, and manager accounts cannot sign in here. Please use the appropriate admin or host portal.",
            });
        }

        // Reset token_invalid_after so any previous logout never blocks a fresh login.
        // Wrapped in try-catch: if the migration hasn't been run on this DB yet the
        // column won't exist, but that must not abort a successful OTP login.
        try {
            await db.query('UPDATE users SET token_invalid_after = 0 WHERE id = ?', [user.id]);
        } catch (tokenResetErr) {
            console.warn('token_invalid_after reset skipped (column may not exist yet):', tokenResetErr.message);
        }

        // ✅ Token Generate (Same for both modes)
        const token = jwt.sign(
            {
                user: {
                    phone: user.phone,
                    id: user.id,
                    transExpiry: Math.round(Date.now() / 1000) + (60 * 60),
                },
            },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: "7d" }
        );

        const userData = {
            id: user.id,
            firstname: user.firstname,
            lastname: user.lastname,
            email: user.email,
            phone: user.phone,
        };

        return res.status(200).json({
            success: true,
            guestToken: token,
            user: userData,
            testMode: process.env.NODE_ENV === "development" // optional debug
        });

    } catch (error) {
        console.error("VERIFY OTP ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Something went wrong. Please try again."
        });
    }
};
const UserLogout = async (req, res) => {
    try {
        // `validateToken` middleware should have set `req.user`
        const userObj = req.user;
        if (!userObj || !userObj.id) {
            return Response.error(res, "ERROR", "Unauthorized or invalid token", 401);
        }

        const userAvailable = await User.getById(userObj.id);
        if (!userAvailable || userAvailable.length === 0) {
            return Response.error(res, "ERROR", "User not found", 404);
        }

        await User.invalidateTokens(userObj.id);
        return Response.success(res, { message: "Logout successful" }, 200);
    } catch (error) {
        return Response.error(res, "ERROR", error.message || "Something went wrong", 500);
    }
};

const Userbooking = async (req, res) => {
    try {
        const userObj = req.user;
        console.log('=== Userbooking API Called ===');
        console.log('Userbooking - req.user:', JSON.stringify(req.user));
        
        // Handle different token structures
        let userId = null;
        if (userObj) {
            // Direct id or nested in user object
            userId = userObj.id || userObj.user?.id;
        }
        
        console.log('Userbooking - extracted userId:', userId);
        
        if (!userId) {
            // Return empty bookings for unauthenticated/invalid-token requests — never 401
            return res.status(200).json({
                success: true,
                data: { total: 0, upcoming: [], past: [], cancelled: [], stats: null }
            });
        }

        // Check if user exists in database
        const userCheck = await db.query("SELECT id, phone, email, firstname, lastname FROM users WHERE id = ?", [userId]);
        console.log('Userbooking - user from DB:', userCheck[0]);

        if (!userCheck[0] || userCheck[0].length === 0) {
            // Return empty bookings if user record is not found
            return res.status(200).json({
                success: true,
                data: { total: 0, upcoming: [], past: [], cancelled: [], stats: null }
            });
        }

        const today = format(new Date(), 'yyyy-MM-dd');

        // Run liveTrips and main bookings query in parallel
        const [liveResult, mainBookingsResult] = await Promise.all([
            bookingModel.myTripsNewPrecheckin(userId),
            db.query(
                `SELECT
                    b.id,
                    b.property_id,
                    b.start,
                    b.end,
                    DATE_FORMAT(b.start, '%d %M %Y') AS check_in_date,
                    DATE_FORMAT(b.end, '%d %M %Y')   AS check_out_date,
                    b.currentStatus,
                    b.source,
                    b.security_deposit,
                    b.security_deposit_paid,
                    b.security_deposit_status,
                    b.declaration,
                    b.esign_status,
                    b.createDatetime AS created_at,
                    p.listing_name,
                    p.address_line_1,
                    p.city,
                    pm.media_filename AS cover_media_filename
                 FROM bookings b
                 JOIN properties p ON b.property_id = p.id
                 LEFT JOIN property_media pm ON pm.property_id = p.id AND pm.media_type_id = 4
                 WHERE b.user_id = ?
                 ORDER BY b.createDatetime DESC`,
                [userId]
            )
        ]);

        const liveTrips = (liveResult && liveResult.trips) ? liveResult.trips : [];
        const bookingList = mainBookingsResult[0] || [];
        const bookingIds = bookingList.map(r => r.id);

        const bookings = [];
        if (bookingIds.length > 0) {
            const ph = bookingIds.map(() => '?').join(',');

            // Batch-fetch all related data in parallel — replaces the N+1 per-booking loop
            const [tariffRows, rentalRows, guestRows, guestCountRows] = await Promise.all([
                db.query(
                    `SELECT booking_id, totalAmountBeforeTax, taCommision, totalAmountAfterTax, totalPayment
                     FROM booking_tariffs WHERE booking_id IN (${ph})`,
                    bookingIds
                ),
                db.query(
                    `SELECT booking_id, adult, child FROM booking_rentalInfo
                     WHERE booking_id IN (${ph}) ORDER BY effectiveDate`,
                    bookingIds
                ),
                db.query(
                    `SELECT booking_id, first_name, last_name, email, mobile
                     FROM guest_details WHERE booking_id IN (${ph}) AND is_lead = 1`,
                    bookingIds
                ),
                db.query(
                    `SELECT booking_id,
                            COUNT(*) AS total_guests,
                            SUM(CASE WHEN id_file IS NOT NULL OR (first_name IS NOT NULL AND last_name IS NOT NULL) THEN 1 ELSE 0 END) AS filled_guests_count
                     FROM guest_details WHERE booking_id IN (${ph}) GROUP BY booking_id`,
                    bookingIds
                )
            ]);

            // Build O(1) lookup maps
            const tariffMap = {};
            (tariffRows[0] || []).forEach(r => { tariffMap[r.booking_id] = r; });
            const rentalMap = {};
            (rentalRows[0] || []).forEach(r => { if (!rentalMap[r.booking_id]) rentalMap[r.booking_id] = r; });
            const guestMap = {};
            (guestRows[0] || []).forEach(r => { guestMap[r.booking_id] = r; });
            const guestCountMap = {};
            (guestCountRows[0] || []).forEach(r => { guestCountMap[r.booking_id] = r; });

            // Generate all property image URLs in parallel
            const imageResults = await Promise.all(
                bookingList.map(async (b) => {
                    if (!b.cover_media_filename) return { id: b.id, url: '' };
                    try {
                        const url = await buildPropertyImageUrl(b.property_id, b.cover_media_filename);
                        return { id: b.id, url };
                    } catch (_) {
                        return { id: b.id, url: '' };
                    }
                })
            );
            const imageMap = {};
            imageResults.forEach(r => { imageMap[r.id] = r.url; });

            bookingList.forEach(b => {
                const tariff = tariffMap[b.id] || {};
                const rental = rentalMap[b.id] || {};
                const guest  = guestMap[b.id]  || {};
                const gc     = guestCountMap[b.id] || {};
                const nights = b.start && b.end
                    ? Math.ceil((new Date(b.end) - new Date(b.start)) / 86400000)
                    : 0;
                const totalGuests = (Number(rental.adult) || 0) + (Number(rental.child) || 0);

                bookings.push({
                    id: b.id,
                    created_at: b.created_at || null,
                    property_id: b.property_id,
                    property_name: b.listing_name || '',
                    address: b.address_line_1 || '',
                    city: b.city || '',
                    image: imageMap[b.id] || '',
                    start: b.start || null,
                    end: b.end || null,
                    check_in_date: b.check_in_date || null,
                    check_out_date: b.check_out_date || null,
                    nights,
                    status: b.currentStatus || '',
                    amount: Number(tariff.totalAmountAfterTax) || 0,
                    amount_before_tax: Number(tariff.totalAmountBeforeTax) || 0,
                    tax: (Number(tariff.totalAmountAfterTax) || 0) - (Number(tariff.totalAmountBeforeTax) || 0),
                    security_deposit: b.security_deposit || 0,
                    security_deposit_paid: b.security_deposit_paid || 0,
                    security_deposit_status: b.security_deposit_status || 'unpaid',
                    balance: (Number(tariff.totalAmountAfterTax) || 0) - (Number(tariff.totalPayment) || 0),
                    total_payment: Number(tariff.totalPayment) || 0,
                    is_declaration_done: b.declaration === 1 || b.esign_status === 'success',
                    is_payment_done: b.security_deposit_paid === 1 || b.security_deposit_status === 'paid',
                    filled_guests_count: Number(gc.filled_guests_count) || 0,
                    source: b.source || 'main',
                    guest_name: guest.first_name ? `${guest.first_name} ${guest.last_name || ''}`.trim() : '',
                    guest_email: guest.email || '',
                    guest_phone: guest.mobile || '',
                    total_guests: totalGuests,
                    property: { id: b.property_id, listing_name: b.listing_name, image: imageMap[b.id] || '' }
                });
            });
        }

        const normalizeMain = (b) => ({
            id: b.id,
            created_at: b.created_at || null,
            property_id: b.property_id,
            property_name: b.property_name,
            address: b.address || '',
            city: b.city || '',
            image: b.image || '',
            start: b.start ? format(new Date(b.start), 'yyyy-MM-dd') : null,
            end: b.end ? format(new Date(b.end), 'yyyy-MM-dd') : null,
            check_in_date: b.check_in_date,
            check_out_date: b.check_out_date,
            nights: b.nights || 0,
            status: b.status,
            amount: b.amount || 0,
            amount_before_tax: b.amount_before_tax || 0,
            tax: b.tax || 0,
            security_deposit: b.security_deposit || 0,
            security_deposit_paid: b.security_deposit_paid || 0,
            security_deposit_status: b.security_deposit_status || 'unpaid',
            balance: b.balance || 0,
            total_payment: b.total_payment || 0,
            source: b.source || 'main',
            guest_name: b.guest_name || '',
            guest_email: b.guest_email || '',
            guest_phone: b.guest_phone || '',
            total_guests: b.total_guests || 0,
            is_declaration_done: b.is_declaration_done || false,
            is_payment_done: b.is_payment_done || false,
            filled_guests_count: b.filled_guests_count || 0,
            property: b.property || { id: b.property_id, listing_name: b.property_name, image: b.image }
        });

        const normalizeLive = (t) => {
            const img = t.cover_image || t.property_main_image || t.image || '';
            const totalGuests = Number(t.adults || 0) + Number(t.children || 0);
            return {
                id: t.id,
                property_id: t.property_id,
                property_name: t.listing_name,
                address: t.address || '',
                city: t.city || '',
                image: img,
                start: t.start ? format(new Date(t.start), 'yyyy-MM-dd') : null,
                end: t.end ? format(new Date(t.end), 'yyyy-MM-dd') : null,
                check_in_date: t.start ? format(new Date(t.start), 'dd MMM yyyy') : null,
                check_out_date: t.end ? format(new Date(t.end), 'dd MMM yyyy') : null,
                nights: t.nights || 0,
                status: t.status || t.BookingStatus || t.currentStatus,
                amount: t.amount || 0,
                amount_before_tax: t.amount_before_tax || 0,
                tax: t.TotalTax || 0,
                source: 'live',
                guest_name: '',
                guest_email: '',
                guest_phone: t.Mobile || '',
                total_guests: totalGuests,
                is_declaration_done: t.declaration === 1 || t.esign_status === 'success',
                is_payment_done: t.security_deposit_paid === 1 || t.security_deposit_status === 'paid',
                filled_guests_count: t.filled_guests_count || 0,
                property: {
                    id: t.property_id,
                    listing_name: t.listing_name,
                    image: img
                },
                details: t,
                raw: t
            };
        };

        const combined = [];
        bookings.forEach(b => combined.push(normalizeMain(b)));
        liveTrips.forEach(t => combined.push(normalizeLive(t)));

        const upcoming = [];
        const past = [];
        const cancelled = [];

        combined.forEach(item => {
            const st = item.start || null;
            const en = item.end || null;

            if (item.status && (item.status.toLowerCase() === 'cancel' || item.status.toLowerCase() === 'void' || item.status.toLowerCase() === 'cancelled')) {
                cancelled.push(item);
                return;
            }

            if (en && en < today) {
                past.push(item);
            } else if (st && st > today) {
                upcoming.push(item);
            } else {
                upcoming.push(item);
            }
        });

        // Sort each bucket: newest booking first (by created_at, fallback to start date)
        const sortDesc = (a, b) => new Date(b.created_at || b.start || 0) - new Date(a.created_at || a.start || 0);
        upcoming.sort(sortDesc);
        past.sort(sortDesc);
        cancelled.sort(sortDesc);

        // Calculate stats
        const totalRevenue = bookings.reduce((sum, b) => sum + (b.amount || 0), 0);
        const totalNights = bookings.reduce((sum, b) => sum + (b.nights || 0), 0);
        const totalBookings = bookings.length;
        
        const stats = {
            total_bookings: totalBookings,
            total_upcoming: upcoming.length,
            total_past: past.length,
            total_cancelled: cancelled.length,
            total_revenue: totalRevenue,
            total_nights: totalNights
        };

        if (combined.length === 0) {
            return res.status(200).json({
                success: true,
                data: { 
                    total: 0, 
                    upcoming: [], 
                    past: [], 
                    cancelled: [],
                    stats: stats
                }
            });
        }

        return res.status(200).json({
            success: true,
            data: { 
                total: combined.length, 
                upcoming, 
                past, 
                cancelled, 
                all: combined,
                stats: stats
            }
        });
    } catch (error) {
        console.error('USERBOOKING ERROR:', error);
        return res.status(500).json({
            success: false,
            error: "Unable to fetch bookings",
            message: error.message
        });
    }
};

const UserbookingById = async (req, res) => {
    try {
        const userObj = req.user;
        
        // Handle different token structures
        let userId = null;
        if (userObj) {
            userId = userObj.id || userObj.user?.id;
        }
        
        // Get booking ID from params
        const { id } = req.params;

        if (!id) {
            return Response.error(res, "ERROR", "Booking ID is required", 400);
        }

        console.log('=== UserbookingById API Called ===');
        console.log('UserbookingById - bookingId:', id);
        console.log('UserbookingById - userId:', userId);

        const idStr = String(id);

        // Main booking: same id / uniqueId / subBookingId, and owned by this portal user.
        // Backward compatibility: some DBs don't have bookings.user_id.
        let hasUserIdColumn = false;
        try {
            const [colRows] = await db.query("SHOW COLUMNS FROM bookings LIKE 'user_id'");
            hasUserIdColumn = Array.isArray(colRows) && colRows.length > 0;
        } catch (_) {}

        const bookingMatchSql = '(b.id = ? OR CAST(b.uniqueId AS CHAR) = ? OR b.subBookingId = ?)';
        const ownerWhere = hasUserIdColumn ? precheckinPortalWhere('b') : 'b.guest_id = ?';
        const ownerParams = hasUserIdColumn ? precheckinPortalParams(userId) : [userId];

        const mainBookingQuery = userId
            ? `SELECT b.id, b.guest_id, ${hasUserIdColumn ? 'b.user_id' : 'NULL AS user_id'}, b.property_id, b.start, b.end, b.currentStatus FROM bookings b WHERE ${bookingMatchSql} AND ${ownerWhere}`
            : `SELECT id, guest_id, ${hasUserIdColumn ? 'user_id' : 'NULL AS user_id'}, property_id, start, end, currentStatus FROM bookings WHERE id = ?`;
        const mainBookingParams = userId ? [id, idStr, idStr, ...ownerParams] : [id];
        const mainBookingResult = await db.query(mainBookingQuery, mainBookingParams);

        // Live/PMS rows linked to those bookings (not phone-wide scan)
        let liveTrips = [];
        if (userId) {
            try {
                liveTrips = (await bookingModel.myTripsNewPrecheckin(userId))?.trips || [];
            } catch (e) {
                // Older schemas may not support user_id-based trip query.
                liveTrips = [];
            }
        }
        const liveBooking = liveTrips.find(
            (t) => String(t.id) === idStr || (t.ReservationNo != null && String(t.ReservationNo) === idStr)
        );

        let bookingData = null;

        if (mainBookingResult[0] && mainBookingResult[0].length > 0) {
            // It's a main booking — always load details by numeric DB primary key
            const resolvedBookingId = mainBookingResult[0][0].id;
            const details = await bookingModel.bookingDetailsForHost(resolvedBookingId);
            const main = details.booking || {};
            const prop = details.property || {};
            
            // Property image is already included in details.property from bookingDetailsForHost
            let propertyImage = prop.image || '';
            
            // Calculate nights
            let nights = 0;
            if (main.start && main.end) {
                const startDate = new Date(main.start);
                const endDate = new Date(main.end);
                nights = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
            }
            
            // Get guest details
            const guest = details.guest || {};
            const rentalInfo = details.rentalInfo || [];
            const guestsList = details.guests || details.booking?.guests || [];
            
            let totalGuests = rentalInfo.reduce((sum, r) => sum + (Number(r.adults) || 0) + (Number(r.children) || 0), 0);
            
            // Fallback: if totalGuests is 0 but we have a guests list, use the list length
            if (totalGuests === 0 && guestsList.length > 0) {
                totalGuests = guestsList.length;
            }

            // Calculate how many guests have filled their info
            const filledGuestsCount = guestsList.filter(g => 
                g.id_file || (g.firstname && g.lastname)
            ).length;

            const isDeclarationDone = main.declaration === 1 || main.esign_status === 'success';
            const isPaymentDone = main.security_deposit_paid === 1 || main.security_deposit_status === 'paid';
            
            // Get all guests array
            const allGuests = guestsList;
            
            bookingData = {
                id: main.id,
                uniqueId: main.uniqueId || '',
                subBookingId: main.subBookingId || '',
                property_id: prop.id || null,
                property_name: prop.listing_name || '',
                address: prop.address_line_1 || '',
                address_line_2: prop.address_line_2 || '',
                city: prop.city || '',
                state: prop.state || '',
                country: prop.country || '',
                image: propertyImage,
                start: main.start || null,
                end: main.end || null,
                check_in_date: main.check_in_date || null,
                check_out_date: main.check_out_date || null,
                nights: nights,
                status: main.currentStatus || main.status || '',
                amount: details.tariff && details.tariff.totalAmountAfterTax ? details.tariff.totalAmountAfterTax : 0,
                amount_before_tax: details.tariff && details.tariff.totalAmountBeforeTax ? details.tariff.totalAmountBeforeTax : 0,
                tax: details.tariff && details.tariff.totalTax ? details.tariff.totalTax : 0,
                commission: details.tariff && details.tariff.taCommision ? details.tariff.taCommision : 0,
                security_deposit: main.security_deposit || 0,
                security_deposit_paid: main.security_deposit_paid || 0,
                security_deposit_status: main.security_deposit_status || 'unpaid',
                balance: (Number(details.tariff?.totalAmountAfterTax) || 0) - (Number(details.tariff?.totalPayment) || 0),
                total_payment: Number(details.tariff?.totalPayment) || 0,
                is_declaration_done: isDeclarationDone,
                is_payment_done: isPaymentDone,
                filled_guests_count: filledGuestsCount,
                source: main.source || 'main',
                transaction_id: main.transaction_id || '',
                voucher_no: main.voucherNo || '',
                booked_by: main.bookedBy || '',
                payment_method: main.paymentMethod || '',
                // Guest details
                guest_name: guest.firstname ? `${guest.firstname} ${guest.lastname || ''}`.trim() : '',
                guest_email: guest.email || '',
                guest_phone: guest.phone || '',
                total_guests: totalGuests,
                guests: allGuests.map(g => ({
                    id: g.id,
                    firstname: g.firstname,
                    lastname: g.lastname,
                    email: g.email,
                    phone: g.phone,
                    is_lead: g.lead_guest === 1,
                    stayedBefore: g.stayedBefore || g.has_stayed_before || g.stayed_before || '',
                    purpose_of_visit: g.purpose_of_visit || '',
                    group_type: g.group_type || '',
                    id_file: g.id_file || '',
                    gender: g.gender || '',
                    dob: g.dob || null,
                    city: g.city || '',
                    state: g.state || '',
                    country: g.country || '',
                    address: g.address || '',
                    zip: g.zip || ''
                })),
                // Property details
                property: {
                    id: prop.id,
                    listing_name: prop.listing_name,
                    address_line_1: prop.address_line_1,
                    address_line_2: prop.address_line_2,
                    city: prop.city,
                    state: prop.state,
                    country: prop.country,
                    image: prop.image || propertyImage,
                    google_latitude: prop.google_latitude,
                    google_longitude: prop.google_longitude,
                    property_manager_name: prop.property_manager_name || '',
                    property_manager_phone: prop.property_manager_phone || '',
                    property_manager_email: prop.property_manager_email || ''
                },
                details: details,
                rental_info: rentalInfo.map(r => ({
                    date: r.effectiveDate,
                    adults: r.adults,
                    children: r.children,
                    rent: r.rent,
                    rent_pre_tax: r.rentPreTax
                }))
            };
            
        } else if (liveBooking) {
            // It's a live booking
            bookingData = {
                id: liveBooking.id,
                uniqueId: liveBooking.ReservationNo || '',
                subBookingId: '',
                property_id: liveBooking.property_id,
                property_name: liveBooking.listing_name || '',
                address: '',
                address_line_2: '',
                city: '',
                state: '',
                country: '',
                image: liveBooking.cover_image || '',
                start: liveBooking.start || null,
                end: liveBooking.end || null,
                check_in_date: liveBooking.start ? format(new Date(liveBooking.start), 'dd MMMM yyyy') : null,
                check_out_date: liveBooking.end ? format(new Date(liveBooking.end), 'dd MMMM yyyy') : null,
                nights: 0,
                status: liveBooking.status || liveBooking.BookingStatus || liveBooking.currentStatus || '',
                amount: liveBooking.amount || 0,
                amount_before_tax: liveBooking.amount_before_tax || 0,
                tax: liveBooking.tax || 0,
                commission: 0,
                source: 'live',
                transaction_id: '',
                voucher_no: '',
                booked_by: '',
                payment_method: '',
                guest_name: '',
                guest_email: '',
                guest_phone: liveBooking.Mobile || '',
                total_guests: Number(liveBooking.adults || 0) + Number(liveBooking.children || 0),
                is_declaration_done: liveBooking.declaration === 1 || liveBooking.esign_status === 'success',
                is_payment_done: liveBooking.security_deposit_paid === 1 || liveBooking.security_deposit_status === 'paid',
                filled_guests_count: liveBooking.filled_guests_count || 0,
                rental_info: [],
                guests: [],
                property: {
                    id: liveBooking.property_id,
                    listing_name: liveBooking.listing_name,
                    image: liveBooking.cover_image || ''
                }
            };
        }

        if (!bookingData) {
            return Response.error(res, "ERROR", "Booking not found or you don't have permission to view this booking", 404);
        }

        // Calculate today's booking stats
        const today = format(new Date(), 'yyyy-MM-dd');
        const isUpcoming = bookingData.start && bookingData.start > today;
        const isPast = bookingData.end && bookingData.end < today;
        const isCancelled = bookingData.status && (
            bookingData.status.toLowerCase() === 'cancel' || 
            bookingData.status.toLowerCase() === 'void' || 
            bookingData.status.toLowerCase() === 'cancelled'
        );

        // Response with full booking data
        return res.status(200).json({
            success: true,
            data: {
                booking: bookingData,
                status_info: {
                    is_upcoming: isUpcoming,
                    is_past: isPast,
                    is_cancelled: isCancelled,
                    is_current: !isUpcoming && !isPast && !isCancelled
                }
            }
        });

    } catch (error) {
        console.error('USERBOOKINGBYID ERROR:', error);
        return res.status(500).json({
            success: false,
            error: "Unable to fetch booking details",
            message: error.message
        });
    }
};

const createDummyBooking = async (req, res) => {
    try {
        // Get user from token
        const userObj = req.user;
        let userId = userObj?.id || userObj?.user?.id;
        
        // Or accept userId in body for admin testing
        if (!userId && req.body.userId) {
            userId = req.body.userId;
        }
        
        if (!userId) {
            return Response.error(res, "ERROR", "User ID required", 400);
        }

        // Get a property
        const propResult = await db.query("SELECT id, listing_name FROM properties LIMIT 1");
        if (!propResult[0] || propResult[0].length === 0) {
            return Response.error(res, "ERROR", "No properties found", 400);
        }
        const propertyId = propResult[0][0].id;
        
        // Generate unique IDs
        const uniqueId = Math.floor(Math.random() * 900000) + 100000;
        const subBookingId = 'SUB' + uniqueId;
        
        // Create booking
        const bookingData = {
            uniqueId: uniqueId,
            subBookingId: subBookingId,
            transaction_id: 'TXN' + uniqueId,
            property_id: propertyId,
            guest_id: userId,
            user_id: userId,
            createDatetime: new Date(),
            modifyDatetime: new Date(),
            status: 'Confirmed',
            isConfirmed: 1,
            currentStatus: 'Confirm',
            voucherNo: 'VOUCHER' + uniqueId,
            start: '2026-02-20',
            end: '2026-02-25',
            arrivalTime: '14:00:00',
            departureTime: '10:00:00',
            bookedBy: 'Direct',
            source: 'website',
            paymentMethod: 'Online Payment',
            isChannelBooking: 0,
            lastOperation: 'Test Booking Created'
        };
        
        const bookingResult = await db.query("INSERT INTO bookings SET ?", [bookingData]);
        const bookingId = bookingResult[0].insertId;
        
        // Add tariff
        await db.query(`INSERT INTO booking_tariffs 
            (booking_id, currencyCode, totalAmountAfterTax, totalAmountBeforeTax, totalTax, totalDiscount, totalExtraCharge, totalPayment, taCommision) 
            VALUES (?, 'INR', 25000, 21228, 3771, 0, 0, 25000, 2500)`, 
            [bookingId]);
        
        // Add rental info for 5 nights
        for (let d = 20; d <= 24; d++) {
            const date = `2026-02-${d.toString().padStart(2, '0')}`;
            await db.query(`INSERT INTO booking_rentalinfo 
                (booking_id, effectiveDate, adult, child, rent, rentPreTax, discount) 
                VALUES (?, ?, 2, 0, 4245, 3600, 0)`, 
                [bookingId, date]);
        }
        
        // Add guest info to guest_details
        const [[user]] = await db.query('SELECT firstname, lastname, email, phone FROM users WHERE id = ?', [userId]);
        await db.query(`INSERT INTO guest_details (booking_id, first_name, last_name, email, mobile, is_lead) VALUES (?, ?, ?, ?, ?, 1)`, 
            [bookingId, user.firstname, user.lastname, user.email, user.phone]);
        
        return Response.success(res, { 
            message: "Dummy booking created successfully",
            bookingId: bookingId,
            userId: userId,
            propertyId: propertyId
        }, 201);
        
    } catch (error) {
        console.error('Create dummy booking error:', error);
        return Response.error(res, "ERROR", "Failed to create dummy booking: " + error.message, 500);
    }
};

// Get booking guests for a specific booking
const getBookingGuests = async (req, res) => {
    try {
        const userObj = req.user;
        
        let userId = null;
        if (userObj) {
            userId = userObj.id || userObj.user?.id;
        }
        
        if (!userId) {
            return Response.error(res, "ERROR", "Unauthorized - Invalid token. Please login first.", 401);
        }

        const { bookingId } = req.params;
        
        if (!bookingId) {
            return Response.error(res, "ERROR", "Booking ID is required", 400);
        }

        console.log('=== getBookingGuests API Called ===');
        console.log('getBookingGuests - bookingId:', bookingId);
        console.log('getBookingGuests - userId:', userId);

        // Precheckin: portal user_id only
        const bookingCheck = await db.query(
            `SELECT id, guest_id, user_id FROM bookings WHERE id = ? AND ${precheckinPortalWhere()}`,
            [bookingId, ...precheckinPortalParams(userId)]
        );

        if (!bookingCheck[0] || bookingCheck[0].length === 0) {
            return Response.error(res, "ERROR", "Booking not found or you don't have permission", 404);
        }

        // Get guests from guest_details table linked directly with booking_id
        const guestsResult = await db.query(
            `SELECT * FROM guest_details
             WHERE booking_id = ? 
             ORDER BY is_lead DESC, id ASC`, 
            [bookingId]
        );

        const guests = guestsResult[0] || [];

        return res.status(200).json({
            success: true,
            data: {
                booking_id: parseInt(bookingId),
                guests: guests.map(g => ({
                    id: g.id,
                    name: g.first_name ? `${g.first_name} ${g.last_name || ''}`.trim() : g.first_name,
                    email: g.email,
                    phone: g.mobile,
                    type: g.guest_type,
                    age: g.age,
                    gender: g.gender,
                    id_proof_type: g.id_proof_type,
                    id_proof_number: g.id_proof_number,
                    is_primary: g.is_lead === 1
                }))
            }
        });

    } catch (error) {
        console.error('GETBOOKINGGUESTS ERROR:', error);
        return res.status(500).json({
            success: false,
            error: "Unable to fetch booking guests",
            message: error.message
        });
    }
};

// Add/update booking guests for a specific booking
const saveBookingGuests = async (req, res) => {
    try {
        const userObj = req.user;
        
        let userId = null;
        if (userObj) {
            userId = userObj.id || userObj.user?.id;
        }
        
        if (!userId) {
            return Response.error(res, "ERROR", "Unauthorized - Invalid token. Please login first.", 401);
        }

        const { bookingId } = req.params;
        const { guests } = req.body;
        
        if (!bookingId) {
            return Response.error(res, "ERROR", "Booking ID is required", 400);
        }

        if (!guests || !Array.isArray(guests) || guests.length === 0) {
            return Response.error(res, "ERROR", "Guests array is required", 400);
        }

        console.log('=== saveBookingGuests API Called ===');
        console.log('saveBookingGuests - bookingId:', bookingId);
        console.log('saveBookingGuests - userId:', userId);
        console.log('saveBookingGuests - guests:', guests);

        const bookingCheck = await db.query(
            `SELECT id, guest_id, user_id FROM bookings WHERE id = ? AND ${precheckinPortalWhere()}`,
            [bookingId, ...precheckinPortalParams(userId)]
        );

        if (!bookingCheck[0] || bookingCheck[0].length === 0) {
            return Response.error(res, "ERROR", "Booking not found or you don't have permission", 404);
        }
          // Delete existing guests for this booking in guest_details
        await db.query("DELETE FROM guest_details WHERE booking_id = ?", [bookingId]);

        // Insert new guests directly into guest_details
        for (const guest of guests) {
            await db.query(
                `INSERT INTO guest_details 
                    (booking_id, first_name, last_name, email, mobile, gender, guest_type, age, id_proof_type, id_proof_number, is_lead) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    bookingId,
                    guest.name?.split(' ')[0] || '',
                    guest.name?.split(' ').slice(1).join(' ') || '',
                    guest.email || '',
                    guest.phone || '',
                    guest.gender || '',
                    guest.type || 'family',
                    guest.age || 0,
                    guest.id_proof_type || '',
                    guest.id_proof_number || '',
                    guest.is_primary ? 1 : 0
                ]
            );
        }

        // Fetch and return updated guests
        const [updatedGuests] = await db.query(
            "SELECT * FROM guest_details WHERE booking_id = ? ORDER BY is_lead DESC, id ASC", 
            [bookingId]
        );
      

        return res.status(200).json({
            success: true,
            message: "Guests saved successfully",
            data: {
                booking_id: parseInt(bookingId),
                total_guests: (updatedGuests[0] || []).length,
                guests: (updatedGuests || []).map(g => ({
                    id: g.id,
                    name: g.first_name ? `${g.first_name} ${g.last_name || ''}`.trim() : g.first_name,
                    email: g.email,
                    phone: g.mobile,
                    type: g.guest_type,
                    age: g.age,
                    gender: g.gender,
                    id_proof_type: g.id_proof_type,
                    id_proof_number: g.id_proof_number,
                    is_primary: g.is_lead === 1
                }))
            }
        });

    } catch (error) {
        console.error('SAVEBOKINGGUESTS ERROR:', error);
        return res.status(500).json({
            success: false,
            error: "Unable to save booking guests",
            message: error.message
        });
    }
};

const exchangeCheckinToken = async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            return res.status(400).json({ success: false, message: 'Token is required' });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        } catch (err) {
            return res.status(401).json({ success: false, message: 'Invalid or expired token' });
        }

        const payload = decoded.user || decoded;
        if (!payload || payload.type !== 'checkin_autologin') {
            return res.status(401).json({ success: false, message: 'Invalid token type' });
        }

        const user = await User.getById(payload.id);
        const userRecord = Array.isArray(user) ? user[0] : user;
        if (!userRecord) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const guestToken = jwt.sign(
            {
                user: {
                    phone: userRecord.phone,
                    id: userRecord.id,
                    transExpiry: Math.round(Date.now() / 1000) + (60 * 60),
                },
            },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: '7d' }
        );

        const userData = {
            id: userRecord.id,
            firstname: userRecord.firstname,
            lastname: userRecord.lastname,
            email: userRecord.email,
            phone: userRecord.phone,
        };

        return res.status(200).json({ success: true, guestToken, user: userData });
    } catch (error) {
        console.error("exchangeCheckinToken error:", error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = {
    registerUser,
    registerWithPhone,
    loginUser,
    currentUser,
    check,
    getProfile,
    updateProfile,
    registerWithPhone_user,
    verifyOTP,
    UserLogout,
    Userbooking,
    createDummyBooking,
    UserbookingById,
    getBookingGuests,
    saveBookingGuests,
    exchangeCheckinToken
};
