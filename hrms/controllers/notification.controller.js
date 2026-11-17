'use strict';

const dashboardService = require('../services/dashboard.service');
const { asyncHandler } = require('../utils/helpers');

const index = asyncHandler(async (req, res) => {
  const notifications = await dashboardService.getNotifications(req.user, 50);
  return res.render('notifications/index', {
    title: 'Thông báo',
    notifications,
  });
});

module.exports = { index };
