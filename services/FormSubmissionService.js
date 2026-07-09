/**
 * FormSubmissionService
 * Centralized service for handling form submissions and email notifications
 */

const nodemailer = require('nodemailer');

const FORM_TYPE_LABELS = {
    get_in_touch: 'Stay enquiry',
    contact_us: 'Contact enquiry',
    host_page_form: 'Host enquiry',
};

const VALID_FORM_TYPES = Object.keys(FORM_TYPE_LABELS);

class FormSubmissionService {
    constructor() {
        this.transporter = null;
        this.defaultRecipients = [];
        this.hostRecipients = [];
        this.fromAddress = '';
        this.timeouts = {
            connection: 10000,
            socket: 12000,
            send: 10000
        };

        this._initializeConfig();
    }

    _initializeConfig() {
        const hasMailCredentials = Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD);

        if (!hasMailCredentials) {
            console.warn('FormSubmissionService: No email credentials configured');
            return;
        }

        // Parse timeouts
        this.timeouts = {
            connection: this._parseMsEnv(process.env.SMTP_CONNECTION_TIMEOUT_MS, 10000),
            socket: this._parseMsEnv(process.env.SMTP_SOCKET_TIMEOUT_MS, 12000),
            send: this._parseMsEnv(process.env.EMAIL_SEND_TIMEOUT_MS, 10000)
        };

