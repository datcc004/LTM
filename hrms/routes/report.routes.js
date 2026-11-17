'use strict';

/** Báo cáo: ADMIN/HR/MANAGER (RBAC ở routes/index.js), export có rate limit riêng. */

const express = require('express');
const controller = require('../controllers/report.controller');
const { apiLimiter, exportLimiter } = require('../config/security');

const router = express.Router();

router.get('/', controller.index);
router.get('/data', apiLimiter, controller.chartData);
router.get('/export/excel', exportLimiter, controller.exportExcel);
router.get('/export/pdf', exportLimiter, controller.exportPdf);

module.exports = router;
