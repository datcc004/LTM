'use strict';

/** CRUD chức vụ. */

const positionModel = require('../models/position.model');
const departmentModel = require('../models/department.model');
const { hasErrors } = require('../middlewares/validate');
const { audit } = require('../middlewares/audit');
const { asyncHandler, AppError, sanitizeText, getPagination } = require('../utils/helpers');

const LIST_VIEW = 'positions/index';
const FORM_VIEW = 'positions/form';

function buildQuery(req) {
  return {
    q: String(req.query.q || '').trim(),
    department_id: /^\d+$/.test(String(req.query.department_id || '')) ? String(req.query.department_id) : '',
    is_active: ['0', '1'].includes(String(req.query.is_active || '')) ? String(req.query.is_active) : '',
  };
}

function queryString(query) {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.department_id) params.set('department_id', query.department_id);
  if (query.is_active) params.set('is_active', query.is_active);
  return params.toString();
}

const index = asyncHandler(async (req, res) => {
  const query = buildQuery(req);
  const paging = getPagination(req.query, 20, 100);
  const result = await positionModel.list(query, { ...req.query, page: paging.page, limit: paging.limit });
  return res.render(LIST_VIEW, {
    title: 'Chức vụ',
    positions: result.rows,
    query,
    departments: await departmentModel.selectOptions(),
    pagination: result,
    basePath: '/positions',
    filterQuery: queryString(query),
  });
});

async function formLocals(item = null) {
  return {
    title: item ? 'Chỉnh sửa chức vụ' : 'Thêm chức vụ',
    item: item || null,
    values: item ? { ...item } : { code: '', name: '', department_id: '', is_active: 1 },
    departments: await departmentModel.selectOptions(),
  };
}

const create = asyncHandler(async (req, res) => {
  const locals = await formLocals(null);
  return res.render(FORM_VIEW, { ...locals, values: { ...locals.values, ...res.locals.oldInput } });
});

const store = asyncHandler(async (req, res) => {
  if (hasErrors(res)) {
    const locals = await formLocals(null);
    return res.render(FORM_VIEW, { ...locals, values: { ...locals.values, ...res.locals.oldInput } });
  }

  const data = {
    code: sanitizeText(req.body.code).toUpperCase(),
    name: sanitizeText(req.body.name),
    department_id: req.body.department_id ? Number(req.body.department_id) : null,
    is_active: req.body.is_active === '1',
  };

  if (await positionModel.findByCode(data.code)) {
    res.locals.validationErrors = [{ field: 'code', message: 'Mã chức vụ này đã tồn tại.' }];
    const locals = await formLocals(null);
    return res.render(FORM_VIEW, { ...locals, values: { ...locals.values, ...req.body } });
  }

  try {
    const created = await positionModel.create(data);
    await audit('CREATE', 'positions')(req, { recordId: created.id, newValue: data });
    req.flash('success', `Đã thêm chức vụ “${data.name}”.`);
    return res.redirect('/positions');
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.locals.validationErrors = [{ field: 'code', message: 'Mã chức vụ này đã tồn tại.' }];
      const locals = await formLocals(null);
      return res.render(FORM_VIEW, { ...locals, values: { ...locals.values, ...req.body } });
    }
    throw error;
  }
});

const edit = asyncHandler(async (req, res) => {
  const item = await positionModel.findById(req.params.id);
  if (!item) throw new AppError('Không tìm thấy chức vụ.', 404);
  const locals = await formLocals(item);
  return res.render(FORM_VIEW, { ...locals, values: { ...item, ...res.locals.oldInput } });
});

const update = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const before = await positionModel.findById(id);
  if (!before) throw new AppError('Không tìm thấy chức vụ.', 404);

  if (hasErrors(res)) {
    const locals = await formLocals(before);
    return res.render(FORM_VIEW, { ...locals, values: { ...before, ...res.locals.oldInput } });
  }

  const data = {
    code: sanitizeText(req.body.code).toUpperCase(),
    name: sanitizeText(req.body.name),
    department_id: req.body.department_id ? Number(req.body.department_id) : null,
    is_active: req.body.is_active === '1',
  };

  if (await positionModel.findByCode(data.code, id)) {
    res.locals.validationErrors = [{ field: 'code', message: 'Mã chức vụ này đã tồn tại.' }];
    const locals = await formLocals(before);
    return res.render(FORM_VIEW, { ...locals, values: { ...before, ...req.body } });
  }

  try {
    const after = await positionModel.update(id, data);
    await audit('UPDATE', 'positions')(req, { recordId: id, oldValue: before, newValue: after });
    req.flash('success', 'Cập nhật chức vụ thành công.');
    return res.redirect('/positions');
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.locals.validationErrors = [{ field: 'code', message: 'Mã chức vụ này đã tồn tại.' }];
      const locals = await formLocals(before);
      return res.render(FORM_VIEW, { ...locals, values: { ...before, ...req.body } });
    }
    throw error;
  }
});

const destroy = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const before = await positionModel.findById(id);
  if (!before) throw new AppError('Không tìm thấy chức vụ.', 404);
  await positionModel.remove(id);
  await audit('DELETE', 'positions')(req, { recordId: id, oldValue: before });
  req.flash('success', `Đã xóa chức vụ “${before.name}”.`);
  return res.redirect('/positions');
});

module.exports = { index, create, store, edit, update, destroy };
