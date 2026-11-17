'use strict';

const express = require('express');
const { body } = require('express-validator');

const controller = require('../controllers/salaryStructure.controller');
const { validate } = require('../middlewares/validate');

const router = express.Router();

const rules = [
  body('employee_id').isInt({ min: 1 }).withMessage('Vui lòng chọn nhân viên.'),
  body('base_salary').isFloat({ min: 0 }).withMessage('Lương cơ bản không hợp lệ.'),
  body('allowance').isFloat({ min: 0 }).withMessage('Phụ cấp không hợp lệ.'),
  body('dependents_count').isInt({ min: 0, max: 20 }).withMessage('Số người phụ thuộc không hợp lệ.'),
  body('effective_from').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Ngày áp dụng không hợp lệ.')
    .bail().isDate().withMessage('Ngày áp dụng không tồn tại.'),
  body('note').optional({ checkFalsy: true }).isLength({ max: 255 })
    .withMessage('Ghi chú tối đa 255 ký tự.'),
];

router.get('/', controller.index);
router.get('/create', controller.create);
router.post('/', validate(rules), controller.store);
router.get('/:id/edit', controller.edit);
router.put('/:id', validate(rules), controller.update);
router.delete('/:id', controller.destroy);

module.exports = router;
