'use strict';

/** Truy cập dữ liệu loại phép. */

const db = require('../config/db');
const { getPagination, buildOrderBy } = require('../utils/helpers');

const ORDER_MAP = {
  id: 'id',
  code: 'code',
  name: 'name',
  max_days_per_year: 'max_days_per_year',
};

function buildFilters(filters = {}) {
  const clauses = [];
  const params = [];
  const q = String(filters.q || '').trim();
  if (q) {
    clauses.push('(lt.code LIKE ? OR lt.name LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (filters.is_active === '1' || filters.is_active === 1) clauses.push('lt.is_active = 1');
  else if (filters.is_active === '0' || filters.is_active === 0) clauses.push('lt.is_active = 0');
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

async function list(filters = {}, paging = {}) {
  const { page, limit, offset } = getPagination(paging, 20, 100);
  const { where, params } = buildFilters(filters);
  const order = buildOrderBy(paging.sort, ORDER_MAP, 'id ASC');
  const countRow = await db.queryOne(`SELECT COUNT(*) AS total FROM leave_types lt ${where}`, params);
  const { rows } = await db.query(
    `SELECT lt.*,
            (SELECT COUNT(*) FROM leave_requests lr WHERE lr.leave_type_id = lt.id) AS request_count,
            (SELECT COUNT(*) FROM leave_balances lb WHERE lb.leave_type_id = lt.id) AS balance_count
       FROM leave_types lt
       ${where}
       ${order}
       LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const total = Number(countRow?.total || 0);
  return {
    rows: rows.map((row) => ({
      ...row,
      request_count: Number(row.request_count || 0),
      balance_count: Number(row.balance_count || 0),
    })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

function findById(id) {
  return db.queryOne('SELECT * FROM leave_types WHERE id = ?', [id]);
}

function findByCode(code, excludeId = null) {
  if (excludeId) {
    return db.queryOne('SELECT id FROM leave_types WHERE code = ? AND id <> ? LIMIT 1', [code, excludeId]);
  }
  return db.queryOne('SELECT id FROM leave_types WHERE code = ? LIMIT 1', [code]);
}

function selectOptions() {
  return db.query(
    `SELECT id, code, name, is_paid, max_days_per_year, requires_approval, color
       FROM leave_types WHERE is_active = 1 ORDER BY name ASC`
  ).then((result) => result.rows);
}

function countUsage(id) {
  return db.queryOne(
    `SELECT (SELECT COUNT(*) FROM leave_requests lr WHERE lr.leave_type_id = ?) AS requests,
            (SELECT COUNT(*) FROM leave_balances lb WHERE lb.leave_type_id = ?) AS balances`,
    [id, id]
  );
}

async function create(data) {
  const result = await db.insert(
    `INSERT INTO leave_types
       (code, name, is_paid, max_days_per_year, requires_approval, is_active, color)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.code, data.name, data.is_paid ? 1 : 0,
      data.max_days_per_year === null || data.max_days_per_year === '' ? null : Number(data.max_days_per_year),
      data.requires_approval ? 1 : 0, data.is_active ? 1 : 0, data.color || null,
    ]
  );
  return findById(result.insertId);
}

async function update(id, data) {
  await db.update(
    `UPDATE leave_types
        SET code = ?, name = ?, is_paid = ?, max_days_per_year = ?,
            requires_approval = ?, is_active = ?, color = ?
      WHERE id = ?`,
    [
      data.code, data.name, data.is_paid ? 1 : 0,
      data.max_days_per_year === null || data.max_days_per_year === '' ? null : Number(data.max_days_per_year),
      data.requires_approval ? 1 : 0, data.is_active ? 1 : 0, data.color || null, id,
    ]
  );
  return findById(id);
}

async function remove(id) {
  const { affectedRows } = await db.remove('DELETE FROM leave_types WHERE id = ?', [id]);
  return affectedRows > 0;
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
