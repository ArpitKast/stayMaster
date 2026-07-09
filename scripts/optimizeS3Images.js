/**
 * Generalized S3 Image Optimization Script
 * 
 * Compresses and converts existing images on S3 to WebP format, resizes them,
 * updates the database references, and optionally cleans up the original images.
 * Matches the exact compression/WebP standards used in the new upload flow.
 * 
 * Usage:
 *   node scripts/optimizeS3Images.js <target> [options]
 * 
 * Targets:
 *   properties      Process property display images and photos (resizes to 1280px max-width)
 *   banners         Process banner images (resizes to 1920px max-width)
 * 
 * Options:
 *   --dry-run             Analyze database and print actions without performing S3/DB updates
 *   --delete-originals    Delete the original image from S3 after successful migration to WebP
 *   --limit <number>      Limit the number of records processed (ideal for initial testing)
 *   --property-id <id>    Only process images for a specific property ID (only applies to 'properties' target)
 * 
 * Examples:
 *   node scripts/optimizeS3Images.js properties --dry-run
 *   node scripts/optimizeS3Images.js properties --limit 1 --delete-originals
 *   node scripts/optimizeS3Images.js banners --limit 5
 */

const mysql = require('mysql2/promise');
const AWS = require('aws-sdk');
const ImageHelper = require('../helpers/imageHelper');
require('dotenv').config();

const S3Helper = require('../helpers/s3Helper');
const pool = require('../config/dbConnection');

