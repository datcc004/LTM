'use strict';

/** CRUD nhân viên: tạo mã NV tự động, upload avatar, xóa mềm sang "Nghỉ việc". */

const employeeModel = require('../models/employee.model');
const departmentModel = require('../models/department.model');
const positionModel = require('../models/position.model');
const contractModel = require('../models/contract.model');
const { uploadAvatar, removeUpload } = require('../config/multer');
const { hasErrors } = require('../middlewares/validate');
const { audit } = require('../middlewares/audit');
const {
  asyncHandler, AppError, sanitizeText, getPagination, today, formatDate, formatMoney,
} = require('../utils/helpers');

const LIST_VIEW = 'employees/index';
const FORM_VIEW = 'employees/form';
const SHOW_VIEW = 'employees/show';
const STATUSES = ['Đang làm việc', 'Tạm nghỉ', 'Nghỉ việc'];

function emptyToNull(value) {
  const text = sanitizeText(value);
  return text ? text : null;
}

function buildQuery(req) {
  return {
    q: String(req.query.q || '').trim(),
    department_id: /^\d+$/.test(String(req.query.department_id || '')) ? String(req.query.department_id) : '',
    position_id: /^\d+$/.test(String(req.query.position_id || '')) ? String(req.query.position_id) : '',
    status: STATUSES.includes(String(req.query.status || '')) ? String(req.query.status) : '',
  };
}

function queryString(query) {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.department_id) params.set('department_id', query.department_id);
  if (query.position_id) params.set('position_id', query.position_id);
  if (query.status) params.set('status', query.status);
  return params.toString();
}

const index = asyncHandler(async (req, res) => {
  const query = buildQuery(req);
  const paging = getPagination(req.query, 20, 100);
  const result = await employeeModel.list(query, { ...req.query, page: paging.page, limit: paging.limit });
  return res.render(LIST_VIEW, {
    title: 'Danh sách nhân viên',
    employees: result.rows,
    query,
    departments: await departmentModel.selectOptions(),
    positions: await positionModel.selectOptions(),
    pagination: result,
    basePath: '/employees',
    filterQuery: queryString(query),
  });
});

async function formLocals(item = null) {
  const departmentId = item ? item.department_id : null;
  return {
    title: item ? 'Chỉnh sửa nhân viên' : 'Thêm nhân viên',
    item: item || null,
    values: item ? { ...item } : {
      full_name: '', gender: 'Nam', date_of_birth: '', phone: '', email: '',
      address: '', id_card: '', department_id: '', position_id: '',
      manager_id: '', hire_date: today().format('YYYY-MM-DD'), status: 'Đang làm việc',
    },
    departments: await departmentModel.selectOptions(),
    positions: await positionModel.selectOptions(departmentId),
    managers: await employeeModel.selectOptions(item ? item.id : null),
  };
}

function collectData(req, existing = null) {
  return {
    full_name: sanitizeText(req.body.full_name),
    gender: req.body.gender,
    date_of_birth: emptyToNull(req.body.date_of_birth),
    phone: emptyToNull(req.body.phone),
    email: emptyToNull(req.body.email),
    address: emptyToNull(req.body.address),
    id_card: emptyToNull(req.body.id_card),
    department_id: Number(req.body.department_id),
    position_id: Number(req.body.position_id),
    manager_id: req.body.manager_id ? Number(req.body.manager_id) : null,
    hire_date: req.body.hire_date,
    status: req.body.status,
    avatar_path: req.file
      ? `/uploads/avatars/${req.file.filename}`
      : (existing ? existing.avatar_path : null),
  };
}

const create = asyncHandler(async (req, res) => {
  const locals = await formLocals(null);
  return res.render(FORM_VIEW, { ...locals, values: { ...locals.values, ...res.locals.oldInput } });
});

const store = asyncHandler(async (req, res) => {
  if (hasErrors(res)) {
    const locals = await formLocals(null);
    if (req.file) removeUpload(`/uploads/avatars/${req.file.filename}`);
    return res.render(FORM_VIEW, { ...locals, values: { ...locals.values, ...res.locals.oldInput } });
  }

  const data = collectData(req);
  if (data.id_card && await employeeModel.findByIdCard(data.id_card)) {
    if (req.file) removeUpload(`/uploads/avatars/${req.file.filename}`);
    res.locals.validationErrors = [{ field: 'id_card', message: 'Số CCCD/CMND này đã được sử dụng.' }];
    const locals = await formLocals(null);
    return res.render(FORM_VIEW, { ...locals, values: { ...locals.values, ...req.body } });
  }

  try {
    const created = await employeeModel.create(data);
    await audit('CREATE', 'employees')(req, { recordId: created.id, newValue: data });
    req.flash('success', `Đã thêm nhân viên ${created.employee_code} - ${data.full_name}.`);
    return res.redirect(`/employees/${created.id}`);
  } catch (error) {
    if (req.file) removeUpload(`/uploads/avatars/${req.file.filename}`);
    if (error.code === 'ER_DUP_ENTRY') {
      res.locals.validationErrors = [{ field: 'id_card', message: 'Số CCCD/CMND này đã được sử dụng.' }];
      const locals = await formLocals(null);
      return res.render(FORM_VIEW, { ...locals, values: { ...locals.values, ...req.body } });
    }
    throw error;
  }
});

