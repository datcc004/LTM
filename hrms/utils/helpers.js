'use strict';

const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const sanitizeHtmlLib = require('sanitize-html');
const env = require('../config/env');

dayjs.extend(customParseFormat);

/** Lỗi nghiệp vụ có status code, dùng chung cho controller và error handler. */
class AppError extends Error {
  constructor(message, statusCode = 500, options = {}) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = options.code || null;
    this.details = options.details || null;
    this.isOperational = options.isOperational !== false;
    Error.captureStackTrace(this, AppError);
  }
}

/** Bọc handler async để chuyển lỗi tới express error middleware. */
function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

// ------------------------------------------------------------
// Định dạng tiền / số / ngày tháng
// ------------------------------------------------------------
function formatMoney(value) {
  const amount = Number(value) || 0;
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatNumber(value, digits = 0) {
  const amount = Number(value) || 0;
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function formatDate(value, pattern = 'DD/MM/YYYY') {
  if (!value) return '—';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format(pattern) : '—';
}

function formatDateTime(value) {
  return formatDate(value, 'DD/MM/YYYY HH:mm');
}

function toMysqlDate(value) {
  return dayjs(value).format('YYYY-MM-DD');
}

function parseViDate(value) {
  const parsed = dayjs(String(value || ''), ['DD/MM/YYYY', 'YYYY-MM-DD', 'DD-MM-YYYY'], true);
  return parsed.isValid() ? parsed : null;
}

function today() {
  return dayjs();
}

function daysBetween(from, to) {
  return dayjs(to).startOf('day').diff(dayjs(from).startOf('day'), 'day');
}

function addDays(date, amount) {
  return dayjs(date).add(Number(amount) || 0, 'day');
}

// ------------------------------------------------------------
// Mã nhân viên, mật khẩu, token
// ------------------------------------------------------------
function generateEmployeeCode(lastCode) {
  const match = /^NV(\d{4})$/i.exec(String(lastCode || '').trim());
  const next = match ? Number(match[1]) + 1 : 1;
  if (next > 9999) throw new AppError('Đã vượt quá giới hạn mã nhân viên NV9999', 409);
  return `NV${String(next).padStart(4, '0')}`;
}

async function hashPassword(plain) {
  if (typeof plain !== 'string' || plain.length < 6) {
    throw new AppError('Mật khẩu phải có ít nhất 6 ký tự', 400);
  }
  return bcrypt.hash(plain, env.security.bcryptRounds);
}

async function comparePassword(plain, hash) {
  if (!plain || !hash) return false;
  return bcrypt.compare(plain, hash);
}

function randomToken(byteLength = 32) {
  return crypto.randomBytes(byteLength).toString('hex');
}

// ------------------------------------------------------------
// Làm sạch dữ liệu (XSS)
// ------------------------------------------------------------
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeText(value, options = {}) {
  if (value === null || value === undefined) return '';
  return sanitizeHtmlLib(String(value), {
    allowedTags: options.allowedTags || [],
    allowedAttributes: options.allowedAttributes || {},
    disallowedTagsMode: 'discard',
  }).trim();
}

function safeJsonParse(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

// ------------------------------------------------------------
// Phân trang & sắp xếp an toàn
// ------------------------------------------------------------
function getPagination(source = {}, defaultLimit = 20, maxLimit = 100) {
  const page = Math.max(1, parseInt(source.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(source.limit, 10) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
}

/**
 * allowedMap: { ten_truong_duoc_phep: 'cot_trong_csdl' } hoặc mảng tên cột.
 * sort: "ten_truong:asc" | "ten_truong:desc"
 */
function buildOrderBy(sort, allowedMap, fallback = 'id DESC') {
  const map = Array.isArray(allowedMap)
    ? Object.fromEntries(allowedMap.map((item) => [item, item]))
    : allowedMap || {};

  const [field, direction] = String(sort || '').split(':');
  if (!field || !Object.prototype.hasOwnProperty.call(map, field)) {
    return `ORDER BY ${fallback}`;
  }
  const column = map[field];
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(column)) {
    return `ORDER BY ${fallback}`;
  }
  const dir = String(direction || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  return `ORDER BY \`${column}\` ${dir}`;
}

function pick(object, keys) {
  const result = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(object || {}, key)) result[key] = object[key];
  }
  return result;
}

function omit(object, keys) {
  const excluded = new Set(keys);
  return Object.fromEntries(
    Object.entries(object || {}).filter(([key]) => !excluded.has(key))
  );
}

function toArray(value) {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function parseBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

// ------------------------------------------------------------
// HTTP helpers
// ------------------------------------------------------------
function isJsonRequest(req) {
  return Boolean(
    req && (req.path?.startsWith('/api/') || req.xhr ||
      String(req.get?.('accept') || '').includes('application/json'))
  );
}

function clientIp(req) {
  if (!req) return null;
  const forwarded = req.get?.('x-forwarded-for');
  if (forwarded && env.isProduction) return forwarded.split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || null;
}

function jsonSuccess(res, data = null, message = 'Thành công', statusCode = 200) {
  return res.status(statusCode).json({ success: true, message, data });
}

function jsonError(res, message = 'Có lỗi xảy ra', statusCode = 500, errors = null) {
  return res.status(statusCode).json({ success: false, message, errors });
}

/** Chặn open redirect: chỉ nhận đường dẫn tương đối bắt đầu bằng 1 dấu '/'. */
function safeRedirect(url, fallback = '/dashboard') {
  if (typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//')) return fallback;
  return url;
}

function maskEmail(email) {
  const value = String(email || '');
  const [name, domain] = value.split('@');
  if (!domain) return value;
  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}***@${domain}`;
}

function formatFileSize(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

module.exports = {
  AppError,
  asyncHandler,
  formatMoney,
  formatNumber,
  formatDate,
  formatDateTime,
  toMysqlDate,
  parseViDate,
  roundMoney,
  today,
  daysBetween,
  addDays,
  generateEmployeeCode,
  hashPassword,
  comparePassword,
  randomToken,
  escapeHtml,
  sanitizeText,
  safeJsonParse,
  getPagination,
  buildOrderBy,
  pick,
  omit,
  toArray,
  parseBool,
  isJsonRequest,
  clientIp,
  jsonSuccess,
  jsonError,
  safeRedirect,
  maskEmail,
  formatFileSize,
  slugify,
};
