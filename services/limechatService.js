'use strict';

const axios = require('axios');

class LimechatService {
    constructor() {
        this.endpoint = 'https://flow-builder.limechat.ai/api/v1/cvf-events';
        this.accessToken = process.env.LIMECHAT_ACCESS_TOKEN || '';
        this.accountId = process.env.LIMECHAT_ACCOUNT_ID || process.env.LIMECHAT_FB_ACCOUNT_ID || '';
        this.timeoutMs = parseInt(process.env.LIMECHAT_TIMEOUT_MS || '10000', 10);
    }

    buildBookingConfirmationPayload(ezeeBody) {
        const reservation = ezeeBody?.data?.Reservations?.Reservation?.[0] || null;
        const bookingTran = reservation?.BookingTran?.[0] || null;

        const firstName = bookingTran?.FirstName || reservation?.FirstName || '';
        const dateReservation = bookingTran?.Start || '';
        const propertyName = reservation?.LocationId || ezeeBody?.hotel_code || '';
        const roomCategory = bookingTran?.RoomTypeName || bookingTran?.RoomTypeCode || '';

        const phoneRaw =
            bookingTran?.Mobile ||
            bookingTran?.Phone ||
            reservation?.Mobile ||
            reservation?.Phone ||
            '';

        const digits = typeof phoneRaw === 'string' ? phoneRaw.replace(/\D/g, '') : '';
        const distinctId = digits || phoneRaw || '';
        const phone = phoneRaw?.startsWith('+') ? phoneRaw : (digits ? `+${digits}` : phoneRaw);

        return {
            distinct_id: distinctId,
            phone,
            event: 'booking_confirmation',
            data: {
                first_name: firstName,
                date_reservation: dateReservation,
                property_name: propertyName,
                room_category: roomCategory
            }
        };
    }

    async sendEvent(payload) {
        if (!this.accessToken || !this.accountId) {
            return { skipped: true, reason: 'missing_credentials' };
        }

        const response = await axios.post(this.endpoint, payload, {
            headers: {
                'Content-Type': 'application/json',
                'x-limechat-uat': this.accessToken,
                'x-fb-account-id': this.accountId
            },
            timeout: this.timeoutMs
        });

        return { status: response.status, data: response.data };
    }
}

module.exports = LimechatService;
