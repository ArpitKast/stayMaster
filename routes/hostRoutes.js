const express = require('express')
const router = express.Router()

const EzeeHelper = require('../helpers/ezeeHelper');
// Use EZEE_BASE_URL or EZEE_URL from env, with fallback
const ezeeUrl = process.env.EZEE_BASE_URL || process.env.EZEE_URL || 'https://live.ipms247.com/';
const ezeeHelper = new EzeeHelper(ezeeUrl);

const usersController = require('../controllers/usersController');
const UsersController = new usersController;
const propertyController = require('../controllers/propertyController');
const PropertyController = new propertyController;
const bookingsController = require('../controllers/bookingsController');
const BookingsController = new bookingsController(ezeeHelper);
const availabilityController = require('../controllers/availabilityController');
const AvailabilityController = new availabilityController(ezeeHelper);
const statementsController = require('../controllers/statementsController');
const StatementsController = new statementsController;

const validateToken = require("../middleware/validateTokenHandler");
const loggedInGuest = require("../middleware/loggedInGuestHandler");

const property = require("../models/propertyModel");
const Property = new property;
const booking = require("../models/bookingModel");
const Booking = new booking;
const smModel = require("../models/smModel");
const SMModel = new smModel;
const emailController = require("../controllers/emailController");
const EmailController = new emailController;
const reportsController = require("../controllers/reportsController");
const ReportsController = new reportsController;
const dashboardController = require("../controllers/dashboardController");
const DashboardController = new dashboardController;
const notificationsController = require("../controllers/notificationsController");
const NotificationsController = new notificationsController;

router.post('/generateOTP', UsersController.generateHostOTP);
router.post('/generateEmailOTP', UsersController.generateHostOTP);
//router.post('/generateEmailOTP',validateToken, UsersController.generateHostEmailOTP);
router.post('/loginWithOTP', function(...args) {
    return UsersController.hostLogin(...args)
});
router.post('/loginWithEmail', function(...args) {
    return UsersController.hostLogin(...args)
});
//reset password OR change password OR forgot password
//router.post('/resetPassword',validateToken, UsersController.resetHostPassword);
router.post('/resetPassword',validateToken,function(...args){
    return UsersController.resetHostPassword(...args);
});

router.post('/properties',validateToken,loggedInGuest,function(...args){
    return PropertyController.propertiesByHost(...args);
});//cumulative GBV and Nights
router.get('/properties/:id',validateToken,function(...args){
    return PropertyController.getPropertyById(...args);
});//get individual property details
router.post('/performance',validateToken,loggedInGuest,function(...args){
    return PropertyController.propertyPerformance(...args);
});
router.post('/earningsByMonth',validateToken,loggedInGuest,function(...args){
    return PropertyController.earningsByMonth(...args);
});
router.post('/stackedEarningsByMonth',validateToken,loggedInGuest,function(...args){
    return PropertyController.stackedEarningsByMonth(...args);
});
router.post('/detailedBookingsForMonth',validateToken,loggedInGuest,function(...args){
    return PropertyController.getDetailedBookingsForMonth(...args);
});
router.post('/listings',validateToken,loggedInGuest,function(...args){
    return PropertyController.otaLinks(...args);
});
router.post('/referAProperty',validateToken,loggedInGuest,function(...args){
    return PropertyController.referAProperty(...args);
});
router.post('/calendar',validateToken,loggedInGuest,function(...args){
    return PropertyController.calendar(...args);
});
router.post('/ratings',validateToken,loggedInGuest,function(...args){
    return PropertyController.propertyRatings(...args);
});
router.post('/bookingDetails',validateToken,loggedInGuest,function(...args){
    return BookingsController.bookingDetailsForHost(...args);
});
router.post('/pricingInfo',validateToken,loggedInGuest,function(...args){
    return AvailabilityController.pricingInfo(...args);
});
router.post('/edit',validateToken,loggedInGuest,function(...args){
    return UsersController.editHost(...args);
});
router.post('/update',validateToken,loggedInGuest,function(...args){
    return UsersController.updateHost(...args);
});
router.post('/block',validateToken,loggedInGuest,function(...args){
    return BookingsController.block(...args);
});
router.post('/unblock',validateToken,loggedInGuest,function(...args){
    return BookingsController.unblock(...args);
});
router.post('/revenueLoss', function(...args){
    return BookingsController.revenueLossEstimate(...args);
});
router.post('/monthlyStatements',validateToken,loggedInGuest,function(...args){
    return StatementsController.list(...args);
});
router.post('/downloadStatement',validateToken,loggedInGuest,function(...args){
    return StatementsController.download(...args);
});

// Email APIs
router.post('/send-booking-confirmation', validateToken, EmailController.sendBookingConfirmation.bind(EmailController));
router.post('/send-booking-cancellation', validateToken, EmailController.sendBookingCancellation.bind(EmailController));
router.post('/send-monthly-report', validateToken, EmailController.sendMonthlyReport.bind(EmailController));
router.post('/send-booking-details', validateToken, EmailController.sendBookingDetails.bind(EmailController));
router.post('/send-notification', validateToken, EmailController.sendNotification.bind(EmailController));

// Reports APIs
router.post('/generate-monthly-report', validateToken, ReportsController.generateMonthlyReport.bind(ReportsController));
router.get('/download-monthly-report/:propertyId/:month/:year', validateToken, ReportsController.downloadMonthlyReport.bind(ReportsController));

// Dashboard APIs
router.post('/stacked-earnings', validateToken, loggedInGuest, DashboardController.stackedEarningsData.bind(DashboardController));

// Notifications APIs
router.post('/notifications/register-device', validateToken, loggedInGuest, NotificationsController.registerDevice.bind(NotificationsController));
router.post('/notifications/send', validateToken, loggedInGuest, NotificationsController.send.bind(NotificationsController));
router.get('/notifications', validateToken, loggedInGuest, NotificationsController.list.bind(NotificationsController));
router.post('/notifications/:id/read', validateToken, NotificationsController.markRead.bind(NotificationsController));
router.post('/notifications/read-all', validateToken, loggedInGuest, NotificationsController.markAllRead.bind(NotificationsController));

module.exports = router
