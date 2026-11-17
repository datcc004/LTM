'use strict';

const express = require('express');
const { body } = require('express-validator');

const controller = require('../controllers/attendance.controller');
const { validate } = require('../middlewares/validate');
const { authorize, HR_AND_ABOVE, MANAGER_AND_ABOVE } = require('../middlewares/role');

const router = express.Router();
const hrOnly = authorize(HR_AND_ABOVE);
const approver = authorize(MANAGER_AND_ABOVE);

const dateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

const rules = [
  body('employee_id').isInt({ min: 1 }).withMessage('Vui lòng chọn nhân viên.'),
  body('work_date').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Ngày chấm công không hợp lệ.')
    .bail().isDate().withMessage('Ngày chấm công không tồn tại.'),
  body('shift_id').optional({ checkFalsy: true }).isInt({ min: 1 }).withMessage('Ca làm việc không hợp lệ.'),
  body('check_in').optional({ checkFalsy: true }).matches(dateTimePattern).withMessage('Giờ vào không hợp lệ.'),
  body('check_out').optional({ checkFalsy: true }).matches(dateTimePattern).withMessage('Giờ ra không hợp lệ.'),
  body('source').optional({ checkFalsy: true }).isIn(['Camera', 'Thủ công', 'Self-service'])
    .withMessage('Nguồn chấm công không hợp lệ.'),
  body('note').optional({ checkFalsy: true }).isLength({ max: 255 }).withMessage('Ghi chú tối đa 255 ký tự.'),
];

const approvalRules = [
  body('is_approved').isIn(['0', '1']).withMessage('Trạng thái duyệt không hợp lệ.'),
];

router.get('/', controller.index);
router.get('/create', hrOnly, controller.create);
router.post('/', hrOnly, validate(rules), controller.store);
router.get('/:id/edit', hrOnly, controller.edit);
router.put('/:id', hrOnly, validate(rules), controller.update);
router.patch('/:id/approval', approver, validate(approvalRules), controller.approval);
router.delete('/:id', hrOnly, controller.destroy);

module.exports = router;
