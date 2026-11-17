'use strict';

/** Tính toán chấm công thuần túy: không truy CSDL, dùng chung cho create/update. */

const DEFAULT_SHIFT = {
  start_time: '08:00:00',
  end_time: '17:00:00',
  break_minutes: 60,
  work_hours: 8,
  late_tolerance_minutes: 15,
  early_tolerance_minutes: 15,
  is_overnight: 0,
};

const STATUSES = Object.freeze([
  'Đúng giờ', 'Đi trễ', 'Về sớm', 'Thiếu giờ', 'Vắng mặt',
]);

function pad(value, length = 2) {
  return String(value).padStart(length, '0');
}

/** "08:30:15" -> 510.25 phút; trả null nếu sai định dạng. */
function parseClock(value) {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(value || '').trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] || 0);
  if (hour > 23 || minute > 59 || second > 59) return null;
  return hour * 60 + minute + second / 60;
}

/** Chấp nhận "YYYY-MM-DD HH:mm:ss" (MySQL) và "YYYY-MM-DDTHH:mm" (datetime-local). */
function parseDateTime(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(value).trim());
  if (!match) return null;
  const parsed = new Date(
    Number(match[1]), Number(match[2]) - 1, Number(match[3]),
    Number(match[4]), Number(match[5]), Number(match[6] || 0)
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Giá trị cho input[type="datetime-local"]. */
function formatDateTimeInput(value) {
  const date = parseDateTime(value);
  if (!date) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Chuẩn hóa về "YYYY-MM-DD HH:mm:ss" để lưu DATETIME. */
function normalizeDateTime(value) {
  const date = parseDateTime(value);
  if (!date) return null;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
    + `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function atMinutes(baseDate, minutes) {
  const result = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 0, 0, 0, 0);
  result.setMinutes(Math.floor(minutes), Math.round((minutes % 1) * 60), 0);
  return result;
}

/**
 * Trả về { status, late_minutes, early_minutes, worked_minutes, overtime_minutes }.
 * worked_minutes đã trừ thời gian nghỉ; overtime là phần vượt work_hours.
 */
function calculate(shiftInput, checkInInput, checkOutInput, workDate) {
  const shift = { ...DEFAULT_SHIFT, ...(shiftInput || {}) };
  const checkIn = parseDateTime(checkInInput);
  const checkOut = parseDateTime(checkOutInput);

  const empty = {
    status: 'Vắng mặt',
    late_minutes: 0,
    early_minutes: 0,
    worked_minutes: 0,
    overtime_minutes: 0,
  };

  if (!checkIn && !checkOut) return empty;
  if (!checkIn || !checkOut) {
    return { ...empty, status: 'Thiếu giờ' };
  }

  const startMinutes = parseClock(shift.start_time);
  const endMinutes = parseClock(shift.end_time);
  if (startMinutes === null || endMinutes === null) return { ...empty, status: 'Thiếu giờ' };

  const base = parseDateTime(`${String(workDate || '').slice(0, 10)}T00:00:00`) || new Date(
    checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate(), 0, 0, 0, 0
  );
  const shiftStart = atMinutes(base, startMinutes);
  const shiftEnd = atMinutes(base, endMinutes);
  if (shiftEnd <= shiftStart) shiftEnd.setDate(shiftEnd.getDate() + 1);

  const requiredMinutes = Math.max(1, Math.round(Number(shift.work_hours || 8) * 60));
  const breakMinutes = Math.max(0, Number(shift.break_minutes) || 0);
  const lateTolerance = Math.max(0, Number(shift.late_tolerance_minutes) || 0);
  const earlyTolerance = Math.max(0, Number(shift.early_tolerance_minutes) || 0);

  const lateMinutes = Math.max(0, Math.round((checkIn - shiftStart) / 60000 - lateTolerance));
  const earlyMinutes = Math.max(0, Math.round((shiftEnd - checkOut) / 60000 - earlyTolerance));
  const workedMinutes = Math.max(0, Math.round((checkOut - checkIn) / 60000 - breakMinutes));
  const overtimeMinutes = Math.max(0, workedMinutes - requiredMinutes);

  let status = 'Đúng giờ';
  if (workedMinutes < requiredMinutes) status = 'Thiếu giờ';
  else if (lateMinutes > 0 || earlyMinutes > 0) {
    status = lateMinutes >= earlyMinutes && lateMinutes > 0 ? 'Đi trễ' : 'Về sớm';
  }

  return {
    status,
    late_minutes: lateMinutes,
    early_minutes: earlyMinutes,
    worked_minutes: workedMinutes,
    overtime_minutes: overtimeMinutes,
  };
}

module.exports = {
  STATUSES,
  parseClock,
  parseDateTime,
  formatDateTimeInput,
  normalizeDateTime,
  calculate,
};
