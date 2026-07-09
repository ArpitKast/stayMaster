'use strict';

const Blog = require('../models/blogModel');
const ScalnexWebhookLogModel = require('../models/scalnexWebhookLogModel');
const { mapScalnexPayloadToBlog, EXTERNAL_SOURCE } = require('./scalnexBlogAdapter');
const { uploadBlogImageFromUrlToS3 } = require('../helpers/blogImageHelper');
const { createLogger } = require('../helpers/logger');

const BlogModel = new Blog();
const WebhookLog = new ScalnexWebhookLogModel();
const log = createLogger('scalnex-ingest');

function resolveAuthorId() {
  const id = parseInt(process.env.SCALNEX_WEBHOOK_AUTHOR_ID, 10);
  if (!Number.isNaN(id) && id > 0) {
    return id;
  }
  throw new Error(
    'SCALNEX_WEBHOOK_AUTHOR_ID is not configured. Run: node scripts/seed_scalnex_webhook_user.js'
  );
}

/**
 * Ingest a Scalnex webhook payload into the blogs table.
 * @param {object} payload Raw JSON body
 * @returns {Promise<{ blog_id: number, status: 'created'|'updated', draft: boolean }>}
 */
async function ingestScalnexBlog(payload) {
  const mapped = mapScalnexPayloadToBlog(payload);

  if (!mapped.title || !mapped.content) {
    throw new Error('Missing required fields: article._doc.heading and article.columns content');
  }

  const author_id = resolveAuthorId();
  let featured_image = null;

  if (mapped.featured_image_url) {
    featured_image = await uploadBlogImageFromUrlToS3(mapped.featured_image_url);
    if (!featured_image) {
      log.warn('Featured image upload failed; saving blog without image', {
        image_url: mapped.featured_image_url,
        external_id: mapped.external_id,
      });
    }
  }

  const blogFields = {
    title: mapped.title,
    content: mapped.content,
    author_id,
    category: mapped.category,
    meta_tags: mapped.meta_tags,
    keywords: mapped.keywords,
    written_by: mapped.written_by,
    listing_excerpt: mapped.listing_excerpt,
    featured_image,
    qa_section: mapped.qa_section != null ? JSON.stringify(mapped.qa_section) : null,
    active: mapped.active,
    external_source: mapped.external_source,
    external_id: mapped.external_id,
  };

  if (mapped.external_id) {
    const existing = await BlogModel.find('blogs', {
      external_source: EXTERNAL_SOURCE,
      external_id: mapped.external_id,
    });

    if (existing) {
      if (Number(existing.active) === 1) {
        return {
          blog_id: existing.id,
          status: 'updated',
          draft: false,
          skipped_publish_update: true,
          message: 'Blog already published; webhook update skipped to avoid overwriting live content.',
        };
      }

      const updateFields = { ...blogFields };
      delete updateFields.author_id;
      await BlogModel.update(existing.id, updateFields);

      return {
        blog_id: existing.id,
        status: 'updated',
        draft: mapped.active === 0,
      };
    }
  }

  const blog_id = await BlogModel.create(blogFields);

  return {
    blog_id,
    status: 'created',
    draft: mapped.active === 0,
  };
}

/**
 * Best-effort metadata extraction that never throws, so we can still write an
 * audit-log row for malformed payloads (which is exactly when we most need it).
 */
function safeExtractMeta(payload) {
  try {
    const mapped = mapScalnexPayloadToBlog(payload);
    return { event_type: mapped.event_type, external_id: mapped.external_id };
  } catch (_) {
    return {
      event_type: payload?.event || payload?.event_type || payload?.type || null,
      external_id: payload?.article?._doc?.subURL || payload?.subURL || payload?.id || null,
    };
  }
}

/**
 * Full webhook handling with a DB audit log (`scalnex_webhook_log`) plus file logs.
 *
 * The audit-log row is created from the RAW payload before mapping/ingestion, so a
 * malformed payload or an ingest crash still leaves a traceable record. Failures to
 * write the audit log are themselves logged but never abort the request.
 */
async function handleScalnexWebhook(payload) {
  const meta = safeExtractMeta(payload);

  let logId = null;
  try {
    logId = await WebhookLog.create({
      event_type: meta.event_type,
      external_id: meta.external_id,
      payload,
      status: 'received',
    });
    log.info('Webhook received', { log_id: logId, event_type: meta.event_type, external_id: meta.external_id });
  } catch (logError) {
    // Don't fail the webhook just because the audit log couldn't be written.
    log.error('Failed to write webhook audit log row', { error: logError, external_id: meta.external_id });
  }

  try {
    const result = await ingestScalnexBlog(payload);
    const logStatus = result.status === 'created' ? 'created' : 'updated';

    if (logId) {
      try {
        await WebhookLog.updateStatus(logId, { status: logStatus, blog_id: result.blog_id });
      } catch (logError) {
        log.error('Failed to update webhook audit log status', { error: logError, log_id: logId });
      }
    }

    log.info('Blog ingested successfully', {
      log_id: logId,
      blog_id: result.blog_id,
      status: result.status,
      draft: result.draft,
      external_id: meta.external_id,
    });

    return { ...result, log_id: logId };
  } catch (error) {
    if (logId) {
      try {
        await WebhookLog.updateStatus(logId, { status: 'failed', error_message: error.message });
      } catch (logError) {
        log.error('Failed to mark webhook audit log as failed', { error: logError, log_id: logId });
      }
    }

    log.error('Blog ingest failed', { log_id: logId, error, external_id: meta.external_id });
    throw error;
  }
}

module.exports = {
  ingestScalnexBlog,
  handleScalnexWebhook,
};
