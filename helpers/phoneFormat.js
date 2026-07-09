'use strict';

/**
 * Format a phone string for Twilio SMS (E.164).
 * Indian mobiles: 10 digits starting with 6–9 → +91...
 * Avoids naive "+{digits}" which turns 7060123456 into +706... (parsed as Russia +7, invalid).
 *
 * @param {string|number} input
 * @returns {string}
 */
function formatPhoneForSms(input) {
    if (input == null || String(input).trim() === '') {
        return String(input ?? '');
    }
    let s = String(input).trim().replace(/\s+/g, '');

    if (s.startsWith('+')) {
        const digits = s.slice(1).replace(/\D/g, '');
        if (!digits.length) {
            return s;
        }
        // "+7060..." — 10-digit Indian number with a stray "+"; Twilio would parse as +7 (invalid)
        if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) {
            return `+91${digits}`;
        }
        return `+${digits}`;
    }

    const digitsOnly = s.replace(/\D/g, '');

    // India: 10-digit mobile (first digit 6–9)
    if (digitsOnly.length === 10 && /^[6-9]\d{9}$/.test(digitsOnly)) {
        return `+91${digitsOnly}`;
    }
    // India: 91 + 10-digit
    if (digitsOnly.length === 12 && digitsOnly.startsWith('91') && /^91[6-9]\d{9}$/.test(digitsOnly)) {
        return `+${digitsOnly}`;
    }
    // Leading 0 (local trunk) stripped for India
    if (digitsOnly.length === 11 && digitsOnly.startsWith('0') && /^0[6-9]\d{9}$/.test(digitsOnly)) {
        return `+91${digitsOnly.slice(1)}`;
    }

    if (digitsOnly.length >= 8) {
        return `+${digitsOnly}`;
    }
    return `+${digitsOnly}`;
}

module.exports = { formatPhoneForSms };
