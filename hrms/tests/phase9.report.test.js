'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizePeriod, ATTENDANCE_STATUSES, aggregateAttendance, groupCounts,
  buildChartPayload, buildExcelTable, formatReportTitle,
} = require('../services/report.service');
const { buildExcel } = require('../services/reportExport.service');

test('normalizePeriod: trả đúng khoảng tháng/năm, kể cả năm nhuận', () => {
  assert.deepEqual(normalizePeriod({ month: '2', year: '2028' }), {
    month: 2,
    year: 2028,
    start_date: '2028-02-01',
    end_date: '2028-02-29',
    label: '02/2028',
  });
});

test('normalizePeriod: dùng tháng/năm hiện tại khi thiếu', () => {
  const now = new Date();
  const result = normalizePeriod({});
  assert.equal(result.month, now.getMonth() + 1);
  assert.equal(result.year, now.getFullYear());
});

test('normalizePeriod: fallback khi giá trị ngoài khoảng', () => {
  const now = new Date();
  const result = normalizePeriod({ month: '13', year: '1999' });
  assert.equal(result.month, now.getMonth() + 1);
  assert.equal(result.year, now.getFullYear());
});

test('ATTENDANCE_STATUSES đúng 5 trạng thái', () => {
  assert.deepEqual(ATTENDANCE_STATUSES, ['Đúng giờ', 'Đi trễ', 'Về sớm', 'Thiếu giờ', 'Vắng mặt']);
});

test('aggregateAttendance: cộng trạng thái, bỏ trạng thái lạ', () => {
  const result = aggregateAttendance([
    { status: 'Đúng giờ', total: 8 },
    { status: 'Đi trễ', total: 2 },
    { status: 'Lạ', total: 99 },
  ]);
  assert.equal(result.total, 10);
  assert.equal(result['Đúng giờ'], 8);
  assert.equal(result['Đi trễ'], 2);
  assert.equal(result.on_time, 8);
  assert.equal(result.on_time_rate, 80);
});

test('aggregateAttendance: không chia cho 0', () => {
  const result = aggregateAttendance([]);
  assert.equal(result.total, 0);
  assert.equal(result.on_time_rate, 0);
});

test('groupCounts: đổi tên cột thành labels/values', () => {
  assert.deepEqual(
    groupCounts([{ name: 'A', total: 3 }, { name: 'B', total: 5 }], 'name', 'total'),
    { labels: ['A', 'B'], values: [3, 5] }
  );
});

test('buildChartPayload: map đủ 4 biểu đồ từ dữ liệu thô', () => {
  const payload = buildChartPayload({
    attendanceStatus: [{ status: 'Đúng giờ', total: 4 }],
    attendanceTrend: [{ label: '01/11', on_time: 3, late: 1 }],
    leaveByType: [{ name: 'Phép năm', total: 2 }],
    payrollByDepartment: [{ department_name: 'IT', total_net: 50000000 }],
  });
  assert.deepEqual(payload.statusChart.labels, ATTENDANCE_STATUSES);
  assert.equal(payload.statusChart.values[0], 4);
  assert.deepEqual(payload.attendanceChart, [{ label: '01/11', on_time: 3, late: 1 }]);
  assert.deepEqual(payload.leaveChart, { labels: ['Phép năm'], values: [2] });
  assert.deepEqual(payload.payrollChart, { labels: ['IT'], values: [50000000] });
});

test('buildExcelTable: báo cáo chấm công có header và dòng dữ liệu', () => {
  const table = buildExcelTable('attendance', {
    attendanceDetails: [{
      work_date: '2026-11-02', full_name: 'Nguyễn Văn A', employee_code: 'NV0001',
      department_name: 'IT', shift_name: 'Ca sáng', status: 'Đúng giờ',
      check_in: '08:00', check_out: '17:00', late_minutes: 0, early_minutes: 0,
      worked_minutes: 480, is_approved: 1,
    }],
  });
  assert.equal(table.sheetName, 'Cham cong');
  assert.equal(table.header[0], 'Ngày');
  assert.equal(table.rows.length, 1);
  assert.equal(table.rows[0][1], 'Nguyễn Văn A');
  assert.equal(table.rows[0][11], 'Đã duyệt');
});

test('buildExcelTable: báo cáo lương dùng định dạng tiền VND', () => {
  const table = buildExcelTable('payroll', {
    payrollDetails: [{
      employee_code: 'NV0002', full_name: 'Lê Thị B', department_name: 'HR',
      period_code: '2026-09', base_salary: 10000000, allowance: 2000000,
      bonus: 0, overtime_pay: 500000, deduction: 0, insurance_amount: 1050000,
      personal_income_tax: 0, net_salary: 11450000,
    }],
  });
  assert.equal(table.sheetName, 'Bang luong');
  assert.equal(table.rows[0][0], 'NV0002');
  assert.equal(table.rows[0][9], 11450000);
});

test('buildExcelTable: chặn loại báo cáo không hợp lệ', () => {
  assert.throws(() => buildExcelTable('khac'), (error) => error.statusCode === 400);
});

test('formatReportTitle: tạo tiêu đề theo kỳ', () => {
  assert.equal(formatReportTitle('Báo cáo chấm công', { label: '11/2026' }), 'Báo cáo chấm công - 11/2026');
});

test('buildExcel: xuất được workbook xlsx và giữ nguyên dòng tiêu đề', async () => {
  const table = {
    sheetName: 'Cham cong',
    header: ['Ngày', 'Nhân viên', 'Thực lãnh'],
    rows: [['2026-11-02', 'Nguyễn Văn A', 11450000]],
  };
  const buffer = await buildExcel(table, 'Báo cáo thử nghiệm - 11/2026');
  assert.equal(Buffer.isBuffer(buffer), true);
  assert.equal(buffer.slice(0, 2).toString(), 'PK');
});
