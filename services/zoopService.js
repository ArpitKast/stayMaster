'use strict';

const axios = require('axios');
const { randomUUID } = require('crypto');

/**
 * ZoopService — Axios client for all Zoop Gateway API calls.
 *
 * Official documentation:
 *   Dashboard & API docs : https://dashboard.zoop.one/doc
 *   eSign product page   : https://zoop.one/esign
 *   API status           : https://status.zoop.one
 *
 * eSign v5 endpoints:
 *   Test        : https://test.zoop.plus/contract/esign/v5/init
 *   Production  : https://api.zoop.plus/contract/esign/v5/init
 *
 * Required environment variables:
 *   ZOOP_API_KEY   — API key from the Zoop dashboard
 *   ZOOP_APP_ID    — App ID from the Zoop dashboard
 *   ZOOP_BASE_URL  — Override base URL (default: https://api.zoop.one)
 *                    Set to https://test.zoop.plus/contract/esign for sandbox eSign
 *
 * See: new_beckend/ZOOP_ESIGN_DOCS.md for full integration guide.
 */
class ZoopService {
    constructor() {
        this.apiKey = process.env.ZOOP_API_KEY;
        this.appId = process.env.ZOOP_APP_ID; // Often required by Zoop along with API Key
        this.baseUrl = process.env.ZOOP_BASE_URL || 'https://test.zoop.one'; // Default Zoop API base URL (test env)
        this.isConfigured = Boolean(this.apiKey && this.appId);

        if (!this.isConfigured) {
            console.warn('ZoopService disabled: ZOOP_API_KEY and/or ZOOP_APP_ID are missing');
        }

        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'api-key': this.apiKey,
                'app-id': this.appId,
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000 // 15 seconds timeout
        });
    }

    /**
     * Generic method to make requests to Zoop Gateway
     * @param {string} endpoint - API endpoint
     * @param {string} method - HTTP method (GET, POST, etc.)
     * @param {Object} data - Request body data
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} - API response
     */
    async makeRequest(endpoint, method = 'POST', data = {}, params = {}, timeout = 15000) {
        if (!this.isConfigured) {
            const error = new Error('Zoop API credentials are not configured');
            error.code = 'ZOOP_CONFIG_MISSING';
            error.status = 500;
            throw error;
        }

        try {
            const isAbsoluteUrl = /^https?:\/\//i.test(endpoint);
            const requestConfig = {
                url: endpoint,
                method,
                data,
                params
            };

            const response = isAbsoluteUrl
                ? await axios({
                    ...requestConfig,
                    headers: {
                        'api-key': this.apiKey,
                        'app-id': this.appId,
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout
                })
                : await this.client({ ...requestConfig, timeout });
            return response.data;
        } catch (error) {
            console.error(`Zoop API Error [${endpoint}]:`, error.response ? error.response.data : error.message);
            throw error;
        }
    }

    /**
     * PAN Verification API
     * @param {string} panNumber - PAN number to verify
     * @returns {Promise<Object>}
     */
    async verifyPAN(panNumber) {
        return this.makeRequest('/in/identity/pan/lite', 'POST', {
            data: {
                customer_pan_number: panNumber
            }
        });
    }

    /**
     * Aadhaar OKYC OTP Generation
     * @param {string} aadhaarNumber - Aadhaar number
     * @returns {Promise<Object>}
     */
    async generateAadhaarOTP(aadhaarNumber) {
        return this.makeRequest('/in/identity/okyc/otp/generate', 'POST', {
            data: {
                customer_aadhaar_number: aadhaarNumber
            }
        });
    }

    /**
     * Aadhaar OKYC OTP Verification
     * @param {string} requestId - Request ID from generateAadhaarOTP
     * @param {string} otp - OTP received by customer
     * @returns {Promise<Object>}
     */
    async verifyAadhaarOTP(requestId, otp) {
        return this.makeRequest('/in/identity/okyc/otp/verify', 'POST', {
            data: {
                request_id: requestId,
                otp: otp
            }
        });
    }

    /**
     * GST Verification API
     * Zoop endpoint: POST https://test.zoop.one/api/v1/in/merchant/gstin/lite
     * @param {string} gstNumber - GST number to verify
     * @returns {Promise<Object>}
     */
    async verifyGST(gstNumber) {
        const endpoint = `${this.baseUrl}/api/v1/in/merchant/gstin/lite`;
        return this.makeRequest(endpoint, 'POST', {
            mode: 'sync',
            data: {
                business_gstin_number: gstNumber,
                consent: 'Y',
                consent_text: 'I hear by declare my consent agreement for fetching my information via ZOOP API'
            },
            task_id: randomUUID()
        });
    }

    /**
     * Zoop eSign Initialization API — v5
     *
     * Docs: https://dashboard.zoop.one/doc
     * Test endpoint : https://test.zoop.plus/contract/esign/v5/init
     * Prod endpoint : https://api.zoop.plus/contract/esign/v5/init
     *
     * @param {Object} data - eSign initialization payload
     * @param {Object} data.document - Document object
     * @param {string} data.document.data - Base64-encoded PDF content
     * @param {Array}  data.signer - Array of signer objects
     * @param {string} data.signer[].signer_id - Unique signer identifier
     * @param {string} data.signer[].signer_name - Full name of the signer
     * @param {string} [data.signer[].signer_email] - Signer email (for invite)
     * @param {string} [data.signer[].signer_mobile] - Signer mobile number
     * @param {string} [data.signer[].signer_city] - Signer city (compliance)
     * @param {string} data.signer[].signer_auth_mode - 'AADHAAR' or 'BIO'
     * @param {string} data.signer[].signature_type - 'ESIGN' or 'DSC'
     * @param {string} [data.signer[].reason] - Reason for signing
     * @param {string} [data.signer[].signer_identifier_type] - 'AADHAAR'
     * @param {string} [data.signer[].signer_identifier_value] - Last 4 digits of Aadhaar
     * @param {string} [data.txn_expiry_min] - Expiry in minutes (default '10080' = 7 days)
     * @param {string} [data.white_label] - 'Y' to hide Zoop branding
     * @param {boolean} [data.send_invite] - Send email/SMS invite to signer
     * @param {string} [data.signing_type] - 'PARALLEL' or 'SEQUENTIAL'
     * @param {string} [data.esign_type] - 'AADHAAR' (default)
     * @param {string} [data.redirect_url] - Redirect URL after signing
     * @param {string} [data.response_url] - Webhook URL for signing callbacks
     * @param {Object} [data.metadata] - Arbitrary metadata (returned in webhook)
     *
     * @returns {Promise<{request_id: string, transaction_id: string, gateway_url: string, status: string}>}
     */
    /**
     * Driving License Verification API
     * Zoop endpoint: POST https://test.zoop.one/api/v1/in/identity/dl/advance
     * @param {string} dlNumber - DL number (e.g. MH0120200001234)
     * @param {string} dob - Date of birth as DD-MM-YYYY
     * @param {string} nameToMatch - Guest's full name for name matching
     * @returns {Promise<Object>}
     */
    async verifyDrivingLicense(dlNumber, dob, nameToMatch) {
        const endpoint = `${this.baseUrl}/api/v1/in/identity/dl/advance`;
        return this.makeRequest(endpoint, 'POST', {
            mode: 'sync',
            data: {
                customer_dl_number: dlNumber,
                name_to_match: nameToMatch || '',
                customer_dob: dob,
                consent: 'Y',
                consent_text: 'I hereby declare my consent agreement for fetching my information via ZOOP API'
            },
            task_id: randomUUID()
        });
    }

    async initEsign(data) {
        // eSign v5 endpoint:
        //   Test production: https://test.zoop.plus/contract/esign/v5/init
        //   Live production: https://api.zoop.plus/contract/esign/v5/init
        // If ZOOP_BASE_URL includes 'zoop.plus' we use a relative path, otherwise fall back to test absolute URL.
        const endpoint = this.baseUrl.includes('zoop.plus') ? '/v5/init' : 'https://test.zoop.plus/contract/esign/v5/init';
        return this.makeRequest(endpoint, 'POST', data, {}, 60000);
    }
}

module.exports = new ZoopService();
