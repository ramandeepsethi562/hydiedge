-- ============================================================================
-- Migration 008: Mobile Companion Telephony, Call Logs, Screen Time & Contacts
-- Matches Android Native Companion endpoints in /api/v1/mobile/telephony-batch
-- ============================================================================

CREATE TABLE IF NOT EXISTS mobile_call_logs (
  id VARCHAR(64) PRIMARY KEY,
  org_id VARCHAR(64) NOT NULL,
  employee_id VARCHAR(64) NOT NULL,
  device_id VARCHAR(64) NOT NULL,
  caller_name VARCHAR(128) NOT NULL DEFAULT 'Customer Contact',
  phone_number VARCHAR(32) NOT NULL,
  call_type ENUM('INCOMING', 'OUTGOING', 'MISSED', 'REJECTED') NOT NULL DEFAULT 'INCOMING',
  call_time_utc DATETIME(3) NOT NULL,
  duration_seconds INT NOT NULL DEFAULT 0,
  audio_url VARCHAR(512) NULL,
  notes TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_mcl_org_emp (org_id, employee_id),
  INDEX idx_mcl_time (call_time_utc)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mobile_screen_time_logs (
  id VARCHAR(64) PRIMARY KEY,
  org_id VARCHAR(64) NOT NULL,
  employee_id VARCHAR(64) NOT NULL,
  device_id VARCHAR(64) NOT NULL,
  log_date DATE NOT NULL,
  package_name VARCHAR(256) NOT NULL,
  app_name VARCHAR(128) NOT NULL,
  category ENUM('PRODUCTIVE', 'NEUTRAL', 'NON_PRODUCTIVE') NOT NULL DEFAULT 'NEUTRAL',
  screen_time_seconds INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_mst_date_pkg (org_id, employee_id, device_id, log_date, package_name),
  INDEX idx_mst_org_date (org_id, log_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mobile_contacts (
  id VARCHAR(64) PRIMARY KEY,
  org_id VARCHAR(64) NOT NULL,
  employee_id VARCHAR(64) NOT NULL,
  contact_name VARCHAR(128) NOT NULL,
  phone_number VARCHAR(32) NOT NULL,
  email VARCHAR(128) NULL,
  synced_at_utc DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_mc_emp_phone (org_id, employee_id, phone_number),
  INDEX idx_mc_org_emp (org_id, employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
