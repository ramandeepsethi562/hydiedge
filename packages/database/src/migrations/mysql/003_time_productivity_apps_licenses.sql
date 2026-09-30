-- ============================================================================
-- 003_time_productivity_apps_licenses.sql
-- Time Entries, Away Reasons, Away Logs, Personal Mode Sessions,
-- Productivity Rules, Application Catalog, Application Policies,
-- Software License Contracts & License Allocations
-- ============================================================================

CREATE TABLE IF NOT EXISTS time_entries (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL,
  device_id VARCHAR(36) NULL,
  project_id VARCHAR(36) NULL,
  task_id VARCHAR(36) NULL,
  entry_mode ENUM('INTERACTIVE','AUTOMATIC','SILENT_STEALTH','VISIBLE','MANUAL','TASK_BASED') NOT NULL DEFAULT 'INTERACTIVE',
  time_state ENUM('WORKING','PRODUCTIVE','NON_PRODUCTIVE','NEUTRAL','NO_IMPACT','IDLE','AWAY','OFFLINE') NOT NULL DEFAULT 'WORKING',
  start_utc DATETIME(3) NOT NULL,
  end_utc DATETIME(3) NULL,
  duration_seconds INT NOT NULL DEFAULT 0,
  is_billable TINYINT(1) NOT NULL DEFAULT 1,
  is_manual_override TINYINT(1) NOT NULL DEFAULT 0,
  notes VARCHAR(512) NULL,
  approved_by_user_id VARCHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_te_org_emp_start (org_id, employee_id, start_utc),
  INDEX idx_te_org_proj (org_id, project_id),
  CONSTRAINT fk_te_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS away_reasons (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  code VARCHAR(32) NOT NULL,
  label VARCHAR(128) NOT NULL,
  counts_as_work TINYINT(1) NOT NULL DEFAULT 0,
  counts_as_productive TINYINT(1) NOT NULL DEFAULT 0,
  max_minutes_per_day INT NOT NULL DEFAULT 60,
  requires_approval TINYINT(1) NOT NULL DEFAULT 0,
  icon_name VARCHAR(64) DEFAULT 'clock',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_away_org_code (org_id, code),
  CONSTRAINT fk_away_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS away_logs (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL,
  away_reason_id VARCHAR(36) NOT NULL,
  start_utc DATETIME(3) NOT NULL,
  end_utc DATETIME(3) NOT NULL,
  duration_seconds INT NOT NULL,
  comment VARCHAR(512) NULL,
  status ENUM('AUTO_ACCEPTED','PENDING_APPROVAL','APPROVED','REJECTED') NOT NULL DEFAULT 'AUTO_ACCEPTED',
  reviewed_by_user_id VARCHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_awaylog_org_emp (org_id, employee_id, start_utc),
  CONSTRAINT fk_awaylog_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  CONSTRAINT fk_awaylog_reason FOREIGN KEY (away_reason_id) REFERENCES away_reasons(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS personal_mode_sessions (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL,
  device_id VARCHAR(36) NULL,
  started_utc DATETIME(3) NOT NULL,
  ended_utc DATETIME(3) NULL,
  duration_seconds INT NOT NULL DEFAULT 0,
  suppressed_screenshots_count INT NOT NULL DEFAULT 0,
  suppressed_telemetry_slices INT NOT NULL DEFAULT 0,
  INDEX idx_pm_org_emp (org_id, employee_id, started_utc),
  CONSTRAINT fk_pm_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS productivity_rules (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  scope_tier ENUM('INDIVIDUAL','TEAM','DEPARTMENT','SUBSIDIARY','ORGANIZATION') NOT NULL DEFAULT 'ORGANIZATION',
  scope_target_id VARCHAR(36) NULL,
  match_type ENUM('PROCESS_NAME','URL_DOMAIN','WINDOW_TITLE_REGEX') NOT NULL,
  pattern VARCHAR(255) NOT NULL,
  category ENUM('PRODUCTIVE','NON_PRODUCTIVE','NEUTRAL','NO_IMPACT') NOT NULL,
  productivity_weight DECIMAL(3, 2) NOT NULL DEFAULT 1.00,
  priority INT NOT NULL DEFAULT 100,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_pr_org_tier (org_id, scope_tier, scope_target_id),
  CONSTRAINT fk_pr_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS application_catalog (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  executable_name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  vendor_name VARCHAR(128) NULL,
  app_category VARCHAR(64) NOT NULL DEFAULT 'Development',
  default_productivity ENUM('PRODUCTIVE','NON_PRODUCTIVE','NEUTRAL','NO_IMPACT') NOT NULL DEFAULT 'NEUTRAL',
  is_sanctioned TINYINT(1) NOT NULL DEFAULT 1,
  risk_score INT NOT NULL DEFAULT 10,
  first_seen_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_appcat_org_exe (org_id, executable_name),
  CONSTRAINT fk_appcat_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS application_policies (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  application_id VARCHAR(36) NOT NULL,
  department_id VARCHAR(36) NULL,
  action ENUM('ALLOW','WARN','BLOCK_EXECUTION','HIDE_WINDOW_TITLE','PAUSE_RECORDING') NOT NULL DEFAULT 'ALLOW',
  max_daily_minutes INT NULL,
  alert_on_launch TINYINT(1) NOT NULL DEFAULT 0,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_apppol_org_app (org_id, application_id),
  CONSTRAINT fk_apppol_app FOREIGN KEY (application_id) REFERENCES application_catalog(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS software_license_contracts (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  vendor_name VARCHAR(128) NOT NULL,
  product_name VARCHAR(128) NOT NULL,
  matched_executable_or_domain VARCHAR(255) NOT NULL,
  purchased_seats INT NOT NULL,
  cost_per_seat_monthly DECIMAL(10, 2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  contract_start_date DATE NOT NULL,
  contract_end_date DATE NOT NULL,
  inactivity_reclaim_days INT NOT NULL DEFAULT 30,
  auto_reclaim_enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_lic_org (org_id),
  CONSTRAINT fk_lic_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS software_license_allocations (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  contract_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL,
  assigned_at DATE NOT NULL,
  last_used_at DATETIME(3) NULL,
  usage_minutes_30d INT NOT NULL DEFAULT 0,
  reclaim_status ENUM('ACTIVE_USE','UNDERUTILIZED','CANDIDATE_FOR_RECLAIM','RECLAIMED') NOT NULL DEFAULT 'ACTIVE_USE',
  UNIQUE KEY uq_licalloc_contract_emp (contract_id, employee_id),
  INDEX idx_licalloc_org_status (org_id, reclaim_status),
  CONSTRAINT fk_licalloc_contract FOREIGN KEY (contract_id) REFERENCES software_license_contracts(id) ON DELETE CASCADE,
  CONSTRAINT fk_licalloc_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
