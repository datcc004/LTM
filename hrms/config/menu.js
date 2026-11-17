'use strict';

/** Menu dùng chung cho sidebar và breadcrumb. RBAC được áp dụng ở đây và ở middlewares/role.js. */

const { ROLES, hasRole } = require('../middlewares/role');

const ALL = Object.values(ROLES);
const HR = [ROLES.ADMIN, ROLES.HR];
const PEOPLE = [ROLES.ADMIN, ROLES.HR, ROLES.MANAGER];
const ADMIN_ONLY = [ROLES.ADMIN];
const EMPLOYEE_ONLY = [ROLES.EMPLOYEE];

const MENU = [
  {
    id: 'dashboard',
    label: 'Tổng quan',
    icon: 'layout-dashboard',
    path: '/dashboard',
    roles: ALL,
  },
  {
    id: 'organization',
    label: 'Tổ chức',
    icon: 'building-2',
    roles: HR,
    children: [
      { id: 'departments', label: 'Phòng ban', path: '/departments', icon: 'network' },
      { id: 'positions', label: 'Chức vụ', path: '/positions', icon: 'briefcase-business' },
    ],
  },
  {
    id: 'employees',
    label: 'Nhân sự',
    icon: 'users-round',
    roles: HR,
    children: [
      { id: 'employee-list', label: 'Danh sách nhân viên', path: '/employees', icon: 'list' },
      { id: 'employee-create', label: 'Thêm nhân viên', path: '/employees/create', icon: 'user-plus' },
      { id: 'contracts', label: 'Hợp đồng', path: '/contracts', icon: 'file-text', badgeKey: 'expiringContracts' },
    ],
  },
  {
    id: 'attendance',
    label: 'Chấm công',
    icon: 'calendar-check-2',
    roles: PEOPLE,
    children: [
      { id: 'attendance-board', label: 'Bảng công', path: '/attendance', icon: 'table-2' },
      { id: 'shifts', label: 'Ca làm việc', path: '/shifts', icon: 'clock-3', roles: HR },
      { id: 'schedules', label: 'Phân ca', path: '/schedules', icon: 'calendar-clock', roles: HR },
    ],
  },
  {
    id: 'requests',
    label: 'Đơn từ',
    icon: 'inbox',
    roles: PEOPLE,
    badgeKey: 'pendingRequests',
    children: [
      { id: 'leave-requests', label: 'Đơn nghỉ phép', path: '/leave-requests', icon: 'calendar-days', badgeKey: 'pendingLeaves' },
      { id: 'leave-balances', label: 'Quỹ phép', path: '/leave-requests/balances', icon: 'pie-chart' },
      { id: 'overtime-requests', label: 'Đơn tăng ca', path: '/overtime-requests', icon: 'timer', badgeKey: 'pendingOvertimes' },
      { id: 'leave-types', label: 'Loại phép', path: '/leave-types', icon: 'tags', roles: HR },
    ],
  },
  {
    id: 'payroll',
    label: 'Tiền lương',
    icon: 'wallet',
    roles: HR,
    children: [
      { id: 'payroll-periods', label: 'Kỳ lương', path: '/payroll', icon: 'receipt-text' },
      { id: 'salary-structures', label: 'Cấu trúc lương', path: '/salary-structures', icon: 'coins' },
    ],
  },
  {
    id: 'reports',
    label: 'Báo cáo',
    icon: 'chart-no-axes-column-increasing',
    path: '/reports',
    roles: PEOPLE,
  },
  {
    id: 'self-service',
    label: 'Cổng nhân viên',
    icon: 'user-round',
    roles: EMPLOYEE_ONLY,
    children: [
      { id: 'my-profile', label: 'Hồ sơ của tôi', path: '/me', icon: 'id-card' },
      { id: 'my-attendance', label: 'Chấm công', path: '/me/attendance', icon: 'fingerprint' },
      { id: 'my-leave', label: 'Đơn của tôi', path: '/me/leave', icon: 'file-clock' },
      { id: 'my-payslips', label: 'Phiếu lương', path: '/me/payslips', icon: 'receipt' },
    ],
  },
  {
    id: 'admin',
    label: 'Quản trị',
    icon: 'shield-check',
    roles: ADMIN_ONLY,
    children: [
      { id: 'admin-users', label: 'Tài khoản', path: '/admin/users', icon: 'user-cog' },
      { id: 'admin-holidays', label: 'Ngày lễ', path: '/admin/holidays', icon: 'calendar-heart' },
      { id: 'admin-settings', label: 'Cấu hình', path: '/admin/settings', icon: 'sliders-horizontal' },
      { id: 'admin-audit', label: 'Nhật ký hệ thống', path: '/admin/audit-logs', icon: 'scroll-text' },
    ],
  },
];

function normalize(item, parent = null) {
  return {
    ...item,
    roles: item.roles || parent?.roles || ALL,
    children: (item.children || []).map((child) => normalize(child, item)),
  };
}

const NORMALIZED_MENU = MENU.map((item) => normalize(item));

function visibleFor(user) {
  if (!user) return [];
  return NORMALIZED_MENU
    .filter((item) => hasRole(user, item.roles))
    .map((item) => ({
      ...item,
      children: item.children.filter((child) => hasRole(user, child.roles)),
    }))
    .map((item) => (item.children.length && !item.path
      ? { ...item, expandable: true }
      : { ...item, expandable: false }));
}

function findActivePath(menu, currentPath) {
  for (const item of menu) {
    if (item.path && (currentPath === item.path || currentPath.startsWith(`${item.path}/`))) {
      return { group: item.id, item: item.id };
    }
    for (const child of item.children || []) {
      if (currentPath === child.path || currentPath.startsWith(`${child.path}/`)) {
        return { group: item.id, item: child.id };
      }
    }
  }
  return { group: '', item: '' };
}

function breadcrumbs(user, currentPath) {
  const menu = visibleFor(user);
  const active = findActivePath(menu, currentPath);
  const crumbs = [{ label: 'Trang chủ', path: '/dashboard' }];
  const group = menu.find((item) => item.id === active.group);
  if (!group) return crumbs;
  if (group.path && group.path !== currentPath) crumbs.push({ label: group.label, path: group.path });
  else if (!group.path) crumbs.push({ label: group.label, path: null });

  const child = (group.children || []).find((item) => item.id === active.item);
  if (child && child.path !== currentPath) crumbs.push({ label: child.label, path: child.path });
  else if (group.path === currentPath) crumbs[crumbs.length - 1] = { label: group.label, path: null };
  return crumbs;
}

module.exports = {
  MENU: NORMALIZED_MENU,
  visibleFor,
  findActivePath,
  breadcrumbs,
};
