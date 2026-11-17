'use strict';

const express = require('express');
const { body } = require('express-validator');

const controller = require('../controllers/account.controller');
const { validate } = require('../middlewares/validate');

const router = express.Router();

const passwordRules = [
  body('old_password').notEmpty().withMessage('Vui lòng nhập mật khẩu hiện tại.'),
  body('new_password').isLength({ min: 6 }).withMessage('Mật khẩu mới phải có ít nhất 6 ký tự.'),
  body('confirm_password')
    .notEmpty().withMessage('Vui lòng xác nhận mật khẩu mới.')
    .custom((value, { req }) => value === req.body.new_password)
    .withMessage('Xác nhận mật khẩu không khớp.'),
];

router.get('/profile', controller.profile);
router.get('/settings', controller.settings);
router.post('/change-password', validate(passwordRules), controller.changePassword);

module.exports = router;
