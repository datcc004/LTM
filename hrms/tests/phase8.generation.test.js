'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const generation = require('../services/payrollGeneration.service');

const period = { id: 7, start_date: '2026-11-01', end_date: '2026-11-30', status: 'Dự thảo' };
const employees = [
  { employee_id: 1, base_salary: 20000000, allowance: 3000000, dependents_count: 1 },
  { employee_id: 2, base_salary: 10000000, allowance: 1000000, dependents_count: 0 },
];

test('buildGenerationRows: công 8h/ngày, giới hạn 8h mỗi ngày', () => {
  const rows = generation.buildGenerationRows({
    period,
    employees,
    attendance: [
      { employee_id: 1, worked_minutes: 480 },
      { employee_id: 1, worked_minutes: 540 },
      { employee_id: 2, worked_minutes: 240 },
    ],
    overtime: [],
  });
  assert.equal(rows[0].working_days, 2);
  assert.equal(rows[1].working_days, 0.5);
});

test('buildGenerationRows: dùng 22 công khi kỳ chưa có công', () => {
  const rows = generation.buildGenerationRows({ period, employees, attendance: [], overtime: [] });
  assert.equal(rows[0].working_days, 22);
});

test('buildGenerationRows: giữ thưởng/khấu trừ/ghi chú đã nhập khi sinh lại', () => {
  const rows = generation.buildGenerationRows({
    period,
    employees,
    attendance: [],
    overtime: [],
    existing: [{ employee_id: 1, bonus: 1500000, deduction: 400000, note: 'Điều chỉnh tay' }],
  });
  assert.equal(rows[0].bonus, 1500000);
  assert.equal(rows[0].deduction, 400000);
  assert.equal(rows[0].note, 'Điều chỉnh tay');
  assert.equal(rows[1].bonus, 0);
});

test('buildGenerationRows: gom giờ tăng ca đã duyệt theo hệ số ngày', () => {
  const rows = generation.buildGenerationRows({
    period,
    employees: [employees[0]],
    attendance: [{ employee_id: 1, worked_minutes: 480 }],
    overtime: [
      { employee_id: 1, day_type: 'Ngày thường', total_hours: 2 },
      { employee_id: 1, day_type: 'Cuối tuần', total_hours: 1 },
      { employee_id: 1, day_type: 'Ngày lễ', total_hours: 1 },
    ],
  });
  // hourly = 20tr / 8 = 2.5tr; 2*1.5 + 1*2 + 1*3 = 8 giờ quy đổi.
  assert.equal(rows[0].overtime_pay, 20000000);
  assert.equal(rows[0].net_salary, 38625000);
});

test('buildGenerationRows: trạng thái phiếu theo trạng thái kỳ', () => {
  const rows = generation.buildGenerationRows({
    period: { ...period, status: 'Đã chốt' },
    employees: [employees[0]],
    attendance: [], overtime: [],
  });
  assert.equal(rows[0].status, 'Đã chốt');
});

test('buildPayrollItems: đủ 7 khoản mục, bảo hiểm và thuế nằm ở nhóm đúng', () => {
  const payroll = {
    base_salary: 20000000, allowance: 3000000, bonus: 1000000,
    overtime_pay: 500000, deduction: 300000, insurance_amount: 2100000,
    personal_income_tax: 335000,
  };
  const items = generation.buildPayrollItems(payroll);
  assert.equal(items.length, 7);
  assert.deepEqual(items.map((item) => item.code), [
    'LUONG_CO_BAN', 'PHU_CAP', 'THUONG', 'TIEN_OT',
    'KHAU_TRU', 'BAO_HIEM', 'THUE_TNCN',
  ]);
  assert.equal(items[1].item_type, 'Thu nhập');
  assert.equal(items[4].item_type, 'Khấu trừ');
  assert.equal(items[5].item_type, 'Bảo hiểm');
  assert.equal(items[6].item_type, 'Thuế');
  assert.equal(items[0].amount, 20000000);
  assert.equal(items[6].amount, 335000);
});