const show = asyncHandler(async (req, res) => {
  const item = await employeeModel.findById(req.params.id);
  if (!item) throw new AppError('Không tìm thấy nhân viên.', 404);
  const contractResult = await contractModel.list({ employee_id: item.id }, { limit: 100 });
  return res.render(SHOW_VIEW, {
    title: `Hồ sơ - ${item.full_name}`,
    employee: {
      ...item,
      date_of_birth: formatDate(item.date_of_birth),
      hire_date: formatDate(item.hire_date),
    },
    contracts: contractResult.rows.map((row) => ({
      ...row,
      start_date: formatDate(row.start_date),
      end_date: formatDate(row.end_date),
      salary_base: formatMoney(row.salary_base),
    })),
  });
});

const edit = asyncHandler(async (req, res) => {
  const item = await employeeModel.findById(req.params.id);
  if (!item) throw new AppError('Không tìm thấy nhân viên.', 404);
  const locals = await formLocals(item);
  return res.render(FORM_VIEW, { ...locals, values: { ...item, ...res.locals.oldInput } });
});

const update = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const before = await employeeModel.findById(id);
  if (!before) throw new AppError('Không tìm thấy nhân viên.', 404);

  if (hasErrors(res)) {
    const locals = await formLocals(before);
    if (req.file) removeUpload(`/uploads/avatars/${req.file.filename}`);
    return res.render(FORM_VIEW, { ...locals, values: { ...before, ...res.locals.oldInput } });
  }

  const data = collectData(req, before);
  if (data.manager_id === id) {
    if (req.file) removeUpload(`/uploads/avatars/${req.file.filename}`);
    res.locals.validationErrors = [{ field: 'manager_id', message: 'Nhân viên không thể là quản lý của chính mình.' }];
    const locals = await formLocals(before);
    return res.render(FORM_VIEW, { ...locals, values: { ...before, ...req.body } });
  }
  if (data.id_card && await employeeModel.findByIdCard(data.id_card, id)) {
    if (req.file) removeUpload(`/uploads/avatars/${req.file.filename}`);
    res.locals.validationErrors = [{ field: 'id_card', message: 'Số CCCD/CMND này đã được sử dụng.' }];
    const locals = await formLocals(before);
    return res.render(FORM_VIEW, { ...locals, values: { ...before, ...req.body } });
  }

  try {
    const after = await employeeModel.update(id, data);
    if (req.file && before.avatar_path) removeUpload(before.avatar_path);
    await audit('UPDATE', 'employees')(req, { recordId: id, oldValue: before, newValue: after });
    req.flash('success', 'Cập nhật hồ sơ nhân viên thành công.');
    return res.redirect(`/employees/${id}`);
  } catch (error) {
    if (req.file) removeUpload(`/uploads/avatars/${req.file.filename}`);
    if (error.code === 'ER_DUP_ENTRY') {
      res.locals.validationErrors = [{ field: 'id_card', message: 'Số CCCD/CMND này đã được sử dụng.' }];
      const locals = await formLocals(before);
      return res.render(FORM_VIEW, { ...locals, values: { ...before, ...req.body } });
    }
    throw error;
  }
});

/** Xóa mềm: chuyển trạng thái sang Nghỉ việc để giữ toàn bộ dữ liệu lịch sử. */
const destroy = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const before = await employeeModel.findById(id);
  if (!before) throw new AppError('Không tìm thấy nhân viên.', 404);
  const after = await employeeModel.setStatus(id, 'Nghỉ việc');
  await audit('UPDATE', 'employees')(req, {
    recordId: id,
    oldValue: { status: before.status },
    newValue: { status: after.status, reason: 'Xóa hồ sơ (soft delete)' },
  });
  req.flash('success', `${before.employee_code} đã chuyển sang trạng thái “Nghỉ việc”. Dữ liệu lịch sử vẫn được giữ lại.`);
  return res.redirect('/employees');
});

const restore = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const before = await employeeModel.findById(id);
  if (!before) throw new AppError('Không tìm thấy nhân viên.', 404);
  const after = await employeeModel.setStatus(id, 'Đang làm việc');
  await audit('UPDATE', 'employees')(req, {
    recordId: id,
    oldValue: { status: before.status },
    newValue: { status: after.status, reason: 'Khôi phục hồ sơ' },
  });
  req.flash('success', `Đã khôi phục nhân viên ${before.employee_code} về trạng thái “Đang làm việc”.`);
  return res.redirect(`/employees/${id}`);
});

module.exports = {
  uploadAvatar,
  index,
  create,
  store,
  show,
  edit,
  update,
  destroy,
  restore,
};
