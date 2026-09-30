# PHASE 09: DESKTOP AGENT NATIVE XAML/AVALONIA UI (16 VIEWS), TRACKER OPERATING MODES & ENTERPRISE FLEET DEPLOYMENT

**Document Classification:** Master Engineering & Screen-by-Screen Specification (Phase 09 of 12)  
**Client UI Framework:** Avalonia UI 11.1 (Cross-Platform Skia-accelerated XAML, MVVM via `CommunityToolkit.Mvvm`, ReactiveUI)  
**Web Admin Fleet Console:** Next.js 14 / React 18 + Fastify 4.x + MySQL 8.0 + Redis 7.2 + S3 Signed Release Artifacts  

---

## 1. ARCHITECTURAL OVERVIEW: EMPLOYEE AGENT UI, 6 TRACKER MODES & ADMIN FLEET MANAGEMENT

Phase 09 defines three tightly integrated layers:
1. **Employee-Facing Core Functional Modules (`AGENT-001..005`):** The logical navigation tabs (`Home`, `Time`, `Hours`, `More`) and the **6 Deterministic Tracker Operating Modes** (`Interactive`, `Automatic`, `Silent/Stealth`, `Visible`, `Manual`, `Task-Based`).
2. **16 Native XAML/Avalonia Views (`DA-1..DA-16`):** The complete windowing, system tray, overlay blocker, modal, and background controller specifications compiled into `HydiEms.Agent.exe`.
3. **Web Admin Fleet & Bulk Deployment Console (`AGENT-ADMIN-001..006` & `DEPLOY-001..003`):** Centralized management of agent releases, MSI/PKG/DEB/RPM installers, GPO/Intune/Jamf silent enrollment tokens, remote config pushes, and forced canary/production updates or instant rollbacks.

---

## 2. TRACKER OPERATING MODES SPECIFICATION (`AGENT-005`)

Every employee's effective policy (`COALESCE(employee_policy_overrides.tracker_mode_override, dept_policy.tracker_mode, org_policy.tracker_mode)`) dictates how `HydiEms.Agent.exe` behaves at OS login, during the shift, and in the system tray:

| Tracker Mode | OS Login Behavior | System Tray & Window Visibility | User Start/Stop Control | Task Selection Requirement | Primary Enterprise Use Case |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`INTERACTIVE`** | Launches main window (`DA-4`); waits for user to click `[Start Work]`. | Visible in Taskbar & System Tray; full access to `DA-1..14`. | User can Start, Pause/Break, enter Personal Mode, and Finish Shift. | Optional task selection. | Standard white-collar, hybrid, and remote employees. |
| **`AUTOMATIC`** | Begins tracking immediately upon interactive OS session logon (`WTSActive`) or Shift Start window. | Visible in System Tray; opens `DA-4` on click; `Finish` button disabled during shift hours. | Cannot manually stop tracking during shift; can only select Break Reason (`DA-6`) or Personal Mode (if allowed). | Optional. | BPO, Customer Support, Operations, In-Office workstations. |
| **`SILENT_STEALTH`** | Runs 100% headlessly via `DA-16` (`SilentModeController`); zero windows, zero tray icon, zero toast notifications. | **Completely Hidden** (`ShowInTaskbar = false`, TrayIcon unmounted). | None (100% automated from OS logon to logoff/shutdown). | None. | Insider threat monitoring, company-owned kiosk/terminal PCs, regulated environments. |
| **`VISIBLE`** | Automatically tracks like `AUTOMATIC`, but renders a persistent mini status pill / tray indicator so the employee has transparent visibility that monitoring is active. | Persistent Tray Icon + read-only `DA-4` status window (`Start/Stop` buttons hidden). | Read-only visibility + Break Reason & Idle Split (`DA-8`) prompts active. | Optional. | EU/GDPR works-council compliant automatic tracking where covert monitoring is prohibited. |
| **`MANUAL`** | Does not auto-track background idle/active states unless timer is running, and unlocks manual timesheet block entry (`TIME-004`). | Full `DA-4` UI + Manual Time Entry sheet. | User controls timer and can submit manual retroactive time blocks. | Optional or Required per project. | Executives, Field Sales, Legal Counsel, External Consultants. |
| **`TASK_BASED`** | Blocks `[Start Work]` and `[Resume]` unless an active `Project` and `Task` are selected from the combobox in `DA-4`. | Full `DA-4` UI with mandatory Project/Task selector and quick-switcher (`Ctrl+Alt+T`). | User starts/switches tasks; switching task closes the current 10s slice and starts a new slice bound to the new `task_id`. | **Strictly Mandatory** (`task_id NOT NULL`). | Software Agencies, Engineering Billable Sprints, Architecture/Accounting Firms. |

