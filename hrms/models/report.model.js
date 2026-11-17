'use strict';

/** Truy vấn dữ liệu báo cáo. Scope đi qua employeeScope() của middlewares/role.js:
 *  ADMIN/HR thấy toàn bộ, MANAGER thấy phòng ban mình, EMPLOYEE thấy chính mình. */

const db = require('../config/db');

function buildScope(scope, departmentId) {
  const clauses = [scope.sql || '1 = 1'];
  const params = [...(scope.params || [])];
  if (departmentId) {
    clauses.push('e.department_id = ?');
    params.push(Number(departmentId));
  }
  return { where: clauses.join(' AND '), params };
}

function dateParams(period) {
  return [period.start_date, period.end_date];
}

async function getDepartments() {
  const { rows } = await db.query(
    'SELECT id, code, name FROM departments WHERE is_active = 1 ORDER BY name'
  );
  return rows;
}

async function getAttendanceStatus(scope, period, departmentId) {
  const { where, params } = buildScope(scope, departmentId);
  const { rows } = await db.query(
    `SELECT a.status, COUNT(*) AS total
       FROM attendance a
       JOIN employees e ON e.id = a.employee_id
      WHERE ${where} AND a.work_date BETWEEN ? AND ?
      GROUP BY a.status`,
    [...params, ...dateParams(period)]
  );
  return rows;
}

async function getAttendanceTrend(scope, period, departmentId) {
  const { where, params } = buildScope(scope, departmentId);
  const { rows } = await db.query(
    `SELECT DATE_FORMAT(a.work_date, '%d/%m') AS label,
            SUM(CASE WHEN a.status = 'Đúng giờ' THEN 1 ELSE 0 END) AS on_time,
            SUM(CASE WHEN a.status IN ('Đi trễ', 'Về sớm', 'Thiếu giờ') THEN 1 ELSE 0 END) AS late
       FROM attendance a
       JOIN employees e ON e.id = a.employee_id
      WHERE ${where} AND a.work_date BETWEEN ? AND ?
      GROUP BY a.work_date
      ORDER BY a.work_date`,
    [...params, ...dateParams(period)]
  );
  return rows;
}

async function getLeaveByType(scope, period, departmentId) {
  const { where, params } = buildScope(scope, departmentId);
  const { rows } = await db.query(
    `SELECT lt.name, COUNT(*) AS total
       FROM leave_requests lr
       JOIN employees e ON e.id = lr.employee_id
       JOIN leave_types lt ON lt.id = lr.leave_type_id
      WHERE ${where} AND lr.start_date BETWEEN ? AND ?
      GROUP BY lt.id
      ORDER BY total DESC`,
    [...params, ...dateParams(period)]
  );
  return rows;
}

async function getPayrollByDepartment(scope, period, departmentId) {
  const { where, params } = buildScope(scope, departmentId);
  const { rows } = await db.query(
    `SELECT COALESCE(d.name, 'Chưa phân phòng') AS department_name,
            SUM(p.net_salary) AS total_net
       FROM payrolls p
       JOIN payroll_periods pp ON pp.id = p.period_id
       JOIN employees e ON e.id = p.employee_id
       LEFT JOIN departments d ON d.id = e.department_id
      WHERE ${where} AND pp.month = ? AND pp.year = ? AND p.status = 'Đã chốt'
      GROUP BY d.id
      ORDER BY total_net DESC`,
    [...params, period.month, period.year]
  );
  return rows;
}

async function getAttendanceDetails(scope, period, departmentId) {
  const { where, params } = buildScope(scope, departmentId);
  const { rows } = await db.query(
    `SELECT a.work_date, e.full_name, e.employee_code, d.name AS department_name,
            s.name AS shift_name, a.status,
            TIME_FORMAT(a.check_in, '%H:%i') AS check_in,
            TIME_FORMAT(a.check_out, '%H:%i') AS check_out,
            a.late_minutes, a.early_minutes, a.worked_minutes, a.is_approved
       FROM attendance a
       JOIN employees e ON e.id = a.employee_id
       LEFT JOIN departments d ON d.id = e.department_id
       LEFT JOIN shifts s ON s.id = a.shift_id
      WHERE ${where} AND a.work_date BETWEEN ? AND ?
      ORDER BY a.work_date DESC, e.full_name`,
    [...params, ...dateParams(period)]
  );
  return rows;
}

async function getPayrollDetails(scope, period, departmentId) {
  const { where, params } = buildScope(scope, departmentId);
  const { rows } = await db.query(
    `SELECT e.employee_code, e.full_name, d.name AS department_name,
            pp.period_code, p.base_salary, p.allowance, p.bonus, p.overtime_pay,
            p.deduction, p.insurance_amount, p.personal_income_tax, p.net_salary
       FROM payrolls p
       JOIN payroll_periods pp ON pp.id = p.period_id
       JOIN employees e ON e.id = p.employee_id
       LEFT JOIN departments d ON d.id = e.department_id
      WHERE ${where} AND pp.month = ? AND pp.year = ? AND p.status = 'Đã chốt'
      ORDER BY e.full_name`,
    [...params, period.month, period.year]
  );
  return rows;
}

async function getLeaveDetails(scope, period, departmentId) {
  const { where, params } = buildScope(scope, departmentId);
  const { rows } = await db.query(
    `SELECT e.full_name, e.employee_code, d.name AS department_name,
            lt.name AS leave_type_name, lr.start_date, lr.end_date,
            lr.total_days AS days_requested, lr.reason, lr.status
       FROM leave_requests lr
       JOIN employees e ON e.id = lr.employee_id
       LEFT JOIN departments d ON d.id = e.department_id
       JOIN leave_types lt ON lt.id = lr.leave_type_id
      WHERE ${where} AND lr.start_date BETWEEN ? AND ?
      ORDER BY lr.start_date DESC, e.full_name`,
    [...params, ...dateParams(period)]
  );
  return rows;
}

module.exports = {
  getDepartments,
  getAttendanceStatus,
  getAttendanceTrend,
  getLeaveByType,
  getPayrollByDepartment,
  getAttendanceDetails,
  getPayrollDetails,
  getLeaveDetails,
};
