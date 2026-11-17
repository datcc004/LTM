'use strict';

/** Báo cáo: tổng hợp chấm công/nghỉ phép/tiền lương, biểu đồ và export Excel/PDF. */

const reportModel = require('../models/report.model');
const reportService = require('../services/report.service');
const exportService = require('../services/reportExport.service');
const { employeeScope } = require('../middlewares/role');
const { asyncHandler, jsonSuccess } = require('../utils/helpers');

const VIEW = 'reports/index';
const TYPE_LABELS = {
  attendance: 'Báo cáo chấm công',
  leave: 'Báo cáo nghỉ phép',
  payroll: 'Báo cáo tiền lương',
};

function buildQuery(req) {
  const type = String(req.query.type || 'attendance');
  return {
    type: reportService.REPORT_TYPES.includes(type) ? type : 'attendance',
    month: String(req.query.month || ''),
    year: String(req.query.year || ''),
    department_id: String(req.query.department_id || ''),
  };
}

async function collect(req) {
  const query = buildQuery(req);
  const period = reportService.normalizePeriod(query);
  const scope = employeeScope(req, 'e');
  const departmentId = query.department_id || null;

  const [
    departments, attendanceStatus, attendanceTrend, leaveByType,
    payrollByDepartment, attendanceDetails, payrollDetails, leaveDetails,
  ] = await Promise.all([
    reportModel.getDepartments(),
    reportModel.getAttendanceStatus(scope, period, departmentId),
    reportModel.getAttendanceTrend(scope, period, departmentId),
    reportModel.getLeaveByType(scope, period, departmentId),
    reportModel.getPayrollByDepartment(scope, period, departmentId),
    reportModel.getAttendanceDetails(scope, period, departmentId),
    reportModel.getPayrollDetails(scope, period, departmentId),
    reportModel.getLeaveDetails(scope, period, departmentId),
  ]);

  const attendance = reportService.aggregateAttendance(attendanceStatus);
  const summary = {
    attendance,
    totalLeave: leaveDetails.length,
    totalPayroll: payrollDetails.length,
    netSalary: payrollDetails.reduce((sum, row) => sum + (Number(row.net_salary) || 0), 0),
  };

  return {
    query,
    period,
    departments,
    summary,
    charts: reportService.buildChartPayload({
      attendanceStatus, attendanceTrend, leaveByType, payrollByDepartment,
    }),
    details: { attendanceDetails, payrollDetails, leaveDetails },
  };
}

const index = asyncHandler(async (req, res) => {
  const data = await collect(req);
  return res.render(VIEW, {
    title: 'Báo cáo',
    ...data,
    titleText: reportService.formatReportTitle(TYPE_LABELS[data.query.type], data.period),
  });
});

/** Dữ liệu biểu đồ cho public/js/reports.js (không inline script, CSP). */
const chartData = asyncHandler(async (req, res) => {
  const data = await collect(req);
  return jsonSuccess(res, { charts: data.charts, summary: data.summary, period: data.period });
});

async function sendExport(req, res, format) {
  const data = await collect(req);
  const type = data.query.type;
  const table = reportService.buildExcelTable(type, data.details);
  const title = reportService.formatReportTitle(TYPE_LABELS[type], data.period);
  const filename = `report-${type}-${data.period.year}-${String(data.period.month).padStart(2, '0')}`;

  if (format === 'pdf') {
    const buffer = await exportService.buildPdf(table, title);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
    return res.send(buffer);
  }

  const buffer = await exportService.buildExcel(table, title);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
  return res.send(buffer);
}

const exportExcel = asyncHandler(async (req, res) => sendExport(req, res, 'excel'));
const exportPdf = asyncHandler(async (req, res) => sendExport(req, res, 'pdf'));

module.exports = { index, chartData, exportExcel, exportPdf };
