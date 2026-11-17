'use strict';

const dashboardService = require('../services/dashboard.service');
const { asyncHandler, jsonSuccess } = require('../utils/helpers');

const index = asyncHandler(async (req, res) => {
  const data = await dashboardService.getDashboardData(req.user);
  return res.render('dashboard/index', {
    title: 'Tổng quan',
    dashboard: data,
  });
});

/** Dữ liệu biểu đồ cho public/js/dashboard.js (không dùng inline script vì CSP). */
const chartData = asyncHandler(async (req, res) => {
  const data = await dashboardService.getDashboardData(req.user);
  return jsonSuccess(res, {
    departmentChart: data.departmentChart,
    attendanceChart: data.attendanceChart,
  });
});

module.exports = { index, chartData };
