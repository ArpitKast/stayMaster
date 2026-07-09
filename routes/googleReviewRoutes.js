const express = require('express');
const router = express.Router();
const googleReviewController = require('../controllers/googleReviewController');

/**
 * @swagger
 * /api/google-reviews:
 *   get:
 *     summary: Get all 5-star Google reviews
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: List of 5-star Google reviews
 */
router.get('/', googleReviewController.getReviews);

/**
 * @swagger
 * /api/google-reviews/sync:
 *   post:
 *     summary: Trigger manual sync from Google Places API
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Sync result
 */
router.post('/sync', googleReviewController.syncReviews);

module.exports = router;
