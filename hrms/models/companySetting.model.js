'use strict';

/** Cấu hình công ty lưu dạng key/value, phân nhóm theo setting_group. */

const db = require('../config/db');

async function listAll() {
  const { rows } = await db.query(
    `SELECT cs.id, cs.setting_key, cs.setting_value, cs.setting_group, cs.description,
            cs.updated_at, u.username AS updated_by_name
       FROM company_settings cs
       LEFT JOIN users u ON u.id = cs.updated_by
      ORDER BY cs.setting_group, cs.setting_key`
  );
  return rows;
}

async function findByKey(settingKey) {
  return db.queryOne(
    'SELECT * FROM company_settings WHERE setting_key = ?',
    [settingKey]
  );
}

async function update(settingKey, value, updatedBy) {
  await db.update(
    `UPDATE company_settings
        SET setting_value = ?, updated_by = ?
      WHERE setting_key = ?`,
    [value, updatedBy ?? null, settingKey]
  );
  return findByKey(settingKey);
}

module.exports = { listAll, findByKey, update };
