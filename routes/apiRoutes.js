const express = require('express')
const router = express.Router()

const EzeeHelper = require('../helpers/ezeeHelper');
// Use EZEE_BASE_URL or EZEE_URL from env, with fallback
const ezeeUrl = process.env.EZEE_BASE_URL || process.env.EZEE_URL || 'https://live.ipms247.com/';
const ezeeHelper = new EzeeHelper(ezeeUrl);
const availabilityController = require('../controllers/availabilityController');
const AvailabilityController = new availabilityController(ezeeHelper);
const bookingsController = require('../controllers/bookingsController');
const BookingsController = new bookingsController(ezeeHelper);
const UsersControllerClass = require('../controllers/usersController');
const UsersController = new UsersControllerClass();
const settingsController = require('../controllers/settingsController');
const SettingsController = new settingsController();

const { check, getProfile, updateProfile} = require("../controllers/userController");
const validateToken = require("../middleware/validateTokenHandler");
const { optionalToken } = require("../middleware/validateTokenHandler");
const loggedInGuest = require("../middleware/loggedInGuestHandler");
const hostsController = require('../controllers/hostsController');
const HostsController = new hostsController();
const formsController = require('../controllers/formsController');
const propertyController = require('../controllers/propertyController');
const PropertyController = new propertyController;
const FormsController = new formsController();
const propertyDetailsController = require('../controllers/propertyDetailsController');
const PropertyDetailsController = new propertyDetailsController(ezeeHelper);
const { generateOTPRules, loginWithOTPRules, submitFormRules, hostEnquiryRules, updateProfileRules, createBookingRules } = require("../middleware/validationRules");

const ConciergeRequestControllerClass = require('../controllers/conciergeRequestController');
const ConciergeRequestController = new ConciergeRequestControllerClass();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

// Zoop Gateway
const zoopController = require('../controllers/zoopController');

/**
 * @swagger
 * tags:
 *   name: Guest Services
 *   description: Guest facing APIs for availability and bookings
 */

/**
 * @swagger
 * /api/ext/checkAvailability:
 *   post:
 *     summary: Find available properties for given dates and guests
 *     tags: [Guest Services]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - start_date
 *               - end_date
 *               - adults
 *             properties:
 *               start_date:
 *                 type: string
 *                 format: date
 *                 example: "2026-03-01"
 *               end_date:
 *                 type: string
 *                 format: date
 *                 example: "2026-03-05"
 *               adults:
 *                 type: integer
 *                 example: 2
 *               children:
 *                 type: integer
 *                 example: 0
 *     responses:
 *       200:
 *         description: Success
 */
router.post('/checkAvailability', optionalToken, function(...args) {
      return AvailabilityController.find(...args)
  });

/**
 * @swagger
 * /api/ext/stayListing:
 *   post:
 *     summary: Paginated property listing for the /stay/all page
 *     tags: [Guest Services]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               page:
 *                 type: integer
 *                 default: 1
 *               limit:
 *                 type: integer
 *                 default: 20
 *               check_in_date:
 *                 type: string
 *                 format: date
 *               check_out_date:
 *                 type: string
 *                 format: date
 *               number_adults:
 *                 type: integer
 *               number_children:
 *                 type: integer
 *               collection:
 *                 type: string
 *                 description: Collection slug for filtering by category tab
 *               is_pet_friendly:
 *                 type: boolean
 *                 description: When true, filters stay listing by the "Pet Friendly" category
 *     responses:
 *       200:
 *         description: Paginated property list with total count
 */
router.post('/stayListing', optionalToken, function(...args) {
    return AvailabilityController.findPaginated(...args);
});

/**
 * Frontend: filtered property list by key with pagination
 * body/query: { key: 'for_events' | 'for_corporate_offsite', page, limit }
 */
router.post('/propertiesByKey', optionalToken, function(...args) {
    return PropertyController.paginatedFilteredProperties(...args);
});

// /generateToken removed — it was a public endpoint that issued never-expiring admin JWTs (critical vulnerability)
/**
 * @swagger
 * /api/ext/homeAvailability:
 *   post:
 *     summary: Find available properties for home page (minimal search)
 *     tags: [Guest Services]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - start_date
 *               - end_date
 *             properties:
 *               start_date:
 *                 type: string
 *                 format: date
 *               end_date:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Success
 */
router.post('/homeAvailability', optionalToken, function(...args) {
    return AvailabilityController.home(...args)
});

