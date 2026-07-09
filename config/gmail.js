const nodemailer = require('nodemailer');

/**
 * Gmail SMTP Configuration
 * Credentials loaded from environment variables for security
 *
 * Required env vars:
 *   SMTP_USER or EMAIL_USER - Email address
 *   SMTP_PASS or EMAIL_PASSWORD - App password for the email account
 *   SMTP_SERVICE - Email service (defaults to 'gmail')
 */
const gmailer = nodemailer.createTransport({
    service: process.env.SMTP_SERVICE || 'gmail',
    auth: {
      user: process.env.SMTP_USER || process.env.EMAIL_USER,
      pass: process.env.SMTP_PASS || process.env.EMAIL_PASSWORD,
    },
});

module.exports = gmailer;