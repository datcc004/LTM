'use strict';

/** Tiền lương: kỳ lương, sinh phiếu, chỉnh phiếu và chốt kỳ. */

const db = require('../config/db');
const payrollPeriodModel = require('../models/payrollPeriod.model');
const payrollModel = require('../models/payroll.model');
const payrollService = require('../services/payroll.service');
const generationService = require('../services/payrollGeneration.service');
const { hasErrors } = require('../middlewares/validate');
const { audit } = require('../middlewares/audit');
const {
  asyncHandler, AppError, sanitizeText, getPagination, today,
} = require('../utils/helpers');

const LIST_VIEW = 'payroll/index';
const FORM_VIEW = 'payroll/form';
const DETAIL_VIEW = 'payroll/detail';
const PAYSLIP_VIEW = 'payroll/payslip';
const PAYSLIP_FORM_VIEW = 'payroll/payslip-form';

function buildQuery(req) {
  const status = String(req.query.status || '');
  return {
    q: String(req.query.q || '').trim(),
    status: payrollService.PAYROLL_STATUSES.includes(status) ? status : '',
    year: String(req.query.year || ''),
  };
}

function queryString(query) {
  const params = new URLSearchParams();
  for (const key of ['q', 'status', 'year']) if (query[key]) params.set(key, query[key]);
  return params.toString();
}

function periodData(req) {
  const month = Number(req.body.month);
  const year = Number(req.body.year);
  const range = payrollService.periodDateRange(month, year);
  return {
    period_code: `${year}-${String(month).padStart(2, '0')}`,
    month,
    year,
    ...range,
    note: sanitizeText(req.body.note),
  };
}

function periodValues(item, oldInput = {}) {
  const now = today();
  const base = item
    ? { ...item }
    : { period_code: '', month: now.month() + 1, year: now.year(), note: '' };
  return { ...base, ...oldInput };
}

function payrollData(req) {
  return {
    base_salary: Number(String(req.body.base_salary || '').replace(/[.,]/g, '')),
    allowance: Number(String(req.body.allowance || '').replace(/[.,]/g, '')),
    bonus: Number(String(req.body.bonus || '').replace(/[.,]/g, '')),
    deduction: Number(String(req.body.deduction || '').replace(/[.,]/g, '')),
    working_days: Number(String(req.body.working_days || '').replace(',', '.')),
    note: sanitizeText(req.body.note),
  };
}

async function checkPeriodCode(data, res, excludeId = null) {
  if (hasErrors(res)) return false;
  if (!payrollService.validatePeriodCode(data.period_code)) {
    res.locals.validationErrors = [{ field: 'period_code', message: 'Mã kỳ lương không hợp lệ.' }];
    return false;
  }
  const duplicate = await payrollPeriodModel.findByCode(data.period_code, excludeId);
  if (duplicate) {
    res.locals.validationErrors = [{ field: 'period_code', message: 'Kỳ lương này đã tồn tại.' }];
    return false;
  }
  return true;
}

const index = asyncHandler(async (req, res) => {
  const query = buildQuery(req);
  const paging = getPagination(req.query, 20, 100);
  const pageResult = await payrollPeriodModel.list(query, { ...req.query, page: paging.page, limit: paging.limit });
  return res.render(LIST_VIEW, {
    title: 'Kỳ lương',
    records: pageResult.rows,
    query,
    statuses: payrollService.PAYROLL_STATUSES,
    pagination: pageResult,
    basePath: '/payroll',
    filterQuery: queryString(query),
  });
});

const create = asyncHandler(async (req, res) => {
  return res.render(FORM_VIEW, {
    title: 'Thêm kỳ lương', item: null, values: periodValues(null, res.locals.oldInput),
  });
});

const store = asyncHandler(async (req, res) => {
  const data = periodData(req);
  if (!(await checkPeriodCode(data, res))) {
    return res.render(FORM_VIEW, { title: 'Thêm kỳ lương', item: null, values: periodValues(null, req.body) });
  }
  const created = await payrollPeriodModel.create(data);
  await audit('CREATE', 'payroll_periods')(req, { recordId: created.id, newValue: created });
  req.flash('success', `Đã tạo kỳ lương ${created.period_code}.`);
  return res.redirect('/payroll');
});

const edit = asyncHandler(async (req, res) => {
  const item = await payrollPeriodModel.findById(req.params.id);
  if (!item) throw new AppError('Không tìm thấy kỳ lương.', 404);
  if (item.status !== 'Dự thảo') throw new AppError('Kỳ lương đã chốt không thể chỉnh sửa.', 400);
  return res.render(FORM_VIEW, {
    title: 'Chỉnh sửa kỳ lương', item, values: periodValues(item, res.locals.oldInput),
  });
});

