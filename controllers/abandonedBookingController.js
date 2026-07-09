/**
 * AbandonedBookingController
 * Handles saving / retrieving / managing partial booking progress.
 * One record per (user_id, property_id) pair.
 */

const Response = require('../helpers/responseHelper');
const AbandonedBookingModel = require('../models/abandonedBookingModel');

const AbandonedBooking = new AbandonedBookingModel();

/** Extract property_id from the request body or from inside booking_data. */
function extractPropertyId(body) {
    if (body.property_id) return Number(body.property_id);
    const bd = body.booking_data;
    if (!bd) return 0;
    const data = typeof bd === 'string' ? JSON.parse(bd) : bd;
    return Number(data?.property_id || 0);
}

class AbandonedBookingController {

    /**
     * POST /api/ext/abandoned-booking/save
     * Auto-save partial booking progress for (user, property).
     */
    async save(req, res) {
        try {
            const guest = req.guest;
            if (!guest?.id) {
                return Response.error(res, 'UNAUTHORIZED', 'You must be logged in to save booking progress.', 401);
            }

            const { booking_data, last_completed_step, session_id } = req.body;

            if (!booking_data) {
                return Response.error(res, 'VALIDATION_ERROR', 'booking_data is required.', 400);
            }

            const propertyId = extractPropertyId(req.body);

            await AbandonedBooking.upsert({
                userId: guest.id,
                propertyId,
                sessionId: session_id || null,
                bookingData: booking_data,
                lastCompletedStep: last_completed_step || 'login',
            });

            return Response.success(res, { saved: true });
        } catch (err) {
            console.error('AbandonedBooking.save error:', err);
            return Response.error(res, 'SERVER_ERROR', 'Failed to save booking progress.', 500);
        }
    }

    /**
     * GET /api/ext/abandoned-booking/resume?property_id=X
     * Retrieve saved progress for (user, property).
     */
    async resume(req, res) {
        try {
            const guest = req.guest;
            if (!guest?.id) {
                return Response.error(res, 'UNAUTHORIZED', 'You must be logged in.', 401);
            }

            const propertyId = Number(req.query.property_id || 0);
            const record = await AbandonedBooking.getForUser(guest.id, propertyId);
            if (!record) {
                return Response.success(res, { found: false, record: null });
            }

            await AbandonedBooking.markResumed(guest.id, propertyId);
            return Response.success(res, { found: true, record });
        } catch (err) {
            console.error('AbandonedBooking.resume error:', err);
            return Response.error(res, 'SERVER_ERROR', 'Failed to retrieve booking progress.', 500);
        }
    }

    /**
     * POST /api/ext/abandoned-booking/complete
     * Mark (user, property) record as completed after successful payment.
     * Expects { property_id } in body.
     */
    async complete(req, res) {
        try {
            const guest = req.guest;
            if (!guest?.id) {
                return Response.error(res, 'UNAUTHORIZED', 'You must be logged in.', 401);
            }

            const propertyId = Number(req.body.property_id || 0);
            await AbandonedBooking.markCompleted(guest.id, propertyId);
            return Response.success(res, { marked: true });
        } catch (err) {
            console.error('AbandonedBooking.complete error:', err);
            return Response.error(res, 'SERVER_ERROR', 'Failed to mark booking as completed.', 500);
        }
    }

    // ── Manager / Admin ──────────────────────────────────────────────────────

    /**
     * GET /api/manager/abandoned-bookings
     * Paginated list. Query params: status, page, limit
     */
    async list(req, res) {
        try {
            const { status = 'abandoned', page = 1, limit = 20 } = req.query;
            const result = await AbandonedBooking.list({
                status,
                page: Number(page),
                limit: Math.min(Number(limit), 100),
            });
            return Response.success(res, result);
        } catch (err) {
            console.error('AbandonedBooking.list error:', err);
            return Response.error(res, 'SERVER_ERROR', 'Failed to fetch abandoned bookings.', 500);
        }
    }

    /**
     * DELETE /api/manager/abandoned-bookings/:id
     */
    async remove(req, res) {
        try {
            const { id } = req.params;
            if (!id || isNaN(Number(id))) {
                return Response.error(res, 'VALIDATION_ERROR', 'Valid id is required.', 400);
            }
            await AbandonedBooking.deleteById(Number(id));
            return Response.success(res, { deleted: true });
        } catch (err) {
            console.error('AbandonedBooking.remove error:', err);
            return Response.error(res, 'SERVER_ERROR', 'Failed to delete record.', 500);
        }
    }
}

module.exports = AbandonedBookingController;
