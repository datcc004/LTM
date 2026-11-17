'use strict';

/** Phân ca làm việc: lịch ca của từng nhân viên theo ngày. */

const db = require('../config/db');
const { AppError, getPagination, buildOrderBy } = require('../utils/helpers');

const ORDER_MAP = {
  id: 'ss.id',
  work_date: 'ss.work_date',
  employee: 'e.full_name',
  shift: 's.start_time',
  created_at: 'ss.created_at',
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
    clauses.push('ss.employee_id = ?');
    params.push(Number(filters.employee_id));
  }
  if (filters.shift_id) {
    clauses.push('ss.shift_id = ?');
    params.push(Number(filters.shift_id));
  }
  if (filters.from_date) {
    clauses.push('ss.work_date >= ?');
    params.push(filters.from_date);
  }
  if (filters.to_date) {
    clauses.push('ss.work_date <= ?');
    params.push(filters.to_date);
  }
  return { where: `WHERE ${clauses.join(' AND ')}`, params };
}

const SELECT_FIELDS = `
  SELECT ss.id, ss.employee_id, ss.shift_id,
         DATE_FORMAT(ss.work_date, '%Y-%m-%d') AS work_date,
         ss.note, ss.created_at,
         e.employee_code, e.full_name, e.department_id,
         s.code AS shift_code, s.name AS shift_name,
         s.start_time, s.end_time, s.color AS shift_color,
         d.name AS department_name
    FROM shift_schedules ss
    INNER JOIN employees e ON e.id = ss.employee_id
    INNER JOIN shifts s ON s.id = ss.shift_id
    LEFT JOIN departments d ON d.id = e.department_id
`;

async function list(filters = {}, paging = {}, scope = { sql: '1 = 1', params: [] }) {
  const { page, limit, offset } = getPagination(paging, 20, 100);
  const { where, params } = buildFilters(filters, scope);
  const order = buildOrderBy(paging.sort, ORDER_MAP, 'ss.work_date DESC, ss.id DESC');
  const countRow = await db.queryOne(
    `SELECT COUNT(*) AS total
       FROM shift_schedules ss
       INNER JOIN employees e ON e.id = ss.employee_id
       INNER JOIN shifts s ON s.id = ss.shift_id
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

function findById(id) {
  return db.queryOne(`${SELECT_FIELDS} WHERE ss.id = ?`, [id]);
}

function findByEmployeeDate(employeeId, workDate, excludeId = null) {
  if (excludeId) {
    return db.queryOne(
      'SELECT id FROM shift_schedules WHERE employee_id = ? AND work_date = ? AND id <> ? LIMIT 1',
      [employeeId, workDate, excludeId]
    );
  }
  return db.queryOne(
    'SELECT id FROM shift_schedules WHERE employee_id = ? AND work_date = ? LIMIT 1',
    [employeeId, workDate]
  );
}

function syncAttendance(tx, schedule) {
  return tx.execute(
    `INSERT INTO attendance
       (employee_id, schedule_id, shift_id, work_date, status, source)
     VALUES (?, ?, ?, ?, 'Vắng mặt', 'Camera')
     ON DUPLICATE KEY UPDATE schedule_id = VALUES(schedule_id), shift_id = VALUES(shift_id)`,
    [schedule.employee_id, schedule.id, schedule.shift_id, schedule.work_date]
  );
}

async function create(data) {
  const id = await db.transaction(async (tx) => {
    const result = await tx.insert(
      `INSERT INTO shift_schedules (employee_id, shift_id, work_date, note)
       VALUES (?, ?, ?, ?)`,
      [data.employee_id, data.shift_id, data.work_date, data.note || null]
    );
    await syncAttendance(tx, { ...data, id: result.insertId });
    return result.insertId;
  });
  return findById(id);
}

async function update(id, data) {
  return db.transaction(async (tx) => {
    const before = await tx.queryOne(
      `SELECT id, employee_id, shift_id,
              DATE_FORMAT(work_date, '%Y-%m-%d') AS work_date
         FROM shift_schedules WHERE id = ?`,
      [id]
    );
    if (!before) throw new AppError('Không tìm thấy lịch phân ca để cập nhật.', 404);
    const result = await tx.update(
      `UPDATE shift_schedules
          SET employee_id = ?, shift_id = ?, work_date = ?, note = ?
        WHERE id = ?`,
      [data.employee_id, data.shift_id, data.work_date, data.note || null, id]
    );
    if (result.affectedRows === 0) throw new AppError('Không tìm thấy lịch phân ca để cập nhật.', 404);

    const beforeDate = String(before.work_date).slice(0, 10);
    if (Number(before.employee_id) !== Number(data.employee_id) || beforeDate !== data.work_date) {
      await tx.execute(
        `DELETE FROM attendance
          WHERE employee_id = ? AND work_date = ? AND schedule_id = ?
            AND check_in IS NULL AND check_out IS NULL`,
        [before.employee_id, beforeDate, id]
      );
    }
    await syncAttendance(tx, { ...data, id });
  });
  return findById(id);
}

async function remove(id) {
  return db.transaction(async (tx) => {
    const before = await tx.queryOne('SELECT * FROM shift_schedules WHERE id = ?', [id]);
    if (!before) throw new AppError('Không tìm thấy lịch phân ca để xóa.', 404);
    await tx.execute(
      `DELETE FROM attendance
        WHERE schedule_id = ? AND check_in IS NULL AND check_out IS NULL`,
      [id]
    );
    const [result] = await tx.execute('DELETE FROM shift_schedules WHERE id = ?', [id]);
    if (result.affectedRows === 0) throw new AppError('Không tìm thấy lịch phân ca để xóa.', 404);
    return true;
  });
}

module.exports = {
  list,
  findById,
  findByEmployeeDate,
  create,
  update,
  remove,
};
