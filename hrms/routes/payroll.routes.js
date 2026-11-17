'use strict';

const express = require('express');
const { body } = require('express-validator');

const controller = require('../controllers/payroll.controller');
const { validate } = require('../middlewares/validate');
const { PAYROLL_STATUSES } = require('../services/payroll.service');

const router = express.Router();

const periodRules = [
  body('month').isInt({ min: 1, max: 12 }).withMessage('Tháng không hợp lệ.'),
  body('year').isInt({ min: 2000, max: 2100 }).withMessage('Năm không hợp lệ.'),
  body('note').optional({ checkFalsy: true }).isLength({ max: 500 })
    .withMessage('Ghi chú tối đa 500 ký tự.'),
];

const payslipRules = [
  body('base_salary').isFloat({ min: 0 }).withMessage('Lương cơ bản không hợp lệ.'),
  body('allowance').isFloat({ min: 0 }).withMessage('Phụ cấp không hợp lệ.'),
  body('bonus').isFloat({ min: 0 }).withMessage('Thưởng không hợp lệ.'),
  body('deduction').isFloat({ min: 0 }).withMessage('Khấu trừ không hợp lệ.'),
  body('working_days').isFloat({ min: 0.01, max: 31 }).withMessage('Số ngày công không hợp lệ.'),
  body('note').optional({ checkFalsy: true }).isLength({ max: 500 })
    .withMessage('Ghi chú tối đa 500 ký tự.'),
];

const statusRules = [
  body('status').isIn(PAYROLL_STATUSES).withMessage('Trạng thái kỳ lương không hợp lệ.'),
];

router.get('/', controller.index);
router.get('/create', controller.create);
router.post('/', validate(periodRules), controller.store);

router.get('/payrolls/:id', controller.payslip);
router.get('/payrolls/:id/edit', controller.payslipEdit);
router.put('/payrolls/:id', validate(payslipRules), controller.payslipUpdate);
router.delete('/payrolls/:id', controller.payslipDestroy);

router.get('/:id', controller.detail);
router.get('/:id/edit', controller.edit);
router.put('/:id', validate(periodRules), controller.update);
router.delete('/:id', controller.destroy);
router.post('/:id/generate', controller.generate);
router.patch('/:id/status', validate(statusRules), controller.changeStatus);

module.exports = router;
