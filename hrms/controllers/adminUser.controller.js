'use strict';

/** Quản trị tài khoản (ADMIN_ONLY). */

const adminUserModel = require('../models/adminUser.model');
const adminService = require('../services/admin.service');
const { hasErrors } = require('../middlewares/validate');
const { audit } = require('../middlewares/audit');
const {
  asyncHandler, AppError, sanitizeText, getPagination,
} = require('../utils/helpers');

const LIST_VIEW = 'admin/users/index';
const FORM_VIEW = 'admin/users/form';

function buildQuery(req) {
  const role = String(req.query.role || '');
  return {
    q: String(req.query.q || '').trim(),
    role: Object.keys(adminService.ROLE_IDS).includes(role) ? role : '',
    is_active: ['0', '1'].includes(String(req.query.is_active || '')) ? String(req.query.is_active) : '',
  };
}

function queryString(query) {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.role) params.set('role', query.role);
  if (query.is_active) params.set('is_active', query.is_active);
  return params.toString();
}

async function formLocals(item) {
  return {
    title: item ? 'Chỉnh sửa tài khoản' : 'Thêm tài khoản',
    roles: await adminUserModel.getRoles(),
    employees: await adminUserModel.getAvailableEmployees(),
    item: item || null,
    values: item
      ? { ...item, password: '' }
      : { username: '', email: '', password: '', role_id: adminService.ROLE_IDS.EMPLOYEE, employee_id: '', is_active: 1 },
  };
}

function requestData(req) {
  const roleId = Number(req.body.role_id);
  return {
    username: sanitizeText(req.body.username).toLowerCase().replace(/\s+/g, ''),
    email: sanitizeText(req.body.email).toLowerCase(),
    password: String(req.body.password || ''),
    role_id: Object.values(adminService.ROLE_IDS).includes(roleId) ? roleId : adminService.ROLE_IDS.EMPLOYEE,
    employee_id: req.body.employee_id,
    is_active: req.body.is_active === '1',
  };
}

const index = asyncHandler(async (req, res) => {
  const query = buildQuery(req);
  const paging = getPagination(req.query, 20, 100);
  const result = await adminUserModel.list(query, { ...req.query, page: paging.page, limit: paging.limit });
  return res.render(LIST_VIEW, {
    title: 'Quản lý tài khoản',
    users: result.rows,
    roles: Object.keys(adminService.ROLE_IDS),
    query,
    pagination: result,
    basePath: '/admin/users',
    filterQuery: queryString(query),
  });
});

const create = asyncHandler(async (req, res) => {
  const locals = await formLocals(null);
  return res.render(FORM_VIEW, { ...locals, values: { ...locals.values, ...res.locals.oldInput } });
});

const store = asyncHandler(async (req, res) => {
  if (hasErrors(res)) {
    const locals = await formLocals(null);
    return res.render(FORM_VIEW, { ...locals, values: { ...locals.values, ...res.locals.oldInput } });
  }
  const data = requestData(req);
  if (data.password.length < 6) {
    res.locals.validationErrors = [{ field: 'password', message: 'Mật khẩu phải có ít nhất 6 ký tự.' }];
    const locals = await formLocals(null);
    return res.render(FORM_VIEW, { ...locals, values: { ...data, password: '' } });
  }

  try {
    const created = await adminUserModel.create(data);
    await audit('CREATE', 'users')(req, { recordId: created.id, newValue: { ...data, password: '[REDACTED]' } });
    req.flash('success', `Đã tạo tài khoản “${created.username}”.`);
    return res.redirect('/admin/users');
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.locals.validationErrors = [{ field: 'username', message: 'Tên đăng nhập hoặc email đã tồn tại.' }];
      const locals = await formLocals(null);
      return res.render(FORM_VIEW, { ...locals, values: { ...data, password: '' } });
    }
    throw error;
  }
});

const edit = asyncHandler(async (req, res) => {
  const item = await adminUserModel.findById(req.params.id);
  if (!item) throw new AppError('Không tìm thấy tài khoản.', 404);
  const locals = await formLocals(item);
  return res.render(FORM_VIEW, { ...locals, values: { ...locals.values, ...res.locals.oldInput } });
});

const update = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const before = await adminUserModel.findById(id);
  if (!before) throw new AppError('Không tìm thấy tài khoản.', 404);

  if (hasErrors(res)) {
    const locals = await formLocals(before);
    return res.render(FORM_VIEW, { ...locals, values: { ...locals.values, ...res.locals.oldInput } });
  }

  const data = requestData(req);
  if (data.password && data.password.length < 6) {
    res.locals.validationErrors = [{ field: 'password', message: 'Mật khẩu phải có ít nhất 6 ký tự.' }];
    const locals = await formLocals(before);
    return res.render(FORM_VIEW, { ...locals, values: { ...data, password: '' } });
  }

  try {
    await adminUserModel.update(id, data);
    const after = await adminUserModel.findById(id);
    const snapshot = (row) => ({
      username: row.username, email: row.email, role: row.role,
      employee_id: row.employee_id, is_active: row.is_active,
    });
    await audit('UPDATE', 'users')(req, {
      recordId: id, oldValue: snapshot(before), newValue: snapshot(after),
    });
    req.flash('success', 'Cập nhật tài khoản thành công.');
    return res.redirect('/admin/users');
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.locals.validationErrors = [{ field: 'username', message: 'Tên đăng nhập hoặc email đã tồn tại.' }];
      const locals = await formLocals(before);
      return res.render(FORM_VIEW, { ...locals, values: { ...data, password: '' } });
    }
    throw error;
  }
});

/** Khóa/mở khóa: không cho tự khóa chính tài khoản đang dùng. */
const toggleActive = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (id === Number(req.user.id)) {
    req.flash('error', 'Không thể khóa tài khoản đang đăng nhập.');
    return res.redirect('/admin/users');
  }
  const before = await adminUserModel.findById(id);
  if (!before) throw new AppError('Không tìm thấy tài khoản.', 404);
  const isActive = !before.is_active;
  await adminUserModel.setActive(id, isActive);
  await audit(isActive ? 'UNLOCK' : 'LOCK', 'users')(req, {
    recordId: id,
    oldValue: { is_active: before.is_active },
    newValue: { is_active: isActive ? 1 : 0 },
  });
  req.flash('success', isActive ? 'Đã mở khóa tài khoản.' : 'Đã khóa tài khoản.');
  return res.redirect('/admin/users');
});

module.exports = { index, create, store, edit, update, toggleActive };
