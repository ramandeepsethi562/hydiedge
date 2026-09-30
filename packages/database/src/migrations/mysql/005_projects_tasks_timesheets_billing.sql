-- ============================================================================
-- 005_projects_tasks_timesheets_billing.sql
-- Clients, Projects, Members, Sprints, Milestones, Bugs, Custom Trackers,
-- Tasks, Dependencies, Watchers, Comments, Timesheets (6 Lock States),
-- Entries, Lock History, Pay Rate Cards & Client Invoices
-- ============================================================================

CREATE TABLE IF NOT EXISTS clients (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  code VARCHAR(32) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  primary_contact_name VARCHAR(128) NULL,
  primary_contact_email VARCHAR(255) NULL,
  billing_currency CHAR(3) NOT NULL DEFAULT 'USD',
  payment_terms_days INT NOT NULL DEFAULT 30,
  tax_rate_pct DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  status ENUM('ACTIVE','PROSPECT','ON_HOLD','ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_client_org_code (org_id, code),
  CONSTRAINT fk_client_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  client_id VARCHAR(36) NULL,
  department_id VARCHAR(36) NULL,
  code VARCHAR(32) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  billing_model ENUM('TIME_AND_MATERIALS','FIXED_PRICE','RETAINER','INTERNAL_NON_BILLABLE') NOT NULL DEFAULT 'TIME_AND_MATERIALS',
  budget_hours DECIMAL(10, 2) NOT NULL DEFAULT 1000.00,
  budget_amount DECIMAL(12, 2) NOT NULL DEFAULT 100000.00,
  consumed_hours DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  consumed_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  health_status ENUM('ON_TRACK','AT_RISK','CRITICAL_OVERRUN','COMPLETED') NOT NULL DEFAULT 'ON_TRACK',
  start_date DATE NOT NULL,
  target_end_date DATE NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_proj_org_code (org_id, code),
  INDEX idx_proj_org_client (org_id, client_id),
  CONSTRAINT fk_proj_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_members (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  project_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL,
  project_role ENUM('PROJECT_LEAD','ARCHITECT','DEVELOPER','QA_ENGINEER','ANALYST','OBSERVER') NOT NULL DEFAULT 'DEVELOPER',
  billable_rate_override DECIMAL(10, 2) NULL,
  allocation_pct TINYINT NOT NULL DEFAULT 100,
  joined_at DATE NOT NULL,
  UNIQUE KEY uq_pm_proj_emp (project_id, employee_id),
  CONSTRAINT fk_pm_proj FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_pm_emp2 FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_sprints (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  project_id VARCHAR(36) NOT NULL,
  name VARCHAR(128) NOT NULL,
  goal VARCHAR(512) NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  planned_story_points INT NOT NULL DEFAULT 40,
  completed_story_points INT NOT NULL DEFAULT 0,
  status ENUM('PLANNED','ACTIVE','COMPLETED') NOT NULL DEFAULT 'PLANNED',
  INDEX idx_sprint_proj (project_id, status),
  CONSTRAINT fk_sprint_proj FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_milestones (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  project_id VARCHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  due_date DATE NOT NULL,
  completed_at DATE NULL,
  invoiceable_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  status ENUM('UPCOMING','IN_PROGRESS','COMPLETED','DELAYED') NOT NULL DEFAULT 'UPCOMING',
  INDEX idx_ms_proj (project_id),
  CONSTRAINT fk_ms_proj FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_bugs (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  project_id VARCHAR(36) NOT NULL,
  sprint_id VARCHAR(36) NULL,
  bug_key VARCHAR(32) NOT NULL,
  title VARCHAR(255) NOT NULL,
  severity ENUM('BLOCKER','CRITICAL','MAJOR','MINOR','TRIVIAL') NOT NULL DEFAULT 'MAJOR',
  status ENUM('OPEN','IN_PROGRESS','CODE_REVIEW','QA_VERIFY','RESOLVED','CLOSED') NOT NULL DEFAULT 'OPEN',
  reporter_employee_id VARCHAR(36) NOT NULL,
  assignee_employee_id VARCHAR(36) NULL,
  environment_info VARCHAR(255) NULL,
  reproduction_steps TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  resolved_at DATETIME(3) NULL,
  UNIQUE KEY uq_bug_org_key (org_id, bug_key),
  CONSTRAINT fk_bug_proj FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS custom_tracker_schemas (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  project_id VARCHAR(36) NULL,
  slug VARCHAR(64) NOT NULL,
  display_name VARCHAR(128) NOT NULL,
  fields_definition_json JSON NOT NULL,
  workflow_states_json JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_cts_org_slug (org_id, slug),
  CONSTRAINT fk_cts_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS custom_tracker_records (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  schema_id VARCHAR(36) NOT NULL,
  record_key VARCHAR(32) NOT NULL,
  title VARCHAR(255) NOT NULL,
  current_state VARCHAR(64) NOT NULL,
  owner_employee_id VARCHAR(36) NULL,
  field_values_json JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_ctr_org_key (org_id, record_key),
  CONSTRAINT fk_ctr_schema FOREIGN KEY (schema_id) REFERENCES custom_tracker_schemas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tasks (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  project_id VARCHAR(36) NOT NULL,
  sprint_id VARCHAR(36) NULL,
  milestone_id VARCHAR(36) NULL,
  parent_task_id VARCHAR(36) NULL,
  task_key VARCHAR(32) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  status ENUM('BACKLOG','TODO','IN_PROGRESS','IN_REVIEW','BLOCKED','DONE') NOT NULL DEFAULT 'TODO',
  priority ENUM('URGENT','HIGH','MEDIUM','LOW') NOT NULL DEFAULT 'MEDIUM',
  assignee_employee_id VARCHAR(36) NULL,
  reporter_employee_id VARCHAR(36) NULL,
  story_points TINYINT NULL,
  estimated_minutes INT NOT NULL DEFAULT 240,
  logged_minutes INT NOT NULL DEFAULT 0,
  due_date DATE NULL,
  completed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_task_org_key (org_id, task_key),
  INDEX idx_task_proj_status (project_id, status),
  INDEX idx_task_assignee (org_id, assignee_employee_id),
  CONSTRAINT fk_task_proj FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS task_dependencies (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  predecessor_task_id VARCHAR(36) NOT NULL,
  successor_task_id VARCHAR(36) NOT NULL,
  dependency_type ENUM('FINISH_TO_START','START_TO_START','FINISH_TO_FINISH','BLOCKS') NOT NULL DEFAULT 'FINISH_TO_START',
  lag_days INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_td_pair (predecessor_task_id, successor_task_id),
  CONSTRAINT fk_td_pred FOREIGN KEY (predecessor_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  CONSTRAINT fk_td_succ FOREIGN KEY (successor_task_id) REFERENCES tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS task_watchers (
  org_id VARCHAR(36) NOT NULL,
  task_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL,
  watched_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (task_id, employee_id),
  CONSTRAINT fk_tw_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  CONSTRAINT fk_tw_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS task_comments (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  task_id VARCHAR(36) NOT NULL,
  author_employee_id VARCHAR(36) NOT NULL,
  body_markdown TEXT NOT NULL,
  attachments_json JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_tc_task (task_id, created_at),
  CONSTRAINT fk_tc_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS timesheets (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL,
  period_start_date DATE NOT NULL,
  period_end_date DATE NOT NULL,
  lock_state ENUM('OPEN','SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','LOCKED') NOT NULL DEFAULT 'OPEN',
  total_logged_minutes INT NOT NULL DEFAULT 0,
  billable_minutes INT NOT NULL DEFAULT 0,
  non_billable_minutes INT NOT NULL DEFAULT 0,
  overtime_minutes INT NOT NULL DEFAULT 0,
  submitted_at DATETIME(3) NULL,
  approved_by_user_id VARCHAR(36) NULL,
  approved_at DATETIME(3) NULL,
  locked_by_user_id VARCHAR(36) NULL,
  locked_at DATETIME(3) NULL,
  rejection_reason VARCHAR(512) NULL,
  UNIQUE KEY uq_ts_emp_period (org_id, employee_id, period_start_date, period_end_date),
  INDEX idx_ts_org_state (org_id, lock_state),
  CONSTRAINT fk_ts_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS timesheet_entries (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  timesheet_id VARCHAR(36) NOT NULL,
  work_date DATE NOT NULL,
  project_id VARCHAR(36) NOT NULL,
  task_id VARCHAR(36) NULL,
  logged_minutes INT NOT NULL DEFAULT 0,
  is_billable TINYINT(1) NOT NULL DEFAULT 1,
  hourly_cost_rate DECIMAL(10, 2) NOT NULL DEFAULT 45.00,
  hourly_billable_rate DECIMAL(10, 2) NOT NULL DEFAULT 95.00,
  notes VARCHAR(512) NULL,
  INDEX idx_tse_ts (timesheet_id, work_date),
  CONSTRAINT fk_tse_ts FOREIGN KEY (timesheet_id) REFERENCES timesheets(id) ON DELETE CASCADE,
  CONSTRAINT fk_tse_proj FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS timesheet_lock_history (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  timesheet_id VARCHAR(36) NOT NULL,
  actor_user_id VARCHAR(36) NOT NULL,
  from_state ENUM('OPEN','SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','LOCKED') NOT NULL,
  to_state ENUM('OPEN','SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','LOCKED') NOT NULL,
  gate_used VARCHAR(64) NULL,
  reason TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_tslh_ts (timesheet_id, created_at),
  CONSTRAINT fk_tslh_ts FOREIGN KEY (timesheet_id) REFERENCES timesheets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pay_rate_cards (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  name VARCHAR(128) NOT NULL,
  role_title VARCHAR(128) NOT NULL,
  seniority_band ENUM('JUNIOR','MID','SENIOR','STAFF','PRINCIPAL') NOT NULL DEFAULT 'SENIOR',
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  internal_hourly_cost DECIMAL(10, 2) NOT NULL,
  standard_billable_rate DECIMAL(10, 2) NOT NULL,
  overtime_multiplier DECIMAL(3, 2) NOT NULL DEFAULT 1.50,
  weekend_multiplier DECIMAL(3, 2) NOT NULL DEFAULT 2.00,
  effective_from DATE NOT NULL,
  INDEX idx_prc_org (org_id),
  CONSTRAINT fk_prc_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS client_invoices (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  client_id VARCHAR(36) NOT NULL,
  project_id VARCHAR(36) NULL,
  invoice_number VARCHAR(64) NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  subtotal_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  tax_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  paid_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  status ENUM('DRAFT','ISSUED','PARTIALLY_PAID','PAID','OVERDUE','VOID') NOT NULL DEFAULT 'DRAFT',
  line_items_json JSON NOT NULL,
  pdf_object_key VARCHAR(512) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_inv_org_num (org_id, invoice_number),
  INDEX idx_inv_client_status (client_id, status),
  CONSTRAINT fk_cinv_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
