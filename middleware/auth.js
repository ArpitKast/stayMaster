const jwt = require("jsonwebtoken");

const getToken = (req) => {
  if (req.headers.authorization?.startsWith("Bearer ")) {
    return req.headers.authorization.split(" ")[1];
  }
  if (req.cookies?.authcookie) {
    return req.cookies.authcookie;
  }
  return null;
};

module.exports = {

  requireAuth: (req, res, next) => {
    const token = getToken(req);
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    try {
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      req.user = decoded.user || decoded;
      next();
    } catch (err) {
      console.error("Token verification error:", err.message);
      return res.status(401).json({ message: "Invalid token" });
    }
  },

  requireAdmin: (req, res, next) => {
    const token = getToken(req);
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    try {
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      if (decoded.user?.role !== "admin") {
        return res.status(403).json({ message: "Admin only" });
      }
      req.user = decoded.user;
      next();
    } catch (err) {
      console.error("Token verification error:", err.message);
      return res.status(401).json({ message: "Invalid token" });
    }
  },

  optionalAuth: (req, res, next) => {
    const token = getToken(req);
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        req.user = decoded.user || decoded;
      } catch (err) {
        console.error("Optional token verification error:", err.message);
      }
    }
    next();
  }
};
