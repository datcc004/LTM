'use strict';

/** Đơn nghỉ phép: lập đơn, xem quỹ phép, duyệt và xóa đơn. */

const leaveRequestModel = require('../models/leaveRequest.model');
const leaveTypeModel = require('../models/leaveType.model');
const employeeModel = require('../models/employee.model');
const departmentModel = require('../models/department.model');
const leaveService = require('../services/leave.service');
const { hasErrors } = require('../middlewares/validate');
const { audit } = require('../middlewares/audit');
const { canApproveFor, employeeScope } = require('../middlewares/role');
const {
  asyncHandler, AppError, sanitizeText, getPagination,
} = require('../utils/helpers');

const LIST_VIEW = 'leave/index';
const FORM_VIEW = 'leave/form';
const BALANCES_VIEW = 'leave/balances';
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function today() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function buildQuery(req) {
  const isId = (value) => (/^\d+$/.test(String(value || '')) ? String(value) : '');
  return {
    q: String(req.query.q || '').trim(),
    employee_id: isId(req.query.employee_id),
    department_id: isId(req.query.department_id),
    leave_type_id: isId(req.query.leave_type_id),
    status: leaveService.LEAVE_STATUSES.includes(req.query.status) ? String(req.query.status) : '',
    from_date: DATE_PATTERN.test(String(req.query.from_date || '')) ? String(req.query.from_date) : '',
    to_date: DATE_PATTERN.test(String(req.query.to_date || '')) ? String(req.query.to_date) : '',
    year: /^\d{4}$/.test(String(req.query.year || '')) ? String(req.query.year) : String(new Date().getFullYear()),
  };
}

function queryString(query, keys) {
  const params = new URLSearchParams();
  for (const key of keys) if (query[key]) params.set(key, query[key]);
  return params.toString();
}

function formValues(item, oldInput = {}) {
  const base = item
    ? { ...item }
    : { employee_id: '', leave_type_id: '', start_date: today(), end_date: today(), reason: '' };
  return { ...base, ...oldInput };
}

async function formLocals(item = null, oldInput = {}) {
  const [employees, leaveTypes] = await Promise.all([
    employeeModel.selectOptions(),
    leaveTypeModel.selectOptions(),
  ]);
  return { employees, leaveTypes, values: formValues(item, oldInput) };
}

async function availableBalance(employeeId, leaveType, year) {
  if (!leaveType) return null;
  const row = await leaveRequestModel.findBalance(employeeId, leaveType.id, year);
  const opening = Number(row?.opening_days ?? leaveType.max_days_per_year ?? 0);
  const accrued = Number(row?.accrued_days || 0);
  const used = Number(row?.used_days || 0);
  return {
    opening_days: opening,
    accrued_days: accrued,
    used_days: used,
    remaining_days: Math.round((opening + accrued - used) * 100) / 100,
  };
}

function requestData(req) {
  return {
    employee_id: Number(req.body.employee_id),
    leave_type_id: Number(req.body.leave_type_id),
    start_date: String(req.body.start_date || '').trim(),
    end_date: String(req.body.end_date || '').trim(),
    reason: sanitizeText(req.body.reason),
  };
}

/** Trả về { total_days, leaveType } hoặc null và ghi lỗi vào res.locals. */
async function validateRequest(data, res, oldValues = {}) {
  if (hasErrors(res)) return null;
  const fail = (field, message) => {
    res.locals.validationErrors = [{ field, message }];
    return null;
  };

  const employee = await employeeModel.findById(data.employee_id);
  if (!employee || employee.status === 'Nghỉ việc') {
    return fail('employee_id', 'Nhân viên không hợp lệ hoặc đã nghỉ việc.');
  }
  const leaveType = await leaveTypeModel.findById(data.leave_type_id);
  if (!leaveType || !Number(leaveType.is_active)) {
    return fail('leave_type_id', 'Loại phép không hợp lệ hoặc đã ngưng áp dụng.');
  }

  let totalDays;
  let holidays;
  try {
    holidays = await leaveRequestModel.holidayDates();
    totalDays = leaveService.calculateLeaveDays(data.start_date, data.end_date, holidays);
  } catch (error) {
    return fail('end_date', error.message);
  }
  if (totalDays <= 0) {
    return fail('end_date', 'Khoảng thời gian này không có ngày công nào để tính nghỉ phép.');
  }

  const year = Number(data.start_date.slice(0, 4));
  const balance = await availableBalance(data.employee_id, leaveType, year);
  try {
    leaveService.assertSufficientBalance(balance, totalDays, leaveType);
  } catch (error) {
    return fail('leave_type_id', error.message);
  }
  return { total_days: totalDays, leaveType, balance };
}

const index = asyncHandler(async (req, res) => {
  const query = buildQuery(req);
  const paging = getPagination(req.query, 20, 100);
  const scope = employeeScope(req, 'e');
  const [pageResult, summary, employees, departments, leaveTypes] = await Promise.all([
    leaveRequestModel.list(query, { ...req.query, page: paging.page, limit: paging.limit }, scope),
    leaveRequestModel.summary(query, scope),
    employeeModel.selectOptions(),
    departmentModel.selectOptions(),
    leaveTypeModel.selectOptions(),
  ]);
  return res.render(LIST_VIEW, {
    title: 'Đơn nghỉ phép',
    records: pageResult.rows,
    employees,
    departments,
    leaveTypes,
    query,
    summary,
    statuses: leaveService.LEAVE_STATUSES,
    pagination: pageResult,
    basePath: '/leave-requests',
    filterQuery: queryString(query, [
      'q', 'employee_id', 'department_id', 'leave_type_id', 'status', 'from_date', 'to_date',
    ]),
  });
});

