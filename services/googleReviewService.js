const axios = require('axios');
const GoogleReview = require('../models/googleReviewModel');

class GoogleReviewService {
    constructor() {
        this.API_KEY = process.env.GOOGLE_PLACES_API_KEY;
        this.PLACE_ID = 'ChIJLZFxjWnBwjsRDkqMb8nhcXI'; // Staymaster Place ID
        this.API_URL = `https://places.googleapis.com/v1/places/${this.PLACE_ID}`;
    }

    /**
     * Fetch latest reviews from Google Places API and store them in DB
     */
    async fetchAndStoreReviews() {
        console.log(`\n=== [Google Reviews Sync] Starting sync at ${new Date().toISOString()} ===`);
        
        if (!this.API_KEY) {
            console.error('[Google Reviews Sync] Error: GOOGLE_PLACES_API_KEY is not defined in .env');
            return { success: false, error: 'API Key missing' };
        }

        try {
            // Fields to fetch
            const fields = 'reviews';
            const url = `${this.API_URL}?fields=${fields}&key=${this.API_KEY}`;

            console.log(`[Google Reviews Sync] Requesting reviews for Place ID: ${this.PLACE_ID}`);

            const response = await axios.get(url, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': this.API_KEY,
                    'X-Goog-FieldMask': 'reviews'
                }
            });

            const reviews = response.data.reviews || [];
            console.log(`[Google Reviews Sync] Fetched ${reviews.length} reviews from Google`);

            let savedCount = 0;
            let skippedCount = 0;

            for (const review of reviews) {
                // Filter for 5-star reviews
                if (review.rating === 5) {
                    const reviewData = {
                        review_id: review.name, // resource name like "places/PLACE_ID/reviews/REVIEW_ID"
                        author_name: review.authorAttribution?.displayName || 'Anonymous',
                        author_url: review.authorAttribution?.uri || '',
                        author_photo_url: review.authorAttribution?.photoUri || '',
                        rating: review.rating,
                        text: review.text?.text || '',
                        relative_time: review.relativePublishTimeDescription || '',
                        publish_time: review.publishTime ? new Date(review.publishTime) : null
                    };

                    // Check if review already exists
                    const existing = await GoogleReview.getByReviewId(reviewData.review_id);
                    if (!existing) {
                        await GoogleReview.create(reviewData);
                        savedCount++;
                    } else {
                        skippedCount++;
                    }
                } else {
                    skippedCount++;
                }
            }

            console.log(`[Google Reviews Sync] Sync complete. Saved: ${savedCount}, Skipped/Non-5-star: ${skippedCount}`);
            return { success: true, saved: savedCount, skipped: skippedCount };

        } catch (error) {
            console.error('[Google Reviews Sync] Error during sync:', error.message);
            if (error.response) {
                console.error('[Google Reviews Sync] API Response Error:', error.response.data);
            }
            return { success: false, error: error.message };
        }
    }

    /**
     * Get all stored 5-star reviews
     */
    async getStoredReviews() {
        return await GoogleReview.getFiveStarReviews();
    }
}

module.exports = new GoogleReviewService();
