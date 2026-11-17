'use strict';

/** Đơn tăng ca: lập đơn, duyệt và theo dõi giờ làm thêm. */

const overtimeModel = require('../models/overtimeRequest.model');
const employeeModel = require('../models/employee.model');
const departmentModel = require('../models/department.model');
const overtimeService = require('../services/overtime.service');
const { LEAVE_STATUSES } = require('../services/leave.service');
const { hasErrors } = require('../middlewares/validate');
const { audit } = require('../middlewares/audit');
const { canApproveFor, employeeScope } = require('../middlewares/role');
const {
  asyncHandler, AppError, sanitizeText, getPagination,
} = require('../utils/helpers');

const LIST_VIEW = 'overtime/index';
const FORM_VIEW = 'overtime/form';
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
    day_type: overtimeService.OT_DAY_TYPES.includes(req.query.day_type) ? String(req.query.day_type) : '',
    status: LEAVE_STATUSES.includes(req.query.status) ? String(req.query.status) : '',
    from_date: DATE_PATTERN.test(String(req.query.from_date || '')) ? String(req.query.from_date) : '',
    to_date: DATE_PATTERN.test(String(req.query.to_date || '')) ? String(req.query.to_date) : '',
  };
}

function queryString(query) {
  const params = new URLSearchParams();
  for (const key of ['q', 'employee_id', 'department_id', 'day_type', 'status', 'from_date', 'to_date']) {
    if (query[key]) params.set(key, query[key]);
  }
  return params.toString();
}

function formValues(item, oldInput = {}) {
  const base = item
    ? { ...item }
    : { employee_id: '', work_date: today(), start_time: '17:00', end_time: '20:00', day_type: 'Ngày thường', reason: '' };
  return { ...base, ...oldInput };
}

async function formLocals(item = null, oldInput = {}) {
  const [employees, departments] = await Promise.all([
    employeeModel.selectOptions(),
    departmentModel.selectOptions(),
  ]);
  return { employees, departments, dayTypes: overtimeService.OT_DAY_TYPES, values: formValues(item, oldInput) };
}

function requestData(req) {
  return {
    employee_id: Number(req.body.employee_id),
    work_date: String(req.body.work_date || '').trim(),
    start_time: String(req.body.start_time || '').trim().slice(0, 5),
    end_time: String(req.body.end_time || '').trim().slice(0, 5),
    day_type: String(req.body.day_type || 'Ngày thường'),
    reason: sanitizeText(req.body.reason),
  };
}

async function validateRequest(data, res) {
  if (hasErrors(res)) return null;
  const employee = await employeeModel.findById(data.employee_id);
  if (!employee || employee.status === 'Nghỉ việc') {
    res.locals.validationErrors = [{ field: 'employee_id', message: 'Nhân viên không hợp lệ hoặc đã nghỉ việc.' }];
    return null;
  }
  try {
    return {
      total_hours: overtimeService.calculateOtHours(data.start_time, data.end_time),
      rate_multiplier: overtimeService.getOtMultiplier(data.day_type),
    };
  } catch (error) {
    res.locals.validationErrors = [{ field: 'end_time', message: error.message }];
    return null;
  }
}

const index = asyncHandler(async (req, res) => {
  const query = buildQuery(req);
  const paging = getPagination(req.query, 20, 100);
  const scope = employeeScope(req, 'e');
  const [pageResult, summary, employees, departments] = await Promise.all([
    overtimeModel.list(query, { ...req.query, page: paging.page, limit: paging.limit }, scope),
    overtimeModel.summary(query, scope),
    employeeModel.selectOptions(),
    departmentModel.selectOptions(),
  ]);
  return res.render(LIST_VIEW, {
    title: 'Đơn tăng ca',
    records: pageResult.rows,
    employees,
    departments,
    dayTypes: overtimeService.OT_DAY_TYPES,
    query,
    summary,
    statuses: LEAVE_STATUSES,
    pagination: pageResult,
    basePath: '/overtime-requests',
    filterQuery: queryString(query),
  });
});

const create = asyncHandler(async (req, res) => {
  return res.render(FORM_VIEW, {
    title: 'Thêm đơn tăng ca',
    item: null,
    ...(await formLocals(null, res.locals.oldInput)),
  });
});