---

## 3. EMPLOYEE-FACING DESKTOP AGENT LOGICAL MODULES (`AGENT-001..004`)

### 3.1 `AGENT-001` — Agent Home (Primary Timer, Target Progress, Actions & Task Switcher)
- **Compact Window Dimensions:** `380px × 600px` (DPI-aware vector layout, dark/light theme adaptive, pinnable Always-On-Top mini-bar mode `380px × 56px`).
- **Live Telemetry Header:**
  - Employee Avatar, Name, Role, Connection Status LED (`Green = Live WS`, `Amber = Offline Spooling (14 slices queued)`).
  - Active Shift Pill (`Morning Shift: 09:00 – 18:00 • Grace: 15m`).
- **Primary Circular / Digital Timer Ring:**
  - Displays `Today's Working Time` (`06:42:18`) against `Daily Target` (`08:00:00` — `83.8%` ring fill).
  - Sub-metrics Strip: `Productive: 05h 50m (87%)` | `Neutral: 00h 32m` | `Idle: 00h 20m` | `Break/Away: 00h 45m`.
- **State Action Button Matrix (Governed by `AGENT-005` Mode):**
  - `[▶ Start Work]` (when `OFFLINE` / `NOT_STARTED`).
  - `[⏸ Take Break / Away]` -> Opens `DA-6` Break Reason selector (`Lunch`, `Tea/Coffee`, `Client Call`, `Washroom`, `Training`).
  - `[▶ Resume Work]` (when `ON_BREAK` or `PERSONAL_MODE`).
  - `[🛡 Personal Mode]` -> Activates `TIME-009` privacy shield (pauses all app/URL/screenshot/keystroke capture while displaying countdown of remaining daily Personal Mode allowance, e.g., `24m / 30m left`).
  - `[⏹ Finish Shift]` -> Prompts end-of-day confirmation & opens `DA-5` Daily Summary.
- **Active Project & Task Switcher Bar:**
  - Searchable dropdown bound to local SQLite cache of assigned `projects` and `tasks` (`[Project: HydiEms v3] -> [Task: FE-402 Activity Timeline]`).

### 3.2 `AGENT-002` — Agent Time (Intraday Session Ledger & Away Log)
- Displays chronological list of today's continuous work sessions, break intervals, idle splits, and personal mode windows (`09:02 - 11:15 Working [2h 13m]`, `11:15 - 11:30 Break: Coffee [15m]`, `11:30 - 13:10 Working [1h 40m]`).
- Allows the employee to click `[Request Correction]` on any disputed block (deep-links or submits directly to `ATT-006` / `TIME-004`).

### 3.3 `AGENT-003` — Agent Hours (Day / Week / Month Aggregated Analytics)
- **3 Segmented Views (`Day` | `Week` | `Month`):**
  - **Day:** Hourly stacked bar chart (`00:00..23:00`) showing Productive (Emerald), Neutral (Slate), Unproductive (Rose), Idle (Amber), Away (Purple).
  - **Week:** 7-bar Mon–Sun chart comparing actual hours against weekly target (`36.5h / 40.0h`), overtime accrued (`+1.5h`), and weekly productivity average (`84.6%`).
  - **Month:** Compact heatmap calendar colored by attendance status (`Present`, `Late`, `Half-Day`, `Leave`, `Absent`) + monthly totals.

### 3.4 `AGENT-004` — Agent More (Diagnostics, Schedule, My Activity, QR Pairing & Settings)
- Navigation hub linking to:
  - `My Activity & Top Apps` (`DA-9`)
  - `System & Time Events Log` (`DA-10`)
  - `My Shift & Hybrid Schedule` (`DA-11`)
  - `Offline SQLite Spool & Sync Status` (`DA-13`)
  - `Pair Mobile Companion App via QR` (`DA-14`)
  - `Check for Agent Updates` / `Export Local Diagnostic Bundle (.zip)` / `Sign Out` (disabled if policy locks sign-out).

---

