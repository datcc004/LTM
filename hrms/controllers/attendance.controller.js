'use strict';

/** Bảng công: xem, tạo/sửa bản ghi và duyệt công. */

const attendanceModel = require('../models/attendance.model');
const employeeModel = require('../models/employee.model');
const departmentModel = require('../models/department.model');
const shiftModel = require('../models/shift.model');
const scheduleModel = require('../models/schedule.model');
const attendanceService = require('../services/attendance.service');
const { hasErrors } = require('../middlewares/validate');
const { audit } = require('../middlewares/audit');
const { employeeScope, canApproveFor } = require('../middlewares/role');
const {
  asyncHandler, AppError, sanitizeText, getPagination,
} = require('../utils/helpers');

const LIST_VIEW = 'attendance/index';
const FORM_VIEW = 'attendance/form';

function today() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function buildQuery(req) {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  return {
    q: String(req.query.q || '').trim(),
    employee_id: /^\d+$/.test(String(req.query.employee_id || '')) ? String(req.query.employee_id) : '',
    department_id: /^\d+$/.test(String(req.query.department_id || '')) ? String(req.query.department_id) : '',
    shift_id: /^\d+$/.test(String(req.query.shift_id || '')) ? String(req.query.shift_id) : '',
    status: attendanceService.STATUSES.includes(req.query.status) ? String(req.query.status) : '',
    from_date: datePattern.test(String(req.query.from_date || '')) ? String(req.query.from_date) : '',
    to_date: datePattern.test(String(req.query.to_date || '')) ? String(req.query.to_date) : '',
    is_approved: ['0', '1'].includes(String(req.query.is_approved || '')) ? String(req.query.is_approved) : '',
  };
}

function queryString(query) {
  const params = new URLSearchParams();
  for (const key of ['q', 'employee_id', 'department_id', 'shift_id', 'status', 'from_date', 'to_date', 'is_approved']) {
    if (query[key]) params.set(key, query[key]);
  }
  return params.toString();
}

function formValues(item, oldInput = {}) {
  const base = item ? {
    ...item,
    check_in: attendanceService.formatDateTimeInput(item.check_in),
    check_out: attendanceService.formatDateTimeInput(item.check_out),
  } : {
    employee_id: '', work_date: today(),
    shift_id: '', check_in: '', check_out: '', source: 'Thủ công', note: '',
  };
  return { ...base, ...oldInput };
}

async function formLocals(item = null, oldInput = {}) {
  const [employees, shifts, departments] = await Promise.all([
    employeeModel.selectOptions(),
    shiftModel.selectOptions(),
    departmentModel.selectOptions(),
  ]);
  return { employees, shifts, departments, values: formValues(item, oldInput) };
}

const index = asyncHandler(async (req, res) => {
  const query = buildQuery(req);
  const paging = getPagination(req.query, 20, 100);
  const scope = employeeScope(req, 'e');
  const pageResult = await attendanceModel.list(
    query,
    { ...req.query, page: paging.page, limit: paging.limit },
    scope
  );
  const summary = await attendanceModel.summary(query, scope);
  const [employees, departments, shifts] = await Promise.all([
    employeeModel.selectOptions(),
    departmentModel.selectOptions(),
    shiftModel.selectOptions(),
  ]);
  return res.render(LIST_VIEW, {
    title: 'Bảng chấm công',
    records: pageResult.rows,
    employees,
    departments,
    shifts,
    query,
    summary,
    pagination: pageResult,
    statuses: attendanceService.STATUSES,
    basePath: '/attendance',
    filterQuery: queryString(query),
  });
});

const create = asyncHandler(async (req, res) => {
  return res.render(FORM_VIEW, {
    title: 'Thêm bản ghi chấm công',
    item: null,
    ...(await formLocals(null, res.locals.oldInput)),
  });
});

function requestData(req) {
  return {
    employee_id: Number(req.body.employee_id),
    work_date: String(req.body.work_date || '').trim(),
    shift_id: req.body.shift_id ? Number(req.body.shift_id) : null,
    schedule_id: req.body.schedule_id ? Number(req.body.schedule_id) : null,
    check_in: attendanceService.normalizeDateTime(req.body.check_in),
    check_out: attendanceService.normalizeDateTime(req.body.check_out),
    source: ['Camera', 'Thủ công', 'Self-service'].includes(req.body.source) ? req.body.source : 'Thủ công',
    note: sanitizeText(req.body.note),
  };
}

