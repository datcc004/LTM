'use strict';

/** Cấu hình công ty (ADMIN_ONLY): chỉ sửa setting_value, không đổi key/group. */

const companySettingModel = require('../models/companySetting.model');
const adminService = require('../services/admin.service');
const { audit } = require('../middlewares/audit');
const { asyncHandler, AppError } = require('../utils/helpers');

const VIEW = 'admin/settings/index';

const index = asyncHandler(async (req, res) => {
  const settings = await companySettingModel.listAll();
  return res.render(VIEW, {
    title: 'Cấu hình hệ thống',
    groups: adminService.groupSettings(settings),
  });
});

const update = asyncHandler(async (req, res) => {
  const settingKey = String(req.body.setting_key || '');
  const setting = await companySettingModel.findByKey(settingKey);
  if (!setting) throw new AppError('Không tìm thấy cấu hình.', 404);

  let value;
  try {
    value = adminService.coerceSettingValue(setting, req.body.setting_value);
  } catch (error) {
    req.flash('error', error.message);
    return res.redirect('/admin/settings');
  }

  const after = await companySettingModel.update(settingKey, value, req.user.id);
  await audit('UPDATE', 'company_settings')(req, {
    recordId: setting.id,
    oldValue: { setting_key: settingKey, setting_value: setting.setting_value },
    newValue: { setting_key: settingKey, setting_value: after.setting_value },
  });
  req.flash('success', `Đã cập nhật cấu hình “${setting.description || settingKey}”.`);
  return res.redirect('/admin/settings');
});

module.exports = { index, update };
