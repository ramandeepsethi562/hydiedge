# Phase 01: Infrastructure, Monorepo, Hybrid Database Foundation, Ingestion Pipeline & System Health (`SYS-001` to `SYS-003`)

## 1. Phase Overview & Architectural Goal
**Phase 01** establishes the complete production infrastructure, monorepo workspace, bare-metal **Ubuntu 24.04 LTS Server** orchestration (**128 GB DDR4/DDR5 RAM, 12-Core / 24-Thread AMD Ryzen 9 3rd Gen, 3.5 TB NVMe Gen4 SSD**), the **Hybrid Database Engine (MySQL 8.0 InnoDB + ClickHouse 24.x MergeTree + Redis 7.2)**, the **Zero-RAM Direct Media Upload Pipeline (MinIO S3 Pre-Signed PUT URLs)**, the **BullMQ Write-Behind Ingestion Pipeline**, and the **System, Agent & Sync Health Observability Module (`SYS-001`, `SYS-002`, `SYS-003`)**.

---

## 2. Production Capacity & Ingestion Rate Engineering Math

### 2.1 Why Naive Architectures Crash on Day 1
For **1,000 concurrent employees** (scaling to **10,000+ employees**):
1. **Activity Slices (`10s` granularity)**:
   * $1,000 \text{ agents} \times 6 \text{ slices/min} = 100 \text{ slices/sec} = 360,000 \text{ rows/hour} = \mathbf{3.24\text{M rows/day}}$ per 9-hour shift (or **$32.4\text{M rows/day}$** at 10,000 users).
   * **HydiEms Mitigation**: Agents buffer 6 slices (`60s`) locally in SQLCipher SQLite WAL and send **1 Zstd-compressed batch every 60 seconds** with random jitter (`0–5,000ms`). This reduces HTTP request rate from `100 req/sec` to **`16.67 req/sec`** for 1,000 employees (`166.7 req/sec` for 10,000 employees).
   * Fastify validates the JWT + schema in `<1.2ms`, pushes the batch to a Redis Stream (`bull:activity-ingest`), and returns `202 Accepted`. BullMQ workers flush **1,000–2,000 rows per bulk insert** into ClickHouse `ReplacingMergeTree` every `1,000ms`.
2. **Screenshots (`5m` interval = `12/hr`) & Media (`REC` / `AUDIO`)**:
   * $1,000 \text{ agents} \div 300\text{s} = \mathbf{3.33 \text{ images/sec}} = 108,000 \text{ images/day}$.
   * Encoded as `libwebp` (`quality=75`, average `45 KB` per 1080p frame) = **$4.86\text{ GB/day}$** (`145.8 GB/month` per 1,000 users).
   * **HydiEms Mitigation**: **0 bytes of binary media ever touch Fastify RAM**. Agents request batches of 10 S3 SigV4 Pre-Signed `PUT` URLs (`POST /api/v1/media/presign-batch`) every 30 minutes and upload `.webp`, `.webm`, and `.opus` files directly to **MinIO S3** (on the 3.5 TB NVMe) or tenant-configured AWS S3 / Cloudflare R2 / FTPS.

### 2.2 128 GB RAM & 12-Core Ryzen 9 Allocation Blueprint

