'use strict';

/** Xác thực phiên đăng nhập. Mọi request đều tải lại user từ CSDL để phản ánh thay đổi quyền ngay lập tức. */

const db = require('../config/db');
const { asyncHandler, isJsonRequest, safeRedirect } = require('../utils/helpers');

const USER_FIELDS = `
  SELECT u.id, u.username, u.email, u.role_id, u.employee_id,
         r.name AS role,
         e.full_name, e.avatar_path, e.department_id, e.position_id,
         e.manager_id, e.status AS employee_status,
         d.name AS department_name, p.name AS position_name
  FROM users u
  INNER JOIN roles r ON r.id = u.role_id
  LEFT JOIN employees e ON e.id = u.employee_id
  LEFT JOIN departments d ON d.id = e.department_id
  LEFT JOIN positions p ON p.id = e.position_id
  WHERE u.id = ? AND u.is_active = 1 AND (u.locked_until IS NULL OR u.locked_until < NOW())
`;

async function loadUser(userId) {
  return db.queryOne(USER_FIELDS, [userId]);
}

function destroySession(req) {
  return new Promise((resolve) => {
    if (!req.session) return resolve();
    req.session.destroy(() => resolve());
  });
}

function deny(req, res, message = 'Vui lòng đăng nhập để tiếp tục.') {
  if (isJsonRequest(req)) {
    return res.status(401).json({ success: false, message });
  }
  if (typeof req.flash === 'function') req.flash('error', message);
  const next = req.originalUrl && req.originalUrl !== '/login'
    ? `?next=${encodeURIComponent(safeRedirect(req.originalUrl, '/dashboard'))}`
    : '';
  return res.redirect(`/login${next}`);
}

const isAuthenticated = asyncHandler(async (req, res, next) => {
  const sessionUser = req.session?.user;
  if (!sessionUser?.id) return deny(req, res);

  const user = await loadUser(sessionUser.id);
  if (!user) {
    await destroySession(req);
    return deny(req, res, 'Tài khoản không còn hiệu lực.');
  }
  if (user.employee_status === 'Nghỉ việc') {
    await destroySession(req);
    return deny(req, res, 'Tài khoản nhân viên đã nghỉ việc.');
  }

  req.user = user;
  res.locals.user = user;
  res.locals.isAuthenticated = true;
  req.session.user = {
    id: user.id,
    username: user.username,
    role: user.role,
    employeeId: user.employee_id,
  };
  return next();
});

function isGuest(req, res, next) {
  if (req.session?.user?.id) return res.redirect('/dashboard');
  return next();
}

/** Cho phép truy cập công khai nhưng vẫn gắn req.user nếu đã đăng nhập. */
const optionalAuth = asyncHandler(async (req, res, next) => {
  const sessionUser = req.session?.user;
  if (sessionUser?.id) {
    const user = await loadUser(sessionUser.id);
    if (user) {
      req.user = user;
      res.locals.user = user;
      res.locals.isAuthenticated = true;
    }
  }
  return next();
});

module.exports = {
  isAuthenticated,
  isGuest,
  optionalAuth,
  loadUser,
  destroySession,
  deny,
};
