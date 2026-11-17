'use strict';

/** Truy cập dữ liệu nhân viên. Mã NV#### được cấp mới trong transaction để tránh trùng. */

const db = require('../config/db');
const {
  AppError, getPagination, buildOrderBy, generateEmployeeCode,
} = require('../utils/helpers');

const ORDER_MAP = {
  id: 'id',
  employee_code: 'employee_code',
  full_name: 'full_name',
  hire_date: 'hire_date',
  created_at: 'created_at',
};

function buildFilters(filters = {}) {
  const clauses = [];
  const params = [];
  const q = String(filters.q || '').trim();
  if (q) {
    clauses.push('(e.employee_code LIKE ? OR e.full_name LIKE ? OR e.phone LIKE ? OR e.email LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (filters.department_id) {
    clauses.push('e.department_id = ?');
    params.push(filters.department_id);
  }
  if (filters.position_id) {
    clauses.push('e.position_id = ?');
    params.push(filters.position_id);
  }
  if (filters.status) {
    clauses.push('e.status = ?');
    params.push(filters.status);
  }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

async function list(filters = {}, paging = {}) {
  const { page, limit, offset } = getPagination(paging, 20, 100);
  const { where, params } = buildFilters(filters);
  const order = buildOrderBy(paging.sort, ORDER_MAP, 'id DESC');

  const countRow = await db.queryOne(`SELECT COUNT(*) AS total FROM employees e ${where}`, params);
  const { rows } = await db.query(
    `SELECT e.id, e.employee_code, e.full_name, e.gender, e.phone, e.email,
            e.hire_date, e.status, e.avatar_path, e.department_id, e.position_id,
            d.name AS department_name, p.name AS position_name,
            m.full_name AS manager_name,
            (SELECT COUNT(*) FROM contracts c WHERE c.employee_id = e.id AND c.status <> 'Đã hủy') AS contract_count
       FROM employees e
       LEFT JOIN departments d ON d.id = e.department_id
       LEFT JOIN positions p ON p.id = e.position_id
       LEFT JOIN employees m ON m.id = e.manager_id
       ${where}
       ${order}
       LIMIT ? OFFSET ?`,
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
  return db.queryOne(
    `SELECT e.*,
            d.name AS department_name, p.name AS position_name,
            m.full_name AS manager_name,
            u.username, u.role_id, r.name AS role_name
       FROM employees e
       LEFT JOIN departments d ON d.id = e.department_id
       LEFT JOIN positions p ON p.id = e.position_id
       LEFT JOIN employees m ON m.id = e.manager_id
       LEFT JOIN users u ON u.id = e.user_id
       LEFT JOIN roles r ON r.id = u.role_id
      WHERE e.id = ?`,
    [id]
  );
}

function findByCode(code, excludeId = null) {
  if (excludeId) {
    return db.queryOne('SELECT id FROM employees WHERE employee_code = ? AND id <> ? LIMIT 1', [code, excludeId]);
  }
  return db.queryOne('SELECT id FROM employees WHERE employee_code = ? LIMIT 1', [code]);
}

function findByIdCard(idCard, excludeId = null) {
  if (!idCard) return Promise.resolve(null);
  if (excludeId) {
    return db.queryOne('SELECT id FROM employees WHERE id_card = ? AND id <> ? LIMIT 1', [idCard, excludeId]);
  }
  return db.queryOne('SELECT id FROM employees WHERE id_card = ? LIMIT 1', [idCard]);
}

async function selectOptions(excludeId = null) {
  const base = `SELECT id, employee_code, full_name, department_id
                  FROM employees
                 WHERE status <> 'Nghỉ việc'`;
  const sql = excludeId
    ? `${base} AND id <> ? ORDER BY full_name ASC`
    : `${base} ORDER BY full_name ASC`;
  const { rows } = await db.query(sql, excludeId ? [excludeId] : []);
  return rows;
}

async function create(data) {
  return db.transaction(async (tx) => {
    const last = await tx.queryOne(
      'SELECT employee_code FROM employees ORDER BY employee_code DESC LIMIT 1 FOR UPDATE'
    );
    const employeeCode = generateEmployeeCode(last?.employee_code);

    const result = await tx.insert(
      `INSERT INTO employees
         (employee_code, full_name, gender, date_of_birth, phone, email, address,
          id_card, department_id, position_id, manager_id, hire_date, status, avatar_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        employeeCode,
        data.full_name,
        data.gender,
        data.date_of_birth || null,
        data.phone || null,
        data.email || null,
        data.address || null,
        data.id_card || null,
        data.department_id,
        data.position_id,
        data.manager_id || null,
        data.hire_date,
        'Đang làm việc',
        data.avatar_path || null,
      ]
    );
    return { id: result.insertId, employee_code: employeeCode };
  });
}

async function update(id, data) {
  const result = await db.update(
    `UPDATE employees
        SET full_name = ?, gender = ?, date_of_birth = ?, phone = ?, email = ?,
            address = ?, id_card = ?, department_id = ?, position_id = ?,
            manager_id = ?, hire_date = ?, status = ?, avatar_path = ?
      WHERE id = ?`,
    [
      data.full_name,
      data.gender,
      data.date_of_birth || null,
      data.phone || null,
      data.email || null,
      data.address || null,
      data.id_card || null,
      data.department_id,
      data.position_id,
      data.manager_id || null,
      data.hire_date,
      data.status,
      data.avatar_path || null,
      id,
    ]
  );
  if (result.affectedRows === 0) throw new AppError('Không tìm thấy nhân viên để cập nhật.', 404);
  return findById(id);
}

/** Xóa nhân viên theo hướng soft-delete: nhiều bảng khác có FK RESTRICT tới employees. */
async function setStatus(id, status) {
  const result = await db.update('UPDATE employees SET status = ? WHERE id = ?', [status, id]);
  if (result.affectedRows === 0) throw new AppError('Không tìm thấy nhân viên.', 404);
  return findById(id);
}

module.exports = {
  list,
  findById,
  findByCode,
  findByIdCard,
  selectOptions,
  create,
  update,
  setStatus,
};