## 4. COMPLETE 16 NATIVE XAML / AVALONIA VIEWS SPECIFICATION (`DA-1..DA-16`)

Every view in `HydiEms.Agent.UI` uses compiled XAML bindings (`x:DataType`), hardware-accelerated Skia rendering (with automatic fallback to software rendering when inside RDP/Citrix sessions to conserve GPU/RAM), and zero background rendering when minimized to tray.

| View ID | XAML View Class | Window Type & Size | Trigger Condition | ViewModel State, Controls & Backend/IPC Integration |
| :--- | :--- | :--- | :--- | :--- |
| **`DA-1`** | `SplashView.axaml` | Frameless Center Popup (`420×260`) | Process startup (non-Stealth modes) | Verifies SQLCipher DB integrity, connects to `HydiEms.Service` Named Pipe, checks local device enrollment token, transitions to `DA-2` (if unauthenticated) or `DA-4` (if token valid) in `< 800ms`. |
| **`DA-2`** | `LoginSsoView.axaml` | Standard Window (`400×540`) | Unenrolled device or expired user session | Supports: (1) Corporate Email + Password + TOTP MFA, (2) SAML 2.0 / OIDC PKCE Browser Loopback (`http://127.0.0.1:{ephemeralPort}/callback` for Okta/Entra ID/Google Workspace), (3) Silent Machine Enrollment Token binding. Calls `POST /api/v1/agent/auth/login`. |
| **`DA-3`** | `ForgotPasswordView.axaml` | Modal View inside `DA-2` (`400×540`) | User clicks *"Forgot Password?"* in `DA-2` | Validates email format, submits `POST /api/v1/auth/password-reset/request` with rate-limit cooldown timer (`60s`), displays OTP/Reset Link instructions, returns to `DA-2`. |
| **`DA-4`** | `MainTrackerWindow.axaml` | Main Shell Window (`380×600`) + Mini-Bar (`380×56`) | Authenticated active session (Modes: `INTERACTIVE`, `AUTOMATIC`, `VISIBLE`, `MANUAL`, `TASK_BASED`) | Hosts the 4 bottom-navigation tabs (`AGENT-001` Home, `AGENT-002` Time, `AGENT-003` Hours, `AGENT-004` More). Binds at 1Hz to `TrackerSessionViewModel` only when window `IsVisible == true` (zero UI CPU when closed to tray). |
| **`DA-5`** | `ShiftSummaryModal.axaml` | Modal Dialog (`440×520`) | User clicks `[Finish Shift]` or Shift End auto-triggers | Displays complete scorecard of the completed shift: Total Worked Hours, Productive %, Tasks Worked On, Breaks Taken, Unaccounted Idle Minutes, and optional `"End-of-Day Standup Note"` textarea submitted to `POST /api/v1/agent/shift/complete`. |
| **`DA-6`** | `BreakReasonModal.axaml` | Topmost Prompt (`400×420`) | User clicks `[Take Break]` in `DA-4` | Displays organization-configured Away Reasons (`TIME-007`: *Lunch*, *Tea/Coffee*, *Client Call*, *In-Person Meeting*, *Washroom*, *Personal*, *Training*) with remaining daily quota badge per reason (e.g., `Lunch: 45m / 60m remaining`) + optional questionnaire/note field. |
| **`DA-7`** | `IdleCountdownBlockerWindow.axaml` | Full-Screen Multi-Monitor Translucent Overlay + Center Card (`480×320`) | `system_idle_seconds >= (idle_timeout_seconds - 30)` | **30-Second Pre-Idle Warning & Screen Blocker:** Appears 30s before idle threshold is reached with an audible/visual countdown (`"Are you still working? Moving into IDLE state in 18s..."`). Moving mouse or pressing `[I'm Still Working]` dismisses overlay; reaching `0s` transitions agent state to `IDLE` and locks/dims work timer. |
| **`DA-8`** | `IdleAwaySplitModal.axaml` | Topmost Always-On-Top Modal (`520×480`) | User returns (mouse/keyboard input) after an `IDLE` block `>= idle_timeout_seconds` | **Retroactive Idle Time Splitting Workbench:** Displays *"You were away from your computer for 24m 10s (14:10 – 14:34). How should this time be recorded?"* <br>Supports **Timeline Split Slider**: e.g., Split the 24m block into `First 15m = Client Call (Productive Away - Project X)` + `Remaining 9m 10s = Coffee Break (Unpaid Idle)`. Submits signed split record to `POST /api/v1/agent/time/resolve-idle`. |
| **`DA-9`** | `MyActivityView.axaml` | Sub-View / Expandable Window (`720×560`) | Opened from `AGENT-004` (`More -> My Activity`) | Transparent self-service view showing the employee's own top applications, websites, productivity classification (`Productive`/`Neutral`/`Unproductive`), keyboard/mouse intensity curve, and recent captured screenshots (with `[Delete Screenshot]` button if `screenshot_allow_user_delete = true`). |
| **`DA-10`** | `TimeSystemEventsView.axaml` | Diagnostic Ledger View (`680×500`) | Opened from `AGENT-004` (`More -> System Events`) | Chronological table of OS & session lifecycle events captured today: `OS_LOGON`, `SHIFT_START`, `SCREEN_LOCK`, `SCREEN_UNLOCK`, `SLEEP_SUSPEND`, `WAKE_RESUME`, `NETWORK_DISCONNECTED`, `NETWORK_RESTORED`, `IDLE_STARTED`, `IDLE_RESOLVED`, `POLICY_UPDATED_V14`. |
| **`DA-11`** | `ShiftScheduleView.axaml` | Calendar & Roster View (`680×520`) | Opened from `AGENT-004` (`More -> Shift Schedule`) | Displays the employee's upcoming 14-day Shift Roster (`SHIFT-005`) and Hybrid Work Location assignment (`HYB-002`: `🏢 HQ Office` vs `🏠 Remote`) with shift start/end times in local timezone and grace period rules. |
| **`DA-12`** | `WorkTimeMatrixViolationModal.axaml` | Topmost Compliance Prompt (`460×340`) | Triggered on rule breach (e.g., Late Login, Exceeded Break Quota, Unapproved Overtime, Working Outside Allowed Window) | Displays the specific policy rule violated (e.g., *"You logged in 22 minutes after Shift Start + Grace Period (09:15)"* or *"Break 'Tea/Coffee' exceeded max 15m allowance"*), requires selecting a standardized reason code + explanation note before dismissing. |
| **`DA-13`** | `SqliteSyncStatusView.axaml` | Telemetry Queue Inspector (`560×440`) | Opened from `AGENT-004` or clicking Sync LED in `DA-4` | Real-time diagnostic view of `agent_spool.db`: Pending 10s Activity Slices count, Pending Screenshots/Video MB, DLP Events queued, Last Successful Batch Sync timestamp, Server Latency (`28ms`), and `[Force Sync Now]` button. |
| **`DA-14`** | `ToastAndMobileQrView.axaml` | Corner Toast (`340×96`) & QR Modal (`360×420`) | System notifications & Mobile Companion pairing | (1) Non-intrusive bottom-right native toast for screenshot capture notice (when policy enables `notify_on_screenshot`), shift reminders, and break warnings. <br>(2) Dynamic 60-second rotating JWT QR code allowing the employee to pair the HydiEms iOS/Android app for Field GPS & Mobile Punch-In. |
| **`DA-15`** | `SubscriptionEndedView.axaml` | Locked State Window (`400×460`) | Server returns `402 SUBSCRIPTION_SUSPENDED` or `403 SEAT_REVOKED` | Gracefully halts new screenshot/video capture, preserves any un-synced historical SQLite spool on disk, and displays an informational card instructing the user or IT Admin that the organization's seat license is inactive, with `[Retry License Check]` button. |
| **`DA-16`** | `SilentModeController.cs` | Headless Background Controller (`0×0` — No Window) | Active when `tracker_mode == 'SILENT_STEALTH'` | Completely suppresses `DA-1..DA-15` windows, unmounts `TrayIcon`, disables all toast popups (`DA-14`) and idle overlays (`DA-7`/`DA-8`), and executes 100% automated background telemetry harvesting from OS session start to logoff. |

