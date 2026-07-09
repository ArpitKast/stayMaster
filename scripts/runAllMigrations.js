/**
 * Run All Migrations Script
 * 
 * This script runs all database migrations in the correct order
 * 
 * Usage: node scripts/runAllMigrations.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const dotenv = require('dotenv');

// Prefer developer overrides when running migrations
const envOverride = process.env.SCRIPTS_ENV_FILE;
const envCandidates = [
    envOverride,
    path.join(__dirname, '../.env.local'),
    path.join(__dirname, '../.env'),
    path.join(__dirname, '../.env.live')
].filter(Boolean);

const PLACEHOLDER_HOSTS = new Set(['looking', '<YOUR_DB_HOST>']);

let loadedEnvPath = null;
for (const candidate of envCandidates) {
    if (!fs.existsSync(candidate)) {
        continue;
    }
    const result = dotenv.config({ path: candidate });
    if (!result.error) {
        loadedEnvPath = candidate;
        break;
    }
}

if (!loadedEnvPath) {
    dotenv.config();
    console.warn('No explicit env file found for migrations; falling back to default environment variables.');
} else {
    console.log(`Loaded environment variables from ${path.relative(process.cwd(), loadedEnvPath)}`);
}

function resolveDbHost() {
    if (process.env.MIGRATIONS_DB_HOST) {
        console.log(`Using MIGRATIONS_DB_HOST override: ${process.env.MIGRATIONS_DB_HOST}`);
        return process.env.MIGRATIONS_DB_HOST;
    }

    if (process.env.DB_HOST_OVERRIDE) {
        console.log(`Using DB_HOST_OVERRIDE: ${process.env.DB_HOST_OVERRIDE}`);
        return process.env.DB_HOST_OVERRIDE;
    }

    let host = process.env.DB_HOST;
    if (!host || PLACEHOLDER_HOSTS.has(host)) {
        console.warn('DB_HOST is not set to a resolvable host. Falling back to localhost.');
        console.warn('ℹ️  Set MIGRATIONS_DB_HOST or DB_HOST_OVERRIDE to point to your MySQL instance.');
        host = '127.0.0.1';
    }
    return host;
}

// Define migrations in order
const migrations = [
    {
        name: 'add_guest_details_table',
        file: 'add_guest_details_table.sql',
        table: 'guest_details',
        description: 'Create guest_details table for user profile'
    },
    {
        name: 'add_guest_details',
        file: 'add_guest_details.sql',
        table: 'booking_guests',
        description: 'Add guest details fields to booking_guests table'
    },
    {
        name: 'add_leads_table',
        file: 'add_leads_table.sql',
        table: 'leads',
        description: 'Create leads table for lead management'
    },
    {
        name: 'add_leads_additional_columns',
        file: 'add_leads_additional_columns.sql',
        table: 'leads',
        description: 'Add additional columns to leads table (check_in, check_out, guests, rooms, preferred_property, lead_source)'
    },
    {
        name: 'add_notifications_tables',
        file: 'add_notifications_tables.sql',
        table: 'notifications',
        description: 'Create notifications tables'
    },
    {
        name: 'create_banners_table',
        file: 'create_banners_table.sql',
        table: 'banners',
        description: 'Create banners table for homepage banners'
    },
    {
        name: 'create_ezee_limechat_webhook_log',
        file: 'create_ezee_limechat_webhook_log.sql',
        table: 'ezee_limechat_webhook_log',
        description: 'Create ezee_limechat_webhook_log table'
    },
    {
        name: 'create_live_bookings_table',
        file: 'create_live_bookings_table.sql',
        table: 'live_bookings',
        description: 'Create live_bookings table for synced booking data'
    },
    {
        name: 'update_users_phone_collation',
        file: 'update_users_phone_collation.sql',
        table: 'users',
        description: 'Align users table character set/collation with live_bookings'
    },
    {
        name: 'update_properties_channel_collation',
        file: 'update_properties_channel_collation.sql',
        table: 'properties',
        description: 'Ensure properties.channel_id matches live_bookings.RoomShortCode collation'
    },
    {
        name: 'add_properties_checkin_columns',
        file: 'add_properties_checkin_columns.sql',
        table: 'properties',
        description: 'Add google rating, reviews, and property manager contact columns to properties table'
    },
    {
        name: 'add_properties_is_for_events',
        file: 'add_properties_is_for_events.sql',
        table: 'properties',
        description: 'Add for_events and for_corporate_offsite flag columns to properties table for manage-property flows'
    },
    {
        name: 'add_booking_checkin_columns',
        file: 'add_booking_checkin_columns.sql',
        table: 'bookings',
        description: 'Add check-in related columns to bookings table (declaration, esign, questionnaire)'
    },
    {
        name: 'cleanup_guest_details_columns',
        file: 'cleanup_guest_details_columns.sql',
        table: 'guest_details',
        description: 'Remove redundant check-in columns from guest_details table'
    },
    {
        name: 'add_booking_feedback_coupon_columns',
        file: 'add_booking_feedback_coupon_columns.sql',
        table: 'bookings',
        description: 'Add feedback coupon columns to bookings table'
    },
    {
        name: 'add_coupon_expiry_column',
        file: 'add_coupon_expiry_column.sql',
        table: 'bookings',
        description: 'Add feedback coupon expiry column to bookings table'
    },
    {
        name: 'add_booking_security_deposit_columns',
        file: 'add_booking_security_deposit_columns.sql',
        table: 'bookings',
        description: 'Add security deposit and eSign columns to bookings table'
    },
    {
        name: 'add_enhanced_checkin_columns',
        file: 'add_enhanced_checkin_columns.sql',
        table: 'bookings',
        description: 'Add enhanced check-in and GST columns to bookings and guest_details'
    },
    {
        name: 'add_booking_id_to_guest_details',
        file: 'add_booking_id_to_guest_details.sql',
        table: 'guest_details',
        description: 'Add booking_id to guest_details table and make user_id nullable'
    },
    {
        name: 'add_booking_guest_id_to_guest_details',
        file: 'add_booking_guest_id_to_guest_details.sql',
        table: 'guest_details',
        description: 'Add booking_guest_id to guest_details table to uniquely identify guests'
    },
    {
        name: 'add_has_id_document_to_guest_details',
        file: 'add_has_id_document_to_guest_details.sql',
        table: 'guest_details',
        description: 'Add has_id_document column to guest_details table'
    },
    {
        name: 'add_document_status_to_guest_details',
        file: 'add_document_status_to_guest_details.sql',
        table: 'guest_details',
        description: 'Add id_proof_type, id_proof_number, document_status, document_rejection_reason to guest_details'
    },
    {
        name: 'add_booking_cancellation_columns',
        file: 'add_booking_cancellation_columns.sql',
        table: 'bookings',
        description: 'Add cancellation_requested, cancellation_reason, and cancellation_requested_at to bookings table'
    },
    {
        name: 'add_guest_concierge_requests_table',
        file: 'add_guest_concierge_requests_table.sql',
        table: 'guest_concierge_requests',
        description: 'Create guest_concierge_requests table for storing guest requests'
    },
    {
        name: 'refactor_guest_details_for_booking',
        file: 'refactor_guest_details_for_booking.sql',
        table: 'guest_details',
        description: 'Cleanup obsolete booking_guest_id from guest_details'
    },
    {
        name: 'add_booking_booker_details',
        file: 'add_booking_booker_details.sql',
        table: 'bookings',
        description: 'Add booker_name and booker_phone to bookings table'
    },
    {
        name: 'add_bookings_portal_user_id',
        file: 'add_bookings_portal_user_id.sql',
        table: 'bookings',
        description: 'Add user_id (portal account after OTP/payment) and idx_bookings_user_id on bookings'
    },
    {
        name: 'add_manager_role',
        file: 'add_manager_role.sql',
        table: 'properties',
        description: 'Add property_manager_user_id column and manager role (271) to settings'
    },
    {
        name: 'add_token_invalid_after_to_users',
        file: 'add_token_invalid_after_to_users.sql',
        table: 'users',
        description: 'Add token_invalid_after column to users table for server-side JWT invalidation on logout'
    },
    {
        name: 'create_stay_feedbacks_table',
        file: 'create_stay_feedbacks_table.sql',
        table: 'stay_feedbacks',
        description: 'Create stay_feedbacks table for storing detailed guest feedback'
    },
    {
        name: 'add_esign_response_columns',
        file: 'add_esign_response_columns.sql',
        table: 'bookings',
        description: 'Add esign_init_response and esign_webhook_response JSON columns to bookings table'
    },
    {
        name: 'create_google_reviews_table',
        file: 'create_google_reviews_table.sql',
        table: 'google_reviews',
        description: 'Create google_reviews table for storing Google reviews'
    },
    {
        name: 'create_blog_categories_tags_tables',
        file: 'create_blog_categories_tags_tables.sql',
        table: 'blog_categories_tags',
        description: 'Create blog categories & Tags table'

    },
    {
        name: 'fix_blog_collations',
        file: 'fix_blog_collations.sql',
        description: 'Standardize blog tables collation to utf8mb4_unicode_ci'
    },
    {
        name: 'fix_blog_short_desc',
        file: 'add_blogs_listing_excerpt.sql',
        description: 'Add 3 lines short desc to blog list'
    },
    {
        name: 'add_database_performance_indexes',
        file: 'add_database_performance_indexes.sql',
        description: 'Apply database indexing optimizations for Admin Panel, Website, and sync jobs performance'
    },
    {
        name: 'add_scalnex_blog_webhook',
        file: 'add_scalnex_blog_webhook.sql',
        table: 'scalnex_webhook_log',
        description: 'Scalnex blog webhook external ids and audit log'
    }
];

async function checkTableExists(connection, tableName) {
    const [rows] = await connection.query('SHOW TABLES LIKE ?', [tableName]);
    return rows.length > 0;
}

async function logDatabaseTables(connection) {
    try {
        const [tables] = await connection.query('SHOW TABLES');
        if (!tables.length) {
            console.log('Tables in database: (none found)');
            return;
        }

        console.log('Tables in database:');
        tables.forEach(table => {
            const tableName = Object.values(table)[0];
            console.log(`- ${tableName}`);
        });
        console.log('');
    } catch (error) {
        console.error(`⚠️  Unable to list tables: ${error.message}`);
    }
}

/**
 * Normalizes SQL statements for cross-version compatibility
 */
