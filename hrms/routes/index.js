'use strict';

/** Bảng định tuyến: nhóm public trước, nhóm protected sau RBAC server-side. */

const express = require('express');
const router = express.Router();

const { isAuthenticated } = require('../middlewares/auth');
const { authorize, HR_AND_ABOVE, MANAGER_AND_ABOVE } = require('../middlewares/role');
const { refreshNavigation, loadShellData } = require('../middlewares/shell');
const { jsonSuccess } = require('../utils/helpers');

const authRoutes = require('./auth.routes');
const dashboardRoutes = require('./dashboard.routes');
const accountRoutes = require('./account.routes');
const notificationRoutes = require('./notification.routes');
const searchRoutes = require('./search.routes');
const departmentRoutes = require('./department.routes');
const positionRoutes = require('./position.routes');
const employeeRoutes = require('./employee.routes');
const contractRoutes = require('./contract.routes');
const attendanceRoutes = require('./attendance.routes');
const shiftRoutes = require('./shift.routes');
const scheduleRoutes = require('./schedule.routes');
const leaveRoutes = require('./leave.routes');
const leaveTypeRoutes = require('./leaveType.routes');
const overtimeRoutes = require('./overtime.routes');
const payrollRoutes = require('./payroll.routes');
const salaryStructureRoutes = require('./salaryStructure.routes');
const meRoutes = require('./me.routes');
const reportRoutes = require('./report.routes');
const adminUserRoutes = require('./adminUser.routes');
const adminHolidayRoutes = require('./adminHoliday.routes');
const adminSettingRoutes = require('./adminSetting.routes');
const adminAuditRoutes = require('./adminAudit.routes');

// Kiểm tra sức khỏe & trang chủ
router.get('/health', (req, res) => jsonSuccess(res, {
  ok: true,
  time: new Date().toISOString(),
}, 'Hệ thống hoạt động bình thường'));
router.get('/', (req, res) => res.redirect('/dashboard'));

// ------------------------------------------------------------
// Public
// ------------------------------------------------------------
router.use('/', authRoutes);

// ------------------------------------------------------------
// Protected: xác thực -> menu/badge theo role -> routes nghiệp vụ
// ------------------------------------------------------------
router.use(isAuthenticated, refreshNavigation, loadShellData);
router.use('/', dashboardRoutes);
router.use('/account', accountRoutes);
router.use('/notifications', notificationRoutes);
router.use('/api', searchRoutes);

// Tổ chức & Nhân sự: chỉ ADMIN/HR được thao tác (chặn ở server, không chỉ ẩn menu).
const hrOnly = authorize(HR_AND_ABOVE);
router.use('/departments', hrOnly, departmentRoutes);
router.use('/positions', hrOnly, positionRoutes);
router.use('/employees', hrOnly, employeeRoutes);
router.use('/contracts', hrOnly, contractRoutes);

// Chấm công: ADMIN/HR quản lý ca, phân ca và bản ghi; MANAGER xem/duyệt công trong phòng ban.
router.use('/attendance', authorize(MANAGER_AND_ABOVE), attendanceRoutes);
router.use('/shifts', hrOnly, shiftRoutes);
router.use('/schedules', hrOnly, scheduleRoutes);

// Đơn từ: ADMIN/HR quản lý loại phép và lập đơn; MANAGER xem/duyệt đơn trong phòng ban.
router.use('/leave-requests', authorize(MANAGER_AND_ABOVE), leaveRoutes);
router.use('/overtime-requests', authorize(MANAGER_AND_ABOVE), overtimeRoutes);
router.use('/leave-types', hrOnly, leaveTypeRoutes);

// Tiền lương: ADMIN/HR quản lý cấu trúc lương, kỳ lương và phiếu lương.
router.use('/payroll', hrOnly, payrollRoutes);
router.use('/salary-structures', hrOnly, salaryStructureRoutes);

// Cổng nhân viên: mọi role đăng nhập được, nhưng dữ liệu luôn scope theo chính mình.
router.use('/me', meRoutes);

// Báo cáo: ADMIN/HR/MANAGER.
router.use('/reports', authorize(MANAGER_AND_ABOVE), reportRoutes);

// Quản trị: ADMIN_ONLY.
const adminOnly = authorize('ADMIN');
router.use('/admin/users', adminOnly, adminUserRoutes);
router.use('/admin/holidays', adminOnly, adminHolidayRoutes);
router.use('/admin/settings', adminOnly, adminSettingRoutes);
router.use('/admin/audit-logs', adminOnly, adminAuditRoutes);

module.exports = router;
