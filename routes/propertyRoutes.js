const express = require('express')
const router = express.Router()

const propertyController = require('../controllers/propertyController');
const PropertyController = new propertyController();
const validateCookieToken = require("../middleware/cookieTokenHandler");
const multer = require('multer');
const validateToken = require('../middleware/validateTokenHandler');
const { validateTokenOrCookie } = require('../middleware/validateTokenHandler');
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: {
        // Property photos from phones are often >5MB; keep in sync with reverse-proxy client_max_body_size
        fileSize: 20 * 1024 * 1024, // 20MB
        fieldSize: 20 * 1024 * 1024
    }
});


/**
 * @swagger
 * tags:
 *   name: Properties
 *   description: Property management APIs
 */

/**
 * @swagger
 * /api/properties/list:
 *   get:
 *     summary: Get all properties list
 *     tags: [Properties]
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/list', validateCookieToken, PropertyController.list);

/**
 * @swagger
 * /api/properties/settings:
 *   get:
 *     summary: Get property-related configuration settings
 *     tags: [Properties]
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/settings',PropertyController.propertySettings);

router.post('/', upload.any(), PropertyController.create.bind(PropertyController));
router.post('/x', upload.any(), PropertyController.create.bind(PropertyController));
router.post('/save', upload.any(), PropertyController.save.bind(PropertyController));
router.get('/settingsWithUsers',PropertyController.propertySettingsWithUsers);

/* admin routes */
router.get('/listing', PropertyController.listing.bind(PropertyController));
router.get('/new_listing', PropertyController.newListing);
router.get('/add', PropertyController.add);
router.get('/edit/:id', PropertyController.edit);
router.get('/test', (req, res) => {
    res.sendFile(__dirname + '/../test_minimal.html');
});
router.get('/otaListings/:id', PropertyController.edit);
router.post('/replace-image', validateTokenOrCookie, upload.any(), PropertyController.replaceDisplayImage.bind(PropertyController));
router.post('/delete-image', validateTokenOrCookie, PropertyController.deleteImage.bind(PropertyController));
router.post('/delete-property', validateTokenOrCookie, PropertyController.deleteProperty.bind(PropertyController));
router.post('/upload-image', validateTokenOrCookie, upload.any(), PropertyController.uploadImage.bind(PropertyController));
router.post('/refresh-room-inventory', validateTokenOrCookie, PropertyController.refreshRoomInventory.bind(PropertyController));
router.post('/fix-all-inventories', validateTokenOrCookie, PropertyController.fixAllPropertyInventories.bind(PropertyController));

module.exports = router
