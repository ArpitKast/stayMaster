'use strict';

/**
 * HTTP smoke test for Scalnex webhook (requires running server + DB + env).
 * Run: node scripts/test_scalnex_webhook_http.js
 */

const http = require('http');

const port = process.env.PORT || 8080;
const secret = process.env.SCALNEX_WEBHOOK_SECRET || 'dev-scalnex-secret';
const slug = `local-test-${Date.now()}`;
const payload = JSON.stringify({
  article: {
    _doc: {
      heading: 'Scalnex Local Webhook Test',
      introText: 'Smoke test from test_scalnex_webhook_http.js',
      tags: ['Travel', 'Goa'],
      subURL: slug,
      primaryKeyword: 'goa travel',
      metaTitle: 'Scalnex Local Test',
      metaDescription: 'Local webhook smoke test',
    },
    columns: [
      {
        columnType: 'image',
        sectionPriority: 1,
        content: 'https://picsum.photos/800/450',
      },
      {
        columnType: 'text',
        sectionPriority: 2,
        content: '<p>Test body from local webhook HTTP smoke test.</p>',
      },
    ],
  },
});

const options = {
  hostname: '127.0.0.1',
  port,
  path: '/api/webhooks/scalnex/blog',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'x-webhook-secret': secret,
  },
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Body:', body);
    process.exit(res.statusCode >= 200 && res.statusCode < 300 ? 0 : 1);
  });
});

req.on('error', (err) => {
  console.error('Request failed (is the server running?):', err.message);
  process.exit(1);
});

req.write(payload);
req.end();
