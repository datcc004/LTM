'use strict';

/** Truy cập dữ liệu hợp đồng; trạng thái hết hạn được tính từ end_date. */

const db = require('../config/db');
const env = require('../config/env');
const { AppError, getPagination, buildOrderBy } = require('../utils/helpers');

const ORDER_MAP = {
  id: 'id',
  contract_no: 'contract_no',
  start_date: 'start_date',
  end_date: 'end_date',
  created_at: 'created_at',
};

function computeStatus(endDate, requestedStatus = '') {
  if (requestedStatus === 'Đã hủy') return 'Đã hủy';
  if (!endDate) return 'Còn hạn';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(`${String(endDate).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(end.getTime())) return 'Còn hạn';
  const days = Math.round((end.getTime() - today.getTime()) / 86400000);
  if (days < 0) return 'Hết hạn';
  if (days <= env.business.contractAlertDays) return 'Sắp hết hạn';
  return 'Còn hạn';
}

function buildFilters(filters = {}) {
  const clauses = [];
  const params = [];
  const q = String(filters.q || '').trim();
  if (q) {
    clauses.push('(c.contract_no LIKE ? OR e.full_name LIKE ? OR e.employee_code LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (filters.employee_id) {
    clauses.push('c.employee_id = ?');
    params.push(filters.employee_id);
  }
  if (filters.status) {
    clauses.push('c.status = ?');
    params.push(filters.status);
  }
  if (filters.contract_type) {
    clauses.push('c.contract_type = ?');
    params.push(filters.contract_type);
  }
  if (filters.expiring === '1' || filters.expiring === 1) {
    clauses.push(`c.end_date IS NOT NULL AND c.end_date >= CURDATE()
                  AND c.end_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
                  AND c.status <> 'Đã hủy'`);
    params.push(env.business.contractAlertDays);
  }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

async function list(filters = {}, paging = {}) {
  const { page, limit, offset } = getPagination(paging, 20, 100);
  const { where, params } = buildFilters(filters);
  const order = buildOrderBy(paging.sort, ORDER_MAP, 'c.id DESC');

  const countRow = await db.queryOne(
    `SELECT COUNT(*) AS total
       FROM contracts c
       JOIN employees e ON e.id = c.employee_id
       ${where}`,
    params
  );
  const { rows } = await db.query(
    `SELECT c.id, c.employee_id, c.contract_no, c.contract_type, c.start_date,
            c.end_date, c.signed_date, c.salary_base, c.status, c.document_path, c.note,
            e.employee_code, e.full_name, e.department_id, d.name AS department_name,
            DATEDIFF(c.end_date, CURDATE()) AS days_left
       FROM contracts c
       JOIN employees e ON e.id = c.employee_id
       LEFT JOIN departments d ON d.id = e.department_id
       ${where}
       ${order}
       LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const total = Number(countRow?.total || 0);
  return {
    rows: rows.map((row) => ({ ...row, days_left: row.days_left === null ? null : Number(row.days_left) })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

function findById(id) {
  return db.queryOne(
    `SELECT c.*, e.employee_code, e.full_name, d.name AS department_name
       FROM contracts c
       JOIN employees e ON e.id = c.employee_id
       LEFT JOIN departments d ON d.id = e.department_id
      WHERE c.id = ?`,
    [id]
  );
}

function findByNo(contractNo, excludeId = null) {
  if (excludeId) {
    return db.queryOne('SELECT id FROM contracts WHERE contract_no = ? AND id <> ? LIMIT 1', [contractNo, excludeId]);
  }
  return db.queryOne('SELECT id FROM contracts WHERE contract_no = ? LIMIT 1', [contractNo]);
}

/** Sinh số hợp đồng HD-<năm>-<mã NV>; nếu trùng thì thêm -2, -3... */
async function generateNo(employeeId) {
  const employee = await db.queryOne('SELECT hire_date FROM employees WHERE id = ?', [employeeId]);
  if (!employee) throw new AppError('Không tìm thấy nhân viên để lập hợp đồng.', 404);
  const year = new Date(employee.hire_date).getFullYear() || new Date().getFullYear();
  const base = `HD-${year}-${String(employeeId).padStart(4, '0')}`;
  const suffix = base.slice(0, 26);
  for (let index = 1; index < 100; index += 1) {
    const candidate = index === 1 ? base : `${suffix}-${index}`;
    const exists = await findByNo(candidate);
    if (!exists) return candidate.slice(0, 30);
  }
  throw new AppError('Không thể sinh số hợp đồng mới. Vui lòng nhập thủ công.', 409);
}

async function create(data) {
  const result = await db.insert(
    `INSERT INTO contracts
       (employee_id, contract_no, contract_type, start_date, end_date, signed_date,
        salary_base, status, document_path, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.employee_id,
      data.contract_no,
      data.contract_type,
      data.start_date,
      data.end_date || null,
      data.signed_date || null,
      data.salary_base || 0,
      data.status,
      data.document_path || null,
      data.note || null,
    ]
  );
  return findById(result.insertId);
}

async function update(id, data) {
  const result = await db.update(
    `UPDATE contracts
        SET employee_id = ?, contract_no = ?, contract_type = ?, start_date = ?,
            end_date = ?, signed_date = ?, salary_base = ?, status = ?,
            document_path = ?, note = ?
      WHERE id = ?`,
    [
      data.employee_id,
      data.contract_no,
      data.contract_type,
      data.start_date,
      data.end_date || null,
      data.signed_date || null,
      data.salary_base || 0,
      data.status,
      data.document_path || null,
      data.note || null,
      id,
    ]
  );
  if (result.affectedRows === 0) throw new AppError('Không tìm thấy hợp đồng để cập nhật.', 404);
  return findById(id);
}

async function remove(id) {
  const result = await db.remove('DELETE FROM contracts WHERE id = ?', [id]);
  if (result.affectedRows === 0) throw new AppError('Không tìm thấy hợp đồng để xóa.', 404);
  return true;
}

module.exports = {
  computeStatus,
  list,
  findById,
  findByNo,
  generateNo,
  create,
  update,
  remove,
};
