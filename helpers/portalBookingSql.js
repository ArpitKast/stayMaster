'use strict';

/**
 * Main site + legacy: booking owned by portal user_id OR, when user_id is null, by guest_id.
 */
function portalBookingWhere(alias = 'b') {
    const p = alias ? `${alias}.` : '';
    return `(${p}user_id = ? OR (${p}user_id IS NULL AND ${p}guest_id = ?))`;
}

function portalBookingParams(userId) {
    return [userId, userId];
}

/**
 * Precheckin app only: booking must have user_id set and match the logged-in portal user.
 * @param {string} alias Table alias in SQL (e.g. 'b' for `FROM bookings b`). Use '' when the FROM clause has no alias (`FROM bookings`).
 */
function precheckinPortalWhere(alias = '') {
    const p = alias ? `${alias}.` : '';
    return `(${p}user_id = ? AND ${p}user_id IS NOT NULL)`;
}

function precheckinPortalParams(userId) {
    return [userId];
}

module.exports = {
    portalBookingWhere,
    portalBookingParams,
    precheckinPortalWhere,
    precheckinPortalParams,
};
