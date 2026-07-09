const express = require('express')
const router = express.Router()

const authenticateUser = require("../middleware/userAuthenticationHandler");
const EzeeHelper = require('../helpers/ezeeHelper');
// Use EZEE_BASE_URL or EZEE_URL from env, with fallback
const ezeeUrl = process.env.EZEE_BASE_URL || process.env.EZEE_URL || 'https://live.ipms247.com/';
const ezeeHelper = new EzeeHelper(ezeeUrl);

const bookingsController = require('../controllers/bookingsController');
const BookingsController = new bookingsController(ezeeHelper);
const dashboardController = require('../controllers/dashboardController');
const DashboardController = new dashboardController();
const usersController = require('../controllers/usersController');
const UsersController = new usersController;
const serviceRequestController = require('../controllers/serviceRequestController');
const ServiceRequestController = new serviceRequestController;
const settingsController = require('../controllers/settingsController');
const SettingsController = new settingsController;
const { loginUser } = require("../controllers/userController");
const hostsController = require('../controllers/hostsController');
const HostsController = new hostsController;
const formsController = require('../controllers/formsController');
const FormsController = new formsController;
const propertyController = require('../controllers/propertyController');
const PropertyController = new propertyController;
const availabilityController = require('../controllers/availabilityController');
const AvailabilityController = new availabilityController(ezeeHelper);
const statementsController = require('../controllers/statementsController');
const StatementsController = new statementsController;
const liveBookingController = require('../controllers/liveBookingController');
const LiveBookingController = new liveBookingController();
const leadsController = require('../controllers/leadsController');
const LeadsController = new leadsController;
const bannerController = require('../controllers/bannerController');
const BannerController = bannerController;
const brochureController = require('../controllers/brochureController');
const BrochureController = new brochureController;

const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
        fieldSize: 10 * 1024 * 1024
    }
});
const bannerUpload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit for banners
        fieldSize: 10 * 1024 * 1024
    }
});
const brochureUpload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit for brochures
        fieldSize: 10 * 1024 * 1024
    }
});

/* login and logout*/
/**
 * @swagger
 * tags:
 *   name: Admin Backend
 *   description: Administrative dashboard APIs
 */

/**
 * @swagger
 * /admin/handleLogin:
 *   post:
 *     summary: Admin dashboard login
 *     tags: [Admin Backend]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
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
router.post("/handleLogin", upload.any(), UsersController.loginUser);

/**
 * @swagger
 * /admin/:
 *   get:
 *     summary: Admin dashboard index page
 *     tags: [Admin Backend]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/',authenticateUser,DashboardController.index.bind(DashboardController));

/**
 * @swagger
 * /admin/me:
 *   get:
 *     summary: Get current admin user details
 *     tags: [Admin Backend]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/me',authenticateUser,UsersController.me);

router.get('/login/:flash?',(req,res)=>{
    const flash = req.params.flash || '';
    res.render('login',{flash:flash});
});
router.get('/logout',(req,res)=>{
    res.clearCookie('authcookie');
    res.render('login',{flash:''});
});
router.get('/forgotPassword',(req,res)=>{
    res.render('forgotPassword');
});
// /check removed — BookingsController.check was a debug stub with hardcoded production room IDs

  router.post('/chart/',upload.any(),authenticateUser,DashboardController.updateChart.bind(DashboardController));
router.get('/revenues',authenticateUser,DashboardController.revenues.bind(DashboardController));

/**
 * @swagger
 * /admin/bookings:
 *   get:
 *     summary: List all bookings
 *     tags: [Admin Backend]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/bookings/",authenticateUser,BookingsController.bookingsList);

/**
 * @swagger
 * /admin/guests:
 *   get:
 *     summary: List all guests
 *     tags: [Admin Backend]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/guests/",authenticateUser,UsersController.guests.bind(UsersController));

// New route for stacked earnings chart data
router.get('/stacked-earnings',authenticateUser,DashboardController.stackedEarningsData.bind(DashboardController));
router.get("/checkUnique/:type/:value/:userType/:currentId?",authenticateUser,UsersController.checkUnique);

/* admin booking routes */
router.get("/manageBookings/",authenticateUser,BookingsController.manageBookingsList);
router.get("/bookings/edit/:id",authenticateUser,BookingsController.bookingDetails);
router.get("/bookings/adjust/:id",authenticateUser,BookingsController.adjustPrices);

