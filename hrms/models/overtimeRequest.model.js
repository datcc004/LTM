'use strict';

/** Đơn tăng ca: danh sách, tổng hợp và duyệt theo scope phòng ban. */

const db = require('../config/db');
const { AppError, getPagination, buildOrderBy } = require('../utils/helpers');

const ORDER_MAP = {
  id: 'ot.id',
  employee: 'e.full_name',
  work_date: 'ot.work_date',
  total_hours: 'ot.total_hours',
  status: 'ot.status',
  created_at: 'ot.created_at',
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
    clauses.push('ot.employee_id = ?');
    params.push(Number(filters.employee_id));
  }
  if (filters.department_id) {
    clauses.push('e.department_id = ?');
    params.push(Number(filters.department_id));
  }
  if (filters.day_type) {
    clauses.push('ot.day_type = ?');
    params.push(filters.day_type);
  }
  if (filters.status) {
    clauses.push('ot.status = ?');
    params.push(filters.status);
  }
  if (filters.from_date) {
    clauses.push('ot.work_date >= ?');
    params.push(filters.from_date);
  }
  if (filters.to_date) {
    clauses.push('ot.work_date <= ?');
    params.push(filters.to_date);
  }
  return { where: `WHERE ${clauses.join(' AND ')}`, params };
}

const SELECT_FIELDS = `
  SELECT ot.id, ot.employee_id, DATE_FORMAT(ot.work_date, '%Y-%m-%d') AS work_date,
         TIME_FORMAT(ot.start_time, '%H:%i') AS start_time,
         TIME_FORMAT(ot.end_time, '%H:%i') AS end_time,
         ot.total_hours, ot.day_type, ot.rate_multiplier, ot.reason, ot.status,
         ot.approved_by, ot.approved_at, ot.approval_note, ot.created_at,
         e.employee_code, e.full_name, e.department_id, d.name AS department_name,
         approver.full_name AS approved_by_name
    FROM overtime_requests ot
    INNER JOIN employees e ON e.id = ot.employee_id
    LEFT JOIN departments d ON d.id = e.department_id
    LEFT JOIN employees approver ON approver.id = ot.approved_by
`;

async function list(filters = {}, paging = {}, scope = { sql: '1 = 1', params: [] }) {
  const { page, limit, offset } = getPagination(paging, 20, 100);
  const { where, params } = buildFilters(filters, scope);
  const order = buildOrderBy(paging.sort, ORDER_MAP, 'ot.created_at DESC, ot.id DESC');
  const countRow = await db.queryOne(
    `SELECT COUNT(*) AS total
       FROM overtime_requests ot
       INNER JOIN employees e ON e.id = ot.employee_id
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
            SUM(ot.status = 'Chờ duyệt') AS pending,
            SUM(ot.status = 'Đã duyệt') AS approved,
            SUM(ot.status = 'Từ chối') AS rejected,
            COALESCE(SUM(CASE WHEN ot.status = 'Đã duyệt' THEN ot.total_hours ELSE 0 END), 0) AS approved_hours
       FROM overtime_requests ot
       INNER JOIN employees e ON e.id = ot.employee_id
       ${where}`,
    params
  );
  return {
    total: Number(row?.total || 0),
    pending: Number(row?.pending || 0),
    approved: Number(row?.approved || 0),
    rejected: Number(row?.rejected || 0),
    approved_hours: Number(row?.approved_hours || 0),
  };
}

function findById(id) {
  return db.queryOne(`${SELECT_FIELDS} WHERE ot.id = ?`, [id]);
}

async function create(data) {
  const result = await db.insert(
    `INSERT INTO overtime_requests
       (employee_id, work_date, start_time, end_time, total_hours, day_type,
        rate_multiplier, reason, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.employee_id, data.work_date, data.start_time, data.end_time,
      data.total_hours, data.day_type, data.rate_multiplier, data.reason || null,
      data.status || 'Chờ duyệt',
    ]
  );
  return findById(result.insertId);
}

async function update(id, data) {
  await db.update(
    `UPDATE overtime_requests
        SET employee_id = ?, work_date = ?, start_time = ?, end_time = ?,
            total_hours = ?, day_type = ?, rate_multiplier = ?, reason = ?
      WHERE id = ?`,
    [
      data.employee_id, data.work_date, data.start_time, data.end_time,
      data.total_hours, data.day_type, data.rate_multiplier, data.reason || null, id,
    ]
  );
  return findById(id);
}

async function setStatus(id, status, approverId = null, approvalNote = null) {
  const before = await findById(id);
  if (!before) throw new AppError('Không tìm thấy đơn tăng ca.', 404);
  await db.update(
    `UPDATE overtime_requests
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
  return { before, after: await findById(id) };
}

async function remove(id) {
  const before = await findById(id);
  if (!before) throw new AppError('Không tìm thấy đơn tăng ca.', 404);
  const result = await db.remove('DELETE FROM overtime_requests WHERE id = ?', [id]);
  return { before, removed: result.affectedRows > 0 };
}

module.exports = {
  list,
  summary,
  findById,
  create,
  update,
  setStatus,
  remove,
};
