'use strict';

/** Truy cập dữ liệu phòng ban. Mọi giá trị người dùng đều đi qua prepared statement. */

const db = require('../config/db');
const { AppError, getPagination, buildOrderBy } = require('../utils/helpers');

const ORDER_MAP = { id: 'id', code: 'code', name: 'name', created_at: 'created_at' };

function buildFilters(filters = {}) {
  const clauses = [];
  const params = [];
  const q = String(filters.q || '').trim();
  if (q) {
    clauses.push('(d.code LIKE ? OR d.name LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (filters.is_active === '1' || filters.is_active === 1) clauses.push('d.is_active = 1');
  else if (filters.is_active === '0' || filters.is_active === 0) clauses.push('d.is_active = 0');
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

async function list(filters = {}, paging = {}) {
  const { page, limit, offset } = getPagination(paging, 20, 100);
  const { where, params } = buildFilters(filters);
  const order = buildOrderBy(paging.sort, ORDER_MAP, 'id ASC');

  const countRow = await db.queryOne(`SELECT COUNT(*) AS total FROM departments d ${where}`, params);
  const { rows } = await db.query(
    `SELECT d.id, d.code, d.name, d.parent_id, d.manager_id, d.is_active, d.created_at,
            p.name AS parent_name, m.full_name AS manager_name,
            (SELECT COUNT(*) FROM employees e WHERE e.department_id = d.id) AS employee_count
       FROM departments d
       LEFT JOIN departments p ON p.id = d.parent_id
       LEFT JOIN employees m ON m.id = d.manager_id
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
    `SELECT d.*, p.name AS parent_name, m.full_name AS manager_name
       FROM departments d
       LEFT JOIN departments p ON p.id = d.parent_id
       LEFT JOIN employees m ON m.id = d.manager_id
      WHERE d.id = ?`,
    [id]
  );
}

function findByCode(code, excludeId = null) {
  if (excludeId) {
    return db.queryOne('SELECT id FROM departments WHERE code = ? AND id <> ? LIMIT 1', [code, excludeId]);
  }
  return db.queryOne('SELECT id FROM departments WHERE code = ? LIMIT 1', [code]);
}

/** Dùng cho <select>: chỉ lấy phòng đang hoạt động, tránh chọn phòng đã ngừng. */
async function selectOptions(excludeId = null) {
  const sql = excludeId
    ? 'SELECT id, code, name FROM departments WHERE is_active = 1 AND id <> ? ORDER BY name ASC'
    : 'SELECT id, code, name FROM departments WHERE is_active = 1 ORDER BY name ASC';
  const { rows } = await db.query(sql, excludeId ? [excludeId] : []);
  return rows;
}

async function countUsage(id) {
  const row = await db.queryOne(
    `SELECT (SELECT COUNT(*) FROM employees e WHERE e.department_id = ?) AS employees,
            (SELECT COUNT(*) FROM positions p WHERE p.department_id = ?) AS positions,
            (SELECT COUNT(*) FROM departments d WHERE d.parent_id = ?) AS children`,
    [id, id, id]
  );
  return {
    employees: Number(row?.employees || 0),
    positions: Number(row?.positions || 0),
    children: Number(row?.children || 0),
  };
}

async function create(data) {
  const result = await db.insert(
    `INSERT INTO departments (code, name, parent_id, manager_id, is_active)
     VALUES (?, ?, ?, ?, ?)`,
    [
      data.code,
      data.name,
      data.parent_id || null,
      data.manager_id || null,
      data.is_active ? 1 : 0,
    ]
  );
  return findById(result.insertId);
}

async function update(id, data) {
  const result = await db.update(
    `UPDATE departments
        SET code = ?, name = ?, parent_id = ?, manager_id = ?, is_active = ?
      WHERE id = ?`,
    [
      data.code,
      data.name,
      data.parent_id || null,
      data.manager_id || null,
      data.is_active ? 1 : 0,
      id,
    ]
  );
  if (result.affectedRows === 0) throw new AppError('Không tìm thấy phòng ban để cập nhật.', 404);
  return findById(id);
}

async function remove(id) {
  const usage = await countUsage(id);
  if (usage.employees || usage.positions || usage.children) {
    throw new AppError(
      'Không thể xóa phòng ban đang có nhân viên, chức vụ hoặc phòng ban con. Vui lòng chuyển dữ liệu sang phòng khác trước.',
      409
    );
  }
  const result = await db.remove('DELETE FROM departments WHERE id = ?', [id]);
  if (result.affectedRows === 0) throw new AppError('Không tìm thấy phòng ban để xóa.', 404);
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
