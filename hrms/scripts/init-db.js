'use strict';

/**
 * Khởi tạo CSDL từ database/schema.sql và database/seed.sql.
 *   npm run db:init    -> tạo database nếu chưa có, chạy schema + seed (giữ dữ liệu cũ)
 *   npm run db:fresh   -> XÓA database rồi tạo lại từ đầu (có xác nhận)
 */

require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline/promises');
const mysql = require('mysql2/promise');

const ROOT = path.resolve(__dirname, '..');
const DB_NAME = process.env.DB_NAME || 'kids_park_hrms';
const FRESH = process.argv.includes('--fresh');

const serverConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true,
};

async function confirmFresh() {
  if (!process.stdin.isTTY) return false;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`XÓA TOÀN BỘ database "${DB_NAME}" và tạo lại? [y/N] `);
    return answer.trim().toLowerCase() === 'y';
  } finally {
    rl.close();
  }
}

async function main() {
  const admin = await mysql.createConnection(serverConfig);

  if (FRESH) {
    const ok = await confirmFresh();
    if (!ok) {
      console.log('Hủy bỏ. Dữ liệu không thay đổi.');
      await admin.end();
      return;
    }
    console.log(`Đang xóa database ${DB_NAME}...`);
    await admin.query(`DROP DATABASE IF EXISTS \`${DB_NAME}\``);
  }

  console.log(`Đang tạo database ${DB_NAME} (nếu chưa có)...`);
  await admin.query(
    `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await admin.end();

  const conn = await mysql.createConnection({ ...serverConfig, database: DB_NAME });

  try {
    for (const file of ['schema.sql', 'seed.sql']) {
      const sql = fs.readFileSync(path.join(ROOT, 'database', file), 'utf8');
      process.stdout.write(`Đang chạy database/${file} ... `);
      await conn.query(sql);
      console.log('xong');
    }
    const [rows] = await conn.query(
      'SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = ?',
      [DB_NAME]
    );
    console.log(`Hoàn tất. Database "${DB_NAME}" có ${rows[0].total} bảng.`);
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error('Khởi tạo CSDL thất bại:', error.message);
  process.exitCode = 1;
});