function normalizeSql(sql) {
    let normalized = sql;

    // 1. Remove "DEFAULT ''" from TEXT/BLOB/JSON columns (MySQL 8.0+ restriction)
    normalized = normalized.replace(/(TEXT|LONGTEXT|BLOB|JSON)(\s+DEFAULT\s+['"]{2})/gi, '$1');

    // 2. Convert "CREATE INDEX IF NOT EXISTS" to standard CREATE INDEX (MySQL < 8.0)
    // We handle the "IF NOT EXISTS" logic in the runner instead
    normalized = normalized.replace(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS/gi, 'CREATE INDEX');

    return normalized;
}

async function runMigration(connection, migration) {
    const sqlFilePath = path.join(__dirname, '../migrations', migration.file);

    try {
        // Check if SQL file exists
        await fsp.access(sqlFilePath);

        // Read SQL file
        const sqlRaw = await fsp.readFile(sqlFilePath, 'utf8');
        const sql = normalizeSql(sqlRaw);

        // Remove comment lines to avoid filtering out whole statements
        const cleanSql = sql.replace(/^--.*$/gm, '').trim();

        // Split SQL by semicolon for execution (MySQL 8.4 compatibility)
        const sqlStatements = cleanSql
            .split(/;(?=(?:[^'"`]*['"`][^'"`]*['"`])*[^'"`]*$)/)
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('/*!'));

        // Check if table already exists (for CREATE TABLE migrations)
        if (migration.table && sql.toLowerCase().includes('create table')) {
            const exists = await checkTableExists(connection, migration.table);
            if (exists) {
                console.log(`   ⚠️  Table "${migration.table}" already exists - skipping`);
                return { success: true, skipped: true };
            }
        }

        // Execute SQL statements one by one
        for (const statement of sqlStatements) {
            try {
                await connection.query(statement);
            } catch (err) {
                // Ignore duplicate column/key errors, and missing column drop errors
                if (err.code === 'ER_DUP_FIELDNAME' || err.code === 'ER_DUP_KEYNAME' || err.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
                    console.log(`   ⚠️  ${migration.name}: Skipping duplicate/missing column/index error`);
                    continue;
                }
                throw err;
            }
        }

        console.log(`   ✅ ${migration.description} - Completed`);
        return { success: true, skipped: false };

    } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME' || error.code === 'ER_DUP_KEYNAME' || error.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
            console.log(`   ⚠️  ${migration.description} - Already applied (duplicate/missing field/key)`);
            return { success: true, skipped: true };
        }
        throw error;
    }
}

async function runAllMigrations() {
    let connection;

    try {
        console.log('\n=== Running All Database Migrations ===\n');

        // Check if environment variables are set
        if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_NAME) {
            console.error('❌ Error: Database environment variables not set!');
            console.error('Please ensure DB_HOST, DB_USER, DB_PASSWORD, and DB_NAME are set in .env file');
            process.exit(1);
        }

        console.log(`Connecting to database: ${process.env.DB_NAME}@${process.env.DB_HOST}...`);

        // Create connection
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            multipleStatements: true
        });

        console.log('✅ Connected to database\n');
        //print db info
        console.log(`Database: ${process.env.DB_NAME}`);
        console.log(`Host: ${process.env.DB_HOST}`);
        console.log(`User: ${process.env.DB_USER}`);
        console.log(`Running ${migrations.length} migrations...\n`);

        let successCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        // Run each migration
        for (let i = 0; i < migrations.length; i++) {
            const migration = migrations[i];
            console.log(`[${i + 1}/${migrations.length}] ${migration.name}:`);

            try {
                const result = await runMigration(connection, migration);
                console.log(result);
                if (result.success) {
                    if (result.skipped) {
                        skippedCount++;
                    } else {
                        successCount++;
                    }
                }
            } catch (error) {
                errorCount++;
                console.error(`   ❌ Error: ${error.message}`);
                // Continue with next migration instead of stopping
            }
            console.log('');
        }

        // Summary
        console.log('=== Migration Summary ===');
        console.log(`✅ Successfully applied: ${successCount}`);
        console.log(`⚠️  Skipped (already exists): ${skippedCount}`);
        console.log(`❌ Errors: ${errorCount}`);
        console.log(`📊 Total: ${migrations.length}\n`);

        if (errorCount === 0) {
            console.log('✅ All migrations completed successfully!\n');
        } else {
            console.log('⚠️  Some migrations had errors. Please review the output above.\n');
        }

        await logDatabaseTables(connection);
        await connection.end();
        process.exit(errorCount > 0 ? 1 : 0);

    } catch (error) {
        console.error('\n❌ Migration failed!');
        console.error('Error:', error.message);

        if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('\n💡 Tip: Check your database credentials in .env file');
        } else if (error.code === 'ER_BAD_DB_ERROR') {
            console.error('\n💡 Tip: Database does not exist. Please create it first.');
        } else if (error.code === 'ECONNREFUSED') {
            console.error('\n💡 Tip: Cannot connect to database. Check DB_HOST and ensure MySQL is running.');
        }

        if (connection) {
            await connection.end();
        }
    }
}

async function run() {
    await runAllMigrations();
}
run();
