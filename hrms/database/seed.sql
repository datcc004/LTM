-- ============================================================
-- KIDS PARK HRMS - DỮ LIỆU MẪU
-- 4 tài khoản: admin / hr / manager / employee  (mật khẩu: 123456)
-- 20 nhân viên NV0001..NV0020, phòng ban, chức vụ, hợp đồng,
-- ca làm việc, lịch ca, chấm công tháng 10/2026, phép, OT,
-- cấu trúc lương, 2 kỳ lương, phiếu lương, ngày lễ, cấu hình,
-- tài liệu và audit log mẫu.
-- Băm bcrypt: $2b$10$0S8clpgaBhNOACxHKiYjx.g.aV.9BKOkK51cAqpqjENYusUb92gFG
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DELETE FROM audit_logs;
DELETE FROM payroll_items;
DELETE FROM payrolls;
DELETE FROM payroll_periods;
DELETE FROM documents;
DELETE FROM company_settings;
DELETE FROM holidays;
DELETE FROM salary_structures;
DELETE FROM overtime_requests;
DELETE FROM leave_requests;
DELETE FROM leave_balances;
DELETE FROM leave_types;
DELETE FROM attendance;
DELETE FROM shift_schedules;
DELETE FROM shifts;
DELETE FROM contracts;
DELETE FROM users;
DELETE FROM employees;
DELETE FROM positions;
DELETE FROM departments;
DELETE FROM roles;

SET FOREIGN_KEY_CHECKS = 1;

-- ------------------------------------------------------------
-- Vai trò
-- ------------------------------------------------------------
INSERT INTO roles (id, name, description) VALUES
  (1, 'ADMIN',    'Toàn quyền hệ thống: tài khoản, phân quyền, cấu hình, audit log'),
  (2, 'HR',       'Quản lý hồ sơ, hợp đồng, chấm công, lương, báo cáo'),
  (3, 'MANAGER',  'Xem nhân sự phòng ban; duyệt đơn nghỉ phép và tăng ca cấp dưới'),
  (4, 'EMPLOYEE', 'Cổng nhân viên: hồ sơ, phiếu lương, chấm công, nộp đơn');

-- ------------------------------------------------------------
-- Phòng ban / Chức vụ
-- ------------------------------------------------------------
INSERT INTO departments (id, code, name, parent_id, manager_id, is_active) VALUES
  (1, 'HR',    'Phòng Nhân sự',   NULL, NULL, 1),
  (2, 'ACC',   'Phòng Kế toán',   NULL, NULL, 1),
  (3, 'IT',    'Phòng Kỹ thuật',  NULL, NULL, 1),
  (4, 'SALES', 'Phòng Kinh doanh', NULL, NULL, 1),
  (5, 'OPS',   'Phòng Vận hành',  NULL, NULL, 1);

INSERT INTO positions (id, code, name, department_id, is_active) VALUES
  (1, 'TRUONG_PHONG', 'Trưởng phòng',    NULL, 1),
  (2, 'PHO_PHONG',    'Phó phòng',       NULL, 1),
  (3, 'TRUONG_NHOM',  'Trưởng nhóm',     NULL, 1),
  (4, 'NHAN_VIEN',    'Nhân viên',       NULL, 1),
  (5, 'THUC_TAP',     'Thực tập sinh',   NULL, 1);

