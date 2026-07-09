const Response = require("../helpers/responseHelper");
const ConciergeRequestModel = require("../models/conciergeRequestModel");
const model = new ConciergeRequestModel();
const bookingModel = require("../models/bookingModel");
const Booking = new bookingModel();

class ConciergeRequestController {
    async create(req, res) {
        try {
            const { booking_id, request_text } = req.body;
            const guest_id = req.user.id;

            if (!booking_id || !request_text) {
                return Response.error(res, "ERROR", "Booking ID and request text are required", 400);
            }

            const owned = await Booking.bookingForGuest(parseInt(booking_id, 10), guest_id);
            if (!owned) {
                return Response.error(res, "FORBIDDEN", "You cannot add concierge requests for this booking", 403);
            }

            const data = {
                booking_id,
                guest_id,
                request_text,
                status: 'pending'
            };

            const requestId = await model.createRequest(data);

            return Response.success(res, { 
                id: requestId, 
                message: "Concierge request submitted successfully" 
            }, 201);
        } catch (error) {
            console.error("Error creating concierge request:", error);
            return Response.error(res, "ERROR", "Failed to submit concierge request", 500);
        }
    }

    async listByBooking(req, res) {
        try {
            const { booking_id } = req.query;
            const guest_id = req.user.id;

            if (!booking_id) {
                return Response.error(res, "ERROR", "Booking ID is required", 400);
            }

            const owned = await Booking.bookingForGuest(parseInt(booking_id, 10), guest_id);
            if (!owned) {
                return Response.error(res, "FORBIDDEN", "You cannot view concierge requests for this booking", 403);
            }

            const requests = await model.getRequestsByBooking(booking_id, guest_id);

            return Response.success(res, requests);
        } catch (error) {
            console.error("Error fetching concierge requests:", error);
            return Response.error(res, "ERROR", "Failed to fetch concierge requests", 500);
        }
    }
}

module.exports = ConciergeRequestController;
