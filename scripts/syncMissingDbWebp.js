/**
 * Synchronize Database with S3 WebP Files (DB Repair Script)
 * 
 * Fetches all database records in property_media pointing to non-webp filenames (.jpg, .png, etc.).
 * For each record:
 *   1. Checks if the optimized .webp version already exists at the correct S3 path: property/ID/filename.webp
 *   2. If it does exist, it simply updates the database record to point to the .webp filename.
 *   3. If it does NOT exist but the original non-webp file exists at the correct S3 path:
 *      - It downloads the original, converts/compresses it to optimized WebP, uploads it to S3, and updates the database.
 * 
 * Usage:
 *   node scripts/syncMissingDbWebp.js [options]
 * 
 * Options:
 *   --dry-run      Analyze and print what would be updated without executing database/S3 changes (default)
 *   --execute      Execute the updates and WebP conversions
 *   --limit <N>    Limit the number of records processed
 */

const AWS = require('aws-sdk');
const ImageHelper = require('../helpers/imageHelper');
const pool = require('../config/dbConnection');
require('dotenv').config();

// Ensure S3 configuration
if (process.env.MODE === 'dev' || !process.env.MODE) {
    AWS.config.update({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION,
    });
} else {
    AWS.config.update({ region: process.env.AWS_REGION });
}
const s3 = new AWS.S3();

const bucket = 'staymaster';

function printUsage() {
    console.log(`
Usage:
  node scripts/syncMissingDbWebp.js [options]

Options:
  --dry-run      Print what would be updated without making S3/DB changes (default: active)
  --execute      Actually execute S3 uploads and database updates
  --limit <N>    Limit the number of records processed
  --help, -h     Print this help message
`);
}

