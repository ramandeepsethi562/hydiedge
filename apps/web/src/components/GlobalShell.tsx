"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  PRODUCTION_SECTIONS,
  SYSTEM_ROLES,
  ALL_SCREEN_IDS,
  ALL_ROLES,
  SystemRole,
  WorkspaceGroup,
  EmployeeRecord,
  ScreenshotItem,
  DLPIncident,
} from "@/lib/moduleRegistry";
import {
  LayoutDashboard,
  Users,
  Clock,
  Activity,
  MonitorPlay,
  FolderKanban,
  ShieldAlert,
  HeartHandshake,
  Cpu,
  Search,
  Bell,
  LifeBuoy,
  Play,
  Pause,
  Coffee,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  X,
  Terminal,
  Lock,
  ExternalLink,
  Layers,
  Building2,
} from "lucide-react";

export interface RightDrawerContext {
  type: "EMPLOYEE" | "SCREENSHOT" | "DLP_INCIDENT" | "PROJECT" | "TASK" | "RECORDING";
  title: string;
  subtitle: string;
  badge?: string;
  employee?: EmployeeRecord;
  screenshot?: ScreenshotItem;
  dlpIncident?: DLPIncident;
  metadata?: Record<string, string | number | boolean>;
}

export interface UserSession {
  userId: string;
  name: string;
  email: string;
  role: SystemRole;
  orgId: string;
  employeeId?: string;
}

interface GlobalShellProps {
  currentUser?: UserSession | null;
  onLogout?: () => void;
  activeRole: SystemRole;
  setActiveRole: (r: SystemRole) => void;
  activeCategory: WorkspaceGroup;
  setActiveCategory: (c: WorkspaceGroup) => void;
  activeModuleId: string;
  setActiveModuleId: (m: string) => void;
  activeScreenId: string;
  setActiveScreenId: (s: string) => void;
  impersonatedTenant: string | null;
  setImpersonatedTenant: (t: string | null) => void;
  drawerContext: RightDrawerContext | null;
  setDrawerContext: (d: RightDrawerContext | null) => void;
  onOpenEmployee16Tab?: (emp: EmployeeRecord) => void;
  children: React.ReactNode;
}

const CATEGORY_META: {
  id: WorkspaceGroup;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  allowedRoles?: SystemRole[];
}[] = [
  { id: "DASHBOARDS", label: "Dashboards", icon: LayoutDashboard },
  {
    id: "LIVE_MONITOR_MEDIA",
    label: "Surveillance & CCTV",
    icon: MonitorPlay,
    allowedRoles: ["SUPER_ADMIN", "ORG_ADMIN", "MANAGER", "SECURITY_ADMIN"],
  },
  { id: "WORKFORCE", label: "Workforce", icon: Users },
  { id: "TIME_ATTENDANCE", label: "Time & Attendance", icon: Clock },
  {
    id: "PRODUCTIVITY_APPS",
    label: "Productivity",
    icon: Activity,
    allowedRoles: ["SUPER_ADMIN", "ORG_ADMIN", "EXECUTIVE", "DEPT_HEAD", "MANAGER", "EMPLOYEE"],
  },
  { id: "PROJECTS_TASKS_BILLING", label: "Projects & Tasks", icon: FolderKanban },
  {
    id: "SECURITY_DLP_AUDIT",
    label: "Security & DLP",
    icon: ShieldAlert,
    allowedRoles: ["SUPER_ADMIN", "ORG_ADMIN", "SECURITY_ADMIN"],
  },
  { id: "HR_PERF_PAYROLL", label: "HR & Leaves", icon: HeartHandshake },
  {
    id: "OPS_AI_ADMIN",
    label: "Settings & System",
    icon: Cpu,
    allowedRoles: ["SUPER_ADMIN", "ORG_ADMIN", "SECURITY_ADMIN"],
  },
];

