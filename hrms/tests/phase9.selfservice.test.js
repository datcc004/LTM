'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  selfScope, payslipScope, assertSelf, employeeIdOf, VISIBLE_PAYSLIP_STATUSES,
} = require('../services/selfService.service');

test('selfScope: mọi role đều bị giới hạn đúng nhân viên của mình', () => {
  for (const role of ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE']) {
    assert.deepEqual(selfScope({ role, employee_id: 7 }), { sql: 'e.id = ?', params: [7] });
  }
});

test('selfScope: alias tùy ý nhưng vẫn là điều kiện prepared', () => {
  assert.deepEqual(selfScope({ role: 'EMPLOYEE', employee_id: 4 }, 'emp'), {
    sql: 'emp.id = ?', params: [4],
  });
});

test('selfScope: tài khoản không liên kết nhân viên bị chặn toàn bộ', () => {
  assert.deepEqual(selfScope({ role: 'ADMIN', employee_id: null }), { sql: '1 = 0', params: [] });
  assert.deepEqual(selfScope(null), { sql: '1 = 0', params: [] });
});

test('selfScope: chặn alias chứa ký tự không hợp lệ', () => {
  assert.throws(() => selfScope({ employee_id: 1 }, 'e;DROP'), (error) => error.statusCode === 500);
});

test('payslipScope: lọc phiếu lương theo alias pr', () => {
  assert.deepEqual(payslipScope({ employee_id: 12 }), { sql: 'pr.employee_id = ?', params: [12] });
  assert.deepEqual(payslipScope({ employee_id: null }), { sql: '1 = 0', params: [] });
});

test('assertSelf: chấp nhận đúng chính mình', () => {
  assert.equal(assertSelf({ employee_id: 9 }, '9'), true);
  assert.equal(assertSelf({ employee_id: 9 }, 9), true);
});

test('assertSelf: chặn xem hồ sơ người khác với 403', () => {
  assert.throws(() => assertSelf({ employee_id: 9 }, 10), (error) => error.statusCode === 403);
});

test('assertSelf: chặn tài khoản không liên kết nhân viên', () => {
  assert.throws(() => assertSelf({ employee_id: null }, 1), (error) => error.statusCode === 403);
});

test('employeeIdOf: ép về số, trả 0 khi thiếu', () => {
  assert.equal(employeeIdOf({ employee_id: '15' }), 15);
  assert.equal(employeeIdOf({}), 0);
  assert.equal(employeeIdOf(null), 0);
});

test('VISIBLE_PAYSLIP_STATUSES: nhân viên chỉ thấy phiếu đã chốt', () => {
  assert.deepEqual(VISIBLE_PAYSLIP_STATUSES, ['Đã chốt']);
});
