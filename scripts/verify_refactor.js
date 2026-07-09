'use strict';
const pool = require('../config/dbConnection');
const BookingModel = require('../models/bookingModel');
const Booking = new BookingModel();

async function verifyLogic() {
    console.log('🔍 Verifying refactored booking logic at database level...');

    try {
        const testUniqueId = 999999999; // Test ID
        
        // 1. Test Booking.save
        const bookingData = {
            uniqueId: testUniqueId,
            subBookingId: 'SUB' + testUniqueId,
            property_id: 204,
            guest_id: 77337,
            start: '2027-10-01',
            end: '2027-10-03',
            status: 'Confirmed',
            isConfirmed: 1,
            currentStatus: 'Confirmed',
            bookedBy: 'Test Runner',
            source: 'Verification Script',
            createDatetime: new Date(),
            modifyDatetime: new Date()
        };

        console.log('--- Testing Booking.save ---');
        const savedBooking = await Booking.save(bookingData);
        console.log('✅ Saved Booking ID:', savedBooking.id);

        // 2. Test Booking.saveBookingGuests
        const guestData = {
            booking_id: savedBooking.id,
            firstname: 'Test',
            lastname: 'Guest',
            email: 'test@example.com',
            phone: '1234567890',
            is_lead: 1,
            declaration: 1
        };

        console.log('--- Testing Booking.saveBookingGuests ---');
        const savedGuest = await Booking.saveBookingGuests(guestData);
        console.log('✅ Saved Guest ID:', savedGuest.id);
        console.log('✅ Guest linked to Booking ID:', savedGuest.booking_id);

        // Cleanup
        console.log('--- Cleaning up test records ---');
        await pool.query('DELETE FROM guest_details WHERE booking_id = ?', [savedBooking.id]);
        await pool.query('DELETE FROM bookings WHERE id = ?', [savedBooking.id]);
        console.log('✅ Cleanup complete.');

        console.log('🎉 Verification successful!');

    } catch (error) {
        console.error('❌ Verification failed:', error);
    } finally {
        await pool.end();
    }
}

verifyLogic();
