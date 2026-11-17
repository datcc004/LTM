-- ============================================================
-- KIDS PARK HRMS - SCHEMA CSDL MySQL 8.0
-- Bảng: roles, users, departments, positions, employees, contracts,
--       shifts, shift_schedules, attendance, overtime_requests,
--       leave_types, leave_balances, leave_requests,
--       salary_structures, payroll_periods, payrolls, payroll_items,
--       holidays, company_settings, documents, audit_logs
-- Quy ước: INT UNSIGNED cho khóa, DECIMAL(15,2) cho tiền,
--          TIMESTAMP cho thời gian hệ thống, utf8mb4_unicode_ci.
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;

-- ------------------------------------------------------------
-- 1. roles
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(30)  NOT NULL COMMENT 'ADMIN|HR|MANAGER|EMPLOYEE',
  description VARCHAR(255) NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 2. departments (manager_id được ràng buộc sau khi có employees)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS departments (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code       VARCHAR(20)  NOT NULL,
  name       VARCHAR(100) NOT NULL,
  parent_id  INT UNSIGNED NULL,
  manager_id INT UNSIGNED NULL,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_departments_code (code),
  KEY idx_departments_parent (parent_id),
  KEY idx_departments_active (is_active),
  CONSTRAINT fk_departments_parent FOREIGN KEY (parent_id)
    REFERENCES departments(id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 3. positions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS positions (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code          VARCHAR(30)  NOT NULL,
  name          VARCHAR(100) NOT NULL,
  department_id INT UNSIGNED NULL,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_positions_code (code),
  KEY idx_positions_department (department_id),
  CONSTRAINT fk_positions_department FOREIGN KEY (department_id)
    REFERENCES departments(id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 4. users (employee_id được ràng buộc sau khi có employees)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username            VARCHAR(50)  NOT NULL,
  email               VARCHAR(120) NOT NULL,
  password_hash       VARCHAR(255) NOT NULL COMMENT 'bcrypt cost 10',
  role_id             INT UNSIGNED NOT NULL,
  employee_id         INT UNSIGNED NULL,
  is_active           TINYINT(1)   NOT NULL DEFAULT 1,
  failed_login_attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until        DATETIME     NULL,
  last_login_at       DATETIME     NULL,
  created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_employee (employee_id),
  KEY idx_users_role (role_id),
  KEY idx_users_active (is_active),
  CONSTRAINT fk_users_role FOREIGN KEY (role_id)
    REFERENCES roles(id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 5. employees
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS employees (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_code VARCHAR(10)  NOT NULL COMMENT 'NV0001 - tu dong tang',
  user_id       INT UNSIGNED NULL,
  full_name     VARCHAR(120) NOT NULL,
  gender        ENUM('Nam','Nữ','Khác') NOT NULL DEFAULT 'Nam',
  date_of_birth DATE         NULL,
  phone         VARCHAR(20)  NULL,
  email         VARCHAR(120) NULL,
  address       VARCHAR(255) NULL,
  id_card       VARCHAR(20)  NULL,
  department_id INT UNSIGNED NOT NULL,
  position_id   INT UNSIGNED NOT NULL,
  manager_id    INT UNSIGNED NULL,
  hire_date     DATE         NOT NULL,
  status        ENUM('Đang làm việc','Tạm nghỉ','Nghỉ việc') NOT NULL DEFAULT 'Đang làm việc',
  avatar_path   VARCHAR(255) NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_employees_code (employee_code),
  UNIQUE KEY uq_employees_user (user_id),
  UNIQUE KEY uq_employees_id_card (id_card),
  KEY idx_employees_department (department_id),
  KEY idx_employees_position (position_id),
  KEY idx_employees_manager (manager_id),
  KEY idx_employees_status (status),
  KEY idx_employees_name (full_name),
  CONSTRAINT fk_employees_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_employees_department FOREIGN KEY (department_id)
    REFERENCES departments(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_employees_position FOREIGN KEY (position_id)
    REFERENCES positions(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_employees_manager FOREIGN KEY (manager_id)
    REFERENCES employees(id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ràng buộc vòng tròn users <-> employees
ALTER TABLE users
  ADD CONSTRAINT fk_users_employee FOREIGN KEY (employee_id)
    REFERENCES employees(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE departments
  ADD CONSTRAINT fk_departments_manager FOREIGN KEY (manager_id)
    REFERENCES employees(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- ------------------------------------------------------------
-- 6. contracts
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contracts (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id   INT UNSIGNED NOT NULL,
  contract_no   VARCHAR(30)  NOT NULL,
  contract_type ENUM('Thử việc','Chính thức','Thời vụ','Hợp đồng dịch vụ') NOT NULL DEFAULT 'Chính thức',
  start_date    DATE         NOT NULL,
  end_date      DATE         NULL,
  signed_date   DATE         NULL,
  salary_base   DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  status        ENUM('Còn hạn','Sắp hết hạn','Hết hạn','Đã hủy') NOT NULL DEFAULT 'Còn hạn',
  document_path VARCHAR(255) NULL,
  note          VARCHAR(500) NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_contracts_no (contract_no),
  KEY idx_contracts_employee (employee_id),
  KEY idx_contracts_end_date (end_date),
  KEY idx_contracts_status (status),
  CONSTRAINT fk_contracts_employee FOREIGN KEY (employee_id)
    REFERENCES employees(id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 7. shifts
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shifts (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code          VARCHAR(20)  NOT NULL,
  name          VARCHAR(100) NOT NULL,
  start_time    TIME         NOT NULL,
  end_time      TIME         NOT NULL,
  break_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 60,
  work_hours    DECIMAL(4,2) NOT NULL DEFAULT 8.00,
  late_tolerance_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 15,
  early_tolerance_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 15,
  is_overnight  TINYINT(1)   NOT NULL DEFAULT 0,
  color         VARCHAR(20)  NULL,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_shifts_code (code),
  KEY idx_shifts_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 8. shift_schedules
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shift_schedules (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id INT UNSIGNED NOT NULL,
  shift_id    INT UNSIGNED NOT NULL,
  work_date   DATE         NOT NULL,
  note        VARCHAR(255) NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_schedule_employee_date (employee_id, work_date),
  KEY idx_schedule_date (work_date),
  KEY idx_schedule_shift (shift_id),
  CONSTRAINT fk_schedule_employee FOREIGN KEY (employee_id)
    REFERENCES employees(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_schedule_shift FOREIGN KEY (shift_id)
    REFERENCES shifts(id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 9. attendance
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id     INT UNSIGNED NOT NULL,
  schedule_id     INT UNSIGNED NULL,
  shift_id        INT UNSIGNED NULL,
  work_date       DATE         NOT NULL,
  check_in        DATETIME     NULL,
  check_out       DATETIME     NULL,
  status          ENUM('Đúng giờ','Đi trễ','Về sớm','Thiếu giờ','Vắng mặt') NOT NULL DEFAULT 'Vắng mặt',
  late_minutes    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  early_minutes   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  worked_minutes  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  overtime_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  source          ENUM('Camera','Thủ công','Self-service') NOT NULL DEFAULT 'Camera',
  is_approved     TINYINT(1)   NOT NULL DEFAULT 0,
  approved_by     INT UNSIGNED NULL,
  note            VARCHAR(255) NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_attendance_employee_date (employee_id, work_date),
  KEY idx_attendance_date (work_date),
  KEY idx_attendance_status (status),
  KEY idx_attendance_employee_date (employee_id, work_date),
  KEY idx_attendance_approved (is_approved),
  CONSTRAINT fk_attendance_employee FOREIGN KEY (employee_id)
    REFERENCES employees(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_attendance_schedule FOREIGN KEY (schedule_id)
    REFERENCES shift_schedules(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_attendance_shift FOREIGN KEY (shift_id)
    REFERENCES shifts(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_attendance_approver FOREIGN KEY (approved_by)
    REFERENCES employees(id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 10. leave_types
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leave_types (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code              VARCHAR(30)  NOT NULL,
  name              VARCHAR(100) NOT NULL,
  is_paid           TINYINT(1)   NOT NULL DEFAULT 1,
  max_days_per_year DECIMAL(5,2) NULL,
  requires_approval TINYINT(1)   NOT NULL DEFAULT 1,
  is_active         TINYINT(1)   NOT NULL DEFAULT 1,
  color             VARCHAR(20)  NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_leave_types_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 11. leave_balances
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leave_balances (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id    INT UNSIGNED NOT NULL,
  leave_type_id  INT UNSIGNED NOT NULL,
  year           YEAR         NOT NULL,
  opening_days   DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  accrued_days   DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  used_days      DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  remaining_days DECIMAL(5,2) GENERATED ALWAYS AS (opening_days + accrued_days - used_days) STORED,
  updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_leave_balance (employee_id, leave_type_id, year),
  KEY idx_leave_balance_employee (employee_id),
  KEY idx_leave_balance_year (year),
  CONSTRAINT fk_leave_balance_employee FOREIGN KEY (employee_id)
    REFERENCES employees(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_leave_balance_type FOREIGN KEY (leave_type_id)
    REFERENCES leave_types(id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 12. leave_requests
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leave_requests (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id    INT UNSIGNED NOT NULL,
  leave_type_id  INT UNSIGNED NOT NULL,
  start_date     DATE         NOT NULL,
  end_date       DATE         NOT NULL,
  total_days     DECIMAL(5,2) NOT NULL,
  reason         TEXT         NULL,
  status         ENUM('Chờ duyệt','Đã duyệt','Từ chối') NOT NULL DEFAULT 'Chờ duyệt',
  approved_by    INT UNSIGNED NULL,
  approved_at    DATETIME     NULL,
  approval_note  VARCHAR(500) NULL,
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_leave_request_employee (employee_id),
  KEY idx_leave_request_type (leave_type_id),
  KEY idx_leave_request_status (status),
  KEY idx_leave_request_dates (start_date, end_date),
  CONSTRAINT fk_leave_request_employee FOREIGN KEY (employee_id)
    REFERENCES employees(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_leave_request_type FOREIGN KEY (leave_type_id)
    REFERENCES leave_types(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_leave_request_approver FOREIGN KEY (approved_by)
    REFERENCES employees(id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 13. overtime_requests
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS overtime_requests (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id    INT UNSIGNED NOT NULL,
  work_date      DATE         NOT NULL,
  start_time     TIME         NOT NULL,
  end_time       TIME         NOT NULL,
  total_hours    DECIMAL(5,2) NOT NULL,
  day_type       ENUM('Ngày thường','Cuối tuần','Ngày lễ') NOT NULL DEFAULT 'Ngày thường',
  rate_multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.50 COMMENT '1.5 / 2.0 / 3.0',
  reason         TEXT         NULL,
  status         ENUM('Chờ duyệt','Đã duyệt','Từ chối') NOT NULL DEFAULT 'Chờ duyệt',
  approved_by    INT UNSIGNED NULL,
  approved_at    DATETIME     NULL,
  approval_note  VARCHAR(500) NULL,
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ot_employee (employee_id),
  KEY idx_ot_date (work_date),
  KEY idx_ot_status (status),
  CONSTRAINT fk_ot_employee FOREIGN KEY (employee_id)
    REFERENCES employees(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_ot_approver FOREIGN KEY (approved_by)
    REFERENCES employees(id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 14. salary_structures
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS salary_structures (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id      INT UNSIGNED NOT NULL,
  base_salary      DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  allowance        DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  dependents_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  effective_from   DATE         NOT NULL,
  note             VARCHAR(255) NULL,
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_salary_employee (employee_id),
  KEY idx_salary_effective (effective_from),
  CONSTRAINT fk_salary_employee FOREIGN KEY (employee_id)
    REFERENCES employees(id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 15. payroll_periods
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payroll_periods (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  period_code VARCHAR(20)  NOT NULL COMMENT 'YYYY-MM',
  month       TINYINT UNSIGNED NOT NULL,
  year        YEAR         NOT NULL,
  start_date  DATE         NOT NULL,
  end_date    DATE         NOT NULL,
  status      ENUM('Dự thảo','Đã chốt') NOT NULL DEFAULT 'Dự thảo',
  locked_at   DATETIME     NULL,
  locked_by   INT UNSIGNED NULL,
  note        VARCHAR(500) NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payroll_period_code (period_code),
  KEY idx_period_status (status),
  CONSTRAINT fk_period_locked_by FOREIGN KEY (locked_by)
    REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 16. payrolls
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payrolls (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  period_id         INT UNSIGNED NOT NULL,
  employee_id       INT UNSIGNED NOT NULL,
  base_salary       DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  allowance         DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  bonus             DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  overtime_pay      DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  deduction         DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  insurance_amount  DECIMAL(15,2) NOT NULL DEFAULT 0.00 COMMENT 'NV đóng 10.5%',
  taxable_income    DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  personal_income_tax DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  net_salary        DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  working_days      DECIMAL(5,2) NOT NULL DEFAULT 22.00,
  status            ENUM('Dự thảo','Đã chốt') NOT NULL DEFAULT 'Dự thảo',
  note              VARCHAR(500) NULL,
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payroll_period_employee (period_id, employee_id),
  KEY idx_payroll_employee (employee_id),
  KEY idx_payroll_status (status),
  CONSTRAINT fk_payroll_period FOREIGN KEY (period_id)
    REFERENCES payroll_periods(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_payroll_employee FOREIGN KEY (employee_id)
    REFERENCES employees(id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 17. payroll_items
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payroll_items (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  payroll_id INT UNSIGNED NOT NULL,
  item_type  ENUM('Thu nhập','Khấu trừ','Bảo hiểm','Thuế') NOT NULL,
  code       VARCHAR(30)  NOT NULL,
  name       VARCHAR(100) NOT NULL,
  amount     DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  note       VARCHAR(255) NULL,
  PRIMARY KEY (id),
  KEY idx_payroll_item_payroll (payroll_id),
  KEY idx_payroll_item_code (code),
  CONSTRAINT fk_payroll_item_payroll FOREIGN KEY (payroll_id)
    REFERENCES payrolls(id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 18. holidays
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS holidays (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name         VARCHAR(150) NOT NULL,
  holiday_date DATE         NOT NULL,
  is_recurring TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '1 = lặp hằng năm',
  note         VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_holidays_date (holiday_date),
  KEY idx_holidays_recurring (is_recurring)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 19. company_settings
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS company_settings (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  setting_key   VARCHAR(80)  NOT NULL,
  setting_value TEXT         NOT NULL,
  setting_group VARCHAR(50)  NOT NULL DEFAULT 'GENERAL',
  description   VARCHAR(255) NULL,
  updated_by    INT UNSIGNED NULL,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_company_settings_key (setting_key),
  KEY idx_company_settings_group (setting_group),
  CONSTRAINT fk_company_settings_updater FOREIGN KEY (updated_by)
    REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 20. documents
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id  INT UNSIGNED NOT NULL,
  contract_id  INT UNSIGNED NULL,
  doc_type     ENUM('CCCD/CMND','Bằng cấp','Hợp đồng','Giấy khám sức khỏe','Sổ hộ khẩu','Khác') NOT NULL DEFAULT 'Khác',
  title        VARCHAR(200) NOT NULL,
  file_name    VARCHAR(255) NOT NULL,
  file_path    VARCHAR(500) NOT NULL,
  mime_type    VARCHAR(100) NULL,
  file_size    INT UNSIGNED NULL COMMENT 'bytes',
  issued_date  DATE         NULL,
  expiry_date  DATE         NULL,
  note         VARCHAR(500) NULL,
  uploaded_by  INT UNSIGNED NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_documents_employee (employee_id),
  KEY idx_documents_contract (contract_id),
  KEY idx_documents_type (doc_type),
  KEY idx_documents_expiry (expiry_date),
  CONSTRAINT fk_documents_employee FOREIGN KEY (employee_id)
    REFERENCES employees(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_documents_contract FOREIGN KEY (contract_id)
    REFERENCES contracts(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_documents_uploader FOREIGN KEY (uploaded_by)
    REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 21. sessions (lưu phiên express-session, thay MemoryStore)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  session_id VARCHAR(128) NOT NULL,
  expires_at BIGINT UNSIGNED NOT NULL COMMENT 'epoch milliseconds',
  data       MEDIUMTEXT   NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (session_id),
  KEY idx_sessions_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 22. audit_logs
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NULL,
  action      VARCHAR(30)  NOT NULL COMMENT 'INSERT|UPDATE|DELETE|LOGIN|LOGOUT|APPROVE|...',
  table_name  VARCHAR(80)  NOT NULL,
  record_id   VARCHAR(50)  NULL,
  old_value   JSON         NULL,
  new_value   JSON         NULL,
  ip_address  VARCHAR(45)  NULL,
  user_agent  VARCHAR(255) NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_user (user_id),
  KEY idx_audit_table (table_name),
  KEY idx_audit_action (action),
  KEY idx_audit_created (created_at),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
