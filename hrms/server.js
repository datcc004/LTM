'use strict';

/** Entry point: khởi động HTTP server và đóng pool DB khi tắt tiến trình. */

const env = require('./config/env');
const db = require('./config/db');
const logger = require('./utils/logger');
const app = require('./app');

const server = app.listen(env.port, () => {
  logger.info('KIDS PARK HRMS is running', {
    url: env.appUrl,
    port: env.port,
    env: env.nodeEnv,
  });
  process.stdout.write(`KIDS PARK HRMS: http://localhost:${env.port}\n`);
});

server.on('error', (error) => {
  logger.error('HTTP server error', { error: error.message, code: error.code });
  process.exitCode = 1;
});

async function shutdown(signal) {
  logger.info('Shutting down', { signal });
  server.close(async () => {
    try {
      await db.close();
      logger.info('Database pool closed');
      process.exit(0);
    } catch (error) {
      logger.error('Failed to close database pool', { error: error.message });
      process.exit(1);
    }
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = server;
