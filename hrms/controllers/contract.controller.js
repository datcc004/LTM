'use strict';

/** CRUD hợp đồng: sinh số hợp đồng, tính trạng thái theo hạn, upload tài liệu. */

const contractModel = require('../models/contract.model');
const employeeModel = require('../models/employee.model');
const { uploadDocument, removeUpload } = require('../config/multer');
const { hasErrors } = require('../middlewares/validate');
const { audit } = require('../middlewares/audit');
const {
  asyncHandler, AppError, sanitizeText, getPagination, today, formatDate, formatMoney,
} = require('../utils/helpers');

const LIST_VIEW = 'contracts/index';
const FORM_VIEW = 'contracts/form';

const CONTRACT_TYPES = ['Thử việc', 'Chính thức', 'Thời vụ', 'Hợp đồng dịch vụ'];
const CONTRACT_STATUSES = ['Còn hạn', 'Sắp hết hạn', 'Hết hạn', 'Đã hủy'];

function emptyToNull(value) {
  const text = sanitizeText(value);
  return text ? text : null;
}

function buildQuery(req) {
  return {
    q: String(req.query.q || '').trim(),
    employee_id: /^\d+$/.test(String(req.query.employee_id || '')) ? String(req.query.employee_id) : '',
    status: CONTRACT_STATUSES.includes(String(req.query.status || '')) ? String(req.query.status) : '',
    contract_type: CONTRACT_TYPES.includes(String(req.query.contract_type || '')) ? String(req.query.contract_type) : '',
    expiring: req.query.expiring === '1' ? '1' : '',
  };
}

function queryString(query) {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.employee_id) params.set('employee_id', query.employee_id);
  if (query.status) params.set('status', query.status);
  if (query.contract_type) params.set('contract_type', query.contract_type);
  if (query.expiring) params.set('expiring', query.expiring);
  return params.toString();
}

const index = asyncHandler(async (req, res) => {
  const query = buildQuery(req);
  const paging = getPagination(req.query, 20, 100);
  const result = await contractModel.list(query, { ...req.query, page: paging.page, limit: paging.limit });
  return res.render(LIST_VIEW, {
    title: 'Hợp đồng lao động',
    contracts: result.rows.map((row) => ({
      ...row,
      start_date: formatDate(row.start_date),
      end_date: formatDate(row.end_date),
      signed_date: formatDate(row.signed_date),
      salary: formatMoney(row.salary_base),
    })),
    query,
    employees: await employeeModel.selectOptions(),
    contractTypes: CONTRACT_TYPES,
    contractStatuses: CONTRACT_STATUSES,
    pagination: result,
    basePath: '/contracts',
    filterQuery: queryString(query),
  });
});

async function formLocals(item = null) {
  return {
    title: item ? 'Chỉnh sửa hợp đồng' : 'Thêm hợp đồng',
    item: item || null,
    values: item ? { ...item } : {
      employee_id: '',
      contract_no: '',
      contract_type: 'Chính thức',
      start_date: today().format('YYYY-MM-DD'),
      end_date: '',
      signed_date: today().format('YYYY-MM-DD'),
      salary_base: 0,
      status: '',
      note: '',
    },
    employees: await employeeModel.selectOptions(),
    contractTypes: CONTRACT_TYPES,
    contractStatuses: CONTRACT_STATUSES,
  };
}

function collectData(req, existing = null) {
  return {
    employee_id: Number(req.body.employee_id),
    contract_no: sanitizeText(req.body.contract_no).toUpperCase(),
    contract_type: req.body.contract_type,
    start_date: req.body.start_date,
    end_date: emptyToNull(req.body.end_date),
    signed_date: emptyToNull(req.body.signed_date),
    salary_base: Number(req.body.salary_base) || 0,
    status: contractModel.computeStatus(req.body.end_date || null, req.body.status || ''),
    document_path: req.file
      ? `/uploads/documents/${req.file.filename}`
      : (existing ? existing.document_path : null),
    note: emptyToNull(req.body.note),
  };
}

const create = asyncHandler(async (req, res) => {
  const locals = await formLocals(null);
  const preselected = /^\d+$/.test(String(req.query.employee_id || ''))
    ? { employee_id: req.query.employee_id }
    : {};
  return res.render(FORM_VIEW, {
    ...locals,
    values: { ...locals.values, ...preselected, ...res.locals.oldInput },
  });
});

