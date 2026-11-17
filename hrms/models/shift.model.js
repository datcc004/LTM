'use strict';

/** Truy cập dữ liệu ca làm việc. */

const db = require('../config/db');
const { AppError, getPagination, buildOrderBy } = require('../utils/helpers');

const ORDER_MAP = {
  id: 'id', code: 'code', name: 'name', start_time: 'start_time', created_at: 'created_at',
};

function buildFilters(filters = {}) {
  const clauses = [];
  const params = [];
  const q = String(filters.q || '').trim();
  if (q) {
    clauses.push('(s.code LIKE ? OR s.name LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (filters.is_active === '1' || filters.is_active === 1) clauses.push('s.is_active = 1');
  else if (filters.is_active === '0' || filters.is_active === 0) clauses.push('s.is_active = 0');
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

async function list(filters = {}, paging = {}) {
  const { page, limit, offset } = getPagination(paging, 20, 100);
  const { where, params } = buildFilters(filters);
  const order = buildOrderBy(paging.sort, ORDER_MAP, 'id ASC');
  const countRow = await db.queryOne(`SELECT COUNT(*) AS total FROM shifts s ${where}`, params);
  const { rows } = await db.query(
    `SELECT s.*,
            (SELECT COUNT(*) FROM shift_schedules ss WHERE ss.shift_id = s.id) AS schedule_count
       FROM shifts s
       ${where}
       ${order}
       LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const total = Number(countRow?.total || 0);
  return {
    rows: rows.map((row) => ({ ...row, schedule_count: Number(row.schedule_count || 0) })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

function findById(id) {
  return db.queryOne('SELECT * FROM shifts WHERE id = ?', [id]);
}

function findByCode(code, excludeId = null) {
  if (excludeId) {
    return db.queryOne('SELECT id FROM shifts WHERE code = ? AND id <> ? LIMIT 1', [code, excludeId]);
  }
  return db.queryOne('SELECT id FROM shifts WHERE code = ? LIMIT 1', [code]);
}

function selectOptions() {
  return db.query(
    'SELECT id, code, name, start_time, end_time FROM shifts WHERE is_active = 1 ORDER BY start_time ASC, name ASC'
  ).then((result) => result.rows);
}

function countUsage(id) {
  return db.queryOne(
    `SELECT (SELECT COUNT(*) FROM shift_schedules ss WHERE ss.shift_id = ?) AS schedules,
            (SELECT COUNT(*) FROM attendance a WHERE a.shift_id = ?) AS attendance`,
    [id, id]
  ).then((row) => ({
    schedules: Number(row?.schedules || 0),
    attendance: Number(row?.attendance || 0),
  }));
}

async function create(data) {
  const result = await db.insert(
    `INSERT INTO shifts
       (code, name, start_time, end_time, break_minutes, work_hours,
        late_tolerance_minutes, early_tolerance_minutes, is_overnight, color, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.code, data.name, data.start_time, data.end_time,
      data.break_minutes, data.work_hours, data.late_tolerance_minutes,
      data.early_tolerance_minutes, data.is_overnight ? 1 : 0,
      data.color || null, data.is_active ? 1 : 0,
    ]
  );
  return findById(result.insertId);
}

async function update(id, data) {
  const result = await db.update(
    `UPDATE shifts
        SET code = ?, name = ?, start_time = ?, end_time = ?, break_minutes = ?, work_hours = ?,
            late_tolerance_minutes = ?, early_tolerance_minutes = ?, is_overnight = ?, color = ?, is_active = ?
      WHERE id = ?`,
    [
      data.code, data.name, data.start_time, data.end_time,
      data.break_minutes, data.work_hours, data.late_tolerance_minutes,
      data.early_tolerance_minutes, data.is_overnight ? 1 : 0,
      data.color || null, data.is_active ? 1 : 0, id,
    ]
  );
  if (result.affectedRows === 0) throw new AppError('Không tìm thấy ca làm việc để cập nhật.', 404);
  return findById(id);
}

async function remove(id) {
  const usage = await countUsage(id);
  if (usage.schedules || usage.attendance) {
    throw new AppError(
      'Không thể xóa ca làm việc đang có lịch phân ca hoặc bản ghi chấm công. Vui lòng chuyển sang ca khác trước.',
      409
    );
  }
  const result = await db.remove('DELETE FROM shifts WHERE id = ?', [id]);
  if (result.affectedRows === 0) throw new AppError('Không tìm thấy ca làm việc để xóa.', 404);
  return true;
}

module.exports = {
  list,
  findById,
  findByCode,
  selectOptions,
  countUsage,
  create,
  update,
  remove,
};
