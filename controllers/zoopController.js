'use strict';

/**
 * zoopController.js — Express route handlers for Zoop Gateway integrations.
 *
 * Zoop eSign v5 API docs : https://dashboard.zoop.one/doc
 * eSign product page     : https://zoop.one/esign
 * Full integration guide : see new_beckend/ZOOP_ESIGN_DOCS.md
 *
 * Routes (defined in routes/apiRoutes.js):
 *   POST /api/ext/zoop/verifyPAN              — PAN verification
 *   POST /api/ext/zoop/aadhaar/generateOTP    — Aadhaar OKYC OTP generation
 *   POST /api/ext/zoop/aadhaar/verifyOTP      — Aadhaar OKYC OTP verification
 *   POST /api/ext/zoop/verifyGST              — GST number verification
 *   POST /api/ext/zoop/esign/init             — Initiate eSign request (JWT required)
 *   POST /api/ext/zoop/esign/webhook          — Receive Zoop signing callback (no auth)
 */

const asyncHandler = require("express-async-handler");
const { randomUUID } = require('crypto');
const Response = require("../helpers/responseHelper");
const zoopService = require("../services/zoopService");
const pool = require("../config/dbConnection");
const S3Helper = require('../helpers/s3Helper');
const PDFDocument = require('pdfkit');
const bookingModel = require('../models/bookingModel');
const BookingModel = new bookingModel();

/**
 * Generate a base64-encoded declaration PDF using pdfkit.
 * Used as a fallback when the frontend does not supply a document.
 *
 * @param {string} signerName - Guest's full name
 * @param {string} bookingId  - Booking ID to embed in the PDF
 * @returns {Promise<string>}  Base64-encoded PDF string
 */
