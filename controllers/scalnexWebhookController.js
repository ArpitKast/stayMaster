'use strict';

const asyncHandler = require('express-async-handler');
const Response = require('../helpers/responseHelper');
const { handleScalnexWebhook } = require('../services/scalnexBlogIngestService');
const { createLogger } = require('../helpers/logger');

const log = createLogger('scalnex-webhook');

/**
 * POST /api/webhooks/scalnex/blog
 * Receives pre-created blog JSON from Scalnex.ai and saves as draft.
 */
const receiveBlog = asyncHandler(async (req, res) => {
  const payload = req.body;

  log.info('Incoming webhook request', {
    ip: req.ip,
    content_length: req.headers['content-length'] || null,
    has_article: Boolean(payload && payload.article),
  });

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    log.warn('Rejected webhook: body is not a JSON object', { ip: req.ip, body_type: Array.isArray(payload) ? 'array' : typeof payload });
    return Response.error(res, 'INVALID_PAYLOAD', 'Request body must be a JSON object', 400);
  }

  try {
    const result = await handleScalnexWebhook(payload);

    return Response.success(
      res,
      {
        blog_id: result.blog_id,
        status: result.draft ? 'draft' : 'published',
        action: result.status,
        log_id: result.log_id,
        message: result.message || 'Blog ingested successfully',
        skipped_publish_update: result.skipped_publish_update || false,
      },
      200
    );
  } catch (error) {
    // Full detail (message, stack, payload metadata) is captured in the ingest
    // service logs and the scalnex_webhook_log DB table; this is the HTTP-layer record.
    log.error('Webhook request failed', { ip: req.ip, error });
    return Response.error(res, 'INGEST_FAILED', error.message, 422);
  }
});

module.exports = {
  receiveBlog,
};
