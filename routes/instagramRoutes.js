const express = require('express');
const { getReels } = require('../controllers/instagramController');

const router = express.Router();

router.get('/reels', getReels);

module.exports = router;
