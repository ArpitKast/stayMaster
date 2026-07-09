'use strict';

const pool = require('../config/dbConnection');

class ScalnexWebhookLogModel {
  async create({ event_type, external_id, payload, status = 'received', blog_id = null, error_message = null }) {
    const [result] = await pool.query(
      `INSERT INTO scalnex_webhook_log (event_type, external_id, payload, status, blog_id, error_message)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        event_type || null,
        external_id || null,
        JSON.stringify(payload ?? {}),
        status,
        blog_id,
        error_message,
      ]
    );
    return result.insertId;
  }

  async updateStatus(id, { status, blog_id = null, error_message = null }) {
    await pool.query(
      `UPDATE scalnex_webhook_log SET status = ?, blog_id = COALESCE(?, blog_id), error_message = ? WHERE id = ?`,
      [status, blog_id, error_message, id]
    );
  }
}

module.exports = ScalnexWebhookLogModel;
