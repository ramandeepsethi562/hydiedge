-- ============================================================================
-- 010_licensing_and_machine_auth.sql
-- HydiEdge SaaS Seat-Based Licensing Engine, 7-Day Free Trial Provisioning,
-- Machine-Based HWID Anti-Piracy Protection & Public Pricing Catalog
-- ============================================================================

USE hydiems_core;

-- 1. Tenant Licenses Table (Per-User Seat-Based Pricing & Expiry)
CREATE TABLE IF NOT EXISTS tenant_licenses (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  license_key VARCHAR(128) NOT NULL UNIQUE,
  plan_code ENUM('STARTER', 'PROFESSIONAL', 'ENTERPRISE', 'ULTIMATE') NOT NULL DEFAULT 'ENTERPRISE',
  seat_limit INT NOT NULL DEFAULT 10,
  active_machines_count INT NOT NULL DEFAULT 0,
  price_per_user_monthly DECIMAL(10, 2) NOT NULL DEFAULT 699.00,
  billing_cycle ENUM('MONTHLY', 'ANNUAL') NOT NULL DEFAULT 'ANNUAL',
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  status ENUM('TRIAL', 'ACTIVE', 'EXPIRED', 'SUSPENDED') NOT NULL DEFAULT 'TRIAL',
  is_trial TINYINT(1) NOT NULL DEFAULT 0,
  trial_starts_at DATETIME(3) NULL,
  trial_ends_at DATETIME(3) NULL,
  activated_at DATETIME(3) NULL,
  expires_at DATETIME(3) NOT NULL,
  hwid_binding_required TINYINT(1) NOT NULL DEFAULT 1,
  allowed_features JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_tl_org (org_id),
  INDEX idx_tl_status (status),
  INDEX idx_tl_key (license_key),
  CONSTRAINT fk_tl_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Machine-Based Agent Auth Table (Anti-Piracy & Hardware Binding)
CREATE TABLE IF NOT EXISTS agent_machine_licenses (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  license_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NULL,
  machine_fingerprint VARCHAR(128) NOT NULL COMMENT 'SHA-256 hash of CPU ID + Motherboard UUID + MAC',
  hostname VARCHAR(128) NOT NULL,
  os_platform VARCHAR(32) NOT NULL DEFAULT 'WINDOWS',
  os_version VARCHAR(64) NOT NULL,
  cpu_identifier VARCHAR(128) NULL,
  bios_uuid VARCHAR(128) NULL,
  mac_address VARCHAR(64) NULL,
  disk_serial VARCHAR(128) NULL,
  agent_token_hash VARCHAR(128) NOT NULL,
  status ENUM('ACTIVE', 'REVOKED', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
  activated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_heartbeat_at DATETIME(3) NULL,
  revoked_at DATETIME(3) NULL,
  revocation_reason VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_org_machine (org_id, machine_fingerprint),
  INDEX idx_aml_license (license_id),
  INDEX idx_aml_status (status),
  CONSTRAINT fk_aml_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_aml_license FOREIGN KEY (license_id) REFERENCES tenant_licenses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Public Pricing Plans Catalog
CREATE TABLE IF NOT EXISTS public_pricing_plans (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  plan_code VARCHAR(32) NOT NULL UNIQUE,
  plan_name VARCHAR(64) NOT NULL,
  tagline VARCHAR(255) NOT NULL,
  price_inr_monthly DECIMAL(10, 2) NOT NULL,
  price_usd_monthly DECIMAL(10, 2) NOT NULL,
  annual_discount_pct INT NOT NULL DEFAULT 20,
  min_seats INT NOT NULL DEFAULT 5,
  is_popular TINYINT(1) NOT NULL DEFAULT 0,
  features_list JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Public Trial & Lead Signups Log
CREATE TABLE IF NOT EXISTS public_trial_signups (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(128) NOT NULL,
  work_email VARCHAR(255) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  company_size INT NOT NULL DEFAULT 10,
  plan_code VARCHAR(32) NOT NULL DEFAULT 'ENTERPRISE',
  provisioned_org_id VARCHAR(36) NOT NULL,
  provisioned_license_key VARCHAR(128) NOT NULL,
  ip_address VARCHAR(64) NULL,
  trial_expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed Standard Pricing Catalog
INSERT IGNORE INTO public_pricing_plans (id, plan_code, plan_name, tagline, price_inr_monthly, price_usd_monthly, annual_discount_pct, min_seats, is_popular, features_list)
VALUES
(
  'plan-starter',
  'STARTER',
  'Starter Essentials',
  'Ideal for small teams needing core time, attendance & productivity visibility',
  199.00,
  2.99,
  20,
  5,
  0,
  JSON_ARRAY(
    'Deterministic 8-State Time Tracking',
    'Daily Attendance & Shift Management',
    'Application & Website URL Tracking',
    'Focus Time & Context Switching Metrics',
    'Employee Timesheets & Manager Approvals',
    'Hardware Inventory & Device Tracking',
    'CSV & Excel Data Export',
    'Local NVMe Storage Retention (30 Days)'
  )
),
(
  'plan-pro',
  'PROFESSIONAL',
  'Professional Growth',
  'Best for growing distributed teams requiring proof of work & project tracking',
  399.00,
  5.99,
  20,
  10,
  0,
  JSON_ARRAY(
    'Everything in Starter, plus:',
    'Automated Screenshots (Up to 10x/hr)',
    'Intelligent Privacy Blur & PII Masking',
    'Agile Projects, Kanban Boards & Sprints',
    'Bug Tracking & Custom Tracker Schemas',
    'Client Billing & Multi-Tier Pay Rates',
    'Away Reason Prompts & Retroactive Rollback',
    'Custom Productivity Rules & Window Title Regex',
    'Local NVMe Storage Retention (90 Days)'
  )
),
(
  'plan-enterprise',
  'ENTERPRISE',
  'Enterprise Complete',
  'Comprehensive workforce intelligence, Live WebRTC streaming, DLP & Payroll',
  699.00,
  9.99,
  20,
  15,
  1,
  JSON_ARRAY(
    'Everything in Professional, plus:',
    'Full-Screen 30-FPS WebRTC Live Screen Streaming',
    'Office TV Operations Wallboard with Auto-Rotation',
    '11-Layer Data Loss Prevention (DLP)',
    'USB Storage Whitelisting & Hardware Lock',
    'Anti-Cheat Mouse Jiggler & Auto-Clicker Detection',
    'Precision Payroll Studio with Custom Formulas',
    'Inline Payslip Adjustments without Batch Reruns',
    '1-Click Corporate Bank Bulk Payout (.csv export)',
    'BPO Shrinkage Real-Time Calculator',
    'Hardware Machine-Based Anti-Piracy Binding',
    'Local NVMe Storage Retention (180 Days)'
  )
),
(
  'plan-ultimate',
  'ULTIMATE',
  'Ultimate Sovereign Suite',
  'Full monitoring, Screen/Audio recordings, Field GPS, MDM & AI Analytics',
  999.00,
  14.99,
  20,
  20,
  0,
  JSON_ARRAY(
    'Everything in Enterprise, plus:',
    'Continuous Screen Recording Clips (1x, 2x, 4x Playback)',
    'Microphone & System Loopback Audio Tracking (Opus 24kbps)',
    'Field Staff GPS Route Replay & Dwell Times',
    'Circular & Polygon Geofenced Jobsites with Auto-Attendance',
    'GPS Mileage Expense Auto-Calculation & Multi-Tier Approval',
    'Mobile Telephony Companion: Call Logs & Audio Sync',
    'Corporate Mobile Device Management (MDM) Remote Lock',
    'HydiAI Flight-Risk, Burnout & Anomaly Detection',
    'Text-to-SQL Natural Language Query Engine',
    'Unlimited NVMe Storage & Dedicated SLA'
  )
);

-- Seed default license for Acme Global Corp if not present
INSERT IGNORE INTO tenant_licenses (
  id, org_id, license_key, plan_code, seat_limit, active_machines_count,
  price_per_user_monthly, billing_cycle, currency, status, is_trial,
  trial_starts_at, trial_ends_at, activated_at, expires_at, hwid_binding_required, allowed_features
)
VALUES (
  'lic-acme-global-enterprise',
  'org-acme-global-001',
  'HYDI-ENT-ACME-8921-X99Q',
  'ULTIMATE',
  150,
  5,
  999.00,
  'ANNUAL',
  'INR',
  'ACTIVE',
  0,
  NULL,
  NULL,
  '2026-01-01 00:00:00',
  '2027-12-31 23:59:59',
  1,
  JSON_ARRAY('ALL_MODULES', 'WEBRTC_STREAMING', 'DLP_SECURITY', 'PAYROLL_PRECISION', 'FIELD_GPS', 'TELEPHONY_CALLS', 'HYDIAI_ANALYTICS')
);
