'use strict';

const path = require('path');

let admin = null;
let messaging = null;

// Try to initialize firebase-admin if available
try {
    admin = require('firebase-admin');
    
    // Initialize Firebase Admin if not already initialized
    if (!admin.apps.length) {
        // Option 1: Use service account JSON file path
        if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
            // Resolve path relative to project root
            const serviceAccountPath = path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
            const serviceAccount = require(serviceAccountPath);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log('Firebase Admin initialized with service account:', serviceAccountPath);
        }
        // Option 2: Use service account JSON from environment variable
        else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        }
        // Option 3: Use project ID (for default credentials, e.g., on Google Cloud)
        else if (process.env.FIREBASE_PROJECT_ID) {
            admin.initializeApp({
                projectId: process.env.FIREBASE_PROJECT_ID
            });
        }
        // Option 4: Fallback - will use default credentials if available
        else {
            try {
                admin.initializeApp();
            } catch (err) {
                console.warn('Firebase Admin not initialized. Will use HTTP API fallback.');
            }
        }
    }
    
    if (admin.apps.length > 0) {
        messaging = admin.messaging();
    }
} catch (error) {
    console.warn('firebase-admin not available, will use HTTP API fallback:', error.message);
}

const fetch = (...args) => import('node-fetch').then(({ default: fetchFn }) => fetchFn(...args));

/**
 * FCM sender using Firebase Admin SDK (preferred) or HTTP API fallback.
 * 
 * For Firebase Admin SDK, set one of:
 * - FIREBASE_SERVICE_ACCOUNT_PATH: Path to service account JSON file
 * - FIREBASE_SERVICE_ACCOUNT: JSON string of service account
 * - FIREBASE_PROJECT_ID: Project ID (uses default credentials)
 * 
 * For HTTP API fallback, set:
 * - FCM_SERVER_KEY: Legacy server key
 */
class PushNotificationHelper {
    constructor(serverKey = process.env.FCM_SERVER_KEY) {
        this.serverKey = serverKey;
        this.fcmUrl = 'https://fcm.googleapis.com/fcm/send';
        this.useAdmin = messaging !== null;
    }

    async sendToTokens({ tokens = [], title = '', body = '', data = {} }) {
        if (!Array.isArray(tokens) || tokens.length === 0) {
            return { skipped: true, message: 'No device tokens to send' };
        }

        // Use Firebase Admin SDK if available
        if (this.useAdmin && messaging) {
            return await this.sendWithAdmin({ tokens, title, body, data });
        }

        // Fallback to HTTP API
        return await this.sendWithHttpApi({ tokens, title, body, data });
    }

    async sendWithAdmin({ tokens, title, body, data }) {
        try {
            const message = {
                notification: {
                    title: title,
                    body: body,
                },
                data: this.stringifyData(data),
                tokens: tokens, // Array of device tokens
            };

            const response = await messaging.sendEachForMulticast(message);
            
            // Format response to match HTTP API format
            const results = {
                success: response.successCount,
                failure: response.failureCount,
                responses: response.responses.map((resp, idx) => ({
                    success: resp.success,
                    error: resp.error ? resp.error.message : null,
                    token: tokens[idx]
                }))
            };

            return {
                multicast_id: response.successCount > 0 ? 'admin-sdk' : null,
                success: response.successCount,
                failure: response.failureCount,
                canonical_ids: 0,
                results: results.responses
            };
        } catch (error) {
            console.error('Firebase Admin SDK error:', error);
            throw error;
        }
    }

    async sendWithHttpApi({ tokens, title, body, data }) {
        if (!this.serverKey) {
            throw new Error('FCM_SERVER_KEY is not configured and Firebase Admin is not available');
        }

        const payload = {
            registration_ids: tokens,
            notification: { title, body },
            data: this.stringifyData(data),
            priority: 'high',
        };

        const response = await fetch(this.fcmUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `key=${this.serverKey}`,
            },
            body: JSON.stringify(payload),
        });

        const json = await response.json().catch(() => ({}));
        if (!response.ok) {
            const message = json?.error || `FCM request failed with ${response.status}`;
            const err = new Error(message);
            err.response = json;
            throw err;
        }
        return json;
    }

    // Convert data object values to strings (FCM requirement)
    stringifyData(data) {
        const stringified = {};
        for (const [key, value] of Object.entries(data)) {
            stringified[key] = typeof value === 'string' ? value : JSON.stringify(value);
        }
        return stringified;
    }
}

module.exports = PushNotificationHelper;
