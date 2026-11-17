'use strict';

/** Thông tin tài khoản và đổi mật khẩu. */

const db = require('../config/db');
const { hasErrors } = require('../middlewares/validate');
const { audit } = require('../middlewares/audit');
const {
  asyncHandler, comparePassword, hashPassword, formatDate,
} = require('../utils/helpers');

const SETTINGS_VIEW = 'account/settings';

const profile = asyncHandler(async (req, res) => {
  const employee = req.user.employee_id
    ? await db.queryOne(
      `SELECT e.employee_code, e.full_name, e.gender, e.date_of_birth, e.phone,
              e.email, e.address, e.hire_date, e.status, d.name AS department_name,
              p.name AS position_name, m.full_name AS manager_name
         FROM employees e
         LEFT JOIN departments d ON d.id = e.department_id
         LEFT JOIN positions p ON p.id = e.position_id
         LEFT JOIN employees m ON m.id = e.manager_id
        WHERE e.id = ?`,
      [req.user.employee_id]
    )
    : null;

  return res.render('account/profile', {
    title: 'Thông tin cá nhân',
    profile: employee ? { ...employee, date_of_birth: formatDate(employee.date_of_birth), hire_date: formatDate(employee.hire_date) } : null,
  });
});

function settings(req, res) {
  return res.render(SETTINGS_VIEW, { title: 'Cài đặt tài khoản' });
}

const changePassword = asyncHandler(async (req, res) => {
  if (hasErrors(res)) return res.render(SETTINGS_VIEW, { title: 'Cài đặt tài khoản' });

  const row = await db.queryOne('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  if (!row) throw new Error('Không tìm thấy tài khoản');

  const matched = await comparePassword(req.body.old_password, row.password_hash);
  if (!matched) {
    res.locals.validationErrors = [{ field: 'old_password', message: 'Mật khẩu hiện tại không đúng.' }];
    return res.render(SETTINGS_VIEW, { title: 'Cài đặt tài khoản' });
  }

  const passwordHash = await hashPassword(req.body.new_password);
  await db.update('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, req.user.id]);
  await audit('UPDATE', 'users')(req, {
    recordId: req.user.id,
    oldValue: { password_hash: '[REDACTED]' },
    newValue: { password_hash: '[CHANGED]' },
  });

  req.flash('success', 'Đổi mật khẩu thành công.');
  return res.redirect('/account/settings');
});

module.exports = { profile, settings, changePassword };
