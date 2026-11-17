'use strict';

/** Đơn nghỉ phép và quỹ phép: mọi thay đổi trạng thái đều cập nhật quỹ trong transaction. */

const db = require('../config/db');
const { assertSufficientBalance, isUnlimitedLeave } = require('../services/leave.service');
const { AppError, getPagination, buildOrderBy } = require('../utils/helpers');

const ORDER_MAP = {
  id: 'lr.id',
  employee: 'e.full_name',
  start_date: 'lr.start_date',
  status: 'lr.status',
  created_at: 'lr.created_at',
};

function buildFilters(filters = {}, scope = { sql: '1 = 1', params: [] }) {
  const clauses = [scope.sql || '1 = 1'];
  const params = [...(scope.params || [])];
  const q = String(filters.q || '').trim();
  if (q) {
    clauses.push('(e.full_name LIKE ? OR e.employee_code LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (filters.employee_id) {
    clauses.push('lr.employee_id = ?');
    params.push(Number(filters.employee_id));
  }
  if (filters.department_id) {
    clauses.push('e.department_id = ?');
    params.push(Number(filters.department_id));
  }
  if (filters.leave_type_id) {
    clauses.push('lr.leave_type_id = ?');
    params.push(Number(filters.leave_type_id));
  }
  if (filters.status) {
    clauses.push('lr.status = ?');
    params.push(filters.status);
  }
  if (filters.from_date) {
    clauses.push('lr.end_date >= ?');
    params.push(filters.from_date);
  }
  if (filters.to_date) {
    clauses.push('lr.start_date <= ?');
    params.push(filters.to_date);
  }
  return { where: `WHERE ${clauses.join(' AND ')}`, params };
}

const SELECT_FIELDS = `
  SELECT lr.id, lr.employee_id, lr.leave_type_id,
         DATE_FORMAT(lr.start_date, '%Y-%m-%d') AS start_date,
         DATE_FORMAT(lr.end_date, '%Y-%m-%d') AS end_date,
         lr.total_days, lr.reason, lr.status, lr.approved_by, lr.approved_at,
         lr.approval_note, lr.created_at,
         e.employee_code, e.full_name, e.department_id, d.name AS department_name,
         lt.code AS leave_type_code, lt.name AS leave_type_name, lt.color AS leave_type_color,
         lt.is_paid, lt.max_days_per_year,
         approver.full_name AS approved_by_name
    FROM leave_requests lr
    INNER JOIN employees e ON e.id = lr.employee_id
    INNER JOIN leave_types lt ON lt.id = lr.leave_type_id
    LEFT JOIN departments d ON d.id = e.department_id
    LEFT JOIN employees approver ON approver.id = lr.approved_by
`;

async function list(filters = {}, paging = {}, scope = { sql: '1 = 1', params: [] }) {
  const { page, limit, offset } = getPagination(paging, 20, 100);
  const { where, params } = buildFilters(filters, scope);
  const order = buildOrderBy(paging.sort, ORDER_MAP, 'lr.created_at DESC, lr.id DESC');
  const countRow = await db.queryOne(
    `SELECT COUNT(*) AS total
       FROM leave_requests lr
       INNER JOIN employees e ON e.id = lr.employee_id
       ${where}`,
    params
  );
  const { rows } = await db.query(`${SELECT_FIELDS} ${where} ${order} LIMIT ? OFFSET ?`, [...params, limit, offset]);
  const total = Number(countRow?.total || 0);
  return { rows, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

async function summary(filters = {}, scope = { sql: '1 = 1', params: [] }) {
  const { where, params } = buildFilters(filters, scope);
  const row = await db.queryOne(
    `SELECT COUNT(*) AS total,
            SUM(lr.status = 'Chờ duyệt') AS pending,
            SUM(lr.status = 'Đã duyệt') AS approved,
            SUM(lr.status = 'Từ chối') AS rejected,
            COALESCE(SUM(CASE WHEN lr.status = 'Đã duyệt' THEN lr.total_days ELSE 0 END), 0) AS approved_days
       FROM leave_requests lr
       INNER JOIN employees e ON e.id = lr.employee_id
       ${where}`,
    params
  );
  return {
    total: Number(row?.total || 0),
    pending: Number(row?.pending || 0),
    approved: Number(row?.approved || 0),
    rejected: Number(row?.rejected || 0),
    approved_days: Number(row?.approved_days || 0),
  };
}

function findById(id) {
  return db.queryOne(`${SELECT_FIELDS} WHERE lr.id = ?`, [id]);
}

async function holidayDates() {
  const { rows } = await db.query(
    'SELECT DATE_FORMAT(holiday_date, \'%Y-%m-%d\') AS holiday_date, is_recurring FROM holidays'
  );
  const result = new Set();
  const currentYear = new Date().getFullYear();
  for (const row of rows) {
    const text = String(row.holiday_date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) continue;
    result.add(text);
    if (Number(row.is_recurring) === 1) {
      for (let year = currentYear; year <= currentYear + 5; year += 1) {
        result.add(`${year}${text.slice(4)}`);
      }
    }
  }
  return [...result];
}

function findBalance(employeeId, leaveTypeId, year) {
  return db.queryOne(
    `SELECT lb.*, lt.max_days_per_year
       FROM leave_balances lb
       INNER JOIN leave_types lt ON lt.id = lb.leave_type_id
      WHERE lb.employee_id = ? AND lb.leave_type_id = ? AND lb.year = ?`,
    [employeeId, leaveTypeId, year]
  );
}

async function balances(filters = {}, scope = { sql: '1 = 1', params: [] }) {
  const year = Number(filters.year) || new Date().getFullYear();
  const { page, limit, offset } = getPagination(filters.paging || {}, 20, 100);
  const clauses = [scope.sql || '1 = 1', 'lt.is_active = 1', 'lt.max_days_per_year IS NOT NULL'];
  const params = [...(scope.params || [])];
  const q = String(filters.q || '').trim();
  if (q) {
    clauses.push('(e.full_name LIKE ? OR e.employee_code LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (filters.employee_id) {
    clauses.push('e.id = ?');
    params.push(Number(filters.employee_id));
  }
  if (filters.department_id) {
    clauses.push('e.department_id = ?');
    params.push(Number(filters.department_id));
  }
  const where = `WHERE ${clauses.join(' AND ')}`;
  const countRow = await db.queryOne(
    `SELECT COUNT(*) AS total
       FROM employees e
       CROSS JOIN leave_types lt
       ${where}`,
    params
  );
  const { rows } = await db.query(
    `SELECT e.id AS employee_id, e.employee_code, e.full_name,
            d.name AS department_name,
            lt.id AS leave_type_id, lt.code AS leave_type_code,
            lt.name AS leave_type_name, lt.color,
            lb.id AS balance_id,
            COALESCE(lb.opening_days, lt.max_days_per_year) AS opening_days,
            COALESCE(lb.accrued_days, 0) AS accrued_days,
            COALESCE(lb.used_days, 0) AS used_days,
            COALESCE(lb.remaining_days,
              COALESCE(lb.opening_days, lt.max_days_per_year) - COALESCE(lb.used_days, 0)) AS remaining_days
       FROM employees e
       CROSS JOIN leave_types lt
       LEFT JOIN departments d ON d.id = e.department_id
       LEFT JOIN leave_balances lb
         ON lb.employee_id = e.id AND lb.leave_type_id = lt.id AND lb.year = ?
       ${where}
       ORDER BY e.full_name ASC, lt.name ASC
       LIMIT ? OFFSET ?`,
    [year, ...params, limit, offset]
  );
  const total = Number(countRow?.total || 0);
  return { rows, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)), year };
}

async function create(data) {
  const result = await db.insert(
    `INSERT INTO leave_requests
       (employee_id, leave_type_id, start_date, end_date, total_days, reason, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.employee_id, data.leave_type_id, data.start_date, data.end_date,
      data.total_days, data.reason || null, data.status || 'Chờ duyệt',
    ]
  );
  return findById(result.insertId);
}

async function update(id, data) {
  await db.update(
    `UPDATE leave_requests
        SET employee_id = ?, leave_type_id = ?, start_date = ?, end_date = ?,
            total_days = ?, reason = ?
      WHERE id = ?`,
    [
      data.employee_id, data.leave_type_id, data.start_date, data.end_date,
      data.total_days, data.reason || null, id,
    ]
  );
  return findById(id);
}

/** mysql2 trả DATE về object Date; ưu tiên chuỗi YYYY-MM-DD do SQL DATE_FORMAT. */
function requestYear(request) {
  const value = request.start_date_text || request.start_date;
  const match = /^(\d{4})/.exec(String(value === null || value === undefined ? '' : value));
  if (match) return Number(match[1]);
  if (value instanceof Date) return value.getFullYear();
  throw new AppError('Ngày bắt đầu của đơn không hợp lệ.', 400);
}

/** Đọc đơn kèm ngày đã format; dùng trong transaction để cập nhật quỹ. */
const REQUEST_ROW = `SELECT lr.*,
       DATE_FORMAT(lr.start_date, '%Y-%m-%d') AS start_date_text,
       DATE_FORMAT(lr.end_date, '%Y-%m-%d') AS end_date_text
  FROM leave_requests lr
 WHERE lr.id = ?`;

/** Cộng/trừ quỹ phép. sign = +1 khi duyệt, -1 khi bỏ duyệt/từ chối/xóa. */
async function applyBalance(tx, request, sign) {
  const type = await tx.queryOne(
    'SELECT id, name, max_days_per_year FROM leave_types WHERE id = ?',
    [request.leave_type_id]
  );
  if (!type) throw new AppError('Loại phép không hợp lệ.', 400);
  if (isUnlimitedLeave(type)) return;

  const year = requestYear(request);
  let balance = await tx.queryOne(
    'SELECT * FROM leave_balances WHERE employee_id = ? AND leave_type_id = ? AND year = ?',
    [request.employee_id, request.leave_type_id, year]
  );
  if (!balance) {
    if (sign < 0) return;
    await tx.insert(
      `INSERT INTO leave_balances (employee_id, leave_type_id, year, opening_days, accrued_days, used_days)
       VALUES (?, ?, ?, ?, 0, 0)`,
      [request.employee_id, request.leave_type_id, year, Number(type.max_days_per_year)]
    );
    balance = await tx.queryOne(
      'SELECT * FROM leave_balances WHERE employee_id = ? AND leave_type_id = ? AND year = ?',
      [request.employee_id, request.leave_type_id, year]
    );
  }

  const remaining = Number(balance.opening_days || 0) + Number(balance.accrued_days || 0) - Number(balance.used_days || 0);
  if (sign > 0) assertSufficientBalance({ remaining_days: remaining }, request.total_days, type);
  const used = Math.max(0, Number(balance.used_days || 0) + sign * Number(request.total_days || 0));
  await tx.update('UPDATE leave_balances SET used_days = ? WHERE id = ?', [used, balance.id]);
}

async function setStatus(id, status, approverId = null, approvalNote = null) {
  return db.transaction(async (tx) => {
    const before = await tx.queryOne(REQUEST_ROW, [id]);
    if (!before) throw new AppError('Không tìm thấy đơn nghỉ phép.', 404);
    if (before.status === status) return { before, after: before };
    if (status === 'Đã duyệt') await applyBalance(tx, before, 1);
    else if (before.status === 'Đã duyệt') await applyBalance(tx, before, -1);

    await tx.update(
      `UPDATE leave_requests
          SET status = ?, approved_by = ?, approved_at = ?, approval_note = ?
        WHERE id = ?`,
      [
        status,
        status === 'Chờ duyệt' ? null : approverId,
        status === 'Chờ duyệt' ? null : new Date(),
        status === 'Chờ duyệt' ? null : approvalNote,
        id,
      ]
    );
    const after = await tx.queryOne(REQUEST_ROW, [id]);
    return { before, after };
  });
}

async function remove(id) {
  return db.transaction(async (tx) => {
    const before = await tx.queryOne(REQUEST_ROW, [id]);
    if (!before) throw new AppError('Không tìm thấy đơn nghỉ phép.', 404);
    if (before.status === 'Đã duyệt') await applyBalance(tx, before, -1);
    const [result] = await tx.execute('DELETE FROM leave_requests WHERE id = ?', [id]);
    return { before, removed: result.affectedRows > 0 };
  });
}

module.exports = {
  list,
  summary,
  findById,
  holidayDates,
  findBalance,
  balances,
  create,
  update,
  setStatus,
  remove,
};
