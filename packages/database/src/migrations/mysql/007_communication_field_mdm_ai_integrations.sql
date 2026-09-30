-- ============================================================================
-- 007_communication_field_mdm_ai_integrations.sql
-- Communication Channels/Messages/Announcements, Field Geofences/Visits/GPS/Expenses,
-- Corporate MDM Devices/Policies, Alerts, Automation Workflows, Custom Dashboards,
-- Scheduled Reports, Export/Import Jobs, Archive Vault, API Keys, Webhooks,
-- Integrations & HydiAI Risk Predictions
-- ============================================================================

CREATE TABLE IF NOT EXISTS comm_channels (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  name VARCHAR(128) NOT NULL,
  channel_type ENUM('PUBLIC_DEPT','PRIVATE_GROUP','DIRECT_MESSAGE','INCIDENT_WARROOM') NOT NULL DEFAULT 'PUBLIC_DEPT',
  department_id VARCHAR(36) NULL,
  created_by_user_id VARCHAR(36) NOT NULL,
  is_archived TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_cchan_org (org_id),
  CONSTRAINT fk_cchan_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS comm_messages (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  channel_id VARCHAR(36) NOT NULL,
  sender_user_id VARCHAR(36) NOT NULL,
  parent_message_id VARCHAR(36) NULL,
  body_text TEXT NOT NULL,
  attachments_json JSON NULL,
  is_pinned TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_cmsg_chan_time (channel_id, created_at),
  CONSTRAINT fk_cmsg_chan FOREIGN KEY (channel_id) REFERENCES comm_channels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS comm_announcements (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  author_user_id VARCHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body_markdown TEXT NOT NULL,
  priority ENUM('NORMAL','IMPORTANT','EMERGENCY_DESKTOP_POPUP') NOT NULL DEFAULT 'NORMAL',
  target_department_ids JSON NULL,
  require_read_receipt TINYINT(1) NOT NULL DEFAULT 1,
  published_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at DATETIME(3) NULL,
  INDEX idx_cann_org_pub (org_id, published_at),
  CONSTRAINT fk_cann_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS field_geofences (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  client_id VARCHAR(36) NULL,
  name VARCHAR(128) NOT NULL,
  center_lat DECIMAL(10, 7) NOT NULL,
  center_lng DECIMAL(10, 7) NOT NULL,
  radius_meters INT NOT NULL DEFAULT 200,
  auto_punch_on_enter TINYINT(1) NOT NULL DEFAULT 1,
  alert_on_exit_during_shift TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_fg_org (org_id),
  CONSTRAINT fk_fg_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS field_visits (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL,
  geofence_id VARCHAR(36) NULL,
  client_id VARCHAR(36) NULL,
  purpose VARCHAR(255) NOT NULL,
  scheduled_start_utc DATETIME(3) NOT NULL,
  check_in_utc DATETIME(3) NULL,
  check_out_utc DATETIME(3) NULL,
  check_in_lat DECIMAL(10, 7) NULL,
  check_in_lng DECIMAL(10, 7) NULL,
  proof_photo_object_key VARCHAR(512) NULL,
  customer_signature_object_key VARCHAR(512) NULL,
  outcome_notes TEXT NULL,
  status ENUM('SCHEDULED','EN_ROUTE','CHECKED_IN','COMPLETED','MISSED') NOT NULL DEFAULT 'SCHEDULED',
  INDEX idx_fv_org_emp (org_id, employee_id, scheduled_start_utc),
  CONSTRAINT fk_fv_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS field_gps_breadcrumbs (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL,
  visit_id VARCHAR(36) NULL,
  recorded_at_utc DATETIME(3) NOT NULL,
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  accuracy_meters DECIMAL(6, 2) NOT NULL DEFAULT 8.50,
  speed_kmh DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
  battery_pct TINYINT NOT NULL DEFAULT 85,
  is_mock_location_flagged TINYINT(1) NOT NULL DEFAULT 0,
  INDEX idx_gps_org_emp_time (org_id, employee_id, recorded_at_utc),
  CONSTRAINT fk_gps_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS field_expense_claims (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL,
  visit_id VARCHAR(36) NULL,
  category ENUM('MILEAGE_FUEL','MEALS','LODGING','CLIENT_ENTERTAINMENT','SUPPLIES','TOLLS_PARKING') NOT NULL,
  expense_date DATE NOT NULL,
  distance_km DECIMAL(8, 2) NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  receipt_object_key VARCHAR(512) NULL,
  status ENUM('SUBMITTED','MANAGER_APPROVED','FINANCE_REIMBURSED','REJECTED') NOT NULL DEFAULT 'SUBMITTED',
  reviewed_by_user_id VARCHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_fexp_org_emp (org_id, employee_id),
  CONSTRAINT fk_fexp_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mdm_enrolled_devices (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL,
  device_type ENUM('ANDROID_ENTERPRISE','IOS_SUPERVISED','IPADOS','WINDOWS_AUTOPILOT','MACOS_DEP') NOT NULL,
  model_name VARCHAR(128) NOT NULL,
  os_version VARCHAR(64) NOT NULL,
  imei_or_serial VARCHAR(128) NOT NULL,
  encryption_enabled TINYINT(1) NOT NULL DEFAULT 1,
  jailbreak_root_detected TINYINT(1) NOT NULL DEFAULT 0,
  compliance_status ENUM('COMPLIANT','NON_COMPLIANT','LOCKED_REMOTE','WIPED') NOT NULL DEFAULT 'COMPLIANT',
  kiosk_mode_enabled TINYINT(1) NOT NULL DEFAULT 0,
  last_sync_utc DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_mdm_org_serial (org_id, imei_or_serial),
  CONSTRAINT fk_mdm_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mdm_app_policies (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  bundle_identifier VARCHAR(255) NOT NULL,
  app_name VARCHAR(128) NOT NULL,
  platform ENUM('ANDROID','IOS','WINDOWS','MACOS') NOT NULL,
  install_mode ENUM('FORCE_INSTALL','AVAILABLE_IN_CATALOG','BLOCKED_UNINSTALL') NOT NULL DEFAULT 'FORCE_INSTALL',
  disable_copy_paste_out TINYINT(1) NOT NULL DEFAULT 1,
  require_per_app_vpn TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_mdmapp_org_bundle (org_id, bundle_identifier, platform),
  CONSTRAINT fk_mdmapp_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS alert_rules (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  name VARCHAR(128) NOT NULL,
  metric_source ENUM('IDLE_STREAK_MINUTES','LATE_ARRIVAL','PRODUCTIVITY_BELOW_PCT','DLP_HIGH_SEVERITY','AGENT_OFFLINE_DURING_SHIFT','OVERTIME_THRESHOLD') NOT NULL,
  operator ENUM('GT','GTE','LT','LTE','EQ') NOT NULL DEFAULT 'GTE',
  threshold_value DECIMAL(10, 2) NOT NULL,
  notify_channels_json JSON NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_alrule_org (org_id),
  CONSTRAINT fk_alrule_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS automation_workflows (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  name VARCHAR(128) NOT NULL,
  trigger_event VARCHAR(128) NOT NULL,
  condition_expression_json JSON NOT NULL,
  actions_pipeline_json JSON NOT NULL,
  executions_count INT NOT NULL DEFAULT 0,
  last_triggered_at DATETIME(3) NULL,
  is_enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_autowf_org (org_id),
  CONSTRAINT fk_autowf_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS custom_dashboards (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  owner_user_id VARCHAR(36) NOT NULL,
  name VARCHAR(128) NOT NULL,
  is_shared_org_wide TINYINT(1) NOT NULL DEFAULT 0,
  is_tv_wallboard_mode TINYINT(1) NOT NULL DEFAULT 0,
  layout_widgets_json JSON NOT NULL,
  refresh_interval_seconds INT NOT NULL DEFAULT 30,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_cdash_org (org_id),
  CONSTRAINT fk_cdash_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS scheduled_reports (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  created_by_user_id VARCHAR(36) NOT NULL,
  name VARCHAR(128) NOT NULL,
  report_template_code VARCHAR(64) NOT NULL,
  cron_schedule VARCHAR(64) NOT NULL DEFAULT '0 8 * * 1',
  export_format ENUM('PDF','XLSX','CSV','JSON') NOT NULL DEFAULT 'PDF',
  recipient_emails_json JSON NOT NULL,
  filters_json JSON NULL,
  last_sent_at DATETIME(3) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  INDEX idx_srep_org (org_id),
  CONSTRAINT fk_srep_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS export_jobs (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  requested_by_user_id VARCHAR(36) NOT NULL,
  module_key VARCHAR(64) NOT NULL,
  export_format ENUM('PDF','XLSX','CSV','JSON','FORENSIC_ZIP') NOT NULL,
  row_count INT NOT NULL DEFAULT 0,
  object_key VARCHAR(512) NULL,
  status ENUM('QUEUED','PROCESSING','COMPLETED','FAILED') NOT NULL DEFAULT 'COMPLETED',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at DATETIME(3) NULL,
  INDEX idx_exp_org_user (org_id, requested_by_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS import_jobs (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  uploaded_by_user_id VARCHAR(36) NOT NULL,
  import_target ENUM('EMPLOYEES_CSV','SHIFTS_ROSTER','PROJECTS_TASKS','HOLIDAYS','LICENSE_SEATS') NOT NULL,
  source_filename VARCHAR(255) NOT NULL,
  total_rows INT NOT NULL DEFAULT 0,
  succeeded_rows INT NOT NULL DEFAULT 0,
  failed_rows INT NOT NULL DEFAULT 0,
  error_report_json JSON NULL,
  status ENUM('VALIDATING','IMPORTING','COMPLETED','FAILED') NOT NULL DEFAULT 'COMPLETED',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_imp_org (org_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS archive_vault (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  archive_type ENUM('COLD_TELEMETRY_PARQUET','SCREENSHOT_BUNDLE','TERMINATED_EMPLOYEE_DOSSIER','COMPLIANCE_AUDIT_SNAPSHOT') NOT NULL,
  period_start_date DATE NOT NULL,
  period_end_date DATE NOT NULL,
  storage_provider ENUM('LOCAL_NVME_MINIO','AWS_S3','CLOUDFLARE_R2','TENANT_SFTP_FTPS') NOT NULL,
  object_key VARCHAR(512) NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  sha256_manifest CHAR(64) NOT NULL,
  retention_until_date DATE NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_arch_org (org_id, retention_until_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS api_keys (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  name VARCHAR(128) NOT NULL,
  key_prefix CHAR(12) NOT NULL,
  key_sha256_hash CHAR(64) NOT NULL UNIQUE,
  scopes_json JSON NOT NULL,
  rate_limit_per_minute INT NOT NULL DEFAULT 600,
  last_used_at DATETIME(3) NULL,
  expires_at DATETIME(3) NULL,
  revoked_at DATETIME(3) NULL,
  created_by_user_id VARCHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_apikey_org (org_id),
  CONSTRAINT fk_apikey_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  name VARCHAR(128) NOT NULL,
  target_url VARCHAR(512) NOT NULL,
  signing_secret_enc VARCHAR(255) NOT NULL,
  subscribed_events_json JSON NOT NULL,
  failure_count INT NOT NULL DEFAULT 0,
  last_delivery_status INT NULL,
  last_delivered_at DATETIME(3) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_wh_org (org_id),
  CONSTRAINT fk_wh_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS integration_connections (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  provider_code ENUM(
    'JIRA_CLOUD','GITHUB_ENTERPRISE','GITLAB','ASANA','TRELLO','CLICKUP',
    'SLACK','MICROSOFT_TEAMS','BAMBOOHR','WORKDAY','GUSTO','ADP_WORKFORCE',
    'OKTA_SCIM','AZURE_ENTRA_ID','GOOGLE_WORKSPACE','QUICKBOOKS','XERO','STRIPE'
  ) NOT NULL,
  status ENUM('CONNECTED','SYNCING','ERROR','DISCONNECTED') NOT NULL DEFAULT 'CONNECTED',
  config_metadata_json JSON NOT NULL,
  encrypted_credentials TEXT NULL,
  sync_frequency_minutes INT NOT NULL DEFAULT 15,
  last_sync_at DATETIME(3) NULL,
  UNIQUE KEY uq_int_org_prov (org_id, provider_code),
  CONSTRAINT fk_int_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_risk_predictions (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL,
  prediction_date DATE NOT NULL,
  burnout_risk_score DECIMAL(5, 2) NOT NULL DEFAULT 24.00,
  attrition_flight_risk_score DECIMAL(5, 2) NOT NULL DEFAULT 18.00,
  disengagement_drift_score DECIMAL(5, 2) NOT NULL DEFAULT 15.00,
  overtime_streak_days TINYINT NOT NULL DEFAULT 0,
  focus_fragmentation_index DECIMAL(5, 2) NOT NULL DEFAULT 32.00,
  explainable_factors_json JSON NOT NULL,
  recommended_intervention VARCHAR(512) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_airisk_emp_date (org_id, employee_id, prediction_date),
  CONSTRAINT fk_airisk_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
