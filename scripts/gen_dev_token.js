/**
 * DEV UTILITY — generates a short-lived guest JWT for local testing.
 * NEVER run this in production. Never commit tokens it produces.
 *
 * Usage:
 *   node scripts/gen_dev_token.js <userId> [phone]
 *
 * Examples:
 *   node scripts/gen_dev_token.js 11560
 *   node scripts/gen_dev_token.js 11560 +917877829435
 *
 * The script prints:
 *   - The JWT token (set as logincookie or pass as Authorization: Bearer <token>)
 *   - A ready-to-use curl command to verify the token works
 */

'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const jwt = require('jsonwebtoken');

const userId  = parseInt(process.argv[2], 10);
const phone   = process.argv[3] || `dev-user-${userId}`;

if (!userId || isNaN(userId)) {
    console.error('Usage: node scripts/gen_dev_token.js <userId> [phone]');
    console.error('Example: node scripts/gen_dev_token.js 11560 +917877829435');
    process.exit(1);
}

const secret = process.env.ACCESS_TOKEN_SECRET;
if (!secret) {
    console.error('ERROR: ACCESS_TOKEN_SECRET not set in .env');
    process.exit(1);
}

const payload = {
    user: {
        id:    userId,
        email: phone,   // guest login uses phone as the identity field
        phone: phone,
    }
};

const token = jwt.sign(payload, secret, { expiresIn: '120m' });

const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 4001}`;

console.log('\n=== DEV TOKEN (valid 2h) ===');
console.log(token);
console.log('\n=== Set as cookie in browser DevTools > Application > Cookies ===');
console.log(`Name: logincookie`);
console.log(`Value: ${token}`);
console.log('\n=== OR use with curl ===');
console.log(`curl -s -H "Authorization: Bearer ${token}" ${baseUrl}/api/ext/myBookings | jq .`);
console.log('\n=== OR paste into prcheckin-user .env.local for quick test ===');
console.log(`VITE_DEV_TOKEN=${token}`);
console.log('');
