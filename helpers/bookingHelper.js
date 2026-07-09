'use strict';
var pool = require('../config/dbConnection');

const propertyModel = require('../models/propertyModel');
const Property = new propertyModel();
const bookingModel = require('../models/bookingModel');
const Booking = new bookingModel;
const user = require('../models/userModel');
const User = new user;
const utility = require("../helpers/utility");
const Utility = new utility;

const { format,addDays,startOfMonth,addMonths, endOfMonth, eachDayOfInterval,differenceInDays,isBefore,isPast,subDays } = require("date-fns");
class BookingHelper{

    async sendConfirmationEmail(booking,amount,email){
        console.log(`Sending confirmation email to ${email}`);
        var property = await Property.find("properties", {id: booking.property_id});
        var manager = await User.find("users", {id: property.general_manager});
        var google_maps_url = `https://www.google.com/maps/search/?api=1&query=${property.google_latitude},${property.google_longitude}`;
        var emailBody = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Booking Confirmation</title>
  <style>
    /* Mobile Styles */
    @media only screen and (max-width: 720px) {
      .container {
        width: 100% !important;
        padding: 0 15px !important;
      }
      .content, .footer {
        padding: 20px !important;
      }
      h1 {
        font-size: 22px !important;
      }
      h2 {
        font-size: 18px !important;
      }
      h3 {
        font-size: 16px !important;
      }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f4; font-family:'Segoe UI', sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4; padding:30px 0;">
    <tr>
      <td align="center">
        <table class="container" width="700" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 0 8px rgba(0,0,0,0.05); width:700px;">
          
          <!-- Header -->
          <tr>
            <td align="center" style="background-color:#1e2a38; padding:30px;">
              <h1 style="color:#ffffff; font-size:26px; margin:0;">Booking Confirmed</h1>
              <p style="color:#d1d1d1; margin:5px 0 0;">Thank you for choosing ${property.listing_name}</p>
            </td>
          </tr>

          <!-- Booking Details -->
          <tr>
            <td class="content" style="padding:30px;">
              <h2 style="color:#333; font-size:20px; margin:0 0 15px;">Reservation Summary</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size:15px; color:#555;">
                <tr>
                  <td style="padding:5px 0;"><strong>Check-In:</strong></td>
                  <td style="padding:5px 0;">${booking['check_in_date']}</td>
                </tr>
                <tr>
                  <td style="padding:5px 0;"><strong>Check-Out:</strong></td>
                  <td style="padding:5px 0;">${booking['check_out_date']}</td>
                </tr>
                <tr>
                  <td style="padding:5px 0;"><strong>No. of Nights:</strong></td>
                  <td style="padding:5px 0;">${differenceInDays(new Date(booking['check_out_date']),new Date(booking['check_in_date']))}</td>
                </tr>
                <tr>
                  <td style="padding:5px 0;"><strong>Total Amount:</strong></td>
                  <td style="padding:5px 0;">${amount}</td>
                </tr>
                <tr>
                  <td style="padding:5px 0;"><strong>Paid Amount:</strong></td>
                  <td style="padding:5px 0;">${amount}</td>
                </tr>
              </table>
              <p style="margin-top:20px; color:#333;">We acknowledge receipt of your payment and look forward to hosting you.</p>
            </td>
          </tr>

          <!-- Property Info -->
          <tr>
            <td class="content" style="background-color:#f9f9f9; padding:30px;">
              <h2 style="margin-top:0; font-size:20px; color:#333;">Property Details</h2>
              <p style="margin:5px 0;"><strong>Address:</strong><br/>${property.address_line_1}<br/>${property.address_line_2}<br/>${property.city},${property.state},${property.postcode}</p>
              <p style="margin:10px 0;">
                <a href="${google_maps_url}" style="color:#1e2a38; text-decoration:none;">📍 View on Google Maps</a>
              </p>

              <h3 style="margin-top:25px; font-size:17px; color:#333;">Hospitality Manager</h3>
              <p style="margin:5px 0;">${manager.firstname} ${manager.lastname}<br/>📞 ${manager.phone}<br/>📧 ${manager.email}</p>
            </td>
          </tr>

          <!-- House Rules & Terms -->
          <tr>
            <td class="content" style="padding:30px;">
              <h2 style="font-size:20px; color:#333;">Important Information</h2>

              <h3 style="margin-bottom:5px;">🏠 House Rules</h3>
                <p>
                ${property.house_rules}
                </p>

              <h3 style="margin:20px 0 5px;">💰 Security Deposit</h3>
              <p style="margin:0; color:#555;">A refundable deposit of <strong>${property.security_deposit_percentage}</strong> will be held and returned post-inspection.</p>

              <h3 style="margin:20px 0 5px;">📄 Terms & Conditions</h3>
              <p style="margin:0;">
                By confirming your booking, you agree to our 
                <a href="https://thestaymaster.com/terms-and-conditions" style="color:#1e2a38; text-decoration:underline;">terms & conditions</a> and house policies.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="footer" align="center" style="background-color:#1e2a38; color:#ccc; padding:20px; font-size:12px;">
              © 2025 Staymaster Services Private Limited. All rights reserved.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
        var emailSubject = "Booking Confirmation from Staymaster";
        await Utility.sendEMail(email,emailSubject,emailBody);
    }

    async getBookingDisplayInfo(id){
        var info = {};
        var booking = await Booking.bookingById(id);
        if(booking && booking.length > 0){
            booking = booking[0];
            booking['check_in_date'] = format(booking['start'], 'dd MM yyyy');
            booking['check_out_date'] = format(booking['end'], 'dd MM yyyy');
            booking['declaration'] = booking['declaration'] || 0;
            booking['esign_status'] = booking['esign_status'] || 'pending';
            booking['esign_request_id'] = booking['esign_request_id'] || null;
            booking['stayed_before'] = booking['stayed_before'] || '';
            booking['purpose_of_visit'] = booking['purpose_of_visit'] || '';
            booking['group_type'] = booking['group_type'] || '';
            booking['booker_name'] = booking['booker_name'] || '';
            booking['booker_phone'] = booking['booker_phone'] || '';
            booking['security_deposit'] = booking['security_deposit'] || 0;
            booking['security_deposit_paid'] = booking['security_deposit_paid'] || 0;
            booking['security_deposit_status'] = booking['security_deposit_status'] || 'unpaid';
            booking['security_deposit_reference'] = booking['security_deposit_reference'] || null;

            // Get tariff details
            const tariffs = await pool.query("select totalAmountBeforeTax, totalAmountAfterTax, totalPayment, taCommision from booking_tariffs where booking_id = ?",[booking.id]);
            if(tariffs[0].length > 0){
                booking["tariff"] = tariffs[0][0];
            } else {
                booking["tariff"] = { totalAmountAfterTax: 0, totalPayment: 0 };
            }

            var occupancy = await Booking.bookingOccupancy(booking.id);
            if(occupancy && occupancy.length > 0){
                booking['number_adults'] = occupancy[0].adult;
                booking['number_children'] = occupancy[0].child;
            }
            // Get guests list for the booking
            const guestsList = await pool.query(`
                SELECT 
                    id, is_lead as lead_guest, first_name as firstname, last_name as lastname, email, mobile as phone, 
                    guest_type, purpose_of_visit,
                    id_file, gender, dob, city, state, country, address, zip, stayed_before as stayedBefore
                FROM guest_details 
                WHERE booking_id = ?
            `, [booking.id]);
            info.guests = guestsList[0] || [];

            // Calculate total guests and filled guests count
            let totalGuests = (Number(booking['number_adults']) || 0) + (Number(booking['number_children']) || 0);

            // Fallback: if totalGuests is 0 but we have a guests list, use the list length
            if (totalGuests === 0 && info.guests.length > 0) {
                totalGuests = info.guests.length;
            }

            const filledGuestsCount = info.guests.filter(g =>
                g.id_file || (g.firstname && g.lastname)
            ).length;

            booking['total_guests'] = totalGuests;
            booking['filled_guests_count'] = filledGuestsCount;
        }else{
            booking = await Booking.tempBookingById(id);
            if(!booking || booking.length == 0){
                return null;
            }
            booking['check_in_date'] = format(booking['check_in_date'], 'dd MM yyyy');
            booking['check_out_date'] = format(booking['check_out_date'], 'dd MM yyyy');
        }
        booking['id'] = booking['uniqueId'];
        info.booking = booking;
        info.property = await Property.forBookingInfoDisplay(info.booking.property_id);
        info.guest = await User.forBookingInfoDisplay(info.booking.guest_id);
        return info;
    }

    async getBookingDisplayInfoByLocalId(id){
        var info = {};
        var bookingRows = await Booking.bookingByLocalId(id);
        if(bookingRows && bookingRows.length > 0){
            var booking = bookingRows[0];
            booking['check_in_date'] = format(booking['start'], 'dd MM yyyy');
            booking['check_out_date'] = format(booking['end'], 'dd MM yyyy');
            booking['declaration'] = booking['declaration'] || 0;
            booking['esign_status'] = booking['esign_status'] || 'pending';
            booking['esign_request_id'] = booking['esign_request_id'] || null;
            booking['stayed_before'] = booking['stayed_before'] || '';
            booking['purpose_of_visit'] = booking['purpose_of_visit'] || '';
            booking['group_type'] = booking['group_type'] || '';
            booking['booker_name'] = booking['booker_name'] || '';
            booking['booker_phone'] = booking['booker_phone'] || '';
            booking['security_deposit'] = booking['security_deposit'] || 0;
            booking['security_deposit_paid'] = booking['security_deposit_paid'] || 0;
            booking['security_deposit_status'] = booking['security_deposit_status'] || 'unpaid';
            booking['security_deposit_reference'] = booking['security_deposit_reference'] || null;

            // Get tariff details
            const tariffs = await pool.query("select totalAmountBeforeTax, totalAmountAfterTax, totalPayment, taCommision from booking_tariffs where booking_id = ?",[booking.id]);
            if(tariffs[0].length > 0){
                booking["tariff"] = tariffs[0][0];
            } else {
                booking["tariff"] = { totalAmountAfterTax: 0, totalPayment: 0 };
            }

            var occupancy = await Booking.bookingOccupancy(booking.id);
            if(occupancy && occupancy.length > 0){
                booking['number_adults'] = occupancy[0].adult;
                booking['number_children'] = occupancy[0].child;
            }
            // Get guests list for the booking
            const guestsList = await pool.query(`
                SELECT 
                    id, is_lead as lead_guest, first_name as firstname, last_name as lastname, email, mobile as phone, 
                    guest_type, purpose_of_visit,
                    id_file, gender, dob, city, state, country, address, zip, stayed_before as stayedBefore
                FROM guest_details 
                WHERE booking_id = ?
            `, [booking.id]);
            info.guests = guestsList[0] || [];

            // Calculate total guests and filled guests count
            let totalGuests = (Number(booking['number_adults']) || 0) + (Number(booking['number_children']) || 0);

            // Fallback: if totalGuests is 0 but we have a guests list, use the list length
            if (totalGuests === 0 && info.guests.length > 0) {
                totalGuests = info.guests.length;
            }

            const filledGuestsCount = info.guests.filter(g =>
                g.id_file || (g.firstname && g.lastname)
            ).length;

            booking['total_guests'] = totalGuests;
            booking['filled_guests_count'] = filledGuestsCount;
            info.booking = booking;
            info.property = await Property.forBookingInfoDisplay(info.booking.property_id);
            info.guest = await User.forBookingInfoDisplay(info.booking.guest_id);
            return info;
        }

        // Fallback for cases where FE still sends uniqueId or booking not yet synced
        var uniqueRows = await Booking.bookingById(id);
        if(uniqueRows && uniqueRows.length > 0){
            var booking = uniqueRows[0];
            booking['check_in_date'] = format(booking['start'], 'dd MM yyyy');
            booking['check_out_date'] = format(booking['end'], 'dd MM yyyy');
            booking['declaration'] = booking['declaration'] || 0;
            booking['esign_status'] = booking['esign_status'] || 'pending';
            booking['esign_request_id'] = booking['esign_request_id'] || null;
            booking['stayed_before'] = booking['stayed_before'] || '';
            booking['purpose_of_visit'] = booking['purpose_of_visit'] || '';
            booking['group_type'] = booking['group_type'] || '';
            booking['booker_name'] = booking['booker_name'] || '';
            booking['booker_phone'] = booking['booker_phone'] || '';
            booking['security_deposit'] = booking['security_deposit'] || 0;
            booking['security_deposit_paid'] = booking['security_deposit_paid'] || 0;
            booking['security_deposit_status'] = booking['security_deposit_status'] || 'unpaid';
            booking['security_deposit_reference'] = booking['security_deposit_reference'] || null;

            const tariffs = await pool.query("select totalAmountBeforeTax, totalAmountAfterTax, totalPayment, taCommision from booking_tariffs where booking_id = ?",[booking.id]);
            if(tariffs[0].length > 0){
                booking["tariff"] = tariffs[0][0];
            } else {
                booking["tariff"] = { totalAmountAfterTax: 0, totalPayment: 0 };
            }

            var occupancy = await Booking.bookingOccupancy(booking.id);
            if(occupancy && occupancy.length > 0){
                booking['number_adults'] = occupancy[0].adult;
                booking['number_children'] = occupancy[0].child;
            }

            const guestsList = await pool.query(`
                SELECT 
                    id, is_lead as lead_guest, first_name as firstname, last_name as lastname, email, mobile as phone, 
                    guest_type, purpose_of_visit,
                    id_file, gender, dob, city, state, country, address, zip, stayed_before as stayedBefore
                FROM guest_details 
                WHERE booking_id = ?
            `, [booking.id]);
            info.guests = guestsList[0] || [];

            let totalGuests = (Number(booking['number_adults']) || 0) + (Number(booking['number_children']) || 0);
            if (totalGuests === 0 && info.guests.length > 0) {
                totalGuests = info.guests.length;
            }
            const filledGuestsCount = info.guests.filter(g =>
                g.id_file || (g.firstname && g.lastname)
            ).length;

            booking['total_guests'] = totalGuests;
            booking['filled_guests_count'] = filledGuestsCount;
            info.booking = booking;
            info.property = await Property.forBookingInfoDisplay(info.booking.property_id);
            info.guest = await User.forBookingInfoDisplay(info.booking.guest_id);
            return info;
        }

        // Finally, fallback to booking_temp for pre-imported bookings
        var tempBooking = await Booking.tempBookingById(id);
        if(!tempBooking){
            return null;
        }
        tempBooking['check_in_date'] = format(tempBooking['check_in_date'], 'dd MM yyyy');
        tempBooking['check_out_date'] = format(tempBooking['check_out_date'], 'dd MM yyyy');
        tempBooking['total_guests'] = tempBooking['total_guests'] || 0;
        tempBooking['filled_guests_count'] = tempBooking['filled_guests_count'] || 0;
        info.booking = tempBooking;
        info.property = await Property.forBookingInfoDisplay(tempBooking.property_id);
        info.guest = await User.forBookingInfoDisplay(tempBooking.guest_id);
        info.guests = [];
        return info;
    }
}
module.exports = BookingHelper;