const update = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const before = await payrollPeriodModel.findById(id);
  if (!before) throw new AppError('Không tìm thấy kỳ lương.', 404);
  if (before.status !== 'Dự thảo') throw new AppError('Kỳ lương đã chốt không thể chỉnh sửa.', 400);
  const data = periodData(req);
  if (!(await checkPeriodCode(data, res, id))) {
    return res.render(FORM_VIEW, { title: 'Chỉnh sửa kỳ lương', item: before, values: periodValues(before, req.body) });
  }
  const after = await payrollPeriodModel.update(id, data);
  await audit('UPDATE', 'payroll_periods')(req, { recordId: id, oldValue: before, newValue: after });
  req.flash('success', `Cập nhật kỳ lương ${after.period_code}.`);
  return res.redirect('/payroll');
});

const destroy = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const before = await payrollPeriodModel.findById(id);
  if (!before) throw new AppError('Không tìm thấy kỳ lương.', 404);
  if (Number(before.payroll_count || 0) > 0) {
    req.flash('error', 'Kỳ lương đã có phiếu. Hãy xóa phiếu trước khi xóa kỳ.');
    return res.redirect('/payroll');
  }
  const removed = await payrollPeriodModel.remove(id);
  if (!removed) {
    req.flash('error', 'Chỉ có thể xóa kỳ lương ở trạng thái Dự thảo.');
    return res.redirect('/payroll');
  }
  await audit('DELETE', 'payroll_periods')(req, { recordId: id, oldValue: before });
  req.flash('success', 'Đã xóa kỳ lương.');
  return res.redirect('/payroll');
});

/** Sinh lại toàn bộ phiếu dự thảo của kỳ từ công/tăng ca đã duyệt. */
const generate = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const period = await payrollPeriodModel.findById(id);
  if (!period) throw new AppError('Không tìm thấy kỳ lương.', 404);
  if (period.status !== 'Dự thảo') throw new AppError('Kỳ lương đã chốt không thể sinh phiếu.', 400);

  const [employeesResult, attendanceResult, overtimeResult, existingResult] = await Promise.all([
    db.query(
      `SELECT e.id AS employee_id, e.employee_code, e.full_name,
              s.base_salary, s.allowance, s.dependents_count
         FROM salary_structures s
         JOIN employees e ON e.id = s.employee_id
        WHERE e.status <> 'Nghỉ việc'
        ORDER BY e.employee_code ASC`
    ),
    db.query(
      `SELECT employee_id, worked_minutes FROM attendance
        WHERE is_approved = 1 AND work_date BETWEEN ? AND ?`,
      [period.start_date, period.end_date]
    ),
    db.query(
      `SELECT employee_id, day_type, total_hours FROM overtime_requests
        WHERE status = 'Đã duyệt' AND work_date BETWEEN ? AND ?`,
      [period.start_date, period.end_date]
    ),
    db.query(
      `SELECT employee_id, bonus, deduction, note FROM payrolls WHERE period_id = ?`,
      [id]
    ),
  ]);

  if (!employeesResult.rows.length) {
    req.flash('error', 'Chưa có cấu trúc lương nào. Hãy khai báo cấu trúc lương trước khi sinh phiếu.');
    return res.redirect(`/payroll/${id}`);
  }

  const rows = generationService.buildGenerationRows({
    period,
    employees: employeesResult.rows,
    attendance: attendanceResult.rows,
    overtime: overtimeResult.rows,
    existing: existingResult.rows,
  });

  await db.transaction(async (tx) => {
    await tx.execute(`DELETE FROM payrolls WHERE period_id = ? AND status = 'Dự thảo'`, [id]);
    for (const row of rows) {
      const result = await tx.insert(
        `INSERT INTO payrolls
           (period_id, employee_id, base_salary, allowance, bonus, overtime_pay, deduction,
            insurance_amount, taxable_income, personal_income_tax, net_salary, working_days, status, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.period_id, row.employee_id, row.base_salary, row.allowance, row.bonus,
          row.overtime_pay, row.deduction, row.insurance_amount, row.taxable_income,
          row.personal_income_tax, row.net_salary, row.working_days, row.status, row.note,
        ]
      );
      for (const item of generationService.buildPayrollItems(row)) {
        await tx.insert(
          `INSERT INTO payroll_items (payroll_id, item_type, code, name, amount, note)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [result.insertId, item.item_type, item.code, item.name, item.amount, item.note]
        );
      }
    }
  });

  await audit('GENERATE', 'payrolls')(req, { recordId: id, newValue: { period_code: period.period_code, count: rows.length } });
  req.flash('success', `Đã sinh ${rows.length} phiếu lương cho kỳ ${period.period_code}.`);
  return res.redirect(`/payroll/${id}`);
});