-- ------------------------------------------------------------
-- 20 nhân viên (user_id và manager_id cập nhật sau)
-- ------------------------------------------------------------
INSERT INTO employees
  (id, employee_code, full_name, gender, date_of_birth, phone, email, address,
   id_card, department_id, position_id, hire_date, status) VALUES
  (1,  'NV0001', 'Trần Văn Hùng',   'Nam', '1985-03-12', '0912345001', 'nv0001@kidspark.vn', 'Quận 1, TP. Hồ Chí Minh', '07920000001', 3, 1, '2018-01-15', 'Đang làm việc'),
  (2,  'NV0002', 'Lê Thị Lan',      'Nữ',  '1988-07-20', '0912345002', 'nv0002@kidspark.vn', 'Quận 2, TP. Hồ Chí Minh', '07920000002', 1, 1, '2019-04-01', 'Đang làm việc'),
  (3,  'NV0003', 'Nguyễn Văn Minh', 'Nam', '1990-11-05', '0912345003', 'nv0003@kidspark.vn', 'Quận 3, TP. Hồ Chí Minh', '07920000003', 4, 1, '2020-02-10', 'Đang làm việc'),
  (4,  'NV0004', 'Phạm Thị Hoa',    'Nữ',  '1992-09-14', '0912345004', 'nv0004@kidspark.vn', 'Quận 4, TP. Hồ Chí Minh', '07920000004', 2, 4, '2021-06-01', 'Đang làm việc'),
  (5,  'NV0005', 'Hoàng Văn Đức',   'Nam', '1994-02-28', '0912345005', 'nv0005@kidspark.vn', 'Quận 5, TP. Hồ Chí Minh', '07920000005', 3, 4, '2022-03-15', 'Đang làm việc'),
  (6,  'NV0006', 'Ngô Thị Kim',     'Nữ',  '1993-05-17', '0912345006', 'nv0006@kidspark.vn', 'Quận 6, TP. Hồ Chí Minh', '07920000006', 1, 4, '2022-07-01', 'Đang làm việc'),
  (7,  'NV0007', 'Đặng Văn Thành',  'Nam', '1996-08-30', '0912345007', 'nv0007@kidspark.vn', 'Quận 7, TP. Hồ Chí Minh', '07920000007', 5, 4, '2023-01-10', 'Đang làm việc'),
  (8,  'NV0008', 'Bùi Thị Thu',     'Nữ',  '1995-12-02', '0912345008', 'nv0008@kidspark.vn', 'Quận 8, TP. Hồ Chí Minh', '07920000008', 4, 4, '2023-03-20', 'Đang làm việc'),
  (9,  'NV0009', 'Vũ Văn Long',     'Nam', '1997-04-11', '0912345009', 'nv0009@kidspark.vn', 'Quận 9, TP. Hồ Chí Minh', '07920000009', 3, 3, '2023-05-15', 'Đang làm việc'),
  (10, 'NV0010', 'Đỗ Thị Mai',      'Nữ',  '1999-01-25', '0912345010', 'nv0010@kidspark.vn', 'Quận 10, TP. Hồ Chí Minh', '07920000010', 2, 4, '2023-08-01', 'Đang làm việc'),
  (11, 'NV0011', 'Nguyễn Văn Cường','Nam', '1991-06-19', '0912345011', 'nv0011@kidspark.vn', 'Quận 11, TP. Hồ Chí Minh', '07920000011', 5, 3, '2020-09-01', 'Đang làm việc'),
  (12, 'NV0012', 'Trần Thị Ngọc',   'Nữ',  '1998-10-08', '0912345012', 'nv0012@kidspark.vn', 'Quận 12, TP. Hồ Chí Minh', '07920000012', 1, 4, '2024-02-01', 'Đang làm việc'),
  (13, 'NV0013', 'Lý Văn Tùng',     'Nam', '1996-03-22', '0912345013', 'nv0013@kidspark.vn', 'Thủ Đức, TP. Hồ Chí Minh', '07920000013', 4, 4, '2024-04-15', 'Đang làm việc'),
  (14, 'NV0014', 'Nguyễn Thị Yến',  'Nữ',  '2000-07-09', '0912345014', 'nv0014@kidspark.vn', 'Bình Dương', '07920000014', 3, 5, '2025-01-06', 'Đang làm việc'),
  (15, 'NV0015', 'Cao Văn Bình',    'Nam', '1989-09-30', '0912345015', 'nv0015@kidspark.vn', 'Quận 1, TP. Hồ Chí Minh', '07920000015', 2, 2, '2019-11-01', 'Đang làm việc'),
  (16, 'NV0016', 'Dương Thị Hạnh',  'Nữ',  '1994-11-13', '0912345016', 'nv0016@kidspark.vn', 'Quận 3, TP. Hồ Chí Minh', '07920000016', 1, 3, '2021-10-01', 'Đang làm việc'),
  (17, 'NV0017', 'Phan Văn Hải',    'Nam', '1997-02-06', '0912345017', 'nv0017@kidspark.vn', 'Quận 7, TP. Hồ Chí Minh', '07920000017', 5, 4, '2024-06-01', 'Đang làm việc'),
  (18, 'NV0018', 'Lê Thị Phương',   'Nữ',  '1999-05-21', '0912345018', 'nv0018@kidspark.vn', 'Quận 2, TP. Hồ Chí Minh', '07920000018', 4, 4, '2024-09-16', 'Đang làm việc'),
  (19, 'NV0019', 'Trịnh Văn Khoa',  'Nam', '2001-08-14', '0912345019', 'nv0019@kidspark.vn', 'Thủ Đức, TP. Hồ Chí Minh', '07920000019', 3, 5, '2025-03-03', 'Đang làm việc'),
  (20, 'NV0020', 'Võ Thị Quỳnh',    'Nữ',  '1993-12-27', '0912345020', 'nv0020@kidspark.vn', 'Quận 5, TP. Hồ Chí Minh', '07920000020', 2, 4, '2022-11-07', 'Đang làm việc');

