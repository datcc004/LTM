'use strict';

const express = require('express');
const { body } = require('express-validator');

const controller = require('../controllers/employee.controller');
const { validate } = require('../middlewares/validate');
const { verifyCsrf } = require('../middlewares/csrf');

const router = express.Router();

const rules = [
  body('full_name').trim().notEmpty().withMessage('Vui lòng nhập họ và tên.')
    .isLength({ max: 120 }).withMessage('Họ tên tối đa 120 ký tự.'),
  body('gender').isIn(['Nam', 'Nữ', 'Khác']).withMessage('Giới tính không hợp lệ.'),
  body('date_of_birth').optional({ checkFalsy: true })
    .isDate({ format: 'YYYY-MM-DD', strict: true }).withMessage('Ngày sinh không hợp lệ.'),
  body('phone').optional({ checkFalsy: true })
    .matches(/^[0-9+\-\s]{6,20}$/).withMessage('Số điện thoại không hợp lệ.'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Email không hợp lệ.')
    .isLength({ max: 120 }).withMessage('Email tối đa 120 ký tự.'),
  body('address').optional({ checkFalsy: true })
    .isLength({ max: 255 }).withMessage('Địa chỉ tối đa 255 ký tự.'),
  body('id_card').optional({ checkFalsy: true })
    .matches(/^[A-Za-z0-9]{6,20}$/).withMessage('Số CCCD/CMND chỉ gồm chữ và số (6-20 ký tự).'),
  body('department_id').isInt({ min: 1 }).withMessage('Vui lòng chọn phòng ban.'),
  body('position_id').isInt({ min: 1 }).withMessage('Vui lòng chọn chức vụ.'),
  body('manager_id').optional({ checkFalsy: true }).isInt({ min: 1 }).withMessage('Quản lý không hợp lệ.'),
  body('hire_date').isDate({ format: 'YYYY-MM-DD', strict: true }).withMessage('Ngày vào làm không hợp lệ.'),
  body('status').isIn(['Đang làm việc', 'Tạm nghỉ', 'Nghỉ việc']).withMessage('Trạng thái không hợp lệ.'),
];

router.get('/', controller.index);
router.get('/create', controller.create);
router.post('/', controller.uploadAvatar, verifyCsrf, validate(rules), controller.store);
router.get('/:id', controller.show);
router.get('/:id/edit', controller.edit);
router.put('/:id', controller.uploadAvatar, verifyCsrf, validate(rules), controller.update);
router.delete('/:id', controller.destroy);
router.patch('/:id/restore', controller.restore);

module.exports = router;
