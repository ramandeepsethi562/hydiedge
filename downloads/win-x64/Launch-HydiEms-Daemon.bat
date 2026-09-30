@echo off
title HydiEms Enterprise Background Telemetry Daemon (hydiedge.com)
set HYDI_API_URL=https://api.hydiedge.com
set HYDI_WS_URL=wss://api.hydiedge.com/ws/agent
"%~dp0HydiEms.Agent.exe" --daemon