-- ------------------------------------------------------------
-- 4 tài khoản đăng nhập
-- ------------------------------------------------------------
INSERT INTO users (id, username, email, password_hash, role_id, employee_id, is_active) VALUES
  (1, 'admin',    'admin@kidspark.vn',    '$2b$10$0S8clpgaBhNOACxHKiYjx.g.aV.9BKOkK51cAqpqjENYusUb92gFG', 1, 1, 1),
  (2, 'hr',       'hr@kidspark.vn',       '$2b$10$0S8clpgaBhNOACxHKiYjx.g.aV.9BKOkK51cAqpqjENYusUb92gFG', 2, 2, 1),
  (3, 'manager',  'manager@kidspark.vn',  '$2b$10$0S8clpgaBhNOACxHKiYjx.g.aV.9BKOkK51cAqpqjENYusUb92gFG', 3, 3, 1),
  (4, 'employee', 'employee@kidspark.vn', '$2b$10$0S8clpgaBhNOACxHKiYjx.g.aV.9BKOkK51cAqpqjENYusUb92gFG', 4, 4, 1);

UPDATE employees e JOIN users u ON u.employee_id = e.id SET e.user_id = u.id;

UPDATE departments SET manager_id = 2  WHERE id = 1;
UPDATE departments SET manager_id = 15 WHERE id = 2;
UPDATE departments SET manager_id = 1  WHERE id = 3;
UPDATE departments SET manager_id = 3  WHERE id = 4;
UPDATE departments SET manager_id = 11 WHERE id = 5;

UPDATE employees e JOIN departments d ON e.department_id = d.id
  SET e.manager_id = d.manager_id
  WHERE e.id <> d.manager_id AND d.manager_id IS NOT NULL;

-- ------------------------------------------------------------
-- Hợp đồng (NV0005, NV0013 sắp hết hạn để demo huy hiệu cảnh báo)
-- ------------------------------------------------------------
INSERT INTO contracts
  (employee_id, contract_no, contract_type, start_date, end_date, signed_date, salary_base, status, note)
SELECT
  e.id,
  CONCAT('HD-', YEAR(e.hire_date), '-', LPAD(e.id, 4, '0')),
  CASE WHEN e.position_id = 5 THEN 'Thử việc' ELSE 'Chính thức' END,
  e.hire_date,
  CASE e.id
    WHEN 5  THEN '2026-12-10'
    WHEN 13 THEN '2026-11-30'
    ELSE DATE_ADD(e.hire_date, INTERVAL 3 YEAR)
  END,
  e.hire_date,
  CASE e.position_id
    WHEN 1 THEN 25000000.00
    WHEN 2 THEN 20000000.00
    WHEN 3 THEN 16000000.00
    WHEN 4 THEN 12000000.00
    ELSE 8000000.00
  END,
  CASE WHEN e.id IN (5, 13) THEN 'Sắp hết hạn' ELSE 'Còn hạn' END,
  CASE WHEN e.id IN (5, 13) THEN 'Cần gia hạn hợp đồng trong 30 ngày tới' ELSE NULL END
FROM employees e;

-- ------------------------------------------------------------
-- Ca làm việc
-- ------------------------------------------------------------
INSERT INTO shifts (id, code, name, start_time, end_time, break_minutes, work_hours, late_tolerance_minutes, early_tolerance_minutes, is_overnight, color, is_active) VALUES
  (1, 'CA_A',  'Ca sáng',       '08:00:00', '17:00:00', 60, 8.00, 15, 15, 0, '#2563eb', 1),
  (2, 'CA_C',  'Ca chiều',      '13:00:00', '22:00:00', 60, 8.00, 15, 15, 0, '#f59e0b', 1),
  (3, 'CA_T',  'Ca tối',        '22:00:00', '06:00:00', 60, 8.00, 15, 15, 1, '#7c3aed', 1),
  (4, 'CA_AC', 'Ca sáng - cuối tuần', '08:00:00', '17:00:00', 60, 8.00, 15, 15, 0, '#0d9488', 1),
  (5, 'CA_AT', 'Ca tối - cuối tuần',  '22:00:00', '06:00:00', 60, 8.00, 15, 15, 1, '#db2777', 1);

