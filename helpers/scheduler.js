'use strict';

/**
 * Sync Scheduler Setup
 * Configures all cron scheduling and initial startup sync execution.
 * Designed to be lazy-loaded and called ONLY on the primary cluster instance.
 */
function initScheduler() {
    console.log('[Cron/Startup] Initializing sync crons and startup jobs on primary instance.');

    // Lazy load scheduling and sync dependencies to keep memory clean on other processes
    const cron = require('node-cron');
    const LiveBookingSyncService = require('../services/liveBookingSyncService');
    const liveBookingSyncService = new LiveBookingSyncService();
    const googleReviewService = require('../services/googleReviewService');

    const isProduction = process.env.NODE_ENV === 'production' || process.env.MODE === 'production';
    const bookingSyncEnabled = process.env.BOOKING_SYNC_ENABLED
      ? process.env.BOOKING_SYNC_ENABLED === 'true'
      : isProduction;

    // Schedule cron job to sync live booking data every 30 minutes
    // Cron expression: */30 * * * * means "every 30 minutes"
    if (bookingSyncEnabled) {
        cron.schedule('*/30 * * * *', async () => {
            try {
                await liveBookingSyncService.syncAllData();
            } catch (error) {
                console.error('=== [Cron Job] Error during live booking sync:', error);
            }
        });
    } else {
        console.log('[Booking Sync] Cron disabled for this environment.');
    }

    // Schedule cron job to sync Google reviews daily at midnight
    // Cron expression: 0 0 * * * means "at 00:00 every day"
    cron.schedule('0 0 * * *', async () => {
        try {
            await googleReviewService.fetchAndStoreReviews();
        } catch (error) {
            console.error('=== [Cron Job] Error during Google reviews sync:', error);
        }
    });

    // Run initial sync on server startup
    (async () => {
        if (bookingSyncEnabled) {
            try {
                await liveBookingSyncService.syncAllData();
            } catch (error) {
                console.error('=== [Startup] Error during initial live booking sync:', error);
                console.error('You can manually trigger sync from the admin panel ===\n');
            }
        } else {
            console.log('[Booking Sync] Startup sync skipped for this environment.');
        }

        try {
            await googleReviewService.fetchAndStoreReviews();
        } catch (error) {
            console.error('=== [Startup] Error during initial Google reviews sync:', error);
        }
    })();
}

module.exports = {
    initScheduler
};
