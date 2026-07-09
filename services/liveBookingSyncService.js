const axios = require('axios');
const https = require('https');
const LiveBooking = require('../models/liveBookingModel');
// Keep-alive reuses TCP/TLS connections across Ezee API calls (saves 50-200ms per batch)
const defaultHttpsAgent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 30_000,
    maxSockets: 5
});

class LiveBookingSyncService {
    constructor() {
        this.EZEE_API_BASE = 'https://live.ipms247.com/booking/reservation_api/listing.php';
        this.HOTEL_CODE = process.env.HOTEL_CODE || process.env.EZEE_HOTEL_CODE;
        this.API_KEY = process.env.API_KEY || process.env.EZEE_API_KEY;
        this.BATCH_DAYS = 15;
        this.START_DATE = new Date('2025-10-01');
        this._syncing = false; // concurrency guard — prevents overlapping sync runs
    }

    /**
     * Format date for API (YYYY-MM-DD as per API documentation)
     */
    formatDateForAPI(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Add days to date
     */
    addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    /**
     * Fetch booking data from Ezee API
     * Using arrival_from and arrival_to parameters as per API documentation
     */
    async fetchBookingData(startDate, endDate) {
        try {
            const arrivalFrom = this.formatDateForAPI(startDate);
            const arrivalTo = this.formatDateForAPI(endDate);

            // Use arrival_from and arrival_to as per API documentation
            const url = `${this.EZEE_API_BASE}?request_type=BookingList&HotelCode=${this.HOTEL_CODE}&APIKey=${this.API_KEY}&arrival_from=${arrivalFrom}&arrival_to=${arrivalTo}`;

            console.log(`[Live Booking Sync] Fetching by Arrival Date: ${this.formatDateForAPI(startDate)} to ${this.formatDateForAPI(endDate)}`);

            const response = await axios.get(url, {
                timeout: 30000,
                headers: { 'Content-Type': 'application/json' },
                httpsAgent: defaultHttpsAgent
            });

            console.log(`Response Status: ${response.status}`);
            const bookingCount = response.data?.BookingList?.length ?? '?';
            console.log(`[LiveBookingSync] Response bookings in payload: ${bookingCount}`);


            // Handle different response formats
            if (response.data) {
                // Check for error codes first
                if (response.data.ErrorCode || response.data.errorCode) {
                    const errorCode = response.data.ErrorCode || response.data.errorCode;
                    const errorDesc = response.data.Description || response.data.description || response.data.error || 'Unknown error';
                    console.error(` API Error: ${errorCode} - ${errorDesc}`);
                    return [];
                }

                // Check for BookingList array (most common format)
                if (response.data.BookingList && Array.isArray(response.data.BookingList)) {
                    console.log(` Found ${response.data.BookingList.length} bookings in BookingList`);
                    return response.data.BookingList;
                }

                if (Array.isArray(response.data)) {
                    console.log(`Found ${response.data.length} bookings (direct array)`);
                    return response.data;
                }

                console.log(`Unexpected response format. Keys: ${Object.keys(response.data).join(', ')}`);
            }

            console.log(` No data found in response`);
            return [];
        } catch (error) {
            console.error(`\n Error fetching data for ${this.formatDateForAPI(startDate)} to ${this.formatDateForAPI(endDate)}:`);
            console.error(`Error Message: ${error.message}`);
            if (error.response) {
                console.error(`Response Status: ${error.response.status}`);
                console.error(`Response Data: ${JSON.stringify(error.response.data).substring(0, 500)}`);
            }
            return [];
        }
    }

    /**
     * Generate date batches for syncing
     * Generate batches from START_DATE to today only (not future dates)
     */
    generateDateBatches() {
        const batches = [];
        let currentStart = new Date(this.START_DATE);
        const today = new Date();
        today.setHours(23, 59, 59, 999);

        while (currentStart < today) {
            const batchEnd = this.addDays(currentStart, this.BATCH_DAYS - 1);
            const endDate = batchEnd > today ? today : batchEnd;

            batches.push({
                start: new Date(currentStart),
                end: new Date(endDate)
            });

            currentStart = this.addDays(endDate, 1);
        }

        console.log(`Generated ${batches.length} batches from ${this.formatDateForAPI(this.START_DATE)} to ${this.formatDateForAPI(today)}`);
        return batches;
    }

    /**
     * Sync all booking data
     */
    async syncAllData() {
        if (this._syncing) {
            console.log('[Live Booking Sync] Already running — skipping overlapping sync.');
            return null;
        }
        this._syncing = true;
        try {
            return await this._doSyncAllData();
        } finally {
            this._syncing = false;
        }
    }

    async _doSyncAllData() {
        console.log(`\n=== [Live Booking Sync] Starting sync at ${new Date().toISOString()} ===`);
        const syncDate = this.formatDateForAPI(new Date());
        const liveBookingModel = new LiveBooking();
        const batches = this.generateDateBatches();

        let totalBookings = 0;
        let totalSaved = 0;
        let totalUpdated = 0;
        let totalSkipped = 0;
        let totalErrors = 0;
        let mainTableSaved = 0;
        let mainTableUpdated = 0;

        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            console.log(`\nProcessing batch ${i + 1}/${batches.length}: ${this.formatDateForAPI(batch.start)} to ${this.formatDateForAPI(batch.end)}`);

            const bookings = await this.fetchBookingData(batch.start, batch.end);
            const batchCount = bookings.length;
            totalBookings += batchCount;

            if (batchCount > 0) {
                console.log(`Saving ${batchCount} bookings for this batch to database...`);
                const result = await liveBookingModel.bulkSaveOrUpdate(bookings, syncDate);
                totalSaved += result.saved || 0;
                totalUpdated += result.updated || 0;
                totalSkipped += result.skipped || 0;
                totalErrors += result.errors || 0;
                mainTableSaved += result.mainTableSaved || 0;
                mainTableUpdated += result.mainTableUpdated || 0;
                
                // Clear memory immediately
                bookings.length = 0;
            }

            // 5 second delay between batches to avoid rate limiting
            if (i < batches.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }

        // Get final count from database
        const finalCount = await liveBookingModel.getStatistics();
        const dbTotal = finalCount.total || 0;

        console.log(`\n=== [Live Booking Sync] Complete ===`);
        console.log(`Total Bookings Fetched from API: ${totalBookings}`);
        console.log(`\n=== Live Bookings Table ===`);
        console.log(`Saved: ${totalSaved}, Updated: ${totalUpdated}, Skipped: ${totalSkipped}, Errors: ${totalErrors}`);
        console.log(`Total in live_bookings table: ${dbTotal}`);
        console.log(`\n=== Main Bookings Table ===`);
        console.log(`Saved: ${mainTableSaved}, Updated: ${mainTableUpdated}`);

        return {
            totalBookings,
            uniqueBookings: totalBookings,
            totalSaved,
            totalUpdated,
            totalSkipped,
            totalErrors,
            dbTotal,
            mainTableSaved,
            mainTableUpdated
        };
    }

    /**
     * Sync recent bookings only (last 30 days for faster sync)
     */
    async syncRecentData() {
        console.log(`\n=== [Live Booking Sync] Starting recent sync at ${new Date().toISOString()} ===`);
        const syncDate = this.formatDateForAPI(new Date());
        const liveBookingModel = new LiveBooking();
        
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);

        console.log(`Fetching bookings from ${this.formatDateForAPI(thirtyDaysAgo)} to ${this.formatDateForAPI(today)}`);
        console.log(`Using Hotel Code: ${this.HOTEL_CODE}`);
        console.log(`Using API Key: ${this.API_KEY.substring(0, 10)}...${this.API_KEY.substring(this.API_KEY.length - 5)}`);

        const bookings = await this.fetchBookingData(thirtyDaysAgo, today);

        console.log(`Total bookings fetched from API: ${bookings.length}`);

        if (bookings.length > 0) {
            console.log(`Saving ${bookings.length} bookings to database...`);
            const result = await liveBookingModel.bulkSaveOrUpdate(bookings, syncDate);
            console.log(`  → Fetched: ${bookings.length}, Saved: ${result.saved}, Updated: ${result.updated}, Errors: ${result.errors}`);
            return result;
        } else {
            console.log(`  → No bookings found for this period`);
            console.log(`  → This could mean:`);
            console.log(`     1. No bookings exist in the date range`);
            console.log(`     2. API credentials are incorrect`);
            console.log(`     3. API endpoint is not responding correctly`);
            return { saved: 0, updated: 0, errors: 0, totalBookings: 0 };
        }
    }
}

module.exports = LiveBookingSyncService;

