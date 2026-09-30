# PHASE 25: Endpoint Security, 11-Layer Data Loss Prevention (DLP) & Suspicious Activity Anti-Cheat Engine

**Document Version:** 1.0.0  
**Architecture Tier:** Enterprise Endpoint Security, DLP & Behavioral Forensics  
**Primary Stack:** Fastify 5.x (TypeScript) | MySQL 8.0 InnoDB | ClickHouse 24.x | Redis 7.x | S3/MinIO Object Storage | Rust + Tauri Desktop Agent (`hydi-agentd` kernel/user-mode hooks)  
**Covered Screen IDs:** `SEC-001` through `SEC-007`, `DLP-001` through `DLP-011`, `SUSP-001` through `SUSP-004`

---

## 1. Executive Architecture & System Topology

Phase 25 specifies the complete engineering architecture for HydiEms's **Endpoint Security Controls (`SEC-001..007`)**, **11-Layer Data Loss Prevention Engine (`DLP-001..011`)**, and **Suspicious Activity & Anti-Cheat Forensics Suite (`SUSP-001..004`)**.

### 1.1 Multi-OS Desktop Agent Enforcement Architecture
The HydiEms Desktop Agent (`hydi-agentd`) executes a dual-plane enforcement model:
1. **Privileged System Service / Daemon (`hydi-service`)**:
   - **Windows**: WDF Filter Driver / SetupAPI + `WM_DEVICECHANGE` + Windows Filtering Platform (WFP) callout driver + Minifilter filesystem driver (`IRP_MJ_CREATE`, `IRP_MJ_WRITE`, `IRP_MJ_SET_INFORMATION`) + Print Spooler API (`FindFirstPrinterChangeNotification`).
   - **macOS**: EndpointSecurity Framework (`ES_EVENT_TYPE_AUTH_MOUNT`, `ES_EVENT_TYPE_NOTIFY_WRITE`, `ES_EVENT_TYPE_NOTIFY_EXEC`) + DiskArbitration Framework + NetworkExtension (`NEFilterDataProvider`) + CUPS filter monitoring.
   - **Linux**: `udev` netlink socket + `fanotify` (`FAN_OPEN_PERM`, `FAN_MODIFY`) + `nftables` / eBPF socket filter + CUPS notifier.
2. **User-Session Helper (`hydi-session-helper`)**:
   - Monitors clipboard chains (`AddClipboardFormatListener` / `NSPasteboard` / X11/Wayland clipboard selection), browser DOM/DevTools/Network extensions via Native Messaging Host, and raw HID input stream (`RawInput` / `CGEventTap` / `libinput`) for hardware/software mouse jiggler and auto-clicker heuristics.

```mermaid
flowchart TD
    subgraph Endpoint["Employee Endpoint (hydi-agentd)"]
        USB["USB / Mass Storage Filter"]
        FS["Filesystem Minifilter / ESF"]
        NET["Network / Browser Native Host"]
        CLIP["Clipboard & Print Spooler Hook"]
        HID["Raw HID Input Telemetry Analyzer"]
        CACHE["SQLite Encrypted Policy Cache (SQLCipher)"]
    end

    subgraph Ingestion["HydiEms High-Velocity Ingestion Tier"]
        GW["Fastify WSS / REST Gateway"]
        REDIS["Redis 7 Policy Pub/Sub & Rate Limiter"]
        KAFKA["Redpanda / BullMQ Telemetry Stream"]
    end

    subgraph Storage["Polyglot Persistence Tier"]
        MYSQL[("MySQL 8.0 InnoDB\nPolicies, Whitelists, Incidents, Workflows")]
        CH[("ClickHouse 24.x\nHigh-Velocity Security & DLP Telemetry")]
        S3[("S3 / MinIO\nForensic Evidence, Screenshots, Shadow Copies")]
    end

    CACHE --> USB & FS & NET & CLIP & HID
    USB & FS & NET & CLIP & HID -->|Batch / Real-time Alert| GW
    GW --> REDIS
    GW --> KAFKA
    KAFKA --> CH
    GW --> MYSQL
    GW -->|Pre-Signed PUT| S3
    REDIS -->|Policy Push < 500ms| GW -->|WSS Push| CACHE
```

---

## 2. Database Schema & Polyglot Persistence Specifications

### 2.1 MySQL 8.0 InnoDB OLTP Schema (Policies, Whitelists, Incidents & Investigation Workflows)

