const express = require('express')
const router = express.Router()
const validateToken = require('../middleware/validateTokenHandler');

const settingsController = require('../controllers/settingsController');
const SettingsController = new settingsController();

router.get('/:setting/:category?', SettingsController.getSettings);
router.post('/', validateToken, function(...args) {
    return SettingsController.addSetting(...args);
});
router.put('/:id', validateToken, function(...args) {
    return SettingsController.editSetting(...args);
});
router.delete('/:id', validateToken, function(...args) {
    return SettingsController.deleteSetting(...args);
});

module.exports = router