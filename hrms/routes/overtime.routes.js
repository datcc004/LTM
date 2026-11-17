'use strict';

const express = require('express');
const { body } = require('express-validator');

const controller = require('../controllers/overtime.controller');
const { validate } = require('../middlewares/validate');
const { authorize, HR_AND_ABOVE, MANAGER_AND_ABOVE } = require('../middlewares/role');
const { OT_DAY_TYPES } = require('../services/overtime.service');
const { LEAVE_STATUSES } = require('../services/leave.service');

const router = express.Router();
const hrOnly = authorize(HR_AND_ABOVE);
const approver = authorize(MANAGER_AND_ABOVE);

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const rules = [
  body('employee_id').isInt({ min: 1 }).withMessage('Vui lòng chọn nhân viên.'),
  body('work_date').matches(datePattern).withMessage('Ngày tăng ca không hợp lệ.')
    .bail().isDate().withMessage('Ngày tăng ca không tồn tại.'),
  body('start_time').matches(timePattern).withMessage('Giờ bắt đầu không hợp lệ.'),
  body('end_time').matches(timePattern).withMessage('Giờ kết thúc không hợp lệ.'),
  body('day_type').isIn(OT_DAY_TYPES).withMessage('Loại ngày tăng ca không hợp lệ.'),
  body('reason').optional({ checkFalsy: true }).isLength({ max: 2000 })
    .withMessage('Lý do tối đa 2000 ký tự.'),
];

const approvalRules = [
  body('status').isIn(LEAVE_STATUSES).withMessage('Trạng thái duyệt không hợp lệ.'),
  body('approval_note').optional({ checkFalsy: true }).isLength({ max: 500 })
    .withMessage('Ghi chú duyệt tối đa 500 ký tự.'),
];

router.get('/', controller.index);
router.get('/create', hrOnly, controller.create);
router.post('/', hrOnly, validate(rules), controller.store);
router.get('/:id/edit', hrOnly, controller.edit);
router.put('/:id', hrOnly, validate(rules), controller.update);
router.patch('/:id/approval', approver, validate(approvalRules), controller.approval);
router.delete('/:id', hrOnly, controller.destroy);

module.exports = router;
