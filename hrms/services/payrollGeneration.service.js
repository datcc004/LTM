'use strict';

/** Sinh phiếu lương hàng loạt từ công đã duyệt, tăng ca đã duyệt và cấu trúc lương. */

const env = require('../config/env');
const { roundMoney } = require('../utils/helpers');
const payrollService = require('./payroll.service');

const DEFAULT_WORKING_DAYS = 22;
const OT_KEYS = {
  'Ngày thường': 'weekday',
  'Cuối tuần': 'weekend',
  'Ngày lễ': 'holiday',
};

const ITEM_DEFINITIONS = [
  { item_type: 'Thu nhập', code: 'LUONG_CO_BAN', name: 'Lương cơ bản', field: 'base_salary' },
  { item_type: 'Thu nhập', code: 'PHU_CAP', name: 'Phụ cấp', field: 'allowance' },
  { item_type: 'Thu nhập', code: 'THUONG', name: 'Thưởng', field: 'bonus' },
  { item_type: 'Thu nhập', code: 'TIEN_OT', name: 'Tiền tăng ca', field: 'overtime_pay' },
  { item_type: 'Khấu trừ', code: 'KHAU_TRU', name: 'Khấu trừ khác', field: 'deduction' },
  { item_type: 'Bảo hiểm', code: 'BAO_HIEM', name: 'BHXH 8% + BHYT 1.5% + BHTN 1%', field: 'insurance_amount' },
  { item_type: 'Thuế', code: 'THUE_TNCN', name: 'Thuế TNCN', field: 'personal_income_tax' },
];

/**
 * employees: [{ employee_id, base_salary, allowance, dependents_count }]
 * attendance: [{ employee_id, worked_minutes }] - bản ghi đã duyệt trong kỳ
 * overtime:   [{ employee_id, day_type, total_hours }] - đơn đã duyệt trong kỳ
 * existing:   [{ employee_id, bonus, deduction, note }] - phiếu đã có (giữ chỉnh sửa tay)
 */
function buildGenerationRows({ period, employees = [], attendance = [], overtime = [], existing = [] }) {
  const minutesPerDay = Number(env.business.standardWorkHours) * 60 || 480;
  const workedByEmployee = new Map();
  for (const row of attendance) {
    const id = Number(row.employee_id);
    const minutes = Math.max(0, Math.min(Number(row.worked_minutes || 0), minutesPerDay));
    workedByEmployee.set(id, (workedByEmployee.get(id) || 0) + minutes);
  }

  const hoursByEmployee = new Map();
  for (const row of overtime) {
    const id = Number(row.employee_id);
    const key = OT_KEYS[row.day_type];
    if (!key) continue;
    if (!hoursByEmployee.has(id)) hoursByEmployee.set(id, { weekday: 0, weekend: 0, holiday: 0 });
    hoursByEmployee.get(id)[key] += Number(row.total_hours || 0);
  }

  const existingByEmployee = new Map(
    existing.map((row) => [Number(row.employee_id), row])
  );

  return employees.map((employee) => {
    const employeeId = Number(employee.employee_id);
    const workedMinutes = workedByEmployee.get(employeeId) || 0;
    const workingDays = workedMinutes > 0
      ? roundMoney(workedMinutes / minutesPerDay)
      : DEFAULT_WORKING_DAYS;
    const previous = existingByEmployee.get(employeeId) || {};
    const calculated = payrollService.calculatePayroll({
      baseSalary: employee.base_salary,
      allowance: employee.allowance,
      bonus: previous.bonus || 0,
      deduction: previous.deduction || 0,
      dependentsCount: employee.dependents_count,
      workingDays,
      overtimeHours: hoursByEmployee.get(employeeId) || {},
    });
    return {
      period_id: period.id,
      employee_id: employeeId,
      ...calculated,
      status: period.status || 'Dự thảo',
      note: previous.note || null,
    };
  });
}

function buildPayrollItems(payroll) {
  return ITEM_DEFINITIONS.map((definition) => ({
    item_type: definition.item_type,
    code: definition.code,
    name: definition.name,
    amount: roundMoney(payroll[definition.field]),
    note: null,
  }));
}

module.exports = { buildGenerationRows, buildPayrollItems, ITEM_DEFINITIONS };
