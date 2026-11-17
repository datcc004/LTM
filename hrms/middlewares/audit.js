'use strict';

/** Ghi audit log cho mọi thao tác C/U/D quan trọng. Không bao giờ làm gián đoạn request chính. */

const db = require('../config/db');
const logger = require('../utils/logger');
const { clientIp, safeJsonParse } = require('../utils/helpers');

const REDACTED = new Set([
  'password', 'password_hash', 'confirm_password', 'old_password', 'new_password',
  'csrf_token', '_csrf', 'token', 'secret', 'session', 'cookie',
]);

function redact(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redact);
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      REDACTED.has(key.toLowerCase()) ? '[REDACTED]' : redact(item),
    ])
  );
}

function jsonOrNull(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') {
    const parsed = safeJsonParse(value, value);
    return JSON.stringify(redact(parsed));
  }
  return JSON.stringify(redact(value));
}

async function writeAudit({
  userId = null,
  action,
  tableName,
  recordId = null,
  oldValue = null,
  newValue = null,
  req = null,
} = {}) {
  try {
    await db.insert(
      `INSERT INTO audit_logs
         (user_id, action, table_name, record_id, old_value, new_value, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId ?? req?.user?.id ?? req?.session?.user?.id ?? null,
        String(action).slice(0, 30),
        String(tableName).slice(0, 80),
        recordId === null || recordId === undefined ? null : String(recordId).slice(0, 50),
        jsonOrNull(oldValue),
        jsonOrNull(newValue),
        req ? clientIp(req) : null,
        req?.get ? String(req.get('user-agent') || '').slice(0, 255) || null : null,
      ]
    );
  } catch (error) {
    logger.error('writeAudit failed', {
      action, tableName, recordId, error: error.message,
    });
  }
}

/** Factory dùng trong controller:
 *    const log = audit('UPDATE', 'employees');
 *    await log(req, { recordId: id, oldValue: before, newValue: after });
 */
function audit(action, tableName) {
  return (req, context = {}) =>
    writeAudit({
      action,
      tableName,
      userId: context.userId ?? req?.user?.id ?? null,
      recordId: context.recordId,
      oldValue: context.oldValue,
      newValue: context.newValue,
      req,
    });
}

/**
 * Tự động ghi log khi controller đặt res.locals.audit = {
 *   action, tableName, recordId, oldValue, newValue
 * } và response trả về 2xx.
 */
function auditRequest(req, res, next) {
  res.on('finish', () => {
    const meta = res.locals?.audit;
    if (!meta || res.statusCode >= 400) return;
    writeAudit({ ...meta, req });
  });
  next();
}

const auditLogin = (req, success = true) =>
  writeAudit({
    action: success ? 'LOGIN' : 'LOGIN_FAILED',
    tableName: 'users',
    recordId: req.user?.id ?? req.session?.user?.id ?? null,
    newValue: { username: req.body?.username ?? null, result: success ? 'success' : 'failed' },
    req,
  });

const auditLogout = (req) =>
  writeAudit({
    action: 'LOGOUT',
    tableName: 'users',
    recordId: req.user?.id ?? req.session?.user?.id ?? null,
    req,
  });

module.exports = {
  writeAudit,
  audit,
  auditRequest,
  auditLogin,
  auditLogout,
  redact,
};
