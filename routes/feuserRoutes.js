const express = require("express");
const { registerUser} = require("../controllers/feuserController");
const validateToken = require("../middleware/validateTokenHandler");

const router = express.Router();
router.post("/register", registerUser);
module.exports = router;