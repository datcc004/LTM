'use strict';

/** express-session store lưu trên MySQL, dùng prepared statement. */

const session = require('express-session');
const db = require('./db');
const logger = require('../utils/logger');

const DEFAULT_LIFETIME_MS = 24 * 60 * 60 * 1000;

function expiryOf(sessionData) {
  const expires = sessionData?.cookie?.expires;
  const value = expires ? new Date(expires).getTime() : Date.now() + DEFAULT_LIFETIME_MS;
  return Number.isFinite(value) ? value : Date.now() + DEFAULT_LIFETIME_MS;
}

class MySQLSessionStore extends session.Store {
  async get(sid, callback) {
    try {
      const { rows } = await db.query(
        'SELECT data, expires_at FROM sessions WHERE session_id = ?',
        [sid]
      );
      if (!rows.length) return callback(null, null);

      if (Number(rows[0].expires_at) <= Date.now()) {
        await db.remove('DELETE FROM sessions WHERE session_id = ?', [sid]);
        return callback(null, null);
      }

      let parsed = null;
      try {
        parsed = JSON.parse(rows[0].data);
      } catch {
        await this.destroy(sid);
        return callback(null, null);
      }
      return callback(null, parsed);
    } catch (error) {
      logger.error('MySQLSessionStore.get', { sid, error: error.message });
      return callback(error);
    }
  }

  async set(sid, sessionData, callback) {
    try {
      const data = JSON.stringify(sessionData);
      await db.query(
        `INSERT INTO sessions (session_id, expires_at, data) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE expires_at = VALUES(expires_at), data = VALUES(data)`,
        [sid, expiryOf(sessionData), data]
      );
      if (callback) callback(null);
    } catch (error) {
      logger.error('MySQLSessionStore.set', { sid, error: error.message });
      if (callback) callback(error);
    }
  }

  async destroy(sid, callback) {
    try {
      await db.remove('DELETE FROM sessions WHERE session_id = ?', [sid]);
      if (callback) callback(null);
    } catch (error) {
      logger.error('MySQLSessionStore.destroy', { sid, error: error.message });
      if (callback) callback(error);
    }
  }

  async touch(sid, sessionData, callback) {
    try {
      await db.update(
        'UPDATE sessions SET expires_at = ? WHERE session_id = ?',
        [expiryOf(sessionData), sid]
      );
      if (callback) callback(null);
    } catch (error) {
      logger.error('MySQLSessionStore.touch', { sid, error: error.message });
      if (callback) callback(error);
    }
  }

  async clear(callback) {
    try {
      await db.remove('DELETE FROM sessions');
      if (callback) callback(null);
    } catch (error) {
      if (callback) callback(error);
    }
  }

  /** Dọn phiên hết hạn mỗi giờ; unref() để không giữ tiến trình Node. */
  startPruneTimer() {
    const timer = setInterval(() => {
      db.remove('DELETE FROM sessions WHERE expires_at < ?', [Date.now()]).catch((error) => {
        logger.warn('MySQLSessionStore.prune', { error: error.message });
      });
    }, 60 * 60 * 1000);
    timer.unref();
    return timer;
  }
}

module.exports = MySQLSessionStore;