| Service / Daemon | RAM Limit | CPU Cores / Threads Pinning | Disk & I/O Tuning on 3.5 TB NVMe SSD |
| :--- | :--- | :--- | :--- |
| **MySQL 8.0.39 (InnoDB OLTP)** | **36 GB** (`innodb_buffer_pool_size=36G`, `innodb_buffer_pool_instances=12`) | Cores `0–3` (8 Threads) | `innodb_flush_method=O_DIRECT`, `innodb_redo_log_capacity=4G`, `innodb_io_capacity=10000`, `innodb_io_capacity_max=20000`. |
| **ClickHouse 24.8 LTS (Time-Series)** | **24 GB** (`max_server_memory_usage=25769803776`) | Cores `4–6` (6 Threads) | ZSTD(3) columnar compression (`10x–14x` compression ratio), `background_pool_size=16`, separate `/var/lib/clickhouse` NVMe mount (`noatime`). |
| **Redis 7.2 (Presence + BullMQ)** | **16 GB** (`maxmemory 16gb`, `noeviction` for queue DB, `allkeys-lru` for cache DB) | Core `7` (2 Threads + I/O threads `io-threads 4`) | AOF `appendfsync everysec` + RDB snapshot every 15m. |
| **MinIO S3 Object Storage** | **12 GB** | Core `8` (2 Threads) | Direct XFS filesystem on `/mnt/nvme_s3` (`inode64,noatime`), erasure coding disabled for single-NVMe max throughput + nightly `rclone` offsite sync. |
| **Fastify API + WebSocket Gateway** | **8 GB** (`12` PM2 cluster instances $\times$ `650 MB` max-old-space) | Cores `9–10` (4 Threads) | Stateless, horizontally scalable behind Nginx TLS 1.3 + `coturn` STUN/TURN server (`2 GB RAM`). |
| **BullMQ Background Workers** | **6 GB** (`8` worker processes) | Core `11` (2 Threads) | Dedicated queues: `activity-ingest`, `attendance-rollup`, `productivity-recalc`, `automation-rules`, `report-export`, `retention-purge`, `ssl-checker`. |
| **Next.js 15 Frontend + OS Page Cache** | **6 GB** (Next.js) + **20 GB** (Linux Kernel VFS Page Cache) | Shared across cores | Serves SSR/ISR pages and caches hot static assets & ClickHouse uncompressed blocks in RAM. |

---

## 3. Complete Database Schemas (MySQL 8.0 + ClickHouse)

### 3.1 MySQL 8.0 (InnoDB) — Core Multi-Tenant & System Health DDL
```sql
CREATE TABLE organizations (
    id CHAR(36) PRIMARY KEY,                         -- UUIDv7
    enterprise_group_id CHAR(36) NULL,               -- Links to ENT-002 parent group
    name VARCHAR(180) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    logo_url VARCHAR(512) NULL,
    industry VARCHAR(100) NULL,
    website VARCHAR(255) NULL,
    address TEXT NULL,
    country_code CHAR(2) NOT NULL DEFAULT 'IN',
    default_timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
    currency_code CHAR(3) NOT NULL DEFAULT 'INR',
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(32) NULL,
    storage_provider ENUM('LOCAL_MINIO_NVME','AWS_S3','CLOUDFLARE_R2','TENANT_FTP','TENANT_SFTP') NOT NULL DEFAULT 'LOCAL_MINIO_NVME',
    storage_config_encrypted TEXT NULL,              -- AES-256-GCM encrypted S3/FTP credentials
    status ENUM('TRIAL','ACTIVE','PAST_DUE','SUSPENDED','ARCHIVED') NOT NULL DEFAULT 'TRIAL',
    trial_ends_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    INDEX idx_org_group (enterprise_group_id),
    INDEX idx_org_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE system_health_snapshots (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    captured_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    api_p50_latency_ms DECIMAL(8,2) NOT NULL,
    api_p95_latency_ms DECIMAL(8,2) NOT NULL,
    api_error_rate_pct DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    active_websocket_agents INT UNSIGNED NOT NULL,
    bullmq_ingest_waiting INT UNSIGNED NOT NULL,
    bullmq_ingest_active INT UNSIGNED NOT NULL,
    bullmq_ingest_failed INT UNSIGNED NOT NULL,
    mysql_buffer_pool_used_mb INT UNSIGNED NOT NULL,
    mysql_active_connections SMALLINT UNSIGNED NOT NULL,
    clickhouse_insert_rows_per_sec INT UNSIGNED NOT NULL,
    redis_used_memory_mb INT UNSIGNED NOT NULL,
    nvme_used_bytes BIGINT UNSIGNED NOT NULL,
    nvme_free_bytes BIGINT UNSIGNED NOT NULL,
    nvme_write_iops INT UNSIGNED NOT NULL DEFAULT 0,
    overall_status ENUM('HEALTHY','WARNING','CRITICAL') NOT NULL DEFAULT 'HEALTHY',
    INDEX idx_health_captured (captured_at DESC)
) ENGINE=InnoDB;

CREATE TABLE agent_diagnostic_commands (
    id CHAR(36) PRIMARY KEY,
    org_id CHAR(36) NOT NULL,
    device_id CHAR(36) NOT NULL,
    issued_by_user_id CHAR(36) NOT NULL,
    command_type ENUM('FORCE_SYNC','UPLOAD_DIAGNOSTIC_LOGS','RECHECK_OS_PERMISSIONS','SOFT_RESTART_AGENT','REBUILD_SQLITE_WAL') NOT NULL,
    status ENUM('QUEUED','DISPATCHED_WS','EXECUTING','COMPLETED','FAILED','TIMED_OUT') NOT NULL DEFAULT 'QUEUED',
    result_payload_json JSON NULL,
    diagnostic_log_s3_key VARCHAR(512) NULL,
    issued_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    completed_at DATETIME(3) NULL,
    INDEX idx_diag_device (org_id, device_id, status)
) ENGINE=InnoDB;
```

