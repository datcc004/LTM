'use strict';

/** Truy vấn dùng chung cho dashboard, badge sidebar và danh sách thông báo.
 *  Mọi scope đều đi qua employeeScope() để MANAGER chỉ thấy phòng ban, EMPLOYEE chỉ thấy mình. */

const db = require('../config/db');
const env = require('../config/env');
const { employeeScope } = require('../middlewares/role');
const { formatDateTime, formatDate } = require('../utils/helpers');

function scopeFor(user, alias = 'e') {
  return employeeScope({ user }, alias);
}

function count(sqlParts, params) {
  return db.queryOne(
    `SELECT ${sqlParts.join(',\n       ')}`,
    params
  );
}

async function getBadges(user) {
  if (!user) return {};
  const scope = scopeFor(user, 'e');

  const parts = [];
  const params = [];

  parts.push(`(SELECT COUNT(*) FROM leave_requests lr
     JOIN employees e ON e.id = lr.employee_id
     WHERE lr.status = 'Chờ duyệt' AND ${scope.sql}) AS pendingLeaves`);
  params.push(...scope.params);

  parts.push(`(SELECT COUNT(*) FROM overtime_requests ot
     JOIN employees e ON e.id = ot.employee_id
     WHERE ot.status = 'Chờ duyệt' AND ${scope.sql}) AS pendingOvertimes`);
  params.push(...scope.params);

  parts.push(`(SELECT COUNT(*) FROM contracts c
     JOIN employees e ON e.id = c.employee_id
     WHERE c.end_date IS NOT NULL
       AND c.end_date >= CURDATE()
       AND c.end_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
       AND c.status <> 'Đã hủy' AND ${scope.sql}) AS expiringContracts`);
  params.push(env.business.contractAlertDays, ...scope.params);

  const row = await count(parts, params);
  const pendingLeaves = Number(row?.pendingLeaves || 0);
  const pendingOvertimes = Number(row?.pendingOvertimes || 0);
  return {
    pendingLeaves,
    pendingOvertimes,
    pendingRequests: pendingLeaves + pendingOvertimes,
    expiringContracts: Number(row?.expiringContracts || 0),
  };
}

async function getNotifications(user, limit = 5) {
  if (!user) return [];
  const scope = scopeFor(user, 'e');
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 5));

  const { rows: leaveNotes } = await db.query(
    `SELECT lr.id,
            CONCAT('Đơn nghỉ phép - ', e.full_name) AS title,
            CONCAT(lt.name, ' | ', DATE_FORMAT(lr.start_date, '%d/%m/%Y')) AS message,
            lr.created_at AS happened_at,
            '/leave-requests' AS url,
            'calendar-days' AS icon
     FROM leave_requests lr
     JOIN employees e ON e.id = lr.employee_id
     JOIN leave_types lt ON lt.id = lr.leave_type_id
     WHERE lr.status = 'Chờ duyệt' AND ${scope.sql}
     ORDER BY lr.created_at DESC LIMIT ${safeLimit}`,
    scope.params
  );

  const { rows: contractNotes } = await db.query(
    `SELECT c.id,
            CONCAT('Hợp đồng sắp hết hạn - ', e.full_name) AS title,
            CONCAT(c.contract_no, ' | hết hạn ', DATE_FORMAT(c.end_date, '%d/%m/%Y')) AS message,
            c.updated_at AS happened_at,
            '/contracts' AS url,
            'file-clock' AS icon
     FROM contracts c
     JOIN employees e ON e.id = c.employee_id
     WHERE c.end_date IS NOT NULL
       AND c.end_date >= CURDATE()
       AND c.end_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
       AND c.status <> 'Đã hủy' AND ${scope.sql}
     ORDER BY c.end_date ASC LIMIT ${safeLimit}`,
    [env.business.contractAlertDays, ...scope.params]
  );

  return [...leaveNotes, ...contractNotes]
    .map((item) => ({
      id: `${item.icon}-${item.id}`,
      title: item.title,
      message: item.message,
      time: formatDateTime(item.happened_at),
      url: item.url,
      icon: item.icon,
    }))
    .sort((a, b) => String(b.time).localeCompare(String(a.time)))
    .slice(0, safeLimit);
}

