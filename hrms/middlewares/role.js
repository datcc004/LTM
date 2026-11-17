'use strict';

/** RBAC cấp server. Menu sidebar chỉ là giao diện; quyền thật nằm ở đây. */

const { AppError, isJsonRequest } = require('../utils/helpers');

const ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  HR: 'HR',
  MANAGER: 'MANAGER',
  EMPLOYEE: 'EMPLOYEE',
});

const HR_AND_ABOVE = [ROLES.ADMIN, ROLES.HR];
const MANAGER_AND_ABOVE = [ROLES.ADMIN, ROLES.HR, ROLES.MANAGER];

function hasRole(user, roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return Boolean(user && allowed.includes(user.role));
}

function forbid(req, res, next, message = 'Bạn không có quyền thực hiện thao tác này.') {
  if (isJsonRequest(req)) {
    return next(new AppError(message, 403, { code: 'FORBIDDEN' }));
  }
  if (typeof req.flash === 'function') req.flash('error', message);
  return res.redirect('/dashboard');
}

/** authorize(['ADMIN','HR']) hoặc authorize('ADMIN','HR') đều được. */
function authorize(...args) {
  const allowed = args.flat().filter(Boolean);
  return (req, res, next) => {
    if (!req.user) {
      if (isJsonRequest(req)) return next(new AppError('Chưa đăng nhập', 401));
      return res.redirect('/login');
    }
    if (!allowed.includes(req.user.role)) return forbid(req, res, next);
    return next();
  };
}

const isAdmin = authorize([ROLES.ADMIN]);
const isHrOrAbove = authorize(HR_AND_ABOVE);
const isManagerOrAbove = authorize(MANAGER_AND_ABOVE);
const isEmployee = authorize([ROLES.EMPLOYEE]);

/** Hồ sơ cá nhân hoặc một nhóm vai trò được phép xem mọi hồ sơ. */
function requireSelfOrRoles(...args) {
  const allowed = args.flat().filter(Boolean);
  return (req, res, next) => {
    if (!req.user) return next(new AppError('Chưa đăng nhập', 401));
    const employeeId = Number(req.params.id || req.params.employeeId || req.body?.employee_id);
    if (Number(req.user.employee_id) === employeeId || allowed.includes(req.user.role)) return next();
    return forbid(req, res, next);
  };
}

/** MANAGER chỉ thấy phòng ban của mình; ADMIN/HR thấy toàn bộ; EMPLOYEE chỉ thấy mình. */
function employeeScope(req, alias = 'e') {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(alias)) {
    throw new AppError('Alias không hợp lệ', 500, { isOperational: false });
  }
  if (!req.user) return { sql: '1 = 0', params: [] };
  if (hasRole(req.user, HR_AND_ABOVE)) return { sql: '1 = 1', params: [] };
  if (req.user.role === ROLES.MANAGER) {
    return {
      sql: `${alias}.department_id = ?`,
      params: [req.user.department_id ?? 0],
    };
  }
  return { sql: `${alias}.id = ?`, params: [req.user.employee_id ?? 0] };
}

function canViewEmployee(req, employee) {
  if (!req.user || !employee) return false;
  if (hasRole(req.user, HR_AND_ABOVE)) return true;
  if (req.user.role === ROLES.MANAGER) {
    return Number(req.user.department_id) === Number(employee.department_id);
  }
  return Number(req.user.employee_id) === Number(employee.id || employee.employee_id);
}

/** HR duyệt mọi đơn; MANAGER duyệt đơn cấp dưới (không duyệt đơn của chính mình). */
function canApproveFor(req, employee) {
  if (!req.user || !employee) return false;
  if (hasRole(req.user, HR_AND_ABOVE)) return true;
  if (req.user.role !== ROLES.MANAGER) return false;
  const sameDepartment = Number(req.user.department_id) === Number(employee.department_id);
  const isSelf = Number(req.user.employee_id) === Number(employee.id || employee.employee_id);
  return sameDepartment && !isSelf;
}

function canEditPayroll(req) {
  return hasRole(req.user, HR_AND_ABOVE);
}

module.exports = {
  ROLES,
  HR_AND_ABOVE,
  MANAGER_AND_ABOVE,
  hasRole,
  authorize,
  isAdmin,
  isHrOrAbove,
  isManagerOrAbove,
  isEmployee,
  requireSelfOrRoles,
  employeeScope,
  canViewEmployee,
  canApproveFor,
  canEditPayroll,
};
