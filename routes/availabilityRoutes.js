const express = require('express')
const router = express.Router()

const EzeeHelper = require('../helpers/ezeeHelper');
// Use EZEE_BASE_URL or EZEE_URL from env, with fallback
const ezeeUrl = process.env.EZEE_BASE_URL || process.env.EZEE_URL || 'https://live.ipms247.com/';
const ezeeHelper = new EzeeHelper(ezeeUrl);
const availabilityController = require('../controllers/availabilityController');
const AvailabilityController = new availabilityController(ezeeHelper);
const validateToken = require("../middleware/validateTokenHandler");

//Retrieve all employees
router.get('/findByDates', function(...args) {
    return AvailabilityController.findByDates(...args)
});

router.get('/checkAvailability', function(...args) {
    return AvailabilityController.find(...args)
});
module.exports = router