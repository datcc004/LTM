'use strict';

/** Danh mục ngày lễ. */

const db = require('../config/db');
const { getPagination } = require('../utils/helpers');

const ORDER_MAP = {
  id: 'id', name: 'name', holiday_date: 'holiday_date', created_at: 'created_at',
};

async function list(filters = {}, paging = {}) {
  const { page, limit, offset } = getPagination(paging, 20, 100);
  const clauses = [];
  const params = [];
  const q = String(filters.q || '').trim();
  if (q) {
    clauses.push('(name LIKE ? OR note LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (filters.year) {
    clauses.push('YEAR(holiday_date) = ?');
    params.push(Number(filters.year));
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const sort = String(paging.sort || 'holiday_date:desc');
  const [field, dirRaw] = sort.split(':');
  const safeField = Object.prototype.hasOwnProperty.call(ORDER_MAP, field) ? ORDER_MAP[field] : 'holiday_date';
  const dir = String(dirRaw || '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const counted = await db.queryOne(`SELECT COUNT(*) AS total FROM holidays ${where}`, params);
  const { rows } = await db.query(
    `SELECT * FROM holidays ${where} ORDER BY \`${safeField}\` ${dir}, id ASC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const total = Number(counted.total) || 0;
  return { rows, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

async function findById(id) {
  return db.queryOne('SELECT * FROM holidays WHERE id = ?', [id]);
}

async function existsOnDate(holidayDate, excludeId = 0) {
  return db.queryOne(
    'SELECT id FROM holidays WHERE holiday_date = ? AND id <> ? LIMIT 1',
    [holidayDate, excludeId]
  );
}

async function create(data) {
  const result = await db.insert(
    `INSERT INTO holidays (name, holiday_date, is_recurring, note)
     VALUES (?, ?, ?, ?)`,
    [data.name, data.holiday_date, data.is_recurring, data.note]
  );
  return findById(result.insertId);
}

async function update(id, data) {
  await db.update(
    `UPDATE holidays
        SET name = ?, holiday_date = ?, is_recurring = ?, note = ?
      WHERE id = ?`,
    [data.name, data.holiday_date, data.is_recurring, data.note, id]
  );
  return findById(id);
}

async function remove(id) {
  return db.remove('DELETE FROM holidays WHERE id = ?', [id]);
}

module.exports = { list, findById, existsOnDate, create, update, remove };
