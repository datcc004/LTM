'use strict';

/**
 * connection pool mysql2/promise.
 * Mọi truy vấn đi qua query()/execute() -> dùng prepared statement (binary protocol).
 * Không bao giờ nối chuỗi giá trị người dùng vào SQL.
 */

const mysql = require('mysql2/promise');
const env = require('./env');
const { AppError } = require('../utils/helpers');

let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      database: env.db.name,
      waitForConnections: true,
      connectionLimit: env.db.poolLimit,
      queueLimit: 0,
      charset: 'utf8mb4',
      timezone: '+07:00',
      multipleStatements: false,
      namedPlaceholders: true,
    });
  }
  return pool;
}

/** Trả về { rows, fields }. params luôn là mảng giá trị. */
async function query(sql, params = []) {
  const [rows, fields] = await getPool().execute(sql, params);
  return { rows, fields };
}

async function queryOne(sql, params = []) {
  const { rows } = await query(sql, params);
  return rows[0] || null;
}

async function queryValue(sql, params = []) {
  const row = await queryOne(sql, params);
  if (!row) return null;
  return row[Object.keys(row)[0]];
}

async function insert(sql, params = []) {
  const [result] = await getPool().execute(sql, params);
  return { insertId: Number(result.insertId), affectedRows: result.affectedRows };
}

async function update(sql, params = []) {
  const [result] = await getPool().execute(sql, params);
  return { affectedRows: result.affectedRows, changedRows: result.changedRows };
}

async function remove(sql, params = []) {
  const [result] = await getPool().execute(sql, params);
  return { affectedRows: result.affectedRows };
}

async function transaction(handler) {
  const conn = await getPool().getConnection();
  const tx = {
    execute: (sql, params = []) => conn.execute(sql, params),
    query: async (sql, params = []) => {
      const [rows, fields] = await conn.execute(sql, params);
      return { rows, fields };
    },
    queryOne: async (sql, params = []) => {
      const [rows] = await conn.execute(sql, params);
      return rows[0] || null;
    },
    insert: async (sql, params = []) => {
      const [result] = await conn.execute(sql, params);
      return { insertId: Number(result.insertId), affectedRows: result.affectedRows };
    },
    update: async (sql, params = []) => {
      const [result] = await conn.execute(sql, params);
      return { affectedRows: result.affectedRows, changedRows: result.changedRows };
    },
  };

  try {
    await conn.beginTransaction();
    const result = await handler(tx);
    await conn.commit();
    return result;
  } catch (error) {
    try {
      await conn.rollback();
    } catch (rollbackError) {
      error.rollbackError = rollbackError;
    }
    throw error;
  } finally {
    conn.release();
  }
}

/** Chỉ cho phép identifier [A-Za-z_][A-Za-z0-9_]* → chặn injection qua ORDER BY động. */
function safeIdent(name) {
  if (typeof name !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new AppError('Tên cột không hợp lệ', 400);
  }
  return `\`${name}\``;
}

async function ping() {
  const conn = await getPool().getConnection();
  try {
    await conn.ping();
    return true;
  } finally {
    conn.release();
  }
}

async function close() {
  if (!pool) return;
  await pool.end();
  pool = null;
}

module.exports = {
  getPool,
  query,
  queryOne,
  queryValue,
  insert,
  update,
  remove,
  transaction,
  safeIdent,
  ping,
  close,
};
