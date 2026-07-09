'use strict';

const sharp = require('sharp');
const path = require('path');

class ImageHelper {
    /**
     * Resizes and converts an image buffer to optimized WebP format.
     * 
     * @param {Buffer} buffer - The original image file buffer
     * @param {Object} options - Optimization options
     * @param {number} [options.width=1280] - Maximum width for resizing
     * @param {number} [options.quality=72] - Quality compression level (1-100)
     * @param {number} [options.effort=5] - CPU effort for webp compression (1-6)
     * @returns {Promise<Buffer>} The optimized WebP buffer
     */
    static async optimizeToWebp(buffer, options = {}) {
        const width = options.width || 1280;
        const quality = options.quality || 72;
        const effort = options.effort || 5;

        return sharp(buffer)
            .resize({ width, withoutEnlargement: true })
            .webp({ quality, effort })
            .toBuffer();
    }

    /**
     * Converts a filename to have a .webp extension.
     * 
     * @param {string} filename - The original filename
     * @returns {string} The filename with a .webp extension
     */
    static getWebpFilename(filename) {
        if (!filename) return '';
        const ext = path.extname(filename);
        if (ext.toLowerCase() === '.webp') return filename;
        // Simpler and correct — no regex needed, avoids RegExp allocation per call
        return filename.slice(0, filename.length - ext.length) + '.webp';
    }

    /**
     * Safely processes any uploaded file.
     * If the file is an image, resizes and converts it to WebP format.
     * Otherwise, returns the original buffer, extension, and content type intact.
     * 
     * @param {Object} file - The multer file object (req.file)
     * @param {Object} options - Optimization options passed to optimizeToWebp
     * @returns {Promise<Object>} Object containing optimized/raw buffer, extension, baseName, contentType, and isImage flag
     */
    static async processUpload(file, options = {}) {
        if (!file) return null;

        const isImage = file.mimetype && file.mimetype.startsWith('image/');
        const ext = path.extname(file.originalname || '');
        const baseName = path.basename(file.originalname || '', ext);

        let buffer = file.buffer;
        let finalExt = ext;
        let contentType = file.mimetype;

        if (isImage) {
            try {
                buffer = await this.optimizeToWebp(file.buffer, options);
                finalExt = '.webp';
                contentType = 'image/webp';
            } catch (err) {
                console.warn(`[ImageHelper] WebP optimization failed for ${file.originalname}, falling back to original:`, err.message);
            }
        }

        return {
            buffer,
            ext: finalExt,
            baseName,
            contentType,
            isImage
        };
    }
}

module.exports = ImageHelper;