---

## 5. ADMIN AGENT FLEET & DEPLOYMENT MANAGEMENT (`AGENT-001..006` & `DEPLOY-001..003`)

---

### 5.1 Database DDL for Agent Releases, Deployment Tokens & Fleet Rollouts (MySQL 8.0)

```sql
CREATE TABLE IF NOT EXISTS agent_releases (
    id BINARY(16) NOT NULL,
    version_semver VARCHAR(32) NOT NULL COMMENT 'e.g., 2.4.1',
    channel ENUM('STABLE', 'CANARY', 'HOTFIX') NOT NULL DEFAULT 'STABLE',
    os_platform ENUM('WINDOWS', 'MACOS', 'LINUX') NOT NULL,
    os_arch ENUM('X64', 'ARM64', 'UNIVERSAL') NOT NULL,
    installer_format ENUM('MSI', 'EXE_NSIS', 'PKG', 'DMG', 'DEB', 'RPM') NOT NULL,
    
    s3_artifact_key VARCHAR(512) NOT NULL,
    file_size_bytes BIGINT UNSIGNED NOT NULL,
    sha256_checksum CHAR(64) NOT NULL,
    ed25519_signature VARCHAR(255) NOT NULL COMMENT 'Verified by HydiEms.Service before executing update',
    
    min_supported_version VARCHAR(32) NOT NULL DEFAULT '2.0.0',
    is_mandatory_update BOOLEAN NOT NULL DEFAULT FALSE,
    release_notes_md TEXT NULL,
    published_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    is_yanked BOOLEAN NOT NULL DEFAULT FALSE,
    
    PRIMARY KEY (id),
    UNIQUE KEY uq_release_ver_plat (version_semver, os_platform, os_arch, installer_format)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS org_deployment_tokens (
    id BINARY(16) NOT NULL,
    org_id BINARY(16) NOT NULL,
    token_name VARCHAR(120) NOT NULL COMMENT 'e.g., Intune Windows 11 Production Rollout Q3',
    token_hash_sha256 CHAR(64) NOT NULL,
    token_prefix CHAR(12) NOT NULL,
    
    -- Default bindings when a machine silently enrolls using this token
    default_department_id BINARY(16) NULL,
    default_monitoring_policy_id BINARY(16) NULL,
    auto_map_ad_upn_to_email BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Maps Windows WhoAmI / Entra UPN or macOS shortname to employees.email',
    auto_create_employee_if_missing BOOLEAN NOT NULL DEFAULT FALSE,
    
    max_enrollments INT UNSIGNED NULL,
    current_enrollments INT UNSIGNED NOT NULL DEFAULT 0,
    expires_at DATETIME(3) NOT NULL,
    revoked_at DATETIME(3) NULL,
    created_by BINARY(16) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_dep_token_hash (token_hash_sha256),
    KEY idx_dep_org_active (org_id, revoked_at, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS fleet_update_jobs (
    id BINARY(16) NOT NULL,
    org_id BINARY(16) NOT NULL,
    target_release_id BINARY(16) NOT NULL,
    action_type ENUM('UPGRADE', 'ROLLBACK') NOT NULL DEFAULT 'UPGRADE',
    rollout_strategy ENUM('IMMEDIATE_ALL', 'STAGED_CANARY_10_50_100', 'DEPARTMENT_SCOPED', 'EXPLICIT_DEVICES') NOT NULL,
    target_filter_json JSON NOT NULL,
    
    total_targeted_devices INT UNSIGNED NOT NULL DEFAULT 0,
    downloading_count INT UNSIGNED NOT NULL DEFAULT 0,
    installing_count INT UNSIGNED NOT NULL DEFAULT 0,
    succeeded_count INT UNSIGNED NOT NULL DEFAULT 0,
    failed_count INT UNSIGNED NOT NULL DEFAULT 0,
    
    status ENUM('SCHEDULED', 'IN_PROGRESS', 'PAUSED_ON_FAILURE_THRESHOLD', 'COMPLETED', 'ABORTED') NOT NULL DEFAULT 'IN_PROGRESS',
    auto_pause_failure_rate_pct TINYINT UNSIGNED NOT NULL DEFAULT 5 COMMENT 'Halts rollout if >5% of endpoints fail update',
    initiated_by BINARY(16) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    completed_at DATETIME(3) NULL,
    PRIMARY KEY (id),
    KEY idx_fuj_org (org_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

---

### 5.2 Screen-by-Screen Specifications: Web Admin Agent & Deployment Console (`PART AH: AGENT-001..006` / `AGENT-ADMIN-001..006`)

#### `AGENT-001` (`AGENT-ADMIN-001`) — Agent Fleet Health & Telemetry Overview Dashboard
- **Route:** `/org/[orgSlug]/agents/dashboard`
- **Purpose:** Real-time fleet command center showing total enrolled endpoints, online vs. offline ratio, OS distribution (`Windows 11`, `Windows 10`, `macOS Sonoma/Sequoia`, `Ubuntu/RHEL`), version fragmentation donut, mean CPU/RAM footprint across the fleet, and active tamper/watchdog alerts.
- **Endpoints:** `GET /api/v1/agents/fleet-overview`
- **Acceptance Criteria:** Displays live P50/P95 Agent CPU % and RAM MB across the entire organization and flags any endpoint with `sqlite_spool_pending_bytes > 50MB` or `service_watchdog_status != 'HEALTHY'`.

#### `AGENT-002` (`AGENT-ADMIN-002`) — Agent Download & Silent Installer Generator
- **Route:** `/org/[orgSlug]/agents/downloads`
- **Purpose:** Provides one-click downloads for all OS/Arch installer packages (`.msi`, `.exe`, `.pkg`, `.dmg`, `.deb`, `.rpm`) pre-bundled or paired with an organization-specific `ORG_ENROLLMENT_TOKEN`, plus copy-pasteable PowerShell, Bash, Intune, Jamf, and Active Directory GPO deployment scripts.
- **Generated Silent Install Command (Windows MSI):**
  ```powershell
  msiexec.exe /i "HydiEmsAgent-2.4.1-win-x64.msi" /qn /norestart `
    HYDI_API_URL="https://api.hydiems.com" `
    HYDI_ENROLL_TOKEN="hydi_enroll_9f8a7b6c5d4e..." `
    HYDI_TRACKER_MODE="SILENT_STEALTH" `
    HYDI_MAP_AD_UPN="1"
  ```
- **Endpoints:** `GET /api/v1/agents/releases/latest`, `POST /api/v1/agents/enrollment-tokens`

#### `AGENT-003` (`AGENT-ADMIN-003`) — Agent Device List & Live Connection Grid
- **Route:** `/org/[orgSlug]/agents/devices`
- **Purpose:** Operational grid focused on agent runtime status, WebSocket connection latency, policy sync version (`v14 / v14 Synced` vs `v12 Outdated`), active Tracker Mode, OS TCC/Accessibility permission status (crucial on macOS: `Screen Recording Permission: Granted ✓`, `Accessibility Permission: Missing ⚠️`), and quick remote commands (`[Restart Agent]`, `[Collect Diagnostic Logs]`, `[Push Config]`).
- **Endpoints:** `GET /api/v1/agents/devices`, `POST /api/v1/agents/devices/:deviceId/command`

#### `AGENT-004` (`AGENT-ADMIN-004`) — Agent Device Detail & Remote Diagnostic Inspector
- **Route:** `/org/[orgSlug]/agents/devices/[deviceId]`
- **Purpose:** Deep-dive diagnostic view for a single endpoint showing 24h CPU/RAM telemetry, local SQLCipher table row counts (`activity_slice_queue`, `media_upload_queue`, `security_event_queue`), hook health status (`WH_KEYBOARD_LL: Active`, `DXGI Duplication: Active`, `WASAPI Peak Meter: Active`), and downloadable encrypted diagnostic log bundles.
- **Endpoints:** `GET /api/v1/agents/devices/:deviceId/diagnostics`, `POST /api/v1/agents/devices/:deviceId/fetch-logs`

#### `AGENT-005` (`AGENT-ADMIN-005`) — Remote Agent Configuration & Policy Sync Matrix
- **Route:** `/org/[orgSlug]/agents/remote-config`
- **Purpose:** Allows admins to configure global and group-level agent runtime parameters (Heartbeat interval overrides, S3 upload bandwidth throttling limit in KB/s for low-bandwidth branch offices, Sensitive App Blur blacklists, VPN CIDR exclusions, Local Spool Quota MB) and monitor real-time convergence as connected agents acknowledge the new `policy_version`.
- **Endpoints:** `GET /api/v1/agents/remote-config`, `PUT /api/v1/agents/remote-config`

#### `AGENT-006` (`AGENT-ADMIN-006`) — Agent Version & Auto-Update Channel Management
- **Route:** `/org/[orgSlug]/agents/updates`
- **Purpose:** Controls the organization's version pinning and auto-update policy (`Auto-Update to Latest Stable`, `Pin to Specific Version`, `Canary Ring for IT Dept + Stable Ring for Prod`), maintenance window hours (e.g., perform silent binary updates only between `02:00 – 05:00 local time` or at shift finish), and release notes inspection.
- **Endpoints:** `GET /api/v1/agents/update-policy`, `PUT /api/v1/agents/update-policy`

---

### 5.3 Enterprise Bulk Deployment & Rollback Screens (`DEPLOY-001..003`)

#### `DEPLOY-001` — Enterprise Bulk Deployment Wizard (GPO / Intune / Jamf / SCCM / RMM)
- **Route:** `/org/[orgSlug]/agents/deploy/wizard`
- **Purpose:** Step-by-step generator for zero-touch mass deployment across 500 to 50,000 corporate endpoints:
  1. **Select Target OS & MDM Tool:** Windows Active Directory GPO (`.mst` transform + startup script), Microsoft Intune (`.intunewin` + detection rules), Jamf Pro / Kandji (`.pkg` + PPPC Configuration Profile `.mobileconfig` pre-approving ScreenCaptureKit & Accessibility TCC on macOS so users never see macOS permission popups!), or Linux Ansible/Salt/apt repository.
  2. **Identity Mapping Strategy:** Automatic Active Directory / Entra ID `UserPrincipalName` (`UPN`) matching to `employees.email`, or `SAMAccountName` matching to `employees.employee_code`, with fallback auto-provisioning into an `Unassigned Onboarding` department.
  3. **Download Ready-to-Import Bundle:** Generates a signed `.zip` containing the installer, `.mst` / `.mobileconfig` profiles, and verification scripts.

#### `DEPLOY-002` — Live Deployment & Enrollment Wave Status Tracker
- **Route:** `/org/[orgSlug]/agents/deploy/status`
- **Purpose:** Tracks mass rollout progress against expected AD/HRIS directory headcount (`1,842 Enrolled / 2,000 Expected (92.1%)`), categorizing the remaining 158 endpoints into: *Pending First Boot*, *Enrolled - Unmatched User Identity*, *macOS TCC Permission Blocked*, or *Firewall/Proxy TLS Inspection Error*.
- **Endpoints:** `GET /api/v1/agents/deploy/wave-status`

#### `DEPLOY-003` — Forced Fleet Update & Atomic Rollback Controller
- **Route:** `/org/[orgSlug]/agents/deploy/rollouts`
- **Purpose:** Orchestrates staged binary upgrades (`10% Canary -> 50% -> 100%`) and **1-Click Emergency Rollback** via `HydiEms.Service.exe`.
- **Atomic Update & Rollback Mechanism in `HydiEms.Service.exe`:**
  1. `HydiEms.Service` downloads the target `.msi` / `.pkg` to `C:\ProgramData\HydiEms\Updates\`, verifies both `sha256_checksum` and the offline **Ed25519 cryptographic release signature**.
  2. Before applying any update, `HydiEms.Service` snapshots the currently working binary directory to `C:\ProgramData\HydiEms\Rollback\v{previousVersion}\`.
  3. It sends `CMD_FLUSH_AND_EXIT` to `HydiEms.Agent.exe`, applies the atomic update, and spawns the new `HydiEms.Agent.exe`.
  4. **Self-Healing Circuit Breaker:** If the newly updated `HydiEms.Agent.exe` fails to establish a healthy Named Pipe heartbeat within 15 seconds (or crashes twice within 3 minutes), `HydiEms.Service` automatically restores `C:\ProgramData\HydiEms\Rollback\v{previousVersion}\` and reports `ROLLBACK_AUTO_TRIGGERED` to `DEPLOY-003`. Furthermore, if `fleet_update_jobs.failed_count / total_targeted_devices > auto_pause_failure_rate_pct (5%)`, the backend automatically transitions the rollout job to `PAUSED_ON_FAILURE_THRESHOLD`.
- **Acceptance Criteria:**
  - **Given** an Admin triggers an emergency rollback from `v2.4.2` to `v2.4.1` on 500 online endpoints in `DEPLOY-003`, **When** the command is broadcast via WebSocket, **Then** `HydiEms.Service.exe` on all online endpoints flushes active SQLite slices, swaps back to the signed `v2.4.1` binary without losing a single 10-second activity slice, and reports `v2.4.1` online within `< 45 seconds`.
