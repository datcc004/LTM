'use strict';

/** Làm mới dữ liệu khung giao diện sau khi xác thực: menu/breadcrumb theo role, badge và thông báo. */

const menu = require('../config/menu');
const dashboardService = require('../services/dashboard.service');
const { asyncHandler } = require('../utils/helpers');
const logger = require('../utils/logger');

function refreshNavigation(req, res, next) {
  res.locals.menu = menu.visibleFor(req.user);
  res.locals.activeMenu = menu.findActivePath(res.locals.menu, req.path);
  res.locals.breadcrumbs = menu.breadcrumbs(req.user, req.path);
  return next();
}

const loadShellData = asyncHandler(async (req, res, next) => {
  try {
    const [badges, notifications] = await Promise.all([
      dashboardService.getBadges(req.user),
      dashboardService.getNotifications(req.user, 5),
    ]);
    res.locals.badges = badges;
    res.locals.notifications = notifications;
  } catch (error) {
    logger.warn('Không thể tải badge/thông báo', { error: error.message });
  }
  return next();
});

module.exports = { refreshNavigation, loadShellData };