/* admin live booking information routes */
router.get("/liveBookingInfo/",authenticateUser,LiveBookingController.index.bind(LiveBookingController));
router.get("/api/liveBookingInfo/bookings",authenticateUser,LiveBookingController.getBookings.bind(LiveBookingController));
router.get("/api/liveBookingInfo/statistics",authenticateUser,LiveBookingController.getStatistics.bind(LiveBookingController));
router.post("/api/liveBookingInfo/sync",authenticateUser,LiveBookingController.manualSync.bind(LiveBookingController));

/* admin calendar routes */
router.get('/bookingsCalendar',authenticateUser, async function(...args){
    const results = await PropertyController.basicList(...args);
    return args[0].res.render('reservations/calendar.ejs',{properties:results});
});
router.get('/propertyCalendar/',authenticateUser, AvailabilityController.datesByProperty);
router.post('/block',authenticateUser,function(...args){
    return BookingsController.block(...args);
});
router.post('/unblock',authenticateUser, function(...args){
    return BookingsController.unblock(...args);
});
router.get("/guests/edit/:id",authenticateUser,UsersController.userDetails.bind(UsersController));
router.get("/leads/", authenticateUser, LeadsController.index.bind(LeadsController));
router.get("/leads/export", authenticateUser, LeadsController.exportAll.bind(LeadsController));
router.post("/leads/form-image", upload.single('image'), authenticateUser, LeadsController.uploadFormImage.bind(LeadsController));

/* admin banner routes */
router.get("/banners/:flash?", authenticateUser, BannerController.index.bind(BannerController));
router.get("/banner/add", authenticateUser, BannerController.add.bind(BannerController));
router.get("/banner/edit/:id", authenticateUser, BannerController.edit.bind(BannerController));
router.post("/banner/create", bannerUpload.single('image'), authenticateUser, BannerController.createBannerAdmin.bind(BannerController));
router.post("/banner/update/:id", bannerUpload.single('image'), authenticateUser, BannerController.updateBannerAdmin.bind(BannerController));
router.post("/banner/delete/:id", upload.any(), authenticateUser, BannerController.deleteBannerAdmin.bind(BannerController));

/* admin brochure routes */
router.get("/brochures/:flash?", authenticateUser, BrochureController.index.bind(BrochureController));
router.post("/brochures/upload", brochureUpload.single('brochure'), authenticateUser, BrochureController.upload.bind(BrochureController));

/* admin staff and hosts routes */
/* admin staff and hosts routes */
router.get("/users/:type/:flash?",authenticateUser,UsersController.users.bind(UsersController));
router.get("/user/add/:type",authenticateUser,UsersController.add.bind(UsersController));
router.post("/user/create",upload.any(),authenticateUser,UsersController.create.bind(UsersController));
router.get("/user/edit/:id",authenticateUser,UsersController.edit.bind(UsersController));
router.post("/user/save",upload.any(),authenticateUser,UsersController.save.bind(UsersController));
router.get("/changePassword/:id?",authenticateUser,UsersController.changePassword.bind(UsersController));
router.post("/savePassword",upload.any(),authenticateUser,UsersController.savePassword.bind(UsersController));
router.post('/generateOTP',upload.any(), UsersController.generateUserOTP.bind(UsersController));
router.post("/resetPassword",upload.any(),UsersController.resetPassword.bind(UsersController));

/* admin service requests routes */
router.get("/services/:flash?",authenticateUser,ServiceRequestController.index.bind(ServiceRequestController));
// /service/check removed — was an empty stub that never sent an HTTP response
router.get("/service/add",authenticateUser,ServiceRequestController.add.bind(ServiceRequestController));
router.post("/service/create", upload.any(),authenticateUser,ServiceRequestController.create.bind(ServiceRequestController));
router.get("/service/edit/:id",authenticateUser,ServiceRequestController.edit.bind(ServiceRequestController));
router.post("/service/save", upload.any(),authenticateUser,ServiceRequestController.save.bind(ServiceRequestController));
router.post("/service/updateStatus", upload.any(),authenticateUser,ServiceRequestController.updateStatus.bind(ServiceRequestController));
router.post("/service/delete-image",authenticateUser,ServiceRequestController.deleteImage);
router.post("/service/upload-image",upload.any(),authenticateUser,ServiceRequestController.uploadImage.bind(ServiceRequestController));

router.get("/forms/:flash?",authenticateUser,FormsController.index.bind(FormsController));

