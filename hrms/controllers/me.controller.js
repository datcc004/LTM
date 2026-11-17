'use strict';

/** Cổng nhân viên (/me): chỉ đọc, luôn lấy employee_id từ req.user. */

const meModel = require('../models/selfService.model');
const { employeeScope } = require('../middlewares/role');
const { assertSelf, employeeIdOf } = require('../services/selfService.service');
const {
  asyncHandler, AppError, getPagination, today,
} = require('../utils/helpers');

const PROFILE_VIEW = 'me/profile';
const ATTENDANCE_VIEW = 'me/attendance';
const LEAVES_VIEW = 'me/leaves';
const PAYSLIPS_VIEW = 'me/payslips';
const PAYSLIP_DETAIL_VIEW = 'me/payslip-detail';

/** Chặn tài khoản không liên kết nhân viên trước khi đụng dữ liệu. */
function ownId(req) {
  const id = employeeIdOf(req.user);
  assertSelf(req.user, id || 0);
  return id;
}

const profile = asyncHandler(async (req, res) => {
  const id = ownId(req);
  const year = today().year();
  const [employee, leaveBalances] = await Promise.all([
    meModel.getProfile(id),
    meModel.listLeaveBalances(id, year),
  ]);
  if (!employee) throw new AppError('Không tìm thấy hồ sơ nhân viên.', 404);
  return res.render(PROFILE_VIEW, {
    title: 'Hồ sơ của tôi',
    employee,
    leaveBalances,
    year,
    scope: employeeScope(req, 'e'),
  });
});

const attendance = asyncHandler(async (req, res) => {
  const id = ownId(req);
  const paging = getPagination(req.query, 20, 100);
  const filters = {
    month: String(req.query.month || ''),
    year: String(req.query.year || ''),
  };
  const result = await meModel.listAttendance(id, filters, { ...req.query, page: paging.page, limit: paging.limit });
  return res.render(ATTENDANCE_VIEW, {
    title: 'Bảng công của tôi',
    rows: result.rows,
    filters,
    pagination: result,
    basePath: '/me/attendance',
    filterQuery: new URLSearchParams(filters).toString(),
  });
});

const leaves = asyncHandler(async (req, res) => {
  const id = ownId(req);
  const paging = getPagination(req.query, 20, 100);
  const result = await meModel.listLeaves(id, { ...req.query, page: paging.page, limit: paging.limit });
  return res.render(LEAVES_VIEW, {
    title: 'Đơn nghỉ của tôi',
    rows: result.rows,
    pagination: result,
    basePath: '/me/leaves',
    filterQuery: '',
  });
});

const payslips = asyncHandler(async (req, res) => {
  const id = ownId(req);
  const paging = getPagination(req.query, 20, 100);
  const result = await meModel.listPayslips(id, { ...req.query, page: paging.page, limit: paging.limit });
  return res.render(PAYSLIPS_VIEW, {
    title: 'Phiếu lương của tôi',
    rows: result.rows,
    pagination: result,
    basePath: '/me/payslips',
    filterQuery: '',
  });
});

const payslipDetail = asyncHandler(async (req, res) => {
  const id = ownId(req);
  const detail = await meModel.getPayslipDetail(req.params.id, id);
  if (!detail) throw new AppError('Không tìm thấy phiếu lương đã chốt.', 404);
  return res.render(PAYSLIP_DETAIL_VIEW, {
    title: `Phiếu lương ${detail.payslip.period_code}`,
    ...detail,
  });
});

module.exports = { profile, attendance, leaves, payslips, payslipDetail };
