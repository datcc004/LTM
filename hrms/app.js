'use strict';

/** Cấu hình Express: static local assets, security, session, CSRF, view locals và routes. */

const path = require('node:path');
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const cookieParser = require('cookie-parser');
const methodOverride = require('method-override');
const flash = require('connect-flash');

const env = require('./config/env');
const { securityHeaders, apiLimiter } = require('./config/security');
const sessionMiddleware = require('./config/session');
const { issueToken, verifyCsrf } = require('./middlewares/csrf');
const { auditRequest } = require('./middlewares/audit');
const { notFound, errorHandler } = require('./middlewares/error');
const menu = require('./config/menu');
const {
  formatMoney, formatNumber, formatDate, formatDateTime, formatFileSize,
} = require('./utils/helpers');
const routes = require('./routes');
const logger = require('./utils/logger');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', env.isProduction ? 1 : false);

// ------------------------------------------------------------
// View engine
// ------------------------------------------------------------
app.set('view engine', 'ejs');
app.set('views', env.paths.views);
app.use(expressLayouts);
app.set('layout', 'layouts/main');

// ------------------------------------------------------------
// Body parsing & tiện ích request
// ------------------------------------------------------------
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser(env.security.csrfSecret));
// method-override@3 đọc getter chuỗi từ query string; form dùng hidden input trong body.
app.use(methodOverride((req) => (req.body && req.body._method) || req.query._method));

// ------------------------------------------------------------
// Static assets: mọi tài nguyên được serve local để khớp CSP 'self'
// ------------------------------------------------------------
const staticOptions = {
  etag: true,
  index: false,
  maxAge: env.isProduction ? '1d' : 0,
};
const vendor = (pkg, sub = '') => path.join(env.paths.root, 'node_modules', pkg, sub);

app.use('/css', express.static(path.join(env.paths.public, 'css'), staticOptions));
app.use('/js', express.static(path.join(env.paths.public, 'js'), staticOptions));
app.use('/uploads', express.static(path.join(env.paths.public, 'uploads'), {
  ...staticOptions,
  setHeaders(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:");
  },
}));
app.use('/vendor/bootstrap', express.static(vendor('bootstrap', 'dist'), staticOptions));
app.use('/vendor/fontawesome', express.static(vendor('@fortawesome/fontawesome-free'), staticOptions));
app.use('/vendor/alpine', express.static(vendor('alpinejs', 'dist'), staticOptions));
app.use('/vendor/lucide', express.static(vendor('lucide'), staticOptions));
app.use('/vendor/chartjs', express.static(vendor('chart.js', 'dist'), staticOptions));
app.use('/vendor/fontsource/be-vietnam-pro', express.static(vendor('@fontsource/be-vietnam-pro'), staticOptions));
app.use('/vendor/fontsource/inter', express.static(vendor('@fontsource/inter'), staticOptions));

// ------------------------------------------------------------
// Security headers -> session -> flash -> CSRF -> audit
// ------------------------------------------------------------
app.use(securityHeaders);
app.use(sessionMiddleware);
app.use(flash());
app.use(issueToken);
// Multipart chưa được multer parse ở đây; route có upload sẽ gọi verifyCsrf sau multer.
app.use((req, res, next) => (
  req.is('multipart/form-data') ? next() : verifyCsrf(req, res, next)
));
app.use(auditRequest);

// ------------------------------------------------------------
// View locals dùng chung cho mọi render
// ------------------------------------------------------------
app.use((req, res, next) => {
  res.locals.appName = env.appName;
  res.locals.appUrl = env.appUrl;
  res.locals.currentPath = req.path;
  res.locals.flash = {
    success: req.flash('success'),
    error: req.flash('error'),
    warning: req.flash('warning'),
    info: req.flash('info'),
  };
  res.locals.validationErrors = res.locals.validationErrors || [];
  res.locals.oldInput = res.locals.oldInput || {};
  res.locals.menu = menu.visibleFor(req.user);
  res.locals.activeMenu = menu.findActivePath(res.locals.menu, req.path);
  res.locals.breadcrumbs = menu.breadcrumbs(req.user, req.path);
  res.locals.notifications = [];
  res.locals.badges = {};
  res.locals.formatMoney = formatMoney;
  res.locals.formatNumber = formatNumber;
  res.locals.formatDate = formatDate;
  res.locals.formatDateTime = formatDateTime;
  res.locals.formatFileSize = formatFileSize;
  next();
});

// ------------------------------------------------------------
// Routes
// ------------------------------------------------------------
app.use('/api', apiLimiter);
app.use(routes);

// ------------------------------------------------------------
// 404 & error handler (luôn đặt cuối cùng)
// ------------------------------------------------------------
app.use(notFound);
app.use(errorHandler);

logger.info('Express app configured', { env: env.nodeEnv });

module.exports = app;