/* admin settings routes */
router.get("/settings/:flash?",authenticateUser,SettingsController.index);
router.post("/updateDiscount/",upload.any(),authenticateUser,SettingsController.updateDiscount.bind(SettingsController));
router.post("/updateMasterKeyUrl/",upload.any(),authenticateUser,SettingsController.updateMasterKeyUrl.bind(SettingsController));
router.post("/updateInvestorAppUrl/",upload.any(),authenticateUser,SettingsController.updateInvestorAppUrl.bind(SettingsController));
router.post("/updateHeroProperty/",upload.any(),authenticateUser,SettingsController.updateHeroProperty.bind(SettingsController));
router.get("/settings/add",authenticateUser,SettingsController.add);
router.get("/settings/edit/:id",authenticateUser,SettingsController.edit);

/* admin accounting routes */
router.get("/statements/:property_id/:flash?",authenticateUser,StatementsController.statementsForProperty.bind(StatementsController));
router.post("/uploadStatement",upload.any(),authenticateUser,StatementsController.uploadStatement.bind(StatementsController));

/* Ezee IDs */
router.get('/channel_ids',authenticateUser,function(...args){
    return BookingsController.channelIds(...args);
});

router.get("/hosts/:propertyId", authenticateUser, HostsController.hostsByProperty.bind(HostsController));
router.get('/importBooking/:id', BookingsController.importBooking.bind(BookingsController));
router.get('/importBookingBulk', BookingsController.importBookingBulk.bind(BookingsController));

router.get("/roomsInfo",PropertyController.roomsInfo.bind(PropertyController));

// /checkEmail removed — it was a dev-only email template preview function exposed via HTTP

/* admin property manager routes */
const UserModel = require('../models/userModel');
const UserModelInstance = new UserModel();
const PropertyModelForAdmin = require('../models/propertyModel');
const PropertyModelAdminInstance = new PropertyModelForAdmin();

// List all manager users
router.get('/managers/list', authenticateUser, async (req, res) => {
    try {
        const managers = await UserModelInstance.getManagers();
        return res.json({ success: true, data: managers });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// Create a new manager user
router.post('/managers/create', upload.any(), authenticateUser, async (req, res) => {
    try {
        const { firstname, lastname, email, password, phone } = req.body;
        if (!firstname || !email || !password) {
            return res.status(400).json({ success: false, error: 'firstname, email, and password are required.' });
        }
        const existing = await UserModelInstance.getByEmail(email);
        if (existing) {
            return res.status(400).json({ success: false, error: 'A user with this email already exists.' });
        }
        const manager = await UserModelInstance.createManager({ firstname, lastname, email, password, phone });
        return res.json({ success: true, data: manager });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// Assign manager to property
router.post('/property/:id/assign-manager', upload.any(), authenticateUser, async (req, res) => {
    try {
        const propertyId = req.params.id;
        const { managerId, managerType } = req.body;
        if (!managerId) {
            return res.status(400).json({ success: false, error: 'managerId is required.' });
        }
        await PropertyModelAdminInstance.assignManager(propertyId, managerId, managerType || 'property_manager_user_id');
        return res.json({ success: true, message: 'Manager assigned successfully.' });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// Get manager assignments for a property
router.get('/property/:id/managers', authenticateUser, async (req, res) => {
    try {
        const [rows] = await require('../config/dbConnection').query(
            `SELECT p.id, p.listing_name,
                    p.reservation_executive, p.hospitality_manager, p.revenue_manager, p.general_manager, p.property_manager_user_id,
                    u1.firstname as re_firstname, u1.lastname as re_lastname,
                    u2.firstname as hm_firstname, u2.lastname as hm_lastname,
                    u3.firstname as rm_firstname, u3.lastname as rm_lastname,
                    u4.firstname as gm_firstname, u4.lastname as gm_lastname,
                    u5.firstname as pm_firstname, u5.lastname as pm_lastname
             FROM properties p
             LEFT JOIN users u1 ON u1.id = p.reservation_executive
             LEFT JOIN users u2 ON u2.id = p.hospitality_manager
             LEFT JOIN users u3 ON u3.id = p.revenue_manager
             LEFT JOIN users u4 ON u4.id = p.general_manager
             LEFT JOIN users u5 ON u5.id = p.property_manager_user_id
             WHERE p.id = ?`, [req.params.id]
        );
        return res.json({ success: true, data: rows[0] || null });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
