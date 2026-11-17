'use strict';

/** Truy cập dữ liệu chức vụ. */

const db = require('../config/db');
const { AppError, getPagination, buildOrderBy } = require('../utils/helpers');

const ORDER_MAP = { id: 'id', code: 'code', name: 'name', created_at: 'created_at' };

function buildFilters(filters = {}) {
  const clauses = [];
  const params = [];
  const q = String(filters.q || '').trim();
  if (q) {
    clauses.push('(p.code LIKE ? OR p.name LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (filters.department_id) {
    clauses.push('p.department_id = ?');
    params.push(filters.department_id);
  }
  if (filters.is_active === '1' || filters.is_active === 1) clauses.push('p.is_active = 1');
  else if (filters.is_active === '0' || filters.is_active === 0) clauses.push('p.is_active = 0');
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

async function list(filters = {}, paging = {}) {
  const { page, limit, offset } = getPagination(paging, 20, 100);
  const { where, params } = buildFilters(filters);
  const order = buildOrderBy(paging.sort, ORDER_MAP, 'id ASC');

  const countRow = await db.queryOne(`SELECT COUNT(*) AS total FROM positions p ${where}`, params);
  const { rows } = await db.query(
    `SELECT p.id, p.code, p.name, p.department_id, p.is_active, p.created_at,
            d.name AS department_name,
            (SELECT COUNT(*) FROM employees e WHERE e.position_id = p.id) AS employee_count
       FROM positions p
       LEFT JOIN departments d ON d.id = p.department_id
       ${where}
       ${order}
       LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const total = Number(countRow?.total || 0);
  return {
    rows: rows.map((row) => ({ ...row, employee_count: Number(row.employee_count || 0) })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

function findById(id) {
  return db.queryOne(
    `SELECT p.*, d.name AS department_name
       FROM positions p
       LEFT JOIN departments d ON d.id = p.department_id
      WHERE p.id = ?`,
    [id]
  );
}

function findByCode(code, excludeId = null) {
  if (excludeId) {
    return db.queryOne('SELECT id FROM positions WHERE code = ? AND id <> ? LIMIT 1', [code, excludeId]);
  }
  return db.queryOne('SELECT id FROM positions WHERE code = ? LIMIT 1', [code]);
}

async function selectOptions(departmentId = null) {
  if (departmentId) {
    const { rows } = await db.query(
      `SELECT id, code, name, department_id FROM positions
        WHERE is_active = 1 AND (department_id = ? OR department_id IS NULL)
        ORDER BY name ASC`,
      [departmentId]
    );
    return rows;
  }
  const { rows } = await db.query(
    'SELECT id, code, name, department_id FROM positions WHERE is_active = 1 ORDER BY name ASC'
  );
  return rows;
}

async function countUsage(id) {
  const row = await db.queryOne(
    'SELECT COUNT(*) AS total FROM employees WHERE position_id = ?',
    [id]
  );
  return Number(row?.total || 0);
}

async function create(data) {
  const result = await db.insert(
    `INSERT INTO positions (code, name, department_id, is_active)
     VALUES (?, ?, ?, ?)`,
    [data.code, data.name, data.department_id || null, data.is_active ? 1 : 0]
  );
  return findById(result.insertId);
}

async function update(id, data) {
  const result = await db.update(
    `UPDATE positions
        SET code = ?, name = ?, department_id = ?, is_active = ?
      WHERE id = ?`,
    [data.code, data.name, data.department_id || null, data.is_active ? 1 : 0, id]
  );
  if (result.affectedRows === 0) throw new AppError('Không tìm thấy chức vụ để cập nhật.', 404);
  return findById(id);
}

async function remove(id) {
  const total = await countUsage(id);
  if (total > 0) {
    throw new AppError('Không thể xóa chức vụ đang có nhân viên. Vui lòng chuyển nhân viên sang chức vụ khác trước.', 409);
  }
  const result = await db.remove('DELETE FROM positions WHERE id = ?', [id]);
  if (result.affectedRows === 0) throw new AppError('Không tìm thấy chức vụ để xóa.', 404);
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
