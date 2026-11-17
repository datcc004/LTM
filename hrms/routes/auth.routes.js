'use strict';

const express = require('express');
const { body } = require('express-validator');

const controller = require('../controllers/auth.controller');
const { validate } = require('../middlewares/validate');
const { loginLimiter } = require('../config/security');

const router = express.Router();

const loginRules = [
  body('username').trim().notEmpty().withMessage('Vui lòng nhập tên đăng nhập hoặc email.'),
  body('password').notEmpty().withMessage('Vui lòng nhập mật khẩu.'),
];

router.get('/login', controller.showLogin);
router.post('/login', loginLimiter, validate(loginRules), controller.login);
router.post('/logout', controller.logout);

module.exports = router;
