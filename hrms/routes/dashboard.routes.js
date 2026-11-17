'use strict';

const express = require('express');
const controller = require('../controllers/dashboard.controller');

const router = express.Router();

router.get('/dashboard', controller.index);
router.get('/api/dashboard', controller.chartData);

module.exports = router;
