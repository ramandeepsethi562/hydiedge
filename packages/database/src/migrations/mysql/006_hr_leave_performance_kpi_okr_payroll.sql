-- ============================================================================
-- 006_hr_leave_performance_kpi_okr_payroll.sql
-- HR Documents, Onboarding/Offboarding, Leave Types, Balances, Accrual Ledger,
-- Leave Requests, Public Holidays, 360 Performance Reviews, KPIs, OKRs & Payroll
-- ============================================================================

CREATE TABLE IF NOT EXISTS hr_documents (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL,
  doc_category ENUM('EMPLOYMENT_CONTRACT','NDA','ID_VERIFICATION','TAX_FORM','CERTIFICATION','POLICY_ACK') NOT NULL,
  title VARCHAR(255) NOT NULL,
  object_key VARCHAR(512) NOT NULL,
  sha256_checksum CHAR(64) NOT NULL,
  signed_status ENUM('NOT_REQUIRED','PENDING_SIGNATURE','SIGNED','EXPIRED') NOT NULL DEFAULT 'SIGNED',
  expires_at DATE NULL,
  uploaded_by_user_id VARCHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_hrdoc_org_emp (org_id, employee_id),
  CONSTRAINT fk_hrdoc_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS onboarding_workflows (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL UNIQUE,
  mentor_employee_id VARCHAR(36) NULL,
  checklist_items_json JSON NOT NULL,
  completion_pct TINYINT NOT NULL DEFAULT 0,
  agent_installed TINYINT(1) NOT NULL DEFAULT 0,
  privacy_consent_signed TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('IN_PROGRESS','COMPLETED','OVERDUE') NOT NULL DEFAULT 'IN_PROGRESS',
  target_completion_date DATE NOT NULL,
  completed_at DATETIME(3) NULL,
  CONSTRAINT fk_onb_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS offboarding_workflows (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL UNIQUE,
  initiated_by_user_id VARCHAR(36) NOT NULL,
  departure_type ENUM('VOLUNTARY_RESIGNATION','REDUCTION_IN_FORCE','TERMINATION_FOR_CAUSE','CONTRACT_END') NOT NULL,
  last_working_date DATE NOT NULL,
  dlp_high_risk_watch_enabled TINYINT(1) NOT NULL DEFAULT 1,
  agent_remote_wiped TINYINT(1) NOT NULL DEFAULT 0,
  sso_tokens_revoked TINYINT(1) NOT NULL DEFAULT 0,
  hardware_returned TINYINT(1) NOT NULL DEFAULT 0,
  final_settlement_approved TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('INITIATED','DLP_AUDIT_STAGE','ASSET_RECOVERY','COMPLETED') NOT NULL DEFAULT 'INITIATED',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_offb_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS leave_types (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  code VARCHAR(32) NOT NULL,
  name VARCHAR(128) NOT NULL,
  is_paid TINYINT(1) NOT NULL DEFAULT 1,
  annual_allowance_days DECIMAL(5, 2) NOT NULL DEFAULT 20.00,
  accrual_frequency ENUM('UPFRONT_ANNUAL','MONTHLY','BIWEEKLY') NOT NULL DEFAULT 'MONTHLY',
  max_carryover_days DECIMAL(5, 2) NOT NULL DEFAULT 5.00,
  requires_document_after_days TINYINT NOT NULL DEFAULT 3,
  color_hex CHAR(7) NOT NULL DEFAULT '#10B981',
  UNIQUE KEY uq_lt_org_code (org_id, code),
  CONSTRAINT fk_lt_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS leave_balances (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL,
  leave_type_id VARCHAR(36) NOT NULL,
  calendar_year SMALLINT NOT NULL,
  entitled_days DECIMAL(5, 2) NOT NULL DEFAULT 20.00,
  accrued_days DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  carryover_days DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  used_days DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  pending_days DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  available_days DECIMAL(5, 2) NOT NULL DEFAULT 20.00,
  UNIQUE KEY uq_lb_emp_type_yr (org_id, employee_id, leave_type_id, calendar_year),
  CONSTRAINT fk_lb_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  CONSTRAINT fk_lb_type FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS leave_accrual_ledger (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  leave_balance_id VARCHAR(36) NOT NULL,
  transaction_type ENUM('ACCRUAL_CREDIT','CARRYOVER_CREDIT','LEAVE_DEBIT','MANUAL_ADJUSTMENT','ENCASHMENT') NOT NULL,
  delta_days DECIMAL(5, 2) NOT NULL,
  balance_after_days DECIMAL(5, 2) NOT NULL,
  reference_note VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_lal_bal (leave_balance_id, created_at),
  CONSTRAINT fk_lal_bal FOREIGN KEY (leave_balance_id) REFERENCES leave_balances(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS leave_requests (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL,
  leave_type_id VARCHAR(36) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_half_day TINYINT(1) NOT NULL DEFAULT 0,
  total_days DECIMAL(5, 2) NOT NULL DEFAULT 1.00,
  reason TEXT NULL,
  attachment_object_key VARCHAR(512) NULL,
  status ENUM('PENDING','APPROVED','REJECTED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  reviewed_by_user_id VARCHAR(36) NULL,
  reviewed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_lr_org_emp_dates (org_id, employee_id, start_date, end_date),
  CONSTRAINT fk_lr_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  CONSTRAINT fk_lr_type FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS public_holidays (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  location_id VARCHAR(36) NULL,
  holiday_date DATE NOT NULL,
  name VARCHAR(128) NOT NULL,
  country_code CHAR(2) NOT NULL DEFAULT 'US',
  is_optional_floating TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_ph_org_loc_date (org_id, location_id, holiday_date),
  CONSTRAINT fk_ph_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS performance_cycles (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  code VARCHAR(32) NOT NULL,
  title VARCHAR(128) NOT NULL,
  period_start_date DATE NOT NULL,
  period_end_date DATE NOT NULL,
  telemetry_weight_pct TINYINT NOT NULL DEFAULT 40,
  okr_weight_pct TINYINT NOT NULL DEFAULT 40,
  peer_360_weight_pct TINYINT NOT NULL DEFAULT 20,
  status ENUM('DRAFT','SELF_ASSESSMENT','PEER_REVIEW','MANAGER_CALIBRATION','PUBLISHED') NOT NULL DEFAULT 'SELF_ASSESSMENT',
  UNIQUE KEY uq_pcyc_org_code (org_id, code),
  CONSTRAINT fk_pcyc_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS performance_reviews_360 (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  cycle_id VARCHAR(36) NOT NULL,
  reviewee_employee_id VARCHAR(36) NOT NULL,
  reviewer_employee_id VARCHAR(36) NOT NULL,
  reviewer_relation ENUM('SELF','DIRECT_MANAGER','PEER','DIRECT_REPORT','EXECUTIVE') NOT NULL,
  telemetry_productivity_score DECIMAL(5, 2) NOT NULL DEFAULT 85.00,
  okr_attainment_score DECIMAL(5, 2) NOT NULL DEFAULT 80.00,
  competency_ratings_json JSON NOT NULL,
  composite_final_score DECIMAL(5, 2) NOT NULL DEFAULT 84.00,
  rating_band ENUM('EXCEEDS_EXPECTATIONS','MEETS_EXPECTATIONS','DEVELOPING','NEEDS_IMPROVEMENT') NOT NULL DEFAULT 'MEETS_EXPECTATIONS',
  strengths_feedback TEXT NULL,
  growth_areas_feedback TEXT NULL,
  submitted_at DATETIME(3) NULL,
  UNIQUE KEY uq_pr360_cycle_pair (cycle_id, reviewee_employee_id, reviewer_employee_id),
  CONSTRAINT fk_pr360_cycle FOREIGN KEY (cycle_id) REFERENCES performance_cycles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kpi_definitions (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  department_id VARCHAR(36) NULL,
  code VARCHAR(32) NOT NULL,
  name VARCHAR(128) NOT NULL,
  unit ENUM('PERCENTAGE','HOURS','CURRENCY','COUNT','SCORE_100') NOT NULL DEFAULT 'PERCENTAGE',
  target_value DECIMAL(12, 2) NOT NULL,
  direction ENUM('HIGHER_IS_BETTER','LOWER_IS_BETTER') NOT NULL DEFAULT 'HIGHER_IS_BETTER',
  auto_telemetry_formula VARCHAR(255) NULL,
  UNIQUE KEY uq_kpi_org_code (org_id, code),
  CONSTRAINT fk_kpi_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kpi_measurements (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  kpi_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL,
  period_month CHAR(7) NOT NULL COMMENT 'YYYY-MM',
  actual_value DECIMAL(12, 2) NOT NULL,
  attainment_pct DECIMAL(6, 2) NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_kpim_emp_month (kpi_id, employee_id, period_month),
  CONSTRAINT fk_kpim_kpi FOREIGN KEY (kpi_id) REFERENCES kpi_definitions(id) ON DELETE CASCADE,
  CONSTRAINT fk_kpim_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS okr_objectives (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  owner_employee_id VARCHAR(36) NOT NULL,
  department_id VARCHAR(36) NULL,
  parent_objective_id VARCHAR(36) NULL,
  quarter_label VARCHAR(16) NOT NULL COMMENT 'e.g. 2026-Q3',
  title VARCHAR(255) NOT NULL,
  progress_pct DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  status ENUM('ON_TRACK','BEHIND','AT_RISK','ACHIEVED') NOT NULL DEFAULT 'ON_TRACK',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_okr_org_qtr (org_id, quarter_label),
  CONSTRAINT fk_okr_emp FOREIGN KEY (owner_employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS okr_key_results (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  objective_id VARCHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  start_value DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  target_value DECIMAL(12, 2) NOT NULL DEFAULT 100.00,
  current_value DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  unit VARCHAR(32) NOT NULL DEFAULT '%',
  confidence_pct TINYINT NOT NULL DEFAULT 80,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_kr_obj (objective_id),
  CONSTRAINT fk_kr_obj FOREIGN KEY (objective_id) REFERENCES okr_objectives(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payroll_runs (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  subsidiary_id VARCHAR(36) NULL,
  run_code VARCHAR(32) NOT NULL,
  period_start_date DATE NOT NULL,
  period_end_date DATE NOT NULL,
  pay_date DATE NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  headcount INT NOT NULL DEFAULT 0,
  total_gross_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  total_deductions_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  total_net_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  status ENUM('DRAFT','TIMESHEETS_VERIFIED','APPROVED','DISBURSED','LOCKED') NOT NULL DEFAULT 'DRAFT',
  approved_by_user_id VARCHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_payrun_org_code (org_id, run_code),
  CONSTRAINT fk_payrun_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payroll_payslips (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  payroll_run_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL,
  regular_hours DECIMAL(8, 2) NOT NULL DEFAULT 160.00,
  overtime_hours DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
  paid_leave_hours DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
  unpaid_deduction_hours DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
  base_pay_amount DECIMAL(12, 2) NOT NULL,
  overtime_pay_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  bonus_commission_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  tax_withheld_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  benefits_deduction_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  net_payable_amount DECIMAL(12, 2) NOT NULL,
  pdf_object_key VARCHAR(512) NULL,
  UNIQUE KEY uq_slip_run_emp (payroll_run_id, employee_id),
  CONSTRAINT fk_slip_run FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id) ON DELETE CASCADE,
  CONSTRAINT fk_slip_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
