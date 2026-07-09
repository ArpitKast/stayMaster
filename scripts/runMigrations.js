#!/usr/bin/env node
/**
 * Compatibility wrapper for developers who were used to
 * `node scripts/runMigrations.js`
 *
 * Internally we now run the comprehensive runner that
 * applies every migration in order.
 */
require('./runAllMigrations');
