'use strict';

const express = require('express');
const { body } = require('express-validator');

const controller = require('../controllers/adminUser.controller');
const { validate } = require('../middlewares/validate');

const router = express.Router();

const commonRules = [
  body('username').trim().isLength({ min: 3, max: 50 }).withMessage('Tên đăng nhập phải từ 3 đến 50 ký tự.'),
  body('email').isEmail().withMessage('Email không hợp lệ.').isLength({ max: 120 }).withMessage('Email quá dài.'),
  body('role_id').isInt({ min: 1, max: 4 }).withMessage('Vai trò không hợp lệ.'),
];

const createRules = [
  ...commonRules,
  body('password').isLength({ min: 6 }).withMessage('Mật khẩu phải có ít nhất 6 ký tự.'),
];

const updateRules = [
  ...commonRules,
  body('password').optional({ checkFalsy: true })
    .isLength({ min: 6 }).withMessage('Mật khẩu mới phải có ít nhất 6 ký tự.'),
];

router.get('/', controller.index);
router.get('/create', controller.create);
router.post('/', validate(createRules), controller.store);
router.get('/:id/edit', controller.edit);
router.post('/:id/update', validate(updateRules), controller.update);
router.post('/:id/toggle', controller.toggleActive);

module.exports = router;