export default function GlobalShell({
  currentUser,
  onLogout,
  activeRole,
  setActiveRole,
  activeCategory,
  setActiveCategory,
  activeModuleId,
  setActiveModuleId,
  activeScreenId,
  setActiveScreenId,
  impersonatedTenant,
  setImpersonatedTenant,
  drawerContext,
  setDrawerContext,
  onOpenEmployee16Tab,
  children,
}: GlobalShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [timerState, setTimerState] = useState<"RUNNING" | "PAUSED" | "BREAK" | "PERSONAL">("RUNNING");
  const [timerElapsed, setTimerElapsed] = useState("04:38:19");
  const [commandKOpen, setCommandKOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [supportBundleStatus, setSupportBundleStatus] = useState<string | null>(null);

  const currentRoleMeta = SYSTEM_ROLES.find((r) => r.role === activeRole) || SYSTEM_ROLES[0];

  const filteredScreens = ALL_SCREEN_IDS.filter(
    (s) =>
      s.screenId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.moduleName.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 24);

  return (
    <div className="min-h-screen flex flex-col bg-[#090d16] text-slate-100">
      {/* Audited Tenant Impersonation Banner */}
      {impersonatedTenant && (
        <div className="bg-gradient-to-r from-rose-950 via-red-900 to-amber-950 border-b border-rose-500/40 px-4 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            <span className="px-2 py-0.5 rounded bg-rose-500 text-white font-mono font-bold text-[10px]">
              AUDITED IMPERSONATION
            </span>
            <span className="text-rose-100 font-medium">
              Active Tenant Session: <strong>{impersonatedTenant}</strong> • Reason: Ticket #SUP-9042 • Immutable Audit Stream Active
            </span>
          </div>
          <button
            type="button"
            onClick={() => setImpersonatedTenant(null)}
            className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold text-[11px]"
          >
            End Impersonation
          </button>
        </div>
      )}

      {/* Top Enterprise Header */}
      <header className="h-16 border-b border-slate-800/90 bg-[#0d1322]/95 backdrop-blur-md sticky top-0 z-30 px-4 flex items-center justify-between gap-3">
        {/* Brand + Live Workstation Counter */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center font-bold text-white shadow-md shadow-blue-600/25">
            H
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-sm sm:text-base text-white">HydiEms</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
                Enterprise
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                1 Workstation Connected (RAMANDEEP)
              </span>
            </div>
          </div>
        </div>

        {/* Center Quick Timer + Command-K Search */}
        <div className="hidden xl:flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/95 border border-slate-800">
            <span
              className={`w-2 h-2 rounded-full ${
                timerState === "RUNNING"
                  ? "bg-emerald-400"
                  : timerState === "PERSONAL"
                  ? "bg-violet-400"
                  : timerState === "BREAK"
                  ? "bg-amber-400"
                  : "bg-slate-400"
              }`}
            />
            <span className="text-xs font-mono font-bold text-white">{timerElapsed}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
              {timerState}
            </span>
            <button
              type="button"
              onClick={() => setTimerState(timerState === "RUNNING" ? "PAUSED" : "RUNNING")}
              title="Start / Pause Work Timer"
              className="p-1 rounded hover:bg-slate-800 text-blue-400"
            >
              {timerState === "RUNNING" ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => setTimerState("BREAK")}
              title="Start Break"
              className="p-1 rounded hover:bg-slate-800 text-amber-400"
            >
              <Coffee className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setTimerState(timerState === "PERSONAL" ? "RUNNING" : "PERSONAL")}
              title="Personal Privacy Mode — Pauses Monitoring"
              className={`px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 ${
                timerState === "PERSONAL"
                  ? "bg-violet-600 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <EyeOff className="w-3 h-3" /> Personal Mode
            </button>
          </div>

          {/* Command-K Search Trigger */}
          <button
            type="button"
            onClick={() => setCommandKOpen(true)}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-xs text-slate-400"
          >
            <Search className="w-3.5 h-3.5 text-blue-400" />
            <span>Search employees, tasks, reports...</span>
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 text-slate-300 rounded border border-slate-700">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right Controls: User Profile, Role Badge, Sign Out, Notifications, Support */}
        <div className="flex items-center gap-2">
          {currentUser ? (
            <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-xl px-2.5 py-1">
              <div className="w-6 h-6 rounded-full bg-blue-600/30 text-blue-400 font-bold text-xs flex items-center justify-center border border-blue-500/30">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-semibold text-white leading-tight">{currentUser.name}</div>
                <div className="text-[10px] text-slate-400 font-mono leading-none">{currentUser.role}</div>
              </div>
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="ml-1 text-[11px] font-semibold text-rose-400 hover:text-rose-300 px-2 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition"
                >
                  Sign Out
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-xl px-2.5 py-1">
              <span className="text-[10px] font-mono uppercase text-slate-400 hidden sm:inline">Role:</span>
              <select
                value={activeRole}
                onChange={(e) => setActiveRole(e.target.value as SystemRole)}
                aria-label="Switch Active RBAC System Role"
                className="bg-transparent text-xs font-semibold text-blue-300 focus:outline-none cursor-pointer"
              >
                {SYSTEM_ROLES.map((r) => (
                  <option key={r.role} value={r.role} className="bg-slate-900 text-white">
                    {r.label} ({r.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={() => setCommandKOpen(true)}
            className="xl:hidden p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
            title="Search"
          >
            <Search className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setNotifOpen(true)}
            className="relative p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
              2
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSupportOpen(true)}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
            title="Diagnostics & Support"
          >
            <LifeBuoy className="w-4 h-4 text-cyan-400" />
          </button>
        </div>
      </header>

      {/* Workspace Category Ribbon */}
      <div className="bg-[#0d1424] border-b border-slate-800/80 px-4 py-2 flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-1.5">
          {CATEGORY_META.filter(
            (cat) => !cat.allowedRoles || cat.allowedRoles.includes(activeRole)
          ).map((cat) => {
            const Icon = cat.icon;
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setActiveCategory(cat.id);
                  for (const sec of PRODUCTION_SECTIONS) {
                    const match = sec.features.find(
                      (f) => f.category === cat.id && f.allowedRoles.includes(activeRole)
                    );
                    if (match) {
                      setActiveScreenId(match.screenId);
                      break;
                    }
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
                  active
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-500/30 font-semibold"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/70"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        <div className="hidden lg:flex items-center gap-2 text-[11px] text-slate-400 shrink-0">
          <span className={`px-2 py-0.5 rounded border text-[10px] font-mono ${currentRoleMeta.badgeColor}`}>
            {currentRoleMeta.role}
          </span>
          <span className="truncate max-w-xs">{currentRoleMeta.scopeDescription}</span>
        </div>
      </div>

      {/* Main Content Area with Collapsible Left Navigation Sidebar + Workspace + Right Context Drawer */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigation Sidebar (Production Sections & Features) */}
        <aside
          className={`${
            sidebarCollapsed ? "w-16" : "w-72"
          } border-r border-slate-800/90 bg-[#0b111e] flex flex-col justify-between transition-all duration-200 shrink-0`}
        >
          <div className="p-2.5 space-y-3 overflow-y-auto max-h-[calc(100vh-8.5rem)]">
            <div className="flex items-center justify-between px-2 py-1 text-[11px] font-mono uppercase text-slate-400">
              {!sidebarCollapsed && <span>Navigation</span>}
              <button
                type="button"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white ml-auto"
                title="Collapse / Expand Sidebar"
              >
                {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>
            </div>

            {PRODUCTION_SECTIONS.filter((sec) => sec.allowedRoles.includes(activeRole)).map((sec) => {
              const secFeatures = sec.features.filter((f) => f.allowedRoles.includes(activeRole));
              if (secFeatures.length === 0) return null;

              return (
                <div key={sec.id} className="space-y-1">
                  {!sidebarCollapsed && (
                    <div className="px-2 pt-2 pb-1 text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
                      {sec.name}
                    </div>
                  )}

                  {secFeatures.map((feat) => {
                    const isSelected = activeScreenId === feat.screenId;
                    return (
                      <button
                        key={feat.id}
                        type="button"
                        onClick={() => {
                          setActiveCategory(feat.category);
                          setActiveScreenId(feat.screenId);
                        }}
                        title={feat.name}
                        className={`w-full text-left px-2.5 py-2 rounded-xl transition flex items-center justify-between gap-2 ${
                          isSelected
                            ? "bg-blue-600/20 border border-blue-500/40 text-white font-medium"
                            : "hover:bg-slate-900 text-slate-400 hover:text-slate-200 border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isSelected ? "bg-blue-400 ring-2 ring-blue-500/40" : "bg-slate-600"
                            }`}
                          />
                          {!sidebarCollapsed && (
                            <span className="text-xs truncate">{feat.name}</span>
                          )}
                        </div>
                        {!sidebarCollapsed && feat.badge && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            {feat.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {!sidebarCollapsed && (
            <div className="p-3 border-t border-slate-800/80 bg-slate-950/60 text-[11px] text-slate-400 space-y-1">
              <div className="flex items-center justify-between">
                <span>Workstation</span>
                <span className="font-mono text-emerald-400">RAMANDEEP Online</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Security</span>
                <span className="font-mono text-cyan-400">AES-256 / SHA-256</span>
              </div>
            </div>
          )}
        </aside>

        {/* Center Main Workspace */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">{children}</main>

        {/* Context-Aware Right-Side Detail Drawer (AR Drawer) */}
        {drawerContext && (
          <aside className="w-96 border-l border-slate-800 bg-[#0d1424] p-5 overflow-y-auto shrink-0 shadow-2xl space-y-5">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {drawerContext.type} INSPECTOR
                </span>
                <h3 className="text-base font-bold text-white mt-1.5">{drawerContext.title}</h3>
                <p className="text-xs text-slate-400">{drawerContext.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerContext(null)}
                className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {drawerContext.employee && (
              <div className="space-y-4 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Status:</span>
                    <span className="font-mono font-semibold text-emerald-400">{drawerContext.employee.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Work Mode (HYB-001):</span>
                    <span className="font-mono text-cyan-300">{drawerContext.employee.workMode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Active App:</span>
                    <span className="text-white font-medium">{drawerContext.employee.currentApp}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Productivity Score:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {drawerContext.employee.productivityScore}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Keystrokes / Clicks:</span>
                    <span className="font-mono text-slate-200">
                      {drawerContext.employee.keystrokesPerMin} kpm • {drawerContext.employee.mouseClicksPerMin} cpm
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Hardware Asset:</span>
                    <span className="font-mono text-slate-300">
                      {drawerContext.employee.hardwareAssetId} ({drawerContext.employee.osPlatform})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Burnout / Flight Risk:</span>
                    <span className="font-mono text-amber-300">
                      {drawerContext.employee.burnoutRisk} ({drawerContext.employee.flightRiskScore}%)
                    </span>
                  </div>
                </div>

                {onOpenEmployee16Tab && (
                  <button
                    type="button"
                    onClick={() => onOpenEmployee16Tab(drawerContext.employee!)}
                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5"
                  >
                    Open Full 16-Tab Employee Profile (WF-002) <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {drawerContext.screenshot && (
              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="text-[11px] font-mono text-emerald-400">
                    AUDITED SCREENSHOT LIGHTBOX (SS-009)
                  </div>
                  <p className="text-slate-300 font-medium">{drawerContext.screenshot.windowTitle}</p>
                  <div className="grid grid-cols-2 gap-2 pt-2 text-[11px]">
                    <div className="p-2 rounded bg-slate-950">
                      <span className="text-slate-400 block">Activity %</span>
                      <span className="text-white font-mono font-bold">{drawerContext.screenshot.activityPct}%</span>
                    </div>
                    <div className="p-2 rounded bg-slate-950">
                      <span className="text-slate-400 block">Input Events</span>
                      <span className="text-white font-mono font-bold">
                        {drawerContext.screenshot.keystrokes}K / {drawerContext.screenshot.clicks}M
                      </span>
                    </div>
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 break-all pt-2">
                    S3 URI: {drawerContext.screenshot.storageBucket}
                  </div>
                </div>
              </div>
            )}

            {drawerContext.dlpIncident && (
              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-rose-400">{drawerContext.dlpIncident.id}</span>
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono text-[10px]">
                      {drawerContext.dlpIncident.severity}
                    </span>
                  </div>
                  <p className="text-slate-200">{drawerContext.dlpIncident.description}</p>
                  <div className="text-[11px] font-mono text-cyan-300">
                    Target/HWID: {drawerContext.dlpIncident.hardwareIdOrTarget}
                  </div>
                  <div className="text-[11px] text-emerald-300">
                    Automated Action: {drawerContext.dlpIncident.actionTaken} • Investigation Step{" "}
                    {drawerContext.dlpIncident.investigationStage} of 6
                  </div>
                </div>
              </div>
            )}

            {drawerContext.metadata && (
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
                {Object.entries(drawerContext.metadata).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2 border-b border-slate-800/60 pb-1.5 last:border-none">
                    <span className="text-slate-400">{k}</span>
                    <span className="font-mono text-slate-200 text-right">{String(v)}</span>
                  </div>
                ))}
              </div>
            )}
          </aside>
        )}
      </div>

      {/* SEARCH-001 Command-K Global Search & 422+ Screen Jump Modal */}
      {commandKOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-start justify-center pt-20 p-4">
          <div className="hydi-card max-w-2xl w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-mono text-blue-400">SEARCH-001..002 • FEDERATED COMMAND PALETTE</span>
              </div>
              <button
                type="button"
                onClick={() => setCommandKOpen(false)}
                className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Jump to any Screen ID (e.g. ATT-010, DLP-004, MON-005, SA-5, AI-008)..."
              className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-blue-500"
            />
            <div className="max-h-72 overflow-y-auto space-y-1.5">
              {filteredScreens.map((item) => (
                <button
                  key={item.screenId}
                  type="button"
                  onClick={() => {
                    setActiveCategory(item.category);
                    setActiveModuleId(item.moduleId);
                    setActiveScreenId(item.screenId);
                    setCommandKOpen(false);
                  }}
                  className="w-full text-left px-3.5 py-2 rounded-lg bg-slate-900/70 hover:bg-blue-600/20 border border-slate-800 hover:border-blue-500/40 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-mono font-bold text-blue-400 mr-2">{item.screenId}</span>
                    <span className="text-slate-200">{item.moduleName}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">{item.moduleId}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* NOTIF-001 Notification Center Modal */}
      {notifOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-md bg-[#0d1424] border-l border-slate-800 h-full p-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <span className="text-[10px] font-mono text-blue-400">NOTIF-001..002</span>
                  <h3 className="text-base font-bold text-white">Real-Time Priority Notifications</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setNotifOpen(false)}
                  className="p-1.5 rounded bg-slate-800 text-slate-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30">
                  <div className="font-mono text-rose-400 font-bold">DLP-004 CRITICAL USB BLOCK</div>
                  <p className="text-slate-200 mt-1">
                    Unapproved SanDisk Ultra USB blocked on endpoint HW-WIN-7731 (Lucas Meyer).
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30">
                  <div className="font-mono text-amber-400 font-bold">SUSP-001 ANTI-JIGGLER ALERT</div>
                  <p className="text-slate-200 mt-1">
                    Zero-variance mouse oscillation detected for 20 mins with 0 keystrokes.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-500/30">
                  <div className="font-mono text-blue-400 font-bold">TS-005 TIMESHEET APPROVAL QUEUE</div>
                  <p className="text-slate-200 mt-1">
                    14 Weekly Timesheets awaiting Manager Review before Friday 17:00 payroll lock.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30">
                  <div className="font-mono text-emerald-400 font-bold">PROD-008 RECLASSIFICATION COMPLETE</div>
                  <p className="text-slate-200 mt-1">
                    ClickHouse 90-day historical productivity reclassification completed in 1.42s.
                  </p>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setNotifOpen(false)}
              className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold"
            >
              Mark All Read & Close
            </button>
          </div>
        </div>
      )}

      {/* SUPPORT-001..006 In-App Diagnostics & Agent Log Collector Modal */}
      {supportOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="hydi-card max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono text-cyan-400">SUPPORT-001..006 • DIAGNOSTICS & SLA DESK</span>
                <h3 className="text-lg font-bold text-white">Desktop Agent & Platform Diagnostics</h3>
              </div>
              <button
                type="button"
                onClick={() => setSupportOpen(false)}
                className="p-1.5 rounded bg-slate-800 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between p-2.5 rounded bg-slate-900">
                <span className="text-slate-400">Desktop Agent Watchdog:</span>
                <span className="font-mono text-emerald-400">PID 4812 + PID 4819 (Dual-Process Active)</span>
              </div>
              <div className="flex justify-between p-2.5 rounded bg-slate-900">
                <span className="text-slate-400">Offline SQLite WAL Queue:</span>
                <span className="font-mono text-cyan-300">0 Pending Frames (100% Synced)</span>
              </div>
              <div className="flex justify-between p-2.5 rounded bg-slate-900">
                <span className="text-slate-400">mTLS Certificate Pinning (SA-6):</span>
                <span className="font-mono text-emerald-400">SHA256-Pin Matched</span>
              </div>
            </div>

            {supportBundleStatus && (
              <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{supportBundleStatus}</span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() =>
                  setSupportBundleStatus(
                    "Generated hydi_diag_bundle_20260928.tar.gz (Agent SQLite stats, WebRTC ICE logs, HAR trace)."
                  )
                }
                className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
              >
                Collect Agent Diagnostic Bundle (SUPPORT-003)
              </button>
              <button
                type="button"
                onClick={() => setSupportOpen(false)}
                className="px-4 py-2.5 rounded-lg bg-slate-800 text-xs text-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
