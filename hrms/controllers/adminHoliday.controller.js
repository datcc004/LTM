'use strict';

/** Quản lý ngày lễ (ADMIN_ONLY). */

const holidayModel = require('../models/holiday.model');
const adminService = require('../services/admin.service');
const { hasErrors } = require('../middlewares/validate');
const { audit } = require('../middlewares/audit');
const {
  asyncHandler, AppError, getPagination, today, formatDate,
} = require('../utils/helpers');

const LIST_VIEW = 'admin/holidays/index';
const FORM_VIEW = 'admin/holidays/form';

function buildQuery(req) {
  return {
    q: String(req.query.q || '').trim(),
    year: /^\d{4}$/.test(String(req.query.year || '')) ? String(req.query.year) : String(today().year()),
  };
}

function queryString(query) {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.year) params.set('year', query.year);
  return params.toString();
}

const index = asyncHandler(async (req, res) => {
  const query = buildQuery(req);
  const paging = getPagination(req.query, 20, 100);
  const result = await holidayModel.list(query, { ...req.query, page: paging.page, limit: paging.limit });
  return res.render(LIST_VIEW, {
    title: 'Ngày lễ',
    holidays: result.rows,
    query,
    pagination: result,
    basePath: '/admin/holidays',
    filterQuery: queryString(query),
  });
});

const create = asyncHandler(async (req, res) => {
  return res.render(FORM_VIEW, {
    title: 'Thêm ngày lễ',
    item: null,
    values: { name: '', holiday_date: '', is_recurring: 0, note: '' },
  });
});

const store = asyncHandler(async (req, res) => {
  if (hasErrors(res)) {
    return res.render(FORM_VIEW, { title: 'Thêm ngày lễ', item: null, values: { ...req.body } });
  }

  let data;
  try {
    data = adminService.normalizeHoliday(req.body);
  } catch (error) {
    res.locals.validationErrors = [{ field: 'holiday_date', message: error.message }];
    return res.render(FORM_VIEW, { title: 'Thêm ngày lễ', item: null, values: { ...req.body } });
  }

  if (await holidayModel.existsOnDate(data.holiday_date)) {
    res.locals.validationErrors = [{ field: 'holiday_date', message: 'Ngày lễ này đã tồn tại.' }];
    return res.render(FORM_VIEW, { title: 'Thêm ngày lễ', item: null, values: { ...req.body } });
  }

  try {
    const created = await holidayModel.create(data);
    await audit('CREATE', 'holidays')(req, { recordId: created.id, newValue: data });
    req.flash('success', `Đã thêm ngày lễ “${data.name}”.`);
    return res.redirect('/admin/holidays');
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.locals.validationErrors = [{ field: 'holiday_date', message: 'Ngày lễ này đã tồn tại.' }];
      return res.render(FORM_VIEW, { title: 'Thêm ngày lễ', item: null, values: { ...req.body } });
    }
    throw error;
  }
});

const edit = asyncHandler(async (req, res) => {
  const item = await holidayModel.findById(req.params.id);
  if (!item) throw new AppError('Không tìm thấy ngày lễ.', 404);
  return res.render(FORM_VIEW, {
    title: 'Chỉnh sửa ngày lễ',
    item,
    values: { ...item, holiday_date: formatDate(item.holiday_date, 'YYYY-MM-DD') === '—' ? '' : formatDate(item.holiday_date, 'YYYY-MM-DD') },
  });
});

const update = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const before = await holidayModel.findById(id);
  if (!before) throw new AppError('Không tìm thấy ngày lễ.', 404);

  if (hasErrors(res)) {
    return res.render(FORM_VIEW, { title: 'Chỉnh sửa ngày lễ', item: before, values: { ...req.body } });
  }

  let data;
  try {
    data = adminService.normalizeHoliday(req.body);
  } catch (error) {
    res.locals.validationErrors = [{ field: 'holiday_date', message: error.message }];
    return res.render(FORM_VIEW, { title: 'Chỉnh sửa ngày lễ', item: before, values: { ...req.body } });
  }

  try {
    const after = await holidayModel.update(id, data);
    await audit('UPDATE', 'holidays')(req, { recordId: id, oldValue: before, newValue: after });
    req.flash('success', 'Cập nhật ngày lễ thành công.');
    return res.redirect('/admin/holidays');
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.locals.validationErrors = [{ field: 'holiday_date', message: 'Ngày lễ này đã tồn tại.' }];
      return res.render(FORM_VIEW, { title: 'Chỉnh sửa ngày lễ', item: before, values: { ...req.body } });
    }
    throw error;
  }
});

const destroy = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const before = await holidayModel.findById(id);
  if (!before) throw new AppError('Không tìm thấy ngày lễ.', 404);
  await holidayModel.remove(id);
  await audit('DELETE', 'holidays')(req, { recordId: id, oldValue: before });
  req.flash('success', `Đã xóa ngày lễ “${before.name}”.`);
  return res.redirect('/admin/holidays');
});

module.exports = { index, create, store, edit, update, destroy };
