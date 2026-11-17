'use strict';

/** Phân ca: gán nhân viên vào ca làm việc theo ngày. */

const scheduleModel = require('../models/schedule.model');
const employeeModel = require('../models/employee.model');
const shiftModel = require('../models/shift.model');
const { hasErrors } = require('../middlewares/validate');
const { audit } = require('../middlewares/audit');
const { employeeScope } = require('../middlewares/role');
const {
  asyncHandler, AppError, sanitizeText, getPagination,
} = require('../utils/helpers');

const LIST_VIEW = 'schedules/index';
const FORM_VIEW = 'schedules/form';

function today() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function buildQuery(req) {
  return {
    q: String(req.query.q || '').trim(),
    employee_id: /^\d+$/.test(String(req.query.employee_id || '')) ? String(req.query.employee_id) : '',
    shift_id: /^\d+$/.test(String(req.query.shift_id || '')) ? String(req.query.shift_id) : '',
    from_date: /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.from_date || '')) ? String(req.query.from_date) : '',
    to_date: /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.to_date || '')) ? String(req.query.to_date) : '',
  };
}

function queryString(query) {
  const params = new URLSearchParams();
  for (const key of ['q', 'employee_id', 'shift_id', 'from_date', 'to_date']) {
    if (query[key]) params.set(key, query[key]);
  }
  return params.toString();
}

function formValues(item, oldInput = {}) {
  return {
    employee_id: '', shift_id: '', work_date: today(), note: '',
    ...(item || {}),
    ...oldInput,
  };
}

async function formLocals(item = null, oldInput = {}) {
  const [employees, shifts] = await Promise.all([
    employeeModel.selectOptions(),
    shiftModel.selectOptions(),
  ]);
  return { employees, shifts, values: formValues(item, oldInput) };
}

const index = asyncHandler(async (req, res) => {
  const query = buildQuery(req);
  const paging = getPagination(req.query, 20, 100);
  const scope = employeeScope(req, 'e');
  const result = await scheduleModel.list(
    query,
    { ...req.query, page: paging.page, limit: paging.limit },
    scope
  );
  const [employees, shifts] = await Promise.all([
    employeeModel.selectOptions(),
    shiftModel.selectOptions(),
  ]);
  return res.render(LIST_VIEW, {
    title: 'Phân ca làm việc',
    schedules: result.rows,
    employees,
    shifts,
    query,
    pagination: result,
    basePath: '/schedules',
    filterQuery: queryString(query),
  });
});

const create = asyncHandler(async (req, res) => {
  return res.render(FORM_VIEW, {
    title: 'Thêm lịch phân ca',
    item: null,
    ...(await formLocals(null, res.locals.oldInput)),
  });
});

function requestData(req) {
  return {
    employee_id: Number(req.body.employee_id),
    shift_id: Number(req.body.shift_id),
    work_date: String(req.body.work_date || '').trim(),
    note: sanitizeText(req.body.note),
  };
}

async function validateReferences(data, res, item = null, oldValues = {}) {
  if (hasErrors(res)) return formLocals(item, oldValues);
  const [employee, shift, duplicate] = await Promise.all([
    employeeModel.findById(data.employee_id),
    shiftModel.findById(data.shift_id),
    scheduleModel.findByEmployeeDate(data.employee_id, data.work_date, item ? item.id : null),
  ]);
  const errors = [];
  if (!employee || employee.status === 'Nghỉ việc') {
    errors.push({ field: 'employee_id', message: 'Nhân viên không hợp lệ hoặc đã nghỉ việc.' });
  }
  if (!shift) errors.push({ field: 'shift_id', message: 'Ca làm việc không hợp lệ.' });
  if (duplicate) errors.push({ field: 'work_date', message: 'Nhân viên này đã có ca làm việc trong ngày chọn.' });
  if (!errors.length) return null;
  res.locals.validationErrors = errors;
  return formLocals(item, oldValues);
}

const store = asyncHandler(async (req, res) => {
  const data = requestData(req);
  const invalid = await validateReferences(data, res, null, req.body);
  if (invalid) {
    return res.render(FORM_VIEW, { title: 'Thêm lịch phân ca', item: null, ...invalid });
  }
  const created = await scheduleModel.create(data);
  await audit('CREATE', 'shift_schedules')(req, { recordId: created.id, newValue: data });
  req.flash('success', `Đã phân ca ${created.full_name} vào ngày ${created.work_date}.`);
  return res.redirect('/schedules');
});

const edit = asyncHandler(async (req, res) => {
  const item = await scheduleModel.findById(req.params.id);
  if (!item) throw new AppError('Không tìm thấy lịch phân ca.', 404);
  return res.render(FORM_VIEW, {
    title: 'Chỉnh sửa lịch phân ca',
    item,
    ...(await formLocals(item, res.locals.oldInput)),
  });
});

const update = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const before = await scheduleModel.findById(id);
  if (!before) throw new AppError('Không tìm thấy lịch phân ca.', 404);
  const data = requestData(req);
  const invalid = await validateReferences(data, res, before, req.body);
  if (invalid) {
    return res.render(FORM_VIEW, { title: 'Chỉnh sửa lịch phân ca', item: before, ...invalid });
  }
  const after = await scheduleModel.update(id, data);
  await audit('UPDATE', 'shift_schedules')(req, { recordId: id, oldValue: before, newValue: after });
  req.flash('success', 'Cập nhật lịch phân ca thành công.');
  return res.redirect('/schedules');
});

const destroy = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const before = await scheduleModel.findById(id);
  if (!before) throw new AppError('Không tìm thấy lịch phân ca.', 404);
  await scheduleModel.remove(id);
  await audit('DELETE', 'shift_schedules')(req, { recordId: id, oldValue: before });
  req.flash('success', 'Đã xóa lịch phân ca.');
  return res.redirect('/schedules');
});

module.exports = { index, create, store, edit, update, destroy };
