const asyncHandler = require("express-async-handler");

// HTTP status code to message mapping
const getStatusMessage = (statusCode, resStatusMessage) => {
    const statusMessages = {
        200: 'OK',
        201: 'Created',
        202: 'Accepted',
        204: 'No Content',
        400: 'Bad Request',
        401: 'Unauthorized',
        403: 'Forbidden',
        404: 'Not Found',
        409: 'Conflict',
        422: 'Unprocessable Entity',
        500: 'Internal Server Error',
        502: 'Bad Gateway',
        503: 'Service Unavailable',
        504: 'Gateway Timeout'
    };
    return statusMessages[statusCode] || resStatusMessage || 'Unknown';
};

const SENSITIVE_KEYS = new Set(['password', 'token', 'otp', 'apikey', 'authcode', 'secret', 'access_token', 'refresh_token']);

function sanitizeBody(body) {
    if (!body || typeof body !== 'object') return body;
    return Object.fromEntries(
        Object.entries(body).map(([k, v]) => [k, SENSITIVE_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : v])
    );
}

const logActivity = asyncHandler(async (req, res, next) => {
    // Skip detailed logging in production — full response-body parsing on every request
    // is a major CPU and GC overhead. Only log method + url + status + duration.
    if (process.env.NODE_ENV === 'production') {
        const startTime = Date.now();
        const originalEnd = res.end;
        res.end = function(chunk, encoding) {
            const duration = Date.now() - startTime;
            console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms [${req.ip}]`);
            originalEnd.call(this, chunk, encoding);
        };
        return next();
    }

    const startTime = Date.now();

    console.log(`\n--> ${req.method} ${req.originalUrl}`, {
        ip: req.ip,
        auth: req.get('authorization') ? 'Bearer [HIDDEN]' : 'None',
        body: req.body && Object.keys(req.body).length > 0 ? sanitizeBody(req.body) : undefined,
    });

    const originalEnd = res.end;
    res.end = function(chunk, encoding) {
        const duration = Date.now() - startTime;
        const statusCode = res.statusCode || 200;
        console.log(`<-- ${statusCode} ${req.method} ${req.originalUrl} (${duration}ms)`);
        originalEnd.call(this, chunk, encoding);
    };

    next();
});

module.exports = logActivity;