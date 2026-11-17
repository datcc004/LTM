'use strict';

/** Loại phép: danh mục dùng cho đơn nghỉ và quỹ phép. */

const leaveTypeModel = require('../models/leaveType.model');
const { hasErrors } = require('../middlewares/validate');
const { audit } = require('../middlewares/audit');
const { asyncHandler, AppError, sanitizeText, getPagination } = require('../utils/helpers');

const LIST_VIEW = 'leave-types/index';
const FORM_VIEW = 'leave-types/form';

function buildQuery(req) {
  const isActive = String(req.query.is_active || '');
  return {
    q: String(req.query.q || '').trim(),
    is_active: ['0', '1'].includes(isActive) ? isActive : '',
  };
}

function requestData(req) {
  const max = String(req.body.max_days_per_year || '').trim();
  return {
    code: sanitizeText(req.body.code).toUpperCase().replace(/\s+/g, '_'),
    name: sanitizeText(req.body.name),
    is_paid: req.body.is_paid === '1',
    max_days_per_year: max === '' ? null : Number(max),
    requires_approval: req.body.requires_approval === '1',
    is_active: req.body.is_active === '1',
    color: sanitizeText(req.body.color),
  };
}

function formValues(item, oldInput = {}) {
  const base = item
    ? { ...item, max_days_per_year: item.max_days_per_year === null ? '' : item.max_days_per_year }
    : { code: '', name: '', is_paid: true, max_days_per_year: 12, requires_approval: true, is_active: true, color: '#2563eb' };
  return { ...base, ...oldInput };
}

async function checkCode(data, res, excludeId = null) {
  if (hasErrors(res)) return false;
  const duplicate = await leaveTypeModel.findByCode(data.code, excludeId);
  if (duplicate) {
    res.locals.validationErrors = [{ field: 'code', message: 'Mã loại phép đã tồn tại.' }];
    return false;
  }
  return true;
}

const index = asyncHandler(async (req, res) => {
  const query = buildQuery(req);
  const paging = getPagination(req.query, 20, 100);
  const pageResult = await leaveTypeModel.list(query, { ...req.query, page: paging.page, limit: paging.limit });
  return res.render(LIST_VIEW, {
    title: 'Loại phép',
    records: pageResult.rows,
    query,
    pagination: pageResult,
    basePath: '/leave-types',
    filterQuery: queryString(query),
  });
});

function queryString(query) {
  const params = new URLSearchParams();
  for (const key of ['q', 'is_active']) if (query[key]) params.set(key, query[key]);
  return params.toString();
}

const create = asyncHandler(async (req, res) => {
  return res.render(FORM_VIEW, {
    title: 'Thêm loại phép',
    item: null,
    values: formValues(null, res.locals.oldInput),
  });
});

const store = asyncHandler(async (req, res) => {
  const data = requestData(req);
  if (!(await checkCode(data, res))) {
    return res.render(FORM_VIEW, { title: 'Thêm loại phép', item: null, values: formValues(null, req.body) });
  }
  const created = await leaveTypeModel.create(data);
  await audit('CREATE', 'leave_types')(req, { recordId: created.id, newValue: created });
  req.flash('success', `Đã thêm loại phép "${created.name}".`);
  return res.redirect('/leave-types');
});

const edit = asyncHandler(async (req, res) => {
  const item = await leaveTypeModel.findById(req.params.id);
  if (!item) throw new AppError('Không tìm thấy loại phép.', 404);
  return res.render(FORM_VIEW, {
    title: 'Chỉnh sửa loại phép',
    item,
    values: formValues(item, res.locals.oldInput),
  });
});

const update = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const before = await leaveTypeModel.findById(id);
  if (!before) throw new AppError('Không tìm thấy loại phép.', 404);
  const data = requestData(req);
  if (!(await checkCode(data, res, id))) {
    return res.render(FORM_VIEW, { title: 'Chỉnh sửa loại phép', item: before, values: formValues(before, req.body) });
  }
  const after = await leaveTypeModel.update(id, data);
  await audit('UPDATE', 'leave_types')(req, { recordId: id, oldValue: before, newValue: after });
  req.flash('success', `Cập nhật loại phép "${after.name}".`);
  return res.redirect('/leave-types');
});

const destroy = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const before = await leaveTypeModel.findById(id);
  if (!before) throw new AppError('Không tìm thấy loại phép.', 404);
  const usage = await leaveTypeModel.countUsage(id);
  if (Number(usage?.requests || 0) > 0 || Number(usage?.balances || 0) > 0) {
    req.flash('error', 'Không thể xóa loại phép đang có đơn nghỉ hoặc quỹ phép.');
    return res.redirect('/leave-types');
  }
  await leaveTypeModel.remove(id);
  await audit('DELETE', 'leave_types')(req, { recordId: id, oldValue: before });
  req.flash('success', 'Đã xóa loại phép.');
  return res.redirect('/leave-types');
});

module.exports = {
  index, create, store, edit, update, destroy,
};
