'use strict';
/**
 * Randomized data seeder using Faker
 * Run from repo root or backend folder:
 *   node new_beckend/scripts/seed_faker_bookings.js --users=5 --properties=3 --bookings=2
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.live') });

const mysql = require('mysql2/promise');
const { faker } = require('@faker-js/faker');
const { mirrorBookingsForUser } = require('./helpers/liveBookingMirror');

const getArg = (key, defaultValue) => {
    const prefix = `--${key}=`;
    const arg = process.argv.find(a => a.startsWith(prefix));
    if (!arg) return defaultValue;
    return arg.slice(prefix.length);
};

const getBoolArg = (key, defaultValue = false) => {
    const value = getArg(key);
    if (value === undefined) return defaultValue;
    if (['true', '1', 'yes'].includes(String(value).toLowerCase())) return true;
    if (['false', '0', 'no'].includes(String(value).toLowerCase())) return false;
    return defaultValue;
};

const toInt = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const formatDate = (date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
};

async function createUser(connection) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const phone = `+91${faker.string.numeric(10)}`;
    const email = faker.internet.email({ firstName, lastName });

    const [result] = await connection.query(
        `INSERT INTO users (salutation, firstname, lastname, email, phone, role, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 268, 1, NOW(), NOW())`,
        [faker.person.prefix(), firstName, lastName, email, phone]
    );

    return { id: result.insertId, firstName, lastName, email, phone };
}

async function createGuestDetail(connection, user, bookingId, isLead = false) {
    const profilePayload = {
        booking_id: bookingId,
        first_name: user.firstName,
        last_name: user.lastName,
        email: user.email,
        mobile: user.phone,
        gender: faker.helpers.arrayElement(['Male', 'Female', 'Other']),
        dob: formatDate(faker.date.birthdate({ min: 18, max: 65, mode: 'age' })),
        age: Math.floor(Math.random() * 40) + 20,
        guest_type: 'Adult',
        city: faker.location.city(),
        state: faker.location.state(),
        country: 'India',
        address: faker.location.streetAddress(true),
        zip: faker.location.zipCode('######'),
        is_lead: isLead ? 1 : 0,
        declaration: 1,
        gst_bill: isLead ? faker.helpers.arrayElement([0, 1]) : 0,
        gst_number: isLead ? faker.helpers.replaceSymbols('27AAAAA####A#Z#') : '',
        business_name: isLead ? faker.company.name() : '',
        stayed_before: faker.helpers.arrayElement(['Yes', 'No']),
        purpose_of_visit: faker.helpers.arrayElement(['Leisure', 'Business', 'Event']),
        group_type: faker.helpers.arrayElement(['Family', 'Couple', 'Friends', 'Solo'])
    };

    const [result] = await connection.query("INSERT INTO guest_details SET ?", [profilePayload]);

    return { id: result.insertId, ...profilePayload };
}

async function createProperty(connection) {
    const listingName = `${faker.word.adjective()} ${faker.location.city()} Villa`;
    const slug = faker.helpers.slugify(listingName.toLowerCase());
    const channelId = faker.string.numeric(16);
    const internalName = `${listingName} | ${faker.word.noun()}`;
    const destination = faker.number.int({ min: 1, max: 10 });

    const [result] = await connection.query(
        `INSERT INTO properties (
            channel_id, listing_name, internal_name, slug, destination,
            inventory, property_type, number_of_bedrooms, number_of_bathrooms,
            number_of_guests, google_latitude, google_longitude
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            channelId,
            listingName,
            internalName,
            slug,
            destination,
            faker.number.int({ min: 1, max: 5 }),
            faker.number.int({ min: 1, max: 5 }),
            faker.number.int({ min: 1, max: 6 }),
            faker.number.int({ min: 1, max: 4 }),
            faker.number.int({ min: 2, max: 12 }),
            faker.location.latitude().toString(),
            faker.location.longitude().toString()
        ]
    );

    return result.insertId;
}

async function createBooking(connection, userId, propertyId, startDate, endDate) {
    const uniqueId = faker.number.int({ min: 100000, max: 999999 });
    const subBookingId = `SUB${faker.string.numeric(6)}`;
    const voucher = `VCH${faker.string.alphanumeric({ length: 6 }).toUpperCase()}`;

    const [bookingResult] = await connection.query(
        `INSERT INTO bookings (
            uniqueId, subBookingId, transaction_id, property_id, guest_id,
            createDatetime, modifyDatetime, status, isConfirmed, currentStatus,
            voucherNo, start, end, arrivalTime, departureTime, bookedBy,
            source, paymentMethod, isChannelBooking, lastOperation
        ) VALUES (?, ?, ?, ?, ?, NOW(), NOW(), ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        [
            uniqueId,
            subBookingId,
            `TXN${faker.string.alphanumeric({ length: 8 }).toUpperCase()}`,
            propertyId,
            userId,
            'Confirmed',
            faker.helpers.arrayElement(['Confirm', 'Tentative', 'Block']),
            voucher,
            formatDate(startDate),
            formatDate(endDate),
            '14:00:00',
            '10:00:00',
            faker.helpers.arrayElement(['Direct', 'OTA', 'Referral']),
            faker.helpers.arrayElement(['website', 'airbnb', 'make_my_trip']),
            faker.helpers.arrayElement(['Online Payment', 'Bank Transfer', 'Cash']),
            'Faker Seed'
        ]
    );

    const bookingId = bookingResult.insertId;

    const adults = toInt(getArg('adults', 2), 2);
    const children = toInt(getArg('children', 0), 0);

    // Seed Occupancy (booking_rentalInfo)
    let curr = new Date(startDate);
    while (curr < endDate) {
        await connection.query(
            `INSERT INTO booking_rentalInfo (booking_id, effectiveDate, adult, child) 
             VALUES (?, ?, ?, ?)`,
            [bookingId, formatDate(curr), adults, children]
        );
        curr.setDate(curr.getDate() + 1);
    }

    const amountBeforeTax = faker.number.int({ min: 15000, max: 60000 });
    const tax = Math.round(amountBeforeTax * 0.18);
    const afterTax = amountBeforeTax + tax;

    await connection.query(
        `INSERT INTO booking_tariffs (
            booking_id, currencyCode, totalAmountAfterTax, totalAmountBeforeTax,
            totalTax, totalDiscount, totalExtraCharge, totalPayment, taCommision
        ) VALUES (?, 'INR', ?, ?, ?, 0, 0, ?, ?)`,
        [bookingId, afterTax, amountBeforeTax, tax, afterTax, Math.round(afterTax * 0.1)]
    );

    // Create Lead Guest directly in guest_details
    const [userData] = await connection.query("SELECT id, firstname as firstName, lastname as lastName, email, phone FROM users WHERE id = ?", [userId]);
    const user = userData[0];
    await createGuestDetail(connection, user, bookingId, true);

    return bookingId;
}

async function seedFakerData() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    };

    const useLatestUserOnly = getBoolArg('latest-user', false);
    const mirrorLiveBookings = getBoolArg('mirror-live', false);
    const userIdArg = getArg('user-id');
    const targetUserId = userIdArg ? Number(userIdArg) : null;
    if (userIdArg && (!Number.isFinite(targetUserId) || targetUserId <= 0)) {
        throw new Error(`Invalid --user-id value: ${userIdArg}`);
    }
    const userCount = useLatestUserOnly ? 0 : toInt(getArg('users', 3), 3);
    const propertyCount = toInt(getArg('properties', 2), 2);
    const bookingsPerUser = toInt(getArg('bookings', 2), 2);

    console.log(`Connecting to database: ${config.database}@${config.host}...`);
    let connection;
    try {
        connection = await mysql.createConnection(config);
        console.log('✅ Connected to database');

        const newPropertyIds = [];
        for (let i = 0; i < propertyCount; i++) {
            const propertyId = await createProperty(connection);
            newPropertyIds.push(propertyId);
            console.log(`🏠 Created property #${propertyId}`);
        }

        const availableProperties = [...newPropertyIds];
        if (availableProperties.length === 0) {
            const [existing] = await connection.query('SELECT id FROM properties LIMIT 1');
            if (!existing.length) {
                throw new Error('No properties available even after seeding.');
            }
            availableProperties.push(existing[0].id);
        }

        const userIds = [];
        if (targetUserId) {
            const [existingUser] = await connection.query('SELECT id FROM users WHERE id = ? LIMIT 1', [targetUserId]);
            if (!existingUser.length) {
                throw new Error(`User ${targetUserId} not found. Provide a valid --user-id or create the user first.`);
            }
            userIds.push(targetUserId);
            console.log(`👤 Using provided user #${targetUserId}`);
        } else if (useLatestUserOnly) {
            const [latest] = await connection.query('SELECT id FROM users ORDER BY id DESC LIMIT 1');
            if (!latest.length) {
                throw new Error('No users found to reuse. Create a user first or run without --latest-user.');
            }
            userIds.push(latest[0].id);
            console.log(`👤 Reusing latest user #${latest[0].id}`);
        } else {
            for (let i = 0; i < userCount; i++) {
                const user = await createUser(connection);
                userIds.push(user.id);
                console.log(`👤 Created user #${user.id} (${user.firstName} ${user.lastName})`);
            }
        }

        let totalBookings = 0;
        for (const userId of userIds) {
            for (let i = 0; i < bookingsPerUser; i++) {
                const propertyId = faker.helpers.arrayElement(availableProperties);
                const startDate = faker.date.soon({ days: 60 });
                const endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + faker.number.int({ min: 2, max: 5 }));

                const bookingId = await createBooking(connection, userId, propertyId, startDate, endDate);
                totalBookings += 1;
                console.log(`📘 Created booking #${bookingId} for user ${userId} -> property ${propertyId}`);
            }
        }

        console.log(`
🎯 Faker seeding summary`);
        if (useLatestUserOnly) {
            console.log('   Users created: 0 (reused latest user)');
        } else {
            console.log(`   Users created: ${userIds.length}`);
        }
        console.log(`   Properties created: ${newPropertyIds.length}`);
        console.log(`   Bookings created: ${totalBookings}`);

        if (mirrorLiveBookings) {
            console.log('\n🔁 Mirroring into live_bookings...');
            await mirrorBookingsForUser(connection, {
                userId: targetUserId || (useLatestUserOnly ? userIds[0] : userIds[userIds.length - 1]),
                limit: totalBookings,
                logger: console
            });
        }

        await connection.end();
        process.exit(0);
    } catch (error) {
        console.error('❌ Faker seeding failed:', error);
        if (connection) await connection.end();
        process.exit(1);
    }
}

seedFakerData();
