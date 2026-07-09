'use strict';

const axios = require('axios');
const S3Helper = require('./s3Helper');
const ImageHelper = require('./imageHelper');

const bucket = process.env.AWS_BUCKET;

/**
 * Download an image from a public URL and upload to S3 under blogs/.
 * @param {string} url
 * @returns {Promise<string|null>} S3 key or null on failure
 */
async function uploadBlogImageFromUrlToS3(url) {
  if (!url || !/^https?:\/\//i.test(url)) {
    return null;
  }

  try {
    const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
    const contentType = response.headers['content-type'] || 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      console.warn('[blogImageHelper] URL is not an image:', url);
      return null;
    }

    const originalName = url.split('?')[0].split('/').pop() || 'image.jpg';
    const now = new Date();
    const formattedDate = now.toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const mockFile = {
      buffer: Buffer.from(response.data),
      originalname: originalName,
      mimetype: contentType,
    };
    const { buffer, ext, baseName, contentType: finalContentType } =
      await ImageHelper.processUpload(mockFile);
    const photoKey = `blogs/${formattedDate}_${baseName}${ext}`;

    const uploadResult = await S3Helper.uploadFile(bucket, photoKey, buffer, {
      ContentType: finalContentType,
    });

    if (!uploadResult) {
      throw new Error('Failed to upload image to storage.');
    }

    return photoKey;
  } catch (error) {
    console.error('[blogImageHelper] uploadBlogImageFromUrlToS3 failed:', error.message);
    return null;
  }
}

module.exports = {
  uploadBlogImageFromUrlToS3,
};
