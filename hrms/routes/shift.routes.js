'use strict';

const express = require('express');
const { body } = require('express-validator');

const controller = require('../controllers/shift.controller');
const { validate } = require('../middlewares/validate');

const router = express.Router();

const clockPattern = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

const rules = [
  body('code').trim().notEmpty().withMessage('Vui lòng nhập mã ca làm việc.')
    .isLength({ max: 20 }).withMessage('Mã ca tối đa 20 ký tự.')
    .matches(/^[A-Za-z0-9_-]+$/).withMessage('Mã chỉ được dùng chữ cái, số, gạch ngang hoặc gạch dưới.'),
  body('name').trim().notEmpty().withMessage('Vui lòng nhập tên ca làm việc.')
    .isLength({ max: 100 }).withMessage('Tên ca tối đa 100 ký tự.'),
  body('start_time').matches(clockPattern).withMessage('Giờ bắt đầu không hợp lệ.'),
  body('end_time').matches(clockPattern).withMessage('Giờ kết thúc không hợp lệ.'),
  body('break_minutes').isInt({ min: 0, max: 480 }).withMessage('Thời gian nghỉ phải từ 0 đến 480 phút.'),
  body('work_hours').isFloat({ min: 1, max: 24 }).withMessage('Số giờ công phải từ 1 đến 24.'),
  body('late_tolerance_minutes').isInt({ min: 0, max: 240 }).withMessage('Thời gian chấp nhận đi trễ không hợp lệ.'),
  body('early_tolerance_minutes').isInt({ min: 0, max: 240 }).withMessage('Thời gian chấp nhận về sớm không hợp lệ.'),
  body('is_overnight').isIn(['0', '1']).withMessage('Ca qua đêm không hợp lệ.'),
  body('color').optional({ checkFalsy: true }).matches(/^#[0-9a-fA-F]{6}$/)
    .withMessage('Màu ca phải có dạng #RRGGBB.'),
  body('is_active').isIn(['0', '1']).withMessage('Trạng thái không hợp lệ.'),
];

router.get('/', controller.index);
router.get('/create', controller.create);
router.post('/', validate(rules), controller.store);
router.get('/:id/edit', controller.edit);
router.put('/:id', validate(rules), controller.update);
router.delete('/:id', controller.destroy);

module.exports = router;
