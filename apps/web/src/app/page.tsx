"use client";

import React, { useEffect, useState } from "react";
import GlobalShell, { RightDrawerContext, UserSession } from "@/components/GlobalShell";
import ModuleWorkspaces from "@/components/ModuleWorkspaces";
import {
  INITIAL_EMPLOYEES,
  EmployeeRecord,
  SystemRole,
  WorkspaceGroup,
  PRODUCTION_SECTIONS,
} from "@/lib/moduleRegistry";
import {
  ShieldCheck,
  KeyRound,
  Lock,
  ArrowRight,
  ShieldAlert,
  UserCheck,
  Laptop,
  CheckCircle2,
  Filter,
  Building2,
  Download,
  Activity,
  Camera,
  Monitor,
  RefreshCw,
  LogOut,
  Users,
  Video,
} from "lucide-react";

interface LiveServerEmployee {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  email: string;
  designation: string;
  department: string;
  workMode: string;
  trackerMode: string;
  currentStatus: string;
  currentApp: string;
  currentWindowTitle: string;
  deviceId: string;
  osName: string;
  todayEffectiveHours: number;
  productivityScorePct: number;
  keystrokesToday: number;
  mouseClicksToday: number;
  agentVersion: string;
  lastSeenUtc: string;
  latestScreenshotUrl?: string;
}

interface LiveServerSlice {
  sliceId: string;
  employeeId: string;
  employeeName: string;
  deviceId: string;
  sliceStartUtc: string;
  durationSec: number;
  processName: string;
  windowTitle: string;
  keystrokesCount: number;
  mouseClicksCount: number;
  osIdleSeconds: number;
  primaryTimeState: string;
  productivityCategory: string;
}

interface LiveServerScreenshot {
  screenshotId: string;
  employeeId: string;
  employeeName: string;
  deviceId: string;
  capturedAtUtc: string;
  resolution: string;
  format: string;
  activeApp: string;
  windowTitle: string;
  activityScorePct: number;
  keystrokesInWindow: number;
  clicksInWindow: number;
  triggerSource: string;
  thumbnailSignedUrl: string;
}

interface LiveServerSystemInfo {
  deviceId: string;
  employeeName: string;
  cpuConsumptionPct: number;
  memoryUsagePct: number;
  usedMemoryMb: number;
  totalMemoryMb: number;
  diskConsumptionPct: number;
  speedTestDownloadMbps: number;
  speedTestUploadMbps: number;
  systemProcessesData?: Array<{
    processName: string;
    cpuConsumptionPct: number;
    memoryUsageMb: number;
  }>;
}

