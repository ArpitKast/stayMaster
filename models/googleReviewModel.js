const BaseModel = require('./baseModel');

class GoogleReviewModel extends BaseModel {
    constructor() {
        super('google_reviews');
    }

    async getByReviewId(reviewId) {
        return await this.find(this.table, { review_id: reviewId });
    }

    async getFiveStarReviews() {
        try {
            const results = await this.select(this.table, { rating: 5 });
            return results;
        } catch (error) {
            throw error;
        }
    }
}

module.exports = new GoogleReviewModel();
