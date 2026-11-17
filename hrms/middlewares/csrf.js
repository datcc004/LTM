'use strict';

/** CSRF: signed double-submit token (cookie + hidden field / X-CSRF-Token). */

const crypto = require('node:crypto');
const env = require('../config/env');
const { randomToken, isJsonRequest } = require('../utils/helpers');

const COOKIE_NAME = 'XSRF-TOKEN';

function sign(nonce) {
  return crypto.createHmac('sha256', env.security.csrfSecret).update(nonce).digest('hex');
}

function issueToken(req, res, next) {
  if (!req.session) return next();
  if (!req.session.csrfToken) {
    const nonce = randomToken(24);
    req.session.csrfToken = `${nonce}.${sign(nonce)}`;
  }

  const token = req.session.csrfToken;
  req.csrfToken = () => token;
  res.locals.csrfToken = token;

  res.cookie(COOKIE_NAME, token, {
    httpOnly: false,
    secure: env.isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: env.session.maxAge,
  });
  next();
}

function tokensEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function isValid(token) {
  if (typeof token !== 'string') return false;
  const [nonce, signature] = token.split('.');
  if (!nonce || !signature) return false;
  return tokensEqual(signature, sign(nonce));
}

function verifyCsrf(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  if (req.csrfProtectionDisabled === true) return next();

  const submitted =
    req.get('x-csrf-token') ||
    req.body?._csrf ||
    req.query?._csrf ||
    (req.get('x-requested-with') === 'XMLHttpRequest' ? req.get('x-xsrf-token') : null);

  const expected = req.session?.csrfToken;
  if (!isValid(submitted) || !isValid(expected) || !tokensEqual(submitted, expected)) {
    const message = 'Phiên làm việc không hợp lệ. Vui lòng tải lại trang.';
    if (isJsonRequest(req)) {
      return res.status(403).json({ success: false, message });
    }
    if (typeof req.flash === 'function') req.flash('error', message);
    return res.status(403).render('errors/403', {
      title: '403 - Truy cập bị từ chối',
      message,
    });
  }
  return next();
}

module.exports = {
  issueToken,
  verifyCsrf,
  isValidCsrfToken: isValid,
  CSRF_COOKIE_NAME: COOKIE_NAME,
};
