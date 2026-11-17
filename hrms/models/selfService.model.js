'use strict';

/** Truy cập dữ liệu cho cổng nhân viên (/me). Mọi hàm đều nhận employee_id từ req.user. */

const db = require('../config/db');
const { getPagination, buildOrderBy } = require('../utils/helpers');

const ATTENDANCE_ORDER = {
  work_date: 'a.work_date', status: 'a.status', created_at: 'a.created_at',
};
const LEAVE_ORDER = {
  start_date: 'lr.start_date', status: 'lr.status', created_at: 'lr.created_at',
};
const PAYSLIP_ORDER = {
  period_code: 'pp.period_code', net_salary: 'p.net_salary', created_at: 'p.created_at',
};

async function getProfile(employeeId) {
  return db.queryOne(
    `SELECT e.id, e.employee_code, e.full_name, e.gender, e.date_of_birth, e.phone,
            e.email, e.address, e.hire_date, e.status, e.avatar_path,
            d.name AS department_name, p.name AS position_name,
            m.full_name AS manager_name
       FROM employees e
       LEFT JOIN departments d ON d.id = e.department_id
       LEFT JOIN positions p ON p.id = e.position_id
       LEFT JOIN employees m ON m.id = e.manager_id
      WHERE e.id = ?`,
    [employeeId]
  );
}

async function listAttendance(employeeId, filters = {}, paging = {}) {
  const { page, limit, offset } = getPagination(paging, 20, 100);
  const clauses = ['a.employee_id = ?'];
  const params = [employeeId];

  const month = Number(filters.month);
  const year = Number(filters.year);
  if (Number.isInteger(month) && month >= 1 && month <= 12) {
    clauses.push('MONTH(a.work_date) = ?');
    params.push(month);
  }
  if (Number.isInteger(year) && year >= 2000 && year <= 2100) {
    clauses.push('YEAR(a.work_date) = ?');
    params.push(year);
  }
  const where = clauses.join(' AND ');
  const order = buildOrderBy(paging.sort, ATTENDANCE_ORDER, 'a.work_date DESC');

  const counted = await db.queryOne(
    `SELECT COUNT(*) AS total FROM attendance a WHERE ${where}`, params
  );
  const { rows } = await db.query(
    `SELECT a.id, a.work_date, a.check_in, a.check_out, a.status, a.late_minutes,
            a.early_minutes, a.worked_minutes, a.is_approved, a.note,
            s.name AS shift_name
       FROM attendance a
       LEFT JOIN shifts s ON s.id = a.shift_id
      WHERE ${where}
      ${order}
      LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const total = Number(counted.total) || 0;
  return { rows, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

async function listLeaves(employeeId, paging = {}) {
  const { page, limit, offset } = getPagination(paging, 20, 100);
  const order = buildOrderBy(paging.sort, LEAVE_ORDER, 'lr.created_at DESC');
  const counted = await db.queryOne(
    'SELECT COUNT(*) AS total FROM leave_requests lr WHERE lr.employee_id = ?',
    [employeeId]
  );
  const { rows } = await db.query(
    `SELECT lr.id, lr.start_date, lr.end_date, lr.total_days, lr.reason, lr.status,
            lr.approval_note, lt.name AS leave_type_name
       FROM leave_requests lr
       JOIN leave_types lt ON lt.id = lr.leave_type_id
      WHERE lr.employee_id = ?
      ${order}
      LIMIT ? OFFSET ?`,
    [employeeId, limit, offset]
  );
  const total = Number(counted.total) || 0;
  return { rows, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

async function listLeaveBalances(employeeId, year) {
  const { rows } = await db.query(
    `SELECT lb.year, lb.opening_days, lb.accrued_days, lb.used_days, lb.remaining_days,
            lt.name AS leave_type_name
       FROM leave_balances lb
       JOIN leave_types lt ON lt.id = lb.leave_type_id
      WHERE lb.employee_id = ? AND lb.year = ?
      ORDER BY lt.name`,
    [employeeId, year]
  );
  return rows;
}

/** Nhân viên chỉ thấy phiếu Đã chốt — điều kiện nằm ngay trong SQL. */
async function listPayslips(employeeId, paging = {}) {
  const { page, limit, offset } = getPagination(paging, 20, 100);
  const order = buildOrderBy(paging.sort, PAYSLIP_ORDER, 'pp.year DESC, pp.month DESC');
  const counted = await db.queryOne(
    `SELECT COUNT(*) AS total
       FROM payrolls p
       JOIN payroll_periods pp ON pp.id = p.period_id
      WHERE p.employee_id = ? AND p.status = 'Đã chốt'`,
    [employeeId]
  );
  const { rows } = await db.query(
    `SELECT p.id, p.base_salary, p.allowance, p.bonus, p.overtime_pay, p.deduction,
            p.insurance_amount, p.taxable_income, p.personal_income_tax, p.net_salary,
            p.working_days, p.status, p.note, pp.period_code, pp.month, pp.year
       FROM payrolls p
       JOIN payroll_periods pp ON pp.id = p.period_id
      WHERE p.employee_id = ? AND p.status = 'Đã chốt'
      ${order}
      LIMIT ? OFFSET ?`,
    [employeeId, limit, offset]
  );
  const total = Number(counted.total) || 0;
  return { rows, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

async function getPayslipDetail(payslipId, employeeId) {
  const payslip = await db.queryOne(
    `SELECT p.*, pp.period_code, pp.month, pp.year,
            e.employee_code, e.full_name, e.email, e.hire_date,
            d.name AS department_name, pos.name AS position_name
       FROM payrolls p
       JOIN payroll_periods pp ON pp.id = p.period_id
       JOIN employees e ON e.id = p.employee_id
       LEFT JOIN departments d ON d.id = e.department_id
       LEFT JOIN positions pos ON pos.id = e.position_id
      WHERE p.id = ? AND p.employee_id = ? AND p.status = 'Đã chốt'`,
    [payslipId, employeeId]
  );
  if (!payslip) return null;

  const { rows: items } = await db.query(
    `SELECT item_type, code, name, amount, note
       FROM payroll_items
      WHERE payroll_id = ?
      ORDER BY FIELD(item_type, 'Thu nhập', 'Bảo hiểm', 'Khấu trừ', 'Thuế'), code`,
    [payslipId]
  );
  return { payslip, items };
}

module.exports = {
  getProfile,
  listAttendance,
  listLeaves,
  listLeaveBalances,
  listPayslips,
  getPayslipDetail,
};
