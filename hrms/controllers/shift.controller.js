'use strict';

/** CRUD ca làm việc. */

const shiftModel = require('../models/shift.model');
const { hasErrors } = require('../middlewares/validate');
const { audit } = require('../middlewares/audit');
const {
  asyncHandler, AppError, sanitizeText, getPagination,
} = require('../utils/helpers');

const LIST_VIEW = 'shifts/index';
const FORM_VIEW = 'shifts/form';

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

function normalizeClock(value) {
  const text = String(value || '').trim();
  return /^\d{2}:\d{2}$/.test(text) ? `${text}:00` : text;
}

function formValues(item, oldInput = {}) {
  return {
    code: '', name: '', start_time: '08:00', end_time: '17:00',
    break_minutes: 60, work_hours: 8,
    late_tolerance_minutes: 15, early_tolerance_minutes: 15,
    is_overnight: 0, color: '', is_active: 1,
    ...(item || {}),
    ...oldInput,
  };
}

const index = asyncHandler(async (req, res) => {
  const query = buildQuery(req);
  const paging = getPagination(req.query, 20, 100);
  const result = await shiftModel.list(query, { ...req.query, page: paging.page, limit: paging.limit });
  return res.render(LIST_VIEW, {
    title: 'Ca làm việc',
    shifts: result.rows,
    query,
    pagination: result,
    basePath: '/shifts',
    filterQuery: queryString(query),
  });
});

const create = asyncHandler(async (req, res) => {
  return res.render(FORM_VIEW, {
    title: 'Thêm ca làm việc',
    item: null,
    values: formValues(null, res.locals.oldInput),
  });
});

function requestData(req) {
  return {
    code: sanitizeText(req.body.code).toUpperCase(),
    name: sanitizeText(req.body.name),
    start_time: normalizeClock(req.body.start_time),
    end_time: normalizeClock(req.body.end_time),
    break_minutes: Number(req.body.break_minutes),
    work_hours: Number(req.body.work_hours),
    late_tolerance_minutes: Number(req.body.late_tolerance_minutes),
    early_tolerance_minutes: Number(req.body.early_tolerance_minutes),
    is_overnight: req.body.is_overnight === '1' ? 1 : 0,
    color: sanitizeText(req.body.color),
    is_active: req.body.is_active === '1' ? 1 : 0,
  };
}

const store = asyncHandler(async (req, res) => {
  if (hasErrors(res)) {
    return res.render(FORM_VIEW, { title: 'Thêm ca làm việc', item: null, values: formValues(null, res.locals.oldInput) });
  }
  const data = requestData(req);
  if (await shiftModel.findByCode(data.code)) {
    res.locals.validationErrors = [{ field: 'code', message: 'Mã ca làm việc này đã tồn tại.' }];
    return res.render(FORM_VIEW, { title: 'Thêm ca làm việc', item: null, values: formValues(null, req.body) });
  }
  try {
    const created = await shiftModel.create(data);
    await audit('CREATE', 'shifts')(req, { recordId: created.id, newValue: data });
    req.flash('success', `Đã thêm ca làm việc “${data.name}”.`);
    return res.redirect('/shifts');
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.locals.validationErrors = [{ field: 'code', message: 'Mã ca làm việc này đã tồn tại.' }];
      return res.render(FORM_VIEW, { title: 'Thêm ca làm việc', item: null, values: formValues(null, req.body) });
    }
    throw error;
  }
});

const edit = asyncHandler(async (req, res) => {
  const item = await shiftModel.findById(req.params.id);
  if (!item) throw new AppError('Không tìm thấy ca làm việc.', 404);
  return res.render(FORM_VIEW, { title: 'Chỉnh sửa ca làm việc', item, values: formValues(item, res.locals.oldInput) });
});

const update = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const before = await shiftModel.findById(id);
  if (!before) throw new AppError('Không tìm thấy ca làm việc.', 404);
  if (hasErrors(res)) {
    return res.render(FORM_VIEW, { title: 'Chỉnh sửa ca làm việc', item: before, values: formValues(before, res.locals.oldInput) });
  }
  const data = requestData(req);
  if (await shiftModel.findByCode(data.code, id)) {
    res.locals.validationErrors = [{ field: 'code', message: 'Mã ca làm việc này đã tồn tại.' }];
    return res.render(FORM_VIEW, { title: 'Chỉnh sửa ca làm việc', item: before, values: formValues(before, req.body) });
  }
  try {
    const after = await shiftModel.update(id, data);
    await audit('UPDATE', 'shifts')(req, { recordId: id, oldValue: before, newValue: after });
    req.flash('success', 'Cập nhật ca làm việc thành công.');
    return res.redirect('/shifts');
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.locals.validationErrors = [{ field: 'code', message: 'Mã ca làm việc này đã tồn tại.' }];
      return res.render(FORM_VIEW, { title: 'Chỉnh sửa ca làm việc', item: before, values: formValues(before, req.body) });
    }
    throw error;
  }
});

const destroy = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const before = await shiftModel.findById(id);
  if (!before) throw new AppError('Không tìm thấy ca làm việc.', 404);
  await shiftModel.remove(id);
  await audit('DELETE', 'shifts')(req, { recordId: id, oldValue: before });
  req.flash('success', `Đã xóa ca làm việc “${before.name}”.`);
  return res.redirect('/shifts');
});

module.exports = { index, create, store, edit, update, destroy };
