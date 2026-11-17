'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  SETTING_GROUPS, GROUP_LABELS, ROLE_IDS, groupSettings, coerceSettingValue,
  normalizeHoliday, holidayOccursOn, normalizeAuditQuery,
} = require('../services/admin.service');

test('ROLE_IDS khớp seed 4 vai trò', () => {
  assert.deepEqual(ROLE_IDS, { ADMIN: 1, HR: 2, MANAGER: 3, EMPLOYEE: 4 });
});

test('SETTING_GROUPS có đủ 6 nhóm cấu hình', () => {
  assert.deepEqual(SETTING_GROUPS, ['GENERAL', 'CONTRACT', 'ATTENDANCE', 'SALARY', 'LEAVE', 'PAYROLL']);
  assert.equal(GROUP_LABELS.SALARY, 'Tiền lương');
});

test('groupSettings: gom theo thứ tự cố định, bỏ nhóm rỗng', () => {
  const groups = groupSettings([
    { setting_key: 'COMPANY_NAME', setting_group: 'SALARY' },
    { setting_key: 'COMPANY_ADDRESS', setting_group: 'GENERAL' },
    { setting_key: 'OT_RATE_WEEKDAY', setting_group: 'SALARY' },
  ]);
  assert.deepEqual(groups.map((item) => item.group), ['GENERAL', 'SALARY']);
  assert.equal(groups[0].settings.length, 1);
  assert.equal(groups[1].settings.length, 2);
});

test('groupSettings: đưa nhóm khôngRecognized vào mục Khác', () => {
  const groups = groupSettings([{ setting_key: 'X', setting_group: 'MYSTERY' }]);
  assert.equal(groups[0].group, 'OTHER');
  assert.equal(groups[0].label, 'Khác');
});

test('coerceSettingValue: giữ nguyên dạng số cho setting số', () => {
  assert.equal(coerceSettingValue({ setting_value: '0.105' }, '0.2'), '0.2');
  assert.equal(coerceSettingValue({ setting_value: '11000000' }, '12000000'), '12000000');
});

test('coerceSettingValue: chặt chuỗi cho setting text', () => {
  assert.equal(coerceSettingValue({ setting_value: 'KIDS PARK' }, '  KIDS PARK VN  '), 'KIDS PARK VN');
});

test('coerceSettingValue: chặn giá trị không phải số cho setting số', () => {
  assert.throws(
    () => coerceSettingValue({ setting_value: '8' }, 'abc'),
    (error) => error.statusCode === 400
  );
});

test('normalizeHoliday: chuẩn hóa tên/ngày/ghi chú', () => {
  assert.deepEqual(normalizeHoliday({
    name: '  Ngày lễ  ', holiday_date: '2026-11-20', is_recurring: '1', note: '  Nghỉ nội bộ  ',
  }), {
    name: 'Ngày lễ', holiday_date: '2026-11-20', is_recurring: 1, note: 'Nghỉ nội bộ',
  });
});

test('normalizeHoliday: chặn thiếu tên và sai định dạng ngày', () => {
  assert.throws(() => normalizeHoliday({ name: '', holiday_date: '2026-11-20' }), (error) => error.statusCode === 400);
  assert.throws(() => normalizeHoliday({ name: 'Lễ', holiday_date: '20/11/2026' }), (error) => error.statusCode === 400);
  assert.throws(() => normalizeHoliday({ name: 'Lễ', holiday_date: '2026-02-30' }), (error) => error.statusCode === 400);
});

test('holidayOccursOn: ngày lễ lặp hằng năm khớp mọi năm', () => {
  const recurring = { holiday_date: '2026-01-01', is_recurring: 1 };
  assert.equal(holidayOccursOn(recurring, '2030-01-01'), true);
  assert.equal(holidayOccursOn(recurring, '2030-01-02'), false);
});

test('holidayOccursOn: ngày lễ không lặp chỉ khớp đúng ngày', () => {
  const once = { holiday_date: '2026-02-16', is_recurring: 0 };
  assert.equal(holidayOccursOn(once, '2026-02-16'), true);
  assert.equal(holidayOccursOn(once, '2027-02-16'), false);
});

test('normalizeAuditQuery: lọc theo whitelist action, bỏ giá trị lạ', () => {
  const query = normalizeAuditQuery({
    action: 'UPDATE', table_name: 'payrolls', q: '  hr  ',
    from_date: '2026-11-01', to_date: 'bad', page: '2',
  });
  assert.equal(query.action, 'UPDATE');
  assert.equal(query.table_name, 'payrolls');
  assert.equal(query.q, 'hr');
  assert.equal(query.from_date, '2026-11-01');
  assert.equal(query.to_date, '');
  assert.equal(query.page, 2);
});

test('normalizeAuditQuery: chặn action không nằm trong whitelist', () => {
  const query = normalizeAuditQuery({ action: 'DROP' });
  assert.equal(query.action, '');
});
