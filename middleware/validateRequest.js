'use strict';
/**
 * Request Validation Middleware
 * Provides input validation for POST/PUT endpoints
 * Does NOT change API response format - only adds validation layer
 */
const constants = require('../config/constants');

/**
 * Validate required fields exist and are not empty
 * @param {Array} requiredFields - Array of field names that are required
 * @returns {Function} - Express middleware function
 */
const validateRequired = (requiredFields) => {
    return (req, res, next) => {
        const missingFields = [];

        for (const field of requiredFields) {
            const value = req.body[field];
            if (value === undefined || value === null || value === '') {
                missingFields.push(field);
            }
        }

        if (missingFields.length > 0) {
            return res.status(constants.HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: constants.ERROR_MESSAGES.MISSING_PARAMS,
                missingFields: missingFields
            });
        }

        next();
    };
};

/**
 * Validate email format
 * @param {string} fieldName - Name of the field containing email
 * @returns {Function} - Express middleware function
 */
const validateEmail = (fieldName = 'email') => {
    return (req, res, next) => {
        const email = req.body[fieldName];

        if (email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(constants.HTTP_STATUS.BAD_REQUEST).json({
                    success: false,
                    error: 'Invalid email format'
                });
            }
        }

        next();
    };
};

/**
 * Validate phone number format
 * @param {string} fieldName - Name of the field containing phone
 * @returns {Function} - Express middleware function
 */
const validatePhone = (fieldName = 'phone') => {
    return (req, res, next) => {
        const phone = req.body[fieldName];

        if (phone) {
            // Allow digits, optional + prefix, min 10 digits
            const phoneRegex = /^\+?[\d]{10,15}$/;
            const cleanPhone = phone.replace(/[\s-]/g, '');
            if (!phoneRegex.test(cleanPhone)) {
                return res.status(constants.HTTP_STATUS.BAD_REQUEST).json({
                    success: false,
                    error: 'Invalid phone number format'
                });
            }
        }

        next();
    };
};

/**
 * Validate numeric fields
 * @param {Array} numericFields - Array of field names that should be numeric
 * @returns {Function} - Express middleware function
 */
const validateNumeric = (numericFields) => {
    return (req, res, next) => {
        const invalidFields = [];

        for (const field of numericFields) {
            const value = req.body[field];
            if (value !== undefined && value !== null && value !== '') {
                if (isNaN(Number(value))) {
                    invalidFields.push(field);
                }
            }
        }

        if (invalidFields.length > 0) {
            return res.status(constants.HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: `Fields must be numeric: ${invalidFields.join(', ')}`
            });
        }

        next();
    };
};

/**
 * Validate date format (YYYY-MM-DD)
 * @param {Array} dateFields - Array of field names that should be dates
 * @returns {Function} - Express middleware function
 */
const validateDate = (dateFields) => {
    return (req, res, next) => {
        const invalidFields = [];
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

        for (const field of dateFields) {
            const value = req.body[field];
            if (value !== undefined && value !== null && value !== '') {
                if (!dateRegex.test(value) || isNaN(Date.parse(value))) {
                    invalidFields.push(field);
                }
            }
        }

        if (invalidFields.length > 0) {
            return res.status(constants.HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: `Invalid date format for: ${invalidFields.join(', ')}. Use YYYY-MM-DD`
            });
        }

        next();
    };
};

/**
 * Validate string length
 * @param {Object} fieldLimits - Object mapping field names to { min, max } limits
 * @returns {Function} - Express middleware function
 */
const validateLength = (fieldLimits) => {
    return (req, res, next) => {
        const invalidFields = [];

        for (const [field, limits] of Object.entries(fieldLimits)) {
            const value = req.body[field];
            if (value !== undefined && value !== null) {
                const strValue = String(value);
                if (limits.min && strValue.length < limits.min) {
                    invalidFields.push(`${field} (min ${limits.min} characters)`);
                }
                if (limits.max && strValue.length > limits.max) {
                    invalidFields.push(`${field} (max ${limits.max} characters)`);
                }
            }
        }

        if (invalidFields.length > 0) {
            return res.status(constants.HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: `Invalid field length: ${invalidFields.join(', ')}`
            });
        }

        next();
    };
};

/**
 * Sanitize input - trim strings and remove dangerous characters
 * @returns {Function} - Express middleware function
 */
const sanitizeInput = () => {
    return (req, res, next) => {
        if (req.body && typeof req.body === 'object') {
            for (const [key, value] of Object.entries(req.body)) {
                if (typeof value === 'string') {
                    // Trim whitespace
                    req.body[key] = value.trim();
                }
            }
        }
        next();
    };
};

/**
 * Combine multiple validators
 * @param  {...Function} validators - Validator middleware functions
 * @returns {Array} - Array of middleware functions
 */
const validate = (...validators) => {
    return validators;
};

module.exports = {
    validateRequired,
    validateEmail,
    validatePhone,
    validateNumeric,
    validateDate,
    validateLength,
    sanitizeInput,
    validate
};
