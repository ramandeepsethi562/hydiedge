@echo off
title HydiEms Enterprise Workstation Tracker (hydiedge.com)
set HYDI_API_URL=https://api.hydiedge.com
set HYDI_WS_URL=wss://api.hydiedge.com/ws/agent
start "" "%~dp0HydiEms.Agent.exe" --gui
