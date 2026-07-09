const dotenv = require("dotenv").config();

const propertyBucketRaw = process.env.AWS_PROPERTY_BUCKET || '';
const [propertyBucketName, ...propertyBucketPrefixParts] = propertyBucketRaw.split('/');
const propertyBucketPrefix = propertyBucketPrefixParts.join('/');

const propertyImageBaseUrl = (process.env.AWS_PROPERTY_CDN_BASE_URL || process.env.PROPERTY_IMAGE_BASE_URL || '').replace(/\/$/, '');
const propertyCdnPrefix = (process.env.AWS_PROPERTY_CDN_PREFIX || propertyBucketPrefix || '').replace(/^\/+|\/+$/g, '');
const hasUsableCdnBaseUrl = propertyImageBaseUrl && !propertyImageBaseUrl.includes('your-cloudfront-domain');

function buildCdnUrl(key, prefix = '') {
    if (!key) return '';
    const cleanKey = key.replace(/^\/+/, '');
    if (!prefix) {
        return `${propertyImageBaseUrl}/${cleanKey}`;
    }
    const cleanPrefix = prefix.replace(/^\/+|\/+$/g, '');
    return `${propertyImageBaseUrl}/${cleanPrefix}/${cleanKey}`;
}

module.exports = {
    propertyBucketRaw,
    propertyBucketName,
    propertyBucketPrefix,
    propertyImageBaseUrl,
    propertyCdnPrefix,
    hasUsableCdnBaseUrl,
    buildCdnUrl
};
