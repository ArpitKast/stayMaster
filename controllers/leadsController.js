const Response = require("../helpers/responseHelper");
const { format } = require('date-fns');
const LeadModel = require('../models/leadModel');
const EmailHelper = require('../helpers/emailHelper');
const S3Helper = require('../helpers/s3Helper');
const SettingModel = require('../models/settingModel');
const ImageHelper = require('../helpers/imageHelper');

const LEAD_FORM_IMAGE_SETTING = 'lead_form_image';
const LEAD_FORM_IMAGE_CATEGORY = 'lead_form';
const LEAD_FORM_IMAGE_PREFIX = 'lead_form';
const LEAD_FORM_IMAGE_DISPLAY = 'Lead Form Image';

const formatLeadDate = (value) => {
    if (!value) {
        return '';
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return String(value);
    }
    return format(parsed, 'dd/MM/yyyy');
};

const normalizeLeadDate = (value) => {
    if (!value) {
        return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }
    return format(parsed, 'yyyy-MM-dd');
};

class LeadsController {
    constructor() {
        this.leadModel = new LeadModel();
        this.emailHelper = new EmailHelper();
        this.settingsModel = new SettingModel();
    }

    async create(req, res) {
        try {
            const {
                name,
                country_code,
                phone,
                email,
                message,
                check_in,
                check_out,
                guests,
                rooms,
                preferred_property,
                lead_source
            } = req.body;
            const normalizedSource = lead_source ? String(lead_source).trim() : 'form';
            if (normalizedSource === 'brochure') {
                if (!name || !phone || !email || !preferred_property) {
                    return Response.error(res, "ERROR", 'Name, phone, email and preferred property are required.', 400);
                }
            } else {
                if (!name || !phone || !email || !message) {
                    return Response.error(res, "ERROR", 'Name, phone, email and message are required.', 400);
                }
            }

            const trimmedPhone = String(phone).trim();
            if (!/^[0-9]+$/.test(trimmedPhone)) {
                return Response.error(res, "ERROR", 'Phone must contain digits only.', 400);
            }

            const trimmed = {
                name: String(name).trim(),
                country_code: country_code ? String(country_code).trim() : '',
                phone: trimmedPhone,
                email: String(email).trim(),
                message: normalizedSource === 'brochure' ? 'Brochure lead' : String(message).trim(),
                check_in: normalizedSource === 'brochure' ? null : normalizeLeadDate(check_in),
                check_out: normalizedSource === 'brochure' ? null : normalizeLeadDate(check_out),
                guests: normalizedSource === 'brochure' ? '' : (guests ? String(guests).trim() : ''),
                rooms: normalizedSource === 'brochure' ? '' : (rooms ? String(rooms).trim() : ''),
                preferred_property: preferred_property ? String(preferred_property).trim() : '',
                lead_source: normalizedSource
            };

            const id = await this.leadModel.createLead(trimmed);
            
            // Build HTML content for email
            const phoneNumber = trimmed.country_code ? `${trimmed.country_code} ${trimmed.phone}` : trimmed.phone;
            const htmlContent = normalizedSource === 'brochure'
                ? `
                <div style="font-family: Arial, sans-serif; max-width: 520px; color: #222;">
                    <p style="font-size: 16px;">A new <strong>brochure lead</strong> has been submitted on <strong>Staymaster</strong>.</p>
                    <table style="border-collapse: collapse; width: 100%; margin-top: 12px;">
                        <tr>
                            <td style="padding: 8px 12px; border: 1px solid #e0e0e0; background-color: #fafafa;"><strong>Name</strong></td>
                            <td style="padding: 8px 12px; border: 1px solid #e0e0e0;">${trimmed.name}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 12px; border: 1px solid #e0e0e0; background-color: #fafafa;"><strong>Email</strong></td>
                            <td style="padding: 8px 12px; border: 1px solid #e0e0e0;">${trimmed.email}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 12px; border: 1px solid #e0e0e0; background-color: #fafafa;"><strong>Phone</strong></td>
                            <td style="padding: 8px 12px; border: 1px solid #e0e0e0;">${phoneNumber}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 12px; border: 1px solid #e0e0e0; background-color: #fafafa;"><strong>Preferred Property</strong></td>
                            <td style="padding: 8px 12px; border: 1px solid #e0e0e0;">${trimmed.preferred_property || '-'}</td>
                        </tr>
                    </table>
                </div>
            `
                : `
                <div style="font-family: Arial, sans-serif; max-width: 520px; color: #222;">
                    <p style="font-size: 16px;">A new <strong>lead</strong> has been submitted on <strong>Staymaster</strong>.</p>
                    <table style="border-collapse: collapse; width: 100%; margin-top: 12px;">
                        <tr>
                            <td style="padding: 8px 12px; border: 1px solid #e0e0e0; background-color: #fafafa;"><strong>Name</strong></td>
                            <td style="padding: 8px 12px; border: 1px solid #e0e0e0;">${trimmed.name}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 12px; border: 1px solid #e0e0e0; background-color: #fafafa;"><strong>Email</strong></td>
                            <td style="padding: 8px 12px; border: 1px solid #e0e0e0;">${trimmed.email}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 12px; border: 1px solid #e0e0e0; background-color: #fafafa;"><strong>Phone</strong></td>
                            <td style="padding: 8px 12px; border: 1px solid #e0e0e0;">${phoneNumber}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 12px; border: 1px solid #e0e0e0; background-color: #fafafa;"><strong>Message</strong></td>
                            <td style="padding: 8px 12px; border: 1px solid #e0e0e0;">${trimmed.message}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 12px; border: 1px solid #e0e0e0; background-color: #fafafa;"><strong>Check In</strong></td>
                            <td style="padding: 8px 12px; border: 1px solid #e0e0e0;">${trimmed.check_in || '-'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 12px; border: 1px solid #e0e0e0; background-color: #fafafa;"><strong>Check Out</strong></td>
                            <td style="padding: 8px 12px; border: 1px solid #e0e0e0;">${trimmed.check_out || '-'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 12px; border: 1px solid #e0e0e0; background-color: #fafafa;"><strong>Guests</strong></td>
                            <td style="padding: 8px 12px; border: 1px solid #e0e0e0;">${trimmed.guests || '-'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 12px; border: 1px solid #e0e0e0; background-color: #fafafa;"><strong>Rooms</strong></td>
                            <td style="padding: 8px 12px; border: 1px solid #e0e0e0;">${trimmed.rooms || '-'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 12px; border: 1px solid #e0e0e0; background-color: #fafafa;"><strong>Preferred Property</strong></td>
                            <td style="padding: 8px 12px; border: 1px solid #e0e0e0;">${trimmed.preferred_property || '-'}</td>
                        </tr>
                    </table>
                </div>
            `;
            
            // Send email notification — awaited but non-fatal so the response always succeeds
            try {
                const emailDispatched = await this.emailHelper.sendMail(
                    process.env.LEAD_NOTIFICATION_RECIPIENTS || 'info@thestaymaster.com',
                    `New Lead submission from ${trimmed.name}`,
                    htmlContent
                );
                if (!emailDispatched) {
                    console.warn('Lead stored but notification email was skipped (mail configuration missing).');
                }
            } catch (emailErr) {
                console.error('[Leads] Email notification failed:', emailErr.message);
            }

            return Response.success(res, { id, message: 'Thank you for reaching out! We will connect with you shortly.' }, 201);
        } catch (error) {
            console.error('Error creating lead:', error);
            // Log full error details for debugging
            if (error.message) {
                console.error('Error message:', error.message);
            }
            if (error.stack) {
                console.error('Error stack:', error.stack);
            }
            // Return more specific error message if available
            const errorMessage = error.message || 'Failed to create lead.';
            return Response.error(res, "ERROR", errorMessage, 500);
        }
    }

