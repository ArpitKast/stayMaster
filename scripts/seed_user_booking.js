'use strict';
/**
 * Standalone script to seed properties and bookings for testing
 * Run: node new_beckend/scripts/seed_user_booking.js
 */

const path = require('path');
const dotenv = require('dotenv');

const defaultEnv = path.join(__dirname, '../.env');
const fallbackLiveEnv = path.join(__dirname, '../.env.live');
const requestedEnv = process.env.SCRIPTS_ENV_FILE;

let envLoadedFrom = null;
if (requestedEnv) {
    const result = dotenv.config({ path: requestedEnv });
    if (!result.error) {
        envLoadedFrom = requestedEnv;
    }
}

if (!envLoadedFrom) {
    const primaryResult = dotenv.config({ path: defaultEnv });
    if (!primaryResult.error) {
        envLoadedFrom = defaultEnv;
    } else {
        const fallbackResult = dotenv.config({ path: fallbackLiveEnv });
        if (!fallbackResult.error) {
            envLoadedFrom = fallbackLiveEnv;
        }
    }
}

if (!envLoadedFrom) {
    console.warn('⚠️  Could not load .env file. Proceeding with process environment variables only.');
} else {
    console.log(`📄 Loaded environment variables from ${envLoadedFrom}`);
}

const mysql = require('mysql2/promise');

const getArg = (key, defaultValue = undefined) => {
    const prefix = `--${key}=`;
    const arg = process.argv.find(a => a.startsWith(prefix));
    if (!arg) return defaultValue;
    return arg.slice(prefix.length);
};

function formatDate(date) {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
}

