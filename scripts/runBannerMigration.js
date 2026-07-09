/**
 * Migration Script for Banners Table
 * 
 * This script runs the SQL migration to create the banners table
 * 
 * Usage: node scripts/runBannerMigration.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function runMigration() {
    let connection;
    
    try {
        console.log('\n=== Running Banners Migration ===\n');
        
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
            "SHOW TABLES LIKE 'banners'"
        );

        if (tables.length > 0) {
            console.log('⚠️  Table "banners" already exists!');
            console.log('Skipping migration. If you want to recreate, manually drop the table first.');
            console.log('To drop: DROP TABLE IF EXISTS banners;');
            await connection.end();
            process.exit(0);
        }

        // Read SQL file
        const sqlFilePath = path.join(__dirname, '../migrations/create_banners_table.sql');
        console.log(`Reading SQL file: ${sqlFilePath}...`);
        const sql = await fs.readFile(sqlFilePath, 'utf8');

        // Execute SQL
        console.log('Executing migration SQL...\n');
        await connection.query(sql);

        console.log('✅ Migration completed successfully!');
        console.log('✅ Table "banners" created with all required fields');
        console.log('\n=== Migration Summary ===');
        console.log('Table: banners');
        console.log('Status: Created');
        console.log('Next steps:');
        console.log('  1. Start your server: npm start');
        console.log('  2. Use POST /api/banners to upload banners');
        console.log('  3. Use GET /api/banners to retrieve banners\n');

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
