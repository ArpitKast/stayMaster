/**
 * runallmigrations.js
 *
 * Runs all pending SQL migration files from the ./migrations folder.
 *
 * Usage:
 *   node runallmigrations.js
 *
 * Behaviour:
 *   1. Creates a `migrations_log` table if it doesn't exist.
 *   2. Reads all *.sql files from ./migrations, sorted alphabetically.
 *   3. Skips files already recorded in `migrations_log`.
 *   4. Splits each file into individual statements (on ';') and executes them.
 *   5. Records each successfully applied migration in `migrations_log`.
 *
 * Note: mysql2/promise pool does not support multipleStatements by default,
 * so each statement is executed individually after splitting on ';'.
 */

require('dotenv').config();
const db = require('./config/dbConnection');
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function ensureMigrationsLog() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS migrations_log (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            filename    VARCHAR(255) NOT NULL UNIQUE,
            applied_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

async function getAppliedMigrations() {
    const [rows] = await db.query('SELECT filename FROM migrations_log');
    return new Set(rows.map(r => r.filename));
}

async function runMigrationFile(filePath, filename) {
    const raw = fs.readFileSync(filePath, 'utf8');

    // Split on semicolons, strip comments, skip empty statements
    const statements = raw
        .split(';')
        .map(s => s.replace(/--[^\n]*/g, '').trim())  // remove single-line comments
        .filter(s => s.length > 0);

    for (const sql of statements) {
        await db.query(sql);
    }

    await db.query(
        'INSERT INTO migrations_log (filename) VALUES (?)',
        [filename]
    );
}

async function runAllMigrations() {
    try {
        await ensureMigrationsLog();

        const applied = await getAppliedMigrations();

        const files = fs
            .readdirSync(MIGRATIONS_DIR)
            .filter(f => f.endsWith('.sql'))
            .sort(); // alphabetical order ensures consistent sequence

        if (files.length === 0) {
            console.log('No migration files found.');
            process.exit(0);
        }

        let ran = 0;
        let skipped = 0;

        for (const filename of files) {
            if (applied.has(filename)) {
                console.log(`  [SKIP]  ${filename}`);
                skipped++;
                continue;
            }

            try {
                const filePath = path.join(MIGRATIONS_DIR, filename);
                await runMigrationFile(filePath, filename);
                console.log(`  [OK]    ${filename}`);
                ran++;
            } catch (err) {
                console.error(`  [FAIL]  ${filename}`);
                console.error(`          ${err.message}`);
                process.exit(1);
            }
        }

        console.log(`\nDone. Applied: ${ran}, Skipped (already run): ${skipped}`);
        process.exit(0);

    } catch (err) {
        console.error('Migration runner error:', err.message);
        process.exit(1);
    }
}

runAllMigrations();