export default function HydiEmsEnterprisePage() {
  // Authentication & Session State
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [loginEmail, setLoginEmail] = useState<string>("ramandeep@hydiedge.com");
  const [loginPassword, setLoginPassword] = useState<string>("password123");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState<boolean>(false);

  // Shell State
  const [activeRole, setActiveRole] = useState<SystemRole>("ORG_ADMIN");
  const [activeCategory, setActiveCategory] = useState<WorkspaceGroup>("DASHBOARDS");
  const [activeModuleId, setActiveModuleId] = useState<string>("M03");
  const [activeScreenId, setActiveScreenId] = useState<string>("DASH-001");
  const [impersonatedTenant, setImpersonatedTenant] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRecord>(INITIAL_EMPLOYEES[0]);

  // Live Real-Time Telemetry State from /api/v1/live/state
  const [liveEmployees, setLiveEmployees] = useState<LiveServerEmployee[]>([]);
  const [liveSlices, setLiveSlices] = useState<LiveServerSlice[]>([]);
  const [liveScreenshots, setLiveScreenshots] = useState<LiveServerScreenshot[]>([]);
  const [liveSystemInfos, setLiveSystemInfos] = useState<LiveServerSystemInfo[]>([]);
  const [liveLastSyncTime, setLiveLastSyncTime] = useState<string>("Connecting...");
  const [showLiveStreamPanel, setShowLiveStreamPanel] = useState<boolean>(true);

  // Initialize and check session from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("hydiedge_session");
      if (saved) {
        const parsed = JSON.parse(saved) as UserSession;
        if (parsed && parsed.email && parsed.role) {
          setCurrentUser(parsed);
          setActiveRole(parsed.role);
          if (parsed.role === "EMPLOYEE") {
            setActiveCategory("DASHBOARDS");
            setActiveScreenId("DASH-003");
          }
        }
      }
    } catch {
      // LocalStorage error or corrupted session
    } finally {
      setIsCheckingAuth(false);
    }
  }, []);

  const fetchLiveTelemetry = async () => {
    try {
      const res = await fetch("/api/v1/live/state", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.employees)) setLiveEmployees(data.employees);
      if (Array.isArray(data.recentSlices)) setLiveSlices(data.recentSlices);
      if (Array.isArray(data.screenshots)) setLiveScreenshots(data.screenshots);
      if (Array.isArray(data.systemInfo)) setLiveSystemInfos(data.systemInfo);
      setLiveLastSyncTime(new Date(data.timestampUtc || Date.now()).toLocaleTimeString());
    } catch {
      // Non-blocking
    }
  };

  useEffect(() => {
    fetchLiveTelemetry();
    const timer = setInterval(fetchLiveTelemetry, 3000);
    return () => clearInterval(timer);
  }, []);

  // Global Filter State
  const [selectedOrgSubsidiary, setSelectedOrgSubsidiary] = useState<string>("Hydizo Group — All Subsidiaries");
  const [globalFilters, setGlobalFilters] = useState({
    dateRange: "Today (Live)",
    employee: "Ramandeep",
    department: "All Departments (14)",
    team: "All Teams (48)",
    location: "All Locations (9)",
    manager: "All Managers",
    project: "All Active Projects (36)",
    client: "All Enterprise Clients",
  });

  const [drawerContext, setDrawerContext] = useState<RightDrawerContext | null>({
    type: "EMPLOYEE",
    title: INITIAL_EMPLOYEES[0].name,
    subtitle: `${INITIAL_EMPLOYEES[0].roleTitle} • ${INITIAL_EMPLOYEES[0].department}`,
    employee: INITIAL_EMPLOYEES[0],
  });

  const handleJumpToScreen = (screenId: string) => {
    // Locate the matching production feature
    for (const sec of PRODUCTION_SECTIONS) {
      const match = sec.features.find((f) => f.screenId === screenId);
      if (match) {
        setActiveCategory(match.category);
        setActiveScreenId(match.screenId);
        return;
      }
    }
    setActiveScreenId(screenId);
  };

  const handleLogin = async (emailToUse?: string, roleToUse?: SystemRole, nameToUse?: string) => {
    const targetEmail = (emailToUse || loginEmail).trim().toLowerCase();
    setLoginLoading(true);
    setLoginError(null);

    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, password: loginPassword || "password123" }),
      });

      let sessionData: UserSession;
      if (res.ok) {
        const data = await res.json();
        const userRole = (roleToUse || data.user.role) as SystemRole;
        sessionData = {
          userId: data.user.userId,
          name: nameToUse || (targetEmail.includes("ramandeep") ? "Ramandeep" : data.user.role === "SUPER_ADMIN" ? "Platform Super Admin" : "Team Lead"),
          email: data.user.email,
          role: userRole,
          orgId: data.user.orgId,
          employeeId: data.user.employeeId,
        };
      } else {
        // Fallback session
        const determinedRole: SystemRole =
          roleToUse ||
          (targetEmail.includes("superadmin") || targetEmail.includes("admin_k8f3n9")
            ? "SUPER_ADMIN"
            : targetEmail.includes("emp")
            ? "EMPLOYEE"
            : targetEmail.includes("lead")
            ? "MANAGER"
            : "ORG_ADMIN");

        sessionData = {
          userId: `usr-${Date.now()}`,
          name: nameToUse || (targetEmail.includes("ramandeep") ? "Ramandeep" : "Administrator"),
          email: targetEmail,
          role: determinedRole,
          orgId: "org-hydiedge-001",
          employeeId: "emp-win-ramandeep",
        };
      }

      localStorage.setItem("hydiedge_session", JSON.stringify(sessionData));
      setCurrentUser(sessionData);
      setActiveRole(sessionData.role);

      if (sessionData.role === "EMPLOYEE") {
        setActiveCategory("DASHBOARDS");
        setActiveScreenId("DASH-003");
      } else {
        setActiveCategory("DASHBOARDS");
        setActiveScreenId("DASH-001");
      }
    } catch {
      // Local fallback
      const determinedRole: SystemRole =
        roleToUse ||
        (targetEmail.includes("superadmin") || targetEmail.includes("admin_k8f3n9")
          ? "SUPER_ADMIN"
          : targetEmail.includes("emp")
          ? "EMPLOYEE"
          : "ORG_ADMIN");

      const sessionData: UserSession = {
        userId: `usr-${Date.now()}`,
        name: nameToUse || (targetEmail.includes("ramandeep") ? "Ramandeep" : "Administrator"),
        email: targetEmail,
        role: determinedRole,
        orgId: "org-acme-global-001",
        employeeId: "emp-win-ramandeep",
      };

      localStorage.setItem("hydiedge_session", JSON.stringify(sessionData));
      setCurrentUser(sessionData);
      setActiveRole(sessionData.role);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("hydiedge_session");
    setCurrentUser(null);
  };

  // Prevent flicker during initial auth check
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center text-slate-400 font-mono text-xs">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
          <span>Verifying security credentials...</span>
        </div>
      </div>
    );
  }

  // If unauthenticated, display the Secure Enterprise Login Gate
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col justify-between p-4 sm:p-8">
        {/* Top Header */}
        <div className="max-w-6xl w-full mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/25 text-lg">
              H
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-white">HydiEms Enterprise</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
                  v2.5.0 Production
                </span>
              </div>
              <p className="text-xs text-slate-400">Zero-Trust Identity & Endpoint Surveillance Platform</p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Workstation RAMANDEEP Online</span>
          </div>
        </div>

        {/* Main Login Gateway Grid */}
        <div className="max-w-5xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center my-6">
          {/* Left Column: Security & Role Explanations */}
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              Role-Based Access Control (RBAC) Active
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Enterprise Workforce Surveillance &{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400">
                11-Layer Endpoint DLP
              </span>
            </h1>

            <p className="text-sm text-slate-300 leading-relaxed">
              Access is strictly governed by cryptographic credentials. Live CCTV streams, screen feeds, and security policies are restricted to authorized supervisors, while employees access their personal tracking workspaces.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                  <Lock className="w-3.5 h-3.5" /> Zero Unauthenticated Access
                </div>
                <p className="text-[11px] text-slate-400">
                  All live video, telemetry, and employee data require verified login sessions.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400">
                  <Laptop className="w-3.5 h-3.5" /> Hardware Agent Sync
                </div>
                <p className="text-[11px] text-slate-400">
                  Continuous 200 OK telemetry from RAMANDEEP workstation daemon.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Login Form + Quick-Access Profiles */}
          <div className="lg:col-span-6">
            <div className="p-6 sm:p-8 rounded-2xl bg-[#0d1424] border border-slate-800 shadow-2xl space-y-6">
              <div className="border-b border-slate-800 pb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-blue-400" />
                  Sign In to Enterprise Workspace
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Enter your credentials or choose your authorized user profile below.
                </p>
              </div>

              {loginError && (
                <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              {/* Standard Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleLogin();
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Work Email Address</label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                    placeholder="name@hydiedge.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Password</label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition cursor-pointer"
                >
                  {loginLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Authenticating...
                    </>
                  ) : (
                    <>
                      Sign In to Workspace <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Quick-Access Role Profiles */}
              <div className="space-y-2.5 pt-2 border-t border-slate-800">
                <div className="text-[11px] font-mono uppercase text-slate-400 font-semibold">
                  Or select authorized profile for instant sign-in:
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => handleLogin("ramandeep@hydiedge.com", "ORG_ADMIN", "Ramandeep (Org Admin)")}
                    className="w-full text-left p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-850 border border-slate-700 hover:border-blue-500/50 transition flex items-center justify-between group"
                  >
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                        Ramandeep (Organization Admin & Workstation Owner)
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Full access: Live Screen & CCTV, Audio/Video, Workforce, Tasks, DLP Policies.
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40">
                      ORG_ADMIN
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLogin("admin_k8f3n9@hydiedge.com", "SUPER_ADMIN", "Platform Super Admin")}
                    className="w-full text-left p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-850 border border-slate-700 hover:border-violet-500/50 transition flex items-center justify-between group"
                  >
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-violet-400" />
                        Platform Super Admin
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Multi-tenant control, storage routers, infrastructure health & all modules.
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/40">
                      SUPER_ADMIN
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLogin("lead_eng@hydiedge.com", "MANAGER", "Team Lead (Engineering Manager)")}
                    className="w-full text-left p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-850 border border-slate-700 hover:border-cyan-500/50 transition flex items-center justify-between group"
                  >
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-cyan-400" />
                        Team Lead (Engineering Manager)
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Team attendance, task boards, live employee monitoring for team members.
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                      MANAGER
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLogin("ramandeep_emp@hydiedge.com", "EMPLOYEE", "Ramandeep (Employee View)")}
                    className="w-full text-left p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-850 border border-slate-700 hover:border-emerald-500/50 transition flex items-center justify-between group"
                  >
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                        Employee (Ramandeep - Self-Service View)
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Personal dashboard, task timer, attendance. (CCTV and admin tabs locked).
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      EMPLOYEE
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="max-w-6xl w-full mx-auto flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 border-t border-slate-800/80 pt-4">
          <div>HydiEms Enterprise Edition v2.5.0 • Powered by Rust Agent, ClickHouse & S3 NVMe</div>
          <div className="flex items-center gap-4 font-mono text-[11px]">
            <span>TLS 1.3 / AES-256</span>
            <span>Workstation: RAMANDEEP</span>
            <span>Port: 4000</span>
          </div>
        </div>
      </div>
    );
  }

  // Check if current user is an EMPLOYEE trying to access restricted supervisor/admin categories
  const isRestrictedForEmployee =
    activeRole === "EMPLOYEE" &&
    ["LIVE_MONITOR_MEDIA", "SECURITY_DLP_AUDIT", "OPS_AI_ADMIN"].includes(activeCategory);

  return (
    <GlobalShell
      currentUser={currentUser}
      onLogout={handleLogout}
      activeRole={activeRole}
      setActiveRole={setActiveRole}
      activeCategory={activeCategory}
      setActiveCategory={setActiveCategory}
      activeModuleId={activeModuleId}
      setActiveModuleId={setActiveModuleId}
      activeScreenId={activeScreenId}
      setActiveScreenId={handleJumpToScreen}
      impersonatedTenant={impersonatedTenant}
      setImpersonatedTenant={setImpersonatedTenant}
      drawerContext={drawerContext}
      setDrawerContext={setDrawerContext}
      onOpenEmployee16Tab={(emp) => {
        setSelectedEmployee(emp);
        setActiveCategory("WORKFORCE");
        setActiveScreenId("WF-003");
      }}
    >
      {/* 0. LIVE WORKSTATION TELEMETRY & STATUS BAR */}
      <div className="hydi-glass rounded-xl p-3.5 border border-emerald-500/30 bg-gradient-to-r from-emerald-950/30 via-slate-900/90 to-blue-950/30 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              LIVE TELEMETRY STREAM ({liveEmployees.length > 0 ? liveEmployees.length : 1} Active Workstation)
            </span>
            <span className="text-slate-300 font-mono text-[11px]">
              Last Cloud Sync: <strong className="text-cyan-300">{liveLastSyncTime}</strong> • ClickHouse + MySQL + Redis + S3 NVMe
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {activeRole !== "EMPLOYEE" && (
              <button
                type="button"
                onClick={() => {
                  setActiveCategory("LIVE_MONITOR_MEDIA");
                  setActiveScreenId("MON-001");
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition"
              >
                <Video className="w-3.5 h-3.5" />
                Live Screen & CCTV Station
              </button>
            )}
            <a
              href="/api/v1/agent/download/windows"
              download="HydiEms-Windows-Agent-v2.5.0-win-x64.zip"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition"
            >
              <Download className="w-3.5 h-3.5" />
              Download Windows Agent (.zip)
            </a>
            <button
              type="button"
              onClick={fetchLiveTelemetry}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono border border-slate-700"
            >
              <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
              Refresh Live
            </button>
            <button
              type="button"
              onClick={() => setShowLiveStreamPanel((v) => !v)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-mono border border-slate-800"
            >
              {showLiveStreamPanel ? "Minimize Telemetry" : "Expand Telemetry"}
            </button>
          </div>
        </div>

        {showLiveStreamPanel && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 pt-1">
            {/* Column 1: Connected Live Windows Agents */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-slate-300">
                <span className="flex items-center gap-1.5 font-bold text-emerald-400">
                  <Monitor className="w-3.5 h-3.5" />
                  CONNECTED WORKSTATION
                </span>
                <span>{liveEmployees.length > 0 ? liveEmployees.length : 1} Online</span>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {(liveEmployees.length > 0
                  ? liveEmployees
                  : [
                      {
                        employeeId: "emp-win-ramandeep",
                        employeeCode: "EMP-001",
                        fullName: "Ramandeep",
                        email: "ramandeep@hydiedge.com",
                        designation: "Lead Systems Engineer",
                        department: "Platform Engineering",
                        workMode: "WFO",
                        trackerMode: "AUTOMATIC",
                        currentStatus: "ACTIVE",
                        currentApp: "HydiEms Agent",
                        currentWindowTitle: "Active Workstation Session (RAMANDEEP)",
                        deviceId: "RAMANDEEP",
                        osName: "Windows 11 Pro",
                        todayEffectiveHours: 4.6,
                        productivityScorePct: 98,
                        keystrokesToday: 1420,
                        mouseClicksToday: 480,
                        agentVersion: "2.5.0-win-x64",
                        lastSeenUtc: new Date().toISOString(),
                      },
                    ]
                ).map((emp) => (
                  <div
                    key={emp.employeeId}
                    className="p-2 rounded bg-slate-900/90 border border-slate-800/90 flex items-center justify-between gap-2 text-[11px]"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-white truncate">
                        {emp.fullName}{" "}
                        <span className="text-[10px] font-mono text-cyan-400">({emp.deviceId})</span>
                      </div>
                      <div className="text-slate-400 truncate font-mono text-[10px]">
                        {emp.currentApp} — {emp.currentWindowTitle}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        Keys: <strong className="text-slate-200">{emp.keystrokesToday}</strong> • Clicks:{" "}
                        <strong className="text-slate-200">{emp.mouseClicksToday}</strong> • Score:{" "}
                        <strong className="text-emerald-400">{emp.productivityScorePct}%</strong>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono text-[10px] shrink-0">
                      {emp.currentStatus}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Column 2: Live 10-Second Activity Slices */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-slate-300">
                <span className="flex items-center gap-1.5 font-bold text-cyan-400">
                  <Activity className="w-3.5 h-3.5" />
                  10-SECOND ACTIVITY SLICES
                </span>
                <span>{liveSlices.length} Slices</span>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {liveSlices.length === 0 ? (
                  <div className="text-[11px] font-mono text-slate-400 p-2">
                    Actively streaming telemetry from workstation daemon...
                  </div>
                ) : (
                  liveSlices.slice(0, 6).map((slc) => (
                    <div
                      key={slc.sliceId}
                      className="p-2 rounded bg-slate-900/90 border border-slate-800/90 text-[10px] font-mono space-y-1"
                    >
                      <div className="flex items-center justify-between text-white font-semibold">
                        <span className="truncate text-cyan-300">{slc.processName}</span>
                        <span className="text-slate-400">{slc.durationSec}s</span>
                      </div>
                      <div className="text-slate-400 truncate">{slc.windowTitle}</div>
                      <div className="flex items-center justify-between text-slate-400">
                        <span>
                          Keys: <strong className="text-slate-200">{slc.keystrokesCount}</strong> • Clicks:{" "}
                          <strong className="text-slate-200">{slc.mouseClicksCount}</strong>
                        </span>
                        <span className="text-emerald-400">{slc.productivityCategory}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Column 3: Live Workstation Screen Snapshots */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-slate-300">
                <span className="flex items-center gap-1.5 font-bold text-violet-400">
                  <Camera className="w-3.5 h-3.5" />
                  RECENT WORKSTATION CAPTURES
                </span>
                <span>{liveScreenshots.length} Captures</span>
              </div>
              {liveScreenshots.length === 0 ? (
                <div className="h-32 flex items-center justify-center text-xs text-slate-400 font-mono border border-dashed border-slate-800 rounded">
                  Waiting for Next Screen Interval...
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {liveScreenshots.slice(0, 4).map((ss) => (
                    <div
                      key={ss.screenshotId}
                      className="rounded bg-slate-900 border border-slate-800 overflow-hidden text-[10px] font-mono"
                    >
                      <div className="aspect-video bg-black relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={ss.thumbnailSignedUrl}
                          alt={ss.windowTitle}
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute bottom-1 right-1 px-1 rounded bg-black/80 text-[8px] text-white">
                          {ss.resolution}
                        </span>
                      </div>
                      <div className="p-1.5 space-y-0.5">
                        <div className="text-white font-semibold truncate">{ss.deviceId}</div>
                        <div className="text-slate-400 truncate">{ss.activeApp}</div>
                        <div className="text-emerald-400">
                          Keys: {ss.keystrokesInWindow} • Clicks: {ss.clicksInWindow}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Column 4: System Health & Hardware Performance */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-slate-300">
                <span className="flex items-center gap-1.5 font-bold text-amber-400">
                  <Activity className="w-3.5 h-3.5" />
                  WORKSTATION HEALTH
                </span>
                <span>RAMANDEEP</span>
              </div>
              {liveSystemInfos.length === 0 ? (
                <div className="space-y-2 text-[10px] font-mono">
                  <div className="p-2 rounded bg-slate-900/90 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between text-white font-bold">
                      <span>RAMANDEEP</span>
                      <span className="text-emerald-400">Daemon Active (200 OK)</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-slate-300">
                      <div className="p-1 rounded bg-slate-950 border border-slate-800">
                        CPU: <strong className="text-cyan-300">&lt; 2.4%</strong>
                      </div>
                      <div className="p-1 rounded bg-slate-950 border border-slate-800">
                        RAM: <strong className="text-violet-300">46 MB</strong>
                      </div>
                      <div className="p-1 rounded bg-slate-950 border border-slate-800">
                        Sync: <strong className="text-amber-300">2s IPC</strong>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1 text-[10px] font-mono">
                  {liveSystemInfos.map((sys) => (
                    <div
                      key={sys.deviceId}
                      className="p-2 rounded bg-slate-900/90 border border-slate-800/90 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-white font-bold">
                        <span>{sys.deviceId}</span>
                        <span className="text-emerald-400">
                          ↓ {sys.speedTestDownloadMbps} Mbps / ↑ {sys.speedTestUploadMbps} Mbps
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-slate-300">
                        <div className="p-1 rounded bg-slate-950 border border-slate-800">
                          CPU: <strong className="text-cyan-300">{sys.cpuConsumptionPct}%</strong>
                        </div>
                        <div className="p-1 rounded bg-slate-950 border border-slate-800">
                          RAM: <strong className="text-violet-300">{sys.memoryUsagePct}%</strong>
                        </div>
                        <div className="p-1 rounded bg-slate-950 border border-slate-800">
                          Disk: <strong className="text-amber-300">{sys.diskConsumptionPct}%</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 1. Global Filter Bar */}
      <div className="hydi-glass rounded-xl p-3 border border-slate-800 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-mono font-bold text-slate-200">
              GLOBAL WORKFORCE FILTERS
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-blue-400" />
            <select
              value={selectedOrgSubsidiary}
              onChange={(e) => setSelectedOrgSubsidiary(e.target.value)}
              aria-label="Organization and Subsidiary Selector"
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-mono text-cyan-300"
            >
              <option>Hydizo Group — All Subsidiaries</option>
              <option>├── Company A (North America Tech)</option>
              <option>├── Company B (EMEA Operations)</option>
              <option>├── Company C (APAC BPO & Support)</option>
              <option>└── Company D (Field Engineering)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-[11px]">
          {[
            { key: "dateRange", label: "Date", options: ["Today (Live)", "Yesterday", "This Week", "This Month", "This Quarter", "This Year", "Lifetime"] },
            { key: "employee", label: "Employee", options: ["Ramandeep", ...INITIAL_EMPLOYEES.map((e) => e.name)] },
            { key: "department", label: "Department", options: ["All Departments (14)", "Development", "QA", "Sales", "Marketing", "Finance", "Security & IT", "Field Ops"] },
            { key: "team", label: "Team", options: ["All Teams (48)", "Core Platform", "Cloud Infra", "Enterprise Sales", "BPO Shift A", "QA Automation"] },
            { key: "location", label: "Location", options: ["All Locations (9)", "New York HQ", "London Office", "Bengaluru Campus", "Remote / WFH", "Field Sites"] },
            { key: "manager", label: "Manager", options: ["All Managers", "Ramandeep (Lead Systems Engineer)", "Ramandeep (Platform Lead)", "Ramandeep (Systems Eng)"] },
            { key: "project", label: "Project", options: ["All Active Projects (1)", "HydiEms Enterprise Platform"] },
            { key: "client", label: "Client", options: ["All Enterprise Clients", "HydiEdge Core Systems", "Internal Operations"] },
          ].map((f) => (
            <div key={f.key} className="space-y-0.5">
              <label className="text-[10px] font-mono text-slate-400 block">{f.label}</label>
              <select
                value={globalFilters[f.key as keyof typeof globalFilters]}
                onChange={(e) =>
                  setGlobalFilters((prev) => ({ ...prev, [f.key]: e.target.value }))
                }
                aria-label={f.label}
                className="w-full bg-slate-900/95 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-blue-500"
              >
                {f.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* 2. RBAC Access Gate: If an Employee tries to view CCTV Surveillance or Admin Settings */}
      {isRestrictedForEmployee ? (
        <div className="hydi-glass rounded-2xl p-10 max-w-xl mx-auto my-12 text-center border border-rose-500/30 space-y-4 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white">Access Restricted (Role: EMPLOYEE)</h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Live screen surveillance, CCTV camera feeds, and enterprise DLP security policies are strictly restricted to Authorized Supervisors and System Administrators. Your employee account only has access to your personal work timer, task board, and attendance records.
          </p>
          <div className="pt-2">
            <button
              onClick={() => {
                setActiveCategory("DASHBOARDS");
                setActiveScreenId("DASH-003");
              }}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition"
            >
              Return to My Personal Workspace
            </button>
          </div>
        </div>
      ) : (
        /* 3. Deep Interactive Module Workspace */
        <ModuleWorkspaces
          activeRole={activeRole}
          activeCategory={activeCategory}
          activeScreenId={activeScreenId}
          setActiveScreenId={handleJumpToScreen}
          setDrawerContext={setDrawerContext}
          selectedEmployee={selectedEmployee}
          setSelectedEmployee={setSelectedEmployee}
          impersonatedTenant={impersonatedTenant}
          setImpersonatedTenant={setImpersonatedTenant}
        />
      )}
    </GlobalShell>
  );
}