### 3.2 ClickHouse — Sync Batch & Pipeline Telemetry DDL (`SYS-003`)
```sql
CREATE DATABASE IF NOT EXISTS hydiems_telemetry;

CREATE TABLE hydiems_telemetry.agent_sync_batches (
    org_id UUID,
    device_id UUID,
    user_id UUID,
    batch_id UUID,
    agent_version LowCardinality(String),
    os_platform LowCardinality(String),
    received_at DateTime64(3, 'UTC'),
    client_sent_at DateTime64(3, 'UTC'),
    clock_skew_ms Int32,
    slice_count UInt16,
    duplicate_slices_ignored UInt16,
    pending_local_sqlite_rows UInt32,
    pending_local_media_files UInt16,
    failed_local_uploads UInt16,
    agent_cpu_pct Float32,
    agent_ram_mb Float32,
    hook_input_ok UInt8,
    hook_window_ok UInt8,
    hook_screen_ok UInt8,
    hook_audio_ok UInt8,
    processing_ms UInt16
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(received_at)
ORDER BY (org_id, device_id, received_at)
TTL toDateTime(received_at) + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;
```

---

## 4. Screen-by-Screen 15-Point Specifications (`SYS-001` to `SYS-003`)

---

### Screen `SYS-001` — System Health Dashboard
1. **Screen ID, Title & Route**: `SYS-001` — System Health Dashboard | Route: `/admin/system-health` (Tenant View) & `/super-admin/system-health` (Global Ubuntu Server View).
2. **Purpose, Target Roles & Permission**: Real-time observability of all 9 HydiEms core subsystems (API Gateway, Agent WebSocket Fleet, Activity Ingestion Pipeline, Screenshot Pipeline, Recording Pipeline, Storage Engine, BullMQ Queues, Notification Dispatcher, and HydiAI Services). Roles: `SUPER_ADMIN`, `ADMIN`. Permission: `PERM_SYSTEM_HEALTH_VIEW`.
3. **UI Components**:
   * **Top System Status Banner**: Dynamic green/amber/red status bar with uptime % (`99.98%`) and last refresh timestamp (auto-polls every `5s` via WebSocket).
   * **9 Subsystem Health Cards**:
     1. `API Status`: p50/p95 Latency (`ms`), Req/sec, Error rate `%`.
     2. `Agent Status`: Online vs Offline vs Error agents, WS connections count.
     3. `Data Ingestion`: Slices/sec written to ClickHouse, Bulk Flush Latency (`ms`).
     4. `Screenshot Pipeline`: Pre-Signed PUTs/min, MinIO/S3 Write Success `%`.
     5. `Recording & Audio Pipeline`: Active Recording Sessions, Chunk Commit Rate.
     6. `Storage`: Used vs Free NVMe/S3 capacity (`GB`/`TB`), IOPS, Forecast days remaining.
     7. `Queue (BullMQ)`: Waiting, Active, Delayed, Completed/min, Failed count.
     8. `Notifications`: Email SMTP, WebPush, WhatsApp delivery rate & queue depth.
     9. `AI Services`: HydiAI Worker status, average inference latency (`ms`).
   * **Throughput & Resource Charts**: 24-hour area chart of Ingestion Slices/sec vs API Latency + Ubuntu Server CPU/RAM/NVMe utilization gauges (`SUPER_ADMIN` only).
   * **Failed Queue Jobs Inspector Table**: Job ID, Queue Name, Org ID, Error Stacktrace preview, Failed At, Attempts, `[Retry Job]` and `[Retry All Failed]` buttons.
