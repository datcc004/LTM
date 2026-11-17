'use strict';

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const env = require('./env');
const { isJsonRequest } = require('../utils/helpers');

const cspDirectives = {
  defaultSrc: ["'self'"],
  baseUri: ["'self'"],
  objectSrc: ["'none'"],
  frameAncestors: ["'none'"],
  formAction: ["'self'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", 'data:', 'blob:'],
  fontSrc: ["'self'", 'data:'],
  connectSrc: ["'self'"],
};

if (env.isProduction) cspDirectives.upgradeInsecureRequests = [];

const securityHeaders = helmet({
  contentSecurityPolicy: { useDefaults: false, directives: cspDirectives },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  frameguard: { action: 'deny' },
  hsts: env.isProduction
    ? { maxAge: 15552000, includeSubDomains: true, preload: true }
    : false,
  noSniff: true,
  xssFilter: true,
});

function tooManyRequests(req, res) {
  const message = 'Quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.';
  if (isJsonRequest(req)) {
    return res.status(429).json({ success: false, message });
  }
  if (typeof req.flash === 'function') req.flash('error', message);
  return res.redirect(req.path?.startsWith('/login') ? '/login' : '/dashboard');
}

const loginLimiter = rateLimit({
  windowMs: env.security.loginWindowMinutes * 60 * 1000,
  limit: env.security.loginMaxAttempts,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: tooManyRequests,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: tooManyRequests,
});

const exportLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: tooManyRequests,
});

module.exports = {
  securityHeaders,
  loginLimiter,
  apiLimiter,
  exportLimiter,
  tooManyRequests,
};
