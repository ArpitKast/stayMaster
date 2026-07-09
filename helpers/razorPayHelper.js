const axios = require('axios');
const crypto = require('crypto');

class RazorPayHelper {
    constructor() {
        this.key = process.env.RAZORPAY_KEY;
        this.secret = process.env.RAZORPAY_SECRET;
        this.baseUrl = process.env.RAZORPAY_BASE_URL || 'https://api.razorpay.com/v1';
    }

    async getOrderId(amount, currency, options = {}) {
        if (!this.key || !this.secret) {
            throw new Error('Razorpay credentials missing. Please configure RAZORPAY_KEY and RAZORPAY_SECRET.');
        }

        const payload = {
            amount,
            currency,
            receipt: options.receipt || `staymaster_${Date.now()}`,
            notes: options.notes || {}
        };

        try {
            const response = await axios.post(
                `${this.baseUrl}/orders`,
                payload,
                {
                    auth: {
                        username: this.key,
                        password: this.secret
                    }
                }
            );

            return response.data;
        } catch (error) {
            const message = error?.response?.data || error.message || 'Failed to create Razorpay order';
            throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
        }
    }

    verifySignature(orderId, paymentId, signature) {
        if (!this.secret) {
            console.error('RAZORPAY_SECRET is missing for signature verification');
            return false;
        }
        
        const generatedSignature = crypto
            .createHmac('sha256', this.secret)
            .update(orderId + "|" + paymentId)
            .digest('hex');

        return generatedSignature === signature;
    }
}

module.exports = RazorPayHelper;