const generateDeclarationPdf = (signerName, bookingId) => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
        doc.on('error', reject);

        doc.fontSize(18).font('Helvetica-Bold')
            .text('Pre Check-In Declaration', { align: 'center' });
        doc.moveDown();
        doc.fontSize(11).font('Helvetica')
            .text(`Booking ID: ${bookingId}    |    Guest: ${signerName}`, { align: 'left' });
        doc.moveDown();
        doc.fontSize(12).font('Helvetica')
            .text(
                'I hereby declare that all information provided during the check-in process is true ' +
                'and accurate to the best of my knowledge. I understand that providing false information ' +
                'may result in the cancellation of my reservation without refund.',
                { align: 'justify' }
            );
        doc.moveDown();
        doc.text(
            'I acknowledge that I am responsible for the condition of the property during my stay and ' +
            'will report any damages or issues immediately. I agree to pay for any damages caused by me ' +
            'or my guests during the stay.',
            { align: 'justify' }
        );
        doc.moveDown();
        doc.text(
            'Check-in time is 3:00 PM and check-out time is 11:00 AM unless otherwise arranged. ' +
            'I agree to comply with all house rules and local regulations during my stay.',
            { align: 'justify' }
        );
        doc.moveDown(2);
        doc.text(`Guest Name: ${signerName}`);
        doc.moveDown();
        doc.text('Signature: ___________________________');
        doc.moveDown();
        doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`);
        doc.end();
    });
};

/**
 * verifyPAN — Verify a PAN number via Zoop Identity API.
 *
 * Zoop endpoint: POST /in/identity/pan/lite
 * Docs: https://dashboard.zoop.one/doc
 *
 * @route  POST /api/ext/zoop/verifyPAN
 * @body   { pan_number: string }
 */
const verifyPAN = asyncHandler(async (req, res) => {
    const { pan_number } = req.body;
    
    if (!pan_number) {
        return Response.error(res, "ERROR", "PAN number is required", 400);
    }

    try {
        const result = await zoopService.verifyPAN(pan_number);
        return Response.success(res, result, 200);
    } catch (error) {
        if (error.code === 'ZOOP_CONFIG_MISSING') {
            return Response.error(res, "ZOOP_CONFIG_MISSING", error.message, 503);
        }
        const errorData = error.response ? error.response.data : { message: error.message };
        return Response.error(res, "ZOOP_API_ERROR", errorData, error.response ? error.response.status : 500);
    }
});

/**
 * generateAadhaarOTP — Generate an Aadhaar OKYC OTP via Zoop.
 *
 * Zoop endpoint: POST /in/identity/okyc/otp/generate
 * Docs: https://dashboard.zoop.one/doc
 *
 * @route  POST /api/ext/zoop/aadhaar/generateOTP
 * @body   { aadhaar_number: string }
 */
const generateAadhaarOTP = asyncHandler(async (req, res) => {
    const { aadhaar_number } = req.body;
    
    if (!aadhaar_number) {
        return Response.error(res, "ERROR", "Aadhaar number is required", 400);
    }

    try {
        const result = await zoopService.generateAadhaarOTP(aadhaar_number);
        return Response.success(res, result, 200);
    } catch (error) {
        if (error.code === 'ZOOP_CONFIG_MISSING') {
            return Response.error(res, "ZOOP_CONFIG_MISSING", error.message, 503);
        }
        const errorData = error.response ? error.response.data : { message: error.message };
        return Response.error(res, "ZOOP_API_ERROR", errorData, error.response ? error.response.status : 500);
    }
});

/**
 * verifyAadhaarOTP — Verify Aadhaar OKYC OTP via Zoop.
 *
 * Zoop endpoint: POST /in/identity/okyc/otp/verify
 * Docs: https://dashboard.zoop.one/doc
 *
 * @route  POST /api/ext/zoop/aadhaar/verifyOTP
 * @body   { request_id: string, otp: string }
 */
const verifyAadhaarOTP = asyncHandler(async (req, res) => {
    const { request_id, otp } = req.body;
    
    if (!request_id || !otp) {
        return Response.error(res, "ERROR", "Request ID and OTP are required", 400);
    }

    try {
        const result = await zoopService.verifyAadhaarOTP(request_id, otp);
        return Response.success(res, result, 200);
    } catch (error) {
        if (error.code === 'ZOOP_CONFIG_MISSING') {
            return Response.error(res, "ZOOP_CONFIG_MISSING", error.message, 503);
        }
        const errorData = error.response ? error.response.data : { message: error.message };
        return Response.error(res, "ZOOP_API_ERROR", errorData, error.response ? error.response.status : 500);
    }
});

/**
 * verifyGST — Verify a GST number via Zoop.
 *
 * Zoop endpoint: POST https://live.zoop.one/api/v1/in/merchant/gstin/lite
 * Docs: https://dashboard.zoop.one/doc
 *
 * @route  POST /api/ext/zoop/verifyGST
 * @body   { gst_number: string }
 */
const verifyGST = asyncHandler(async (req, res) => {
    const { gst_number } = req.body;

    if (!gst_number) {
        return Response.error(res, "ERROR", "GST number is required", 400);
    }

    try {
        const result = await zoopService.verifyGST(gst_number);
        return Response.success(res, result, 200);
    } catch (error) {
        if (error.code === 'ZOOP_CONFIG_MISSING') {
            return Response.error(res, "ZOOP_CONFIG_MISSING", error.message, 503);
        }
        const errorData = error.response ? error.response.data : { message: error.message };
        return Response.error(res, "ZOOP_API_ERROR", errorData, error.response ? error.response.status : 500);
    }
});

/**
 * initEsign — Initiate a Zoop Aadhaar eSign transaction.
 *
 * Zoop eSign v5 endpoint:
 *   Test : https://test.zoop.plus/contract/esign/v5/init
 *   Prod : https://api.zoop.plus/contract/esign/v5/init
 * Docs   : https://dashboard.zoop.one/doc
 * Guide  : see new_beckend/ZOOP_ESIGN_DOCS.md
 *
 * @route  POST /api/ext/zoop/esign/init
 * @auth   JWT Bearer token required
 *
 * @body
 *   bookingId           {string}        Required. Used for DB tracking & redirect URL.
 *   document            {string|null}   Base64 PDF or S3 URL. Required — returns 400 if absent.
 *                                       - S3 URL (amazonaws.com) → backend fetches and converts to base64;
 *                                         if the S3 fetch fails, a declaration PDF is auto-generated via pdfkit
 *   signers             {Array}         Optional. Full signer array (see Zoop docs for schema).
 *   signer_name         {string}        Signer full name (used when signers array is not provided).
 *   signer_email        {string}        Signer email.
 *   signer_phone        {string}        Signer mobile number.
 *   signer_city         {string}        Signer city (compliance).
 *   signer_aadhaar_last4 {string}       Last 4 digits of Aadhaar (pre-fills on Zoop gateway).
 *   txn_expiry_min      {string}        Expiry in minutes. Default '10080' (7 days).
 *   redirect_url        {string}        Ignored when bookingId is set (server uses /api/ext/zoop/esign/return).
 *   response_url        {string}        Webhook URL for Zoop callbacks (overrides ZOOP_WEBHOOK_URL).
 *   white_label         {string}        'Y' to hide Zoop branding.
 *   send_invite         {boolean}       Send email/SMS invite to signer.
 *   signing_type        {string}        'PARALLEL' or 'SEQUENTIAL'. Default 'PARALLEL'.
 *   esign_type          {string}        'AADHAAR'. Default 'AADHAAR'.
 *   metadata            {Object}        Additional metadata passed through to webhook.
 *
 * @response 201
 *   { request_id, transaction_id, gateway_url, status }
 *   Redirect guest to `gateway_url` to complete Aadhaar-based signing.
 *   Store `request_id` in bookings.esign_request_id for webhook matching.
 */
const initEsign = asyncHandler(async (req, res) => {
    const {
        bookingId,
        document,
        signers,
        txn_expiry_min,
        redirect_url,
        response_url,
        white_label,
        send_invite,
        signing_type,
        esign_type,
        email_template,
        metadata
    } = req.body;
    const userObj = req.user;
    const userId = userObj?.id || userObj?.user?.id;
    
    if (!document && !req.body.document) {
        return Response.error(res, "ERROR", "Document is required", 400);
    }

    if (!userId) {
        return Response.error(res, "ERROR", "Unauthorized - Invalid token", 401);
    }

    if (bookingId) {
        const owned = await BookingModel.bookingForGuest(parseInt(bookingId, 10), userId);
        if (!owned) {
            return Response.error(res, "FORBIDDEN", "You cannot start eSign for this booking", 403);
        }
    }

    try {
        let documentData = document?.data || document || req.body.document;
        
        // Ensure it's a string (either base64 or URL)
        if (typeof documentData !== 'string' && documentData?.data) {
            documentData = documentData.data;
        }
        if (typeof documentData === 'string' && documentData.startsWith('http') && documentData.includes('amazonaws.com')) {
            console.log('Detected S3 URL for eSign, fetching content...', documentData);
            try {
                const url = new URL(documentData);
                const bucket = url.hostname.split('.')[0];
                const key = decodeURIComponent(url.pathname.substring(1));
                
                const s3Object = await S3Helper.getObject(bucket, key);
                documentData = s3Object.Body.toString('base64');
                console.log('S3 Document fetched and converted to base64 successfully');
            } catch (s3Err) {
                console.error('Error fetching S3 document for eSign:', s3Err);
                // Fall through to PDF generation below
                documentData = null;
            }
        }

        // 2. If no document data provided (or S3 fetch failed), generate a declaration PDF
        if (!documentData) {
            console.log('No document data provided — generating declaration PDF via pdfkit');
            const signerName = signers ? signers[0]?.signer_name : (req.body.signer_name || 'Guest');
            documentData = await generateDeclarationPdf(signerName, bookingId);
            console.log('Declaration PDF generated successfully');
        }

        const defaultSignerName = (signers && signers[0]?.signer_name) || req.body.signer_name || req.body.guestName || "Guest";
        const defaultSignerEmail = (signers && signers[0]?.signer_email) || req.body.signer_email || req.body.guestEmail || null;
        const defaultSignerPhone = (signers && (signers[0]?.signer_mobile || signers[0]?.signer_phone)) || req.body.signer_phone || req.body.guestPhone || null;
        const defaultSignerCity = (signers && signers[0]?.signer_city) || req.body.signer_city || req.body.signerCity || null;
        const defaultSignerIdentifier = req.body.signer_aadhaar_last4 || req.body.signerIdentifier || null;

        const normalizedDocument = {
            name: `Declaration_${bookingId}.pdf`,
            data: documentData,
            info: `Staymaster Pre Check-In Declaration for Booking ${bookingId}`,
        };

        const normalizedSigners = (Array.isArray(signers) && signers.length ? signers : [{
            signer_name: defaultSignerName,
            signer_email: defaultSignerEmail,
            signer_phone_number: defaultSignerPhone,
            signer_city: defaultSignerCity,
            signer_purpose: req.body.sign_reason || 'Staymaster Pre Check-In Declaration',
            sign_coordinates: req.body.sign_coordinates || [
                {
                    page_num: 1,
                    x_coord: 100,
                    y_coord: 300
                }
            ]
        }]).map((signer, index) => {
            const merged = {
                signer_name: signer.signer_name || signer.signerName,
                signer_email: signer.signer_email || signer.signerEmail,
                signer_phone_number: signer.signer_phone_number || signer.signerPhone,
                signer_purpose: signer.signer_purpose || signer.reason || req.body.sign_reason || 'Staymaster Pre Check-In Declaration',
                sign_coordinates: signer.sign_coordinates || req.body.sign_coordinates || [
                    {
                        page_num: 1,
                        x_coord: 100,
                        y_coord: 300
                    }
                ],
            };
            return Object.fromEntries(Object.entries(merged).filter(([, value]) => value !== undefined && value !== null));
        });

        const backendBase = (process.env.BACKEND_URL || 'https://thestaymaster.com').replace(/\/$/, '');
        const esignReturnWithBooking = `${backendBase}/api/ext/zoop/esign/return?bookingId=${encodeURIComponent(String(bookingId))}`;

        const finalData = {
            document: normalizedDocument,
            signers: normalizedSigners,
            txn_expiry_min: txn_expiry_min || '10080',
            send_invite: typeof send_invite === 'boolean' ? send_invite : true,
            signing_type: signing_type || 'PARALLEL',
            white_label: white_label || 'Y',
            // Backend /return accepts Zoop POST → 302 GET to frontend declaration page. Ignore client redirect when bookingId set.
            redirect_url: bookingId
                ? esignReturnWithBooking
                : (redirect_url || req.body.redirect_url || `${backendBase}/api/ext/zoop/esign/return`),
            response_url: response_url || process.env.ZOOP_WEBHOOK_URL || 'https://thestaymaster.com/api/ext/zoop/esign/webhook',
            esign_type: esign_type || 'AADHAAR',
            task_id: bookingId ? String(bookingId) : randomUUID(),
        };
        if (email_template) finalData.email_template = email_template;
        if (metadata) finalData.metadata = metadata;

        console.log('Final Payload being sent to Zoop (data redacted):', JSON.stringify({
            ...finalData,
            document: { ...finalData.document, data: finalData.document.data ? 'BASE64_DATA_PRESENT' : 'MISSING' }
        }, null, 2));

        const result = await zoopService.initEsign(finalData);

        // result = response.data from Zoop, shape: { requests: [{request_id, signer_name, signer_email}], group_id, success, ... }
        const requestId = result.requests?.[0]?.request_id;
        const groupId = result.group_id;

        if (bookingId && (requestId || groupId)) {
            // Critical save — always runs
            await pool.query(
                "UPDATE bookings SET esign_request_id = ?, esign_status = ? WHERE id = ?",
                [groupId || requestId, 'initiated', bookingId]
            );
            // Optional JSON save — silently skipped if columns don't exist yet (run migration first)
            // Also clears stale webhook response from any previous failed attempt
            try {
                await pool.query(
                    "UPDATE bookings SET esign_init_response = ?, esign_webhook_response = NULL WHERE id = ?",
                    [JSON.stringify(result), bookingId]
                );
            } catch (jsonErr) {
                console.warn("esign_init_response column not found — run migration add_esign_response_columns.sql:", jsonErr.message);
            }
        }

        return Response.success(res, result, 201);
    } catch (error) {
        if (error.code === 'ZOOP_CONFIG_MISSING') {
            return Response.error(res, "ZOOP_CONFIG_MISSING", error.message, 503);
        }
        const errorData = error.response ? error.response.data : { message: error.message };
        return Response.error(res, "ZOOP_API_ERROR", errorData, error.response ? error.response.status : 500);
    }
});

/**
 * esignWebhook — Receive and process Zoop eSign signing completion callbacks.
 *
 * Zoop sends a POST to `response_url` after each signing event.
 * Docs: https://dashboard.zoop.one/doc
 *
 * @route  POST /api/ext/zoop/esign/webhook
 * @auth   None (validated via ZOOP_WEBHOOK_SECRET header instead)
 *
 * Webhook payload:
 *   {
 *     "request_id": "esign_abc123",
 *     "status":     "SUCCESS" | "FAILED" | "EXPIRED" | "REJECTED" | "COMPLETED" | "SIGNED",
 *     "data":       { request_id, signer_id, signed_at, ... },
 *     "metadata":   { bookingId, ... }
 *   }
 *
 * Status mapping (Zoop → internal DB):
 *   SUCCESS / COMPLETED / SIGNED  → "success"  (bookings.esign_status, declaration=1)
 *   FAILED / REJECTED / EXPIRED   → "failed"
 *
 * Security:
 *   Set ZOOP_WEBHOOK_SECRET in .env. The handler checks:
 *     req.headers['webhook-security-key'] === ZOOP_WEBHOOK_SECRET
 *   Zoop sends the webhook-security-key header in eSign webhooks.
 *   Always returns HTTP 200 to prevent Zoop from retrying.
 */
const esignWebhook = asyncHandler(async (req, res) => {
    // Verify webhook secret if configured (prevents fake payloads from third parties)
    const webhookSecret = process.env.ZOOP_WEBHOOK_SECRET;
    if (webhookSecret) {
        const receivedSecret =
            req.headers['webhook-security-key'] ||
            req.headers['x-zoop-secret'] ||
            req.headers['x-webhook-secret'] ||
            req.query.secret;

        console.log("🔐 Zoop webhook secret check:", {
            configured: !!webhookSecret,
            receivedSecret: receivedSecret ? 'PRESENT' : 'MISSING',
            headerKeys: {
                'webhook-security-key': req.headers['webhook-security-key'],
                'x-zoop-secret': req.headers['x-zoop-secret'],
                'x-webhook-secret': req.headers['x-webhook-secret'],
            }
        });

        if (receivedSecret !== webhookSecret) {
            console.error("❌ Webhook rejected: invalid secret");
            // Return 200 so Zoop does not keep retrying, but do not process
            return res.status(200).send("INVALID_SECRET");
        }
    } else {
        console.warn("⚠️ No ZOOP_WEBHOOK_SECRET configured; webhook signature validation skipped");
    }

    const payload = req.body;

    const request_id = payload.request_id || payload.data?.request_id;
    const group_id   = payload.group_id   || payload.data?.group_id;
    const status = payload.status || payload.data?.status;

    if (!request_id && !group_id) {
        console.error("❌ Webhook Error: No request_id or group_id found in payload");
        return res.status(200).send("No request_id or group_id found");
    }

    try {
        // Determine whether the Zoop webhook indicates success.
        // Zoop eSign webhooks use `success: true/false` in the payload.
        const isSuccess = payload.success === true || payload.data?.success === true;
        const statusText = status || (payload.success === true ? 'SUCCESS' : (payload.success === false ? 'FAILED' : undefined));
        const dbStatus = isSuccess ? 'success' : (statusText?.toLowerCase() || 'failed');

        // First try matching on request_id (most common case for single-signer flows)
        let [updateResult] = await pool.query(
            "UPDATE bookings SET esign_status = ?, declaration = ? WHERE esign_request_id = ?",
            [dbStatus, isSuccess ? 1 : 0, request_id]
        );

        // Fallback: if request_id didn't match, try group_id (used when initEsign stored group_id)
        if (updateResult.affectedRows === 0 && group_id && group_id !== request_id) {
            [updateResult] = await pool.query(
                "UPDATE bookings SET esign_status = ?, declaration = ? WHERE esign_request_id = ?",
                [dbStatus, isSuccess ? 1 : 0, group_id]
            );
        }

        // Optional JSON save — silently skipped if column doesn't exist yet (run migration first)
        try {
            const webhookJson = JSON.stringify(payload);
            const matchId = updateResult.affectedRows > 0
                ? (request_id || group_id)
                : null;
            if (matchId) {
                await pool.query(
                    "UPDATE bookings SET esign_webhook_response = ? WHERE esign_request_id = ?",
                    [webhookJson, matchId]
                );
            }
        } catch (jsonErr) {
            console.warn("esign_webhook_response column not found — run migration add_esign_response_columns.sql:", jsonErr.message);
        }

        if (updateResult.affectedRows === 0) {
            console.warn(`⚠️ Webhook: No booking found with esign_request_id matching request_id=${request_id} or group_id=${group_id}`);
        } else {
            // If success, also update the declaration flag in guest_details table for the same booking
            if (isSuccess) {
                try {
                    // Try request_id first, then group_id as fallback (mirrors the UPDATE logic above)
                    let bookingRows;
                    [bookingRows] = await pool.query("SELECT id FROM bookings WHERE esign_request_id = ?", [request_id]);
                    if ((!bookingRows || bookingRows.length === 0) && group_id && group_id !== request_id) {
                        [bookingRows] = await pool.query("SELECT id FROM bookings WHERE esign_request_id = ?", [group_id]);
                    }
                    if (bookingRows && bookingRows.length > 0) {
                        const bookingId = bookingRows[0].id;
                        await pool.query("UPDATE guest_details SET declaration = 1 WHERE booking_id = ?", [bookingId]);
                    }
                } catch (syncErr) {
                    console.error("❌ Webhook Sync Error (guest_details):", syncErr);
                }
            }
        }

        return res.status(200).send("OK");
    } catch (error) {
        console.error("❌ Webhook Handling Error:", error);
        // Still return 200 to Zoop so they stop retrying a broken payload, 
        // but log the internal failure.
        return res.status(200).send("INTERNAL_ERROR_LOGGED");
    }
});

/**
 * verifyDL — Verify a Driving License via Zoop Identity API.
 *
 * Zoop endpoint: POST https://live.zoop.one/api/v1/in/identity/dl/advance
 *
 * @route  POST /api/ext/zoop/verifyDL
 * @body   { dl_number: string, dob: string (DD-MM-YYYY), name?: string }
 */
const verifyDL = asyncHandler(async (req, res) => {
    const { dl_number, dob, name } = req.body;

    if (!dl_number || !dob) {
        return Response.error(res, "ERROR", "DL number and date of birth are required", 400);
    }

    try {
        const result = await zoopService.verifyDrivingLicense(dl_number, dob, name || '');
        return Response.success(res, result, 200);
    } catch (error) {
        if (error.code === 'ZOOP_CONFIG_MISSING') {
            return Response.error(res, "ZOOP_CONFIG_MISSING", error.message, 503);
        }
        const errorData = error.response ? error.response.data : { message: error.message };
        return Response.error(res, "ZOOP_API_ERROR", errorData, error.response ? error.response.status : 500);
    }
});

/**
 * esignReturn — Zoop POST/GET to redirect_url after signing.
 * Returns a tiny HTML page (no 302 to the SPA) so Zoop never mangles a pre-checkin URL.
 * The page postMessages the opener, then window.close() — the declaration tab reloads (see prcheckin).
 *
 * @route  POST /api/ext/zoop/esign/return
 * @route  GET  /api/ext/zoop/esign/return
 */
const ZOOP_ESIGN_POSTMESSAGE_TYPE = 'staymaster:zoop-esign';

const esignReturn = asyncHandler(async (req, res) => {
    const b = req.body || {};
    const bookingId = req.query.bookingId || b.task_id || b.bookingId || b.metadata?.bookingId;
    const zoopStatus = (b.status || b.data?.status || b.signing_status || req.query?.status || '')
        .toString()
        .toUpperCase();
    const boolSuccess = b.success === true || b.data?.success === true;
    const boolFailure = b.success === false || b.data?.success === false;
    const statusSuccess =
        zoopStatus === 'SUCCESS' ||
        zoopStatus === 'COMPLETED' ||
        zoopStatus === 'SIGNED';
    const statusFailure =
        zoopStatus === 'FAILED' ||
        zoopStatus === 'REJECTED' ||
        zoopStatus === 'EXPIRED' ||
        zoopStatus === 'CANCELLED' ||
        zoopStatus === 'DECLINED';
    const action = statusFailure && !statusSuccess
        ? 'esign-failed'
        : (statusSuccess || boolSuccess
            ? 'esign-success'
            : (boolFailure ? 'esign-failed' : (zoopStatus ? 'esign-failed' : 'esign-success')));

    console.log(`🔀 Zoop eSign return: bookingId=${bookingId} status=${zoopStatus} → action=${action}`);
    console.log('Zoop return payload:', JSON.stringify({ query: req.query, body: req.body }, null, 2));

    const frontendBase = (process.env.FRONTEND_ESIGN_REDIRECT || 'https://guest.staymaster.in').replace(
        /\/$/,
        ''
    );
    let precheckinOrigin;
    try {
        precheckinOrigin = new URL(frontendBase.startsWith('http') ? frontendBase : `https://${frontendBase}`).origin;
    } catch {
        precheckinOrigin = 'https://guest.staymaster.in';
    }

    const messagePayload = {
        type: ZOOP_ESIGN_POSTMESSAGE_TYPE,
        action,
        bookingId: bookingId != null ? String(bookingId) : null,
    };
    const payloadJson = JSON.stringify(messagePayload);
    const targetJson = JSON.stringify(precheckinOrigin);

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>eSign</title></head>
<body>
<script>
(function () {
  var p = ${payloadJson};
  var target = ${targetJson};
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(p, target);
    }
  } catch (e) {}
  window.close();
  setTimeout(function () {
    document.body.innerHTML = "<p style=\\"font-family:system-ui;padding:1.2rem;max-width:28rem\\">" +
      "You can close this tab and return to the declaration step." + "</p>";
  }, 300);
})();
</script>
</body>
</html>`;

    return res.status(200).set('Content-Type', 'text/html; charset=utf-8').send(html);
});

module.exports = {
    verifyPAN,
    generateAadhaarOTP,
    verifyAadhaarOTP,
    verifyGST,
    verifyDL,
    initEsign,
    esignWebhook,
    esignReturn
};
