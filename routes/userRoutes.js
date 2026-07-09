const express = require("express");
const {
    registerUser,
    loginUser,
    currentUser,
    registerWithPhone_user,
    verifyOTP,
    UserLogout,
    Userbooking,
    createDummyBooking,
    UserbookingById,
    getBookingGuests,
    saveBookingGuests,
    exchangeCheckinToken
} = require("../controllers/userController");
const validateToken = require("../middleware/validateTokenHandler");
const { optionalToken } = require("../middleware/validateTokenHandler");
const validateCookieToken = require("../middleware/cookieTokenHandler");

const EzeeHelper = require('../helpers/ezeeHelper');
const ezeeUrl = process.env.EZEE_BASE_URL || process.env.EZEE_URL || 'https://live.ipms247.com/';
const ezeeHelper = new EzeeHelper(ezeeUrl);
const bookingsController = require('../controllers/bookingsController');
const BookingsController = new bookingsController(ezeeHelper);

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User registration and login
 */

/**
 * @swagger
 * /api/users/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstname
 *               - lastname
 *               - email
 *               - password
 *             properties:
 *               firstname:
 *                 type: string
 *               lastname:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 */
router.post("/register", registerUser);

/**
 * @swagger
 * /api/users/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 */
router.post("/login", loginUser);

/**
 * @swagger
 * /api/users/current:
 *   get:
 *     summary: Get current logged-in user info
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/current", validateToken ,currentUser);
router.get("/current1", validateCookieToken ,currentUser);

/**
 * @swagger
 * /api/users/register-with-phone:
 *   post:
 *     summary: Register with phone number
 *     tags: [Authentication]
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
 *       201:
 *         description: User created
 */
router.post('/register-with-phone',registerWithPhone_user);

/**
 * @swagger
 * /api/users/verifyOTP:
 *   post:
 *     summary: Verify OTP for phone login
 *     tags: [Authentication]
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
 *         description: OTP verified
 */
router.post('/verifyOTP',verifyOTP);
router.post('/logout',validateToken, UserLogout);
router.post('/Logout',validateToken, UserLogout); // kept for backward compatibility
router.get('/Userbooking', optionalToken, Userbooking);
router.get('/Userbooking/:id', optionalToken, UserbookingById);
// router.post('/createDummyBooking', validateToken, createDummyBooking); // disabled in production

// User Details APIs - Get and Update user profile with guest details
/**
 * @swagger
 * /api/users/userDetails:
 *   get:
 *     summary: Get user profile details
 *     tags: [Guest Details]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/userDetails', validateToken, BookingsController.getGuestDetails.bind(BookingsController));

/**
 * @swagger
 * /api/users/userDetails:
 *   put:
 *     summary: Update user profile details
 *     tags: [Guest Details]
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
 *     responses:
 *       200:
 *         description: Updated
 */
router.put('/userDetails', validateToken, BookingsController.updateGuestDetails.bind(BookingsController));

// Guest Details APIs (alternative names)
router.get('/guestDetails', validateToken, BookingsController.getGuestDetails.bind(BookingsController));
router.put('/guestDetails', validateToken, BookingsController.updateGuestDetails.bind(BookingsController));

// Booking Guests APIs - Get and save additional guests for a booking
router.get('/bookingGuests/:bookingId', validateToken, getBookingGuests);
router.post('/bookingGuests/:bookingId', validateToken, saveBookingGuests);

router.post('/exchangeCheckinToken', exchangeCheckinToken);

module.exports = router;