const changeStatus = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const before = await payrollPeriodModel.findById(id);
  if (!before) throw new AppError('Không tìm thấy kỳ lương.', 404);
  const status = String(req.body.status || '');
  if (!payrollService.PAYROLL_STATUSES.includes(status)) {
    throw new AppError('Trạng thái kỳ lương không hợp lệ.', 400);
  }
  if (status === before.status) {
    req.flash('info', `Kỳ lương ${before.period_code} đang ở trạng thái ${status}.`);
    return res.redirect(`/payroll/${id}`);
  }
  if (status === 'Đã chốt' && Number(before.payroll_count || 0) === 0) {
    req.flash('error', 'Không thể chốt kỳ lương khi chưa có phiếu nào.');
    return res.redirect(`/payroll/${id}`);
  }
  const after = await payrollPeriodModel.lock(id, req.user.id, status);
  await audit(status === 'Đã chốt' ? 'LOCK' : 'UNLOCK', 'payroll_periods')(req, {
    recordId: id, oldValue: { status: before.status }, newValue: { status: after.status },
  });
  req.flash('success', status === 'Đã chốt'
    ? `Đã chốt kỳ lương ${after.period_code}.`
    : `Đã mở lại kỳ lương ${after.period_code} để chỉnh sửa.`);
  return res.redirect(`/payroll/${id}`);
});

const detail = asyncHandler(async (req, res) => {
  const period = await payrollPeriodModel.findById(req.params.id);
  if (!period) throw new AppError('Không tìm thấy kỳ lương.', 404);
  const query = {
    q: String(req.query.q || '').trim(),
    status: String(req.query.status || ''),
  };
  const paging = getPagination(req.query, 20, 100);
  const pageResult = await payrollModel.list(
    { period_id: period.id, ...query },
    { ...req.query, page: paging.page, limit: paging.limit }
  );
  const filter = new URLSearchParams();
  for (const key of ['q', 'status']) if (query[key]) filter.set(key, query[key]);
  return res.render(DETAIL_VIEW, {
    title: `Kỳ lương ${period.period_code}`,
    period,
    records: pageResult.rows,
    query,
    summary: pageResult,
    pagination: pageResult,
    basePath: `/payroll/${period.id}`,
    filterQuery: filter.toString(),
  });
});

const payslip = asyncHandler(async (req, res) => {
  const item = await payrollModel.findById(req.params.id);
  if (!item) throw new AppError('Không tìm thấy phiếu lương.', 404);
  const [items, period] = await Promise.all([
    payrollModel.items(item.id),
    payrollPeriodModel.findById(item.period_id),
  ]);
  return res.render(PAYSLIP_VIEW, { title: `Phiếu lương ${item.employee_code}`, item, items, period });
});

const payslipEdit = asyncHandler(async (req, res) => {
  const item = await payrollModel.findById(req.params.id);
  if (!item) throw new AppError('Không tìm thấy phiếu lương.', 404);
  if (item.status !== 'Dự thảo') throw new AppError('Phiếu lương đã chốt không thể chỉnh sửa.', 400);
  return res.render(PAYSLIP_FORM_VIEW, {
    title: `Chỉnh phiếu lương ${item.employee_code}`,
    item,
    values: { ...item, ...res.locals.oldInput },
  });
});

const payslipUpdate = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const before = await payrollModel.findById(id);
  if (!before) throw new AppError('Không tìm thấy phiếu lương.', 404);
  if (before.status !== 'Dự thảo') throw new AppError('Phiếu lương đã chốt không thể chỉnh sửa.', 400);
  const data = payrollData(req);
  if (data.working_days <= 0) {
    res.locals.validationErrors = [{ field: 'working_days', message: 'Số ngày công phải lớn hơn 0.' }];
    return res.render(PAYSLIP_FORM_VIEW, {
      title: `Chỉnh phiếu lương ${before.employee_code}`,
      item: before,
      values: { ...before, ...req.body },
    });
  }
  const computed = payrollService.recalculatePayroll({ ...data, dependents_count: before.dependents_count });
  await payrollModel.update(id, { ...data, ...computed });
  const after = await payrollModel.findById(id);
  await payrollModel.replaceItems(id, generationService.buildPayrollItems(after));
  await audit('UPDATE', 'payrolls')(req, { recordId: id, oldValue: before, newValue: after });
  req.flash('success', `Cập nhật phiếu lương của ${after.full_name}.`);
  return res.redirect(`/payroll/payrolls/${id}`);
});

const payslipDestroy = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const before = await payrollModel.findById(id);
  if (!before) throw new AppError('Không tìm thấy phiếu lương.', 404);
  if (!await payrollModel.remove(id)) {
    req.flash('error', 'Chỉ có thể xóa phiếu lương ở trạng thái Dự thảo.');
    return res.redirect(`/payroll/${before.period_id}`);
  }
  await audit('DELETE', 'payrolls')(req, { recordId: id, oldValue: before });
  req.flash('success', 'Đã xóa phiếu lương.');
  return res.redirect(`/payroll/${before.period_id}`);
});

module.exports = {
  index, create, store, edit, update, destroy,
  generate, changeStatus, detail, payslip, payslipEdit, payslipUpdate, payslipDestroy,
};
