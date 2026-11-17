'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  calculateLeaveDays,
  assertSufficientBalance,
  LEAVE_STATUSES,
} = require('../services/leave.service');

const {
  getOtMultiplier,
  calculateOtHours,
  calculateOtPay,
  OT_DAY_TYPES,
} = require('../services/overtime.service');

test('calculateLeaveDays: một ngày thường tính 1 ngày', () => {
  assert.equal(calculateLeaveDays('2026-11-05', '2026-11-05'), 1);
});

test('calculateLeaveDays: bỏ qua cuối tuần trong khoảng đã chọn', () => {
  assert.equal(calculateLeaveDays('2026-11-02', '2026-11-08'), 5);
});

test('calculateLeaveDays: bỏ qua ngày lễ truyền vào', () => {
  assert.equal(calculateLeaveDays('2026-11-02', '2026-11-03', ['2026-11-02']), 1);
});

test('calculateLeaveDays: chấp nhận bản ghi lễ có khóa holiday_date', () => {
  assert.equal(calculateLeaveDays('2026-11-02', '2026-11-03', [{ holiday_date: '2026-11-02' }]), 1);
});

test('calculateLeaveDays: chặn khoảng ngày đảo ngược', () => {
  assert.throws(
    () => calculateLeaveDays('2026-11-05', '2026-11-02'),
    (error) => error.statusCode === 400 && /ngày kết thúc/i.test(error.message)
  );
});

test('assertSufficientBalance: chặn khi quỹ phép không đủ', () => {
  assert.throws(
    () => assertSufficientBalance({ remaining_days: 2 }, 3, { max_days_per_year: 12 }),
    (error) => error.code === 'INSUFFICIENT_LEAVE' && error.statusCode === 409
  );
});

test('assertSufficientBalance: chấp nhận đúng số dư', () => {
  assert.doesNotThrow(() => assertSufficientBalance({ remaining_days: 2 }, 2, { max_days_per_year: 12 }));
});

test('assertSufficientBalance: loại phép không giới hạn bỏ qua kiểm tra quỹ', () => {
  assert.doesNotThrow(() => assertSufficientBalance({ remaining_days: 0 }, 30, { max_days_per_year: null }));
});

test('LEAVE_STATUSES đúng 3 trạng thái', () => {
  assert.deepEqual(LEAVE_STATUSES, ['Chờ duyệt', 'Đã duyệt', 'Từ chối']);
});

test('getOtMultiplier: 1.5 / 2 / 3 theo loại ngày', () => {
  assert.equal(getOtMultiplier('Ngày thường'), 1.5);
  assert.equal(getOtMultiplier('Cuối tuần'), 2);
  assert.equal(getOtMultiplier('Ngày lễ'), 3);
});

test('getOtMultiplier: chặn loại ngày không hợp lệ', () => {
  assert.throws(
    () => getOtMultiplier('Ngày lạ'),
    (error) => error.statusCode === 400
  );
});

test('calculateOtHours: tính giờ trong cùng ngày', () => {
  assert.equal(calculateOtHours('17:00', '20:00'), 3);
});

test('calculateOtHours: xử lý tăng ca qua ngày', () => {
  assert.equal(calculateOtHours('22:00', '02:00'), 4);
});

test('calculateOtHours: chặn giờ kết thúc trùng giờ bắt đầu', () => {
  assert.throws(
    () => calculateOtHours('17:00', '17:00'),
    (error) => error.statusCode === 400
  );
});

test('calculateOtPay: nhân hệ số theo loại ngày', () => {
  assert.equal(calculateOtPay(3, 'Ngày thường', 30000), 135000);
  assert.equal(calculateOtPay(3, 'Ngày lễ', 30000), 270000);
});

test('OT_DAY_TYPES đúng 3 loại', () => {
  assert.deepEqual(OT_DAY_TYPES, ['Ngày thường', 'Cuối tuần', 'Ngày lễ']);
});
