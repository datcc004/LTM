'use strict';

const express = require('express');
const controller = require('../controllers/notification.controller');

const router = express.Router();

router.get('/', controller.index);

module.exports = router;
