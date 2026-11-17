'use strict';

const express = require('express');
const { body } = require('express-validator');

const controller = require('../controllers/leave.controller');
const { validate } = require('../middlewares/validate');
const { authorize, HR_AND_ABOVE, MANAGER_AND_ABOVE } = require('../middlewares/role');
const { LEAVE_STATUSES } = require('../services/leave.service');

const router = express.Router();
const hrOnly = authorize(HR_AND_ABOVE);
const approver = authorize(MANAGER_AND_ABOVE);

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const rules = [
  body('employee_id').isInt({ min: 1 }).withMessage('Vui lòng chọn nhân viên.'),
  body('leave_type_id').isInt({ min: 1 }).withMessage('Vui lòng chọn loại phép.'),
  body('start_date').matches(datePattern).withMessage('Ngày bắt đầu không hợp lệ.')
    .bail().isDate().withMessage('Ngày bắt đầu không tồn tại.'),
  body('end_date').matches(datePattern).withMessage('Ngày kết thúc không hợp lệ.')
    .bail().isDate().withMessage('Ngày kết thúc không tồn tại.'),
  body('reason').optional({ checkFalsy: true }).isLength({ max: 2000 })
    .withMessage('Lý do tối đa 2000 ký tự.'),
];

const approvalRules = [
  body('status').isIn(LEAVE_STATUSES).withMessage('Trạng thái duyệt không hợp lệ.'),
  body('approval_note').optional({ checkFalsy: true }).isLength({ max: 500 })
    .withMessage('Ghi chú duyệt tối đa 500 ký tự.'),
];

router.get('/', controller.index);
router.get('/balances', controller.balances);
router.get('/create', hrOnly, controller.create);
router.post('/', hrOnly, validate(rules), controller.store);
router.get('/:id/edit', hrOnly, controller.edit);
router.put('/:id', hrOnly, validate(rules), controller.update);
router.patch('/:id/approval', approver, validate(approvalRules), controller.approval);
router.delete('/:id', hrOnly, controller.destroy);

module.exports = router;
