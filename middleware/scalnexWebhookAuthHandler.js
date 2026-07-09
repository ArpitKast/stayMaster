'use strict';

const asyncHandler = require('express-async-handler');

/**
 * Validates Scalnex webhook shared secret from headers.
 */
const scalnexWebhookAuth = asyncHandler(async (req, res, next) => {
  const webhookSecret = process.env.SCALNEX_WEBHOOK_SECRET;
  const isProduction =
    process.env.NODE_ENV === 'production' || process.env.MODE === 'production';

  if (!webhookSecret) {
    if (isProduction) {
      console.error('[Scalnex Webhook] SCALNEX_WEBHOOK_SECRET missing in production');
      return res.status(503).json({
        success: false,
        error: 'Webhook authentication is not configured',
      });
    }
    console.warn('[Scalnex Webhook] SCALNEX_WEBHOOK_SECRET not set; skipping validation (dev only)');
    return next();
  }

  const receivedSecret =
    req.headers['x-webhook-secret'] ||
    req.headers['webhook-security-key'] ||
    req.headers['x-scalnex-secret'] ||
    req.query.secret;

  if (receivedSecret !== webhookSecret) {
    console.error('[Scalnex Webhook] Invalid webhook secret');
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
    });
  }

  next();
});

module.exports = scalnexWebhookAuth;