4. **Actions**: `[Refresh Telemetry]`, `[Retry Failed Jobs]`, `[Purge Dead-Letter Queue]`, `[Run Storage Read/Write Probe]`, `[Download Prometheus/JSON Health Report]`.
5. **Filters, Search, Sort & Pagination**: Filter by Time Window (`5m Live`, `1h`, `6h`, `24h`, `7d`, `30d`), Subsystem, Queue Name, and Severity (`All`, `Warning`, `Critical`).
6. **UI States**:
   * *Loading*: 9 skeleton cards + chart shimmer.
   * *Empty*: `"No failed queue jobs in selected time window."`
   * *Error*: High-visibility red alert banner if `/api/v1/system/health` times out, showing cached last-known snapshot.
   * *Offline*: `"Browser offline — reconnecting live telemetry stream..."`
   * *Permission Denied*: `403` guard screen if user lacks `PERM_SYSTEM_HEALTH_VIEW`.
7. **Validation Rules**: Queue retry action validates `queueName` against enum `['activity-ingest','attendance-rollup','productivity-recalc','automation-rules','report-export','retention-purge','ssl-checker']` and max batch retry size `<= 1,000`.
8. **Business Rules**:
   * Status flips to `WARNING` if `api_p95_latency_ms > 150` OR `bullmq_ingest_waiting > 5,000` OR `nvme_free_bytes / nvme_total < 0.20`.
   * Status flips to `CRITICAL` if `api_p95_latency_ms > 500` OR `bullmq_ingest_waiting > 25,000` OR `nvme_free_bytes / nvme_total < 0.10` OR ClickHouse/MySQL ping fails.
9. **Notifications**: Dispatches instant critical alert to `SUPER_ADMIN` via Email + WhatsApp webhook if `overall_status == 'CRITICAL'` persists for `>= 3` consecutive 60s checks.
10. **Audit Events (`AUDIT-002`)**: `system.health.queue_retried`, `system.health.queue_purged`, `system.health.storage_probed`.
11. **API Endpoints**:
    * `GET /api/v1/system/health`
    * `GET /api/v1/system/queues/:queueName/failed`
    * `POST /api/v1/system/queues/:queueName/retry`
    * `POST /api/v1/system/storage/probe`
12. **Database Entities**: MySQL `system_health_snapshots`; ClickHouse `hydiems_telemetry.agent_sync_batches`; Redis `bull:*` keys.
13. **Security Requirements**: Tenant `ADMIN` sees only queue/sync metrics filtered by `WHERE org_id = :jwtOrgId`; bare-metal CPU/RAM/NVMe stats and global queue controls require `SUPER_ADMIN`.
14. **Mobile/Responsive Behavior**: 9-card grid collapses from `3x3` desktop grid to `2x5` tablet and `1x9` mobile stack.
15. **Acceptance Criteria**:
    * `GET /api/v1/system/health` responds in `< 40ms`.
    * Injecting a malformed job into `bull:report-export` increments the `Failed` counter on `SYS-001` within 5 seconds and allows 1-click retry.

