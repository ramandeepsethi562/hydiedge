-- ============================================================================
-- 004_monitoring_screenshots_recordings_dlp.sql
-- Screenshots (10x/hr), Audit Actions, Screen Recordings, Timeline Markers,
-- Audio Recordings, 11-Layer DLP Policies, USB Hardware Whitelist,
-- DLP Incidents, Suspicious Activity Alerts, 6-Stage Investigations & GDPR
-- ============================================================================

CREATE TABLE IF NOT EXISTS screenshots (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL,
  device_id VARCHAR(36) NOT NULL,
  captured_at_utc DATETIME(3) NOT NULL,
  monitor_index TINYINT NOT NULL DEFAULT 0,
  storage_provider ENUM('LOCAL_NVME_MINIO','AWS_S3','CLOUDFLARE_R2','TENANT_SFTP_FTPS') NOT NULL DEFAULT 'LOCAL_NVME_MINIO',
  object_key_original VARCHAR(512) NOT NULL,
  object_key_blurred VARCHAR(512) NULL,
  object_key_thumbnail VARCHAR(512) NULL,
  resolution_width INT NOT NULL DEFAULT 1920,
  resolution_height INT NOT NULL DEFAULT 1080,
  file_size_bytes INT NOT NULL DEFAULT 0,
  sha256_checksum CHAR(64) NOT NULL,
  is_blurred_by_policy TINYINT(1) NOT NULL DEFAULT 0,
  is_instant_on_demand TINYINT(1) NOT NULL DEFAULT 0,
  active_process_name VARCHAR(255) NULL,
  active_window_title VARCHAR(512) NULL,
  activity_score_pct TINYINT NOT NULL DEFAULT 75,
  keystrokes_in_window INT NOT NULL DEFAULT 0,
  mouse_clicks_in_window INT NOT NULL DEFAULT 0,
  ocr_extracted_text TEXT NULL,
  pii_redacted TINYINT(1) NOT NULL DEFAULT 0,
  deleted_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_ss_org_emp_time (org_id, employee_id, captured_at_utc),
  CONSTRAINT fk_ss_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS screenshot_audit_actions (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  screenshot_id VARCHAR(36) NOT NULL,
  actor_user_id VARCHAR(36) NOT NULL,
  action_type ENUM('VIEW_UNBLURRED','DOWNLOAD','SHARE_EVIDENCE','DELETE','RESTORE') NOT NULL,
  gate_used VARCHAR(64) NOT NULL,
  reason VARCHAR(512) NULL,
  ip_address VARCHAR(64) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_ssaudit_org_ss (org_id, screenshot_id),
  CONSTRAINT fk_ssaudit_ss FOREIGN KEY (screenshot_id) REFERENCES screenshots(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS screen_recordings (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL,
  device_id VARCHAR(36) NOT NULL,
  started_at_utc DATETIME(3) NOT NULL,
  ended_at_utc DATETIME(3) NOT NULL,
  duration_seconds INT NOT NULL,
  fps TINYINT NOT NULL DEFAULT 5,
  codec VARCHAR(32) NOT NULL DEFAULT 'H264_MP4',
  storage_provider ENUM('LOCAL_NVME_MINIO','AWS_S3','CLOUDFLARE_R2','TENANT_SFTP_FTPS') NOT NULL DEFAULT 'LOCAL_NVME_MINIO',
  object_key_video VARCHAR(512) NOT NULL,
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  trigger_reason ENUM('CONTINUOUS_SCHEDULE','DLP_ALERT_TRIGGER','LIVE_RECORD_ON_DEMAND','SENSITIVE_APP_OPENED') NOT NULL DEFAULT 'CONTINUOUS_SCHEDULE',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_sr_org_emp_time (org_id, employee_id, started_at_utc),
  CONSTRAINT fk_sr_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS recording_timeline_markers (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  recording_id VARCHAR(36) NOT NULL,
  offset_seconds INT NOT NULL,
  marker_type ENUM('APP_SWITCH','URL_NAVIGATION','DLP_VIOLATION','IDLE_START','KEYSTROKE_BURST','ADMIN_BOOKMARK') NOT NULL,
  label VARCHAR(255) NOT NULL,
  severity ENUM('INFO','WARNING','CRITICAL') NOT NULL DEFAULT 'INFO',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_rtm_rec (recording_id, offset_seconds),
  CONSTRAINT fk_rtm_rec FOREIGN KEY (recording_id) REFERENCES screen_recordings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audio_recordings (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL,
  device_id VARCHAR(36) NOT NULL,
  started_at_utc DATETIME(3) NOT NULL,
  ended_at_utc DATETIME(3) NOT NULL,
  duration_seconds INT NOT NULL,
  audio_channel ENUM('MICROPHONE','SYSTEM_LOOPBACK','MIXED_CALL') NOT NULL DEFAULT 'MIXED_CALL',
  object_key_audio VARCHAR(512) NOT NULL,
  avg_decibels DECIMAL(5, 2) NOT NULL DEFAULT -22.50,
  transcript_summary TEXT NULL,
  sentiment_score DECIMAL(4, 2) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_aud_org_emp (org_id, employee_id, started_at_utc),
  CONSTRAINT fk_aud_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dlp_policies (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  name VARCHAR(128) NOT NULL,
  channel ENUM(
    'FILE_TRANSFER','WEB_UPLOAD','WEB_DOWNLOAD','CLIPBOARD','PRINT_SPOOLER',
    'EMAIL_ATTACHMENT','CLOUD_STORAGE_SYNC','USB_REMOVABLE_MEDIA',
    'APP_BLOCKLIST','URL_BLOCKLIST','SCREEN_CAPTURE_GUARD'
  ) NOT NULL,
  severity ENUM('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL DEFAULT 'HIGH',
  enforcement_action ENUM('AUDIT_ONLY','WARN_USER','BLOCK_AND_QUARANTINE','CAPTURE_FORENSIC_VIDEO') NOT NULL DEFAULT 'BLOCK_AND_QUARANTINE',
  content_regex_patterns JSON NULL,
  file_extensions_watched JSON NULL,
  destination_domains_watched JSON NULL,
  is_enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_dlppol_org_chan (org_id, channel),
  CONSTRAINT fk_dlppol_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS usb_hardware_whitelist (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  vendor_id CHAR(4) NOT NULL,
  product_id CHAR(4) NOT NULL,
  hardware_serial VARCHAR(128) NOT NULL,
  device_label VARCHAR(128) NOT NULL,
  assigned_employee_id VARCHAR(36) NULL,
  access_mode ENUM('READ_ONLY','READ_WRITE','BLOCKED') NOT NULL DEFAULT 'READ_ONLY',
  approved_by_user_id VARCHAR(36) NOT NULL,
  expires_at DATE NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_usb_org_serial (org_id, vendor_id, product_id, hardware_serial),
  CONSTRAINT fk_usb_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dlp_incidents (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  policy_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL,
  device_id VARCHAR(36) NULL,
  channel ENUM(
    'FILE_TRANSFER','WEB_UPLOAD','WEB_DOWNLOAD','CLIPBOARD','PRINT_SPOOLER',
    'EMAIL_ATTACHMENT','CLOUD_STORAGE_SYNC','USB_REMOVABLE_MEDIA',
    'APP_BLOCKLIST','URL_BLOCKLIST','SCREEN_CAPTURE_GUARD'
  ) NOT NULL,
  severity ENUM('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL,
  action_taken ENUM('AUDIT_ONLY','WARN_USER','BLOCK_AND_QUARANTINE','CAPTURE_FORENSIC_VIDEO') NOT NULL,
  artifact_name VARCHAR(512) NOT NULL,
  artifact_size_bytes BIGINT NOT NULL DEFAULT 0,
  artifact_sha256 CHAR(64) NULL,
  destination_target VARCHAR(512) NULL,
  matched_rule_snippet VARCHAR(512) NULL,
  evidence_object_key VARCHAR(512) NULL,
  occurred_at_utc DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_dlpinc_org_emp (org_id, employee_id, occurred_at_utc),
  CONSTRAINT fk_dlpinc_pol FOREIGN KEY (policy_id) REFERENCES dlp_policies(id) ON DELETE CASCADE,
  CONSTRAINT fk_dlpinc_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS suspicious_activity_alerts (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL,
  device_id VARCHAR(36) NULL,
  anomaly_type ENUM(
    'MOUSE_JIGGLER_DETECTED','OFF_HOURS_MASS_DOWNLOAD','UNUSUAL_VPN_GEO_HOP',
    'SHADOW_IT_EXECUTABLE','CONCURRENT_SESSION_SHARING','BULK_SOURCE_CODE_ARCHIVE'
  ) NOT NULL,
  confidence_score DECIMAL(5, 2) NOT NULL DEFAULT 92.50,
  risk_score INT NOT NULL DEFAULT 85,
  telemetry_evidence_json JSON NOT NULL,
  detected_at_utc DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_saa_org_emp (org_id, employee_id, detected_at_utc),
  CONSTRAINT fk_saa_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS security_investigations (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  case_number VARCHAR(32) NOT NULL,
  subject_employee_id VARCHAR(36) NOT NULL,
  lead_investigator_user_id VARCHAR(36) NOT NULL,
  stage ENUM('ALERT','REVIEW','ASSIGN','INVESTIGATE','RESOLVE','CLOSE') NOT NULL DEFAULT 'ALERT',
  priority ENUM('P1_CRITICAL','P2_HIGH','P3_MEDIUM','P4_LOW') NOT NULL DEFAULT 'P2_HIGH',
  title VARCHAR(255) NOT NULL,
  summary_findings TEXT NULL,
  linked_dlp_incident_ids JSON NULL,
  linked_recording_ids JSON NULL,
  resolution_outcome ENUM('PENDING','FALSE_POSITIVE','COACHING_ISSUED','WRITTEN_WARNING','TERMINATED_FOR_CAUSE','LEGAL_HOLD') NOT NULL DEFAULT 'PENDING',
  legal_hold_active TINYINT(1) NOT NULL DEFAULT 0,
  opened_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  closed_at DATETIME(3) NULL,
  UNIQUE KEY uq_inv_org_case (org_id, case_number),
  INDEX idx_inv_org_stage (org_id, stage),
  CONSTRAINT fk_inv_emp FOREIGN KEY (subject_employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS privacy_consents (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL,
  policy_version VARCHAR(32) NOT NULL,
  jurisdiction_code VARCHAR(32) NOT NULL DEFAULT 'GDPR_EU',
  accepted_at_utc DATETIME(3) NOT NULL,
  ip_address VARCHAR(64) NULL,
  digital_signature_hash CHAR(64) NOT NULL,
  UNIQUE KEY uq_priv_emp_ver (org_id, employee_id, policy_version),
  CONSTRAINT fk_priv_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS gdpr_data_requests (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL,
  request_type ENUM('DSAR_EXPORT','RIGHT_TO_ERASURE','RECTIFICATION','RESTRICT_PROCESSING') NOT NULL,
  status ENUM('RECEIVED','IDENTITY_VERIFIED','IN_PROGRESS','COMPLETED','REJECTED_LEGAL_HOLD') NOT NULL DEFAULT 'RECEIVED',
  due_date DATE NOT NULL,
  export_archive_object_key VARCHAR(512) NULL,
  processed_by_user_id VARCHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at DATETIME(3) NULL,
  INDEX idx_gdpr_org_status (org_id, status),
  CONSTRAINT fk_gdpr_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