const balances = asyncHandler(async (req, res) => {
  const query = buildQuery(req);
  const paging = getPagination(req.query, 20, 100);
  const scope = employeeScope(req, 'e');
  const [pageResult, employees, departments] = await Promise.all([
    leaveRequestModel.balances({
      q: query.q,
      employee_id: query.employee_id,
      department_id: query.department_id,
      year: query.year,
      paging: { ...req.query, page: paging.page, limit: paging.limit },
    }, scope),
    employeeModel.selectOptions(),
    departmentModel.selectOptions(),
  ]);
  return res.render(BALANCES_VIEW, {
    title: 'Quỹ phép',
    records: pageResult.rows,
    employees,
    departments,
    query,
    pagination: pageResult,
    basePath: '/leave-requests/balances',
    filterQuery: queryString(query, ['q', 'employee_id', 'department_id', 'year']),
  });
});

const create = asyncHandler(async (req, res) => {
  return res.render(FORM_VIEW, {
    title: 'Thêm đơn nghỉ phép',
    item: null,
    ...(await formLocals(null, res.locals.oldInput)),
  });
});

const store = asyncHandler(async (req, res) => {
  const data = requestData(req);
  const checked = await validateRequest(data, res, req.body);
  if (!checked) {
    return res.render(FORM_VIEW, { title: 'Thêm đơn nghỉ phép', item: null, ...(await formLocals(null, req.body)) });
  }
  const created = await leaveRequestModel.create({
    ...data,
    total_days: checked.total_days,
    status: 'Chờ duyệt',
  });
  await audit('CREATE', 'leave_requests')(req, {
    recordId: created.id,
    newValue: { ...data, total_days: checked.total_days, status: 'Chờ duyệt' },
  });
  req.flash('success', `Đã tạo đơn nghỉ ${created.full_name}: ${created.leave_type_name}, ${checked.total_days} ngày.`);
  return res.redirect('/leave-requests');
});

const edit = asyncHandler(async (req, res) => {
  const item = await leaveRequestModel.findById(req.params.id);
  if (!item) throw new AppError('Không tìm thấy đơn nghỉ phép.', 404);
  if (item.status === 'Đã duyệt') {
    req.flash('error', 'Đơn đã duyệt không được chỉnh sửa. Vui lòng bỏ duyệt trước.');
    return res.redirect('/leave-requests');
  }
  return res.render(FORM_VIEW, {
    title: 'Chỉnh sửa đơn nghỉ phép',
    item,
    ...(await formLocals(item, res.locals.oldInput)),
  });
});

const update = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const before = await leaveRequestModel.findById(id);
  if (!before) throw new AppError('Không tìm thấy đơn nghỉ phép.', 404);
  if (before.status === 'Đã duyệt') {
    req.flash('error', 'Đơn đã duyệt không được chỉnh sửa. Vui lòng bỏ duyệt trước.');
    return res.redirect('/leave-requests');
  }
  const data = requestData(req);
  const checked = await validateRequest(data, res, req.body);
  if (!checked) {
    return res.render(FORM_VIEW, {
      title: 'Chỉnh sửa đơn nghỉ phép',
      item: before,
      ...(await formLocals(before, req.body)),
    });
  }
  const after = await leaveRequestModel.update(id, { ...data, total_days: checked.total_days });
  await audit('UPDATE', 'leave_requests')(req, {
    recordId: id,
    oldValue: before,
    newValue: after,
  });
  req.flash('success', `Cập nhật đơn nghỉ phép thành ${checked.total_days} ngày.`);
  return res.redirect('/leave-requests');
});

const approval = asyncHandler(async (req, res) => {
  const status = String(req.body.status || '');
  if (!leaveService.LEAVE_STATUSES.includes(status)) {
    req.flash('error', 'Trạng thái duyệt không hợp lệ.');
    return res.redirect('/leave-requests');
  }
  const id = Number(req.params.id);
  const before = await leaveRequestModel.findById(id);
  if (!before) throw new AppError('Không tìm thấy đơn nghỉ phép.', 404);
  if (!canApproveFor(req, { id: before.employee_id, department_id: before.department_id })) {
    throw new AppError('Bạn chỉ có thể duyệt đơn của nhân viên trong phòng ban mình quản lý.', 403);
  }
  const note = sanitizeText(req.body.approval_note);
  let result;
  try {
    result = await leaveRequestModel.setStatus(id, status, req.user.employee_id || null, note || null);
  } catch (error) {
    if (error.code === 'INSUFFICIENT_LEAVE') {
      req.flash('error', error.message);
      return res.redirect('/leave-requests');
    }
    throw error;
  }
  const action = status === 'Đã duyệt' ? 'APPROVE' : status === 'Từ chối' ? 'REJECT' : 'UNAPPROVE';
  await audit(action, 'leave_requests')(req, {
    recordId: id,
    oldValue: { status: result.before.status },
    newValue: { status: result.after.status, approved_by: result.after.approved_by, approval_note: note || null },
  });
  req.flash('success', status === 'Đã duyệt' ? 'Đã duyệt đơn nghỉ phép.' : `Đơn nghỉ phép chuyển sang "${status}".`);
  return res.redirect('/leave-requests');
});

const destroy = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const before = await leaveRequestModel.findById(id);
  if (!before) throw new AppError('Không tìm thấy đơn nghỉ phép.', 404);
  await leaveRequestModel.remove(id);
  await audit('DELETE', 'leave_requests')(req, { recordId: id, oldValue: before });
  req.flash('success', 'Đã xóa đơn nghỉ phép và cập nhật quỹ phép.');
  return res.redirect('/leave-requests');
});

module.exports = {
  index, balances, create, store, edit, update, approval, destroy,
};
