'use strict';

const { faker } = require('@faker-js/faker');

const formatDate = (value) => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
};

async function resolveUserId(connection, requestedUserId, logger = console) {
    if (requestedUserId) {
        const [rows] = await connection.query('SELECT id FROM users WHERE id = ? LIMIT 1', [requestedUserId]);
        if (!rows.length) {
            throw new Error(`User ${requestedUserId} not found.`);
        }
        logger.log(`👤 Using provided user id ${requestedUserId}`);
        return requestedUserId;
    }

    const [latestUsers] = await connection.query('SELECT id FROM users ORDER BY id DESC LIMIT 1');
    if (!latestUsers.length) {
        throw new Error('No users found. Seed a user first or pass --user-id.');
    }
    const userId = latestUsers[0].id;
    logger.log(`👤 Using latest user id ${userId}`);
    return userId;
}

async function mirrorBookingsForUser(connection, { userId: requestedUserId, limit = 10, logger = console } = {}) {
    const userId = await resolveUserId(connection, requestedUserId, logger);

    const bookingsQuery = `
        SELECT b.id, b.start, b.end, b.currentStatus, b.source, b.property_id,
               u.firstname, u.lastname, u.email, u.phone,
               p.listing_name, p.channel_id
        FROM bookings b
        JOIN users u ON u.id = b.guest_id
        JOIN properties p ON p.id = b.property_id
        WHERE u.id = ?
        ORDER BY b.id DESC
        LIMIT ?
    `;
    const [bookings] = await connection.query(bookingsQuery, [userId, limit]);

    if (!bookings.length) {
        logger.log('⚠️  No bookings found for the selected user. Nothing to mirror.');
        return { inserted: 0, userId };
    }

    let inserted = 0;
    for (const booking of bookings) {
        const reservationNo = `BOOK${booking.id}`;
        const [existing] = await connection.query(
            'SELECT id FROM live_bookings WHERE ReservationNo = ? LIMIT 1',
            [reservationNo]
        );
        if (existing.length) {
            logger.log(`↷ Skipping booking ${booking.id} (already mirrored)`);
            continue;
        }

        const arrivalDate = formatDate(booking.start);
        const departureDate = formatDate(booking.end);
        const nights = arrivalDate && departureDate
            ? Math.max(1, Math.round((new Date(departureDate) - new Date(arrivalDate)) / (1000 * 60 * 60 * 24)))
            : null;

        const guestName = [booking.firstname, booking.lastname]
            .filter(Boolean)
            .join(' ') || faker.person.fullName();
        const phone = booking.phone || `+91${faker.string.numeric(10)}`;
        const status = booking.currentStatus || 'Confirm';
        const source = booking.source || 'Direct';
        const roomShortCode = booking.channel_id || `CHAN${booking.property_id}`;

        // Fetch counts from booking_rentalInfo or default
        const [rentalInfo] = await connection.query(
            "SELECT adult, child FROM booking_rentalInfo WHERE booking_id = ? LIMIT 1",
            [booking.id]
        );
        const adults = rentalInfo.length > 0 ? rentalInfo[0].adult : 2;
        const children = rentalInfo.length > 0 ? rentalInfo[0].child : 0;
        const totalGuests = Number(adults) + Number(children);

        const now = new Date();
        const todayStr = formatDate(now);
        const nowTimestamp = now.toISOString().slice(0, 19).replace('T', ' ');

        await connection.query(
            `INSERT INTO live_bookings (
                ReservationNo, BookingStatus, Source, RoomShortCode,
                GuestName, Mobile, Email, Adult, Child, NoOfGuest,
                ArrivalDate, DepartureDate, NoOfNights, Status,
                TotalInclusiveTax, FirstName, LastName, ReservationGuarantee,
                Createdatetime, SyncDate
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                reservationNo,
                status,
                source,
                roomShortCode,
                guestName,
                phone,
                booking.email || `guest_${booking.id}@example.com`,
                adults,
                children,
                totalGuests,
                arrivalDate,
                departureDate,
                nights,
                status,
                23600,
                booking.firstname || faker.person.firstName(),
                booking.lastname || faker.person.lastName(),
                'Guaranteed',
                nowTimestamp,
                todayStr
            ]
        );
        inserted += 1;
        logger.log(`✅ Mirrored bookings.id=${booking.id} -> live_bookings.ReservationNo=${reservationNo}`);
    }

    logger.log(`🎯 Live booking mirroring complete. Inserted ${inserted} new row(s).`);
    return { inserted, userId };
}

module.exports = {
    mirrorBookingsForUser,
};
