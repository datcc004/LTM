'use strict';

/** Cổng nhân viên: mọi role, nhưng controller luôn scope theo req.user.employee_id. */

const express = require('express');
const controller = require('../controllers/me.controller');

const router = express.Router();

router.get('/', controller.profile);
router.get('/profile', controller.profile);
router.get('/attendance', controller.attendance);
router.get('/leaves', controller.leaves);
router.get('/payslips', controller.payslips);
router.get('/payslips/:id', controller.payslipDetail);

module.exports = router;
