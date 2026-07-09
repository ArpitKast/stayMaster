/**
 * Migration Script for Live Bookings Table
 * 
 * This script runs the SQL migration to create the live_bookings table
 * 
 * Usage: node scripts/runMigration.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
const dotenv = require('dotenv');

const defaultEnv = path.join(__dirname, '../.env');
const fallbackLiveEnv = path.join(__dirname, '../.env.live');
const requestedEnv = process.env.SCRIPTS_ENV_FILE;

let envLoadedFrom = null;
if (requestedEnv) {
    const result = dotenv.config({ path: requestedEnv });
    if (!result.error) {
        envLoadedFrom = requestedEnv;
    }
}

if (!envLoadedFrom) {
    const primaryResult = dotenv.config({ path: defaultEnv });
    if (!primaryResult.error) {
        envLoadedFrom = defaultEnv;
    } else {
        const fallbackResult = dotenv.config({ path: fallbackLiveEnv });
        if (!fallbackResult.error) {
            envLoadedFrom = fallbackLiveEnv;
        }
    }
}

if (!envLoadedFrom) {
    console.warn('⚠️  Could not load .env file. Proceeding with process environment variables only.');
} else {
    console.log(`📄 Loaded environment variables from ${envLoadedFrom}`);
}

async function runMigration() {
    let connection;
    
    try {
        console.log('\n=== Running Live Bookings Migration ===\n');
        
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

        // Check if table already exists
        const [tables] = await connection.query(
            "SHOW TABLES LIKE 'live_bookings'"
        );

        if (tables.length > 0) {
            console.log('⚠️  Table "live_bookings" already exists!');
            console.log('Do you want to drop and recreate it? (This will delete all existing data)');
            console.log('For now, skipping migration. If you want to recreate, manually drop the table first.');
            console.log('To drop: DROP TABLE IF EXISTS live_bookings;');
            await connection.end();
            process.exit(0);
        }

        // Read SQL file
        const sqlFilePath = path.join(__dirname, '../migrations/create_live_bookings_table.sql');
        console.log(`Reading SQL file: ${sqlFilePath}...`);
        const sql = await fs.readFile(sqlFilePath, 'utf8');

        // Execute SQL
        console.log('Executing migration SQL...\n');
        await connection.query(sql);

        console.log('✅ Migration completed successfully!');
        console.log('✅ Table "live_bookings" created with all required fields');
        console.log('\n=== Migration Summary ===');
        console.log('Table: live_bookings');
        console.log('Status: Created');
        console.log('Next steps:');
        console.log('  1. Start your server: npm start');
        console.log('  2. The cron job will automatically sync data every 15 minutes');
        console.log('  3. Access admin panel: /admin/liveBookingInfo/\n');

        await connection.end();
        process.exit(0);

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
        process.exit(1);
    }
}

// Run migration
runMigration();