async function getDashboardData(user) {
  const scope = scopeFor(user, 'e');
  const p = scope.params;
  const repeat = (times) => Array.from({ length: times }, () => [...p]).flat();

  const statsPromise = db.queryOne(
    `SELECT
       (SELECT COUNT(*) FROM employees e WHERE e.status = 'Đang làm việc' AND ${scope.sql}) AS activeEmployees,
       (SELECT COUNT(*) FROM employees e WHERE ${scope.sql}) AS totalEmployees,
       (SELECT COUNT(*) FROM employees e WHERE e.hire_date >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND ${scope.sql}) AS newEmployees,
       (SELECT COUNT(*) FROM leave_requests lr JOIN employees e ON e.id = lr.employee_id WHERE lr.status = 'Chờ duyệt' AND ${scope.sql}) AS pendingLeaves,
       (SELECT COUNT(*) FROM overtime_requests ot JOIN employees e ON e.id = ot.employee_id WHERE ot.status = 'Chờ duyệt' AND ${scope.sql}) AS pendingOvertimes,
       (SELECT COUNT(*) FROM attendance a JOIN employees e ON e.id = a.employee_id WHERE a.work_date = CURDATE() AND ${scope.sql}) AS todayRecords,
       (SELECT COUNT(*) FROM attendance a JOIN employees e ON e.id = a.employee_id WHERE a.work_date = CURDATE() AND a.status IN ('Đi trễ','Về sớm','Thiếu giờ','Vắng mặt') AND ${scope.sql}) AS todayIssues,
       (SELECT COALESCE(SUM(pr.net_salary), 0)
          FROM payrolls pr JOIN employees e ON e.id = pr.employee_id
         WHERE pr.period_id = (SELECT id FROM payroll_periods ORDER BY year DESC, month DESC LIMIT 1)
           AND ${scope.sql}) AS payrollTotal`,
    repeat(8)
  );

  const departmentsPromise = db.query(
    `SELECT d.name, COUNT(e.id) AS total
     FROM departments d
     LEFT JOIN employees e ON e.department_id = d.id AND e.status = 'Đang làm việc' AND ${scope.sql}
     GROUP BY d.id, d.name
     HAVING total > 0
     ORDER BY total DESC`,
    p
  );

  const attendancePromise = db.query(
    `SELECT DATE_FORMAT(a.work_date, '%d/%m') AS label,
            SUM(a.status = 'Đúng giờ') AS on_time,
            SUM(a.status = 'Đi trễ') AS late,
            SUM(a.status = 'Về sớm') AS early,
            SUM(a.status = 'Thiếu giờ') AS missing,
            SUM(a.status = 'Vắng mặt') AS absent
     FROM attendance a JOIN employees e ON e.id = a.employee_id
     WHERE ${scope.sql}
     GROUP BY a.work_date
     ORDER BY a.work_date DESC LIMIT 7`,
    p
  );

  const leavesPromise = db.query(
    `SELECT lr.id, e.full_name, e.employee_code, lt.name AS leave_type,
            lr.start_date, lr.end_date, lr.total_days, lr.status, lr.created_at
     FROM leave_requests lr
     JOIN employees e ON e.id = lr.employee_id
     JOIN leave_types lt ON lt.id = lr.leave_type_id
     WHERE ${scope.sql}
     ORDER BY lr.created_at DESC LIMIT 5`,
    p
  );

  const contractsPromise = db.query(
    `SELECT c.id, e.full_name, e.employee_code, c.contract_no, c.end_date,
            c.status, DATEDIFF(c.end_date, CURDATE()) AS days_left
     FROM contracts c JOIN employees e ON e.id = c.employee_id
     WHERE c.end_date IS NOT NULL
       AND c.end_date >= CURDATE()
       AND c.end_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
       AND c.status <> 'Đã hủy' AND ${scope.sql}
     ORDER BY c.end_date ASC LIMIT 5`,
    [env.business.contractAlertDays, ...p]
  );

  const [statsRow, departments, attendance, leaves, contracts] = await Promise.all([
    statsPromise, departmentsPromise, attendancePromise, leavesPromise, contractsPromise,
  ]);

  const stats = {
    activeEmployees: Number(statsRow?.activeEmployees || 0),
    totalEmployees: Number(statsRow?.totalEmployees || 0),
    newEmployees: Number(statsRow?.newEmployees || 0),
    pendingLeaves: Number(statsRow?.pendingLeaves || 0),
    pendingOvertimes: Number(statsRow?.pendingOvertimes || 0),
    todayRecords: Number(statsRow?.todayRecords || 0),
    todayIssues: Number(statsRow?.todayIssues || 0),
    payrollTotal: Number(statsRow?.payrollTotal || 0),
  };
  stats.todayOnTime = Math.max(0, stats.todayRecords - stats.todayIssues);
  stats.todayRate = stats.todayRecords
    ? Math.round((stats.todayOnTime / stats.todayRecords) * 100)
    : 0;

  const trend = [...attendance.rows].reverse().map((row) => ({
    label: row.label,
    on_time: Number(row.on_time || 0),
    late: Number(row.late || 0),
    early: Number(row.early || 0),
    missing: Number(row.missing || 0),
    absent: Number(row.absent || 0),
  }));

  return {
    stats,
    departmentChart: {
      labels: departments.rows.map((row) => row.name),
      values: departments.rows.map((row) => Number(row.total || 0)),
    },
    attendanceChart: trend,
    recentLeaves: leaves.rows.map((row) => ({
      ...row,
      start_date: formatDate(row.start_date),
      end_date: formatDate(row.end_date),
      total_days: Number(row.total_days || 0),
      created_at: formatDateTime(row.created_at),
    })),
    expiringContracts: contracts.rows.map((row) => ({
      ...row,
      end_date: formatDate(row.end_date),
      days_left: Number(row.days_left || 0),
    })),
  };
}

module.exports = { getBadges, getNotifications, getDashboardData };
