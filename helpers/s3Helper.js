const AWS = require('aws-sdk');

const dotenv = require("dotenv").config();
const mode = process.env.MODE || 'dev';
const bucket = process.env.AWS_BUCKET;
const monthly_statement_bucket = process.env.AWS_MONTHLY_STATEMENT_BUCKET;
const statement_folder = 'monthly_statements_by_property'

if(mode == 'dev'){
    AWS.config.update({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION,
    });
}else{
    AWS.config.update({ region: process.env.AWS_REGION });
}
const s3 = new AWS.S3();

const { propertyImageBaseUrl, hasUsableCdnBaseUrl, buildCdnUrl } = require('../config/cdnConfig');

class S3Helper {

    static getCdnUrl(bucketNameRaw, key) {
        const bucketParts = (bucketNameRaw || '').split('/');
        const s3Prefix = bucketParts.slice(1).join('/');
        return buildCdnUrl(key, s3Prefix);
    }

    static async uploadFile(bucket, key, body, options = {}) {
        try {
            const params = {
                Bucket: bucket,
                Key: key,
                Body: body,
                ...options,
            };
            return s3.upload(params).promise();
        } catch (error) {
            console.log(error);
        }
        
    }

  //ACL: 'public-read'

    static async generatePreSignedUrl(bucket,key) {
        if (hasUsableCdnBaseUrl) {
            return this.getCdnUrl(bucket, key);
        }
        return new Promise((resolve, reject) => {
            const params = {
                Bucket: bucket,
                Key: key,
                Expires: 3600, // URL expiration time in seconds (e.g., 1 hour)
            };
            s3.getSignedUrl('getObject', params, (err, url) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(url);
                }
            });
        });
    }

    static async getSignedUrlPromise(params){
        if (hasUsableCdnBaseUrl && params && params.Bucket && params.Key) {
            return this.getCdnUrl(params.Bucket, params.Key);
        }
        return await s3.getSignedUrlPromise('getObject', params);
    }

    static async getObject(bucket, key) {
        const params = {
            Bucket: bucket,
            Key: key,
        };
        return s3.getObject(params).promise();
    }

    /** Get multiple files from a single bucket */
    async getFilesFromBucket(bucket, keys) {
        const presignedUrlPromises = keys.map(async (key) => {
            const urlParams = { Bucket: bucket, Key: key, Expires: 3600 };
            const url = await S3Helper.getSignedUrlPromise(urlParams);
            return { fileName: key, url };
        });
        return await Promise.all(presignedUrlPromises);
    }

    /** Get single file from a bucket */
    async getFileFromS3(bucket, key) {
        const files = await this.getFilesFromBucket(bucket, [key]);
        return files[0].url;
    }

    static async deleteFile(bucket,key) {
        const params = {
            Bucket: bucket,
            Key: key,
        };
        return s3.deleteObject(params).promise();
    }

    static async listFiles(bucket,prefix) {
        const params = {
            Bucket: bucket,
            Prefix: prefix,
        };

        return s3.listObjectsV2(params).promise();
    }

    async listStatements(property_id) {
        const params = {
            //Bucket: bucket,
            Bucket: 'staymaster',
            Prefix: `${statement_folder}/${property_id}/`,
        };
        return s3.listObjectsV2(params).promise();
    }

    async getStatement(property_id, filename) {
        return await this.getFileFromS3(monthly_statement_bucket, `${property_id}/${filename}`);
    }

    static async uploadStatement(property_id, fileName, file) {
        try {
            return this.uploadFile('staymaster', `${statement_folder}/${property_id}/${fileName}`, file);
        } catch (error) {
            console.log(error);
        }
    }
}

module.exports = S3Helper;
