'use strict';

const express = require('express');
const { body } = require('express-validator');

const controller = require('../controllers/position.controller');
const { validate } = require('../middlewares/validate');

const router = express.Router();

const rules = [
  body('code').trim().notEmpty().withMessage('Vui lòng nhập mã chức vụ.')
    .isLength({ max: 30 }).withMessage('Mã chức vụ tối đa 30 ký tự.')
    .matches(/^[A-Za-z0-9_-]+$/).withMessage('Mã chỉ được dùng chữ cái, số, gạch ngang hoặc gạch dưới.'),
  body('name').trim().notEmpty().withMessage('Vui lòng nhập tên chức vụ.')
    .isLength({ max: 100 }).withMessage('Tên chức vụ tối đa 100 ký tự.'),
  body('department_id').optional({ checkFalsy: true }).isInt({ min: 1 }).withMessage('Phòng ban không hợp lệ.'),
  body('is_active').isIn(['0', '1']).withMessage('Trạng thái không hợp lệ.'),
];

router.get('/', controller.index);
router.get('/create', controller.create);
router.post('/', validate(rules), controller.store);
router.get('/:id/edit', controller.edit);
router.put('/:id', validate(rules), controller.update);
router.delete('/:id', controller.destroy);

module.exports = router;
