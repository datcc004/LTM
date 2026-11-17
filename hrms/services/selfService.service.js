'use strict';

/** Cổng nhân viên (/me): mọi truy vấn đều bị khóa cứng theo chính req.user.
 *  Kể cả ADMIN/HR/MANAGER khi đi qua cổng này cũng chỉ thấy dữ liệu của mình. */

const { AppError } = require('../utils/helpers');

const VISIBLE_PAYSLIP_STATUSES = ['Đã chốt'];

const ALIAS_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

function assertAlias(alias) {
  if (!ALIAS_PATTERN.test(String(alias || ''))) {
    throw new AppError('Alias bảng không hợp lệ.', 500);
  }
  return alias;
}

/** Điều kiện WHERE scope theo nhân viên. Alias mặc định 'e'. */
function selfScope(user, alias = 'e') {
  const safeAlias = assertAlias(alias);
  const id = employeeIdOf(user);
  if (!id) return { sql: '1 = 0', params: [] };
  return { sql: `${safeAlias}.id = ?`, params: [id] };
}

/** Scope riêng cho bảng payrolls (alias mặc định 'pr'). */
function payslipScope(user, alias = 'pr') {
  const safeAlias = assertAlias(alias);
  const id = employeeIdOf(user);
  if (!id) return { sql: '1 = 0', params: [] };
  return { sql: `${safeAlias}.employee_id = ?`, params: [id] };
}

/** Ép employee_id của user về số nguyên dương, trả 0 khi thiếu/không hợp lệ. */
function employeeIdOf(user) {
  if (!user || user.employee_id === null || user.employee_id === undefined) return 0;
  const id = Number(user.employee_id);
  return Number.isFinite(id) && id > 0 ? Math.floor(id) : 0;
}

/** Chặn yêu cầu đụng tới hồ sơ của người khác. */
function assertSelf(user, requestedId) {
  const own = employeeIdOf(user);
  const requested = Number(requestedId);
  if (!own || !Number.isFinite(requested) || requested !== own) {
    throw new AppError('Bạn chỉ có thể truy cập dữ liệu của chính mình.', 403, {
      code: 'FORBIDDEN',
    });
  }
  return true;
}

module.exports = {
  selfScope,
  payslipScope,
  assertSelf,
  employeeIdOf,
  VISIBLE_PAYSLIP_STATUSES,
};
