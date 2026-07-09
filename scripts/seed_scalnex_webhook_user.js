'use strict';

/**
 * Create (or find) the Scalnex webhook system user.
 * Run: node scripts/seed_scalnex_webhook_user.js
 *
 * Set SCALNEX_WEBHOOK_AUTHOR_ID in .env to the printed user id.
 */

const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const { ROLE_STAFF } = require('../config/constants');

const defaultEnv = path.join(__dirname, '../.env');
dotenv.config({ path: defaultEnv });

const BOT_EMAIL = 'scalnex-bot@staymaster.in';
const BOT_FIRST = 'Scalnex';
const BOT_LAST = 'Bot';

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const [existing] = await connection.query('SELECT id, email FROM users WHERE email = ? LIMIT 1', [
      BOT_EMAIL,
    ]);

    if (existing.length > 0) {
      const userId = existing[0].id;
      console.log(`Scalnex bot user already exists (id=${userId}, email=${BOT_EMAIL})`);
      console.log(`Set in .env: SCALNEX_WEBHOOK_AUTHOR_ID=${userId}`);
      return;
    }

    const passwordHash = await bcrypt.hash(`scalnex-bot-${Date.now()}`, 10);
    const [result] = await connection.query(
      'INSERT INTO users (firstname, lastname, email, password, role) VALUES (?, ?, ?, ?, ?)',
      [BOT_FIRST, BOT_LAST, BOT_EMAIL, passwordHash, ROLE_STAFF]
    );

    const userId = result.insertId;
    console.log(`Created Scalnex bot user (id=${userId}, email=${BOT_EMAIL})`);
    console.log(`Set in .env: SCALNEX_WEBHOOK_AUTHOR_ID=${userId}`);
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error('Failed to seed Scalnex webhook user:', err.message);
  process.exit(1);
});
