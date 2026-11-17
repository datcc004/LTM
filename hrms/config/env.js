'use strict';

require('dotenv').config();

const path = require('node:path');

function str(name, fallback = '') {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

function int(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function float(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

const nodeEnv = str('NODE_ENV', 'development');
const isProduction = nodeEnv === 'production';

const config = {
  nodeEnv,
  isProduction,
  port: int('PORT', 3000),
  appName: str('APP_NAME', 'KIDS PARK HRMS'),
  appUrl: str('APP_URL', 'http://localhost:3000'),

  db: {
    host: str('DB_HOST', '127.0.0.1'),
    port: int('DB_PORT', 3306),
    user: str('DB_USER', 'root'),
    password: str('DB_PASSWORD', ''),
    name: str('DB_NAME', 'kids_park_hrms'),
    poolLimit: int('DB_POOL_LIMIT', 10),
  },

  session: {
    name: str('SESSION_NAME', 'kp_hrms.sid'),
    secret: str('SESSION_SECRET', ''),
    maxAge: int('SESSION_MAX_AGE', 24 * 60 * 60 * 1000),
  },

  security: {
    csrfSecret: str('CSRF_SECRET', ''),
    bcryptRounds: int('BCRYPT_ROUNDS', 10),
    loginMaxAttempts: int('LOGIN_MAX_ATTEMPTS', 5),
    loginWindowMinutes: int('LOGIN_WINDOW_MINUTES', 15),
    loginLockMinutes: int('LOGIN_LOCK_MINUTES', 30),
  },

  upload: {
    dir: str('UPLOAD_DIR', 'public/uploads'),
    maxAvatarSize: int('MAX_AVATAR_SIZE', 2 * 1024 * 1024),
    maxDocSize: int('MAX_DOC_SIZE', 10 * 1024 * 1024),
  },

  business: {
    timezone: str('TZ', 'Asia/Ho_Chi_Minh'),
    contractAlertDays: int('CONTRACT_ALERT_DAYS', 30),
    standardWorkHours: float('STANDARD_WORK_HOURS', 8),
    insuranceRate: float('INSURANCE_RATE', 0.105),
    personalDeduction: int('PERSONAL_DEDUCTION', 11000000),
    dependentDeduction: int('DEPENDENT_DEDUCTION', 4400000),
    annualLeaveDays: int('ANNUAL_LEAVE_DAYS', 12),
    otRateWeekday: float('OT_RATE_WEEKDAY', 1.5),
    otRateWeekend: float('OT_RATE_WEEKEND', 2),
    otRateHoliday: float('OT_RATE_HOLIDAY', 3),
  },

  paths: {
    root: path.resolve(__dirname, '..'),
    views: path.resolve(__dirname, '..', 'views'),
    public: path.resolve(__dirname, '..', 'public'),
    logs: path.resolve(__dirname, '..', 'logs'),
    pdfFont: str('PDF_FONT_PATH', ''),
  },
};

const PLACEHOLDERS = [
  'thay_bang_chuoi_ngau_nhien_48_byte_o_day',
  'thay_bang_chuoi_ngau_nhien_khac_o_day',
  'change-me',
];

function assertProductionSecrets() {
  if (!isProduction) return;
  const secrets = [
    ['SESSION_SECRET', config.session.secret],
    ['CSRF_SECRET', config.security.csrfSecret],
    ['DB_PASSWORD', config.db.password],
  ];
  for (const [name, value] of secrets) {
    if (!value || PLACEHOLDERS.includes(value) || (name !== 'DB_PASSWORD' && value.length < 32)) {
      throw new Error(`[config] ${name} chưa được cấu hình an toàn cho NODE_ENV=production`);
    }
  }
  if (!config.appUrl.startsWith('https://')) {
    throw new Error('[config] APP_URL phải dùng https:// trong production');
  }
}

assertProductionSecrets();

module.exports = config;
