/**
 * AbandonedBookingModel
 * One row per (user_id, property_id) — UNIQUE KEY on that pair.
 * All saves use INSERT … ON DUPLICATE KEY UPDATE so concurrent requests
 * are handled atomically by the DB engine; no SELECT-then-INSERT race.
 */

const pool = require('../config/dbConnection');

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS abandoned_bookings (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         INT UNSIGNED NOT NULL,
    property_id     INT UNSIGNED NOT NULL DEFAULT 0,
    session_id      VARCHAR(128) DEFAULT NULL,
    booking_data    JSON NOT NULL,
    last_completed_step VARCHAR(64) NOT NULL DEFAULT 'login',
    status          ENUM('abandoned', 'resumed', 'completed') NOT NULL DEFAULT 'abandoned',
    last_activity_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_user_property (user_id, property_id),
    INDEX idx_status   (status),
    INDEX idx_activity (last_activity_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

let _tableReady = false;

class AbandonedBookingModel {
    async _ensureTable() {
        if (_tableReady) return;
        await pool.query(CREATE_TABLE_SQL);
        // Migrate existing tables: add property_id column + composite unique key
        try {
            await pool.query(`ALTER TABLE abandoned_bookings ADD COLUMN IF NOT EXISTS property_id INT UNSIGNED NOT NULL DEFAULT 0 AFTER user_id`);
        } catch (_) {}
        try {
            await pool.query(`ALTER TABLE abandoned_bookings DROP INDEX IF EXISTS uniq_user_id`);
        } catch (_) {}
        try {
            await pool.query(`ALTER TABLE abandoned_bookings ADD UNIQUE KEY IF NOT EXISTS uniq_user_property (user_id, property_id)`);
        } catch (_) {}
        _tableReady = true;
    }

    /**
     * Atomically create or update the abandoned-booking row for (user, property).
     * Uses INSERT … ON DUPLICATE KEY UPDATE — no race condition possible.
     */
    async upsert({ userId, propertyId, sessionId, bookingData, lastCompletedStep }) {
        await this._ensureTable();

        const dataJson = typeof bookingData === 'string'
            ? bookingData
            : JSON.stringify(bookingData);

        await pool.execute(
            `INSERT INTO abandoned_bookings
                 (user_id, property_id, session_id, booking_data, last_completed_step, status)
             VALUES (?, ?, ?, ?, ?, 'abandoned')
             ON DUPLICATE KEY UPDATE
                 booking_data        = VALUES(booking_data),
                 last_completed_step = VALUES(last_completed_step),
                 status              = 'abandoned',
                 session_id          = COALESCE(VALUES(session_id), session_id),
                 last_activity_at    = NOW(),
                 updated_at          = NOW()`,
            [userId, propertyId || 0, sessionId || null, dataJson, lastCompletedStep || 'login']
        );
    }

    /**
     * Fetch the abandoned-booking row for (user, property).
     * Returns null when not found or already completed.
     */
    async getForUser(userId, propertyId) {
        await this._ensureTable();
        const [rows] = await pool.execute(
            `SELECT ab.*, u.firstname, u.lastname, u.email, u.phone
             FROM abandoned_bookings ab
             LEFT JOIN users u ON u.id = ab.user_id
             WHERE ab.user_id = ? AND ab.property_id = ? AND ab.status != 'completed'
             LIMIT 1`,
            [userId, propertyId || 0]
        );
        return rows[0] || null;
    }

    /**
     * Mark (user, property) record as completed after a successful booking.
     */
    async markCompleted(userId, propertyId) {
        await this._ensureTable();
        await pool.execute(
            `UPDATE abandoned_bookings SET status = 'completed', updated_at = NOW()
             WHERE user_id = ? AND property_id = ?`,
            [userId, propertyId || 0]
        );
    }

    /**
     * Mark (user, property) record as resumed when they return to checkout.
     */
    async markResumed(userId, propertyId) {
        await this._ensureTable();
        await pool.execute(
            `UPDATE abandoned_bookings SET status = 'resumed', updated_at = NOW()
             WHERE user_id = ? AND property_id = ? AND status = 'abandoned'`,
            [userId, propertyId || 0]
        );
    }

    /**
     * Admin: paginated list with user details, newest activity first.
     */
    async list({ status = 'abandoned', page = 1, limit = 20 } = {}) {
        await this._ensureTable();
        const offset = (page - 1) * limit;

        const validStatuses = ['abandoned', 'resumed', 'completed', 'all'];
        const sf = validStatuses.includes(status) ? status : 'abandoned';
        const whereClause = sf === 'all' ? '' : `WHERE ab.status = '${sf}'`;
        const countWhere  = sf === 'all' ? '' : `WHERE status = '${sf}'`;

        const [rows] = await pool.execute(
            `SELECT ab.*, u.firstname, u.lastname, u.email, u.phone
             FROM abandoned_bookings ab
             LEFT JOIN users u ON u.id = ab.user_id
             ${whereClause}
             ORDER BY ab.last_activity_at DESC
             LIMIT ${Number(limit)} OFFSET ${Number(offset)}`
        );

        const [[{ total }]] = await pool.execute(
            `SELECT COUNT(*) AS total FROM abandoned_bookings ${countWhere}`
        );

        return { rows, total: Number(total), page: Number(page), limit: Number(limit) };
    }

    /**
     * Admin: delete a record by id.
     */
    async deleteById(id) {
        await this._ensureTable();
        await pool.execute(`DELETE FROM abandoned_bookings WHERE id = ?`, [id]);
    }
}

module.exports = AbandonedBookingModel;
