'use strict';

/** Nghiệp vụ nghỉ phép thuần túy: đếm ngày công, kiểm tra quỹ phép. */

const dayjs = require('dayjs');
const { AppError } = require('../utils/helpers');

const LEAVE_STATUSES = ['Chờ duyệt', 'Đã duyệt', 'Từ chối'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value, label) {
  const text = String(value || '').slice(0, 10);
  if (!DATE_PATTERN.test(text)) throw new AppError(`${label} không hợp lệ.`, 400);
  const parsed = dayjs(text);
  if (!parsed.isValid() || parsed.format('YYYY-MM-DD') !== text) {
    throw new AppError(`${label} không tồn tại.`, 400);
  }
  return parsed;
}

function holidayDates(holidays) {
  const list = Array.isArray(holidays) ? holidays : [];
  const result = new Set();
  for (const item of list) {
    const value = typeof item === 'string' ? item : item?.holiday_date;
    if (!value) continue;
    const text = String(value).slice(0, 10);
    if (DATE_PATTERN.test(text)) result.add(text);
  }
  return result;
}

/**
 * Đếm số ngày nghỉ tính công trong khoảng [start, end].
 * Bỏ qua Thứ 7, Chủ nhật và các ngày lễ truyền vào.
 */
function calculateLeaveDays(startDate, endDate, holidays = []) {
  const start = parseDate(startDate, 'Ngày bắt đầu');
  const end = parseDate(endDate, 'Ngày kết thúc');
  if (end.isBefore(start, 'day')) {
    throw new AppError('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.', 400);
  }
  const excluded = holidayDates(holidays);
  let days = 0;
  for (let cursor = start; !cursor.isAfter(end, 'day'); cursor = cursor.add(1, 'day')) {
    const weekday = cursor.day();
    if (weekday === 0 || weekday === 6) continue;
    if (excluded.has(cursor.format('YYYY-MM-DD'))) continue;
    days += 1;
  }
  return days;
}

/** Loại phép có max_days_per_year = NULL là không giới hạn quỹ (nghỉ không lương). */
function isUnlimitedLeave(leaveType = {}) {
  const max = leaveType?.max_days_per_year;
  return max === null || max === undefined || max === '';
}

function assertSufficientBalance(balance, requestedDays, leaveType = {}) {
  if (isUnlimitedLeave(leaveType)) return;
  const remaining = Number(balance?.remaining_days || 0);
  const requested = Number(requestedDays || 0);
  if (requested > remaining + 1e-9) {
    throw new AppError(
      `Quỹ phép còn ${remaining} ngày, không đủ để dùng ${requested} ngày.`,
      409,
      { code: 'INSUFFICIENT_LEAVE' }
    );
  }
}

module.exports = {
  LEAVE_STATUSES,
  calculateLeaveDays,
  isUnlimitedLeave,
  assertSufficientBalance,
};
