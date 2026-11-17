'use strict';

/** CRUD phòng ban. */

const departmentModel = require('../models/department.model');
const employeeModel = require('../models/employee.model');
const { hasErrors } = require('../middlewares/validate');
const { audit } = require('../middlewares/audit');
const { asyncHandler, AppError, sanitizeText, getPagination } = require('../utils/helpers');

const LIST_VIEW = 'departments/index';
const FORM_VIEW = 'departments/form';

function buildQuery(req) {
  return {
    q: String(req.query.q || '').trim(),
    is_active: ['0', '1'].includes(String(req.query.is_active || '')) ? String(req.query.is_active) : '',
  };
}

function queryString(query) {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.is_active) params.set('is_active', query.is_active);
  return params.toString();
}

const index = asyncHandler(async (req, res) => {
  const query = buildQuery(req);
  const paging = getPagination(req.query, 20, 100);
  const result = await departmentModel.list(query, { ...req.query, page: paging.page, limit: paging.limit });
  return res.render(LIST_VIEW, {
    title: 'Phòng ban',
    departments: result.rows,
    query,
    pagination: result,
    basePath: '/departments',
    filterQuery: queryString(query),
  });
});

async function formLocals(req, res, item) {
  return {
    title: item ? 'Chỉnh sửa phòng ban' : 'Thêm phòng ban',
    item: item || null,
    values: item ? { ...item } : { code: '', name: '', parent_id: '', manager_id: '', is_active: 1 },
    departments: await departmentModel.selectOptions(item ? item.id : null),
    managers: await employeeModel.selectOptions(),
  };
}

const create = asyncHandler(async (req, res) => {
  const locals = await formLocals(req, res, null);
  return res.render(FORM_VIEW, { ...locals, values: { ...locals.values, ...res.locals.oldInput } });
});

const store = asyncHandler(async (req, res) => {
  if (hasErrors(res)) {
    const locals = await formLocals(req, res, null);
    return res.render(FORM_VIEW, { ...locals, values: { ...locals.values, ...res.locals.oldInput } });
  }

  const data = {
    code: sanitizeText(req.body.code).toUpperCase(),
    name: sanitizeText(req.body.name),
    parent_id: req.body.parent_id ? Number(req.body.parent_id) : null,
    manager_id: req.body.manager_id ? Number(req.body.manager_id) : null,
    is_active: req.body.is_active === '1',
  };

  if (await departmentModel.findByCode(data.code)) {
    res.locals.validationErrors = [{ field: 'code', message: 'Mã phòng ban này đã tồn tại.' }];
    const locals = await formLocals(req, res, null);
    return res.render(FORM_VIEW, { ...locals, values: { ...locals.values, ...req.body } });
  }

  try {
    const created = await departmentModel.create(data);
    await audit('CREATE', 'departments')(req, { recordId: created.id, newValue: data });
    req.flash('success', `Đã thêm phòng ban “${data.name}”.`);
    return res.redirect('/departments');
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.locals.validationErrors = [{ field: 'code', message: 'Mã phòng ban này đã tồn tại.' }];
      const locals = await formLocals(req, res, null);
      return res.render(FORM_VIEW, { ...locals, values: { ...locals.values, ...req.body } });
    }
    throw error;
  }
});

const edit = asyncHandler(async (req, res) => {
  const item = await departmentModel.findById(req.params.id);
  if (!item) throw new AppError('Không tìm thấy phòng ban.', 404);
  const locals = await formLocals(req, res, item);
  return res.render(FORM_VIEW, { ...locals, values: { ...item, ...res.locals.oldInput } });
});

const update = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const before = await departmentModel.findById(id);
  if (!before) throw new AppError('Không tìm thấy phòng ban.', 404);

  if (hasErrors(res)) {
    const locals = await formLocals(req, res, before);
    return res.render(FORM_VIEW, { ...locals, values: { ...before, ...res.locals.oldInput } });
  }

  const data = {
    code: sanitizeText(req.body.code).toUpperCase(),
    name: sanitizeText(req.body.name),
    parent_id: req.body.parent_id ? Number(req.body.parent_id) : null,
    manager_id: req.body.manager_id ? Number(req.body.manager_id) : null,
    is_active: req.body.is_active === '1',
  };

  if (await departmentModel.findByCode(data.code, id)) {
    res.locals.validationErrors = [{ field: 'code', message: 'Mã phòng ban này đã tồn tại.' }];
    const locals = await formLocals(req, res, before);
    return res.render(FORM_VIEW, { ...locals, values: { ...before, ...req.body } });
  }
  if (data.parent_id === id) {
    res.locals.validationErrors = [{ field: 'parent_id', message: 'Phòng ban không thể là phòng ban cha của chính mình.' }];
    const locals = await formLocals(req, res, before);
    return res.render(FORM_VIEW, { ...locals, values: { ...before, ...req.body } });
  }

  try {
    const after = await departmentModel.update(id, data);
    await audit('UPDATE', 'departments')(req, { recordId: id, oldValue: before, newValue: after });
    req.flash('success', 'Cập nhật phòng ban thành công.');
    return res.redirect('/departments');
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.locals.validationErrors = [{ field: 'code', message: 'Mã phòng ban này đã tồn tại.' }];
      const locals = await formLocals(req, res, before);
      return res.render(FORM_VIEW, { ...locals, values: { ...before, ...req.body } });
    }
    throw error;
  }
});

const destroy = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const before = await departmentModel.findById(id);
  if (!before) throw new AppError('Không tìm thấy phòng ban.', 404);
  await departmentModel.remove(id);
  await audit('DELETE', 'departments')(req, { recordId: id, oldValue: before });
  req.flash('success', `Đã xóa phòng ban “${before.name}”.`);
  return res.redirect('/departments');
});

module.exports = { index, create, store, edit, update, destroy };
