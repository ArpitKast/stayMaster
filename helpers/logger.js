'use strict';

/**
 * Lightweight, dependency-free structured logger.
 *
 * - Writes newline-delimited JSON (one object per line) to dated files in `logs/`.
 *   - logs/app-YYYY-MM-DD.log   → all levels
 *   - logs/error-YYYY-MM-DD.log → errors only (quick triage)
 * - Mirrors a human-readable line to the console.
 * - Redacts sensitive keys and truncates very long strings so log files stay usable.
 *
 * Usage:
 *   const { createLogger } = require('../helpers/logger');
 *   const log = createLogger('scalnex-webhook');
 *   log.info('Webhook received', { ip, bytes });
 *   log.error('Ingest failed', { error, external_id });
 */

const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const MAX_STRING_LEN = 2000;
const SENSITIVE_KEYS = new Set([
  'password', 'token', 'otp', 'apikey', 'api_key', 'authcode', 'secret',
  'access_token', 'refresh_token', 'authorization', 'x-webhook-secret',
  'webhook-security-key', 'x-scalnex-secret',
]);

let dirReady = false;
function ensureDir() {
  if (dirReady) return;
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    dirReady = true;
  } catch (_) {
    // If the directory can't be created we still log to console below.
  }
}

/**
 * Deep-clone `value` for safe serialization: redacts sensitive keys, serializes
 * Error objects (message + stack), truncates long strings, and guards against
 * circular references.
 */
function sanitize(value, seen = new WeakSet()) {
  if (value == null) return value;

  if (value instanceof Error) {
    return { name: value.name, message: value.message, code: value.code, stack: value.stack };
  }

  if (typeof value === 'string') {
    return value.length > MAX_STRING_LEN
      ? `${value.slice(0, MAX_STRING_LEN)}…[truncated ${value.length - MAX_STRING_LEN} chars]`
      : value;
  }

  if (typeof value !== 'object') return value;

  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item, seen));
  }

  const out = {};
  for (const [key, val] of Object.entries(value)) {
    out[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : sanitize(val, seen);
  }
  return out;
}

function write(level, scope, message, meta) {
  const ts = new Date().toISOString();
  const safeMeta = meta === undefined ? undefined : sanitize(meta);
  const entry = { ts, level, scope, message };
  if (safeMeta !== undefined) entry.meta = safeMeta;

  // Console (human-readable)
  const consoleFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  const prefix = `[${ts}] [${level.toUpperCase()}] [${scope}] ${message}`;
  if (safeMeta !== undefined) {
    consoleFn(prefix, safeMeta);
  } else {
    consoleFn(prefix);
  }

  // File (JSON line)
  ensureDir();
  if (dirReady) {
    const date = ts.slice(0, 10);
    const line = JSON.stringify(entry) + '\n';
    try {
      fs.appendFileSync(path.join(LOG_DIR, `app-${date}.log`), line);
      if (level === 'error') {
        fs.appendFileSync(path.join(LOG_DIR, `error-${date}.log`), line);
      }
    } catch (_) {
      // Never let logging failures break the request path.
    }
  }
}

function createLogger(scope = 'app') {
  return {
    info: (message, meta) => write('info', scope, message, meta),
    warn: (message, meta) => write('warn', scope, message, meta),
    error: (message, meta) => write('error', scope, message, meta),
    child: (sub) => createLogger(`${scope}:${sub}`),
  };
}

module.exports = {
  createLogger,
  logger: createLogger('app'),
  LOG_DIR,
};
