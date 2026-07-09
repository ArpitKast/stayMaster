'use strict';
const Response = require("../helpers/responseHelper");
const path = require('path');
const pool = require('../config/dbConnection');
const S3Helper = require('../helpers/s3Helper');
const settingModel = require('../models/settingModel');
const propertyModel = require('../models/propertyModel');
const {
    propertyBucketRaw,
    propertyBucketName,
    propertyBucketPrefix,
    propertyImageBaseUrl,
    propertyCdnPrefix,
    hasUsableCdnBaseUrl,
    buildCdnUrl
} = require('../config/cdnConfig');

const SettingsModel = new settingModel();
const PropertyModel = new propertyModel();

const BROCHURE_MEDIA_VALUE = 'brochure';
const BROCHURE_MEDIA_DISPLAY = 'Brochure';
const BROCHURE_MEDIA_CATEGORY = 'files';
const BROCHURE_MEDIA_DESCRIPTION = 'Property brochure PDF';

class BrochureController {
    async getPropertyAssetUrl(propertyId, mediaFilename) {
        if (!mediaFilename) return '';
        const filePath = `${propertyId}/${mediaFilename}`;
        if (hasUsableCdnBaseUrl) {
            return buildCdnUrl(filePath, propertyCdnPrefix);
        }
        const key = [propertyBucketPrefix, filePath].filter(Boolean).join('/');
        const urlParams = { Bucket: propertyBucketName || propertyBucketRaw, Key: key, Expires: 3600 };
        return S3Helper.getSignedUrlPromise(urlParams);
    }

    async ensureBrochureMediaType() {
        let setting = await SettingsModel.getMediaTypeByValue(BROCHURE_MEDIA_VALUE);
        if (!setting) {
            const insertedId = await SettingsModel.createMediaType(
                BROCHURE_MEDIA_VALUE,
                BROCHURE_MEDIA_DISPLAY,
                BROCHURE_MEDIA_CATEGORY,
                BROCHURE_MEDIA_DESCRIPTION
            );
            setting = await SettingsModel.getMediaTypeByValue(BROCHURE_MEDIA_VALUE);
            if (!setting && insertedId) {
                setting = { id: insertedId, value: BROCHURE_MEDIA_VALUE };
            }
        }
        return setting;
    }

    async index(req, res) {
        try {
            const brochureSetting = await this.ensureBrochureMediaType();
            const mediaTypeId = brochureSetting?.id;
            if (!mediaTypeId) {
                return res.render('brochures/list', {
                    brochures: [],
                    properties: [],
                    flash: 'Brochure media type not configured.',
                    pagination: null,
                    search: ''
                });
            }

            const page = Math.max(parseInt(req.query.page || '1', 10), 1);
            const pageSize = 10;
            const search = (req.query.search || '').trim();
            const searchLike = `%${search}%`;

            const propertyList = await PropertyModel.propertiesList();

            let total = 0;
            if (search) {
                const [countRows] = await pool.query(
                    `select count(*) as total
                     from properties
                     where listing_name like ? or internal_name like ?`,
                    [searchLike, searchLike]
                );
                total = countRows[0]?.total || 0;
            } else {
                const [countRows] = await pool.query('select count(*) as total from properties');
                total = countRows[0]?.total || 0;
            }

            const totalPages = Math.max(1, Math.ceil(total / pageSize));
            let currentPage = page;
            if (page > totalPages && totalPages > 0) {
                currentPage = totalPages;
            }
            const offset = (currentPage - 1) * pageSize;

            let rows = [];
            if (search) {
                const [resultRows] = await pool.query(
                    `select p.id, p.listing_name, p.internal_name,
                            pm.id as media_id, pm.media_filename
                     from properties p
                     left join property_media pm
                       on p.id = pm.property_id and pm.media_type_id = ?
                     where p.listing_name like ? or p.internal_name like ?
                     order by p.listing_name
                     limit ? offset ?`,
                    [mediaTypeId, searchLike, searchLike, pageSize, offset]
                );
                rows = resultRows;
            } else {
                const [resultRows] = await pool.query(
                    `select p.id, p.listing_name, p.internal_name,
                            pm.id as media_id, pm.media_filename
                     from properties p
                     left join property_media pm
                       on p.id = pm.property_id and pm.media_type_id = ?
                     order by p.listing_name
                     limit ? offset ?`,
                    [mediaTypeId, pageSize, offset]
                );
                rows = resultRows;
            }

            const brochures = await Promise.all(rows.map(async (row) => {
                if (row.media_filename) {
                    try {
                        const url = await this.getPropertyAssetUrl(row.id, row.media_filename);
                        row.brochure_url = url;
                    } catch (error) {
                        console.log('Error generating brochure URL:', error);
                        row.brochure_url = '';
                    }
                } else {
                    row.brochure_url = '';
                }
                return row;
            }));

            const displayTotalPages = Math.max(1, Math.ceil(total / pageSize));
            const maxPagesToShow = 5;
            let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
            let endPage = Math.min(displayTotalPages, startPage + maxPagesToShow - 1);
            if (endPage - startPage + 1 < maxPagesToShow) {
                startPage = Math.max(1, endPage - maxPagesToShow + 1);
            }
            const pages = [];
            for (let p = startPage; p <= endPage; p += 1) {
                pages.push(p);
            }
            const startIndex = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
            const endIndex = Math.min(total, currentPage * pageSize);
            const query = search ? `&search=${encodeURIComponent(search)}` : '';

            return res.render('brochures/list', {
                brochures,
                properties: propertyList || [],
                flash: req.params.flash || '',
                search,
                pagination: {
                    page: currentPage,
                    pageSize,
                    total,
                    totalPages: displayTotalPages,
                    pages,
                    startIndex,
                    endIndex,
                    hasPrev: currentPage > 1,
                    hasNext: currentPage < displayTotalPages,
                    query
                }
            });
        } catch (error) {
            console.log(error);
            return res.status(500).render('brochures/list', {
                brochures: [],
                properties: [],
                flash: 'Failed to load brochures.',
                pagination: null,
                search: ''
            });
        }
    }

