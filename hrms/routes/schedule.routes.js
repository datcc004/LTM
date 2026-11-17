'use strict';

const express = require('express');
const { body } = require('express-validator');

const controller = require('../controllers/schedule.controller');
const { validate } = require('../middlewares/validate');

const router = express.Router();

const rules = [
  body('employee_id').isInt({ min: 1 }).withMessage('Vui lòng chọn nhân viên.'),
  body('shift_id').isInt({ min: 1 }).withMessage('Vui lòng chọn ca làm việc.'),
  body('work_date').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Ngày làm việc không hợp lệ.')
    .bail().isDate().withMessage('Ngày làm việc không tồn tại.'),
  body('note').optional({ checkFalsy: true }).isLength({ max: 255 }).withMessage('Ghi chú tối đa 255 ký tự.'),
];

router.get('/', controller.index);
router.get('/create', controller.create);
router.post('/', validate(rules), controller.store);
router.get('/:id/edit', controller.edit);
router.put('/:id', validate(rules), controller.update);
router.delete('/:id', controller.destroy);

module.exports = router;
