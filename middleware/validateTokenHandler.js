const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");
const Response = require("../helpers/responseHelper");
const db = require('../config/dbConnection');

const validateToken = asyncHandler( async (req, res, next) => {
    let token;
    let authHeader = req.headers.Authorization || req.headers.authorization;

    // Check Authorization header first
    if (authHeader && authHeader.startsWith("Bearer")) {
        token = authHeader.split(" ")[1];
    }

    // Fallback to guesttoken header or body — NOT query string (tokens in URLs leak into logs)
    if (!token) {
        token = req.headers.guesttoken || req.body.guestToken;
    }

    if (!token) {
        return Response.error(res, "ERROR", "User is not authorized or access token is missing.", 401);
    }

    try {
        const decode = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        const userPayload = decode.user || decode;

        // Check if token was issued before the user's last logout (token invalidation)
        if (userPayload.id) {
            try {
                const userRows = await db.query('SELECT token_invalid_after FROM users WHERE id = ?', [userPayload.id]);
                const userData = userRows[0] && userRows[0][0];
                if (userData && userData.token_invalid_after && decode.iat < Number(userData.token_invalid_after)) {
                    return Response.error(res, "ERROR", "Session expired. Please login again.", 401);
                }
            } catch (dbErr) {
                // Fail closed on DB error — a broken revocation check should not allow access
                console.error('Token revocation check FAILED — rejecting token for safety:', dbErr.message);
                return Response.error(res, "ERROR", "Authentication service temporarily unavailable.", 503);
            }
        }

        req.user = userPayload;
        req.guest = userPayload;
        req.guestToken = token;
        next();
    } catch (err) {
        console.error("Token verification failed:", err.message);
        return Response.error(res, "ERROR", "User is not authorized.", 401);
    }
});

/*async checkGuestLogin(){

}*/

// Optional token validation - proceeds even if token is missing or invalid
const optionalToken = asyncHandler(async (req, res, next) => {
    let token;
    let authHeader = req.headers.authorization || req.headers.Authorization;
    if (authHeader && authHeader.startsWith("Bearer")) {
        token = authHeader.split(" ")[1];
        try {
            const decode = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
            req.user = decode.user || decode;  
            req.guest = decode.user || decode; 
        } catch (err) {
            // Token invalid, but continue without it
        }
    }

    if (!req.user && req.body.guestToken) {
        try {
            const decode = jwt.verify(req.body.guestToken, process.env.ACCESS_TOKEN_SECRET);
            req.user = decode.user || decode;
            req.guest = decode.user || decode;
            req.guestToken = req.body.guestToken;
        } catch (err) {
            // Token invalid, but continue without it
        }
    }

    // GET / UserbookingById: guest token may only be on query or guesttoken header (no body)
    if (!req.user) {
        const qToken = req.query.guestToken || req.headers.guesttoken;
        if (qToken) {
            try {
                const decode = jwt.verify(qToken, process.env.ACCESS_TOKEN_SECRET);
                req.user = decode.user || decode;
                req.guest = decode.user || decode;
                req.guestToken = qToken;
            } catch (err) {
                // Token invalid, but continue without it
            }
        }
    }
    return next();
});

/**
 * Same as validateToken, plus admin panel `authcookie` (JWT in cookie).
 * Admin EJS pages call /api/properties/* with fetch() and no Bearer header; cookies are sent same-origin.
 */
const validateTokenOrCookie = asyncHandler(async (req, res, next) => {
    let token;
    const authHeader = req.headers.Authorization || req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer")) {
        token = authHeader.split(" ")[1];
    }

    // Fallback to guesttoken header or body — NOT query string (tokens in URLs appear in logs)
    if (!token) {
        token = req.headers.guesttoken || req.body?.guestToken;
    }

    if (!token && req.cookies && req.cookies.authcookie) {
        token = req.cookies.authcookie;
    }

    if (!token) {
        return Response.error(res, "ERROR", "User is not authorized or access token is missing.", 401);
    }

    try {
        const decode = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        const userPayload = decode.user || decode;

        if (userPayload.id) {
            try {
                const userRows = await db.query('SELECT token_invalid_after FROM users WHERE id = ?', [userPayload.id]);
                const userData = userRows[0] && userRows[0][0];
                if (userData && userData.token_invalid_after && decode.iat < Number(userData.token_invalid_after)) {
                    return Response.error(res, "ERROR", "Session expired. Please login again.", 401);
                }
            } catch (dbErr) {
                console.error('Token revocation check FAILED (validateTokenOrCookie) — rejecting token for safety:', dbErr.message);
                return Response.error(res, "ERROR", "Authentication service temporarily unavailable.", 503);
            }
        }

        req.user = userPayload;
        req.guest = userPayload;
        req.guestToken = token;
        next();
    } catch (err) {
        console.error("Token verification failed:", err.message);
        return Response.error(res, "ERROR", "User is not authorized.", 401);
    }
});

module.exports = validateToken;
module.exports.optionalToken = optionalToken;
module.exports.validateTokenOrCookie = validateTokenOrCookie;