-- ------------------------------------------------------------
-- Lịch ca tháng 10/2026 (Ngày 2..6 = Thứ Hai..Thứ Sáu)
-- ------------------------------------------------------------
INSERT INTO shift_schedules (employee_id, shift_id, work_date)
SELECT e.id, MOD(e.id + DAYOFWEEK(d.work_date), 5) + 1, d.work_date
FROM employees e
CROSS JOIN (
  SELECT DATE('2026-10-01') + INTERVAL nums.n DAY AS work_date
  FROM (
    WITH RECURSIVE seq AS (
      SELECT 0 AS n
      UNION ALL SELECT n + 1 FROM seq WHERE n < 30
    )
    SELECT n FROM seq
  ) nums
) d
WHERE DAYOFWEEK(d.work_date) BETWEEN 2 AND 6
  AND d.work_date <> '2026-10-20';

-- ------------------------------------------------------------
-- Chấm công tháng 10/2026
-- bucket 0=Đi trễ, 1=Về sớm, 2=Thiếu giờ, 3=Vắng mặt, 4-9=Đúng giờ (+OT)
-- ------------------------------------------------------------
INSERT INTO attendance
  (employee_id, schedule_id, shift_id, work_date, check_in, check_out,
   status, late_minutes, early_minutes, worked_minutes, overtime_minutes,
   source, is_approved, approved_by)
SELECT
  e.id,
  ss.id,
  ss.shift_id,
  d.work_date,
  CASE WHEN MOD(e.id + DAY(d.work_date), 10) = 3 THEN NULL
       ELSE TIMESTAMP(d.work_date, '08:00:00')
            + INTERVAL (CASE MOD(e.id + DAY(d.work_date), 10) WHEN 0 THEN 22 ELSE 0 END) MINUTE
  END,
  CASE WHEN MOD(e.id + DAY(d.work_date), 10) = 3 THEN NULL
       ELSE TIMESTAMP(d.work_date, '17:00:00')
            - INTERVAL (CASE MOD(e.id + DAY(d.work_date), 10) WHEN 1 THEN 30 WHEN 2 THEN 90 ELSE 0 END) MINUTE
            + INTERVAL (CASE WHEN MOD(e.id + DAY(d.work_date), 10) >= 4 THEN MOD(e.id, 3) * 15 ELSE 0 END) MINUTE
  END,
  CASE MOD(e.id + DAY(d.work_date), 10)
    WHEN 0 THEN 'Đi trễ' WHEN 1 THEN 'Về sớm' WHEN 2 THEN 'Thiếu giờ'
    WHEN 3 THEN 'Vắng mặt' ELSE 'Đúng giờ'
  END,
  CASE MOD(e.id + DAY(d.work_date), 10) WHEN 0 THEN 22 ELSE 0 END,
  CASE MOD(e.id + DAY(d.work_date), 10) WHEN 1 THEN 30 WHEN 2 THEN 90 ELSE 0 END,
  CASE WHEN MOD(e.id + DAY(d.work_date), 10) = 3 THEN 0
       ELSE TIMESTAMPDIFF(
              MINUTE,
              TIMESTAMP(d.work_date, '08:00:00')
                + INTERVAL (CASE MOD(e.id + DAY(d.work_date), 10) WHEN 0 THEN 22 ELSE 0 END) MINUTE,
              TIMESTAMP(d.work_date, '17:00:00')
                - INTERVAL (CASE MOD(e.id + DAY(d.work_date), 10) WHEN 1 THEN 30 WHEN 2 THEN 90 ELSE 0 END) MINUTE
                + INTERVAL (CASE WHEN MOD(e.id + DAY(d.work_date), 10) >= 4 THEN MOD(e.id, 3) * 15 ELSE 0 END) MINUTE
            ) - 60
  END,
  CASE WHEN MOD(e.id + DAY(d.work_date), 10) >= 4 THEN MOD(e.id, 3) * 15 ELSE 0 END,
  CASE WHEN MOD(e.id, 2) = 0 THEN 'Camera' ELSE 'Self-service' END,
  CASE WHEN MOD(e.id + DAY(d.work_date), 10) IN (0, 1, 2, 3) THEN 0 ELSE 1 END,
  CASE WHEN MOD(e.id + DAY(d.work_date), 10) IN (0, 1, 2, 3) THEN NULL ELSE e.manager_id END