/**
 * @swagger
 * /api/ext/availabilityAndDetails:
 *   post:
 *     summary: Get pricing and detailed availability for a specific property
 *     tags: [Guest Services]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - check_in_date
 *               - check_out_date
 *             properties:
 *               propertyId:
 *                 type: integer
 *                 description: Internal property identifier (required if slug is absent)
 *               slug:
 *                 type: string
 *                 description: Property slug (alternative to propertyId)
 *               check_in_date:
 *                 type: string
 *                 format: date
 *                 example: "2026-03-01"
 *               check_out_date:
 *                 type: string
 *                 format: date
 *                 example: "2026-03-05"
 *               number_adults:
 *                 type: integer
 *                 description: Defaults to controller-calculated value when omitted
 *               number_children:
 *                 type: integer
 *                 description: Defaults to controller-calculated value when omitted
 *     responses:
 *       200:
 *         description: Success
 */
router.post('/availabilityAndDetails', function(...args) {
      return AvailabilityController.pricingAndDetails(...args)
  });

router.get('/properties/:slug/basic', function(...args) {
    return PropertyDetailsController.basicDetails(...args);
});
router.post('/properties/:slug/media', function(...args) {
    return PropertyDetailsController.media(...args);
});
router.post('/properties/:slug/price', function(...args) {
    return PropertyDetailsController.pricing(...args);
});
router.post('/properties/:slug/poi', function(...args) {
    return PropertyDetailsController.poi(...args);
});
router.post('/properties/:slug/nearby', function(...args) {
    return PropertyDetailsController.nearby(...args);
});

/**
 * @swagger
 * /api/ext/calendarAvailability:
 *   post:
 *     summary: Get calendar availability for a property
 *     tags: [Guest Services]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - property_id
 *             properties:
 *               property_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.post('/calendarAvailability', function(...args) {
    return AvailabilityController.calendarAvailabilityForProperty(...args)
});

/** Alias for main frontend (stay-destination modal); same handler as calendarAvailability. */
router.post('/calendarAvailabilityImproved', function (...args) {
    return AvailabilityController.calendarAvailabilityForProperty(...args);
});

/**
 * @swagger
 * /api/ext/generateOTP:
 *   post:
 *     summary: Generate OTP for guest login
 *     tags: [Guest Services]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *             properties:
 *               phone:
 *                 type: string
 *                 example: "+919876543210"
 *     responses:
 *       200:
 *         description: OTP sent
 */
router.post('/generateOTP', generateOTPRules, UsersController.generateGuestOTP);
  
  /**
   * @swagger
   * /api/ext/loginWithOTP:
 *   post:
 *     summary: Login guest with phone and OTP
 *     tags: [Guest Services]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - otp
 *             properties:
 *               phone:
 *                 type: string
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.post('/loginWithOTP', loginWithOTPRules, function(...args) {
    return UsersController.guestLoginWithOTP(...args)
});

router.post('/generateCheckinToken', loggedInGuest, function(...args) {
    return UsersController.generateCheckinToken(...args)
});

/**
 * @swagger
 * /api/ext/createBooking:
 *   post:
 *     summary: Create a new booking
 *     tags: [Guest Services]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - property_id
 *               - start_date
 *               - end_date
 *             properties:
 *               property_id:
 *                 type: integer
 *               start_date:
 *                 type: string
 *                 format: date
 *               end_date:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Created
 *     description: Requires Staymaster guest token (guestToken) via body or Authorization header
 */
router.post('/createBooking', loggedInGuest, createBookingRules, function (...args) {
    return BookingsController.create(...args);
});

router.post('/feedback/coupon', loggedInGuest, function (...args) {
    return BookingsController.generateFeedbackCoupon(...args);
});

/**
 * @swagger
 * /api/ext/myTrips:
 *   post:
 *     summary: Get all bookings for current guest
 *     tags: [Guest Services]
 *     description: Requires Staymaster guest token (guestToken) via body or Authorization header
 *     responses:
 *       200:
 *         description: Success
 */
router.post('/myTrips',loggedInGuest, BookingsController.myTrips);

