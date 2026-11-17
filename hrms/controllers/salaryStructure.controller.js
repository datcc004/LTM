'use strict';

/** Cấu trúc lương: mỗi nhân viên một bản ghi, dùng khi sinh phiếu lương. */

const salaryStructureModel = require('../models/salaryStructure.model');
const employeeModel = require('../models/employee.model');
const departmentModel = require('../models/department.model');
const { hasErrors } = require('../middlewares/validate');
const { audit } = require('../middlewares/audit');
const { asyncHandler, AppError, sanitizeText, getPagination, today } = require('../utils/helpers');

const LIST_VIEW = 'salary-structures/index';
const FORM_VIEW = 'salary-structures/form';

function buildQuery(req) {
  return {
    q: String(req.query.q || '').trim(),
    department_id: String(req.query.department_id || ''),
  };
}

function queryString(query) {
  const params = new URLSearchParams();
  for (const key of ['q', 'department_id']) if (query[key]) params.set(key, query[key]);
  return params.toString();
}

function requestData(req) {
  return {
    employee_id: Number(req.body.employee_id),
    base_salary: Number(String(req.body.base_salary || '').replace(/[.,]/g, '')),
    allowance: Number(String(req.body.allowance || '').replace(/[.,]/g, '')),
    dependents_count: Number(req.body.dependents_count || 0),
    effective_from: String(req.body.effective_from || ''),
    note: sanitizeText(req.body.note, { maxLength: 255 }),
  };
}

async function formLocals(item, oldInput = {}) {
  const [employees, departments] = await Promise.all([
    employeeModel.selectOptions(),
    departmentModel.selectOptions(),
  ]);
  if (item && !employees.some((row) => Number(row.id) === Number(item.employee_id))) {
    employees.unshift({
      id: item.employee_id,
      employee_code: item.employee_code,
      full_name: item.full_name,
    });
  }
  const base = item
    ? { ...item }
    : {
      employee_id: '',
      base_salary: 0,
      allowance: 0,
      dependents_count: 0,
      effective_from: today().format('YYYY-MM-DD'),
      note: '',
    };
  return { employees, departments, values: { ...base, ...oldInput } };
}

async function checkEmployee(data, res, excludeId = null) {
  if (hasErrors(res)) return false;
  const exists = await salaryStructureModel.findByEmployee(data.employee_id, excludeId);
  if (exists) {
    res.locals.validationErrors = [{ field: 'employee_id', message: 'Nhân viên này đã có cấu trúc lương.' }];
    return false;
  }
  return true;
}

const index = asyncHandler(async (req, res) => {
  const query = buildQuery(req);
  const paging = getPagination(req.query, 20, 100);
  const pageResult = await salaryStructureModel.list(query, { ...req.query, page: paging.page, limit: paging.limit });
  const departments = await departmentModel.selectOptions();
  return res.render(LIST_VIEW, {
    title: 'Cấu trúc lương',
    records: pageResult.rows,
    query,
    departments,
    pagination: pageResult,
    basePath: '/salary-structures',
    filterQuery: queryString(query),
  });
});

const create = asyncHandler(async (req, res) => {
  return res.render(FORM_VIEW, {
    title: 'Thêm cấu trúc lương',
    item: null,
    ...(await formLocals(null, res.locals.oldInput)),
  });
});

const store = asyncHandler(async (req, res) => {
  const data = requestData(req);
  if (!(await checkEmployee(data, res))) {
    return res.render(FORM_VIEW, {
      title: 'Thêm cấu trúc lương', item: null, ...(await formLocals(null, req.body)),
    });
  }
  const created = await salaryStructureModel.create(data);
  await audit('CREATE', 'salary_structures')(req, { recordId: created.id, newValue: created });
  req.flash('success', `Đã thêm cấu trúc lương cho ${created.full_name}.`);
  return res.redirect('/salary-structures');
});

const edit = asyncHandler(async (req, res) => {
  const item = await salaryStructureModel.findById(req.params.id);
  if (!item) throw new AppError('Không tìm thấy cấu trúc lương.', 404);
  return res.render(FORM_VIEW, {
    title: 'Chỉnh sửa cấu trúc lương',
    item,
    ...(await formLocals(item, res.locals.oldInput)),
  });
});

const update = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const before = await salaryStructureModel.findById(id);
  if (!before) throw new AppError('Không tìm thấy cấu trúc lương.', 404);
  const data = requestData(req);
  if (!(await checkEmployee(data, res, id))) {
    return res.render(FORM_VIEW, {
      title: 'Chỉnh sửa cấu trúc lương', item: before, ...(await formLocals(before, req.body)),
    });
  }
  const after = await salaryStructureModel.update(id, data);
  await audit('UPDATE', 'salary_structures')(req, { recordId: id, oldValue: before, newValue: after });
  req.flash('success', `Cập nhật cấu trúc lương của ${after.full_name}.`);
  return res.redirect('/salary-structures');
});

const destroy = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const before = await salaryStructureModel.findById(id);
  if (!before) throw new AppError('Không tìm thấy cấu trúc lương.', 404);
  await salaryStructureModel.remove(id);
  await audit('DELETE', 'salary_structures')(req, { recordId: id, oldValue: before });
  req.flash('success', 'Đã xóa cấu trúc lương.');
  return res.redirect('/salary-structures');
});

module.exports = { index, create, store, edit, update, destroy };