FROM employees e
CROSS JOIN (
  SELECT DATE('2026-10-01') + INTERVAL nums.n DAY AS work_date
  FROM (
    WITH RECURSIVE seq AS (
      SELECT 0 AS n
      UNION ALL SELECT n + 1 FROM seq WHERE n < 30
    )
    SELECT n FROM seq
  ) nums
) d
LEFT JOIN shift_schedules ss ON ss.employee_id = e.id AND ss.work_date = d.work_date
WHERE DAYOFWEEK(d.work_date) BETWEEN 2 AND 6
  AND d.work_date <> '2026-10-20';

-- ------------------------------------------------------------
-- Loại phép & quỹ phép năm 2026
-- ------------------------------------------------------------
INSERT INTO leave_types (id, code, name, is_paid, max_days_per_year, requires_approval, is_active, color) VALUES
  (1, 'PHEP_NAM',          'Phép năm',        1, 12.00, 1, 1, '#2563eb'),
  (2, 'PHEP_BENH',         'Ốm đau / thai sản',1, 30.00, 1, 1, '#0d9488'),
  (3, 'NGHI_VIEC_RIENG',   'Nghỉ việc riêng',  0,  3.00, 1, 1, '#f59e0b'),
  (4, 'NGHI_KHONG_LUONG',  'Nghỉ không lương', 0,  NULL, 1, 1, '#dc2626');

INSERT INTO leave_balances (employee_id, leave_type_id, year, opening_days, accrued_days, used_days)
SELECT e.id, lt.id, 2026,
       CASE lt.id WHEN 1 THEN 12.00 WHEN 2 THEN 30.00 ELSE 3.00 END,
       0.00,
       CASE WHEN lt.id = 1 THEN MOD(e.id, 6) * 0.5 ELSE 0.00 END
FROM employees e
CROSS JOIN leave_types lt
WHERE lt.id IN (1, 3);

-- ------------------------------------------------------------
-- Đơn nghỉ phép mẫu
-- ------------------------------------------------------------
INSERT INTO leave_requests
  (id, employee_id, leave_type_id, start_date, end_date, total_days, reason,
   status, approved_by, approved_at, approval_note) VALUES
  (1, 6,  1, '2026-11-02', '2026-11-03', 2.00, 'Việc gia đình',            'Chờ duyệt', NULL, NULL, NULL),
  (2, 8,  1, '2026-11-05', '2026-11-05', 1.00, 'Khám sức khỏe định kỳ',     'Chờ duyệt', NULL, NULL, NULL),
  (3, 12, 1, '2026-10-19', '2026-10-20', 2.00, 'Nghỉ phép năm',            'Đã duyệt',  2, '2026-10-15 09:20:00', 'Đồng ý'),
  (4, 17, 3, '2026-10-22', '2026-10-22', 1.00, 'Nghỉ việc riêng',          'Đã duyệt',  11, '2026-10-20 14:05:00', 'Đồng ý'),
  (5, 19, 1, '2026-10-26', '2026-10-28', 3.00, 'Du lịch',                  'Từ chối',   3, '2026-10-24 10:30:00', 'Quỹ phép không đủ'),
  (6, 10, 2, '2026-11-10', '2026-11-11', 2.00, 'Ốm, có giấy khám bệnh',    'Chờ duyệt', NULL, NULL, NULL);

-- ------------------------------------------------------------
-- Quỹ phép đã dùng (khớp các đơn đã duyệt)
-- ------------------------------------------------------------
UPDATE leave_balances SET used_days = used_days + 2.00 WHERE employee_id = 12 AND leave_type_id = 1;
UPDATE leave_balances SET used_days = used_days + 1.00 WHERE employee_id = 17 AND leave_type_id = 3;