/**
 * @swagger
 * /api/ext/getProfile:
 *   get:
 *     summary: Get profile of logged-in guest
 *     tags: [Guest Services]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/getProfile',validateToken, getProfile);

/**
 * @swagger
 * /api/ext/updateProfile:
 *   post:
 *     summary: Update profile of logged-in guest
 *     tags: [Guest Services]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstname:
 *                 type: string
 *               lastname:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.post('/updateProfile',validateToken, updateProfileRules, updateProfile);
router.get('/masterKeyUrl', SettingsController.getMasterKeyUrl.bind(SettingsController));
router.get('/investorAppUrl', SettingsController.getInvestorAppUrl.bind(SettingsController));
/**
 * @swagger
 * /api/ext/concierge:
 *   post:
 *     summary: Request concierge service for a booking
 *     tags: [Guest Services]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - booking_id
 *               - service_id
 *             properties:
 *               booking_id:
 *                 type: integer
 *               service_id:
 *                 type: integer
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Created
 */
router.post('/concierge',validateToken,loggedInGuest,function(...args){
    return BookingsController.concierge(...args);
});

router.post('/concierge/request', validateToken, loggedInGuest, function(...args){
    return ConciergeRequestController.create(...args);
});

router.get('/concierge/requests', validateToken, loggedInGuest, function(...args){
    return ConciergeRequestController.listByBooking(...args);
});

/**
 * @swagger
 * /api/ext/myBooking/{id}:
 *   get:
 *     summary: Get specific booking details by ID
 *     tags: [Guest Services]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The booking ID
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/myBooking/:id', optionalToken, loggedInGuest, BookingsController.displayInfo);

/**
 * @swagger
 * /api/ext/check:
 *   post:
 *     summary: Check if guest is currently logged in
 *     tags: [Guest Services]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged in
 */
router.post('/check',loggedInGuest,check);
router.delete('/clearAllUserData', validateToken, loggedInGuest, UsersController.clearAllUserData);
router.delete('/users/clearAllUserData', validateToken, loggedInGuest, UsersController.clearAllUserData);

/**
 * @swagger
 * /api/ext/hostCalculatorSettings:
 *   post:
 *     summary: Get host earnings calculator settings
 *     tags: [Host Services]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.post('/hostCalculatorSettings',optionalToken, function(...args) {
    return HostsController.hostCalculatorSettings(...args)
});

/**
 * @swagger
 * /api/ext/generateHostOTP:
 *   post:
 *     summary: Generate OTP for host login
 *     tags: [Host Services]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *             properties:
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP sent
 */
router.post('/generateHostOTP', function(...args) {
    return HostsController.generateOTP(...args)
});

/**
 * @swagger
 * /api/ext/hostEnquiry:
 *   post:
 *     summary: Submit a new host enquiry
 *     tags: [Host Services]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - phone
 *               - property_name
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               property_name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Submitted
 */
router.post('/hostEnquiry', optionalToken, hostEnquiryRules, function(...args) {
    return HostsController.hostEnquiry(...args)
});

/**
 * @swagger
 * /api/ext/generateOrderId:
 *   post:
 *     summary: Generate Razorpay order ID for booking payment
 *     tags: [Guest Services]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Success
 */
router.post('/generateOrderId',optionalToken,loggedInGuest,function(...args){
    return BookingsController.generateOrderId(...args);
});

router.post('/verifyPayment',optionalToken,loggedInGuest,function(...args){
    return BookingsController.verifyPayment(...args);
});

router.post('/booking/questionnaire', optionalToken, loggedInGuest, function(...args){
    return BookingsController.saveGuestQuestionnaire(...args);
});
router.post('/booking/booker', validateToken, loggedInGuest, function(...args){
    return BookingsController.saveBookerDetails(...args);
});
router.get('/booking/:id/nearby', optionalToken, loggedInGuest, function(...args){
    return BookingsController.nearbyAttractions(...args);
});
router.post('/feedback/submit', optionalToken, loggedInGuest, function(...args){
    return BookingsController.submitFeedback(...args);
});
router.post('/myBooking/:id/cancel', optionalToken, loggedInGuest, function(...args){
    return BookingsController.requestCancellation(...args);
});

/**
 * @swagger
 * /api/ext/submitForm:
 *   post:
 *     summary: Submit a generic form (e.g. contact, inquiry)
 *     tags: [Guest Services]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - form_id
 *             properties:
 *               form_id:
 *                 type: string
 *               data:
 *                 type: object
 *     responses:
 *       201:
 *         description: Submitted
 */
router.post('/submitForm', optionalToken, submitFormRules, function(...args){
    return FormsController.submitForm(...args);
});

// Sync endpoints require authentication — they trigger heavyweight Ezee PMS operations
router.post('/ezeeBookingSync', validateToken, function(...args){
    return BookingsController.ezeeBookingSync(...args);
});
router.post('/historicalBookings', validateToken, function(...args){
    return BookingsController.historicalBookings(...args);
});
router.post('/importEzeeSyncLogs', validateToken, function(...args){
    return BookingsController.importEzeeSyncLogs(...args);
});
router.get('/missedOutBookings', BookingsController.missedOutBookings.bind(BookingsController));
router.get('/formSettings',optionalToken,FormsController.formSettings);