    async index(req, res) {
        try {
            const page = Math.max(parseInt(req.query.page || '1', 10), 1);
            const pageSize = 10;
            const leadSource = (req.query.source || 'form').trim();
            let { rows: leads, total } = await this.leadModel.getPaginated(page, pageSize, leadSource);
            const totalPages = Math.max(1, Math.ceil(total / pageSize));
            let currentPage = page;

            if (page > totalPages && totalPages > 0) {
                currentPage = totalPages;
                const refreshed = await this.leadModel.getPaginated(currentPage, pageSize, leadSource);
                leads = refreshed.rows;
                total = refreshed.total;
            }

            leads.forEach((lead) => {
                if (lead.created_at) {
                    lead.created_at = format(new Date(lead.created_at), 'dd/MM/yyyy HH:mm:ss');
                }
                lead.country_code = lead.country_code || '';
                lead.check_in = formatLeadDate(lead.check_in);
                lead.check_out = formatLeadDate(lead.check_out);
                lead.guests = lead.guests || '';
                lead.rooms = lead.rooms || '';
                lead.preferred_property = lead.preferred_property || '';
                lead.lead_source = lead.lead_source || 'form';
            });
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

            return res.render('leads/list.ejs', {
                leads,
                leadSource,
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
                    query: `&source=${encodeURIComponent(leadSource)}`
                }
            });
        } catch (error) {
            console.error('Error loading leads list', error);
            return Response.error(res, "ERROR", "Unable to load leads", 500);
        }
    }

    async exportAll(req, res) {
        res.setHeader('Cache-Control', 'no-store');
        try {
            const leadSource = (req.query.source || '').trim().toLowerCase();
            let leads = [];
            if (leadSource) {
                const result = await this.leadModel.getPaginated(1, Number.MAX_SAFE_INTEGER, leadSource);
                leads = result.rows;
            } else {
                leads = await this.leadModel.getAll();
            }
            leads.forEach((lead) => {
                if (lead.created_at) {
                    lead.created_at = format(new Date(lead.created_at), 'dd/MM/yyyy HH:mm:ss');
                }
                lead.country_code = lead.country_code || '';
                lead.check_in = formatLeadDate(lead.check_in);
                lead.check_out = formatLeadDate(lead.check_out);
                lead.guests = lead.guests || '';
                lead.rooms = lead.rooms || '';
                lead.preferred_property = lead.preferred_property || '';
                lead.lead_source = lead.lead_source || 'form';
            });
            return Response.success(res, { leads }, 200);
        } catch (error) {
            console.error('Error exporting leads', error);
            return Response.error(res, "ERROR", 'Failed to export leads', 500);
        }
    }


    async getFormImage(req, res) {
        try {
            const setting = await this.settingsModel.getSettingValue(
                LEAD_FORM_IMAGE_SETTING,
                LEAD_FORM_IMAGE_CATEGORY
            );
            if (!setting || !setting.value) {
                // Return success with null URL instead of error
                // Frontend can handle this gracefully
                return Response.success(res, { url: null, alt: 'Lead popup image' }, 200);
            }
            const url = await S3Helper.generatePreSignedUrl(process.env.AWS_BUCKET, setting.value);
            return Response.success(res, { url: url, alt: 'Lead popup image' }, 200);
        } catch (error) {
            console.error('Error fetching lead form image', error);
            // Return success with null URL on error too, so frontend doesn't break
            return Response.success(res, { url: null, alt: 'Lead popup image' }, 200);
        }
    }

    async uploadFormImage(req, res) {
        try {
            if (!req.file) {
                return Response.error(res, "ERROR", 'No image uploaded.', 400);
            }

            const bucket = process.env.AWS_BUCKET;
            const { buffer, ext, contentType } = await ImageHelper.processUpload(req.file);
            const key = `${LEAD_FORM_IMAGE_PREFIX}/lead-form-${Date.now()}${ext}`;

            await S3Helper.uploadFile(bucket, key, buffer, {
                ContentType: contentType
            });

            await this.settingsModel.upsertSettingValue(
                LEAD_FORM_IMAGE_SETTING,
                LEAD_FORM_IMAGE_CATEGORY,
                key,
                LEAD_FORM_IMAGE_DISPLAY,
                'Lead form image stored in S3'
            );

            const url = await S3Helper.generatePreSignedUrl(bucket, key);
            return Response.success(res, { url }, 200);
        } catch (error) {
            console.error('Error uploading lead form image', error);
            return Response.error(res, "ERROR", 'Failed to upload image.', 500);
        }
    }
}

module.exports = LeadsController;
