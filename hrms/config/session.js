'use strict';

const crypto = require('node:crypto');
const session = require('express-session');
const env = require('./env');
const MySQLSessionStore = require('./session-store');

const store = new MySQLSessionStore();
store.startPruneTimer();

module.exports = session({
  name: env.session.name,
  secret: env.session.secret,
  store,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  proxy: env.isProduction,
  genid: () => crypto.randomUUID(),
  cookie: {
    path: '/',
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'strict',
    maxAge: env.session.maxAge,
  },
});
