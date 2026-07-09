const db = require('./config/dbConnection');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    try {
        console.log('Reading migration file...');
        const sql = fs.readFileSync(path.join(__dirname, 'migrations/add_esign_columns.sql'), 'utf8');
        
        console.log('Running migration...');
        await db.query(sql);
        
        console.log('Migration successful: eSign columns added.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