const store = asyncHandler(async (req, res) => {
  const data = requestData(req);
  const checked = await validateRequest(data, res);
  if (!checked) {
    return res.render(FORM_VIEW, { title: 'Thêm đơn tăng ca', item: null, ...(await formLocals(null, req.body)) });
  }
  const created = await overtimeModel.create({ ...data, ...checked, status: 'Chờ duyệt' });
  await audit('CREATE', 'overtime_requests')(req, {
    recordId: created.id,
    newValue: { ...data, ...checked, status: 'Chờ duyệt' },
  });
  req.flash('success', `Đã tạo đơn tăng ca ${created.full_name}: ${checked.total_hours} giờ.`);
  return res.redirect('/overtime-requests');
});

const edit = asyncHandler(async (req, res) => {
  const item = await overtimeModel.findById(req.params.id);
  if (!item) throw new AppError('Không tìm thấy đơn tăng ca.', 404);
  if (item.status === 'Đã duyệt') {
    req.flash('error', 'Đơn đã duyệt không được chỉnh sửa. Vui lòng bỏ duyệt trước.');
    return res.redirect('/overtime-requests');
  }
  return res.render(FORM_VIEW, {
    title: 'Chỉnh sửa đơn tăng ca',
    item,
    ...(await formLocals(item, res.locals.oldInput)),
  });
});

const update = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const before = await overtimeModel.findById(id);
  if (!before) throw new AppError('Không tìm thấy đơn tăng ca.', 404);
  if (before.status === 'Đã duyệt') {
    req.flash('error', 'Đơn đã duyệt không được chỉnh sửa. Vui lòng bỏ duyệt trước.');
    return res.redirect('/overtime-requests');
  }
  const data = requestData(req);
  const checked = await validateRequest(data, res);
  if (!checked) {
    return res.render(FORM_VIEW, {
      title: 'Chỉnh sửa đơn tăng ca',
      item: before,
      ...(await formLocals(before, req.body)),
    });
  }
  const after = await overtimeModel.update(id, { ...data, ...checked });
  await audit('UPDATE', 'overtime_requests')(req, { recordId: id, oldValue: before, newValue: after });
  req.flash('success', `Cập nhật đơn tăng ca thành ${checked.total_hours} giờ.`);
  return res.redirect('/overtime-requests');
});

const approval = asyncHandler(async (req, res) => {
  const status = String(req.body.status || '');
  if (!LEAVE_STATUSES.includes(status)) {
    req.flash('error', 'Trạng thái duyệt không hợp lệ.');
    return res.redirect('/overtime-requests');
  }
  const id = Number(req.params.id);
  const before = await overtimeModel.findById(id);
  if (!before) throw new AppError('Không tìm thấy đơn tăng ca.', 404);
  if (!canApproveFor(req, { id: before.employee_id, department_id: before.department_id })) {
    throw new AppError('Bạn chỉ có thể duyệt đơn của nhân viên trong phòng ban mình quản lý.', 403);
  }
  const note = sanitizeText(req.body.approval_note);
  const result = await overtimeModel.setStatus(id, status, req.user.employee_id || null, note || null);
  const action = status === 'Đã duyệt' ? 'APPROVE' : status === 'Từ chối' ? 'REJECT' : 'UNAPPROVE';
  await audit(action, 'overtime_requests')(req, {
    recordId: id,
    oldValue: { status: result.before.status },
    newValue: { status: result.after.status, approved_by: result.after.approved_by, approval_note: note || null },
  });
  req.flash('success', status === 'Đã duyệt' ? 'Đã duyệt đơn tăng ca.' : `Đơn tăng ca chuyển sang "${status}".`);
  return res.redirect('/overtime-requests');
});

const destroy = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const before = await overtimeModel.findById(id);
  if (!before) throw new AppError('Không tìm thấy đơn tăng ca.', 404);
  await overtimeModel.remove(id);
  await audit('DELETE', 'overtime_requests')(req, { recordId: id, oldValue: before });
  req.flash('success', 'Đã xóa đơn tăng ca.');
  return res.redirect('/overtime-requests');
});

module.exports = {
  index, create, store, edit, update, approval, destroy,
};