```sql
-- ============================================================================
-- 1. SECURITY & USB POLICIES (SEC-003, SEC-005, SEC-007)
-- ============================================================================
CREATE TABLE security_policies (
    id CHAR(36) NOT NULL PRIMARY KEY COMMENT 'UUIDv7',
    tenant_id CHAR(36) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    scope_type ENUM('GLOBAL', 'DEPARTMENT', 'TEAM', 'USER', 'DEVICE_GROUP') NOT NULL DEFAULT 'GLOBAL',
    scope_target_id CHAR(36) NULL COMMENT 'Nullable when scope_type = GLOBAL',
    priority INT NOT NULL DEFAULT 100 COMMENT 'Lower integer = higher evaluation precedence',
    usb_mode ENUM('ALLOW', 'BLOCK', 'READ_ONLY', 'WHITELIST_ONLY') NOT NULL DEFAULT 'READ_ONLY',
    block_mtp_ptp BOOLEAN NOT NULL DEFAULT TRUE,
    block_bluetooth_file_transfer BOOLEAN NOT NULL DEFAULT TRUE,
    file_monitoring_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    monitored_directories JSON NOT NULL COMMENT 'Array of path globs e.g. ["C:\\\\Users\\\\*\\\\Documents/**", "/Users/*/Desktop/**"]',
    monitored_extensions JSON NOT NULL COMMENT 'Array of extensions e.g. [".xlsx", ".csv", ".sql", ".pem", ".env", ".pdf"]',
    website_blocking_mode ENUM('DISABLED', 'WARN_ONLY', 'ENFORCE_BLOCK', 'STRICT_ALLOWLIST') NOT NULL DEFAULT 'ENFORCE_BLOCK',
    offline_enforcement_grace_minutes INT NOT NULL DEFAULT 10080 COMMENT 'Default 7 days cached enforcement',
    version INT UNSIGNED NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by CHAR(36) NOT NULL,
    updated_by CHAR(36) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uq_sec_policy_name (tenant_id, name),
    INDEX idx_sec_policy_scope (tenant_id, scope_type, scope_target_id, is_active, priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 2. USB HARDWARE ID WHITELIST & INVENTORY (SEC-002, SEC-003)
-- ============================================================================
CREATE TABLE usb_hardware_whitelist (
    id CHAR(36) NOT NULL PRIMARY KEY,
    tenant_id CHAR(36) NOT NULL,
    vendor_id CHAR(4) NOT NULL COMMENT 'Hex VID e.g. 0781 (SanDisk)',
    product_id CHAR(4) NOT NULL COMMENT 'Hex PID e.g. 5581',
    serial_number VARCHAR(128) NULL COMMENT 'Exact hardware serial number; NULL allows any serial of VID:PID',
    device_class ENUM('MASS_STORAGE', 'MTP_PTP', 'SMART_CARD', 'YUBIKEY_FIDO', 'PRINTER', 'OTHER') NOT NULL DEFAULT 'MASS_STORAGE',
    device_label VARCHAR(150) NOT NULL,
    permission_level ENUM('FULL_ACCESS', 'READ_ONLY') NOT NULL DEFAULT 'READ_ONLY',
    assigned_department_id CHAR(36) NULL,
    assigned_user_id CHAR(36) NULL,
    expires_at DATETIME(3) NULL,
    approved_by CHAR(36) NOT NULL,
    approval_ticket_ref VARCHAR(100) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uq_usb_hw_serial (tenant_id, vendor_id, product_id, serial_number),
    INDEX idx_usb_lookup (tenant_id, vendor_id, product_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 3. WEBSITE ACCESS CONTROL RULES (SEC-005, DLP-010)
-- ============================================================================
CREATE TABLE website_access_rules (
    id CHAR(36) NOT NULL PRIMARY KEY,
    tenant_id CHAR(36) NOT NULL,
    policy_id CHAR(36) NOT NULL,
    domain_pattern VARCHAR(255) NOT NULL COMMENT 'Supports exact domain or wildcard *.example.com',
    category ENUM('FILE_SHARING', 'PERSONAL_WEBMAIL', 'GEN_AI_LLM', 'SOCIAL_MEDIA', 'GAMBLING', 'ADULT', 'MALWARE_PHISHING', 'CODE_REPOS', 'CUSTOM') NOT NULL,
    action ENUM('ALLOW', 'WARN_PROCEED', 'BLOCK_READONLY', 'BLOCK_COMPLETELY') NOT NULL DEFAULT 'BLOCK_COMPLETELY',
    allow_file_upload BOOLEAN NOT NULL DEFAULT FALSE,
    allow_file_download BOOLEAN NOT NULL DEFAULT TRUE,
    allow_clipboard_paste BOOLEAN NOT NULL DEFAULT TRUE,
    warning_message VARCHAR(500) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_web_rule_policy FOREIGN KEY (policy_id) REFERENCES security_policies(id) ON DELETE CASCADE,
    INDEX idx_web_rule_domain (tenant_id, policy_id, domain_pattern, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 4. 11-LAYER DLP POLICIES & CONTENT INSPECTION RULES (DLP-001..010)
-- ============================================================================
CREATE TABLE dlp_policies (
    id CHAR(36) NOT NULL PRIMARY KEY,
    tenant_id CHAR(36) NOT NULL,
    name VARCHAR(150) NOT NULL,
    severity ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'HIGH',
    scope_type ENUM('GLOBAL', 'DEPARTMENT', 'TEAM', 'USER') NOT NULL DEFAULT 'GLOBAL',
    scope_target_id CHAR(36) NULL,
    -- Channel Toggles across the 11 DLP Layers
    layer_usb_transfer BOOLEAN NOT NULL DEFAULT TRUE,
    layer_web_upload BOOLEAN NOT NULL DEFAULT TRUE,
    layer_web_download BOOLEAN NOT NULL DEFAULT TRUE,
    layer_clipboard BOOLEAN NOT NULL DEFAULT TRUE,
    layer_print BOOLEAN NOT NULL DEFAULT TRUE,
    layer_email BOOLEAN NOT NULL DEFAULT TRUE,
    layer_cloud_sync BOOLEAN NOT NULL DEFAULT TRUE,
    layer_app_blacklist BOOLEAN NOT NULL DEFAULT TRUE,
    layer_website_control BOOLEAN NOT NULL DEFAULT TRUE,
    -- Inspection Patterns
    regex_patterns JSON NOT NULL COMMENT 'Array of {name, pattern, min_match_count} e.g. PAN, SSN, Credit Card, AWS Secret Key, Private Key',
    file_size_threshold_bytes BIGINT UNSIGNED NOT NULL DEFAULT 10485760 COMMENT 'Default 10MB',
    mass_delete_threshold_files INT UNSIGNED NOT NULL DEFAULT 50 COMMENT 'Files deleted within 60s window',
    mass_copy_threshold_files INT UNSIGNED NOT NULL DEFAULT 100,
    -- Enforcement Actions
    enforcement_action ENUM('LOG_ONLY', 'WARN_USER_JUSTIFY', 'BLOCK_ACTION', 'BLOCK_AND_QUARANTINE', 'BLOCK_AND_LOCK_SESSION') NOT NULL DEFAULT 'BLOCK_ACTION',
    capture_screenshot_on_trigger BOOLEAN NOT NULL DEFAULT TRUE,
    capture_shadow_file_copy BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Stores encrypted copy of exfiltrated file in S3 if legally permitted',
    allowed_cloud_tenants JSON NULL COMMENT 'Allowed corporate domains/tenant IDs for OneDrive/Google Drive/Dropbox',
    blocked_executables JSON NULL COMMENT 'Array of process names or SHA-256 hashes e.g. ["tor.exe", "ngrok.exe", "anydesk.exe"]',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version INT UNSIGNED NOT NULL DEFAULT 1,
    created_by CHAR(36) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    INDEX idx_dlp_policy_tenant (tenant_id, is_active, severity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 5. DLP INCIDENTS OLTP TABLE (DLP-001, DLP-011)
-- ============================================================================
CREATE TABLE dlp_incidents (
    id CHAR(36) NOT NULL PRIMARY KEY,
    tenant_id CHAR(36) NOT NULL,
    incident_code VARCHAR(32) NOT NULL COMMENT 'Human-readable e.g. DLP-2026-008492',
    user_id CHAR(36) NOT NULL,
    device_id CHAR(36) NOT NULL,
    dlp_policy_id CHAR(36) NOT NULL,
    channel ENUM('USB_TRANSFER', 'WEB_UPLOAD', 'WEB_DOWNLOAD', 'CLIPBOARD', 'PRINT_JOB', 'EMAIL_OUTBOUND', 'CLOUD_UPLOAD', 'BLOCKED_APP', 'BLOCKED_WEBSITE', 'MASS_FILE_DELETE') NOT NULL,
    severity ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL,
    action_taken ENUM('LOGGED', 'WARNED_PROCEEDED', 'WARNED_CANCELLED', 'BLOCKED', 'QUARANTINED', 'SESSION_LOCKED') NOT NULL,
    source_path_or_app VARCHAR(1024) NOT NULL,
    destination_target VARCHAR(1024) NOT NULL COMMENT 'USB Volume/Serial, URL, Printer Name, Email Recipient, Cloud Provider',
    file_name VARCHAR(512) NULL,
    file_size_bytes BIGINT UNSIGNED NULL,
    file_sha256 CHAR(64) NULL,
    matched_rules JSON NOT NULL COMMENT 'Matched regex rule names and redacted snippets (PII masked)',
    user_justification TEXT NULL COMMENT 'Captured when action is WARN_USER_JUSTIFY',
    evidence_screenshot_s3_key VARCHAR(512) NULL,
    shadow_copy_s3_key VARCHAR(512) NULL,
    status ENUM('OPEN', 'UNDER_REVIEW', 'ESCALATED_TO_INVESTIGATION', 'FALSE_POSITIVE', 'RESOLVED') NOT NULL DEFAULT 'OPEN',
    reviewer_id CHAR(36) NULL,
    reviewer_notes TEXT NULL,
    occurred_at DATETIME(3) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uq_dlp_incident_code (tenant_id, incident_code),
    INDEX idx_dlp_inc_lookup (tenant_id, status, severity, occurred_at DESC),
    INDEX idx_dlp_inc_user (tenant_id, user_id, occurred_at DESC),
    INDEX idx_dlp_inc_channel (tenant_id, channel, occurred_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 6. SUSPICIOUS ACTIVITY RULES & 6-STEP INVESTIGATION WORKFLOW (SUSP-001..004)
-- ============================================================================
CREATE TABLE suspicious_behavior_rules (
    id CHAR(36) NOT NULL PRIMARY KEY,
    tenant_id CHAR(36) NOT NULL,
    rule_code VARCHAR(64) NOT NULL COMMENT 'e.g. ANTI_CHEAT_MOUSE_JIGGLER, ANTI_CHEAT_STUCK_KEY, AFTER_HOURS_BULK_EXPORT',
    name VARCHAR(150) NOT NULL,
    category ENUM('INPUT_SIMULATION_CHEAT', 'TIME_FRAUD', 'ABNORMAL_ACCESS', 'BULK_EXFILTRATION', 'AGENT_TAMPERING') NOT NULL,
    severity ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'HIGH',
    threshold_config JSON NOT NULL COMMENT 'Algorithmic parameters: entropy_max, oscillation_period_ms, key_repeat_seconds, confidence_min',
    auto_pause_time_tracking BOOLEAN NOT NULL DEFAULT TRUE,
    auto_capture_30s_recording BOOLEAN NOT NULL DEFAULT TRUE,
    notify_manager BOOLEAN NOT NULL DEFAULT TRUE,
    notify_security_admin BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uq_susp_rule (tenant_id, rule_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE suspicious_activity_alerts (
    id CHAR(36) NOT NULL PRIMARY KEY,
    tenant_id CHAR(36) NOT NULL,
    alert_code VARCHAR(32) NOT NULL COMMENT 'e.g. SUSP-2026-001920',
    user_id CHAR(36) NOT NULL,
    device_id CHAR(36) NOT NULL,
    rule_id CHAR(36) NOT NULL,
    alert_type ENUM(
        'MOUSE_JIGGLER_HARDWARE',
        'MOUSE_JIGGLER_SOFTWARE',
        'STUCK_OR_WEIGHTED_KEY',
        'AUTO_CLICKER_MACRO',
        'ZERO_WINDOW_SWITCH_HIGH_INPUT',
        'CLOCK_MANIPULATION_ATTEMPT',
        'AGENT_KILL_OR_SUSPEND_ATTEMPT',
        'UNUSUAL_NIGHT_ACCESS_EXPORT',
        'CONCURRENT_SESSION_ANOMALY'
    ) NOT NULL,
    severity ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL,
    confidence_score DECIMAL(5,2) NOT NULL COMMENT '0.00 to 100.00',
    -- 6-Step Investigation State Machine: ALERT -> REVIEW -> ASSIGN -> INVESTIGATE -> RESOLVE -> CLOSE
    workflow_stage ENUM('ALERT', 'REVIEW', 'ASSIGN', 'INVESTIGATE', 'RESOLVE', 'CLOSE') NOT NULL DEFAULT 'ALERT',
    resolution_outcome ENUM('PENDING', 'CONFIRMED_VIOLATION', 'COACHED_WARNING', 'TIME_DEDUCTED', 'FALSE_POSITIVE', 'HARDWARE_FAULT') NOT NULL DEFAULT 'PENDING',
    assigned_investigator_id CHAR(36) NULL,
    detected_start_at DATETIME(3) NOT NULL,
    detected_end_at DATETIME(3) NOT NULL,
    affected_duration_seconds INT UNSIGNED NOT NULL DEFAULT 0,
    deducted_timesheet_seconds INT UNSIGNED NOT NULL DEFAULT 0,
    telemetry_evidence_json JSON NOT NULL COMMENT 'Vector angles, FFT frequency peak, keycode histograms, process tree, USB VID/PID',
    linked_screenshot_ids JSON NULL COMMENT 'Array of screenshot UUIDs',
    linked_recording_s3_key VARCHAR(512) NULL,
    linked_dlp_incident_id CHAR(36) NULL,
    root_cause_summary TEXT NULL,
    closed_by CHAR(36) NULL,
    closed_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uq_susp_alert_code (tenant_id, alert_code),
    INDEX idx_susp_workflow (tenant_id, workflow_stage, severity, detected_start_at DESC),
    INDEX idx_susp_user (tenant_id, user_id, detected_start_at DESC),
    INDEX idx_susp_assignee (tenant_id, assigned_investigator_id, workflow_stage)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE suspicious_investigation_logs (
    id CHAR(36) NOT NULL PRIMARY KEY,
    tenant_id CHAR(36) NOT NULL,
    alert_id CHAR(36) NOT NULL,
    actor_user_id CHAR(36) NOT NULL,
    from_stage ENUM('ALERT', 'REVIEW', 'ASSIGN', 'INVESTIGATE', 'RESOLVE', 'CLOSE') NULL,
    to_stage ENUM('ALERT', 'REVIEW', 'ASSIGN', 'INVESTIGATE', 'RESOLVE', 'CLOSE') NOT NULL,
    action_type ENUM('STAGE_TRANSITION', 'ASSIGNEE_CHANGED', 'NOTE_ADDED', 'EVIDENCE_ATTACHED', 'TIMESHEET_ADJUSTED') NOT NULL,
    notes TEXT NOT NULL,
    metadata_json JSON NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_susp_log_alert FOREIGN KEY (alert_id) REFERENCES suspicious_activity_alerts(id) ON DELETE CASCADE,
    INDEX idx_susp_log_alert (alert_id, created_at ASC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2.2 ClickHouse 24.x High-Velocity Telemetry Tables

```sql
-- ============================================================================
-- 1. HIGH-VELOCITY ENDPOINT SECURITY & DLP TELEMETRY STREAM (SEC-001..006, DLP-002..010)
-- ============================================================================
CREATE TABLE hydi_telemetry.security_dlp_events_stream (
    event_id UUID,
    tenant_id UUID,
    user_id UUID,
    device_id UUID,
    department_id UUID,
    event_category LowCardinality(String), -- 'USB', 'FILE_SYSTEM', 'WEB_ACCESS', 'WEB_UPLOAD', 'WEB_DOWNLOAD', 'CLIPBOARD', 'PRINT', 'EMAIL', 'CLOUD_SYNC', 'APP_CONTROL'
    event_action LowCardinality(String),   -- 'MOUNT', 'UNMOUNT', 'CREATE', 'MODIFY', 'RENAME', 'DELETE', 'COPY', 'PASTE', 'UPLOAD', 'DOWNLOAD', 'PRINT', 'SEND', 'BLOCK', 'WARN'
    policy_decision LowCardinality(String),-- 'ALLOWED', 'WARNED', 'BLOCKED', 'READ_ONLY_ENFORCED', 'QUARANTINED'
    severity LowCardinality(String),       -- 'INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    process_name LowCardinality(String),
    process_path String,
    process_sha256 FixedString(64),
    source_entity String,                  -- File path, clipboard source app, email sender
    destination_entity String,             -- USB serial/mount, URL, printer name, email recipient, cloud domain
    usb_vendor_id LowCardinality(String),
    usb_product_id LowCardinality(String),
    usb_serial_number String,
    file_name String,
    file_extension LowCardinality(String),
    file_size_bytes UInt64,
    file_sha256 String,
    dlp_matched_patterns Array(LowCardinality(String)),
    dlp_match_count UInt32,
    page_count UInt16,
    client_ip IPv6,
    occurred_at DateTime64(3, 'UTC'),
    ingested_at DateTime64(3, 'UTC') DEFAULT now64(3)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(occurred_at)
ORDER BY (tenant_id, event_category, occurred_at, user_id, event_id)
TTL toDateTime(occurred_at) + INTERVAL 365 DAY DELETE
SETTINGS index_granularity = 8192;

-- ============================================================================
-- 2. ANTI-CHEAT INPUT BIOMETRICS & KINEMATICS TELEMETRY (SUSP-001..003)
-- ============================================================================
CREATE TABLE hydi_telemetry.input_kinematics_windows (
    window_id UUID,
    tenant_id UUID,
    user_id UUID,
    device_id UUID,
    window_start DateTime64(3, 'UTC'),
    window_end DateTime64(3, 'UTC'),
    mouse_move_events UInt32,
    mouse_distance_px Float64,
    mouse_direction_entropy Float32,       -- Shannon entropy of 8-directional movement vectors (0.0 to 3.0 bits)
    mouse_delta_variance Float32,          -- Variance of step displacement; near 0 indicates constant-step script/jiggler
    fft_dominant_freq_hz Float32,          -- Periodic oscillation peak frequency
    click_count UInt32,
    inter_click_interval_cv Float32,       -- Coefficient of variation (std/mean); < 0.03 indicates auto-clicker
    key_press_count UInt32,
    single_key_max_streak UInt32,          -- Consecutive repeats of identical virtual key code
    unique_keys_pressed UInt16,
    active_window_switches UInt16,
    synthetic_input_flag UInt8,            -- 1 if LLMHF_INJECTED / LLKHF_INJECTED / CGEventTap synthetic bit detected
    suspected_usb_jiggler_vid_pid String,
    anomaly_score Float32
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(window_start)
ORDER BY (tenant_id, user_id, window_start)
TTL toDateTime(window_start) + INTERVAL 90 DAY DELETE;
```

---

## 3. Screen-by-Screen Engineering Specifications

### 3.1 Security Controls (`SEC-001` to `SEC-007`)

#### `SEC-001` — Security Dashboard
* **Route**: `/security/overview`
* **Purpose**: Unified SOC-style posture view displaying endpoint protection coverage, USB block counts, file system anomalies, blocked website attempts, and active high-severity alerts over configurable time windows (`24h`, `7d`, `30d`).
* **UI Components**:
  1. **KPI Strip**: Total Protected Endpoints, Active Security Incidents (Critical/High), USB Blocks (24h), Blocked Malicious/Restricted URLs (24h), High-Risk Employees Score > 75.
  2. **Threat Vector Heatmap**: 24-hour x 7-day matrix showing peak hours for policy blocks across departments.
  3. **Top 10 High-Risk Users & Devices Table**: Calculated via composite risk formula:
     $$\text{RiskScore}_{u} = \min\left(100, \sum_{i \in \text{Events}} w_{\text{severity}(i)} \cdot e^{-\lambda \cdot \Delta t_i}\right)$$
     where $w_{\text{CRITICAL}}=25, w_{\text{HIGH}}=12, w_{\text{MEDIUM}}=5, w_{\text{LOW}}=1$ and $\lambda = 0.05\text{ day}^{-1}$.
* **Fastify Endpoint**: `GET /api/v1/security/dashboard?range=7d&departmentId=optional`

#### `SEC-002` — USB Device Monitoring
* **Route**: `/security/usb-monitoring`
* **Purpose**: Real-time and historical log of every USB device plugged into any managed workstation, including Vendor ID (`VID`), Product ID (`PID`), hardware serial number, device class, mount path, bytes read/written, and policy decision (`ALLOWED`, `READ_ONLY_ENFORCED`, `BLOCKED`).
* **UI Actions**:
  - One-click **"Promote to Whitelist"** modal (pre-fills `VID`, `PID`, and `Serial Number` from the blocked event into `SEC-003`).
  - Drill-down drawer showing all files read from or written to that specific USB serial number during the mount session.
* **Fastify Endpoint**: `GET /api/v1/security/usb/events`

#### `SEC-003` — USB Policy & Hardware ID Whitelist
* **Route**: `/security/usb-policies`
* **Purpose**: Configure granular USB mass-storage and MTP/PTP policies (`ALLOW`, `BLOCK`, `READ_ONLY`, `WHITELIST_ONLY`) scoped by Global, Department, Team, or Individual User, plus a strict Hardware ID Whitelist (`VID:PID:Serial`).
* **Enforcement Mechanics**:
  - When `usb_mode = 'READ_ONLY'`, `hydi-service` sets Windows Registry `HKLM\SYSTEM\CurrentControlSet\Control\StorageDevicePolicies\WriteProtect = 1` and intercepts `IRP_MJ_WRITE` on removable volume device objects (`FILE_DEVICE_DISK` with `FILE_REMOVABLE_MEDIA`), or remounts with `rdonly` on macOS/Linux.
  - When `usb_mode = 'WHITELIST_ONLY'`, the agent parses the USB device descriptor `(idVendor, idProduct, iSerialNumber)` prior to volume mount and compares against the locally cached Ed25519-signed whitelist bloom/hash table.
* **Fastify Endpoints**:
  - `GET /api/v1/security/usb/whitelist`
  - `POST /api/v1/security/usb/whitelist`
  - `PATCH /api/v1/security/usb/whitelist/:id`
  - `DELETE /api/v1/security/usb/whitelist/:id`

#### `SEC-004` — File System Activity Monitoring
* **Route**: `/security/file-monitoring`
* **Purpose**: Tracks high-risk filesystem operations (`CREATE`, `MODIFY`, `RENAME`, `DELETE`, `ARCHIVE_COMPRESS`) inside sensitive directories, highlighting mass-deletion spikes (ransomware/sabotage indicator) and sensitive extension staging (`.sql`, `.csv`, `.pem`, `.kdbx`, `.pst`, `.zip`).
* **Fastify Endpoint**: `GET /api/v1/security/files/events`

#### `SEC-005` — Website Blocking & Access Control
* **Route**: `/security/website-blocking`
* **Purpose**: Manage domain and category rules with three enforcement modes:
  1. **Allowed**: Normal access.
  2. **Warning (Coach & Proceed)**: Injects an interstitial warning page via browser extension / local proxy requiring the user to click *"I acknowledge this access is logged for business use"* with a 60-minute session bypass token.
  3. **Blocked**: Terminates TLS/HTTP request or redirects browser tab to the local HydiEms Block Page (`http://127.0.0.1:49152/blocked?domain=...&rule=...`).
* **Fastify Endpoints**:
  - `GET /api/v1/security/websites/rules`
  - `POST /api/v1/security/websites/rules`

#### `SEC-006` — Security Events Timeline
* **Route**: `/security/events-timeline`
* **Purpose**: Chronological, millisecond-precision forensic stream across all security sensors (`USB`, `FILE_SYSTEM`, `WEB_ACCESS`, `AGENT_TAMPER`) with facet filters, CSV/JSON export, and cursor pagination over ClickHouse `security_dlp_events_stream`.
* **Fastify Endpoint**: `GET /api/v1/security/events/timeline`

#### `SEC-007` — Security Policies Configuration
* **Route**: `/security/policies`
* **Purpose**: Master policy matrix managing inheritance hierarchy (`USER` > `TEAM` > `DEPARTMENT` > `GLOBAL`), offline grace windows, and real-time Redis Pub/Sub policy push (`security:policy:sync`) to connected desktop agents.
* **Fastify Endpoints**:
  - `GET /api/v1/security/policies`
  - `POST /api/v1/security/policies`
  - `PUT /api/v1/security/policies/:id`

---

### 3.2 11-Layer Data Loss Prevention Engine (`DLP-001` to `DLP-011`)

| Screen ID | Layer # | Screen Name | Route | Core Inspection & Enforcement Mechanism |
| :--- | :--- | :--- | :--- | :--- |
| `DLP-001` | Overview | **DLP Command Dashboard** | `/dlp/dashboard` | Aggregates incidents by severity, channel, department, matched PII/IP patterns, and open review queues. |
| `DLP-002` | Layer 1 | **File Transfer Monitoring** | `/dlp/file-transfers` | Monitors SMB/NFS network share copies, FTP/SFTP/SCP transfers, AirDrop/Bluetooth transfers, and removable media copies. |
| `DLP-003` | Layer 2 | **Upload Monitoring & Blocking** | `/dlp/uploads` | Inspects HTTP/HTTPS `POST`/`PUT` multipart/form-data and WebRTC/WebSocket binary frames via Browser Native Host & local proxy; blocks uploads to unauthorized domains or exceeding size/regex thresholds. |
| `DLP-004` | Layer 3 | **Download Monitoring & Blocking** | `/dlp/downloads` | Tracks browser & app downloads (`Chrome`, `Edge`, `Firefox`, `Brave`, `curl`), hashes downloaded files (SHA-256), and blocks dangerous extensions (`.exe`, `.msi`, `.bat`, `.scr`, `.ps1`) or unauthorized exports from CRM/ERP domains. |
| `DLP-005` | Layer 4 | **Clipboard Copy/Paste Monitoring** | `/dlp/clipboard` | Hooks OS clipboard listener; tracks source application (`Excel`, `VS Code`, `DBeaver`) and destination application (`ChatGPT`, `Personal Gmail`, `WhatsApp Web`). Redacts raw sensitive strings in logs while recording character count and regex classification (`CREDIT_CARD`, `SOURCE_CODE`, `API_KEY`). |
| `DLP-006` | Layer 5 | **Print Job Monitoring** | `/dlp/print-jobs` | Hooks Windows Print Spooler (`JOB_INFO_2`) and CUPS; captures document title, printer name (physical vs. `Microsoft Print to PDF`), page count, color mode, and blocks unauthorized printing of confidential filenames. |
| `DLP-007` | Layer 6 | **Email Data Protection** | `/dlp/email-protection` | Monitors Outlook MAPI/COM add-in, Thunderbird, and Webmail DOM (`Gmail`, `Outlook Web`, `Yahoo`, `ProtonMail`) for outbound emails to external domains containing attachments or sensitive regex matches. |
| `DLP-008` | Layer 7 | **Cloud Upload Monitoring** | `/dlp/cloud-uploads` | Differentiates corporate vs. personal cloud storage (`Google Drive`, `OneDrive`, `Dropbox`, `Box`, `WeTransfer`, `Mega.nz`, `iCloud`) by inspecting account headers/sync folder paths; blocks personal cloud sync folders while permitting corporate tenant sync. |
| `DLP-009` | Layer 8 | **Application Access Control / Blacklist** | `/dlp/app-control` | Process creation hook (`PsSetCreateProcessNotifyRoutineEx` / `ES_EVENT_TYPE_AUTH_EXEC`) that blocks blacklisted executables by image name, publisher certificate, or SHA-256 hash (e.g., `tor.exe`, `ngrok`, unauthorized remote desktop tools, packet sniffers). |
| `DLP-010` | Layer 9 | **Website Access Control (DLP Context)** | `/dlp/website-control` | Context-aware web DLP rule matrix: e.g., allow `chatgpt.com` or `github.com` in read-only mode while blocking file upload inputs (`<input type="file">`) and clipboard paste events (`paste` DOM event interception). |
| `DLP-011` | Layer 10/11 | **DLP Incident Detail & Forensics** | `/dlp/incidents/:id` | Deep-dive forensic view for a single DLP violation showing user context, matched regex classifiers (masked), pre-signed S3 screenshot at the exact moment of attempt, optional quarantined shadow file download (requires `dlp:shadow_copy:download` + MFA re-auth), user justification text, and one-click escalation to `SUSP-004` investigation. |

---

### 3.3 Suspicious Activity & Anti-Cheat Engine (`SUSP-001` to `SUSP-004`)

#### `SUSP-001` — Suspicious Activity Dashboard
* **Route**: `/security/suspicious-activity`
* **Purpose**: Real-time triage board displaying flagged behavioral anomalies, anti-cheat triggers, confidence scores, affected billable/productive hours, and workflow stages (`ALERT` through `CLOSE`).

#### `SUSP-002` — Anti-Cheat & Behavior Rules Engine
* **Route**: `/security/suspicious-activity/rules`
* **Purpose**: Configure mathematical thresholds and automated responses for HydiEms's deterministic + statistical anti-cheat detectors:
  1. **Hardware & Software Mouse Jiggler Detection**:
     - **OS Injected Flag Check**: Immediately flags Windows `LLMHF_INJECTED` / `LLKHF_INJECTED` flags in `MSLLHOOKSTRUCT` or macOS `kCGEventSourceStateHIDSystemState` mismatches caused by `SendInput`, `mouse_event`, `PyAutoGUI`, or `AutoHotkey`.
     - **Kinematic Shannon Entropy**: Every 60-second active window is divided into displacement vectors $(\Delta x_i, \Delta y_i)$ quantized into 8 compass octants. Normal human cursor movement exhibits directional Shannon entropy $H \ge 1.85\text{ bits}$ and log-normal velocity profiles (Fitts's Law). Mechanical/USB mouse jigglers exhibit either constant tiny pixel oscillations ($\Delta x \in \{-1, +1\}, \Delta y = 0$) with low entropy $H < 0.65\text{ bits}$ or a sharp Fast Fourier Transform (FFT) spectral peak at a fixed interval ($T \in [1\text{s}, 60\text{s}]$) accompanied by zero active window title changes (`active_window_switches = 0`) over $\ge 15\text{ minutes}$.
     - **USB Descriptor Fingerprinting**: Cross-checks connected HID Mouse `VID:PID` descriptors against known spoofed or generic microcontroller jiggler signatures (e.g., DigiSpark/ATtiny85/RP2040 HID descriptors claiming mouse movement with zero button presses over hours).
  2. **Stuck / Weighted Key Detection**:
     - Detects a single virtual keycode (`VK_SPACE`, `VK_SHIFT`, `VK_CONTROL`, `VK_DOWN`) repeating continuously for $\ge 120\text{ seconds}$ (`single_key_max_streak >= 600`) with zero other key transitions (`unique_keys_pressed = 1`) and zero window switches.
  3. **Auto-Clicker & Macro Loop Detection**:
     - Computes the Coefficient of Variation ($CV = \sigma_{\Delta t} / \mu_{\Delta t}$) of inter-click intervals ($\Delta t_i$) and cursor coordinates $(x_i, y_i)$ over $\ge 50$ clicks. If $CV_{\Delta t} < 0.025$ and spatial variance $\sigma_{x,y} < 2.0\text{ px}$ across non-gaming work apps, flags `AUTO_CLICKER_MACRO` with confidence $\ge 96\%$.

#### `SUSP-003` — Suspicious Alert Detail & Multi-Modal Evidence Viewer
* **Route**: `/security/suspicious-activity/alerts/:id`
* **Purpose**: Displays complete forensic evidence package for an alert:
  - **Kinematics Telemetry Graph**: Interactive chart plotting Mouse Entropy, Click Interval CV, Key Repeat Streak, and Window Switches over the flagged timeframe.
  - **Synchronized Visual Evidence**: Linked screenshots before/during/after the alert, 30-second MP4/WebM screen recording clip streamed via 60-second TTL S3 pre-signed URL, and connected USB/HID hardware tree.
  - **Timesheet Impact Calculator**: Shows exact duration of synthetic activity (e.g., `47m 20s`) and provides an atomic button to **Deduct Unverified Idle/Simulated Time** from the employee's attendance/timesheet record.

#### `SUSP-004` — 6-Step Investigation Workflow State Machine
* **Route**: `/security/suspicious-activity/investigations/:id`
* **State Machine (`ALERT -> REVIEW -> ASSIGN -> INVESTIGATE -> RESOLVE -> CLOSE`)**:

```mermaid
stateDiagram-v2
    [*] --> ALERT : Agent / Analytics Engine Triggers Rule
    ALERT --> REVIEW : Security Analyst Opens & Validates Telemetry
    REVIEW --> CLOSE : Dismissed as False Positive (Requires Reason)
    REVIEW --> ASSIGN : Escalated & Assigned to Investigator / HR / Manager
    ASSIGN --> INVESTIGATE : Investigator Begins Forensic & Employee Review
    INVESTIGATE --> RESOLVE : Findings Recorded + Action Applied (Time Deducted / Warning)
    RESOLVE --> CLOSE : Final Sign-off & Immutable Audit Seal
    CLOSE --> [*]
```

* **Stage Transition Rules & Guards**:
  1. `ALERT -> REVIEW`: Triggered when a user with `suspicious:alert:review` acknowledges the alert. Records `first_response_at` SLA metric.
  2. `REVIEW -> ASSIGN`: Requires non-empty `assigned_investigator_id` and preliminary triage notes.
  3. `ASSIGN -> INVESTIGATE`: Investigator accepts ownership; freezes automatic TTL deletion on linked ClickHouse telemetry and S3 screenshots/recordings (`Legal Hold` flag set on S3 object tags).
  4. `INVESTIGATE -> RESOLVE`: Requires selecting `resolution_outcome` (`CONFIRMED_VIOLATION`, `COACHED_WARNING`, `TIME_DEDUCTED`, `FALSE_POSITIVE`, `HARDWARE_FAULT`) and `root_cause_summary` (min 20 characters). If `TIME_DEDUCTED` is chosen, executes an atomic transaction updating `timesheet_entries` and writing an adjustment ledger record.
  5. `RESOLVE -> CLOSE`: Requires sign-off by a user with `suspicious:investigation:close` (cannot be the same user who created a manual alert if dual-control is enabled). Seals the investigation record and releases or retains the S3 legal hold per policy.

---

## 4. Fastify REST & WebSocket API Specifications

### 4.1 Desktop Agent Batch Ingestion Endpoint (`POST /api/v1/agent/security-dlp/events`)
* **Auth**: Mutual TLS / Device Ed25519 Bearer JWT (`hydi-agent-token`)
* **Rate Limit**: 120 requests/min per device
* **Request Schema (Zod / TypeBox)**:
```json
{
  "deviceId": "019283a4-7c11-7000-8000-000000000001",
  "policyVersion": 14,
  "events": [
    {
      "eventId": "019283a5-1100-7000-8000-112233445566",
      "eventCategory": "CLIPBOARD",
      "eventAction": "PASTE",
      "policyDecision": "BLOCKED",
      "severity": "HIGH",
      "processName": "chrome.exe",
      "processSha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "sourceEntity": "Microsoft Excel - Payroll_Q3_2026.xlsx",
      "destinationEntity": "https://chatgpt.com/c/89ab-12cd",
      "dlpMatchedPatterns": ["INDIA_PAN_NUMBER", "SALARY_COMPENSATION_TABLE"],
      "dlpMatchCount": 42,
      "occurredAt": "2026-09-26T16:40:12.419Z"
    }
  ]
}
```
* **Processing Pipeline**:
  1. Validates device token and tenant status via Redis cache.
  2. Writes all events asynchronously to ClickHouse `security_dlp_events_stream` via buffered batch insert (flush every 1,000 rows or 1,000ms).
  3. For any event where `severity IN ('HIGH', 'CRITICAL')` or `policyDecision IN ('BLOCKED', 'QUARANTINED')`, inserts an OLTP row into MySQL `dlp_incidents`, generates a pre-signed S3 upload URL (`PUT` TTL 300s) for the forensic screenshot if `capture_screenshot_on_trigger = true`, and broadcasts a WebSocket alert (`dlp:incident:created`) to subscribed Security Admins.

### 4.2 Investigation Stage Transition Endpoint (`POST /api/v1/security/suspicious-activity/alerts/:id/transition`)
* **Request Body**:
```json
{
  "targetStage": "RESOLVE",
  "assignedInvestigatorId": "019283a0-0000-7000-8000-000000000099",
  "resolutionOutcome": "TIME_DEDUCTED",
  "deductedTimesheetSeconds": 2840,
  "rootCauseSummary": "Confirmed USB hardware mouse jiggler (VID:16C0 PID:0486) oscillating cursor +/- 1px every 5000ms with zero keyboard or window switch activity between 14:10 and 14:57.",
  "notes": "Employee acknowledged leaving hardware jiggler plugged in during break. Deducted 47m 20s from active work log."
}
```
* **Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "alertId": "019283a9-8811-7000-8000-000000009182",
    "alertCode": "SUSP-2026-001920",
    "previousStage": "INVESTIGATE",
    "currentStage": "RESOLVE",
    "resolutionOutcome": "TIME_DEDUCTED",
    "deductedTimesheetSeconds": 2840,
    "auditLogId": "019283aa-0012-7000-8000-998877665544"
  }
}
```

---

## 5. RBAC Permission Matrix & Validation Rules

### 5.1 RBAC Permissions
| Permission Key | Super Admin | Security / DLP Admin | HR Admin | Dept Manager | Employee |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `security:dashboard:view` | ✅ | ✅ | ❌ | Scoped (Team) | ❌ |
| `security:usb_policy:manage` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `security:website_policy:manage` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `dlp:incidents:view` | ✅ | ✅ | Scoped (Escalated) | Scoped (Team) | ❌ |
| `dlp:policies:manage` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `dlp:shadow_copy:download` | ✅ (MFA) | ✅ (MFA) | ❌ | ❌ | ❌ |
| `suspicious:alert:view` | ✅ | ✅ | ✅ | Scoped (Team) | ❌ |
| `suspicious:alert:review` | ✅ | ✅ | ✅ | Scoped (Team) | ❌ |
| `suspicious:investigation:resolve` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `suspicious:investigation:close` | ✅ | ✅ | ❌ | ❌ | ❌ |

### 5.2 Validation Rules
1. **Regex Safety (ReDoS Prevention)**: Every custom regex pattern submitted in `DLP-001..010` is validated through `re2` linear-time regex compiler check before saving to `dlp_policies.regex_patterns`. Backreferences and exponential catastrophic backtracking constructs are rejected with `422 ERR_UNSAFE_REGEX_PATTERN`.
2. **USB VID/PID Format**: `vendor_id` and `product_id` must match `/^[0-9A-Fa-f]{4}$/`.
3. **PII Masking at Rest in DLP Logs**: Matched substrings stored in `dlp_incidents.matched_rules` must be automatically masked by the agent before transmission (e.g., `4532-****-****-8891` for credit cards, `ABCDE****F` for PAN) unless `capture_shadow_file_copy` is explicitly authorized.
4. **Strict Workflow State Machine**: Direct transitions that skip mandatory stages (e.g., `ALERT -> RESOLVE`) return `409 ERR_INVALID_WORKFLOW_TRANSITION` unless `REVIEW -> CLOSE` is used specifically for `FALSE_POSITIVE`.

---

## 6. Immutable Audit Events & Acceptance Criteria

### 6.1 Emitted Audit Events (Routed to Phase 26 Hash-Chained Audit Log)
* `SECURITY_POLICY_CREATED`, `SECURITY_POLICY_UPDATED`, `SECURITY_POLICY_DELETED`
* `USB_WHITELIST_DEVICE_ADDED`, `USB_WHITELIST_DEVICE_REVOKED`
* `DLP_POLICY_UPDATED`, `DLP_INCIDENT_REVIEWED`, `DLP_SHADOW_COPY_DOWNLOADED`
* `SUSPICIOUS_RULE_MODIFIED`, `SUSPICIOUS_ALERT_STAGE_CHANGED`, `SUSPICIOUS_ALERT_TIME_DEDUCTED`

### 6.2 Engineering Acceptance Criteria
1. **Sub-Second Policy Enforcement**: Updating a USB (`SEC-003`) or DLP (`DLP-003..010`) policy propagates via Redis Pub/Sub and WebSocket to online desktop agents in `< 500ms` (p95) and enforces locally even if the endpoint subsequently disconnects from the network.
2. **Zero False-Positive Human Cursor Blocking**: The `SUSP-002` mouse jiggler detector achieves `< 0.1%` false-positive rate against genuine human CAD/reading/coding sessions by combining directional Shannon entropy ($H < 0.65$), FFT periodicity, `active_window_switches == 0`, and OS synthetic input flags.
3. **End-to-End 6-Step Investigation Integrity**: Every transition across `Alert -> Review -> Assign -> Investigate -> Resolve -> Close` (`SUSP-004`) persists an immutable record in `suspicious_investigation_logs` and atomically reconciles deducted seconds with the employee's timesheet when `TIME_DEDUCTED` is selected.
