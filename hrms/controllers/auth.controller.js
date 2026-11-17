'use strict';

/** Đăng nhập / đăng xuất: bcrypt, khóa tài khoản sau N lần sai, audit đầy đủ. */

const db = require('../config/db');
const env = require('../config/env');
const { hasErrors } = require('../middlewares/validate');
const { auditLogin, auditLogout } = require('../middlewares/audit');
const { issueToken } = require('../middlewares/csrf');
const { destroySession } = require('../middlewares/auth');
const {
  asyncHandler, comparePassword, safeRedirect,
} = require('../utils/helpers');
const logger = require('../utils/logger');

const LOGIN_VIEW = 'auth/login';

function showLogin(req, res) {
  return res.render(LOGIN_VIEW, {
    layout: 'layouts/auth',
    title: 'Đăng nhập hệ thống',
    next: safeRedirect(req.query.next, '/dashboard'),
    notice: req.query.logged_out === '1' ? 'Bạn đã đăng xuất khỏi hệ thống.' : '',
  });
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()));
  });
}

async function registerLoginFailure(req, user) {
  const attempts = Number(user.failed_login_attempts || 0) + 1;
  if (attempts >= env.security.loginMaxAttempts) {
    await db.update(
      `UPDATE users
          SET failed_login_attempts = ?, locked_until = DATE_ADD(NOW(), INTERVAL ? MINUTE)
        WHERE id = ?`,
      [attempts, env.security.loginLockMinutes, user.id]
    );
    req.flash('error', `Đăng nhập sai ${attempts} lần. Tài khoản bị khóa trong ${env.security.loginLockMinutes} phút.`);
  } else {
    await db.update(
      'UPDATE users SET failed_login_attempts = ? WHERE id = ?',
      [attempts, user.id]
    );
    req.flash('error', `Thông tin đăng nhập không đúng. Còn ${env.security.loginMaxAttempts - attempts} lần thử.`);
  }
  await auditLogin(req, false);
}

const login = asyncHandler(async (req, res) => {
  if (hasErrors(res)) {
    return res.render(LOGIN_VIEW, {
      layout: 'layouts/auth',
      title: 'Đăng nhập hệ thống',
      next: safeRedirect(req.body?.next, '/dashboard'),
    });
  }

  const username = String(req.body.username || '').trim();
  const user = await db.queryOne(
    `SELECT u.id, u.username, u.password_hash, u.is_active,
            u.failed_login_attempts, u.locked_until, r.name AS role
       FROM users u
       INNER JOIN roles r ON r.id = u.role_id
      WHERE u.username = ? OR u.email = ?
      LIMIT 1`,
    [username, username]
  );

  if (!user || Number(user.is_active) !== 1) {
    await auditLogin(req, false);
    req.flash('error', 'Tài khoản không tồn tại hoặc đã bị vô hiệu hóa.');
    return res.redirect('/login');
  }

  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    const minutes = Math.max(1, Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000));
    req.flash('error', `Tài khoản đang bị khóa. Vui lòng thử lại sau khoảng ${minutes} phút.`);
    await auditLogin(req, false);
    return res.redirect('/login');
  }

  const matched = await comparePassword(req.body.password, user.password_hash);
  if (!matched) {
    await registerLoginFailure(req, user);
    return res.redirect('/login');
  }

  await db.update(
    `UPDATE users
        SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW()
      WHERE id = ?`,
    [user.id]
  );

  await regenerateSession(req);
  req.session.user = {
    id: user.id,
    username: user.username,
    role: user.role,
  };
  issueToken(req, res, () => {});

  await auditLogin(req, true);
  logger.info('Đăng nhập thành công', { userId: user.id, username: user.username });
  return res.redirect(safeRedirect(req.body?.next, '/dashboard'));
});

const logout = asyncHandler(async (req, res) => {
  await auditLogout(req);
  await destroySession(req);
  res.clearCookie(env.session.name, { path: '/' });
  res.clearCookie('XSRF-TOKEN', { path: '/' });
  return res.redirect('/login?logged_out=1');
});

module.exports = { showLogin, login, logout };
