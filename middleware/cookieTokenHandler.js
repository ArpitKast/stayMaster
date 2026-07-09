const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");

const validateCookieToken = asyncHandler ( async (req, res, next) => {
    const authcookie = req.cookies.authcookie;
    if(!authcookie) {
        res.status(401);
        throw new Error("User is not authorized or access token is missing.");
    }
    jwt.verify(authcookie, process.env.ACCESS_TOKEN_SECRET, (err, decode) => {
        if(err) {
            res.status(401);
            throw new Error("User is not authorized.");
        }
        req.user = decode.user;
        next();
    });
});

module.exports = validateCookieToken;