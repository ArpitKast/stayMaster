'use strict';
/**
 * Mirrors rows from bookings/users/properties into live_bookings so that
 * /api/users/Userbooking (which reads from live_bookings) can surface seeded data.
 *
 * Usage examples:
 *   # Use the latest user by default, insert up to 10 bookings
 *   node scripts/seed_live_bookings_from_bookings.js
 *
 *   # Target a specific user id and limit the number of mirrored bookings
 *   node scripts/seed_live_bookings_from_bookings.js --user-id=11572 --limit=5
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.live') });

const mysql = require('mysql2/promise');
const { mirrorBookingsForUser } = require('./helpers/liveBookingMirror');

const getArg = (key, defaultValue) => {
    const prefix = `--${key}=`;
    const arg = process.argv.find(a => a.startsWith(prefix));
    if (!arg) return defaultValue;
    return arg.slice(prefix.length);
};

(async function seedLiveBookings() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    };

    const userIdArg = getArg('user-id');
    const limit = Number(getArg('limit', 10)) || 10;

    console.log(`Connecting to database: ${config.database}@${config.host}...`);
    let connection;
    try {
        connection = await mysql.createConnection(config);
        console.log('✅ Connected to database');

        await mirrorBookingsForUser(connection, {
            userId: userIdArg ? Number(userIdArg) : undefined,
            limit: Number(limit) || 10,
            logger: console
        });
        await connection.end();
    } catch (error) {
        console.error('❌ Failed to mirror bookings into live_bookings:', error);
        if (connection) await connection.end();
        process.exit(1);
    }
})();
