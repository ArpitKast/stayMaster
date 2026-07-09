const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");
const Response = require("../helpers/responseHelper");
const constants = require("../config/constants");

/**
 * Middleware: validates a manager JWT token.
 * Expects Bearer token in Authorization header or managerToken in body/query.
 * Attaches decoded payload to req.manager.
 */
const managerAuth = asyncHandler(async (req, res, next) => {
    let token;
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
    }

    if (!token) {
        token = req.headers.managertoken || req.body?.managerToken || req.query?.managerToken;
    }

    if (!token) {
        return Response.error(res, "ERROR", "Manager token missing or not authorized.", 401);
    }

    try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        const payload = decoded.user || decoded;
        const role = Number(payload.role);

        // Accept ROLE_MANAGER (271) or ROLE_STAFF (270) to allow admin staff access
        if (role !== constants.ROLE_MANAGER && role !== constants.ROLE_STAFF) {
            return Response.error(res, "ERROR", "Access denied. Manager role required.", 403);
        }

        req.manager = payload;
        req.managerId = payload.id;
        next();
    } catch (err) {
        return Response.error(res, "ERROR", "Invalid or expired manager token.", 401);
    }
});

module.exports = managerAuth;
