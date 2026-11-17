'use strict';

/** Truy cập dữ liệu phiếu lương và các khoản mục chi tiết. */

const db = require('../config/db');
const { getPagination, buildOrderBy } = require('../utils/helpers');

const ORDER_MAP = {
  id: 'p.id',
  employee_code: 'e.employee_code',
  full_name: 'e.full_name',
  net_salary: 'p.net_salary',
  working_days: 'p.working_days',
  status: 'p.status',
};

function buildFilters(filters = {}) {
  const clauses = [];
  const params = [];
  if (filters.period_id) {
    clauses.push('p.period_id = ?');
    params.push(Number(filters.period_id));
  }
  const q = String(filters.q || '').trim();
  if (q) {
    clauses.push('(e.employee_code LIKE ? OR e.full_name LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (filters.status) {
    clauses.push('p.status = ?');
    params.push(filters.status);
  }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

const SELECT = `SELECT p.*, e.employee_code, e.full_name, e.status AS employee_status,
                       d.name AS department_name, pos.name AS position_name,
                       (SELECT s.dependents_count FROM salary_structures s
                         WHERE s.employee_id = p.employee_id) AS dependents_count
                  FROM payrolls p
                  JOIN employees e ON e.id = p.employee_id
                  LEFT JOIN departments d ON d.id = e.department_id
                  LEFT JOIN positions pos ON pos.id = e.position_id`;

async function list(filters = {}, paging = {}) {
  const { page, limit, offset } = getPagination(paging, 20, 100);
  const { where, params } = buildFilters(filters);
  const order = buildOrderBy(paging.sort, ORDER_MAP, 'e.employee_code ASC');
  const countRow = await db.queryOne(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(p.net_salary), 0) AS total_net,
            COALESCE(SUM(p.base_salary + p.allowance + p.bonus + p.overtime_pay), 0) AS total_gross
       FROM payrolls p JOIN employees e ON e.id = p.employee_id ${where}`,
    params
  );
  const { rows } = await db.query(
    `${SELECT} ${where} ${order} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return {
    rows,
    total: Number(countRow?.total || 0),
    totalNet: Number(countRow?.total_net || 0),
    totalGross: Number(countRow?.total_gross || 0),
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(Number(countRow?.total || 0) / limit)),
  };
}

function findById(id) {
  return db.queryOne(`${SELECT} WHERE p.id = ?`, [id]);
}

function findByPeriodEmployee(periodId, employeeId) {
  return db.queryOne('SELECT * FROM payrolls WHERE period_id = ? AND employee_id = ? LIMIT 1', [periodId, employeeId]);
}

function items(payrollId) {
  return db.query(
    `SELECT id, item_type, code, name, amount, note FROM payroll_items
      WHERE payroll_id = ? ORDER BY id ASC`,
    [payrollId]
  ).then((result) => result.rows);
}

async function create(data) {
  const result = await db.insert(
    `INSERT INTO payrolls
       (period_id, employee_id, base_salary, allowance, bonus, overtime_pay, deduction,
        insurance_amount, taxable_income, personal_income_tax, net_salary, working_days, status, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.period_id, data.employee_id, data.base_salary, data.allowance, data.bonus,
      data.overtime_pay, data.deduction, data.insurance_amount, data.taxable_income,
      data.personal_income_tax, data.net_salary, data.working_days,
      data.status || 'Dự thảo', data.note || null,
    ]
  );
  return findById(result.insertId);
}

/** Cập nhật các khoản do HR chỉnh tay; các khoản tính toán được tính lại từ service. */
async function update(id, data) {
  await db.update(
    `UPDATE payrolls
        SET base_salary = ?, allowance = ?, bonus = ?, deduction = ?, working_days = ?,
            insurance_amount = ?, taxable_income = ?, personal_income_tax = ?,
            net_salary = ?, note = ?
      WHERE id = ? AND status = 'Dự thảo'`,
    [
      data.base_salary, data.allowance, data.bonus, data.deduction, data.working_days,
      data.insurance_amount, data.taxable_income, data.personal_income_tax,
      data.net_salary, data.note || null, id,
    ]
  );
  return findById(id);
}

async function replaceItems(payrollId, itemRows) {
  await db.remove('DELETE FROM payroll_items WHERE payroll_id = ?', [payrollId]);
  for (const item of itemRows) {
    await db.insert(
      `INSERT INTO payroll_items (payroll_id, item_type, code, name, amount, note)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [payrollId, item.item_type, item.code, item.name, item.amount, item.note || null]
    );
  }
}

async function remove(id) {
  const { affectedRows } = await db.remove(
    `DELETE FROM payrolls WHERE id = ? AND status = 'Dự thảo'`,
    [id]
  );
  return affectedRows > 0;
}

async function removeByPeriod(periodId) {
  const { affectedRows } = await db.remove(
    `DELETE FROM payrolls WHERE period_id = ? AND status = 'Dự thảo'`,
    [periodId]
  );
  return affectedRows;
}

module.exports = {
  list,
  findById,
  findByPeriodEmployee,
  items,
  create,
  update,
  replaceItems,
  remove,
  removeByPeriod,
};
