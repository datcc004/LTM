'use strict';

/** Service thuần cho quản trị: phân nhóm cấu hình, chuẩn hóa ngày lễ và bộ lọc audit.
 *  Không đụng DB — dễ test bằng node --test. */

const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const { AppError, sanitizeText } = require('../utils/helpers');

dayjs.extend(customParseFormat);

const ROLE_IDS = Object.freeze({ ADMIN: 1, HR: 2, MANAGER: 3, EMPLOYEE: 4 });

const SETTING_GROUPS = [
  'GENERAL', 'CONTRACT', 'ATTENDANCE', 'SALARY', 'LEAVE', 'PAYROLL',
];

const GROUP_LABELS = {
  GENERAL: 'Thông tin chung',
  CONTRACT: 'Hợp đồng',
  ATTENDANCE: 'Chấm công',
  SALARY: 'Tiền lương',
  LEAVE: 'Nghỉ phép',
  PAYROLL: 'Bảng lương',
  OTHER: 'Khác',
};

const AUDIT_ACTIONS = [
  'INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'APPROVE', 'REJECT',
  'LOCK', 'UNLOCK', 'CREATE', 'CHANGE_PASSWORD',
];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(value) {
  if (!DATE_PATTERN.test(String(value || ''))) return false;
  return dayjs(String(value), 'YYYY-MM-DD', true).isValid();
}

/** Gom setting theo thứ tự nhóm cố định; nhóm lạ vào "Khác". Bỏ nhóm rỗng. */
function groupSettings(rows = []) {
  const buckets = new Map();
  for (const group of SETTING_GROUPS) {
    buckets.set(group, { group, label: GROUP_LABELS[group], settings: [] });
  }
  const other = { group: 'OTHER', label: GROUP_LABELS.OTHER, settings: [] };

  for (const row of Array.isArray(rows) ? rows : []) {
    const key = String(row.setting_group || '').toUpperCase();
    const target = buckets.has(key) ? buckets.get(key) : other;
    target.settings.push(row);
  }

  const result = [...buckets.values()].filter((item) => item.settings.length);
  if (other.settings.length) result.push(other);
  return result;
}

/** Giữ dạng chuỗi số cho setting số, làm sạch text cho setting thường. */
function coerceSettingValue(setting, value) {
  const current = String(setting && setting.setting_value !== undefined
    ? setting.setting_value : '');
  const numericSetting = current.trim() !== '' && Number.isFinite(Number(current));
  const incoming = value === null || value === undefined ? '' : String(value).trim();

  if (numericSetting) {
    if (incoming === '' || !Number.isFinite(Number(incoming))) {
      throw new AppError('Giá trị cấu hình số không hợp lệ.', 400);
    }
    return incoming;
  }
  return sanitizeText(incoming);
}

/** Chuẩn hóa dữ liệu ngày lễ trước khi insert/update. */
function normalizeHoliday(input = {}) {
  const name = sanitizeText(input.name);
  if (!name) throw new AppError('Tên ngày lễ không được để trống.', 400);

  const holidayDate = String(input.holiday_date || '').trim();
  if (!isRealDate(holidayDate)) {
    throw new AppError('Ngày lễ phải theo định dạng YYYY-MM-DD và là ngày hợp lệ.', 400);
  }

  return {
    name,
    holiday_date: holidayDate,
    is_recurring: input.is_recurring === 1 || String(input.is_recurring) === '1' ? 1 : 0,
    note: sanitizeText(input.note),
  };
}

/** Ngày lễ lặp hằng năm khớp theo tháng/ngày; ngày lễ thường khớp chính xác. */
function holidayOccursOn(holiday, date) {
  if (!holiday || !date) return false;
  const target = dayjs(String(date));
  if (!target.isValid()) return false;

  if (Number(holiday.is_recurring) === 1) {
    const origin = dayjs(String(holiday.holiday_date));
    return origin.isValid()
      && origin.month() === target.month()
      && origin.date() === target.date();
  }
  return String(holiday.holiday_date) === target.format('YYYY-MM-DD');
}

/** Bộ lọc audit log: whitelist action/table, bỏ ngày/page sai định dạng. */
function normalizeAuditQuery(query = {}) {
  const action = String(query.action || '').toUpperCase();
  const tableRaw = String(query.table_name || '').trim();
  const from = String(query.from_date || '').trim();
  const to = String(query.to_date || '').trim();
  const page = Math.max(1, parseInt(query.page, 10) || 1);

  return {
    action: AUDIT_ACTIONS.includes(action) ? action : '',
    table_name: /^[A-Za-z_][A-Za-z0-9_]*$/.test(tableRaw) ? tableRaw : '',
    q: sanitizeText(query.q),
    from_date: isRealDate(from) ? from : '',
    to_date: isRealDate(to) ? to : '',
    page,
  };
}

module.exports = {
  ROLE_IDS,
  SETTING_GROUPS,
  GROUP_LABELS,
  AUDIT_ACTIONS,
  groupSettings,
  coerceSettingValue,
  normalizeHoliday,
  holidayOccursOn,
  normalizeAuditQuery,
};
