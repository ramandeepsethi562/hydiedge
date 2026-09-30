#!/usr/bin/env bash
# ============================================================================
# HYDIEMS ENTERPRISE LIVE SERVER PROVISIONING & DEPLOYMENT SCRIPT
# Target OS: Ubuntu 24.04 LTS | 128 GB RAM | 12-Core Ryzen 9 | 3.5 TB NVMe SSD
# ============================================================================
set -euo pipefail

echo "========================================================================"
echo "  HydiEms Enterprise v2.5.0 — Ubuntu 24.04 (128GB RAM) Live Deployment  "
echo "========================================================================"

# 1. Apply Linux Kernel Sysctl Tuning for 50,000+ Concurrent Agent WebSockets
if [ "$(id -u)" -eq 0 ]; then
  echo "[1/6] Applying Linux kernel sysctl tuning for high-concurrency telemetry..."
  cat << 'EOF' > /etc/sysctl.d/99-hydiems-tuning.conf
fs.file-max = 2097152
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.ip_local_port_range = 1024 65535
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 15
vm.swappiness = 1
vm.overcommit_memory = 1
vm.max_map_count = 262144
EOF
  sysctl --system >/dev/null 2>&1 || true
fi

# 2. Ensure .env exists
if [ ! -f .env ]; then
  echo "[2/6] Initializing .env from .env.example..."
  cp .env.example .env
fi

# 3. Install Workspace Dependencies & Build Production Artifacts
echo "[3/6] Installing workspace packages & compiling TypeScript monorepo..."
npm install
npm run build

# 4. Boot Infrastructure Containers (MySQL 8.0, ClickHouse 24.8, Redis 7.2, MinIO, Coturn)
echo "[4/6] Starting MySQL 8.0 (36GB), ClickHouse 24.8 (24GB), Redis 7.2 (16GB) & MinIO..."
docker compose up -d mysql clickhouse redis minio coturn

echo "Waiting for MySQL 8.0 & ClickHouse 24.8 healthchecks..."
sleep 12

# 5. Execute Production Database Migrations & Initial Seed
echo "[5/6] Running MySQL 8.0 InnoDB + ClickHouse 24.8 MergeTree Migrations & Seed..."
npm run db:migrate
npm run db:seed

# 6. Start Full Application Stack (Fastify API, BullMQ Workers, Next.js Web, Caddy Proxy)
echo "[6/6] Starting HydiEms API Gateway, BullMQ Workers, Next.js Web & Caddy Reverse Proxy..."
docker compose up -d --build api worker web caddy

echo "========================================================================"
echo "  HydiEms Enterprise Platform is LIVE!                                  "
echo "  - Web Console : http://localhost:3000 (or https://app.hydiems.com)    "
echo "  - API Gateway : http://localhost:4000/api/v1/health                   "
echo "  - MinIO Console: http://localhost:9001                                "
echo "========================================================================"