async function tableHasColumn(connection, schema, tableName, columnName) {
    const [rows] = await connection.query(
        `SELECT COUNT(*) AS count
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [schema, tableName, columnName]
    );
    return rows?.[0]?.count > 0;
}

async function seedData() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    };

    console.log(`Connecting to database: ${config.database}@${config.host}...`);
    let connection;
    try {
        connection = await mysql.createConnection(config);
        console.log('✅ Connected to database');

        const guestIdColumnPresent = await tableHasColumn(connection, config.database, 'guest_details', 'guest_id');

        // 1. Determine which user to use (default to most recent)
        let userIdArg = getArg('user-id');
        let userId;
        if (userIdArg) {
            userId = Number(userIdArg);
        } else {
            const [latestUsers] = await connection.query('SELECT id FROM users ORDER BY id DESC LIMIT 1');
            if (!latestUsers.length) {
                throw new Error('No users found. Please create a user or pass --user-id=<id>.');
            }
            userId = latestUsers[0].id;
        }

        const [users] = await connection.query('SELECT id FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            throw new Error(`User ${userId} not found. Provide a valid --user-id or create the user first.`);
        }
        console.log('Seeding bookings for user ID:', userId);

        // 2. Determine property (default to most recent available)
        let propertyIdArg = getArg('property-id');
        let propertyId;
        if (propertyIdArg) {
            propertyId = Number(propertyIdArg);
        } else {
            // Fetch up to 10 existing properties
            const [properties] = await connection.query('SELECT id, channel_id FROM properties ORDER BY id DESC LIMIT 10');
            
            if (!properties.length) {
                console.log('No properties found, seeding a sample property...');
                const seedPayload = {
                    channel_id: '4058300000000000037',
                    listing_name: 'Aurum Aqua 3 BR Bali Themed',
                    internal_name: 'Aurum Aqua | Bali Themed | 3BR in Vagator',
                    slug: 'aurumaqua',
                    destination: 1
                };

                const [existingSeed] = await connection.query(
                    'SELECT id FROM properties WHERE slug = ? OR channel_id = ? LIMIT 1',
                    [seedPayload.slug, seedPayload.channel_id]
                );

                if (existingSeed.length) {
                    propertyId = existingSeed[0].id;
                } else {
                    const [propResult] = await connection.query(
                        `INSERT INTO properties (channel_id, listing_name, internal_name, slug, destination) 
                        VALUES (?, ?, ?, ?, ?)`,
                        [seedPayload.channel_id, seedPayload.listing_name, seedPayload.internal_name, seedPayload.slug, seedPayload.destination]
                    );
                    propertyId = propResult.insertId;
                }
                const propertyResult = await connection.query('SELECT id, channel_id FROM properties WHERE id = ?', [propertyId]);
                const channelId = propertyResult[0][0].channel_id;
                console.log('Using seeded property ID:', propertyId, 'Channel ID:', channelId);
            } else {
                // Pick a random property from the fetched list
                const randomProp = properties[Math.floor(Math.random() * properties.length)];
                propertyId = randomProp.id;
                const channelId = randomProp.channel_id;
                console.log('Using existing random property ID:', propertyId, 'Channel ID:', channelId);
            }
        }

        const bookingCount = Math.max(1, Number(getArg('count', 1)) || 1);
        const adultsArg = Math.max(1, Number(getArg('adults', getArg('guests', getArg('guest', 1)))) || 1);
        const childrenArg = Math.max(0, Number(getArg('children', 0)) || 0);
        const totalGuests = adultsArg + childrenArg;

        console.log(`Creating ${bookingCount} booking(s) with ${adultsArg} adult(s) and ${childrenArg} child(ren)...`);

        const guestBookingColumnPresent = await tableHasColumn(connection, config.database, 'guest_details', 'booking_id');

        let created = 0;
        for (let i = 0; i < bookingCount; i++) {
            await connection.beginTransaction();
            try {
                const uniqueId = Math.floor(Math.random() * 900000) + 100000;
                const subBookingId = 'SUB' + uniqueId;
                const startDate = new Date();
                startDate.setDate(startDate.getDate() + 1 + i * 3);
                const endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 2);

                console.log(`Creating booking ${subBookingId} for ${formatDate(startDate)} - ${formatDate(endDate)}...`);

                const [bookingResult] = await connection.query(
                    `INSERT INTO bookings (
                        uniqueId, subBookingId, transaction_id, property_id, guest_id,
                        createDatetime, modifyDatetime, status, isConfirmed, currentStatus,
                        voucherNo, start, end, arrivalTime, departureTime, bookedBy,
                        source, paymentMethod, isChannelBooking, lastOperation
                    ) VALUES (?, ?, ?, ?, ?, NOW(), NOW(), ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
                    [
                        userId, subBookingId, 'TXN' + uniqueId, propertyId, userId,
                        'Confirmed', 'Confirm', 'VOUCHER' + uniqueId,
                        formatDate(startDate), formatDate(endDate), '14:00:00', '10:00:00', 'Direct',
                        'website', 'Online Payment', 'Manual Seed'
                    ]
                );

                const bookingId = bookingResult.insertId;

                // Calculate discount based on property's discount_percentage (flat amount)
                let flatDiscount = 0;
                try {
                    const [propDiscount] = await connection.query('SELECT discount_percentage FROM properties WHERE id = ?', [propertyId]);
                    flatDiscount = (propDiscount && propDiscount[0] && propDiscount[0].discount_percentage) || 10; // Default to 10 flat
                } catch (err) {
                    // Fallback if column doesn't exist
                    flatDiscount = 10;
                }

                const baseAmount = 25000;
                const totalAmountAfterTax = baseAmount - flatDiscount;

                await connection.query(
                    `INSERT INTO booking_tariffs 
                (booking_id, currencyCode, totalAmountAfterTax, totalAmountBeforeTax, totalTax, totalDiscount, totalExtraCharge, totalPayment, taCommision) 
                VALUES (?, 'INR', ?, ?, 3771, ?, 0, ?, 2500)`,
                    [bookingId, totalAmountAfterTax, 21228, flatDiscount, totalAmountAfterTax]
                );

                // 1. Fetch Lead Guest info from users table
                const [leadUserData] = await connection.query('SELECT firstname, lastname, email, phone FROM users WHERE id = ?', [userId]);
                const leadUser = leadUserData[0] || {};

                const profilePayload = {
                    booking_id: bookingId,
                    first_name: leadUser.firstname || 'Lead',
                    last_name: leadUser.lastname || 'Guest',
                    email: leadUser.email || '',
                    mobile: leadUser.phone || '',
                    gender: 'Male',
                    dob: '1990-01-01',
                    age: 34,
                    guest_type: 'Adult',
                    city: 'Mumbai',
                    state: 'Maharashtra',
                    country: 'India',
                    address: '123 Luxury Lane, Worli',
                    zip: '400018',
                    is_lead: 1,
                    declaration: 1,
                    gst_bill: 1,
                    gst_number: '27AAAAA0000A1Z5',
                    business_name: 'Lead Business',
                    stayed_before: 'No',
                    purpose_of_visit: 'Leisure',
                    group_type: 'Family'
                };

                await connection.query("INSERT INTO guest_details SET ?", [profilePayload]);

                // 2. Create and Link Additional Guests directly in guest_details
                for (let g = 1; g < totalGuests; g++) {
                    const guestUniqueId = Math.floor(Math.random() * 900000) + 100000;
                    const firstName = `Guest`;
                    const lastName = `User ${guestUniqueId}`;
                    const email = `guest_${guestUniqueId}@example.com`;
                    const phone = `+91999${guestUniqueId}`;

                    const [guestUserResult] = await connection.query(
                        `INSERT INTO users (firstname, lastname, email, phone, role) 
                         VALUES (?, ?, ?, ?, ?)`,
                        [firstName, lastName, email, phone, 268]
                    );
                    const guestUserId = guestUserResult.insertId;

                    const gProfilePayload = {
                        booking_id: bookingId,
                        first_name: firstName,
                        last_name: lastName,
                        email,
                        mobile: phone,
                        gender: g % 2 === 0 ? 'Male' : 'Female',
                        dob: g < adultsArg ? '1995-05-15' : '2015-05-15',
                        age: g < adultsArg ? 28 : 10,
                        guest_type: g < adultsArg ? 'Adult' : 'Child',
                        city: 'Mumbai',
                        state: 'Maharashtra',
                        country: 'India',
                        address: '456 Guest Street, Bandra',
                        zip: '400050',
                        is_lead: 0,
                        declaration: 1
                    };

                    await connection.query("INSERT INTO guest_details SET ?", [gProfilePayload]);
                }

                // 3. Seed Occupancy (booking_rentalInfo)
                let curr = new Date(startDate);
                while (curr < endDate) {
                    await connection.query(
                        `INSERT INTO booking_rentalInfo (booking_id, effectiveDate, adult, child) 
                         VALUES (?, ?, ?, ?)`,
                        [bookingId, formatDate(curr), adultsArg, childrenArg]
                    );
                    curr.setDate(curr.getDate() + 1);
                }

                await connection.commit();
                created += 1;
                console.log(`✅ Booking created with ID: ${bookingId} (${adultsArg} adults, ${childrenArg} children)`);
            } catch (error) {
                await connection.rollback();
                throw error;
            }
        }

        console.log(`🎉 Completed: ${created} booking(s) for user ${userId} using property ${propertyId}`);

        await connection.end();
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        if (connection) await connection.end();
        process.exit(1);
    }
}

seedData();
