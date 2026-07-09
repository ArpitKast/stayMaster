/**
 * Input validation rules for API endpoints using express-validator
 */
const { body, param, validationResult } = require('express-validator');

/**
 * Middleware to check for validation errors and return 400 if any
 */
const validate = (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.error('Validation errors:', errors.array());
            // Log only the field names present, never the values (may contain passwords/OTPs/PII)
            if (req.body && process.env.NODE_ENV !== 'production') {
                console.error('Request fields present:', Object.keys(req.body));
            }
            return res.status(400).json({
                success: false,
                error: errors.array().map(e => e.msg).join(', '),
                code: 'VALIDATION_ERROR',
                details: errors.array()
            });
        }
        next();
    } catch (error) {
        console.error('Error in validation middleware:', error);
        return res.status(500).json({
            success: false,
            error: 'Validation middleware error',
            code: 'ERROR'
        });
    }
};

/**
 * Booking creation validation
 */
const createBookingRules = [
    body('property_id').notEmpty().withMessage('Property ID is required').isInt().withMessage('Property ID must be a number'),
    body('check_in_date').notEmpty().withMessage('Check-in date is required').isISO8601().withMessage('Invalid check-in date format'),
    body('check_out_date').notEmpty().withMessage('Check-out date is required').isISO8601().withMessage('Invalid check-out date format'),
    body('number_adults')
        .notEmpty().withMessage('Adult count is required')
        .isInt({ min: 1 }).withMessage('Adults must be a positive integer')
        .toInt(),
    body('number_children')
        .optional({ nullable: true })
        .isInt({ min: 0 }).withMessage('Children must be zero or a positive integer')
        .toInt(),
    validate
];

/**
 * OTP generation validation
 */
const generateOTPRules = [
    body('phone')
        .optional()
        .trim()
        .custom((value, { req }) => {
            // At least one of phone or email must be provided
            if (!value && !req.body.email) {
                throw new Error('Phone number or email is required');
            }
            return true;
        }),
    body('email')
        .optional()
        .trim()
        .isEmail()
        .withMessage('Invalid email format')
        .normalizeEmail(),
    body('email')
        .optional()
        .isEmail()
        .withMessage('Invalid email format'),
    body()
        .custom((value, { req }) => {
            if (!req.body.phone && !req.body.email) {
                throw new Error('Phone number or email is required');
            }
            return true;
        }),
    validate
];

/**
 * Login with OTP validation
 */
const loginWithOTPRules = [
    body('phone').notEmpty().withMessage('Phone number is required'),
    body('otp').notEmpty().withMessage('OTP is required')
        .isLength({ min: 4, max: 6 }).withMessage('OTP must be 4-6 digits'),
    validate
];

/**
 * Contact form submission validation
 */
const submitFormRules = [
    body('form_type').notEmpty().withMessage('Form type is required')
        .isIn(['get_in_touch', 'contact_us', 'host_page_form', 'newsletter']).withMessage('Invalid form type'),
    body('name')
        .if((value, { req }) => req.body.form_type !== 'newsletter')
        .notEmpty().withMessage('Name is required')
        .trim()
        .isLength({ max: 100 }).withMessage('Name must be under 100 characters'),
    body('email').notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail(),
    body('phone')
        .if((value, { req }) => req.body.form_type !== 'newsletter')
        .notEmpty().withMessage('Phone is required'),
    body('property_type')
        .optional()
        .custom((value, { req }) => {
            // Property type is required for get_in_touch and host_page_form
            if ((req.body.form_type === 'get_in_touch' || req.body.form_type === 'host_page_form') && !value) {
                throw new Error('Property type is required for this form type');
            }
            return true;
        }),
    body('comment')
        .optional()
        .custom((value, { req }) => {
            // Comment is required for contact_us
            if (req.body.form_type === 'contact_us' && !value) {
                throw new Error('Comment is required for contact us form');
            }
            return true;
        }),
    validate
];

/**
 * Host enquiry validation
 */
const hostEnquiryRules = [
    body('location').notEmpty().withMessage('Location is required'),
    body('property_type').notEmpty().withMessage('Property type is required'),
    body('bedrooms').notEmpty().withMessage('Bedrooms count is required'),
    body('pool_type').notEmpty().withMessage('Pool type is required'),
    body('name').notEmpty().withMessage('Name is required').trim(),
    body('email').notEmpty().withMessage('Email is required').isEmail().withMessage('Invalid email'),
    body('otp').notEmpty().withMessage('OTP is required'),
    validate
];

/**
 * Profile update validation
 */
const updateProfileRules = [
    body('firstname').optional().trim().isLength({ max: 50 }).withMessage('First name must be under 50 characters'),
    body('lastname').optional().trim().isLength({ max: 50 }).withMessage('Last name must be under 50 characters'),
    body('email').optional().isEmail().withMessage('Invalid email format').normalizeEmail(),
    validate
];

/**
 * Property creation validation
 */
const createPropertyRules = [
    body('name').optional().trim().isLength({ max: 200 }).withMessage('Property name must be under 200 characters'),
    validate
];

/**
 * Collection CRUD validation
 */
const createCollectionRules = [
    body('name').notEmpty().withMessage('Collection name is required').trim(),
    validate
];

/**
 * Destination CRUD validation
 */
const createDestinationRules = [
    body('name').notEmpty().withMessage('Destination name is required').trim(),
    validate
];

/**
 * Blog CRUD validation
 */
const createBlogRules = [
    body('title').notEmpty().withMessage('Blog title is required').trim(),
    validate
];

/**
 * ID parameter validation
 */
const idParamRules = [
    param('id').isInt({ min: 1 }).withMessage('Invalid ID parameter'),
    validate
];

module.exports = {
    validate,
    createBookingRules,
    generateOTPRules,
    loginWithOTPRules,
    submitFormRules,
    hostEnquiryRules,
    updateProfileRules,
    createPropertyRules,
    createCollectionRules,
    createDestinationRules,
    createBlogRules,
    idParamRules
};
