'use strict';

/** Truy cập dữ liệu kỳ lương; trạng thái Dự thảo / Đã chốt. */

const db = require('../config/db');
const { getPagination, buildOrderBy } = require('../utils/helpers');

const ORDER_MAP = {
  id: 'p.id',
  period_code: 'p.period_code',
  month: 'p.month',
  year: 'p.year',
  status: 'p.status',
  start_date: 'p.start_date',
};

function buildFilters(filters = {}) {
  const clauses = [];
  const params = [];
  const q = String(filters.q || '').trim();
  if (q) {
    clauses.push('p.period_code LIKE ?');
    params.push(`%${q}%`);
  }
  if (filters.status) {
    clauses.push('p.status = ?');
    params.push(filters.status);
  }
  if (filters.year) {
    clauses.push('p.year = ?');
    params.push(Number(filters.year));
  }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

const SELECT = `SELECT p.*,
                       (SELECT COUNT(*) FROM payrolls pr WHERE pr.period_id = p.id) AS payroll_count,
                       (SELECT COALESCE(SUM(pr.net_salary), 0) FROM payrolls pr WHERE pr.period_id = p.id) AS total_net,
                       COALESCE(e.full_name, u.username) AS locked_by_name
                  FROM payroll_periods p
                  LEFT JOIN users u ON u.id = p.locked_by
                  LEFT JOIN employees e ON e.id = u.employee_id`;

async function list(filters = {}, paging = {}) {
  const { page, limit, offset } = getPagination(paging, 20, 100);
  const { where, params } = buildFilters(filters);
  const order = buildOrderBy(paging.sort, ORDER_MAP, 'p.year DESC, p.month DESC');
  const countRow = await db.queryOne(
    `SELECT COUNT(*) AS total FROM payroll_periods p ${where}`,
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
  return db.queryOne(`${SELECT} WHERE p.id = ?`, [id]);
}

function findByCode(code, excludeId = null) {
  if (excludeId) {
    return db.queryOne(
      'SELECT id FROM payroll_periods WHERE period_code = ? AND id <> ? LIMIT 1',
      [code, excludeId]
    );
  }
  return db.queryOne('SELECT id FROM payroll_periods WHERE period_code = ? LIMIT 1', [code]);
}

function selectOptions() {
  return db.query(
    `SELECT id, period_code, status FROM payroll_periods
      ORDER BY year DESC, month DESC`
  ).then((result) => result.rows);
}

async function create(data) {
  const result = await db.insert(
    `INSERT INTO payroll_periods
       (period_code, month, year, start_date, end_date, status, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.period_code, data.month, data.year,
      data.start_date, data.end_date, data.status || 'Dự thảo', data.note || null,
    ]
  );
  return findById(result.insertId);
}

async function update(id, data) {
  await db.update(
    `UPDATE payroll_periods
        SET period_code = ?, month = ?, year = ?, start_date = ?, end_date = ?, note = ?
      WHERE id = ? AND status = 'Dự thảo'`,
    [
      data.period_code, data.month, data.year,
      data.start_date, data.end_date, data.note || null, id,
    ]
  );
  return findById(id);
}

/** Chốt kỳ: khóa mọi phiếu thuộc kỳ và ghi người chốt. */
async function lock(id, lockedBy, status) {
  await db.transaction(async (tx) => {
    await tx.update(
      `UPDATE payroll_periods
          SET status = ?, locked_at = CASE WHEN ? = 'Đã chốt' THEN NOW() ELSE NULL END,
              locked_by = CASE WHEN ? = 'Đã chốt' THEN ? ELSE NULL END
        WHERE id = ?`,
      [status, status, status, lockedBy, id]
    );
    await tx.update('UPDATE payrolls SET status = ? WHERE period_id = ?', [status, id]);
  });
  return findById(id);
}

async function remove(id) {
  const period = await findById(id);
  if (!period || period.status !== 'Dự thảo') return false;
  const { affectedRows } = await db.remove(
    `DELETE FROM payroll_periods WHERE id = ? AND status = 'Dự thảo'`,
    [id]
  );
  return affectedRows > 0;
}

module.exports = {
  list,
  findById,
  findByCode,
  selectOptions,
  create,
  update,
  lock,
  remove,
};