-- ------------------------------------------------------------
-- Đơn tăng ca mẫu (hệ số 1.5 / 2.0 / 3.0)
-- ------------------------------------------------------------
INSERT INTO overtime_requests
  (id, employee_id, work_date, start_time, end_time, total_hours, day_type,
   rate_multiplier, reason, status, approved_by, approved_at, approval_note) VALUES
  (1, 5,  '2026-10-09', '17:00:00', '20:00:00', 3.00, 'Ngày thường', 1.50, 'Hoàn thành báo cáo',        'Đã duyệt',  1, '2026-10-09 16:30:00', 'Đồng ý'),
  (2, 9,  '2026-10-10', '17:00:00', '21:00:00', 4.00, 'Ngày thường', 1.50, 'Triển khai phiên bản mới',  'Đã duyệt',  1, '2026-10-10 15:10:00', 'Đồng ý'),
  (3, 13, '2026-10-17', '08:00:00', '12:00:00', 4.00, 'Cuối tuần',   2.00, 'Hỗ trợ sự kiện',            'Đã duyệt',  3, '2026-10-16 11:00:00', 'Đồng ý'),
  (4, 16, '2026-10-20', '08:00:00', '17:00:00', 8.00, 'Ngày lễ',     3.00, 'Trực ca lễ',                'Chờ duyệt', NULL, NULL, NULL),
  (5, 7,  '2026-10-24', '13:00:00', '17:00:00', 4.00, 'Cuối tuần',   2.00, 'Dọn dẹp sau sự kiện',      'Từ chối',   11, '2026-10-23 09:00:00', 'Không phát sinh nhu cầu');

-- ------------------------------------------------------------
-- Cấu trúc lương
-- ------------------------------------------------------------
INSERT INTO salary_structures (employee_id, base_salary, allowance, dependents_count, effective_from)
SELECT e.id,
       c.salary_base,
       CASE e.position_id
         WHEN 1 THEN 5000000.00 WHEN 2 THEN 3000000.00 WHEN 3 THEN 2000000.00
         WHEN 4 THEN 1000000.00 ELSE 500000.00
       END,
       MOD(e.id, 3),
       e.hire_date
FROM employees e
JOIN contracts c ON c.employee_id = e.id;

-- ------------------------------------------------------------
-- Kỳ lương
-- ------------------------------------------------------------
INSERT INTO payroll_periods (id, period_code, month, year, start_date, end_date, status, locked_at, locked_by) VALUES
  (1, '2026-09', 9, 2026, '2026-09-01', '2026-09-30', 'Đã chốt', '2026-10-05 10:00:00', 1),
  (2, '2026-10', 10, 2026, '2026-10-01', '2026-10-31', 'Dự thảo', NULL, NULL);

-- ------------------------------------------------------------
-- Phiếu lương 2 kỳ × 20 nhân viên
-- ------------------------------------------------------------
INSERT INTO payrolls
  (period_id, employee_id, base_salary, allowance, bonus, overtime_pay,
   deduction, working_days, status)
SELECT p.id, e.id,
       s.base_salary,
       s.allowance,
       CASE WHEN MOD(e.id + p.id, 4) = 0 THEN 1000000.00 ELSE 0.00 END,
       CASE WHEN MOD(e.id + p.id, 3) = 0 THEN  500000.00 ELSE 0.00 END,
       CASE WHEN MOD(e.id, 7) = 0 THEN 300000.00 ELSE 0.00 END,
       22.00,
       p.status
FROM payroll_periods p
CROSS JOIN employees e
JOIN salary_structures s ON s.employee_id = e.id;

-- Bảo hiểm: nhân viên đóng 10.5% (BHXH 8% + BHYT 1.5% + BHTN 1%)
UPDATE payrolls SET insurance_amount = ROUND(base_salary * 0.105, 0);

-- Thu nhập tính thuế = tổng thu nhập - khấu trừ - BH - giảm trừ 11tr - 4.4tr/người phụ thuộc
UPDATE payrolls p
SET taxable_income = GREATEST(
      0.00,
      p.base_salary + p.allowance + p.bonus + p.overtime_pay
        - p.deduction - p.insurance_amount - 11000000.00
        - (SELECT s.dependents_count FROM salary_structures s WHERE s.employee_id = p.employee_id) * 4400000.00
    );

-- Thuế TNCN theo biểu lũy tiến từng phần
UPDATE payrolls
SET personal_income_tax = ROUND(
      CASE
        WHEN taxable_income <= 11000000.00  THEN taxable_income * 0.05
        WHEN taxable_income <= 20000000.00  THEN taxable_income * 0.10 - 550000.00
        WHEN taxable_income <= 30000000.00  THEN taxable_income * 0.15 - 1550000.00
        WHEN taxable_income <= 40000000.00  THEN taxable_income * 0.20 - 3050000.00
        WHEN taxable_income <= 60000000.00  THEN taxable_income * 0.25 - 5050000.00
        WHEN taxable_income <= 80000000.00  THEN taxable_income * 0.30 - 8050000.00
        ELSE taxable_income * 0.35 - 12050000.00
      END, 0);