// Instagram routes
const instagramRoutes = require('./instagramRoutes');
router.use('/instagram', instagramRoutes);

/**
 * @swagger
 * /api/ext/zoop/verifyPAN:
 *   post:
 *     summary: Verify PAN number using Zoop Gateway
 *     tags: [Zoop]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pan_number
 *             properties:
 *               pan_number:
 *                 type: string
 *                 description: The PAN number to verify
 *     responses:
 *       200:
 *         description: PAN verified successfully
 *       400:
 *         description: PAN number is required
 *       401:
 *         description: Unauthorized
 */
router.post('/zoop/verifyPAN', validateToken, zoopController.verifyPAN);
router.post('/zoop/verifyDL', validateToken, zoopController.verifyDL);

/**
 * @swagger
 * /api/ext/zoop/aadhaar/generateOTP:
 *   post:
 *     summary: Generate Aadhaar OTP using Zoop Gateway
 *     tags: [Zoop]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - aadhaar_number
 *             properties:
 *               aadhaar_number:
 *                 type: string
 *                 description: The Aadhaar number to generate OTP for
 *     responses:
 *       200:
 *         description: OTP generated successfully
 */
router.post('/zoop/aadhaar/generateOTP', validateToken, zoopController.generateAadhaarOTP);

/**
 * @swagger
 * /api/ext/zoop/aadhaar/verifyOTP:
 *   post:
 *     summary: Verify Aadhaar OTP using Zoop Gateway
 *     tags: [Zoop]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - request_id
 *               - otp
 *             properties:
 *               request_id:
 *                 type: string
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: Aadhaar verified successfully
 */
router.post('/zoop/aadhaar/verifyOTP', validateToken, zoopController.verifyAadhaarOTP);
router.post('/zoop/esign/init', validateToken, zoopController.initEsign);
router.post('/zoop/esign/webhook', zoopController.esignWebhook);
// Accepts Zoop POST redirect after signing → converts to a GET redirect to the frontend
router.post('/zoop/esign/return', zoopController.esignReturn);
router.get('/zoop/esign/return', zoopController.esignReturn);

/**
 * @swagger
 * /api/ext/zoop/verifyGST:
 *   post:
 *     summary: Verify GST number using Zoop Gateway
 *     tags: [Zoop]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - gst_number
 *             properties:
 *               gst_number:
 *                 type: string
 *     responses:
 *       200:
 *         description: GST verified successfully
 */
router.post('/zoop/verifyGST', validateToken, zoopController.verifyGST);

// Invoice
router.get('/invoice/:bookingId', validateToken, function(...args){
    return BookingsController.getInvoice(...args);
});

// Guest Profile & Form Details
router.get('/guest-details', optionalToken, BookingsController.getGuestDetails.bind(BookingsController));
router.post('/guest-details', optionalToken, upload.single('idFile'), BookingsController.updateGuestDetails.bind(BookingsController));
router.delete('/guest-details/clear', optionalToken, BookingsController.clearGuestBookingData.bind(BookingsController));

// Abandoned Booking (partial checkout progress)
const AbandonedBookingControllerClass = require('../controllers/abandonedBookingController');
const AbandonedBookingController = new AbandonedBookingControllerClass();
router.post('/abandoned-booking/save', loggedInGuest, (req, res) => AbandonedBookingController.save(req, res));
router.get('/abandoned-booking/resume', loggedInGuest, (req, res) => AbandonedBookingController.resume(req, res));
router.post('/abandoned-booking/complete', loggedInGuest, (req, res) => AbandonedBookingController.complete(req, res));

// Guest Notifications
const notificationsControllerClass = require('../controllers/notificationsController');
const NotificationsControllerInst = new notificationsControllerClass();
router.get('/notifications', optionalToken, NotificationsControllerInst.list.bind(NotificationsControllerInst));
router.post('/notifications/read-all', optionalToken, NotificationsControllerInst.markAllRead.bind(NotificationsControllerInst));
router.post('/notifications/:id/read', optionalToken, NotificationsControllerInst.markRead.bind(NotificationsControllerInst));

// Multer error handler for file size exceeded
router.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ message: 'File size exceeds the 5MB limit.' });
  }
  next(err);
});

module.exports = router
