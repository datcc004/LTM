'use strict';

/** Tìm kiếm nhanh trong header. Kết quả luôn bị giới hạn bởi employeeScope (RBAC dữ liệu). */

const db = require('../config/db');
const { employeeScope } = require('../middlewares/role');
const { asyncHandler, jsonSuccess } = require('../utils/helpers');

const index = asyncHandler(async (req, res) => {
  const keyword = String(req.query.q || '').trim();
  if (keyword.length < 2) return jsonSuccess(res, []);

  const scope = employeeScope(req, 'e');
  const pattern = `%${keyword}%`;
  const results = [];

  const { rows: employees } = await db.query(
    `SELECT e.id, e.employee_code, e.full_name, d.name AS department_name
       FROM employees e
       LEFT JOIN departments d ON d.id = e.department_id
      WHERE (${scope.sql}) AND (e.full_name LIKE ? OR e.employee_code LIKE ?)
      ORDER BY e.full_name ASC LIMIT 5`,
    [...scope.params, pattern, pattern]
  );
  employees.forEach((row) => results.push({
    id: `employee-${row.id}`,
    type: 'Nhân viên',
    title: `${row.employee_code} - ${row.full_name}`,
    subtitle: row.department_name || '—',
    url: `/employees/${row.id}`,
    icon: 'user-round',
  }));

  const { rows: leaves } = await db.query(
    `SELECT lr.id, e.full_name, lr.start_date, lr.status
       FROM leave_requests lr
       JOIN employees e ON e.id = lr.employee_id
      WHERE (${scope.sql}) AND (e.full_name LIKE ? OR lr.reason LIKE ?)
      ORDER BY lr.created_at DESC LIMIT 5`,
    [...scope.params, pattern, pattern]
  );
  leaves.forEach((row) => results.push({
    id: `leave-${row.id}`,
    type: 'Đơn nghỉ phép',
    title: `${row.full_name} - ${row.status}`,
    subtitle: `Bắt đầu ${row.start_date}`,
    url: '/leave-requests',
    icon: 'calendar-days',
  }));

  const { rows: overtimes } = await db.query(
    `SELECT ot.id, e.full_name, ot.work_date, ot.status
       FROM overtime_requests ot
       JOIN employees e ON e.id = ot.employee_id
      WHERE (${scope.sql}) AND (e.full_name LIKE ? OR ot.reason LIKE ?)
      ORDER BY ot.created_at DESC LIMIT 5`,
    [...scope.params, pattern, pattern]
  );
  overtimes.forEach((row) => results.push({
    id: `overtime-${row.id}`,
    type: 'Đơn tăng ca',
    title: `${row.full_name} - ${row.status}`,
    subtitle: `Ngày ${row.work_date}`,
    url: '/overtime-requests',
    icon: 'timer',
  }));

  return jsonSuccess(res, results.slice(0, 12));
});

module.exports = { index };
