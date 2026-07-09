'use strict';

const pool = require('../config/dbConnection');
const baseModel = require('./baseModel');

class NotificationModel extends baseModel {
    constructor() {
        super('notifications');
    }

    async saveDeviceToken(userId, deviceToken, platform = 'host_app') {
        if (!userId) {
            throw new Error('userId is required to save a device token');
        }
        if (!deviceToken) {
            throw new Error('deviceToken is required');
        }
        const [existing] = await pool.query(
            'select id from device_tokens where user_id = ? and device_token = ? limit 1',
            [userId, deviceToken]
        );
        if (existing.length) {
            await pool.query(
                'update device_tokens set platform = ?, updated_at = CURRENT_TIMESTAMP where id = ?',
                [platform, existing[0].id]
            );
            return existing[0].id;
        }
        const [result] = await pool.query(
            'insert into device_tokens (user_id, device_token, platform) values (?,?,?)',
            [userId, deviceToken, platform]
        );
        return result.insertId;
    }

    async tokensForUsers(userIds = []) {
        if (!Array.isArray(userIds) || userIds.length === 0) {
            return [];
        }
        const placeholders = userIds.map(() => '?').join(',');
        const [rows] = await pool.query(
            `select device_token from device_tokens where user_id in (${placeholders})`,
            userIds
        );
        return rows.map((row) => row.device_token);
    }

    async createNotification({ userId, title, body, data = {}, status = 'sent', response = null }) {
        if (!userId) {
            throw new Error('userId is required to create a notification record');
        }
        const payload = {
            user_id: userId,
            title,
            body,
            data: JSON.stringify(data || {}),
            status,
            is_read: 0,
            fcm_response: response ? JSON.stringify(response) : null,
            sent_at: new Date(),
        };
        const [result] = await pool.query('insert into notifications SET ?', payload);
        return result.insertId;
    }

    async notificationsForUser(userId, limit = 50) {
        if (!userId) {
            return [];
        }
        const safeLimit = Number.isFinite(Number(limit)) && Number(limit) > 0 ? Number(limit) : 50;
        const [rows] = await pool.query(
            'select id,title,body,data,status,is_read,read_at,sent_at,created_at from notifications where user_id = ? order by created_at desc limit ?',
            [userId, safeLimit]
        );
        return rows.map((row) => ({
            id: row.id,
            title: row.title,
            body: row.body,
            data: this.safeParse(row.data),
            status: row.status,
            is_read: Boolean(row.is_read),
            read_at: row.read_at,
            sent_at: row.sent_at,
            created_at: row.created_at,
        }));
    }

    async markRead(notificationId, userId, isRead = true) {
        if (!notificationId || !userId) {
            return 0;
        }
        const [result] = await pool.query(
            'update notifications set is_read = ?, read_at = ? where id = ? and user_id = ?',
            [isRead ? 1 : 0, isRead ? new Date() : null, notificationId, userId]
        );
        return Number(result.affectedRows) || 0;
    }

    async markAllRead(userId) {
        if (!userId) {
            return 0;
        }
        const [result] = await pool.query(
            'update notifications set is_read = 1, read_at = IFNULL(read_at, NOW()) where user_id = ? and is_read = 0',
            [userId]
        );
        return Number(result.affectedRows) || 0;
    }

    async unreadCount(userId) {
        if (!userId) {
            return 0;
        }
        const [rows] = await pool.query(
            'select count(*) as cnt from notifications where user_id = ? and is_read = 0',
            [userId]
        );
        return Number(rows[0]?.cnt) || 0;
    }

    safeParse(value) {
        try {
            if (!value) return {};
            if (typeof value === 'object') return value;
            return JSON.parse(value);
        } catch (_err) {
            return {};
        }
    }
}

module.exports = NotificationModel;