// Supported targets mapping
const TARGETS = {
    properties: {
        name: 'Properties',
        bucket: process.env.AWS_PROPERTY_BUCKET || 'staymaster/property',
        resizeWidth: 1280,
        getRecordsQuery: (limit, propertyId) => {
            let query = `
                SELECT pm.id, pm.property_id, pm.media_filename, pm.media_type_id, s.display as category_name
                FROM property_media pm
                JOIN settings s ON pm.media_type_id = s.id
                WHERE s.setting = 'media_type' 
                  AND (s.value = 'display_image' OR s.category = 'photos')
                  AND pm.media_filename NOT LIKE '%.webp'
            `;
            const params = [];
            if (propertyId) {
                query += ` AND pm.property_id = ?`;
                params.push(propertyId);
            }
            // Add deterministic ordering
            query += ` ORDER BY pm.property_id ASC, pm.id ASC`;
            if (limit) {
                query += ` LIMIT ?`;
                params.push(limit);
            }
            return { query, params };
        },
        getOriginalS3Key: (row) => `${row.property_id}/${row.media_filename}`,
        getNewFilename: (originalFilename) => ImageHelper.getWebpFilename(originalFilename),
        getNewS3Key: (row, newFilename) => `${row.property_id}/${newFilename}`,
        updateDbQuery: 'UPDATE property_media SET media_filename = ? WHERE id = ?',
        updateDbParams: (newFilename, row) => [newFilename, row.id],
        logRecordDetails: (row) => `Property ID: ${row.property_id} | Type: ${row.category_name} | Filename: ${row.media_filename}`
    },
    banners: {
        name: 'Banners',
        bucket: process.env.AWS_BUCKET || 'staymaster',
        resizeWidth: 1920,
        getRecordsQuery: (limit) => {
            let query = `
                SELECT id, title, image_url 
                FROM banners 
                WHERE image_url IS NOT NULL 
                  AND image_url NOT LIKE '%.webp'
                ORDER BY id ASC
            `;
            const params = [];
            if (limit) {
                query += ` LIMIT ?`;
                params.push(limit);
            }
            return { query, params };
        },
        getOriginalS3Key: (row) => row.image_url,
        getNewFilename: (originalFilename) => ImageHelper.getWebpFilename(originalFilename),
        getNewS3Key: (row, newFilename) => newFilename,
        updateDbQuery: 'UPDATE banners SET image_url = ? WHERE id = ?',
        updateDbParams: (newFilename, row) => [newFilename, row.id],
        logRecordDetails: (row) => `Banner ID: ${row.id} | Title: ${row.title || 'Untitled'} | S3 Key: ${row.image_url}`
    },
    blogs: {
        name: 'Blogs',
        bucket: process.env.AWS_BUCKET || 'staymaster',
        resizeWidth: 1280,
        getRecordsQuery: (limit) => {
            let query = `
                SELECT id, title, featured_image 
                FROM blogs 
                WHERE featured_image IS NOT NULL 
                  AND featured_image NOT LIKE '%.webp'
                ORDER BY id ASC
            `;
            const params = [];
            if (limit) {
                query += ` LIMIT ?`;
                params.push(limit);
            }
            return { query, params };
        },
        getOriginalS3Key: (row) => row.featured_image,
        getNewFilename: (originalFilename) => ImageHelper.getWebpFilename(originalFilename),
        getNewS3Key: (row, newFilename) => newFilename,
        updateDbQuery: 'UPDATE blogs SET featured_image = ? WHERE id = ?',
        updateDbParams: (newFilename, row) => [newFilename, row.id],
        logRecordDetails: (row) => `Blog ID: ${row.id} | Title: ${row.title} | S3 Key: ${row.featured_image}`
    },
    destinations: {
        name: 'Destinations',
        bucket: process.env.AWS_DESTINATION_BUCKET || 'staymaster/destination',
        resizeWidth: 1280,
        getRecordsQuery: (limit) => {
            let query = `
                SELECT id, name, photo 
                FROM destinations 
                WHERE photo IS NOT NULL 
                  AND photo NOT LIKE '%.webp'
                ORDER BY id ASC
            `;
            const params = [];
            if (limit) {
                query += ` LIMIT ?`;
                params.push(limit);
            }
            return { query, params };
        },
        getOriginalS3Key: (row) => row.photo,
        getNewFilename: (originalFilename) => ImageHelper.getWebpFilename(originalFilename),
        getNewS3Key: (row, newFilename) => newFilename,
        updateDbQuery: 'UPDATE destinations SET photo = ? WHERE id = ?',
        updateDbParams: (newFilename, row) => [newFilename, row.id],
        logRecordDetails: (row) => `Destination ID: ${row.id} | Name: ${row.name} | S3 Key: ${row.photo}`
    },
    collections: {
        name: 'Collections',
        bucket: process.env.AWS_COLLECTION_BUCKET || 'staymaster/collection',
        resizeWidth: 1280,
        getRecordsQuery: (limit) => {
            let query = `
                SELECT id, name, icon 
                FROM collections 
                WHERE icon IS NOT NULL 
                  AND icon NOT LIKE '%.webp'
                ORDER BY id ASC
            `;
            const params = [];
            if (limit) {
                query += ` LIMIT ?`;
                params.push(limit);
            }
            return { query, params };
        },
        getOriginalS3Key: (row) => row.icon,
        getNewFilename: (originalFilename) => ImageHelper.getWebpFilename(originalFilename),
        getNewS3Key: (row, newFilename) => newFilename,
        updateDbQuery: 'UPDATE collections SET icon = ? WHERE id = ?',
        updateDbParams: (newFilename, row) => [newFilename, row.id],
        logRecordDetails: (row) => `Collection ID: ${row.id} | Name: ${row.name} | S3 Key: ${row.icon}`
    },
    leads: {
        name: 'Lead Popups',
        bucket: process.env.AWS_BUCKET || 'staymaster',
        resizeWidth: 1280,
        getRecordsQuery: (limit) => {
            let query = `
                SELECT id, display, value 
                FROM settings 
                WHERE setting = 'lead_form_image' 
                  AND category = 'lead_form' 
                  AND value IS NOT NULL 
                  AND value NOT LIKE '%.webp'
                ORDER BY id ASC
            `;
            const params = [];
            if (limit) {
                query += ` LIMIT ?`;
                params.push(limit);
            }
            return { query, params };
        },
        getOriginalS3Key: (row) => row.value,
        getNewFilename: (originalFilename) => ImageHelper.getWebpFilename(originalFilename),
        getNewS3Key: (row, newFilename) => newFilename,
        updateDbQuery: 'UPDATE settings SET value = ? WHERE id = ?',
        updateDbParams: (newFilename, row) => [newFilename, row.id],
        logRecordDetails: (row) => `Setting ID: ${row.id} | Display: ${row.display} | S3 Key: ${row.value}`
    }
};

