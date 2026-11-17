'use strict';

const express = require('express');
const { body } = require('express-validator');

const controller = require('../controllers/adminSetting.controller');
const { validate } = require('../middlewares/validate');

const router = express.Router();

router.get('/', controller.index);
router.post('/update', validate([
  body('setting_key').trim().notEmpty().withMessage('Khóa cấu hình không hợp lệ.'),
  body('setting_value').isString().withMessage('Giá trị cấu hình không hợp lệ.'),
]), controller.update);

module.exports = router;
