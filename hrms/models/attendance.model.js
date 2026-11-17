'use strict';

/** Bảng công: lưu bản ghi chấm công và các chỉ số tính được. */

const db = require('../config/db');
const { AppError, getPagination, buildOrderBy } = require('../utils/helpers');

const ORDER_MAP = {
  id: 'a.id',
  work_date: 'a.work_date',
  employee: 'e.full_name',
  status: 'a.status',
  check_in: 'a.check_in',
  created_at: 'a.created_at',
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
    clauses.push('a.employee_id = ?');
    params.push(Number(filters.employee_id));
  }
  if (filters.department_id) {
    clauses.push('e.department_id = ?');
    params.push(Number(filters.department_id));
  }
  if (filters.shift_id) {
    clauses.push('a.shift_id = ?');
    params.push(Number(filters.shift_id));
  }
  if (filters.status) {
    clauses.push('a.status = ?');
    params.push(filters.status);
  }
  if (filters.from_date) {
    clauses.push('a.work_date >= ?');
    params.push(filters.from_date);
  }
  if (filters.to_date) {
    clauses.push('a.work_date <= ?');
    params.push(filters.to_date);
  }
  if (filters.is_approved === '1' || filters.is_approved === 1) clauses.push('a.is_approved = 1');
  else if (filters.is_approved === '0' || filters.is_approved === 0) clauses.push('a.is_approved = 0');
  return { where: `WHERE ${clauses.join(' AND ')}`, params };
}

const SELECT_FIELDS = `
  SELECT a.id, a.employee_id, a.schedule_id, a.shift_id,
         DATE_FORMAT(a.work_date, '%Y-%m-%d') AS work_date,
         DATE_FORMAT(a.check_in, '%Y-%m-%d %H:%i:%s') AS check_in,
         DATE_FORMAT(a.check_out, '%Y-%m-%d %H:%i:%s') AS check_out,
         a.status, a.late_minutes, a.early_minutes, a.worked_minutes, a.overtime_minutes,
         a.source, a.is_approved, a.approved_by, a.note,
         e.employee_code, e.full_name, e.department_id, d.name AS department_name,
         s.code AS shift_code, s.name AS shift_name,
         approver.full_name AS approved_by_name
    FROM attendance a
    INNER JOIN employees e ON e.id = a.employee_id
    LEFT JOIN departments d ON d.id = e.department_id
    LEFT JOIN shifts s ON s.id = a.shift_id
    LEFT JOIN employees approver ON approver.id = a.approved_by
`;

async function list(filters = {}, paging = {}, scope = { sql: '1 = 1', params: [] }) {
  const { page, limit, offset } = getPagination(paging, 20, 100);
  const { where, params } = buildFilters(filters, scope);
  const order = buildOrderBy(paging.sort, ORDER_MAP, 'a.work_date DESC, a.id DESC');
  const countRow = await db.queryOne(
    `SELECT COUNT(*) AS total
       FROM attendance a
       INNER JOIN employees e ON e.id = a.employee_id
       ${where}`,
    params
  );
  const { rows } = await db.query(
    `${SELECT_FIELDS}
      ${where}
      ${order}
      LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const total = Number(countRow?.total || 0);
  return { rows, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

async function summary(filters = {}, scope = { sql: '1 = 1', params: [] }) {
  const { where, params } = buildFilters(filters, scope);
  const row = await db.queryOne(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN a.status = 'Đúng giờ' THEN 1 ELSE 0 END) AS on_time,
            SUM(CASE WHEN a.status = 'Đi trễ' THEN 1 ELSE 0 END) AS late,
            SUM(CASE WHEN a.status = 'Về sớm' THEN 1 ELSE 0 END) AS early,
            SUM(CASE WHEN a.status = 'Thiếu giờ' THEN 1 ELSE 0 END) AS insufficient,
            SUM(CASE WHEN a.status = 'Vắng mặt' THEN 1 ELSE 0 END) AS absent,
            SUM(CASE WHEN a.is_approved = 1 THEN 1 ELSE 0 END) AS approved,
            COALESCE(SUM(a.overtime_minutes), 0) AS overtime_minutes,
            COALESCE(SUM(a.worked_minutes), 0) AS worked_minutes
       FROM attendance a
       INNER JOIN employees e ON e.id = a.employee_id
       ${where}`,
    params
  );
  return {
    total: Number(row?.total || 0),
    on_time: Number(row?.on_time || 0),
    late: Number(row?.late || 0),
    early: Number(row?.early || 0),
    insufficient: Number(row?.insufficient || 0),
    absent: Number(row?.absent || 0),
    approved: Number(row?.approved || 0),
    overtime_minutes: Number(row?.overtime_minutes || 0),
    worked_minutes: Number(row?.worked_minutes || 0),
  };
}

function findById(id) {
  return db.queryOne(`${SELECT_FIELDS} WHERE a.id = ?`, [id]);
}

function findByEmployeeDate(employeeId, workDate, excludeId = null) {
  if (excludeId) {
    return db.queryOne(
      'SELECT id FROM attendance WHERE employee_id = ? AND work_date = ? AND id <> ? LIMIT 1',
      [employeeId, workDate, excludeId]
    );
  }
  return db.queryOne(
    'SELECT id FROM attendance WHERE employee_id = ? AND work_date = ? LIMIT 1',
    [employeeId, workDate]
  );
}

const SAVE_COLUMNS = `employee_id = ?, schedule_id = ?, shift_id = ?, work_date = ?,
  check_in = ?, check_out = ?, status = ?, late_minutes = ?, early_minutes = ?,
  worked_minutes = ?, overtime_minutes = ?, source = ?, note = ?`;

function saveValues(data) {
  return [
    data.employee_id,
    data.schedule_id || null,
    data.shift_id || null,
    data.work_date,
    data.check_in || null,
    data.check_out || null,
    data.status,
    data.late_minutes || 0,
    data.early_minutes || 0,
    data.worked_minutes || 0,
    data.overtime_minutes || 0,
    data.source || 'Thủ công',
    data.note || null,
  ];
}

async function save(data, id = null) {
  const values = saveValues(data);
  if (id) {
    const result = await db.update(`UPDATE attendance SET ${SAVE_COLUMNS} WHERE id = ?`, [...values, id]);
    if (result.affectedRows === 0) throw new AppError('Không tìm thấy bản ghi chấm công để cập nhật.', 404);
    return findById(id);
  }

  await db.insert(
    `INSERT INTO attendance
       (employee_id, schedule_id, shift_id, work_date, check_in, check_out, status,
        late_minutes, early_minutes, worked_minutes, overtime_minutes, source, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE ${SAVE_COLUMNS}`,
    [...values, ...values]
  );
  const row = await findByEmployeeDate(data.employee_id, data.work_date);
  return findById(row.id);
}

async function setApproved(id, approved, approvedBy) {
  const result = await db.update(
    'UPDATE attendance SET is_approved = ?, approved_by = ? WHERE id = ?',
    [approved ? 1 : 0, approved ? approvedBy : null, id]
  );
  if (result.affectedRows === 0) throw new AppError('Không tìm thấy bản ghi chấm công để duyệt.', 404);
  return findById(id);
}

async function remove(id) {
  const result = await db.remove('DELETE FROM attendance WHERE id = ?', [id]);
  if (result.affectedRows === 0) throw new AppError('Không tìm thấy bản ghi chấm công để xóa.', 404);
  return true;
}

module.exports = {
  list,
  summary,
  findById,
  findByEmployeeDate,
  save,
  setApproved,
  remove,
};
