-- ============================================================================
-- 002_workforce_org_shifts_attendance.sql
-- Departments, Teams, Locations, Employees, Org Hierarchy Closure Table,
-- 5-Tier Policy Overrides, Hybrid Schedules, Devices, Shifts, Attendance & Shrinkage
-- ============================================================================

CREATE TABLE IF NOT EXISTS departments (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  subsidiary_id VARCHAR(36) NULL,
  parent_dept_id VARCHAR(36) NULL,
  code VARCHAR(32) NOT NULL,
  name VARCHAR(128) NOT NULL,
  head_user_id VARCHAR(36) NULL,
  cost_center_code VARCHAR(64) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_dept_org_code (org_id, code),
  INDEX idx_dept_org (org_id),
  CONSTRAINT fk_dept_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS teams (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  department_id VARCHAR(36) NOT NULL,
  code VARCHAR(32) NOT NULL,
  name VARCHAR(128) NOT NULL,
  lead_user_id VARCHAR(36) NULL,
  default_policy_json JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_team_org_code (org_id, code),
  INDEX idx_team_dept (org_id, department_id),
  CONSTRAINT fk_team_dept FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS org_locations (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  subsidiary_id VARCHAR(36) NULL,
  code VARCHAR(32) NOT NULL,
  name VARCHAR(128) NOT NULL,
  address_line VARCHAR(255) NULL,
  city VARCHAR(100) NULL,
  country_code CHAR(2) NOT NULL DEFAULT 'US',
  timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
  latitude DECIMAL(10, 7) NULL,
  longitude DECIMAL(10, 7) NULL,
  geofence_radius_meters INT NOT NULL DEFAULT 250,
  allowed_wifi_ssids JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_loc_org_code (org_id, code),
  CONSTRAINT fk_loc_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS employees (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL UNIQUE,
  subsidiary_id VARCHAR(36) NULL,
  department_id VARCHAR(36) NOT NULL,
  team_id VARCHAR(36) NULL,
  location_id VARCHAR(36) NULL,
  manager_employee_id VARCHAR(36) NULL,
  employee_code VARCHAR(32) NOT NULL,
  job_title VARCHAR(128) NOT NULL,
  employment_type ENUM('FULL_TIME','PART_TIME','CONTRACTOR','INTERN','VENDOR') NOT NULL DEFAULT 'FULL_TIME',
  work_mode ENUM('OFFICE','REMOTE','HYBRID','FIELD','ON_LEAVE') NOT NULL DEFAULT 'HYBRID',
  tracker_mode ENUM('INTERACTIVE','AUTOMATIC','SILENT_STEALTH','VISIBLE','MANUAL','TASK_BASED') NOT NULL DEFAULT 'INTERACTIVE',
  expected_daily_minutes INT NOT NULL DEFAULT 480,
  hourly_cost_rate DECIMAL(10, 2) NOT NULL DEFAULT 45.00,
  hourly_billable_rate DECIMAL(10, 2) NOT NULL DEFAULT 95.00,
  hire_date DATE NOT NULL,
  termination_date DATE NULL,
  status ENUM('ACTIVE','ON_LEAVE','SUSPENDED','OFFBOARDED') NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_emp_org_code (org_id, employee_code),
  INDEX idx_emp_org_dept (org_id, department_id),
  INDEX idx_emp_org_mgr (org_id, manager_employee_id),
  CONSTRAINT fk_emp_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_emp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS org_hierarchy_closure (
  org_id VARCHAR(36) NOT NULL,
  ancestor_employee_id VARCHAR(36) NOT NULL,
  descendant_employee_id VARCHAR(36) NOT NULL,
  depth INT NOT NULL DEFAULT 0,
  PRIMARY KEY (org_id, ancestor_employee_id, descendant_employee_id),
  INDEX idx_closure_desc (org_id, descendant_employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS employee_policy_overrides (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  tier_level ENUM('INDIVIDUAL','TEAM','DEPARTMENT','SUBSIDIARY','ORGANIZATION') NOT NULL,
  target_entity_id VARCHAR(36) NOT NULL,
  idle_timeout_seconds INT NULL,
  screenshot_frequency_per_hour INT NULL,
  blur_screenshots TINYINT(1) NULL,
  track_urls TINYINT(1) NULL,
  track_keystrokes TINYINT(1) NULL,
  allow_personal_mode TINYINT(1) NULL,
  updated_by_user_id VARCHAR(36) NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_policy_tier_target (org_id, tier_level, target_entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS work_location_schedules (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL,
  day_of_week TINYINT NOT NULL COMMENT '1=Mon .. 7=Sun',
  planned_work_mode ENUM('OFFICE','REMOTE','HYBRID','FIELD','ON_LEAVE') NOT NULL DEFAULT 'OFFICE',
  location_id VARCHAR(36) NULL,
  effective_from DATE NOT NULL,
  effective_to DATE NULL,
  UNIQUE KEY uq_wls_emp_dow (org_id, employee_id, day_of_week, effective_from),
  CONSTRAINT fk_wls_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS desktop_devices (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL,
  hostname VARCHAR(128) NOT NULL,
  os_platform ENUM('WINDOWS','MACOS','LINUX') NOT NULL DEFAULT 'WINDOWS',
  os_version VARCHAR(64) NOT NULL,
  agent_version VARCHAR(32) NOT NULL DEFAULT '2.5.0',
  hardware_serial VARCHAR(128) NOT NULL,
  mac_address VARCHAR(64) NULL,
  local_ip VARCHAR(64) NULL,
  public_ip VARCHAR(64) NULL,
  sqlite_spool_pending_rows INT NOT NULL DEFAULT 0,
  is_quarantined TINYINT(1) NOT NULL DEFAULT 0,
  last_heartbeat_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_dev_org_serial (org_id, hardware_serial),
  INDEX idx_dev_emp (org_id, employee_id),
  CONSTRAINT fk_dev_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS device_assignment_history (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  device_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL,
  assigned_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  unassigned_at DATETIME(3) NULL,
  notes VARCHAR(255) NULL,
  INDEX idx_dah_dev (org_id, device_id),
  CONSTRAINT fk_dah_dev FOREIGN KEY (device_id) REFERENCES desktop_devices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shifts (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  code VARCHAR(32) NOT NULL,
  name VARCHAR(128) NOT NULL,
  timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  crosses_midnight TINYINT(1) NOT NULL DEFAULT 0,
  expected_work_minutes INT NOT NULL DEFAULT 480,
  paid_break_minutes INT NOT NULL DEFAULT 30,
  unpaid_break_minutes INT NOT NULL DEFAULT 30,
  grace_late_minutes INT NOT NULL DEFAULT 10,
  grace_early_leave_minutes INT NOT NULL DEFAULT 10,
  half_day_threshold_minutes INT NOT NULL DEFAULT 240,
  overtime_after_minutes INT NOT NULL DEFAULT 510,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_shift_org_code (org_id, code),
  CONSTRAINT fk_shift_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shift_assignments (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL,
  shift_id VARCHAR(36) NOT NULL,
  roster_date DATE NOT NULL,
  is_rest_day TINYINT(1) NOT NULL DEFAULT 0,
  published_by_user_id VARCHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_sa_emp_date (org_id, employee_id, roster_date),
  CONSTRAINT fk_sa_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  CONSTRAINT fk_sa_shift FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS daily_attendance (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL,
  shift_id VARCHAR(36) NULL,
  attendance_date DATE NOT NULL,
  first_punch_in_utc DATETIME(3) NULL,
  last_punch_out_utc DATETIME(3) NULL,
  logged_work_minutes INT NOT NULL DEFAULT 0,
  productive_minutes INT NOT NULL DEFAULT 0,
  idle_minutes INT NOT NULL DEFAULT 0,
  away_minutes INT NOT NULL DEFAULT 0,
  late_by_minutes INT NOT NULL DEFAULT 0,
  early_leave_minutes INT NOT NULL DEFAULT 0,
  overtime_minutes INT NOT NULL DEFAULT 0,
  undertime_minutes INT NOT NULL DEFAULT 0,
  is_late TINYINT(1) NOT NULL DEFAULT 0,
  is_early_leaver TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('FULL_DAY','HALF_DAY','UNDERTIME','OVERTIME','ABSENT','ON_LEAVE','HOLIDAY','WEEKEND') NOT NULL DEFAULT 'ABSENT',
  actual_work_mode ENUM('OFFICE','REMOTE','HYBRID','FIELD','ON_LEAVE') NOT NULL DEFAULT 'OFFICE',
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_att_emp_date (org_id, employee_id, attendance_date),
  INDEX idx_att_org_date (org_id, attendance_date),
  CONSTRAINT fk_att_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attendance_corrections (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  daily_attendance_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL,
  requested_in_utc DATETIME(3) NOT NULL,
  requested_out_utc DATETIME(3) NOT NULL,
  reason TEXT NOT NULL,
  status ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  reviewed_by_user_id VARCHAR(36) NULL,
  reviewed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_attcorr_org_emp (org_id, employee_id),
  CONSTRAINT fk_attcorr_att FOREIGN KEY (daily_attendance_id) REFERENCES daily_attendance(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shrinkage_daily_rollups (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  department_id VARCHAR(36) NOT NULL,
  rollup_date DATE NOT NULL,
  rostered_minutes INT NOT NULL DEFAULT 0,
  planned_leave_minutes INT NOT NULL DEFAULT 0,
  unplanned_absent_minutes INT NOT NULL DEFAULT 0,
  late_undertime_minutes INT NOT NULL DEFAULT 0,
  meeting_training_minutes INT NOT NULL DEFAULT 0,
  system_downtime_minutes INT NOT NULL DEFAULT 0,
  total_shrinkage_minutes INT NOT NULL DEFAULT 0,
  shrinkage_pct DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  utilization_pct DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  UNIQUE KEY uq_shrink_dept_date (org_id, department_id, rollup_date),
  CONSTRAINT fk_shrink_dept FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
