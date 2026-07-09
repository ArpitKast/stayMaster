const express = require('express');
const router = express.Router();

const LeadsController = new (require('../controllers/leadsController'))();

router.post('/', function(...args) {
    return LeadsController.create(...args);
});

router.get('/form-image', function(...args) {
    return LeadsController.getFormImage(...args);
});

module.exports = router;
