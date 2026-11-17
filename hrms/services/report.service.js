'use strict';

/** Service thuần cho báo cáo: chuẩn hóa kỳ, gom nhóm dữ liệu và dựng bảng Excel.
 *  Không đụng DB, không đụng response — dễ test bằng node --test. */

const dayjs = require('dayjs');
const { AppError, formatDate } = require('../utils/helpers');

const ATTENDANCE_STATUSES = ['Đúng giờ', 'Đi trễ', 'Về sớm', 'Thiếu giờ', 'Vắng mặt'];

const REPORT_TYPES = ['attendance', 'leave', 'payroll'];

/** Kỳ báo cáo: month/year hợp lệ thì dùng, ngược lại dùng tháng hiện tại. */
function normalizePeriod(source = {}) {
  const now = new Date();
  const month = Number(source.month);
  const year = Number(source.year);
  const valid = Number.isInteger(month) && month >= 1 && month <= 12
    && Number.isInteger(year) && year >= 2000 && year <= 2100;

  const m = valid ? month : now.getMonth() + 1;
  const y = valid ? year : now.getFullYear();
  const first = dayjs(`${y}-${String(m).padStart(2, '0')}-01`);

  return {
    month: m,
    year: y,
    start_date: first.format('YYYY-MM-DD'),
    end_date: first.endOf('month').format('YYYY-MM-DD'),
    label: `${String(m).padStart(2, '0')}/${y}`,
  };
}

/** Gom số lượt công theo 5 trạng thái, bỏ trạng thái lạ. */
function aggregateAttendance(rows = []) {
  const result = { total: 0, on_time: 0, on_time_rate: 0 };
  for (const status of ATTENDANCE_STATUSES) result[status] = 0;

  for (const row of Array.isArray(rows) ? rows : []) {
    const status = String(row && row.status || '');
    if (!ATTENDANCE_STATUSES.includes(status)) continue;
    const count = Number(row.total) || 0;
    result[status] += count;
    result.total += count;
    if (status === 'Đúng giờ') result.on_time += count;
  }

  result.on_time_rate = result.total
    ? Math.round((result.on_time / result.total) * 1000) / 10
    : 0;
  return result;
}

/** Đổi cặp cột {name,total} thành {labels,values} cho Chart.js. */
function groupCounts(rows, labelKey, valueKey) {
  const items = Array.isArray(rows) ? rows : [];
  return {
    labels: items.map((row) => (row[labelKey] === null || row[labelKey] === undefined
      ? '' : String(row[labelKey]))),
    values: items.map((row) => Number(row[valueKey]) || 0),
  };
}

/** Tạo payload cho 4 biểu đồ trên trang báo cáo. */
function buildChartPayload(data = {}) {
  const attendance = aggregateAttendance(data.attendanceStatus);
  return {
    statusChart: {
      labels: [...ATTENDANCE_STATUSES],
      values: ATTENDANCE_STATUSES.map((status) => attendance[status]),
    },
    attendanceChart: Array.isArray(data.attendanceTrend) ? data.attendanceTrend : [],
    leaveChart: groupCounts(data.leaveByType, 'name', 'total'),
    payrollChart: groupCounts(data.payrollByDepartment, 'department_name', 'total_net'),
  };
}

const ATTENDANCE_HEADER = [
  'Ngày', 'Nhân viên', 'Mã NV', 'Phòng ban', 'Ca làm', 'Trạng thái',
  'Giờ vào', 'Giờ ra', 'Trễ (phút)', 'Về sớm (phút)', 'Số giờ công', 'Duyệt',
];

const PAYROLL_HEADER = [
  'Mã NV', 'Nhân viên', 'Phòng ban', 'Kỳ lương', 'Lương cơ bản', 'Phụ cấp',
  'Thưởng', 'Làm thêm', 'Khấu trừ', 'Lương thực lãnh', 'BHXH/BHYT/BHTN', 'Thuế TNCN',
];

const LEAVE_HEADER = [
  'Nhân viên', 'Mã NV', 'Phòng ban', 'Loại phép', 'Từ ngày', 'Đến ngày',
  'Số ngày', 'Lý do', 'Trạng thái',
];

function attendanceRows(details = []) {
  return (Array.isArray(details) ? details : []).map((row) => [
    formatDate(row.work_date),
    row.full_name || '',
    row.employee_code || '',
    row.department_name || '',
    row.shift_name || '',
    row.status || '',
    row.check_in || '',
    row.check_out || '',
    Number(row.late_minutes) || 0,
    Number(row.early_minutes) || 0,
    Math.round((Number(row.worked_minutes) || 0) / 60 * 100) / 100,
    Number(row.is_approved) === 1 ? 'Đã duyệt' : 'Chưa duyệt',
  ]);
}

function payrollRows(details = []) {
  return (Array.isArray(details) ? details : []).map((row) => [
    row.employee_code || '',
    row.full_name || '',
    row.department_name || '',
    row.period_code || '',
    Number(row.base_salary) || 0,
    Number(row.allowance) || 0,
    Number(row.bonus) || 0,
    Number(row.overtime_pay) || 0,
    Number(row.deduction) || 0,
    Number(row.net_salary) || 0,
    Number(row.insurance_amount) || 0,
    Number(row.personal_income_tax) || 0,
  ]);
}

function leaveRows(details = []) {
  return (Array.isArray(details) ? details : []).map((row) => [
    row.full_name || '',
    row.employee_code || '',
    row.department_name || '',
    row.leave_type_name || '',
    formatDate(row.start_date),
    formatDate(row.end_date),
    Number(row.days_requested) || 0,
    row.reason || '',
    row.status || '',
  ]);
}

/** Trả về { sheetName, header, rows } cho exceljs. */
function buildExcelTable(type, data = {}) {
  switch (type) {
    case 'attendance':
      return { sheetName: 'Cham cong', header: ATTENDANCE_HEADER, rows: attendanceRows(data.attendanceDetails) };
    case 'payroll':
      return { sheetName: 'Bang luong', header: PAYROLL_HEADER, rows: payrollRows(data.payrollDetails) };
    case 'leave':
      return { sheetName: 'Don nghi phep', header: LEAVE_HEADER, rows: leaveRows(data.leaveDetails) };
    default:
      throw new AppError('Loại báo cáo không hợp lệ.', 400);
  }
}

/** Tiêu đề dùng chung cho màn hình và file export. */
function formatReportTitle(prefix, period) {
  return `${prefix} - ${period.label}`;
}

module.exports = {
  normalizePeriod,
  ATTENDANCE_STATUSES,
  REPORT_TYPES,
  aggregateAttendance,
  groupCounts,
  buildChartPayload,
  buildExcelTable,
  formatReportTitle,
};
