# HydiEms Enterprise v2.5.0 — Workforce Intelligence, Monitoring, DLP, Projects, HR & AI Platform

> **Production-Ready Monorepo** engineered for **Ubuntu 24.04 LTS (128 GB RAM | 12-Core / 24-Thread AMD Ryzen 9 | 3.5 TB NVMe SSD)**
> **100% Feature Parity + Enterprise Extensions:** 33 Core Modules • 45 Enterprise Add-On Extensions (`MISSING-01`..`MISSING-45`) • 422+ Screen Specifications • 6 Core Deterministic Engines • 9 System Roles • Native C#/.NET Desktop Agent & Watchdog • Chrome/Edge Manifest V3 Extension.

---

## 1. Repository Architecture

| Path | Package / Target | Description |
| :--- | :--- | :--- |
| [`packages/shared`](file:///c:/Users/suppo/Downloads/hydiEMS/packages/shared) | `@hydiems/shared` | Shared TypeScript types, 33×8×9 RBAC Permission Matrix (`PERM-001..002`), 8-State Time Engine (`TIME-008`), Daily Attendance & BPO Shrinkage Engine (`ATT-010`), 4-Tier Policy & Level-2 Regex Productivity Engine (`PROD-006`), Software License Waste Calculator (`LIC-003`), and 4-Way Data Reconciliation Engine (`DATA-002`). |
| [`packages/database`](file:///c:/Users/suppo/Downloads/hydiEMS/packages/database) | `@hydiems/database` | Hybrid Database & Storage Layer: **MySQL 8.0 InnoDB** (`001..007` DDL migrations), **ClickHouse 24.8 MergeTree & Materialized Views** (`001..003` DDL migrations), **Redis 7.2** 20s Agent Presence & Pub/Sub, and **Multi-Tenant Storage Router (`SA-5`)** (Local NVMe MinIO, AWS S3, Cloudflare R2, Tenant SFTP/FTPS). |
| [`apps/api`](file:///c:/Users/suppo/Downloads/hydiEMS/apps/api) | `@hydiems/api` | **Fastify 5 REST & WebSocket Gateway** (`:4000`) with JWT/MFA/SSO Auth, Tenant Isolation, Audited Super Admin Impersonation (`SUPER-002`), SHA-256 Hash-Chained Audit Logs (`AUDIT-002`), Desktop Agent Telemetry Ingestion, and WebRTC Live Stream Signaling (`/ws/agent`, `/ws/live-monitor`). |
| [`apps/worker`](file:///c:/Users/suppo/Downloads/hydiEMS/apps/worker) | `@hydiems/worker` | **7 Distributed Background Worker Pipelines**: ClickHouse Batch Flusher, Attendance State Calculator, Historical Productivity Reclassifier, Alert & Automation Rule Engine, Streaming Report/Export Generator, Storage Retention Reaper, and SSL Certificate & SHA-256 Pin Monitor (`SA-6`). |
| [`apps/web`](file:///c:/Users/suppo/Downloads/hydiEMS/apps/web) | `@hydiems/web` | **Next.js 15 App Router Enterprise Web Platform** (`:3000`) featuring Global Shell (`G-001`), Context-Aware Right-Side Detail Drawer (`AR` Drawer), Role Switcher across all 9 Roles, Super Admin Console, Executive/Manager/Employee Dashboards, Office TV Wallboard, and all 33 Modules / 422+ Screens. |
| [`apps/desktop-agent`](file:///c:/Users/suppo/Downloads/hydiEMS/apps/desktop-agent) | `HydiEms.Agent.sln` | **C# / .NET Native Desktop Agent & Mutual Service Watchdog** enforcing `<2% CPU` & `<150 MB RAM` via OS Job Objects, Win32/DXGI/WASAPI/macOS/Linux native hooks, AES-256-GCM Local Spool (`agent_spool.db`), Direct Pre-Signed S3 Uploads, Atomic Rollback (`DEPLOY-003`), and 6 Tracker Modes (`DA-1..DA-16`). |
| [`apps/browser-extension`](file:///c:/Users/suppo/Downloads/hydiEMS/apps/browser-extension) | `EXT-001` | **Chrome / Edge Manifest V3 Browser Extension** with live Project/Task Timer, Active Tab URL Classification, DLP Upload/Clipboard Guard, and Desktop Agent bridge. |
| [`infra/`](file:///c:/Users/suppo/Downloads/hydiEMS/infra) | Live Server Configs | Hardware-tuned configs for your **128 GB RAM Ryzen 9 Server**: MySQL (`36 GB` InnoDB buffer pool), ClickHouse (`24 GB` cap + ZSTD), Redis (`16 GB`), MinIO (`12 GB`), Caddy 2 Auto-TLS Proxy, and `deploy-ubuntu-128gb.sh`. |
| [`docs/`](file:///c:/Users/suppo/Downloads/hydiEMS/docs/00_MASTER_ARCHITECTURE_AND_30_PHASES_INDEX.md) | 30-Phase Specs | Complete 30-Phase Master Engineering & Screen-by-Screen Documentation (`>1.04 MB`). |

---

## 2. Quick Start (Local Development & Verification)

```bash
# 1. Install all workspace dependencies
npm install

# 2. Build all TypeScript packages & Next.js production bundle
npm run build

# 3. Build the C# / .NET Desktop Agent & Mutual Watchdog Service
npm run build:agent

# 4. Start the API Server (port 4000) and Next.js Web Console (port 3000)
npm run dev:api
npm run dev:web
```

---

## 3. One-Command Live Server Deployment (Ubuntu 24.04 LTS — 128 GB RAM)

On your dedicated Ubuntu 24.04 LTS server (`128 GB RAM`, `12-Core AMD Ryzen 9`, `3.5 TB NVMe SSD`):

```bash
sudo bash infra/scripts/deploy-ubuntu-128gb.sh
```

This script automatically:
1. Applies Linux kernel `sysctl` network & file-descriptor tuning for `50,000+` concurrent agent WebSockets.
2. Starts `hydi-mysql` (36 GB RAM), `hydi-clickhouse` (24 GB RAM), `hydi-redis` (16 GB RAM), `hydi-minio` (12 GB RAM), and `hydi-coturn` (WebRTC TURN).
3. Runs all MySQL 8.0 InnoDB (`001..007`) and ClickHouse 24.8 MergeTree (`001..003`) schema migrations and seeds initial enterprise data.
4. Builds and launches `hydi-api`, `hydi-worker`, `hydi-web`, and `hydi-caddy` (HTTPS / HTTP3 / WebSockets).