        // Build transporter config
        const config = {
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD,
            },
            connectionTimeout: this.timeouts.connection,
            greetingTimeout: this.timeouts.connection,
            socketTimeout: this.timeouts.socket,
        };

        if (process.env.SMTP_HOST) {
            config.host = process.env.SMTP_HOST;
            config.port = Number(process.env.SMTP_PORT || 587);
            config.secure = process.env.SMTP_SECURE === 'true' || config.port === 465;
        } else {
            config.service = process.env.SMTP_SERVICE || 'gmail';
        }

        if (process.env.SMTP_IGNORE_TLS === 'true' || process.env.SMTP_IGNORE_TLS === '1') {
            config.tls = { rejectUnauthorized: false };
        }

        this.transporter = nodemailer.createTransport(config);

        // Parse recipients
        this.defaultRecipients = this._parseRecipientList(
            process.env.FORM_NOTIFICATION_RECIPIENTS || 'info@thestaymaster.com'
        );

        const hostSpecific = this._parseRecipientList(process.env.HOST_FORM_NOTIFICATION_RECIPIENTS || '');
        this.hostRecipients = hostSpecific.length ? hostSpecific : this.defaultRecipients;

        this.fromAddress = process.env.FORM_EMAIL_FROM || process.env.EMAIL_USER || undefined;
    }

    _parseMsEnv(value, fallback) {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    }

    _parseRecipientList(value) {
        if (!value) return [];
        return value
            .split(',')
            .map(r => r.trim())
            .filter(r => r.length > 0);
    }

    /**
     * Validate form submission data
     * @param {Object} data - Form data
     * @returns {Object} - { valid: boolean, error?: string }
     */
    validateFormData(data) {
        const { form_type, name, email, phone, property_type, comment } = data;

        // Check form type
        if (!form_type || !VALID_FORM_TYPES.includes(form_type)) {
            return { valid: false, error: 'Invalid form type!' };
        }

        // Check required fields
        if (!name || !email || !phone) {
            return { valid: false, error: 'Mandatory parameters missing or incorrect!' };
        }

        // Check property_type for specific form types
        if ((form_type === 'get_in_touch' || form_type === 'host_page_form') && !property_type) {
            return { valid: false, error: 'Mandatory parameters missing or incorrect!' };
        }

        // Check comment for contact_us
        if (form_type === 'contact_us' && !comment) {
            return { valid: false, error: 'Mandatory parameters missing or incorrect!' };
        }

        return { valid: true };
    }

    /**
     * Get recipients for a form type
     * @param {string} formType
     * @returns {Array<string>}
     */
    getRecipients(formType) {
        const recipientsByType = {
            get_in_touch: this.defaultRecipients,
            contact_us: this.defaultRecipients,
            host_page_form: this.hostRecipients,
        };
        return recipientsByType[formType] || this.defaultRecipients;
    }

    /**
     * Get form type label
     * @param {string} formType
     * @returns {string}
     */
    getFormTypeLabel(formType) {
        return FORM_TYPE_LABELS[formType] || formType;
    }

    /**
     * Send form submission notification email
     * @param {Object} options
     * @returns {Promise<boolean>}
     */
    async sendNotificationEmail({ formType, name, email, phone, propertyTypeLabel, comment, recipients }) {
        if (!this.transporter) {
            return false;
        }

        const targetRecipients = Array.isArray(recipients) ? recipients : [];
        if (!targetRecipients.length) {
            console.warn('Form submission email skipped: no recipients configured.');
            return false;
        }

        const formLabel = this.getFormTypeLabel(formType);
        const fullName = name || 'Not provided';
        const emailAddress = email || 'Not provided';
        const phoneNumber = phone || 'Not provided';
        const propertyValue = propertyTypeLabel || '';
        const commentValue = comment || '';

        const textSections = [
            `A new ${formLabel.toLowerCase()} has been submitted on StayMaster.`,
            '',
            `Name: ${fullName}`,
            `Email: ${emailAddress}`,
            `Phone: ${phoneNumber}`,
        ];

        if (propertyValue) textSections.push(`Property Type: ${propertyValue}`);
        if (commentValue) textSections.push(`Comment: ${commentValue}`);

        const htmlBody = this._buildEmailHtml({ formLabel, fullName, emailAddress, phoneNumber, propertyValue, commentValue });

        try {
            const sendPromise = this.transporter.sendMail({
                from: this.fromAddress,
                to: targetRecipients,
                replyTo: emailAddress !== 'Not provided' ? emailAddress : undefined,
                subject: `New ${formLabel} submission from ${fullName}`,
                text: textSections.join('\n'),
                html: htmlBody,
            });

            await this._resolveWithTimeout(sendPromise, this.timeouts.send);
            return true;
        } catch (error) {
            if (error?.code === 'EAUTH') {
                error.help = 'Authentication failed when connecting to the SMTP server.';
            }
            if (error?.code === 'EMAIL_SEND_TIMEOUT') {
                error.help = `SMTP server did not respond within ${this.timeouts.send}ms.`;
            }
            throw error;
        }
    }

    _buildEmailHtml({ formLabel, fullName, emailAddress, phoneNumber, propertyValue, commentValue }) {
        const tableRows = [
            { label: 'Form type', value: formLabel },
            { label: 'Name', value: fullName },
            { label: 'Email', value: emailAddress },
            { label: 'Phone', value: phoneNumber },
            propertyValue ? { label: 'Property type', value: propertyValue } : null,
            commentValue ? { label: 'Comment', value: commentValue } : null,
        ].filter(Boolean)
            .map(({ label, value }) => (
                `<tr>
                    <td style="padding: 8px 12px; border: 1px solid #e0e0e0; background-color: #fafafa;"><strong>${this._escapeHtml(label)}</strong></td>
                    <td style="padding: 8px 12px; border: 1px solid #e0e0e0;">${this._escapeHtml(value)}</td>
                </tr>`
            ))
            .join('');

        return `
            <div style="font-family: Arial, sans-serif; max-width: 520px; color: #222;">
                <p style="font-size: 16px;">A new ${this._escapeHtml(formLabel.toLowerCase())} has been submitted on <strong>StayMaster</strong>.</p>
                <table style="border-collapse: collapse; width: 100%; margin-top: 12px;">
                    ${tableRows}
                </table>
            </div>
        `;
    }

    _escapeHtml(value) {
        if (value === undefined || value === null) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    _resolveWithTimeout(promise, timeoutMs) {
        let timeoutId;
        return new Promise((resolve, reject) => {
            timeoutId = setTimeout(() => {
                const timeoutError = new Error(`Email dispatch exceeded ${timeoutMs}ms.`);
                timeoutError.code = 'EMAIL_SEND_TIMEOUT';
                promise.catch(() => {});
                reject(timeoutError);
            }, timeoutMs);

            promise.then(
                (value) => { clearTimeout(timeoutId); resolve(value); },
                (err) => { clearTimeout(timeoutId); reject(err); }
            );
        });
    }

    /**
     * Check if email service is configured
     * @returns {boolean}
     */
    isEmailConfigured() {
        return this.transporter !== null;
    }
}

module.exports = new FormSubmissionService();
