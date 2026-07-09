const express = require("express");
const router = express.Router();
const destinationController = require('../controllers/destinationController');
const DestinationController = new destinationController();
const validateCookieToken = require("../middleware/cookieTokenHandler");

const multer = require('multer');
const validateToken = require("../middleware/validateTokenHandler");
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

/**
 * @swagger
 * tags:
 *   name: Destinations
 *   description: Travel destination management
 */

/**
 * @swagger
 * /api/destinations:
 *   get:
 *     summary: Get all travel destinations
 *     tags: [Destinations]
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/', DestinationController.getAllDestinations);

/**
 * @swagger
 * /api/destinations/{id}:
 *   get:
 *     summary: Get a single destination by ID
 *     tags: [Destinations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/:id', DestinationController.getDestinationById);

router.get('/list', validateCookieToken, DestinationController.getAllDestinations); // authenticated list
router.post('/',validateToken, upload.single('photo'), DestinationController.createDestination);
router.put('/:id',validateToken, upload.single('photo'), DestinationController.updateDestination);
router.delete('/:id',validateToken, DestinationController.deleteDestination);

module.exports = router;