UPDATE payrolls
SET net_salary = base_salary + allowance + bonus + overtime_pay
                 - deduction - insurance_amount - personal_income_tax;

-- ------------------------------------------------------------
-- Chi tiết phiếu lương
-- ------------------------------------------------------------
INSERT INTO payroll_items (payroll_id, item_type, code, name, amount)
SELECT p.id, x.item_type, x.code, x.name,
  CASE x.code
    WHEN 'LUONG_CO_BAN'  THEN p.base_salary
    WHEN 'PHU_CAP'       THEN p.allowance
    WHEN 'THUONG'        THEN p.bonus
    WHEN 'TIEN_OT'       THEN p.overtime_pay
    WHEN 'KHAU_TRU'      THEN p.deduction
    WHEN 'BAO_HIEM'      THEN p.insurance_amount
    WHEN 'THUE_TNCN'     THEN p.personal_income_tax
    ELSE 0.00
  END
FROM payrolls p
CROSS JOIN (
  SELECT 'Thu nhập' AS item_type, 'LUONG_CO_BAN' AS code, 'Lương cơ bản' AS name
  UNION ALL SELECT 'Thu nhập', 'PHU_CAP',    'Phụ cấp'
  UNION ALL SELECT 'Thu nhập', 'THUONG',     'Thưởng'
  UNION ALL SELECT 'Thu nhập', 'TIEN_OT',    'Tiền tăng ca'
  UNION ALL SELECT 'Khấu trừ', 'KHAU_TRU',   'Khấu trừ khác'
  UNION ALL SELECT 'Bảo hiểm', 'BAO_HIEM',   'BHXH 8% + BHYT 1.5% + BHTN 1%'
  UNION ALL SELECT 'Thuế',     'THUE_TNCN',  'Thuế TNCN'
) x;

-- ------------------------------------------------------------
-- Ngày lễ 2026
-- ------------------------------------------------------------
INSERT INTO holidays (name, holiday_date, is_recurring, note) VALUES
  ('Tết Dương lịch',        '2026-01-01', 1, 'Nghỉ theo quy định'),
  ('Tết Âm lịch Bính Ngọ',  '2026-02-16', 0, 'Mùng 1 Tết'),
  ('Tết Âm lịch Bính Ngọ',  '2026-02-17', 0, 'Mùng 2 Tết'),
  ('Tết Âm lịch Bính Ngọ',  '2026-02-18', 0, 'Mùng 3 Tết'),
  ('Ngày Quốc tế Phụ nữ',   '2026-03-08', 1, 'Nghỉ nếu trùng ngày làm việc'),
  ('Ngày Giải phóng miền Nam','2026-04-30', 1, 'Nghỉ theo quy định'),
  ('Ngày Lao động',          '2026-05-01', 1, 'Nghỉ theo quy định'),
  ('Ngày Quốc khánh',        '2026-09-02', 1, 'Nghỉ theo quy định'),
  ('Ngày Phụ nữ Việt Nam',   '2026-10-20', 1, 'Nghỉ nếu trùng ngày làm việc'),
  ('Ngày Nhà giáo Việt Nam', '2026-11-20', 1, 'Nghỉ nếu trùng ngày làm việc'),
  ('Giáng sinh',             '2026-12-25', 1, 'Nghỉ nội bộ');