---

### Screen `SYS-002` — Agent Health Monitor
1. **Screen ID, Title & Route**: `SYS-002` — Agent Health Monitor | Route: `/admin/system-health/agents`.
2. **Purpose, Target Roles & Permission**: Monitor endpoint health state (`Healthy`, `Warning`, `Offline`, `Error`, `Outdated`), CPU/RAM compliance (`<2% CPU`, `<150 MB RAM`), and OS hook/permission status across every deployed workstation. Roles: `SUPER_ADMIN`, `ADMIN`, `IT_ADMIN`. Permission: `PERM_AGENT_HEALTH_VIEW`.
3. **UI Components**:
   * **5 Status Summary Cards**: `Healthy` | `Warning` | `Offline` | `Error` | `Outdated`.
   * **Fleet Health Table**: `Employee`, `Device Hostname & ID`, `OS & Version`, `Agent Version`, `Health Badge`, `Agent CPU %`, `Agent RAM (MB)`, `OS Hook Status Icons (Input / Window / Screen / Audio / DLP)`, `Last Heartbeat`, `Actions`.
   * **Right-Side Device Diagnostic Drawer (`AR`)**: Shows 24h CPU/RAM sparkline, OS permission checklist (e.g., macOS `ScreenCaptureKit` & `AXUIElement` status), Watchdog service status, and recent `agent_diagnostic_commands`.
4. **Actions**: `[Force Sync Now]`, `[Request Agent Diagnostic Logs]`, `[Recheck OS Permissions]`, `[Soft Restart Agent]`, `[Trigger Auto-Update]`.
5. **Filters, Search, Sort & Pagination**: Search by Employee, Hostname, IP, or MAC; Filter by Health Status (`Healthy`, `Warning`, `Offline`, `Error`, `Outdated`), OS (`Windows`, `macOS`, `Linux`, `Citrix`), Department, and Agent Version; Sort by CPU %, RAM MB, or Last Seen.
6. **UI States**: Loading table skeleton, Empty state (with `[Download Agent (AGENT-002)]` CTA), Error banner, Offline banner, `403` Permission Denied.
7. **Validation Rules**: Remote diagnostic commands require valid `device_id` belonging to `org_id` and rate-limit `UPLOAD_DIAGNOSTIC_LOGS` to once per 5 minutes per device.
8. **Business Rules**:
   * **Deterministic Agent Health State Machine**:
     * `ERROR`: Any required OS hook (`hook_input_ok == 0` OR `hook_window_ok == 0` OR (`screenshots_enabled` AND `hook_screen_ok == 0`)) fails, OR Watchdog service is stopped.
     * `OFFLINE`: No WebSocket heartbeat for `> 60s` while employee is within scheduled shift hours and not on approved leave.
     * `OUTDATED`: `agent_version < latest_mandatory_version`.
     * `WARNING`: `agent_cpu_pct > 2.0%` sustained for 5m, OR `agent_ram_mb > 135 MB`, OR `pending_local_sqlite_rows > 360` while online, OR `abs(clock_skew_ms) > 30000` (30s clock drift).
     * `HEALTHY`: Online, all active hooks `== 1`, CPU `<= 2.0%`, RAM `<= 135 MB`, up to date.
9. **Notifications**: Alerts `IT_ADMIN` / `ADMIN` if an employee's agent enters `ERROR` state (e.g., user revoked macOS Screen Recording permission) or if clock skew exceeds 60s.
10. **Audit Events (`AUDIT-002`)**: `agent.diagnostic.command_issued`, `agent.health.state_changed`.
11. **API Endpoints**:
    * `GET /api/v1/system/agent-health`
    * `POST /api/v1/system/agent-health/:deviceId/command`
