/**
 * Correct Misplaced Property S3 Paths Script
 * 
 * Scans S3 for misplaced keys like:
 *   property/10/10/10_11_file1.webp
 *   property/10/10/10_11_file1.jpg
 * 
 * Corrects them by moving/copying them to:
 *   property/10/10_11_file1.webp
 * 
 * If a misplaced file is not already WebP, it automatically:
 *   1. Downloads the original
 *   2. Converts/optimizes it to WebP (1280px max-width)
 *   3. Uploads it to the correct path as WebP
 *   4. Deletes the old misplaced non-WebP file from S3
 *   5. Updates the database reference to the new WebP filename
 * 
 * If it is already WebP, it:
 *   1. Copies it directly on S3 to the correct path
 *   2. Deletes the old misplaced WebP file from S3
 *   3. Ensures the database reference is correct
 * 
 * Usage:
 *   node scripts/correctPropertyPaths.js [options]
 * 
 * Options:
 *   --dry-run             Preview actions without executing S3 movements or database updates
 *   --limit <number>      Limit the number of records processed (for initial safety checks)
 *   --execute             Actually execute S3 key movements, WebP conversions, and database updates
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
const prefix = 'property/';

function printUsage() {
    console.log(`
Usage:
  node scripts/correctPropertyPaths.js [options]

Options:
  --dry-run      Analyze S3 and list misplaced keys without making S3/DB updates (default: active)
  --execute      Actually execute S3 key movements, WebP conversions, and database updates
  --limit <N>    Limit the number of files corrected (for initial safety tests)
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
    console.log('🚀 SCANNING S3 FOR MISPLACED PROPERTY PATHS');
    console.log('======================================================');
    console.log(`S3 Bucket:     ${bucket}`);
    console.log(`Prefix Filter: ${prefix}`);
    console.log(`Mode:          ${dryRun ? '🟢 DRY-RUN (No changes will be made)' : '🔴 EXECUTE (Real changes!)'}`);
    if (limit) console.log(`Limit:         ${limit} items`);
    console.log('======================================================\n');

    try {
        console.log('🔍 Listing all objects under prefix "property/" on S3...');
        let allMisplacedKeys = [];
        let continuationToken = null;
        let totalScanned = 0;

        do {
            const params = {
                Bucket: bucket,
                Prefix: prefix,
                MaxKeys: 1000,
                ContinuationToken: continuationToken || undefined
            };

            const data = await s3.listObjectsV2(params).promise();
            totalScanned += data.Contents.length;
            process.stdout.write(`   Scanned ${totalScanned} objects...\r`);

            data.Contents.forEach(obj => {
                const key = obj.Key;
                // Regex matches property/ID/ID/filename
                // e.g. property/10/10/10_11_file1.webp
                const match = key.match(/^property\/(\d+)\/\1\/(.+)$/);
                if (match) {
                    allMisplacedKeys.push({
                        misplacedKey: key,
                        propertyId: parseInt(match[1], 10),
                        filename: match[2]
                    });
                }
            });

            continuationToken = data.NextContinuationToken;
        } while (continuationToken);

        console.log(`\n\n📈 Scan complete!`);
        console.log(`Total S3 Objects Scanned: ${totalScanned}`);
        console.log(`Total Misplaced Keys Found: ${allMisplacedKeys.length}`);

        if (allMisplacedKeys.length === 0) {
            console.log('🎉 Excellent! No misplaced duplicate folders found.');
            process.exit(0);
        }

        const candidates = limit ? allMisplacedKeys.slice(0, limit) : allMisplacedKeys;
        console.log(`Processing list of ${candidates.length} item(s):\n`);

        if (dryRun) {
            candidates.forEach((item, idx) => {
                const isWebp = item.filename.toLowerCase().endsWith('.webp');
                const targetFilename = isWebp ? item.filename : ImageHelper.getWebpFilename(item.filename);
                const targetKey = `property/${item.propertyId}/${targetFilename}`;
                
                console.log(`[${idx + 1}/${candidates.length}] Property ${item.propertyId}:`);
                console.log(`    ↳ Misplaced:  ${item.misplacedKey}`);
                console.log(`    ↳ Target:     ${targetKey}`);
                console.log(`    ↳ Action:     ${isWebp ? '⚡ Move directly (S3 Copy)' : '⚙️  Download, convert to WebP, and Save'}`);
            });
            console.log(`\n🏁 Dry-run completed. To execute these changes, run with:`);
            console.log(`   node scripts/correctPropertyPaths.js --execute`);
            process.exit(0);
        }

        // Real Execution Mode
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < candidates.length; i++) {
            const item = candidates[i];
            const isWebp = item.filename.toLowerCase().endsWith('.webp');
            const targetFilename = isWebp ? item.filename : ImageHelper.getWebpFilename(item.filename);
            const targetKey = `property/${item.propertyId}/${targetFilename}`;

            console.log(`\n[${i + 1}/${candidates.length}] Processing Property ${item.propertyId}...`);

            try {
                if (isWebp) {
                    // 1. Copy S3 object directly (WebP to WebP)
                    console.log(`   ⚡ Copying S3 object directly: ${item.misplacedKey} -> ${targetKey}`);
                    await s3.copyObject({
                        Bucket: bucket,
                        CopySource: `${bucket}/${item.misplacedKey}`,
                        Key: targetKey,
                        ContentType: 'image/webp',
                        MetadataDirective: 'REPLACE'
                    }).promise();

                    // 2. Delete original misplaced key
                    console.log(`   🗑️  Deleting misplaced S3 original: ${item.misplacedKey}`);
                    await s3.deleteObject({ Bucket: bucket, Key: item.misplacedKey }).promise();

                    // 3. Ensure database matches
                    console.log(`   💾 Synchronizing database reference...`);
                    // We look for both the original name (in case it wasn't updated) or target name
                    await pool.query(
                        'UPDATE property_media SET media_filename = ? WHERE property_id = ? AND (media_filename = ? OR media_filename = ?)',
                        [targetFilename, item.propertyId, item.filename, targetFilename]
                    );

                } else {
                    // 1. Download original non-WebP
                    console.log(`   📥 Downloading misplaced original: ${item.misplacedKey}`);
                    const originalObject = await s3.getObject({ Bucket: bucket, Key: item.misplacedKey }).promise();

                    // 2. Compress and convert to WebP
                    console.log(`   ⚙️  Converting to optimized WebP (width: 1280px)...`);
                    const optimizedBuffer = await ImageHelper.optimizeToWebp(originalObject.Body, { width: 1280 });

                    // 3. Upload WebP to correct S3 path
                    console.log(`   📤 Uploading optimized WebP: ${targetKey}`);
                    await s3.putObject({
                        Bucket: bucket,
                        Key: targetKey,
                        Body: optimizedBuffer,
                        ContentType: 'image/webp',
                        CacheControl: 'public, max-age=31536000, immutable'
                    }).promise();

                    // 4. Delete old misplaced key
                    console.log(`   🗑️  Deleting misplaced old key: ${item.misplacedKey}`);
                    await s3.deleteObject({ Bucket: bucket, Key: item.misplacedKey }).promise();

                    // 5. Update database filename reference
                    console.log(`   💾 Updating database reference to WebP: ${targetFilename}`);
                    await pool.query(
                        'UPDATE property_media SET media_filename = ? WHERE property_id = ? AND (media_filename = ? OR media_filename = ?)',
                        [targetFilename, item.propertyId, item.filename, targetFilename]
                    );
                }

                console.log(`   ✅ Corrected successfully!`);
                successCount++;

            } catch (err) {
                console.error(`   ❌ Error correcting this item: ${err.message}`);
                failCount++;
            }
        }

        console.log('\n======================================================');
        console.log('🏁 CORRECTION COMPLETED');
        console.log('======================================================');
        console.log(`Total Processed:  ${candidates.length}`);
        console.log(`Successfully Done: ${successCount}`);
        console.log(`Failed Errors:    ${failCount}`);
        console.log('======================================================\n');

    } catch (error) {
        console.error('\n❌ Critical Error running script:', error.message);
        process.exit(1);
    }
}

main();