async function resolveShift(data, before = null) {
  if (!data.shift_id && before && before.shift_id) data.shift_id = Number(before.shift_id);
  if (!data.schedule_id && before && before.schedule_id) data.schedule_id = Number(before.schedule_id);

  let shift = data.shift_id ? await shiftModel.findById(data.shift_id) : null;
  if (!data.shift_id && !shift) {
    const schedule = await scheduleModel.findByEmployeeDate(data.employee_id, data.work_date);
    if (schedule) {
      data.schedule_id = schedule.id;
      shift = await shiftModel.findById(schedule.shift_id);
    }
  }
  if (data.shift_id && !shift) throw new AppError('Ca làm việc không hợp lệ.', 400);
  return shift;
}

async function validateEmployee(data, res, item = null, oldValues = {}) {
  if (hasErrors(res)) return formLocals(item, oldValues);
  const employee = await employeeModel.findById(data.employee_id);
  if (!employee || employee.status === 'Nghỉ việc') {
    res.locals.validationErrors = [{ field: 'employee_id', message: 'Nhân viên không hợp lệ hoặc đã nghỉ việc.' }];
    return formLocals(item, oldValues);
  }
  const duplicate = await attendanceModel.findByEmployeeDate(data.employee_id, data.work_date, item ? item.id : null);
  if (duplicate) {
    res.locals.validationErrors = [{ field: 'work_date', message: 'Nhân viên này đã có bản ghi công trong ngày chọn.' }];
    return formLocals(item, oldValues);
  }
  return null;
}

const store = asyncHandler(async (req, res) => {
  const data = requestData(req);
  const invalid = await validateEmployee(data, res, null, req.body);
  if (invalid) {
    return res.render(FORM_VIEW, { title: 'Thêm bản ghi chấm công', item: null, ...invalid });
  }
  const shift = await resolveShift(data);
  Object.assign(data, attendanceService.calculate(shift, data.check_in, data.check_out, data.work_date));
  const created = await attendanceModel.save(data);
  await audit('CREATE', 'attendance')(req, { recordId: created.id, newValue: data });
  req.flash('success', `Đã lưu công của ${created.full_name} ngày ${created.work_date} (${created.status}).`);
  return res.redirect('/attendance');
});

const edit = asyncHandler(async (req, res) => {
  const item = await attendanceModel.findById(req.params.id);
  if (!item) throw new AppError('Không tìm thấy bản ghi chấm công.', 404);
  return res.render(FORM_VIEW, {
    title: 'Chỉnh sửa bản ghi chấm công',
    item,
    ...(await formLocals(item, res.locals.oldInput)),
  });
});

const update = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const before = await attendanceModel.findById(id);
  if (!before) throw new AppError('Không tìm thấy bản ghi chấm công.', 404);
  const data = requestData(req);
  const invalid = await validateEmployee(data, res, before, req.body);
  if (invalid) {
    return res.render(FORM_VIEW, { title: 'Chỉnh sửa bản ghi chấm công', item: before, ...invalid });
  }
  const shift = await resolveShift(data, before);
  Object.assign(data, attendanceService.calculate(shift, data.check_in, data.check_out, data.work_date));
  const after = await attendanceModel.save(data, id);
  await audit('UPDATE', 'attendance')(req, { recordId: id, oldValue: before, newValue: after });
  req.flash('success', `Cập nhật công thành ${after.status}.`);
  return res.redirect('/attendance');
});

const approval = asyncHandler(async (req, res) => {
  if (hasErrors(res)) {
    req.flash('error', 'Trạng thái duyệt không hợp lệ.');
    return res.redirect('/attendance');
  }
  const id = Number(req.params.id);
  const before = await attendanceModel.findById(id);
  if (!before) throw new AppError('Không tìm thấy bản ghi chấm công.', 404);
  const employee = { id: before.employee_id, department_id: before.department_id };
  if (!canApproveFor(req, employee)) {
    throw new AppError('Bạn chỉ có thể duyệt công của nhân viên trong phòng ban mình quản lý.', 403);
  }
  const approved = req.body.is_approved === '1';
  const after = await attendanceModel.setApproved(id, approved, req.user.employee_id || null);
  await audit(approved ? 'APPROVE' : 'UNAPPROVE', 'attendance')(req, {
    recordId: id,
    oldValue: { is_approved: before.is_approved },
    newValue: { is_approved: after.is_approved, approved_by: after.approved_by },
  });
  req.flash('success', approved ? 'Đã duyệt bản ghi công.' : 'Đã bỏ duyệt bản ghi công.');
  return res.redirect('/attendance');
});

const destroy = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const before = await attendanceModel.findById(id);
  if (!before) throw new AppError('Không tìm thấy bản ghi chấm công.', 404);
  await attendanceModel.remove(id);
  await audit('DELETE', 'attendance')(req, { recordId: id, oldValue: before });
  req.flash('success', 'Đã xóa bản ghi chấm công.');
  return res.redirect('/attendance');
});

module.exports = {
  index, create, store, edit, update, approval, destroy,
};
