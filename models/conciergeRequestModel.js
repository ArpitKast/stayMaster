const pool = require('../config/dbConnection');
const baseModel = require("../models/baseModel");

class ConciergeRequestModel extends baseModel {
    constructor() {
        super('guest_concierge_requests');
    }

    async createRequest(data) {
        try {
            return await this.insert(this.table, data);
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    async getRequestsByBooking(bookingId, guestId) {
        try {
            const query = `
                SELECT id, request_text, status, created_at 
                FROM ${this.table} 
                WHERE booking_id = ? AND guest_id = ? 
                ORDER BY created_at DESC
            `;
            const results = await pool.query(query, [bookingId, guestId]);
            return results[0];
        } catch (error) {
            console.log(error);
            throw error;
        }
    }
}

module.exports = ConciergeRequestModel;
