'use strict';

const express = require('express');
const { body } = require('express-validator');

const controller = require('../controllers/leaveType.controller');
const { validate } = require('../middlewares/validate');
const { authorize, HR_AND_ABOVE } = require('../middlewares/role');

const router = express.Router();
const hrOnly = authorize(HR_AND_ABOVE);

const rules = [
  body('code').trim().isLength({ min: 2, max: 30 }).withMessage('Mã loại phép từ 2 đến 30 ký tự.')
    .bail().matches(/^[A-Za-z0-9_]+$/).withMessage('Mã loại phép chỉ gồm chữ, số và dấu gạch dưới.'),
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Tên loại phép từ 2 đến 100 ký tự.'),
  body('max_days_per_year').optional({ checkFalsy: true }).isFloat({ min: 0, max: 365 })
    .withMessage('Số ngày tối đa không hợp lệ.'),
  body('is_paid').optional().isIn(['0', '1']).withMessage('Trạng thái hưởng lương không hợp lệ.'),
  body('requires_approval').optional().isIn(['0', '1']).withMessage('Trạng thái cần duyệt không hợp lệ.'),
  body('is_active').optional().isIn(['0', '1']).withMessage('Trạng thái áp dụng không hợp lệ.'),
  body('color').optional({ checkFalsy: true }).matches(/^#[0-9a-fA-F]{6}$/)
    .withMessage('Màu phải có dạng #RRGGBB.'),
];

router.get('/', controller.index);
router.get('/create', hrOnly, controller.create);
router.post('/', hrOnly, validate(rules), controller.store);
router.get('/:id/edit', hrOnly, controller.edit);
router.put('/:id', hrOnly, validate(rules), controller.update);
router.delete('/:id', hrOnly, controller.destroy);

module.exports = router;
