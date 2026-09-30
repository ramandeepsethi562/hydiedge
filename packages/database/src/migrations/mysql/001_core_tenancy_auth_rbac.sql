-- ============================================================================
-- 001_core_tenancy_auth_rbac.sql
-- Multi-Tenant Core, Entitlements, Storage Routing, SSL Monitors, Users,
-- Sessions, 9-Role RBAC Matrix, 9 Sensitive Gates, Impersonation & White-Label
-- ============================================================================

CREATE TABLE IF NOT EXISTS organizations (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  slug VARCHAR(64) NOT NULL UNIQUE,
  legal_name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  industry VARCHAR(100) DEFAULT 'Technology',
  default_timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
  default_currency CHAR(3) NOT NULL DEFAULT 'USD',
  workweek_days JSON NOT NULL,
  default_tracker_mode ENUM('INTERACTIVE','AUTOMATIC','SILENT_STEALTH','VISIBLE','MANUAL','TASK_BASED') NOT NULL DEFAULT 'INTERACTIVE',
  idle_threshold_seconds INT NOT NULL DEFAULT 300,
  screenshot_interval_minutes INT NOT NULL DEFAULT 10,
  status ENUM('ACTIVE','TRIAL','SUSPENDED','ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_org_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS organization_subsidiaries (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  code VARCHAR(32) NOT NULL,
  name VARCHAR(255) NOT NULL,
  country_code CHAR(2) NOT NULL DEFAULT 'US',
  timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  tax_registration_number VARCHAR(64) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_sub_org_code (org_id, code),
  CONSTRAINT fk_sub_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS organization_entitlements (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL UNIQUE,
  plan_code ENUM('STARTER','GROWTH','ENTERPRISE','SOVEREIGN_DEDICATED') NOT NULL DEFAULT 'ENTERPRISE',
  max_seats INT NOT NULL DEFAULT 500,
  active_seats INT NOT NULL DEFAULT 0,
  enabled_modules JSON NOT NULL,
  enabled_addons JSON NOT NULL,
  storage_quota_gb INT NOT NULL DEFAULT 1000,
  storage_used_bytes BIGINT NOT NULL DEFAULT 0,
  billing_cycle ENUM('MONTHLY','ANNUAL','MULTI_YEAR') NOT NULL DEFAULT 'ANNUAL',
  renewal_date DATE NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_ent_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS storage_routing_configs (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL UNIQUE,
  provider_type ENUM('LOCAL_NVME_MINIO','AWS_S3','CLOUDFLARE_R2','TENANT_SFTP_FTPS') NOT NULL DEFAULT 'LOCAL_NVME_MINIO',
  endpoint_url VARCHAR(512) NOT NULL,
  region VARCHAR(64) NOT NULL DEFAULT 'us-east-1',
  bucket_name VARCHAR(128) NOT NULL,
  access_key_id VARCHAR(255) NULL,
  secret_access_key_enc TEXT NULL,
  sftp_host VARCHAR(255) NULL,
  sftp_port INT NULL DEFAULT 22,
  sftp_username VARCHAR(128) NULL,
  sftp_base_dir VARCHAR(255) NULL,
  force_path_style TINYINT(1) NOT NULL DEFAULT 1,
  encryption_kms_key_id VARCHAR(255) NULL,
  retention_days INT NOT NULL DEFAULT 90,
  is_verified TINYINT(1) NOT NULL DEFAULT 1,
  last_health_check_at DATETIME(3) NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_storage_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ssl_domain_monitors (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  domain_name VARCHAR(255) NOT NULL,
  port INT NOT NULL DEFAULT 443,
  issuer_cn VARCHAR(255) NULL,
  subject_cn VARCHAR(255) NULL,
  serial_number VARCHAR(128) NULL,
  valid_from DATETIME(3) NULL,
  valid_to DATETIME(3) NULL,
  days_remaining INT NOT NULL DEFAULT 90,
  tls_version VARCHAR(32) DEFAULT 'TLSv1.3',
  status ENUM('HEALTHY','EXPIRING_SOON','EXPIRED','UNREACHABLE') NOT NULL DEFAULT 'HEALTHY',
  auto_renew_enabled TINYINT(1) NOT NULL DEFAULT 1,
  last_checked_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_ssl_org_domain (org_id, domain_name),
  CONSTRAINT fk_ssl_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  avatar_url VARCHAR(512) NULL,
  system_role ENUM('SUPER_ADMIN','ORG_ADMIN','EXECUTIVE','DEPT_HEAD','MANAGER','HR_ADMIN','FINANCE_ADMIN','SECURITY_ADMIN','EMPLOYEE') NOT NULL DEFAULT 'EMPLOYEE',
  mfa_enabled TINYINT(1) NOT NULL DEFAULT 0,
  mfa_secret_enc VARCHAR(255) NULL,
  sso_provider VARCHAR(64) NULL,
  sso_subject_id VARCHAR(255) NULL,
  status ENUM('ACTIVE','INVITED','LOCKED','DEACTIVATED') NOT NULL DEFAULT 'ACTIVE',
  last_login_at DATETIME(3) NULL,
  last_login_ip VARCHAR(64) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_user_org_email (org_id, email),
  INDEX idx_user_org_role (org_id, system_role),
  CONSTRAINT fk_user_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_sessions (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  refresh_token_hash VARCHAR(128) NOT NULL UNIQUE,
  device_fingerprint VARCHAR(128) NULL,
  user_agent VARCHAR(512) NULL,
  ip_address VARCHAR(64) NULL,
  expires_at DATETIME(3) NOT NULL,
  revoked_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_sess_org_user (org_id, user_id),
  CONSTRAINT fk_sess_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS roles (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  code ENUM('SUPER_ADMIN','ORG_ADMIN','EXECUTIVE','DEPT_HEAD','MANAGER','HR_ADMIN','FINANCE_ADMIN','SECURITY_ADMIN','EMPLOYEE') NOT NULL,
  display_name VARCHAR(128) NOT NULL,
  description VARCHAR(512) NULL,
  is_system_default TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_role_org_code (org_id, code),
  CONSTRAINT fk_role_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role_permissions (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  role_id VARCHAR(36) NOT NULL,
  module_key VARCHAR(64) NOT NULL,
  allowed_verbs JSON NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_role_mod (role_id, module_key),
  INDEX idx_rp_org (org_id),
  CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sensitive_gate_grants (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  gate_code ENUM(
    'GATE_VIEW_UNBLURRED_SCREENSHOTS',
    'GATE_TRIGGER_INSTANT_CAPTURE_NOW',
    'GATE_VIEW_LIVE_WEBRTC_STREAM',
    'GATE_DELETE_SCREENSHOTS_OR_RECORDINGS',
    'GATE_LISTEN_TO_AUDIO_RECORDINGS',
    'GATE_VIEW_KEYSTROKE_TEXT_LOGS',
    'GATE_OVERRIDE_LOCKED_TIMESHEETS',
    'GATE_EXPORT_DLP_EVIDENCE_FILES',
    'GATE_SUPER_ADMIN_TENANT_IMPERSONATION'
  ) NOT NULL,
  granted_by_user_id VARCHAR(36) NOT NULL,
  justification TEXT NOT NULL,
  expires_at DATETIME(3) NULL,
  revoked_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_gate_user (org_id, user_id, gate_code),
  CONSTRAINT fk_gate_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS impersonation_sessions (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  super_admin_user_id VARCHAR(36) NOT NULL,
  target_org_id VARCHAR(36) NOT NULL,
  target_user_id VARCHAR(36) NOT NULL,
  ticket_reference VARCHAR(128) NOT NULL,
  reason TEXT NOT NULL,
  started_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at DATETIME(3) NOT NULL,
  ended_at DATETIME(3) NULL,
  ip_address VARCHAR(64) NULL,
  INDEX idx_imp_target_org (target_org_id, started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS white_label_branding (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL UNIQUE,
  custom_domain VARCHAR(255) NULL UNIQUE,
  brand_name VARCHAR(128) NOT NULL DEFAULT 'HydiEms Enterprise',
  logo_light_url VARCHAR(512) NULL,
  logo_dark_url VARCHAR(512) NULL,
  favicon_url VARCHAR(512) NULL,
  primary_hex CHAR(7) NOT NULL DEFAULT '#2563EB',
  accent_hex CHAR(7) NOT NULL DEFAULT '#06B6D4',
  support_email VARCHAR(255) NULL,
  login_banner_text VARCHAR(512) NULL,
  hide_powered_by TINYINT(1) NOT NULL DEFAULT 0,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_wl_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