async function main() {
    const args = process.argv.slice(2);
    
    // Help command
    if (args.includes('--help') || args.includes('-h')) {
        printUsage();
        process.exit(0);
    }

    const targetArg = args[0];
    if (!targetArg || !TARGETS[targetArg]) {
        console.error(`\n❌ Error: Invalid or missing target. Got: "${targetArg || ''}"`);
        printUsage();
        process.exit(1);
    }

    const config = TARGETS[targetArg];
    const dryRun = args.includes('--dry-run');
    const deleteOriginals = args.includes('--delete-originals');
    
    // Parse limit
    let limit = null;
    const limitIndex = args.indexOf('--limit');
    if (limitIndex !== -1 && args[limitIndex + 1]) {
        limit = parseInt(args[limitIndex + 1], 10);
        if (isNaN(limit)) {
            console.error('❌ Error: --limit must be followed by a valid number');
            process.exit(1);
        }
    }

    // Parse property-id
    let propertyId = null;
    const propIdIndex = args.indexOf('--property-id');
    if (propIdIndex !== -1 && args[propIdIndex + 1]) {
        propertyId = parseInt(args[propIdIndex + 1], 10);
        if (isNaN(propertyId)) {
            console.error('❌ Error: --property-id must be followed by a valid number');
            process.exit(1);
        }
        if (targetArg !== 'properties') {
            console.warn('⚠️ Warning: --property-id is only applicable to the "properties" target. Ignoring.');
            propertyId = null;
        }
    }

    console.log('\n======================================================');
    console.log(`🚀 STARTING S3 IMAGE OPTIMIZATION: ${config.name.toUpperCase()}`);
    console.log('======================================================');
    console.log(`Target Target:      ${targetArg}`);
    console.log(`S3 Bucket:          ${config.bucket}`);
    console.log(`Target Width:       ${config.resizeWidth}px`);
    console.log(`Dry-Run Mode:       ${dryRun ? '🟢 ACTIVE (No S3/DB mutations)' : '🔴 INACTIVE (Real updates)'}`);
    console.log(`Delete Originals:   ${deleteOriginals ? '🟢 ENABLED (S3 cleanup)' : '🟡 DISABLED (Original backups retained)'}`);
    if (limit) console.log(`Limit Size:         ${limit} records`);
    if (propertyId) console.log(`Property ID Filter: ${propertyId}`);
    console.log('======================================================\n');

    try {
        // Fetch candidates from database
        console.log('Connecting to database and fetching non-WebP candidates...');
        const { query, params } = config.getRecordsQuery(limit, propertyId);
        const [rows] = await pool.query(query, params);

        if (rows.length === 0) {
            console.log('🎉 No non-WebP images found to optimize for this target!');
            process.exit(0);
        }

        console.log(`📈 Found ${rows.length} candidate(s) for optimization.\n`);

        if (dryRun) {
            console.log('--- DRY RUN CANDIDATES PREVIEW ---');
            rows.forEach((row, i) => {
                const originalKey = config.getOriginalS3Key(row);
                const newFilename = config.getNewFilename(originalKey);
                const newKey = config.getNewS3Key(row, newFilename);
                console.log(`[${i + 1}/${rows.length}] ${config.logRecordDetails(row)}`);
                console.log(`    ↳ Original S3 Key:   ${originalKey}`);
                console.log(`    ↳ Optimized S3 Key:  ${newKey}`);
            });
            console.log('\n🏁 Dry-run completed. No actions were performed.');
            process.exit(0);
        }

        // Process images sequentially to manage memory & rate limits
        let successCount = 0;
        let failCount = 0;
        let skippedCount = 0;

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const originalKey = config.getOriginalS3Key(row);
            const newFilename = config.getNewFilename(originalKey);
            const newKey = config.getNewS3Key(row, newFilename);
            
            console.log(`\n[${i + 1}/${rows.length}] Processing: ${config.logRecordDetails(row)}`);

            try {
                // 1. Download original from S3
                console.log(`   📥 Downloading from S3: ${originalKey}...`);
                let originalObject;
                try {
                    originalObject = await S3Helper.getObject(config.bucket, originalKey);
                } catch (s3GetError) {
                    if (s3GetError.code === 'NoSuchKey') {
                        console.warn(`   ⚠️ Warning: File not found on S3. Skipping.`);
                        skippedCount++;
                        continue;
                    }
                    throw s3GetError;
                }

                // 2. Compress and convert using Sharp
                console.log(`   ⚙️  Compressing and converting to WebP (width: ${config.resizeWidth}px)...`);
                let optimizedBuffer;
                try {
                    optimizedBuffer = await ImageHelper.optimizeToWebp(originalObject.Body, { width: config.resizeWidth });
                } catch (sharpError) {
                    console.error(`   ❌ Sharp processing failed: ${sharpError.message}. Skipping.`);
                    failCount++;
                    continue;
                }

                // 3. Upload WebP to S3
                console.log(`   📤 Uploading WebP to S3: ${newKey}...`);
                const uploadResult = await S3Helper.uploadFile(config.bucket, newKey, optimizedBuffer, {
                    ContentType: 'image/webp',
                    CacheControl: 'public, max-age=31536000, immutable'
                });

                if (!uploadResult) {
                    throw new Error("S3 upload returned empty result.");
                }

                // 4. Update Database Reference
                console.log(`   💾 Updating database reference...`);
                const dbParams = config.updateDbParams(newFilename, row);
                await pool.query(config.updateDbQuery, dbParams);

                // 5. Optionally Delete Original File from S3
                if (deleteOriginals) {
                    console.log(`   🗑️  Cleaning up original file from S3: ${originalKey}...`);
                    try {
                        await S3Helper.deleteFile(config.bucket, originalKey);
                    } catch (s3DelError) {
                        console.warn(`   ⚠️ S3 Cleanup Warning: Failed to delete original file: ${s3DelError.message}`);
                    }
                }

                console.log(`   ✅ Success!`);
                successCount++;

            } catch (itemError) {
                console.error(`   ❌ Failed to process this record: ${itemError.message}`);
                failCount++;
            }
        }

        console.log('\n======================================================');
        console.log('🏁 MIGRATION COMPLETED');
        console.log('======================================================');
        console.log(`Total Candidates:  ${rows.length}`);
        console.log(`Successfully Done: ${successCount}`);
        console.log(`Skipped (Missing): ${skippedCount}`);
        console.log(`Failed Errors:    ${failCount}`);
        console.log('======================================================\n');

    } catch (error) {
        console.error('\n❌ Script crashed due to a critical error:', error.message);
        process.exit(1);
    }
}

function printUsage() {
    console.log(`
Usage:
  node scripts/optimizeS3Images.js <target> [options]

Targets:
  properties          Process property display images and photos (resizes to 1280px max-width)
  banners             Process banner images (resizes to 1920px max-width)
  blogs               Process blog cover images (resizes to 1280px max-width)
  destinations        Process destination photos (resizes to 1280px max-width)
  collections         Process collection icon photos (resizes to 1280px max-width)
  leads               Process lead form popup background images (resizes to 1280px max-width)

Options:
  --dry-run           Perform a test run without S3 modifications or database updates
  --delete-originals  Remove old non-WebP files from S3 after successful WebP upload
  --limit <number>    Limit processing to a specific number of records (recommended for first run)
  --property-id <id>  Filter by a single property ID (only applies to "properties" target)
  --help, -h          Print this help message
`);
}

main();
