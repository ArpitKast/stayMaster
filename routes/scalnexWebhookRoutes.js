'use strict';

const express = require('express');
const scalnexWebhookAuth = require('../middleware/scalnexWebhookAuthHandler');
const { receiveBlog } = require('../controllers/scalnexWebhookController');

const router = express.Router();

router.post('/blog', scalnexWebhookAuth, receiveBlog);

module.exports = router;
