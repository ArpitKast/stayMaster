const pool = require('../config/dbConnection');

async function checkDetailedCollation() {
    try {
        const [dbRows] = await pool.query("SELECT @@character_set_database, @@collation_database, @@character_set_server, @@collation_server;");
        console.log("Database/Server Defaults:", JSON.stringify(dbRows, null, 2));

        const [sessionRows] = await pool.query("SELECT @@character_set_connection, @@collation_connection;");
        console.log("Session/Connection:", JSON.stringify(sessionRows, null, 2));

        const [colRows] = await pool.query(`
            SELECT TABLE_NAME, COLUMN_NAME, COLLATION_NAME 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME IN ('blogs', 'blog_categories', 'blog_tags')
            AND COLLATION_NAME IS NOT NULL;
        `);
        console.log("Table Columns:", JSON.stringify(colRows, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkDetailedCollation();
