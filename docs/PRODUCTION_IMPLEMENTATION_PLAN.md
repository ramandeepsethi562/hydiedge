# HydiEms — Production Implementation & Live Server Deployment Plan

> **Target Production Hardware:** Dedicated Ubuntu 24.04 LTS Server — **128 GB DDR4/DDR5 RAM**, **12-Core / 24-Thread AMD Ryzen 9 (3rd Gen)**, **3.5 TB NVMe SSD**
> **Scope:** 100% Production-Ready Codebase covering all 30 Architectural Phases, 33 Core Modules, 45 Enterprise Extensions (`MISSING-01`..`MISSING-45`), 422+ Screens, C#/.NET Desktop Agent, Chrome/Edge Manifest V3 Extension, and Automated Ubuntu 24.04 Live Server Deployment.

---

## 1. Monorepo Architecture (`c:\Users\suppo\Downloads\hydiEMS`)

| Workspace Package / App | Path | Technology Stack | Responsibility |
| :--- | :--- | :--- | :--- |
| **Root & Live Server Infra** | `infra/`, `docker-compose.yml` | Docker Compose, MySQL 8.0, ClickHouse 24.8, Redis 7.2, MinIO S3, Coturn TURN, Caddy 2 | 128 GB RAM hardware-tuned configs, NVMe mounts, TLS termination, 1-command Ubuntu 24.04 deploy script |
| **`@hydiems/shared`** | `packages/shared` | TypeScript 5.x, Zod | 6 Core Deterministic Engines (8-State Time, Attendance & Shrinkage, Level-2 Productivity Regex, 33×8×9 RBAC + 9 Sensitive Gates, 18 Add-Ons Entitlements, 4-Way Reconciliation) |
| **`@hydiems/database`** | `packages/database` | `mysql2/promise`, `@clickhouse/client`, `ioredis`, `@aws-sdk/client-s3` | Full MySQL 8.0 InnoDB DDL migrations (120+ tables), ClickHouse MergeTree + Materialized View DDLs, Multi-Tenant Storage Router (MinIO/S3/R2/SFTP), Seed Engine |
| **`@hydiems/api`** | `apps/api` | Fastify 5, `@fastify/websocket`, `@fastify/jwt`, `otplib` | High-throughput REST API across all 33 modules + Super Admin Console + Desktop Agent Ingestion Gateway + WebRTC Live Streaming Signaling |
| **`@hydiems/worker`** | `apps/worker` | BullMQ, Redis, ClickHouse, Nodemailer | 7 Distributed Worker Queues: ClickHouse Batch Flusher, Attendance Calculator, Historical Reclassifier, Alert/Automation Engine, Export Generator, Retention Reaper, SSL Pin Monitor |
| **`@hydiems/web`** | `apps/web` | Next.js 15 (App Router), React 19, Tailwind CSS, Lucide | Complete Multi-Role Enterprise Web Platform (`G-001` Shell, `AR` Drawer, Super Admin, CEO/Manager/Employee Dashboards, all 33 Modules & 422+ Screens) |
| **`HydiEms.DesktopAgent`** | `apps/desktop-agent` | C# / `.NET`, Win32/DXGI/WASAPI, SQLite WAL, Windows Job Objects | Native Endpoint Agent (`<2% CPU`, `<150 MB RAM` hard limit), Mutual Service Watchdog, Atomic Auto-Update & Rollback, 6 Tracker Modes |
| **`HydiEms.BrowserExtension`** | `apps/browser-extension` | Chrome / Edge Manifest V3 | Browser Task Timer, Project/Task Switcher, Active Tab URL Classification & Native Agent Bridge (`EXT-001`) |

---

## 2. Production Deployment Commands (Ubuntu 24.04 LTS — 128 GB RAM Server)

```bash
# 1. Clone repository onto the Ubuntu 24.04 server (/opt/hydiems)
git clone <repo-url> /opt/hydiems && cd /opt/hydiems

# 2. Run the automated 128GB RAM / 3.5TB NVMe provisioning & deployment script
sudo bash infra/scripts/deploy-ubuntu-128gb.sh

# Or run locally / manually with Docker Compose & NPM Workspaces:
npm install
npm run build
npm run db:migrate
npm run db:seed
docker compose up -d --build
```