async function main() {
    const args = process.argv.slice(2);

    if (args.includes('--help') || args.includes('-h')) {
        printUsage();
        process.exit(0);
    }

    const execute = args.includes('--execute');
    const dryRun = !execute || args.includes('--dry-run');

    let limit = null;
    const limitIndex = args.indexOf('--limit');
    if (limitIndex !== -1 && args[limitIndex + 1]) {
        limit = parseInt(args[limitIndex + 1], 10);
        if (isNaN(limit)) {
            console.error('❌ Error: --limit must be followed by a valid number');
            process.exit(1);
        }
    }

    console.log('\n======================================================');
    console.log('🚀 REPAIRING DATABASE REFERENCES FOR WEBP PHOTOS');
    console.log('======================================================');
    console.log(`S3 Bucket: staymaster`);
    console.log(`Mode:      ${dryRun ? '🟢 DRY-RUN (No changes will be made)' : '🔴 EXECUTE (Real database/S3 updates!)'}`);
    if (limit) console.log(`Limit:     ${limit} records`);
    console.log('======================================================\n');

    try {
        console.log('Connecting to database and fetching non-WebP candidates...');
        let query = `
            SELECT pm.id, pm.property_id, pm.media_filename, pm.media_type_id, s.display as category_name
            FROM property_media pm
            JOIN settings s ON pm.media_type_id = s.id
            WHERE s.setting = 'media_type' 
              AND (s.value = 'display_image' OR s.category = 'photos')
              AND pm.media_filename NOT LIKE '%.webp'
            ORDER BY pm.property_id ASC, pm.id ASC
        `;
        const params = [];
        if (limit) {
            query += ` LIMIT ?`;
            params.push(limit);
        }

        const [rows] = await pool.query(query, params);
        console.log(`📈 Found ${rows.length} candidate record(s) still pointing to old formats in the database.\n`);

        if (rows.length === 0) {
            console.log('🎉 Excellent! Database is 100% in sync and all records are already WebP.');
            process.exit(0);
        }

        let updatedCount = 0;
        let convertedCount = 0;
        let missingCount = 0;
        let failCount = 0;

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const originalFilename = row.media_filename;
            const webpFilename = ImageHelper.getWebpFilename(originalFilename);
            
            const correctWebpKey = `property/${row.property_id}/${webpFilename}`;
            const correctOriginalKey = `property/${row.property_id}/${originalFilename}`;

            console.log(`[${i + 1}/${rows.length}] Checking Record ID: ${row.id} (Property: ${row.property_id}) - "${originalFilename}"...`);

            try {
                // 1. Check if the optimized .webp already exists on S3 under the correct key
                let webpExists = false;
                try {
                    await s3.headObject({ Bucket: bucket, Key: correctWebpKey }).promise();
                    webpExists = true;
                } catch (headErr) {
                    if (headErr.code !== 'NotFound') {
                        throw headErr;
                    }
                }

                if (webpExists) {
                    // Scenario A: WebP already exists on S3 (likely moved/saved earlier)! Simply update the DB reference.
                    console.log(`   ✨ WebP already exists on S3: ${correctWebpKey}`);
                    if (dryRun) {
                        console.log(`   [DRY-RUN] Would update database: "${originalFilename}" ➔ "${webpFilename}"`);
                    } else {
                        await pool.query('UPDATE property_media SET media_filename = ? WHERE id = ?', [webpFilename, row.id]);
                        console.log(`   💾 Database reference updated successfully!`);
                    }
                    updatedCount++;
                } else {
                    // Scenario B: WebP does not exist. Check if original non-WebP exists at the correct S3 path.
                    let originalExists = false;
                    try {
                        await s3.headObject({ Bucket: bucket, Key: correctOriginalKey }).promise();
                        originalExists = true;
                    } catch (headErr) {
                        if (headErr.code !== 'NotFound') {
                            throw headErr;
                        }
                    }

                    if (originalExists) {
                        // Original exists on S3! Download it, convert to WebP, upload, and update DB.
                        console.log(`   ⚙️  WebP missing but Original exists at: ${correctOriginalKey}. Preparing conversion...`);
                        if (dryRun) {
                            console.log(`   [DRY-RUN] Would download original, convert to WebP, upload to S3, and update database.`);
                        } else {
                            console.log(`   📥 Downloading from S3...`);
                            const originalObject = await s3.getObject({ Bucket: bucket, Key: correctOriginalKey }).promise();
                            
                            console.log(`   ⚡ Converting to optimized WebP (1280px)...`);
                            const optimizedBuffer = await ImageHelper.optimizeToWebp(originalObject.Body, { width: 1280 });
                            
                            console.log(`   📤 Uploading WebP to correct S3 key: ${correctWebpKey}`);
                            await s3.putObject({
                                Bucket: bucket,
                                Key: correctWebpKey,
                                Body: optimizedBuffer,
                                ContentType: 'image/webp',
                                CacheControl: 'public, max-age=31536000, immutable'
                            }).promise();

                            await pool.query('UPDATE property_media SET media_filename = ? WHERE id = ?', [webpFilename, row.id]);
                            console.log(`   💾 Database reference updated successfully!`);
                        }
                        convertedCount++;
                    } else {
                        // Scenario C: Neither WebP nor Original exists on S3 under correct keys. Look for misplaced duplicate key.
                        const misplacedWebpKey = `property/${row.property_id}/${row.property_id}/${webpFilename}`;
                        const misplacedOriginalKey = `property/${row.property_id}/${row.property_id}/${originalFilename}`;
                        
                        let misplacedWebpExists = false;
                        try {
                            await s3.headObject({ Bucket: bucket, Key: misplacedWebpKey }).promise();
                            misplacedWebpExists = true;
                        } catch (headErr) {
                            if (headErr.code !== 'NotFound') {
                                throw headErr;
                            }
                        }

                        if (misplacedWebpExists) {
                            console.log(`   ⚡ Misplaced WebP found at duplicate path: ${misplacedWebpKey}`);
                            if (dryRun) {
                                console.log(`   [DRY-RUN] Would move WebP to correct S3 path and update database.`);
                            } else {
                                console.log(`   ⚡ Copying S3 key: ${misplacedWebpKey} -> ${correctWebpKey}`);
                                await s3.copyObject({
                                    Bucket: bucket,
                                    CopySource: `${bucket}/${misplacedWebpKey}`,
                                    Key: correctWebpKey,
                                    ContentType: 'image/webp',
                                    MetadataDirective: 'REPLACE'
                                }).promise();
                                await s3.deleteObject({ Bucket: bucket, Key: misplacedWebpKey }).promise();
                                await pool.query('UPDATE property_media SET media_filename = ? WHERE id = ?', [webpFilename, row.id]);
                                console.log(`   💾 Database reference updated successfully!`);
                            }
                            updatedCount++;
                        } else {
                            let misplacedOriginalExists = false;
                            try {
                                await s3.headObject({ Bucket: bucket, Key: misplacedOriginalKey }).promise();
                                misplacedOriginalExists = true;
                            } catch (headErr) {
                                if (headErr.code !== 'NotFound') {
                                    throw headErr;
                                }
                            }

                            if (misplacedOriginalExists) {
                                console.log(`   ⚙️  Misplaced Original found at duplicate path: ${misplacedOriginalKey}`);
                                if (dryRun) {
                                    console.log(`   [DRY-RUN] Would download misplaced original, convert to WebP, upload to S3 correct path, delete misplaced S3 key, and update database.`);
                                } else {
                                    console.log(`   📥 Downloading from S3...`);
                                    const originalObject = await s3.getObject({ Bucket: bucket, Key: misplacedOriginalKey }).promise();
                                    const optimizedBuffer = await ImageHelper.optimizeToWebp(originalObject.Body, { width: 1280 });
                                    await s3.putObject({
                                        Bucket: bucket,
                                        Key: correctWebpKey,
                                        Body: optimizedBuffer,
                                        ContentType: 'image/webp',
                                        CacheControl: 'public, max-age=31536000, immutable'
                                    }).promise();
                                    await s3.deleteObject({ Bucket: bucket, Key: misplacedOriginalKey }).promise();
                                    await pool.query('UPDATE property_media SET media_filename = ? WHERE id = ?', [webpFilename, row.id]);
                                    console.log(`   💾 Database reference updated successfully!`);
                                }
                                convertedCount++;
                            } else {
                                console.warn(`   ⚠️ Warning: File not found on S3 under any correct or misplaced key. Skipping.`);
                                missingCount++;
                            }
                        }
                    }
                }
            } catch (itemErr) {
                console.error(`   ❌ Error processing record: ${itemErr.message}`);
                failCount++;
            }
        }

        console.log('\n======================================================');
        console.log('🏁 DATABASE SYNC COMPLETED');
        console.log('======================================================');
        console.log(`Total Candidates:    ${rows.length}`);
        console.log(`Sync\'d to S3 WebP:   ${updatedCount}`);
        console.log(`Newly Converted:     ${convertedCount}`);
        console.log(`Missing from S3:     ${missingCount}`);
        console.log(`Failed Errors:       ${failCount}`);
        console.log('======================================================\n');

    } catch (error) {
        console.error('\n❌ Script crashed due to a critical error:', error.message);
        process.exit(1);
    }
}

main();
