const googleReviewService = require('../services/googleReviewService');

class GoogleReviewController {
    /**
     * Get all 5-star Google reviews from DB
     * GET /api/google-reviews
     */
    async getReviews(req, res) {
        try {
            const reviews = await googleReviewService.getStoredReviews();
            res.status(200).json({
                success: true,
                count: reviews.length,
                data: reviews
            });
        } catch (error) {
            console.error('[GoogleReviewController] Error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching Google reviews',
                error: error.message
            });
        }
    }

    /**
     * Manually trigger a sync from Google
     * POST /api/google-reviews/sync
     */
    async syncReviews(req, res) {
        try {
            const result = await googleReviewService.fetchAndStoreReviews();
            if (result.success) {
                res.status(200).json({
                    success: true,
                    message: `Sync complete. Saved: ${result.saved}, Skipped: ${result.skipped}`,
                    data: result
                });
            } else {
                res.status(400).json({
                    success: false,
                    message: result.error || 'Sync failed'
                });
            }
        } catch (error) {
            console.error('[GoogleReviewController] Sync Error:', error);
            res.status(500).json({
                success: false,
                message: 'Error syncing Google reviews',
                error: error.message
            });
        }
    }
}

module.exports = new GoogleReviewController();
