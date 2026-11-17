'use strict';

/** Nghiệp vụ tiền lương: bảo hiểm, giảm trừ, thuế lũy tiến và tổng hợp phiếu lương. */

const dayjs = require('dayjs');
const env = require('../config/env');
const { AppError, roundMoney } = require('../utils/helpers');

const PAYROLL_STATUSES = ['Dự thảo', 'Đã chốt'];
const PERIOD_CODE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Biểu thuế TNCN lũy tiến từng phần, áp dụng cho thu nhập tính thuế/tháng. */
const TAX_BRACKETS = [
  { limit: 11000000, rate: 0.05, quick: 0 },
  { limit: 20000000, rate: 0.10, quick: 550000 },
  { limit: 30000000, rate: 0.15, quick: 1550000 },
  { limit: 40000000, rate: 0.20, quick: 3050000 },
  { limit: 60000000, rate: 0.25, quick: 5050000 },
  { limit: 80000000, rate: 0.30, quick: 8050000 },
  { limit: Infinity, rate: 0.35, quick: 12050000 },
];

const OT_RATE_KEYS = {
  weekday: 'otRateWeekday',
  weekend: 'otRateWeekend',
  holiday: 'otRateHoliday',
};

function calculateInsurance(baseSalary) {
  return roundMoney(Number(baseSalary || 0) * Number(env.business.insuranceRate));
}

function calculateTaxableIncome(input) {
  const gross = Number(input.baseSalary || 0)
    + Number(input.allowance || 0)
    + Number(input.bonus || 0)
    + Number(input.overtimePay || 0);
  const deductions = Number(input.deduction || 0)
    + Number(input.insuranceAmount || 0)
    + Number(env.business.personalDeduction)
    + Number(input.dependentsCount || 0) * Number(env.business.dependentDeduction);
  return roundMoney(Math.max(0, gross - deductions));
}

function calculateIncomeTax(taxableIncome) {
  const value = Number(taxableIncome || 0);
  if (value <= 0) return 0;
  const bracket = TAX_BRACKETS.find((item) => value <= item.limit) || TAX_BRACKETS.at(-1);
  return roundMoney(value * bracket.rate - bracket.quick);
}

function calculateNetSalary(input) {
  const gross = Number(input.baseSalary || 0)
    + Number(input.allowance || 0)
    + Number(input.bonus || 0)
    + Number(input.overtimePay || 0);
  return roundMoney(
    gross - Number(input.deduction || 0)
    - Number(input.insuranceAmount || 0)
    - Number(input.personalIncomeTax || 0)
  );
}

function calculateHourlyRate(baseSalary, workingDays) {
  const days = Number(workingDays || 0);
  if (days <= 0) throw new AppError('Số ngày công tính lương phải lớn hơn 0.', 400);
  const hours = days * Number(env.business.standardWorkHours) || 1;
  return Number(baseSalary || 0) / hours;
}

/** hours: { weekday, weekend, holiday } - giờ tăng ca đã quy đổi theo từng loại ngày. */
function calculateOvertimePay(hours = {}, hourlySalary = 0) {
  let total = 0;
  for (const [key, rateKey] of Object.entries(OT_RATE_KEYS)) {
    total += Number(hours[key] || 0) * Number(env.business[rateKey]) * Number(hourlySalary || 0);
  }
  return roundMoney(total);
}

/** Tổng hợp một phiếu lương; trả về các trường lưu được trực tiếp vào bảng payrolls. */
function calculatePayroll(input) {
  const workingDays = Number(input.workingDays || 0);
  if (workingDays <= 0) throw new AppError('Số ngày công tính lương phải lớn hơn 0.', 400);
  const baseSalary = roundMoney(input.baseSalary);
  const allowance = roundMoney(input.allowance);
  const bonus = roundMoney(input.bonus);
  const deduction = roundMoney(input.deduction);
  const overtimePay = calculateOvertimePay(
    input.overtimeHours || {},
    calculateHourlyRate(baseSalary, workingDays)
  );
  const insuranceAmount = calculateInsurance(baseSalary);
  const taxableIncome = calculateTaxableIncome({
    baseSalary, allowance, bonus, overtimePay, deduction, insuranceAmount,
    dependentsCount: input.dependentsCount,
  });
  const personalIncomeTax = calculateIncomeTax(taxableIncome);
  return {
    working_days: workingDays,
    base_salary: baseSalary,
    allowance,
    bonus,
    overtime_pay: overtimePay,
    deduction,
    insurance_amount: insuranceAmount,
    taxable_income: taxableIncome,
    personal_income_tax: personalIncomeTax,
    net_salary: calculateNetSalary({
      baseSalary, allowance, bonus, overtimePay, deduction,
      insuranceAmount, personalIncomeTax,
    }),
  };
}

/** Tính lại các khoản phụ thuộc sau khi chỉnh lương/thưởng/khấu trừ; tiền OT giữ nguyên. */
function recalculatePayroll(input) {
  const baseSalary = roundMoney(input.base_salary);
  const allowance = roundMoney(input.allowance);
  const bonus = roundMoney(input.bonus);
  const overtimePay = roundMoney(input.overtime_pay);
  const deduction = roundMoney(input.deduction);
  const insuranceAmount = calculateInsurance(baseSalary);
  const taxableIncome = calculateTaxableIncome({
    baseSalary, allowance, bonus, overtimePay, deduction, insuranceAmount,
    dependentsCount: input.dependents_count,
  });
  const personalIncomeTax = calculateIncomeTax(taxableIncome);
  return {
    insurance_amount: insuranceAmount,
    taxable_income: taxableIncome,
    personal_income_tax: personalIncomeTax,
    net_salary: calculateNetSalary({
      baseSalary, allowance, bonus, overtimePay, deduction,
      insuranceAmount, personalIncomeTax,
    }),
  };
}

function validatePeriodCode(code) {
  return PERIOD_CODE_PATTERN.test(String(code || ''));
}

function periodDateRange(month, year) {
  const m = Number(month);
  const y = Number(year);
  if (!Number.isInteger(m) || m < 1 || m > 12 || !Number.isInteger(y) || y < 2000 || y > 2100) {
    throw new AppError('Tháng hoặc năm kỳ lương không hợp lệ.', 400);
  }
  const first = dayjs(`${y}-${String(m).padStart(2, '0')}-01`);
  return {
    start_date: first.format('YYYY-MM-DD'),
    end_date: first.endOf('month').format('YYYY-MM-DD'),
  };
}

module.exports = {
  PAYROLL_STATUSES,
  TAX_BRACKETS,
  calculateInsurance,
  calculateTaxableIncome,
  calculateIncomeTax,
  calculateNetSalary,
  calculateHourlyRate,
  calculateOvertimePay,
  calculatePayroll,
  recalculatePayroll,
  validatePeriodCode,
  periodDateRange,
};
