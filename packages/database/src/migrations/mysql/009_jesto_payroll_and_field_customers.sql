-- ============================================================================
-- 009_jesto_payroll_and_field_customers.sql
-- Jesto Payroll Parity: Salary Components, Formulas, Salary Structures,
-- Bulk Assignments, Inline Adjustments, Offboarding Clearance Sign-offs,
-- and Field Customers Directory.
-- ============================================================================

CREATE TABLE IF NOT EXISTS payroll_salary_components (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  name VARCHAR(128) NOT NULL,
  code VARCHAR(32) NOT NULL,
  type ENUM('EARNING','DEDUCTION') NOT NULL,
  calculation_mode ENUM('FIXED_AMOUNT','FORMULA_PERCENT_OF_BASIC','CUSTOM_FORMULA') NOT NULL DEFAULT 'FIXED_AMOUNT',
  formula_expression VARCHAR(255) NULL,
  is_taxable TINYINT(1) NOT NULL DEFAULT 1,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_pay_comp_org_code (org_id, code),
  INDEX idx_pay_comp_org (org_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payroll_salary_structures (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  name VARCHAR(128) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  description VARCHAR(255) NULL,
  components_json JSON NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_pay_struct_org (org_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payroll_structure_assignments (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  structure_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL,
  ctc_annual_amount DECIMAL(12, 2) NOT NULL DEFAULT 1200000.00,
  assigned_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_struct_emp (org_id, employee_id),
  INDEX idx_struct_assign_org (org_id),
  CONSTRAINT fk_struct_assign_struct FOREIGN KEY (structure_id) REFERENCES payroll_salary_structures(id) ON DELETE CASCADE,
  CONSTRAINT fk_struct_assign_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payroll_inline_adjustments (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  payroll_run_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL,
  lop_days DECIMAL(4, 1) NOT NULL DEFAULT 0.0,
  bonus_incentive_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  gratuity_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  is_withheld TINYINT(1) NOT NULL DEFAULT 0,
  withholding_reason VARCHAR(255) NULL,
  adjustment_notes TEXT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_inline_adj_run_emp (payroll_run_id, employee_id),
  INDEX idx_inline_adj_run (payroll_run_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS offboarding_clearance_signoffs (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL,
  department_name ENUM('IT_INFRASTRUCTURE','ADMIN_FACILITIES','HR_OPERATIONS','FINANCE_ACCOUNTS','OPERATIONS','LEGAL') NOT NULL,
  status ENUM('PENDING','APPROVED','HOLD','REJECTED') NOT NULL DEFAULT 'PENDING',
  approver_user_id VARCHAR(36) NULL,
  approver_name VARCHAR(128) NULL,
  signoff_notes TEXT NULL,
  signed_at DATETIME(3) NULL,
  UNIQUE KEY uq_clearance_emp_dept (org_id, employee_id, department_name),
  INDEX idx_clearance_org_emp (org_id, employee_id),
  CONSTRAINT fk_clearance_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS field_customers (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(128) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  email VARCHAR(128) NULL,
  address TEXT NOT NULL,
  latitude DECIMAL(10, 6) NULL,
  longitude DECIMAL(10, 6) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_field_cust_org (org_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
