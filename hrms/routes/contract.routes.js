'use strict';

const express = require('express');
const { body } = require('express-validator');

const controller = require('../controllers/contract.controller');
const { validate } = require('../middlewares/validate');
const { verifyCsrf } = require('../middlewares/csrf');

const router = express.Router();

const dateRule = (field, label) => body(field).optional({ checkFalsy: true })
  .isDate({ format: 'YYYY-MM-DD', strict: true }).withMessage(`${label} không hợp lệ.`);

const rules = [
  body('employee_id').isInt({ min: 1 }).withMessage('Vui lòng chọn nhân viên.'),
  body('contract_no').optional({ checkFalsy: true })
    .isLength({ max: 30 }).withMessage('Số hợp đồng tối đa 30 ký tự.'),
  body('contract_type').isIn(['Thử việc', 'Chính thức', 'Thời vụ', 'Hợp đồng dịch vụ'])
    .withMessage('Loại hợp đồng không hợp lệ.'),
  body('start_date').isDate({ format: 'YYYY-MM-DD', strict: true }).withMessage('Ngày bắt đầu không hợp lệ.'),
  dateRule('end_date', 'Ngày hết hạn')
    .custom((value, { req }) => !value || !req.body.start_date || value >= req.body.start_date)
    .withMessage('Ngày hết hạn phải sau hoặc bằng ngày bắt đầu.'),
  dateRule('signed_date', 'Ngày ký'),
  body('salary_base').isFloat({ min: 0 }).withMessage('Lương cơ bản không hợp lệ.'),
  body('status').optional({ checkFalsy: true })
    .isIn(['Còn hạn', 'Sắp hết hạn', 'Hết hạn', 'Đã hủy']).withMessage('Trạng thái không hợp lệ.'),
  body('note').optional({ checkFalsy: true })
    .isLength({ max: 500 }).withMessage('Ghi chú tối đa 500 ký tự.'),
];

router.get('/', controller.index);
router.get('/create', controller.create);
router.post('/', controller.uploadDocument, verifyCsrf, validate(rules), controller.store);
router.get('/:id/edit', controller.edit);
router.put('/:id', controller.uploadDocument, verifyCsrf, validate(rules), controller.update);
router.delete('/:id', controller.destroy);

module.exports = router;
