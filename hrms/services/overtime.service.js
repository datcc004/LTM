'use strict';

/** Nghiệp vụ tăng ca: hệ số theo loại ngày, số giờ và thành tiền. */

const env = require('../config/env');
const { AppError, roundMoney } = require('../utils/helpers');

const OT_DAY_TYPES = ['Ngày thường', 'Cuối tuần', 'Ngày lễ'];
const RATE_KEYS = {
  'Ngày thường': 'otRateWeekday',
  'Cuối tuần': 'otRateWeekend',
  'Ngày lễ': 'otRateHoliday',
};

function getOtMultiplier(dayType) {
  const key = RATE_KEYS[dayType];
  if (!key) throw new AppError('Loại ngày tăng ca không hợp lệ.', 400);
  return Number(env.business[key]);
}

function parseTime(value, label) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(String(value || ''));
  if (!match) throw new AppError(`${label} không hợp lệ.`, 400);
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Giờ kết thúc nhỏ hơn giờ bắt đầu được hiểu là tăng ca qua sang ngày hôm sau. */
function calculateOtHours(startTime, endTime) {
  const start = parseTime(startTime, 'Giờ bắt đầu');
  const end = parseTime(endTime, 'Giờ kết thúc');
  if (end === start) throw new AppError('Giờ kết thúc phải sau giờ bắt đầu.', 400);
  const minutes = end > start ? end - start : end + 24 * 60 - start;
  return Math.round((minutes / 60) * 100) / 100;
}

function calculateOtPay(hours, dayType, hourlySalary) {
  return roundMoney(Number(hours || 0) * getOtMultiplier(dayType) * Number(hourlySalary || 0));
}

module.exports = {
  OT_DAY_TYPES,
  getOtMultiplier,
  calculateOtHours,
  calculateOtPay,
};