-- ------------------------------------------------------------
-- Cấu hình công ty
-- ------------------------------------------------------------
INSERT INTO company_settings (setting_key, setting_value, setting_group, description) VALUES
  ('COMPANY_NAME',              'KIDS PARK',                  'GENERAL',  'Tên công ty'),
  ('COMPANY_ADDRESS',           'TP. Hồ Chí Minh, Việt Nam',  'GENERAL',  'Địa chỉ trụ sở'),
  ('COMPANY_PHONE',             '1900 1234',                  'GENERAL',  'Điện thoại liên hệ'),
  ('CONTRACT_ALERT_DAYS',       '30',                         'CONTRACT', 'Số ngày cảnh báo hợp đồng sắp hết hạn'),
  ('STANDARD_WORK_HOURS',       '8',                          'ATTENDANCE','Số giờ công chuẩn mỗi ngày'),
  ('LATE_TOLERANCE_MINUTES',    '15',                         'ATTENDANCE','Miễn trừ đi trễ (phút)'),
  ('EARLY_TOLERANCE_MINUTES',   '15',                         'ATTENDANCE','Miễn trừ về sớm (phút)'),
  ('INSURANCE_RATE',            '0.105',                      'SALARY',   'Tỷ lệ bảo hiểm nhân viên đóng'),
  ('INSURANCE_BHXH_RATE',       '0.08',                       'SALARY',   'BHXH 8%'),
  ('INSURANCE_BHYT_RATE',       '0.015',                      'SALARY',   'BHYT 1.5%'),
  ('INSURANCE_BHTN_RATE',       '0.01',                       'SALARY',   'BHTN 1%'),
  ('PERSONAL_DEDUCTION',        '11000000',                   'SALARY',   'Giảm trừ gia cảnh bản thân/tháng'),
  ('DEPENDENT_DEDUCTION',       '4400000',                    'SALARY',   'Giảm trừ người phụ thuộc/người/tháng'),
  ('OT_RATE_WEEKDAY',           '1.5',                        'SALARY',   'Làm thêm ngày thường 150%'),
  ('OT_RATE_WEEKEND',           '2.0',                        'SALARY',   'Làm thêm cuối tuần 200%'),
  ('OT_RATE_HOLIDAY',           '3.0',                        'SALARY',   'Làm thêm ngày lễ 300%'),
  ('ANNUAL_LEAVE_DAYS',         '12',                         'LEAVE',    'Số ngày phép năm mặc định'),
  ('LEAVE_AUTO_DEDUCT',         '1',                          'LEAVE',    'Tự động trừ quỹ phép khi duyệt đơn'),
  ('PAYROLL_LOCK',              '1',                          'PAYROLL',  'Khóa chấm công khi kỳ lương đã chốt');

-- ------------------------------------------------------------
-- Tài liệu mẫu
-- ------------------------------------------------------------
INSERT INTO documents
  (employee_id, contract_id, doc_type, title, file_name, file_path,
   mime_type, file_size, issued_date, expiry_date, uploaded_by) VALUES
  (1, 1,  'CCCD/CMND', 'CCCD nhân viên', 'cccd_nv0001.pdf',   'uploads/documents/cccd_nv0001.pdf',   'application/pdf', 245760, '2021-05-10', '2031-05-10', 2),
  (1, 1,  'Bằng cấp',  'Bằng Đại học',   'bang_cap_nv0001.pdf','uploads/documents/bang_cap_nv0001.pdf','application/pdf', 189440, '2008-09-01', NULL, 2),
  (2, 2,  'CCCD/CMND', 'CCCD nhân viên', 'cccd_nv0002.pdf',   'uploads/documents/cccd_nv0002.pdf',   'application/pdf', 231424, '2022-02-18', '2032-02-18', 2),
  (5, 5,  'Hợp đồng',  'Hợp đồng lao động', 'hd_nv0005.pdf',  'uploads/documents/hd_nv0005.pdf',      'application/pdf', 302080, '2022-03-15', NULL, 2),
  (13, 13,'Hợp đồng',  'Hợp đồng lao động', 'hd_nv0013.pdf',  'uploads/documents/hd_nv0013.pdf',      'application/pdf', 298000, '2024-04-15', NULL, 2);

-- ------------------------------------------------------------
-- Audit log mẫu
-- ------------------------------------------------------------
INSERT INTO audit_logs
  (user_id, action, table_name, record_id, old_value, new_value, ip_address, user_agent, created_at) VALUES
  (1, 'LOGIN',    'users',     '1',  NULL, '{"username":"admin","result":"success"}',            '127.0.0.1', 'Mozilla/5.0', '2026-11-17 08:05:12'),
  (2, 'UPDATE',   'employees', '12', '{"status":"Đang làm việc"}', '{"status":"Tạm nghỉ"}',       '127.0.0.1', 'Mozilla/5.0', '2026-11-17 08:30:44'),
  (2, 'APPROVE',  'leave_requests', '3', '{"status":"Chờ duyệt"}', '{"status":"Đã duyệt"}',      '127.0.0.1', 'Mozilla/5.0', '2026-10-15 09:20:00'),
  (1, 'UPDATE',   'payroll_periods', '1', '{"status":"Dự thảo"}', '{"status":"Đã chốt"}',         '127.0.0.1', 'Mozilla/5.0', '2026-10-05 10:00:00'),
  (3, 'APPROVE',  'overtime_requests', '3', '{"status":"Chờ duyệt"}', '{"status":"Đã duyệt"}',    '127.0.0.1', 'Mozilla/5.0', '2026-10-16 11:00:00');

SET FOREIGN_KEY_CHECKS = 1;
