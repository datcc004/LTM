'use strict';

const fs = require('node:fs');
const path = require('node:path');
const env = require('../config/env');

const LOG_DIR = env.paths.logs;
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN_LEVEL = env.isProduction ? LEVELS.info : LEVELS.debug;

function write(level, message, context = {}) {
  if (LEVELS[level] < MIN_LEVEL) return;
  const entry = {
    time: new Date().toISOString(),
    level: level.toUpperCase(),
    message,
    ...context,
  };
  const line = JSON.stringify(entry);
  process.stdout.write(`${line}\n`);

  const file = path.join(LOG_DIR, `${new Date().toISOString().slice(0, 10)}.log`);
  fs.appendFile(file, `${line}\n`, () => {});
}

module.exports = {
  debug: (message, context) => write('debug', message, context),
  info: (message, context) => write('info', message, context),
  warn: (message, context) => write('warn', message, context),
  error: (message, context) => write('error', message, context),
};
