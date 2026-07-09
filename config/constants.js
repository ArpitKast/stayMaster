const constants = {
    /** HTTP Status Codes */
    HTTP_STATUS: {
        OK: 200,
        CREATED: 201,
        BAD_REQUEST: 400,
        UNAUTHORIZED: 401,
        FORBIDDEN: 403,
        NOT_FOUND: 404,
        INTERNAL_SERVER_ERROR: 500
    },

    /** User roles */
    ROLE_HOST: 267,
    ROLE_GUEST: 268,
    ROLE_ADMIN: 269,
    ROLE_STAFF: 270,
    ROLE_MANAGER: 271,
    ROLE_API_USER: 272,

    /** OTP expiry times in minutes */
    OTP_EXPIRY: {
        RESET_PASSWORD: 5,
        HOST: 60,
        GUEST: 60
    },

    /** Booking status codes */
    BOOKING_STATUS: {
        PENDING: 1,
        CONFIRMED: 2,
        CANCELLED: 3,
        COMPLETED: 4,
        NO_SHOW: 5
    },

    /** Service request status codes */
    SERVICE_REQUEST_STATUS: {
        OPEN: 1,
        IN_PROGRESS: 2,
        RESOLVED: 3,
        CLOSED: 4
    },

    /** Property status codes */
    PROPERTY_STATUS: {
        DRAFT: 0,
        ACTIVE: 1,
        INACTIVE: 2,
        ARCHIVED: 3
    },

    /** Booking transfer fallbacks */
    BOOKING_FALLBACKS: {
        DEFAULT_PROPERTY_ID: parseInt(process.env.DEFAULT_PROPERTY_ID || '0', 10)
    },

    /** Pagination defaults */
    PAGINATION: {
        DEFAULT_PAGE: 1,
        DEFAULT_LIMIT: 20,
        MAX_LIMIT: 100
    },

    /** Cache TTL in seconds */
    CACHE_TTL: {
        SETTINGS: 300,      // 5 minutes
        PROPERTIES: 60,     // 1 minute
        DESTINATIONS: 3600  // 1 hour
    },

    /** Standard error messages */
    ERROR_MESSAGES: {
        VALIDATION_ERROR: 'Validation failed',
        UNAUTHORIZED: 'Unauthorized access',
        FORBIDDEN: 'Access forbidden',
        NOT_FOUND: 'Resource not found',
        INTERNAL_ERROR: 'Internal server error',
        MISSING_PARAMS: 'Mandatory parameters missing or incorrect',
        INVALID_OTP: 'Invalid or expired OTP',
        USER_NOT_FOUND: 'User not found',
        PROPERTY_NOT_FOUND: 'Property not found',
        BOOKING_NOT_FOUND: 'Booking not found'
    }
};

module.exports = constants;