    async upload(req, res) {
        try {
            const { property_id } = req.body;
            const file = req.file;

            if (!property_id) {
                return Response.error(res, "ERROR", 'Property is required.', 400);
            }
            if (!file) {
                return Response.error(res, "ERROR", 'PDF file is required.', 400);
            }

            const extension = path.extname(file.originalname || '').toLowerCase();
            if (file.mimetype !== 'application/pdf' && extension !== '.pdf') {
                return Response.error(res, "ERROR", 'Only PDF files are allowed.', 400);
            }

            const brochureSetting = await this.ensureBrochureMediaType();
            const mediaTypeId = brochureSetting?.id;
            if (!mediaTypeId) {
                return Response.error(res, "ERROR", 'Brochure media type not configured.', 400);
            }

            const [existingRows] = await pool.query(
                'select id, media_filename from property_media where property_id = ? and media_type_id = ? limit 1',
                [property_id, mediaTypeId]
            );

            const bucket = process.env.AWS_PROPERTY_BUCKET;
            const filename = `${property_id}_${BROCHURE_MEDIA_VALUE}${extension || '.pdf'}`;

            if (existingRows && existingRows.length > 0) {
                const existing = existingRows[0];
                if (existing.media_filename) {
                    try {
                        await S3Helper.deleteFile(bucket, `${property_id}/${existing.media_filename}`);
                    } catch (error) {
                        console.log('Failed to delete old brochure:', error);
                    }
                }
                await pool.query(
                    'update property_media set media_filename = ?, title = ?, description = ?, display_order = 1 where id = ?',
                    [filename, BROCHURE_MEDIA_DISPLAY, BROCHURE_MEDIA_DESCRIPTION, existing.id]
                );
            } else {
                await pool.query(
                    'insert into property_media (property_id, media_type_id, display_order, title, description, media_filename) values (?,?,?,?,?,?)',
                    [property_id, mediaTypeId, 1, BROCHURE_MEDIA_DISPLAY, BROCHURE_MEDIA_DESCRIPTION, filename]
                );
            }

            await S3Helper.uploadFile(bucket, `${property_id}/${filename}`, file.buffer, {
                ContentType: file.mimetype || 'application/pdf'
            });

            return Response.success(res, { flash: 'Brochure uploaded successfully.' }, 200);
        } catch (error) {
            console.log(error);
            return Response.error(res, "ERROR", 'Failed to upload brochure.', 400);
        }
    }
}

module.exports = BrochureController;
