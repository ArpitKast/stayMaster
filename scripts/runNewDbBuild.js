const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
const dotenv = require('dotenv');

// Standardized environment variable loading
const envCandidates = [
    path.join(__dirname, '../.env.local'),
    path.join(__dirname, '../.env'),
    path.join(__dirname, '../.env.live')
].filter(require('fs').existsSync);

if (envCandidates.length > 0) {
    dotenv.config({ path: envCandidates[0] });
    console.log(`Loaded environment variables from ${path.relative(process.cwd(), envCandidates[0])}`);
} else {
    dotenv.config();
    console.warn('No explicit env file found; falling back to default environment variables.');
}

async function run() {
  let connection;
  try {
    if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_NAME) {
      console.error('Database environment variables not set (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME)');
      process.exit(1);
    }

    const connectionOptions = {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      multipleStatements: true
    };

    if (process.env.DB_PORT) {
      connectionOptions.port = process.env.DB_PORT;
    }

    console.log(`Connecting to MySQL host: ${connectionOptions.host}:${connectionOptions.port || 3306}...`);
    connection = await mysql.createConnection(connectionOptions);

    console.log(`Ensuring database "${process.env.DB_NAME}" exists...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``);
    await connection.query(`USE \`${process.env.DB_NAME}\``);

    // Drop all tables in the database to ensure a clean build
    console.log(`Cleaning database "${process.env.DB_NAME}"...`);
    const [tables] = await connection.query('SHOW TABLES');
    if (tables.length > 0) {
      const tableNames = tables.map(t => Object.values(t)[0]);
      await connection.query('SET FOREIGN_KEY_CHECKS = 0');
      for (const tableName of tableNames) {
        await connection.query(`DROP TABLE IF EXISTS \`${tableName}\``);
      }
      await connection.query('SET FOREIGN_KEY_CHECKS = 1');
      console.log(`Dropped ${tableNames.length} existing tables.`);
    }

    // Try structure.sql if it exists, otherwise fallback to staymaster.sql
    let sqlPath = path.join(__dirname, '../../structure.sql');
    if (!require('fs').existsSync(sqlPath)) {
        sqlPath = path.join(__dirname, '../../staymaster.sql');
    }
    
    console.log(`Reading SQL from: ${sqlPath}...`);
    const sql = await fs.readFile(sqlPath, 'utf8');

    console.log(`Executing SQL script to build database "${process.env.DB_NAME}"...`);
    
    const cleanedSql = sql
        .split('\n')
        .map(line => {
          let cleaned = line;
          
          const trimmed = cleaned.trim();
          const isProblematicSet = 
            trimmed.startsWith('/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;') || 
            trimmed.startsWith('/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;') ||
            trimmed.startsWith('/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;') ||
            trimmed.startsWith('/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;') ||
            trimmed.startsWith('/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;') ||
            trimmed.startsWith('/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;') ||
            trimmed.match(/SET\s+@?[a-zA-Z_]+\s*=\s*NULL\s*;/i);
          
          if (isProblematicSet) return '';

          cleaned = cleaned.replace(/\bTYPE=InnoDB\b/gi, 'ENGINE=InnoDB');
          cleaned = cleaned.replace(/\bCHARSET=utf8\b/gi, 'CHARSET=utf8mb4');
          cleaned = cleaned.replace(/\bCOLLATE=utf8_general_ci\b/gi, 'COLLATE=utf8mb4_general_ci');
          cleaned = cleaned.replace(/\bCOLLATE=utf8_unicode_ci\b/gi, 'COLLATE=utf8mb4_unicode_ci');
          cleaned = cleaned.replace(/(TEXT|LONGTEXT|BLOB|JSON)(\s+DEFAULT\s+['"]{2})/gi, '$1');
          cleaned = cleaned.replace(/['"]0000-00-00(\s+00:00:00)?['"]/g, 'NULL');

          return cleaned;
        })
        .join('\n');

    await connection.query(cleanedSql);
    
    console.log('✅ Database build completed successfully!');

    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error('Database build failed:', error);
    if (connection) {
      await connection.end();
    }
    process.exit(1);
  }
}

run();
