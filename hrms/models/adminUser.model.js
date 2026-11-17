'use strict';

/** Quản trị tài khoản: danh sách, tạo/sửa, khóa/mở khóa. Mật khẩu luôn băm bcrypt. */

const db = require('../config/db');
const { getPagination, buildOrderBy, hashPassword } = require('../utils/helpers');

const ORDER_MAP = {
  id: 'u.id',
  username: 'u.username',
  role: 'r.name',
  full_name: 'e.full_name',
  is_active: 'u.is_active',
  last_login_at: 'u.last_login_at',
};

function buildFilters(filters = {}) {
  const clauses = [];
  const params = [];
  const q = String(filters.q || '').trim();
  if (q) {
    clauses.push('(u.username LIKE ? OR u.email LIKE ? OR e.full_name LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (filters.role) {
    clauses.push('r.name = ?');
    params.push(filters.role);
  }
  if (filters.is_active === '1' || filters.is_active === 1) clauses.push('u.is_active = 1');
  else if (filters.is_active === '0' || filters.is_active === 0) clauses.push('u.is_active = 0');
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

const SELECT = `SELECT u.id, u.username, u.email, u.role_id, u.employee_id,
       u.is_active, u.failed_login_attempts, u.locked_until, u.last_login_at,
       u.created_at, r.name AS role, e.full_name, e.employee_code, e.status AS employee_status
  FROM users u
  INNER JOIN roles r ON r.id = u.role_id
  LEFT JOIN employees e ON e.id = u.employee_id`;

async function list(filters = {}, paging = {}) {
  const { page, limit, offset } = getPagination(paging, 20, 100);
  const { where, params } = buildFilters(filters);
  const order = buildOrderBy(paging.sort, ORDER_MAP, 'u.id ASC');
  const counted = await db.queryOne(`SELECT COUNT(*) AS total FROM users u INNER JOIN roles r ON r.id = u.role_id LEFT JOIN employees e ON e.id = u.employee_id ${where}`, params);
  const { rows } = await db.query(`${SELECT} ${where} ${order} LIMIT ? OFFSET ?`, [...params, limit, offset]);
  const total = Number(counted.total) || 0;
  return { rows, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

async function findById(id) {
  return db.queryOne(
    `${SELECT} WHERE u.id = ?`,
    [id]
  );
}

async function getRoles() {
  const { rows } = await db.query('SELECT id, name, description FROM roles ORDER BY id');
  return rows;
}

/** Nhân viên chưa có tài khoản để chọn khi tạo user. */
async function getAvailableEmployees() {
  const { rows } = await db.query(
    `SELECT e.id, e.employee_code, e.full_name, d.name AS department_name
       FROM employees e
       LEFT JOIN departments d ON d.id = e.department_id
       LEFT JOIN users u ON u.employee_id = e.id
      WHERE u.id IS NULL AND e.status = 'Đang làm việc'
      ORDER BY e.full_name`
  );
  return rows;
}

function normalizeEmployeeId(value) {
  if (value === '' || value === null || value === undefined) return null;
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/** Giữ hai chiều users.employee_id <-> employees.user_id luôn khớp nhau. */
async function syncEmployeeLink(tx, userId, employeeId) {
  await tx.update('UPDATE employees SET user_id = NULL WHERE user_id = ?', [userId]);
  if (employeeId) {
    await tx.update('UPDATE employees SET user_id = ? WHERE id = ?', [userId, employeeId]);
  }
}

async function create(data) {
  const passwordHash = await hashPassword(data.password);
  const employeeId = normalizeEmployeeId(data.employee_id);
  const { insertId } = await db.transaction(async (tx) => {
    const result = await tx.insert(
      `INSERT INTO users (username, email, password_hash, role_id, employee_id, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [data.username, data.email, passwordHash, data.role_id, employeeId, data.is_active ? 1 : 0]
    );
    await syncEmployeeLink(tx, result.insertId, employeeId);
    return { insertId: result.insertId };
  });
  return findById(insertId);
}

async function update(id, data) {
  const employeeId = normalizeEmployeeId(data.employee_id);
  const params = [data.username, data.email, data.role_id, employeeId];
  let sql = `UPDATE users
                SET username = ?, email = ?, role_id = ?, employee_id = ?`;
  if (data.password) {
    const passwordHash = await hashPassword(data.password);
    sql += ', password_hash = ?';
    params.push(passwordHash);
  }
  sql += ' WHERE id = ?';
  params.push(id);

  await db.transaction(async (tx) => {
    await tx.update(sql, params);
    await syncEmployeeLink(tx, id, employeeId);
  });
  return findById(id);
}

async function setActive(id, isActive) {
  await db.update(
    `UPDATE users SET is_active = ?, failed_login_attempts = 0,
       locked_until = NULL WHERE id = ?`,
    [isActive ? 1 : 0, id]
  );
  return findById(id);
}

module.exports = {
  list, findById, getRoles, getAvailableEmployees, create, update, setActive,
};
