'use strict';

/** Xem nhật ký thao tác (ADMIN_ONLY). Chỉ đọc. */

const auditLogModel = require('../models/auditLog.model');
const adminService = require('../services/admin.service');
const { asyncHandler, getPagination } = require('../utils/helpers');

const VIEW = 'admin/audit-logs/index';

function queryString(query) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, String(value));
  }
  return params.toString();
}

const index = asyncHandler(async (req, res) => {
  const query = adminService.normalizeAuditQuery(req.query);
  const paging = getPagination(req.query, 20, 100);
  const [result, actions, tables] = await Promise.all([
    auditLogModel.list(query, { ...req.query, page: paging.page, limit: paging.limit }),
    auditLogModel.distinctActions(),
    auditLogModel.distinctTables(),
  ]);
  return res.render(VIEW, {
    title: 'Nhật ký thao tác',
    logs: result.rows,
    actions,
    tables,
    query,
    pagination: result,
    basePath: '/admin/audit-logs',
    filterQuery: queryString(query),
  });
});

module.exports = { index };
