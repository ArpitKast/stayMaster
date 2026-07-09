const Response = require("../helpers/responseHelper");
const LiveBooking = require('../models/liveBookingModel');
const LiveBookingSyncService = require('../services/liveBookingSyncService');

class LiveBookingController {
    
    /**
     * Display the Live Booking Information page
     */
    async index(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = 50;
            
            // Build filters from query parameters
            const filters = {};
            if (req.query.ReservationNo) filters.ReservationNo = req.query.ReservationNo;
            if (req.query.BookingStatus) filters.BookingStatus = req.query.BookingStatus;
            if (req.query.GuestName) filters.GuestName = req.query.GuestName;
            if (req.query.Email) filters.Email = req.query.Email;
            if (req.query.Mobile) filters.Mobile = req.query.Mobile;
            if (req.query.ArrivalDateFrom) filters.ArrivalDateFrom = req.query.ArrivalDateFrom;
            if (req.query.ArrivalDateTo) filters.ArrivalDateTo = req.query.ArrivalDateTo;
            if (req.query.DepartureDateFrom) filters.DepartureDateFrom = req.query.DepartureDateFrom;
            if (req.query.DepartureDateTo) filters.DepartureDateTo = req.query.DepartureDateTo;
            if (req.query.Source) filters.Source = req.query.Source;
            if (req.query.Room) filters.Room = req.query.Room;

            const liveBookingModel = new LiveBooking();
            const result = await liveBookingModel.getBookings(filters, page, limit);
            const statuses = await liveBookingModel.getDistinctStatuses();
            const sources = await liveBookingModel.getDistinctSources();
            const statistics = await liveBookingModel.getStatistics();

            await res.render('liveBookingInfo/list.ejs', {
                bookings: result.bookings,
                pagination: {
                    currentPage: result.page,
                    totalPages: result.totalPages,
                    total: result.total,
                    limit: result.limit
                },
                filters: filters,
                statuses: statuses,
                sources: sources,
                statistics: statistics
            });
        } catch (error) {
            console.error('Error in live booking index:', error);
            return Response.error(res, "ERROR", "Internal server error", 500);
        }
    }

    /**
     * API endpoint to get bookings with filters (for AJAX calls if needed)
     */
    async getBookings(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 50;
            
            const filters = {};
            if (req.query.ReservationNo) filters.ReservationNo = req.query.ReservationNo;
            if (req.query.BookingStatus) filters.BookingStatus = req.query.BookingStatus;
            if (req.query.GuestName) filters.GuestName = req.query.GuestName;
            if (req.query.Email) filters.Email = req.query.Email;
            if (req.query.Mobile) filters.Mobile = req.query.Mobile;
            if (req.query.ArrivalDateFrom) filters.ArrivalDateFrom = req.query.ArrivalDateFrom;
            if (req.query.ArrivalDateTo) filters.ArrivalDateTo = req.query.ArrivalDateTo;
            if (req.query.DepartureDateFrom) filters.DepartureDateFrom = req.query.DepartureDateFrom;
            if (req.query.DepartureDateTo) filters.DepartureDateTo = req.query.DepartureDateTo;
            if (req.query.Source) filters.Source = req.query.Source;
            if (req.query.Room) filters.Room = req.query.Room;

            const liveBookingModel = new LiveBooking();
            const result = await liveBookingModel.getBookings(filters, page, limit);

            return Response.success(res, {
                bookings: result.bookings,
                pagination: {
                    currentPage: result.page,
                    totalPages: result.totalPages,
                    total: result.total,
                    limit: result.limit,
                    count: result.count || result.bookings.length
                }
            });
        } catch (error) {
            console.error('Error getting live bookings:', error);
            return Response.error(res, "ERROR", error.message, 500);
        }
    }

    /**
     * Get statistics
     */
    async getStatistics(req, res) {
        try {
            const liveBookingModel = new LiveBooking();
            const statistics = await liveBookingModel.getStatistics();
            return Response.success(res, { data: statistics }, 200);
        } catch (error) {
            console.error('Error getting statistics:', error);
            return Response.error(res, "ERROR", error.message, 500);
        }
    }

    /**
     * Manual sync trigger
     */
    async manualSync(req, res) {
        try {
            console.log('Manual sync triggered by admin');
            const syncService = new LiveBookingSyncService();
            const result = await syncService.syncAllData();
            console.log('Manual sync result:', result);
            
            const saved = result.totalSaved || result.saved || 0;
            const updated = result.totalUpdated || result.updated || 0;
            const skipped = result.totalSkipped || result.skipped || 0;
            const errors = result.totalErrors || result.errors || 0;
            const unique = result.uniqueBookings || 0;
            const dbTotal = result.dbTotal || 0;
            const mainSaved = result.mainTableSaved || 0;
            const mainUpdated = result.mainTableUpdated || 0;
            
            return Response.success(res, {
                message: `Sync completed!\n LIVE_BOOKINGS: Fetched: ${result.totalBookings || 0}, Unique: ${unique}, Saved: ${saved}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}, Total: ${dbTotal}\n📊 BOOKINGS TABLE: Saved: ${mainSaved}, Updated: ${mainUpdated}`,
                result: result
            }, 200);
        } catch (error) {
            console.error('Error in manual sync:', error);
            return Response.error(res, "ERROR", error.message, 500);
        }
    }
}

module.exports = LiveBookingController;

