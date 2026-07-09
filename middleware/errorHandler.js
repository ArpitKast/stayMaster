const multer = require("multer");
const constants = require("../config/constants");
const { HTTP_STATUS, ERROR_MESSAGES } = constants;

const PROPERTY_IMAGE_MAX_MB = 20;

/**
 * Custom API Error class for consistent error handling
 */
class ApiError extends Error {
    constructor(statusCode, message, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.success = false;
        Error.captureStackTrace(this, this.constructor);
    }

    static badRequest(message = ERROR_MESSAGES.VALIDATION_ERROR) {
        return new ApiError(HTTP_STATUS.BAD_REQUEST, message);
    }

    static unauthorized(message = ERROR_MESSAGES.UNAUTHORIZED) {
        return new ApiError(HTTP_STATUS.UNAUTHORIZED, message);
    }

    static forbidden(message = ERROR_MESSAGES.FORBIDDEN) {
        return new ApiError(HTTP_STATUS.FORBIDDEN, message);
    }

    static notFound(message = ERROR_MESSAGES.NOT_FOUND) {
        return new ApiError(HTTP_STATUS.NOT_FOUND, message);
    }

    static internal(message = ERROR_MESSAGES.INTERNAL_ERROR) {
        return new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, message, false);
    }
}

/**
 * Async handler wrapper to catch errors in async route handlers
 * Usage: router.get('/path', asyncHandler(async (req, res) => { ... }))
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Standard success response helper
 */
const sendSuccess = (res, data = null, message = 'Success', statusCode = HTTP_STATUS.OK) => {
    const response = {
        success: true,
        data: data
    };
    return res.status(statusCode).json(response);
};

/**
 * Standard error response helper
 */
const sendError = (res, message, statusCode = HTTP_STATUS.BAD_REQUEST, error = null) => {
    const response = {
        success: false,
        error: message
    };
    if (process.env.NODE_ENV === 'development' && error) {
        response.stack = error.stack;
    }
    return res.status(statusCode).json(response);
};

/**
 * Central error handling middleware
 * Must be registered after all routes
 */
const errorHandler = (err, req, res, next) => {
    // Log error for debugging
    console.error('Error:', {
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        path: req.path,
        method: req.method
    });

    // If response already sent, delegate to default Express error handler
    if (res.headersSent) {
        return next(err);
    }

    // Handle ApiError instances
    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
            success: false,
            error: err.message
        });
    }

    // Handle validation errors (e.g., from express-validator)
    if (err.name === 'ValidationError') {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            error: ERROR_MESSAGES.VALIDATION_ERROR
        });
    }

    // Handle JWT errors
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            success: false,
            error: ERROR_MESSAGES.UNAUTHORIZED
        });
    }

    // Multer upload limits (e.g. property replace-image)
    if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(413).json({
                success: false,
                error: `File is too large. Maximum size is ${PROPERTY_IMAGE_MAX_MB}MB.`,
                code: "PAYLOAD_TOO_LARGE"
            });
        }
        if (err.code === "LIMIT_FIELD_VALUE" || err.code === "LIMIT_FIELD_COUNT") {
            return res.status(413).json({
                success: false,
                error: "Upload exceeds allowed size or field limits.",
                code: "PAYLOAD_TOO_LARGE"
            });
        }
    }

    // Handle MySQL/Database errors
    if (err.code && err.code.startsWith('ER_')) {
        console.error('Database error:', err.code, err.message);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: ERROR_MESSAGES.INTERNAL_ERROR
        });
    }

    // Default error handling
    const statusCode = err.statusCode || res.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
    
    // If status code is already set (like 401), use the error message
    let message = ERROR_MESSAGES.INTERNAL_ERROR;
    if (res.statusCode === 401 || statusCode === 401) {
        message = err.message || ERROR_MESSAGES.UNAUTHORIZED;
    } else if (err.message && (err.isOperational || statusCode < 500)) {
        message = err.message;
    } else if (err.message) {
        // For 500 errors, still show message in development
        message = process.env.NODE_ENV === 'development' ? err.message : ERROR_MESSAGES.INTERNAL_ERROR;
    }

    return res.status(statusCode).json({
        success: false,
        error: message,
        code: statusCode === 401 ? 'UNAUTHORIZED' : 'ERROR'
    });
};

module.exports = {
    errorHandler,
    asyncHandler,
    ApiError,
    sendSuccess,
    sendError
};