12. **Database Entities**: ClickHouse `hydiems_telemetry.agent_sync_batches`; MySQL `desktop_devices`, `agent_diagnostic_commands`; Redis `presence:{org_id}:{user_id}`.
13. **Security Requirements**: Diagnostic log bundles uploaded from agents are scrubbed of any raw keystrokes/passwords and stored encrypted in S3 with a 7-day auto-expiry TTL.
14. **Mobile/Responsive Behavior**: Responsive table with horizontal scroll and sticky Employee/Status columns on mobile/tablet.
15. **Acceptance Criteria**:
    * Clicking `[Request Agent Diagnostic Logs]` dispatches a WebSocket command to the C# Agent, which zips its last 1,000 log lines, uploads via Pre-Signed S3 PUT, and displays a `[Download Log Bundle]` link in the drawer within `< 5 seconds`.

---

### Screen `SYS-003` — Data Sync Health & Backlog Monitor
1. **Screen ID, Title & Route**: `SYS-003` — Data Sync Health | Route: `/admin/system-health/sync`.
2. **Purpose, Target Roles & Permission**: Real-time visibility into `Last Sync`, `Pending Events`, `Failed Events`, and `Offline Buffered Events` across all endpoints so admins know with 100% certainty whether dashboards reflect complete telemetry. Roles: `SUPER_ADMIN`, `ADMIN`, `IT_ADMIN`. Permission: `PERM_SYNC_HEALTH_VIEW`.
3. **UI Components**:
   * **4 KPI Cards**: `Fully Synced Devices (<2m lag)` | `Devices with Pending Spool` | `Devices with Failed Uploads` | `Total Unsynced Slices Across Org`.
   * **Sync Backlog Table**: `Employee`, `Device`, `Connection State (Online/Offline)`, `Last Sync Timestamp`, `Sync Lag`, `Pending SQLite Activity Slices`, `Pending Media Files (Screenshots/Clips)`, `Failed Retries`, `Clock Skew (ms)`, `Actions ([Sync Now], [Rebuild Queue])`.
4. **Actions**: `[Force Immediate Batch Sync]`, `[Reset Failed Upload Retries]`, `[Export Sync Health CSV]`.
5. **Filters, Search, Sort & Pagination**: Filter by Sync State (`In Sync`, `Lagging > 5m`, `Offline Backlog`, `Failed Uploads`), Department, Location; Sort by `Pending SQLite Slices DESC`.
6. **UI States**: Loading, Empty (`"All agents 100% synchronized"`), Error, Offline, Permission Denied.
7. **Validation Rules**: `Reset Failed Upload Retries` requires confirmation modal and `PERM_SYNC_HEALTH_MANAGE`.
8. **Business Rules**:
   * Every 60s sync batch from the C# Agent includes `pending_local_sqlite_rows`, `pending_local_media_files`, and `failed_local_uploads` from `agent_spool.db`.
   * Server calculates `clock_skew_ms = received_at_utc - client_sent_at_utc`. If `abs(clock_skew_ms) > 5000`, the server returns `server_utc_ms` in the batch ACK so the agent adjusts its local monotonic offset without requiring Windows Admin privileges to change the OS clock!
9. **Notifications**: Alerts Admin if any device accumulates `> 2,000` unsynced slices while reporting an online network interface.
10. **Audit Events (`AUDIT-002`)**: `system.sync.forced`, `system.sync.failed_reset`.
11. **API Endpoints**: `GET /api/v1/system/sync-health`, `POST /api/v1/system/sync-health/:deviceId/force-sync`.
12. **Database Entities**: ClickHouse `hydiems_telemetry.agent_sync_batches`; Redis `presence:{org_id}:{user_id}`.
13. **Security Requirements**: Strict `org_id` isolation on all ClickHouse queries.
14. **Mobile/Responsive Behavior**: Card-based summary view on mobile screens.
15. **Acceptance Criteria**:
    * Simulating a 30-minute network outage on an agent (`180` queued 10s slices + `6` queued screenshots in `agent_spool.db`) and restoring connectivity shows `SYS-003` draining `Pending SQLite Activity Slices` from `180 -> 0` and `Pending Media Files` from `6 -> 0` within 60 seconds.
