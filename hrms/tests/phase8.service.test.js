'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const payrollService = require('../services/payroll.service');

test('calculateInsurance: nhân 10.5% lương cơ bản', () => {
  assert.equal(payrollService.calculateInsurance(10000000), 1050000);
});

test('calculateTaxableIncome: trừ giảm trừ bản thân và người phụ thuộc', () => {
  const value = payrollService.calculateTaxableIncome({
    baseSalary: 20000000,
    allowance: 3000000,
    bonus: 1000000,
    overtimePay: 500000,
    deduction: 300000,
    insuranceAmount: 2100000,
    dependentsCount: 1,
  });
  assert.equal(value, 6700000);
});

test('calculateTaxableIncome: không âm khi lương thấp', () => {
  const value = payrollService.calculateTaxableIncome({
    baseSalary: 5000000, allowance: 0, bonus: 0, overtimePay: 0,
    deduction: 0, insuranceAmount: 525000, dependentsCount: 0,
  });
  assert.equal(value, 0);
});

test('calculateIncomeTax: biểu lũy tiến từng phần đúng các bậc', () => {
  const cases = [
    [0, 0],
    [10000000, 500000],
    [20000000, 1450000],
    [30000000, 2950000],
    [40000000, 4950000],
    [60000000, 9950000],
    [80000000, 15950000],
    [100000000, 22950000],
  ];
  for (const [taxable, expected] of cases) {
    assert.equal(payrollService.calculateIncomeTax(taxable), expected, `bậc ${taxable}`);
  }
});

test('calculateNetSalary: lương thực lãnh = thu nhập - khấu trừ - BH - thuế', () => {
  const value = payrollService.calculateNetSalary({
    baseSalary: 20000000, allowance: 3000000, bonus: 1000000,
    overtimePay: 500000, deduction: 300000, insuranceAmount: 2100000,
    personalIncomeTax: 335000,
  });
  assert.equal(value, 21765000);
});

test('calculateHourlyRate: lương giờ từ công chuẩn', () => {
  assert.equal(payrollService.calculateHourlyRate(22000000, 22), 125000);
});

test('calculateOvertimePay: cộng giờ theo hệ số 1.5 / 2 / 3', () => {
  const value = payrollService.calculateOvertimePay(
    { weekday: 4, weekend: 2, holiday: 1 },
    125000
  );
  assert.equal(value, 1625000);
});

test('calculatePayroll: tổng hợp đúng phiếu lương', () => {
  const result = payrollService.calculatePayroll({
    baseSalary: 20000000,
    allowance: 3000000,
    bonus: 1000000,
    deduction: 300000,
    dependentsCount: 1,
    workingDays: 22,
    overtimeHours: { weekday: 4, weekend: 0, holiday: 0 },
  });
  assert.equal(result.working_days, 22);
  assert.equal(result.base_salary, 20000000);
  assert.equal(result.allowance, 3000000);
  assert.equal(result.bonus, 1000000);
  assert.equal(result.insurance_amount, 2100000);
  assert.equal(result.overtime_pay, 681818.18);
  assert.equal(result.taxable_income, 6881818.18);
  assert.equal(result.personal_income_tax, 344090.91);
  assert.equal(result.net_salary, 21937727.27);
});

test('recalculatePayroll: giữ tiền OT đã tính, cập nhật BH/thuế/thực lãnh', () => {
  const result = payrollService.recalculatePayroll({
    base_salary: 20000000, allowance: 3000000, bonus: 1000000,
    overtime_pay: 500000, deduction: 300000, dependents_count: 1,
  });
  assert.equal(result.insurance_amount, 2100000);
  assert.equal(result.taxable_income, 6700000);
  assert.equal(result.personal_income_tax, 335000);
  assert.equal(result.net_salary, 21765000);
});

test('validatePeriodCode: chỉ chấp nhận YYYY-MM hợp lệ', () => {
  assert.equal(payrollService.validatePeriodCode('2026-11'), true);
  for (const bad of ['2026-13', '2026-1', '26-11', '2026/11', '']) {
    assert.equal(payrollService.validatePeriodCode(bad), false, bad);
  }
});

test('periodDateRange: sinh đúng ngày đầu/cuối tháng, xử lý năm nhuận', () => {
  assert.deepEqual(payrollService.periodDateRange(2, 2028), {
    start_date: '2028-02-01', end_date: '2028-02-29',
  });
  assert.deepEqual(payrollService.periodDateRange(10, 2026), {
    start_date: '2026-10-01', end_date: '2026-10-31',
  });
});

test('PAYROLL_STATUSES đúng 2 trạng thái', () => {
  assert.deepEqual(payrollService.PAYROLL_STATUSES, ['Dự thảo', 'Đã chốt']);
});
