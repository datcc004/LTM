'use strict';

/** Truy cập dữ liệu cấu trúc lương (mỗi nhân viên một bản ghi). */

const db = require('../config/db');
const { getPagination, buildOrderBy } = require('../utils/helpers');

const ORDER_MAP = {
  id: 's.id',
  employee_code: 'e.employee_code',
  full_name: 'e.full_name',
  base_salary: 's.base_salary',
  allowance: 's.allowance',
  effective_from: 's.effective_from',
};

function buildFilters(filters = {}) {
  const clauses = [];
  const params = [];
  const q = String(filters.q || '').trim();
  if (q) {
    clauses.push('(e.employee_code LIKE ? OR e.full_name LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (filters.department_id) {
    clauses.push('e.department_id = ?');
    params.push(Number(filters.department_id));
  }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

const SELECT = `SELECT s.*, e.employee_code, e.full_name, e.status AS employee_status,
                       d.name AS department_name, p.name AS position_name
                  FROM salary_structures s
                  JOIN employees e ON e.id = s.employee_id
                  LEFT JOIN departments d ON d.id = e.department_id
                  LEFT JOIN positions p ON p.id = e.position_id`;

async function list(filters = {}, paging = {}) {
  const { page, limit, offset } = getPagination(paging, 20, 100);
  const { where, params } = buildFilters(filters);
  const order = buildOrderBy(paging.sort, ORDER_MAP, 'e.employee_code ASC');
  const countRow = await db.queryOne(
    `SELECT COUNT(*) AS total FROM salary_structures s
       JOIN employees e ON e.id = s.employee_id ${where}`,
    params
  );
  const { rows } = await db.query(
    `${SELECT} ${where} ${order} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const total = Number(countRow?.total || 0);
  return {
    rows,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

function findById(id) {
  return db.queryOne(`${SELECT} WHERE s.id = ?`, [id]);
}

function findByEmployee(employeeId, excludeId = null) {
  if (excludeId) {
    return db.queryOne(
      'SELECT id FROM salary_structures WHERE employee_id = ? AND id <> ? LIMIT 1',
      [employeeId, excludeId]
    );
  }
  return db.queryOne('SELECT id FROM salary_structures WHERE employee_id = ? LIMIT 1', [employeeId]);
}

async function create(data) {
  const result = await db.insert(
    `INSERT INTO salary_structures
       (employee_id, base_salary, allowance, dependents_count, effective_from, note)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      data.employee_id,
      data.base_salary,
      data.allowance,
      data.dependents_count,
      data.effective_from,
      data.note || null,
    ]
  );
  return findById(result.insertId);
}

async function update(id, data) {
  await db.update(
    `UPDATE salary_structures
        SET employee_id = ?, base_salary = ?, allowance = ?, dependents_count = ?,
            effective_from = ?, note = ?
      WHERE id = ?`,
    [
      data.employee_id,
      data.base_salary,
      data.allowance,
      data.dependents_count,
      data.effective_from,
      data.note || null,
      id,
    ]
  );
  return findById(id);
}

async function remove(id) {
  const { affectedRows } = await db.remove('DELETE FROM salary_structures WHERE id = ?', [id]);
  return affectedRows > 0;
}

module.exports = {
  list,
  findById,
  findByEmployee,
  create,
  update,
  remove,
};