const store = asyncHandler(async (req, res) => {
  if (hasErrors(res)) {
    const locals = await formLocals(null);
    if (req.file) removeUpload(`/uploads/documents/${req.file.filename}`);
    return res.render(FORM_VIEW, { ...locals, values: { ...locals.values, ...res.locals.oldInput } });
  }

  const data = collectData(req);
  if (!data.contract_no) {
    try {
      data.contract_no = await contractModel.generateNo(data.employee_id);
    } catch (error) {
      if (req.file) removeUpload(`/uploads/documents/${req.file.filename}`);
      throw error;
    }
  }
  if (await contractModel.findByNo(data.contract_no)) {
    if (req.file) removeUpload(`/uploads/documents/${req.file.filename}`);
    res.locals.validationErrors = [{ field: 'contract_no', message: 'Số hợp đồng này đã tồn tại.' }];
    const locals = await formLocals(null);
    return res.render(FORM_VIEW, { ...locals, values: { ...locals.values, ...req.body } });
  }

  try {
    const created = await contractModel.create(data);
    await audit('CREATE', 'contracts')(req, { recordId: created.id, newValue: data });
    req.flash('success', `Đã thêm hợp đồng ${data.contract_no}.`);
    return res.redirect('/contracts');
  } catch (error) {
    if (req.file) removeUpload(`/uploads/documents/${req.file.filename}`);
    if (error.code === 'ER_DUP_ENTRY') {
      res.locals.validationErrors = [{ field: 'contract_no', message: 'Số hợp đồng này đã tồn tại.' }];
      const locals = await formLocals(null);
      return res.render(FORM_VIEW, { ...locals, values: { ...locals.values, ...req.body } });
    }
    throw error;
  }
});

const edit = asyncHandler(async (req, res) => {
  const item = await contractModel.findById(req.params.id);
  if (!item) throw new AppError('Không tìm thấy hợp đồng.', 404);
  const locals = await formLocals(item);
  return res.render(FORM_VIEW, { ...locals, values: { ...item, ...res.locals.oldInput } });
});

const update = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const before = await contractModel.findById(id);
  if (!before) throw new AppError('Không tìm thấy hợp đồng.', 404);

  if (hasErrors(res)) {
    const locals = await formLocals(before);
    if (req.file) removeUpload(`/uploads/documents/${req.file.filename}`);
    return res.render(FORM_VIEW, { ...locals, values: { ...before, ...res.locals.oldInput } });
  }

  const data = collectData(req, before);
  if (!data.contract_no) {
    try {
      data.contract_no = await contractModel.generateNo(data.employee_id);
    } catch (error) {
      if (req.file) removeUpload(`/uploads/documents/${req.file.filename}`);
      throw error;
    }
  }
  if (await contractModel.findByNo(data.contract_no, id)) {
    if (req.file) removeUpload(`/uploads/documents/${req.file.filename}`);
    res.locals.validationErrors = [{ field: 'contract_no', message: 'Số hợp đồng này đã tồn tại.' }];
    const locals = await formLocals(before);
    return res.render(FORM_VIEW, { ...locals, values: { ...before, ...req.body } });
  }

  try {
    const after = await contractModel.update(id, data);
    if (req.file && before.document_path) removeUpload(before.document_path);
    await audit('UPDATE', 'contracts')(req, { recordId: id, oldValue: before, newValue: after });
    req.flash('success', 'Cập nhật hợp đồng thành công.');
    return res.redirect('/contracts');
  } catch (error) {
    if (req.file) removeUpload(`/uploads/documents/${req.file.filename}`);
    if (error.code === 'ER_DUP_ENTRY') {
      res.locals.validationErrors = [{ field: 'contract_no', message: 'Số hợp đồng này đã tồn tại.' }];
      const locals = await formLocals(before);
      return res.render(FORM_VIEW, { ...locals, values: { ...before, ...req.body } });
    }
    throw error;
  }
});

const destroy = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const before = await contractModel.findById(id);
  if (!before) throw new AppError('Không tìm thấy hợp đồng.', 404);
  await contractModel.remove(id);
  if (before.document_path) removeUpload(before.document_path);
  await audit('DELETE', 'contracts')(req, { recordId: id, oldValue: before });
  req.flash('success', `Đã xóa hợp đồng ${before.contract_no}.`);
  return res.redirect('/contracts');
});

module.exports = {
  uploadDocument,
  index,
  create,
  store,
  edit,
  update,
  destroy,
};
