'use strict';

/** Nhật ký thao tác: chỉ đọc, dùng cho màn hình kiểm toán của ADMIN. */

const db = require('../config/db');
const { getPagination } = require('../utils/helpers');

const ORDER_MAP = {
  id: 'al.id', created_at: 'al.created_at', action: 'al.action', table_name: 'al.table_name',
};

async function list(filters = {}, paging = {}) {
  const { page, limit, offset } = getPagination(paging, 20, 100);
  const clauses = [];
  const params = [];

  if (filters.action) {
    clauses.push('al.action = ?');
    params.push(filters.action);
  }
  if (filters.table_name) {
    clauses.push('al.table_name = ?');
    params.push(filters.table_name);
  }
  if (filters.q) {
    clauses.push('(u.username LIKE ? OR al.record_id LIKE ? OR al.table_name LIKE ?)');
    params.push(`%${filters.q}%`, `%${filters.q}%`, `%${filters.q}%`);
  }
  if (filters.from_date) {
    clauses.push('al.created_at >= ?');
    params.push(`${filters.from_date} 00:00:00`);
  }
  if (filters.to_date) {
    clauses.push('al.created_at <= ?');
    params.push(`${filters.to_date} 23:59:59`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const sort = String(paging.sort || 'created_at:desc');
  const [field, dirRaw] = sort.split(':');
  const safeField = Object.prototype.hasOwnProperty.call(ORDER_MAP, field) ? ORDER_MAP[field] : 'al.created_at';
  const dir = String(dirRaw || '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const counted = await db.queryOne(
    `SELECT COUNT(*) AS total FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id ${where}`,
    params
  );
  const { rows } = await db.query(
    `SELECT al.id, al.user_id, al.action, al.table_name, al.record_id,
            al.old_value, al.new_value, al.ip_address, al.user_agent, al.created_at,
            u.username, u.email
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       ${where}
       ORDER BY ${safeField} ${dir}, al.id DESC
       LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const total = Number(counted.total) || 0;
  return { rows, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

async function distinctActions() {
  const { rows } = await db.query(
    'SELECT DISTINCT action FROM audit_logs ORDER BY action'
  );
  return rows.map((row) => row.action);
}

async function distinctTables() {
  const { rows } = await db.query(
    'SELECT DISTINCT table_name FROM audit_logs ORDER BY table_name'
  );
  return rows.map((row) => row.table_name);
}

module.exports = { list, distinctActions, distinctTables };
