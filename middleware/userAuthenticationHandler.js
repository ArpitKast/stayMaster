const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");
const accessControl = require('../config/accessControl');

const authenticateUser = asyncHandler ( async (req, res, next) => {
    const authcookie = req.cookies.authcookie;
    if(!authcookie) {
        return res.redirect('/admin/login');
    }

    if (!process.env.ACCESS_TOKEN_SECRET) {
        console.error("ACCESS_TOKEN_SECRET is not configured");
        return res.redirect('/admin/login');
    }

    try {
        const decode = jwt.verify(authcookie, process.env.ACCESS_TOKEN_SECRET);
        req.user = decode.user;
        return next();
    } catch (err) {
        console.log("there was some error " + err);
        return res.redirect('/admin/login');
    }
});

const authorize = (req, res, next) => {
    if (!req.user || !req.user.role) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    const userRole = req.user.role;
    const route = req.baseUrl + req.path;
    if (accessControl[route] && accessControl[route].includes(userRole)) {
        return next();
    }
    return res.status(403).json({ message: 'Access denied' });
};

module.exports = authenticateUser;
