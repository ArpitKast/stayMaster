const nodemailer = require('nodemailer');

// Email configuration
const hasMailCredentials = Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD);
const emailAuthUser = hasMailCredentials ? process.env.EMAIL_USER : '';
const emailAuthPass = hasMailCredentials ? process.env.EMAIL_PASSWORD : '';

const parseMsEnv = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const SMTP_CONNECTION_TIMEOUT_MS = parseMsEnv(process.env.SMTP_CONNECTION_TIMEOUT_MS, 10000);
const SMTP_SOCKET_TIMEOUT_MS = parseMsEnv(process.env.SMTP_SOCKET_TIMEOUT_MS, 12000);
const EMAIL_SEND_TIMEOUT_MS = parseMsEnv(process.env.EMAIL_SEND_TIMEOUT_MS, 10000);

const transporterConfig = (() => {
    if (!hasMailCredentials) {
        return null;
    }

    const config = {
        auth: {
            user: emailAuthUser,
            pass: emailAuthPass,
        },
        // Keep SMTP operations from hanging the request forever.
        connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
        greetingTimeout: SMTP_CONNECTION_TIMEOUT_MS,
        socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
    };

    if (process.env.SMTP_HOST) {
        config.host = process.env.SMTP_HOST;
        config.port = Number(process.env.SMTP_PORT || 587);
        config.secure =
            process.env.SMTP_SECURE === 'true' || config.port === 465;
    } else {
        config.service = process.env.SMTP_SERVICE || 'gmail';
    }

    // Always set TLS for Gmail service, or if SMTP_IGNORE_TLS is enabled
    if (
        config.service === 'gmail' ||
        process.env.SMTP_IGNORE_TLS === 'true' ||
        process.env.SMTP_IGNORE_TLS === '1'
    ) {
        config.tls = { rejectUnauthorized: false };
    }

    return config;
})();

const mailTransporter = transporterConfig
    ? nodemailer.createTransport(transporterConfig)
    : null;

const parseRecipientList = (value) => {
    if (!value) {
        return [];
    }
    return value
        .split(',')
        .map((recipient) => recipient.trim())
        .filter((recipient) => recipient.length > 0);
};

const mailFromAddress = process.env.FORM_EMAIL_FROM || emailAuthUser || undefined;

function escapeHtml(value) {
    if (value === undefined || value === null) {
        return '';
    }
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function resolveWithTimeout(promise, timeoutMs) {
    let timeoutId;
    return new Promise((resolve, reject) => {
        timeoutId = setTimeout(() => {
            const timeoutError = new Error(`Email dispatch exceeded ${timeoutMs}ms.`);
            timeoutError.code = 'EMAIL_SEND_TIMEOUT';
            promise.catch(() => {}); // prevent unhandled rejection if it eventually fails
            reject(timeoutError);
        }, timeoutMs);

        promise.then(
            (value) => {
                clearTimeout(timeoutId);
                resolve(value);
            },
            (err) => {
                clearTimeout(timeoutId);
                reject(err);
            }
        );
    });
}

class EmailHelper {
    /**
     * Single function to send email using .env credentials
     * @param {string|Array<string>} recipients - Recipient email(s) - can be string (comma-separated) or array
     * @param {string} subject - Email subject
     * @param {string} html - HTML content of the email
     * @returns {Promise<boolean>} - Returns true if email sent, false otherwise
     */
    async sendMail(recipients, subject, html) {
        if (!mailTransporter) {
            console.warn('Email skipped: mail transporter not configured. Check EMAIL_USER and EMAIL_PASSWORD in .env');
            return false;
        }

        // Parse recipients - handle both string and array
        let targetRecipients = [];
        if (Array.isArray(recipients)) {
            targetRecipients = recipients;
        } else if (typeof recipients === 'string') {
            targetRecipients = parseRecipientList(recipients);
        }

        if (!targetRecipients.length) {
            console.warn('Email skipped: no recipients provided.');
            return false;
        }

        if (!subject || !html) {
            console.warn('Email skipped: subject and html content are required.');
            return false;
        }

        try {
            const mailOptions = {
                from: mailFromAddress,
                to: targetRecipients,
                subject: subject,
                html: html,
            };

            const sendPromise = mailTransporter.sendMail(mailOptions);
            await resolveWithTimeout(sendPromise, EMAIL_SEND_TIMEOUT_MS);
            return true;
        } catch (error) {
            if (error?.code === 'EAUTH') {
                error.help = 'Authentication failed when connecting to the SMTP server. For Gmail, you need to use an App Password (not your regular password). Generate one at: https://myaccount.google.com/apppasswords. Make sure EMAIL_USER and EMAIL_PASSWORD are set correctly in your .env file.';
            }
            if (error?.code === 'EMAIL_SEND_TIMEOUT') {
                error.help = `SMTP server did not respond within ${EMAIL_SEND_TIMEOUT_MS}ms. Check network access to the SMTP host/port or increase EMAIL_SEND_TIMEOUT_MS.`;
            }
            throw error;
        }
    }
}

module.exports = EmailHelper;

