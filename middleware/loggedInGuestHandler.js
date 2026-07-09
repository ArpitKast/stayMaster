const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");

const loggedInGuest = asyncHandler ( async (req, res, next) => {
    // Already authenticated earlier in the middleware chain
    if (req.guest) {
        return next();
    }
    if (req.user) {
        req.guest = req.user;
        return next();
    }

    const authHeader = req.headers.authorization || req.headers.Authorization;
    const headerToken = authHeader && authHeader.startsWith("Bearer")
        ? authHeader.split(" ")[1]
        : undefined;
    const bodyGuestToken = req.body?.guestToken;
    const queryGuestToken = req.query?.guestToken;
    const token = bodyGuestToken || queryGuestToken || headerToken;

    if(!token) {
        // Let downstream middleware/controllers decide how to handle missing auth
        return next();
    }

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decode) => {
        if(!err) {
            const userPayload = decode.user || decode;
            req.guest = userPayload;
            req.user = req.user || userPayload;
            if (bodyGuestToken || queryGuestToken) {
                req.guestToken = bodyGuestToken || queryGuestToken;
            }
            next();
        }else{
            console.log("there was some error "+ err);
            return res.status(401).json({success:false, error: "User is not authorized."});
        }
    });
});

module.exports = loggedInGuest;