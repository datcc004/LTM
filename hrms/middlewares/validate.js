'use strict';

/** Wrapper express-validator: gom lỗi thành { field, message, value }. */

const { validationResult } = require('express-validator');
const { AppError, isJsonRequest, omit } = require('../utils/helpers');

function formatErrors(result) {
  return result.array({ onlyFirstError: true }).map((error) => ({
    field: error.path || error.param || 'form',
    message: error.msg,
    value: error.value,
  }));
}

function validate(chains, options = {}) {
  const rules = Array.isArray(chains) ? chains : [chains];
  return async (req, res, next) => {
    try {
      await Promise.all(rules.map((chain) => chain.run(req)));
    } catch (error) {
      return next(error);
    }
    const result = validationResult(req);
    if (result.isEmpty()) return next();

    const errors = formatErrors(result);
    if (isJsonRequest(req)) {
      return next(new AppError('Dữ liệu không hợp lệ', 400, {
        code: 'VALIDATION_ERROR',
        details: errors,
      }));
    }

    res.locals.validationErrors = errors;
    res.locals.oldInput = omit(req.body || {}, ['_csrf', 'csrf_token', 'password', 'confirm_password']);
    if (options.flash && typeof req.flash === 'function') {
      req.flash('errors', JSON.stringify(errors));
    }
    return next();
  };
}

function hasErrors(res) {
  return Boolean(res.locals?.validationErrors?.length);
}

function firstError(res, field, fallback = '') {
  const found = (res.locals?.validationErrors || []).find((item) => item.field === field);
  return found ? found.message : fallback;
}

module.exports = { validate, hasErrors, firstError, formatErrors };
