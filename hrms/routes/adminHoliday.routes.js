'use strict';

const express = require('express');
const { body } = require('express-validator');

const controller = require('../controllers/adminHoliday.controller');
const { validate } = require('../middlewares/validate');

const router = express.Router();

const rules = [
  body('name').trim().notEmpty().withMessage('Tên ngày lễ không được để trống.')
    .isLength({ max: 150 }).withMessage('Tên ngày lễ tối đa 150 ký tự.'),
  body('holiday_date').matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Ngày lễ phải theo định dạng YYYY-MM-DD.'),
  body('note').optional({ checkFalsy: true })
    .isLength({ max: 255 }).withMessage('Ghi chú tối đa 255 ký tự.'),
];

router.get('/', controller.index);
router.get('/create', controller.create);
router.post('/', validate(rules), controller.store);
router.get('/:id/edit', controller.edit);
router.post('/:id/update', validate(rules), controller.update);
router.post('/:id/delete', controller.destroy);

module.exports = router;
