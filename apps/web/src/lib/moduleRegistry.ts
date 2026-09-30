export type SystemRole =
  | "SUPER_ADMIN"
  | "ORG_ADMIN"
  | "EXECUTIVE"
  | "DEPT_HEAD"
  | "MANAGER"
  | "HR_ADMIN"
  | "FINANCE_ADMIN"
  | "SECURITY_ADMIN"
  | "EMPLOYEE";

export interface RoleMetadata {
  role: SystemRole;
  label: string;
  badgeColor: string;
  scopeDescription: string;
}

export const SYSTEM_ROLES: RoleMetadata[] = [
  {
    role: "SUPER_ADMIN",
    label: "SaaS Super Admin",
    badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/40",
    scopeDescription: "Multi-tenant platform operator, Storage Router (SA-5), SSL Pinning (SA-6), Audited Tenant Impersonation",
  },
  {
    role: "ORG_ADMIN",
    label: "Organization Admin",
    badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/40",
    scopeDescription: "Full tenant configuration, 33 modules, DLP policies, Agent deployment, RBAC & Billing",
  },
  {
    role: "EXECUTIVE",
    label: "Executive / C-Suite",
    badgeColor: "bg-violet-500/20 text-violet-300 border-violet-500/40",
    scopeDescription: "Org-wide executive KPIs, BPO shrinkage, software license ROI, flight-risk & burnout telemetry",
  },
  {
    role: "DEPT_HEAD",
    label: "Department Head",
    badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
    scopeDescription: "Department-scoped workforce analytics, capacity planning, OKRs, budget & timesheet sign-off",
  },
  {
    role: "MANAGER",
    label: "Team Manager",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    scopeDescription: "Direct reports live monitor, screenshots, timesheet approvals, shift scheduling & sprint boards",
  },
  {
    role: "HR_ADMIN",
    label: "HR Administrator",
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    scopeDescription: "Employee lifecycle, 16-tab records, leave accrual, 360 reviews, pulse surveys & compliance",
  },
  {
    role: "FINANCE_ADMIN",
    label: "Finance & Payroll Admin",
    badgeColor: "bg-teal-500/20 text-teal-300 border-teal-500/40",
    scopeDescription: "Locked timesheets, client billing invoices, payroll ledger, multi-currency rates & license spend",
  },
  {
    role: "SECURITY_ADMIN",
    label: "Security & DLP Officer",
    badgeColor: "bg-red-500/20 text-red-300 border-red-500/40",
    scopeDescription: "11-Layer DLP, USB hardware whitelist, anti-jiggler forensics, SIEM streaming & SHA-256 audit chain",
  },
  {
    role: "EMPLOYEE",
    label: "Employee Self-Service",
    badgeColor: "bg-slate-500/20 text-slate-300 border-slate-500/40",
    scopeDescription: "Personal timer, Personal Mode toggle, own screenshots/timesheets, Privacy Center & data access log",
  },
];

export type WorkspaceGroup =
  | "DASHBOARDS"
  | "WORKFORCE"
  | "TIME_ATTENDANCE"
  | "PRODUCTIVITY_APPS"
  | "LIVE_MONITOR_MEDIA"
  | "PROJECTS_TASKS_BILLING"
  | "SECURITY_DLP_AUDIT"
  | "HR_PERF_PAYROLL"
  | "OPS_AI_ADMIN";

export interface CoreModuleSpec {
  id: string;
  code: string;
  name: string;
  category: WorkspaceGroup;
  screenPrefix: string;
  screenCount: number;
  screenIds: string[];
  allowedRoles: SystemRole[];
  description: string;
  highlights: string[];
}

function buildScreens(prefix: string, count: number, extra: string[] = []): string[] {
  const list: string[] = [];
  for (let i = 1; i <= count; i++) {
    list.push(`${prefix}-${String(i).padStart(3, "0")}`);
  }
  return [...list, ...extra];
}

export const ALL_ROLES: SystemRole[] = [
  "SUPER_ADMIN",
  "ORG_ADMIN",
  "EXECUTIVE",
  "DEPT_HEAD",
  "MANAGER",
  "HR_ADMIN",
  "FINANCE_ADMIN",
  "SECURITY_ADMIN",
  "EMPLOYEE",
];

const MGR_UP: SystemRole[] = [
  "SUPER_ADMIN",
  "ORG_ADMIN",
  "EXECUTIVE",
  "DEPT_HEAD",
  "MANAGER",
];

export const CORE_MODULES: CoreModuleSpec[] = [
  {
    id: "M01",
    code: "AUTH",
    name: "Authentication, SSO, MFA & 8-Step Onboarding",
    category: "OPS_AI_ADMIN",
    screenPrefix: "AUTH",
    screenCount: 8,
    screenIds: [...buildScreens("AUTH", 8), ...buildScreens("ORG", 10), ...buildScreens("ENT", 5)],
    allowedRoles: ALL_ROLES,
    description: "RS256 JWT + Redis JTI revocation, SAML 2.0/OIDC SSO, TOTP 2FA, 8-Step Onboarding Wizard, and Multi-Subsidiary Org Hierarchy (ORG-001..010, ENT-001..005).",
    highlights: ["AUTH-001 Sign-In", "AUTH-005 8-Step Wizard", "ORG-008 Org Hierarchy", "ENT-001 Subsidiaries"],
  },
  {
    id: "M02",
    code: "SHELL",
    name: "Global Shell, Command-K, Help & Support",
    category: "DASHBOARDS",
    screenPrefix: "G",
    screenCount: 4,
    screenIds: [
      ...buildScreens("G", 4),
      ...buildScreens("SEARCH", 3),
      ...buildScreens("NOTIF", 4),
      ...buildScreens("HELP", 4),
      ...buildScreens("SUPPORT", 6),
      ...buildScreens("SYS", 3),
    ],
    allowedRoles: ALL_ROLES,
    description: "Unified Enterprise App Shell (G-001), Global Search (SEARCH-001..002), Notifications, Help Center (HELP-001..004), Support Diagnostics (SUPPORT-001..006), and System Health (SYS-001..003).",
    highlights: ["G-001 Global Shell", "SEARCH-001 Command-K", "HELP-001 Help Center", "SYS-001 System Health"],
  },
  {
    id: "M03",
    code: "DASH",
    name: "Executive, Manager & Custom Dashboards",
    category: "DASHBOARDS",
    screenPrefix: "DASH",
    screenCount: 10,
    screenIds: [...buildScreens("DASH", 10), ...buildScreens("DB", 4)],
    allowedRoles: ALL_ROLES,
    description: "8 Executive KPI Cards, 7 Interactive Charts, HydiAI Daily Briefing, and Drag-and-Drop Custom Widget Builder.",
    highlights: ["DASH-001 Executive", "DASH-002 Manager", "DASH-003 Employee", "DB-001 Widget Builder"],
  },
  {
    id: "M04",
    code: "WF",
    name: "Workforce Directory & 16-Tab Profile",
    category: "WORKFORCE",
    screenPrefix: "WF",
    screenCount: 12,
    screenIds: [
      ...buildScreens("WF", 12),
      ...buildScreens("HYB", 4),
      ...buildScreens("DEVICE", 4),
      ...buildScreens("BULK", 1),
      ...buildScreens("IMPORT", 3),
      ...buildScreens("ARCHIVE", 4),
    ],
    allowedRoles: [...MGR_UP, "HR_ADMIN", "SECURITY_ADMIN"],
    description: "Real-time employee directory, 16-Tab 360° Employee Profile, Hybrid WFO/WFH policy, Hardware Inventory, Bulk Ops (BULK-001), Import Center, and Archive Vault.",
    highlights: ["WF-001 Directory", "WF-003 16-Tab Profile", "HYB-001 WFO/WFH", "DEVICE-001 Hardware"],
  },
  {
    id: "M05",
    code: "TIME",
    name: "8-State Time Tracking & Idle Engine",
    category: "TIME_ATTENDANCE",
    screenPrefix: "TIME",
    screenCount: 12,
    screenIds: [...buildScreens("TIME", 12), ...buildScreens("SHIFT", 6)],
    allowedRoles: ALL_ROLES,
    description: "Deterministic 8-State Time Engine (Working, Productive, Non-Productive, Neutral, No-Impact, Idle, Away, Offline), Personal Mode, and Shift Roster.",
    highlights: ["TIME-001 Timeline", "TIME-008 8-State Engine", "TIME-009 Personal Mode", "SHIFT-001 Roster"],
  },
  {
    id: "M06",
    code: "ATT",
    name: "Attendance, Overrides & BPO Shrinkage",
    category: "TIME_ATTENDANCE",
    screenPrefix: "ATT",
    screenCount: 14,
    screenIds: buildScreens("ATT", 14),
    allowedRoles: [...MGR_UP, "HR_ADMIN", "FINANCE_ADMIN", "EMPLOYEE"],
    description: "Automated clock-in/out verification, exception override queue, and interactive BPO Shrinkage Calculator (ATT-010).",
    highlights: ["ATT-001 Daily Log", "ATT-006 Override Queue", "ATT-010 BPO Shrinkage", "ATT-012 Break Split"],
  },
  {
    id: "M07",
    code: "PROD",
    name: "6-Way Productivity & Regex Rule Engine",
    category: "PRODUCTIVITY_APPS",
    screenPrefix: "PROD",
    screenCount: 12,
    screenIds: buildScreens("PROD", 12),
    allowedRoles: ALL_ROLES,
    description: "6-Way Productivity Split, Level-2 Window Title/URL Regex Classifier, and 1-Click 90-Day Historical Reclassification.",
    highlights: ["PROD-001 6-Way Split", "PROD-006 Regex Rules", "PROD-007 Reclassify", "PROD-011 Work-Life Balance"],
  },
  {
    id: "M08",
    code: "ACT",
    name: "Activity Heatmap & Input Intensity",
    category: "PRODUCTIVITY_APPS",
    screenPrefix: "ACT",
    screenCount: 10,
    screenIds: [...buildScreens("ACT", 10), ...buildScreens("ANA", 11), ...buildScreens("PATTERN", 2)],
    allowedRoles: [...MGR_UP, "SECURITY_ADMIN", "EMPLOYEE"],
    description: "Hour×Day Activity Heatmap, Keystroke/Mouse intensity, Enterprise Workforce Analytics (ANA-001..011), Focus Time Engine, and Work Pattern Analysis (PATTERN-001..002).",
    highlights: ["ACT-001 Activity", "ANA-008 Focus Engine", "ANA-010 Lifetime Heatmap", "PATTERN-001 Work Patterns"],
  },
  {
    id: "M09",
    code: "APP",
    name: "App Governance & Software License ROI",
    category: "PRODUCTIVITY_APPS",
    screenPrefix: "APP",
    screenCount: 8,
    screenIds: [...buildScreens("APP", 8), ...buildScreens("LIC", 6)],
    allowedRoles: [...MGR_UP, "FINANCE_ADMIN", "SECURITY_ADMIN"],
    description: "Application Governance & Risk Matrix (APP-001..004) paired with Software License Waste & Seat Reclaim Calculator (LIC-001..005).",
    highlights: ["APP-001 App Inventory", "APP-004 Risk Matrix", "LIC-003 License Waste", "LIC-005 Shadow IT"],
  },
  {
    id: "M10",
    code: "MON",
    name: "WebRTC Live Monitor & Office TV Wallboard",
    category: "LIVE_MONITOR_MEDIA",
    screenPrefix: "MON",
    screenCount: 10,
    screenIds: buildScreens("MON", 10),
    allowedRoles: ["SUPER_ADMIN", "ORG_ADMIN", "DEPT_HEAD", "MANAGER", "SECURITY_ADMIN"],
    description: "Sub-second WebRTC Live Screen Grid (Tiny/Small/Medium/Large), Multi-Monitor Picker (MON-007), and Full-Screen Auto-Rotating Office TV Wallboard (MON-005).",
    highlights: ["MON-001 WebRTC Grid", "MON-003 Live Stream", "MON-005 TV Wallboard", "MON-007 Multi-Monitor"],
  },
  {
    id: "M11",
    code: "SS",
    name: "Screenshots, Instant Capture & Privacy Blur",
    category: "LIVE_MONITOR_MEDIA",
    screenPrefix: "SS",
    screenCount: 12,
    screenIds: buildScreens("SS", 12),
    allowedRoles: ALL_ROLES,
    description: "Timeline screenshot gallery, Instant Capture Now (SS-006), Sensitive Window Blur (SS-007), and Audited Actions (SS-009).",
    highlights: ["SS-001 Gallery", "SS-006 Capture Now", "SS-007 Privacy Blur", "SS-009 Audited Actions"],
  },
  {
    id: "M12",
    code: "REC",
    name: "Screen & Synchronized Audio Recording Studio",
    category: "LIVE_MONITOR_MEDIA",
    screenPrefix: "REC",
    screenCount: 10,
    screenIds: [...buildScreens("REC", 10), ...buildScreens("AUDIO", 6)],
    allowedRoles: ["SUPER_ADMIN", "ORG_ADMIN", "MANAGER", "SECURITY_ADMIN"],
    description: "Continuous & 2-Minute Clip screen recording player with timeline event markers (REC-008) and synchronized audio review (AUDIO-001..005).",
    highlights: ["REC-001 Video Vault", "REC-008 Event Markers", "AUDIO-001 Audio QA", "AUDIO-005 Sync Player"],
  },
  {
    id: "M13",
    code: "PROJ",
    name: "Projects, Agile Sprints, Bugs & Custom Trackers",
    category: "PROJECTS_TASKS_BILLING",
    screenPrefix: "PROJ",
    screenCount: 16,
    screenIds: [...buildScreens("PROJ", 16), ...buildScreens("CUSTOM", 4)],
    allowedRoles: ALL_ROLES,
    description: "10-Tab Project Workspace, Interactive Gantt Chart, Agile Sprint Velocity, Bug Tracker, and Custom Tracker Builder (CUSTOM-001).",
    highlights: ["PROJ-004 10-Tab View", "PROJ-006 Gantt", "PROJ-010 Agile Sprint", "CUSTOM-001 Custom Tracker"],
  },
  {
    id: "M14",
    code: "TASK",
    name: "Kanban Tasks, Dependencies & Browser Extension",
    category: "PROJECTS_TASKS_BILLING",
    screenPrefix: "TASK",
    screenCount: 16,
    screenIds: [...buildScreens("TASK", 16), ...buildScreens("EXT", 1)],
    allowedRoles: ALL_ROLES,
    description: "Interactive Kanban Board, 6-Tab Task Detail, subtask dependency DAG, Burndown Chart, and Chrome/Edge Manifest V3 Browser Extension (EXT-001).",
    highlights: ["TASK-002 Kanban", "TASK-008 Dependencies", "TASK-014 Burndown", "EXT-001 Browser Extension"],
  },
  {
    id: "M15",
    code: "TS",
    name: "Timesheets, Pay Rates & Lock State Machine",
    category: "PROJECTS_TASKS_BILLING",
    screenPrefix: "TS",
    screenCount: 12,
    screenIds: buildScreens("TS", 12),
    allowedRoles: ALL_ROLES,
    description: "5-Stage Timesheet Lock State Machine (Open → Submitted → Under Review → Approved → Locked), Multi-Tier Pay Rates (TS-009), and Modification Audit History (TS-011).",
    highlights: ["TS-001 Dashboard", "TS-009 Pay Rates", "TS-010 Lock Workflow", "TS-011 Audit History"],
  },
  {
    id: "M16",
    code: "BILL",
    name: "Client Billing, Subscriptions & PDF Invoicing",
    category: "PROJECTS_TASKS_BILLING",
    screenPrefix: "BILL",
    screenCount: 10,
    screenIds: [...buildScreens("BILL", 10), ...buildScreens("BILLING", 5)],
    allowedRoles: ["SUPER_ADMIN", "ORG_ADMIN", "EXECUTIVE", "DEPT_HEAD", "FINANCE_ADMIN"],
    description: "Client 5-Tab Profiles, Billable Margin Engine, PDF Invoice Generator (BILL-005), and Tenant Subscription & Usage Billing (BILLING-001..005).",
    highlights: ["BILL-003 Client Profile", "BILL-005 PDF Invoice", "BILLING-001 Plans", "BILLING-003 Usage Meters"],
  },
  {
    id: "M17",
    code: "HR",
    name: "HR Core, Onboarding/Offboarding & Document Vault",
    category: "HR_PERF_PAYROLL",
    screenPrefix: "HR",
    screenCount: 14,
    screenIds: [...buildScreens("HR", 14), ...buildScreens("SURVEY", 4)],
    allowedRoles: [...MGR_UP, "HR_ADMIN", "EMPLOYEE"],
    description: "Employee HR Records, Document Vault, 7-Step Onboarding Workflow (HR-005), 6-Step Offboarding Workflow (HR-006), and eNPS Pulse Surveys.",
    highlights: ["HR-001 HR Dashboard", "HR-004 Doc Vault", "HR-005 7-Step Onboarding", "HR-006 6-Step Offboarding"],
  },
  {
    id: "M18",
    code: "LEAVE",
    name: "Leave, Short Leave, Blackouts & Accrual Engine",
    category: "HR_PERF_PAYROLL",
    screenPrefix: "LEAVE",
    screenCount: 12,
    screenIds: buildScreens("LEAVE", 12),
    allowedRoles: ALL_ROLES,
    description: "Leave Types, Short Leave (LEAVE-007), Blackout Dates (LEAVE-008), Automated Monthly/Annual Accrual & Carry-Forward Engine (LEAVE-009), and Holiday Calendars.",
    highlights: ["LEAVE-003 Request", "LEAVE-007 Short Leave", "LEAVE-008 Blackouts", "LEAVE-009 Accrual Engine"],
  },
  {
    id: "M19",
    code: "PERF",
    name: "360° Performance Reviews & Review Cycles",
    category: "HR_PERF_PAYROLL",
    screenPrefix: "PERF",
    screenCount: 10,
    screenIds: buildScreens("PERF", 10),
    allowedRoles: [...MGR_UP, "HR_ADMIN", "EMPLOYEE"],
    description: "Self/Peer/Manager 360° review cycles with ethical guardrails, 9-Box Talent Calibration matrix, and continuous 1-on-1 coaching logs.",
    highlights: ["PERF-001 Dashboard", "PERF-002 Employee Perf", "PERF-003 360 Review", "PERF-004 Review Cycles"],
  },
  {
    id: "M20",
    code: "KPI",
    name: "KPI Scorecards & Automated Telemetry Feeding",
    category: "HR_PERF_PAYROLL",
    screenPrefix: "KPI",
    screenCount: 8,
    screenIds: buildScreens("KPI", 8),
    allowedRoles: ALL_ROLES,
    description: "Role-based KPI scorecards automatically fed from ClickHouse productivity, SLA adherence, and project velocity.",
    highlights: ["KPI-001 Dashboard", "KPI-002 Definitions", "KPI-003 Scorecards", "KPI-004 Trends"],
  },
  {
    id: "M21",
    code: "OKR",
    name: "OKR Goal Alignment & Cascading Progress",
    category: "HR_PERF_PAYROLL",
    screenPrefix: "OKR",
    screenCount: 8,
    screenIds: buildScreens("OKR", 8),
    allowedRoles: ALL_ROLES,
    description: "Company → Department → Team → Individual OKR tree with automated key-result check-ins and confidence scoring.",
    highlights: ["OKR-001 Alignment Tree", "OKR-003 Key Results", "OKR-004 Check-Ins", "OKR-005 Retrospectives"],
  },
  {
    id: "M22",
    code: "PAY",
    name: "Payroll Ledger, Multi-Currency & Expenses",
    category: "HR_PERF_PAYROLL",
    screenPrefix: "PAY",
    screenCount: 10,
    screenIds: [...buildScreens("PAY", 10), ...buildScreens("EXP", 5)],
    allowedRoles: ["SUPER_ADMIN", "ORG_ADMIN", "FINANCE_ADMIN", "HR_ADMIN", "EMPLOYEE"],
    description: "Modular Payroll Engine (PAY-001..006), Attendance & Overtime inputs, Payroll Export, and Global Data Export Center (EXP-001..002).",
    highlights: ["PAY-001 Payroll Run", "PAY-005 Overtime", "PAY-006 Payroll Export", "EXP-001 Export Center"],
  },
  {
    id: "M23",
    code: "COM",
    name: "Communication, Task Timer & Automation Rules",
    category: "OPS_AI_ADMIN",
    screenPrefix: "COM",
    screenCount: 10,
    screenIds: [
      ...buildScreens("COM", 10),
      ...buildScreens("ALERT", 6),
      ...buildScreens("AUTO", 2),
      ...buildScreens("PORTAL", 3),
    ],
    allowedRoles: ALL_ROLES,
    description: "Company Feed, Announcements, Team Channels with Embedded Task Timer (COM-003), Unified Calendar (COM-006), Smart Alerts (ALERT-001..006), and WHEN→CONDITION→ACTION Automation (AUTO-001..002).",
    highlights: ["COM-003 Chat Task Timer", "COM-006 Unified Calendar", "ALERT-002 Alert Builder", "AUTO-002 Rule Engine"],
  },
  {
    id: "M24",
    code: "REP",
    name: "Reports, Central Data Hub, Reconciliation & Storage",
    category: "DASHBOARDS",
    screenPrefix: "REP",
    screenCount: 17,
    screenIds: [
      ...buildScreens("REP", 17),
      ...buildScreens("DATA", 3),
      ...buildScreens("STORAGE", 3),
      ...buildScreens("BENCH", 3),
      ...buildScreens("CAP", 4),
      ...buildScreens("WORKLOAD", 4),
    ],
    allowedRoles: [...MGR_UP, "HR_ADMIN", "FINANCE_ADMIN", "SECURITY_ADMIN"],
    description: "17 Pre-Built & Custom Reports, Central Cross-Dataset Data Hub (REP-014), Scheduled Reports (REP-016..017), 4-Way Data Reconciliation (DATA-001..002), and Storage Forecast (STORAGE-001..003).",
    highlights: ["REP-014 Central Data Hub", "REP-016 Scheduled Cron", "DATA-002 4-Way Reconcile", "STORAGE-001 Quota"],
  },
  {
    id: "M25",
    code: "SEC",
    name: "11-Layer Security, DLP, Anti-Cheat & Hash Audit",
    category: "SECURITY_DLP_AUDIT",
    screenPrefix: "SEC",
    screenCount: 10,
    screenIds: [
      ...buildScreens("SEC", 10),
      ...buildScreens("DLP", 11),
      ...buildScreens("SUSP", 4),
      ...buildScreens("PRIV", 5),
      ...buildScreens("AUDIT", 4),
    ],
    allowedRoles: ["SUPER_ADMIN", "ORG_ADMIN", "SECURITY_ADMIN", "HR_ADMIN", "EMPLOYEE"],
    description: "11-Channel Endpoint DLP (DLP-001..011), USB Hardware Whitelist (SEC-003), Mouse-Jiggler Detection (SUSP-001..004), Privacy Center (PRIV-001..005), and SHA-256 Audit Chain (AUDIT-001..003).",
    highlights: ["SEC-003 USB Policy", "DLP-001 11-Layer DLP", "SUSP-002 Anti-Jiggler", "AUDIT-002 SHA-256 Chain"],
  },
  {
    id: "M26",
    code: "AI",
    name: "HydiAI Assistant, NLQ & Attrition/Burnout Risk",
    category: "OPS_AI_ADMIN",
    screenPrefix: "AI",
    screenCount: 12,
    screenIds: buildScreens("AI", 12),
    allowedRoles: [...MGR_UP, "HR_ADMIN"],
    description: "HydiAI Assistant, Natural Language Query Text-to-SQL (AI-008), Workforce Attrition Flight-Risk (AI-009..010), and Burnout Indicators (AI-011).",
    highlights: ["AI-001 HydiAI Copilot", "AI-008 Natural Language SQL", "AI-010 Flight-Risk", "AI-011 Burnout Index"],
  },
  {
    id: "M27",
    code: "INT",
    name: "78+ Integrations Marketplace & Developer API Portal",
    category: "OPS_AI_ADMIN",
    screenPrefix: "INT",
    screenCount: 10,
    screenIds: [...buildScreens("INT", 10), ...buildScreens("API", 7)],
    allowedRoles: ["SUPER_ADMIN", "ORG_ADMIN", "SECURITY_ADMIN"],
    description: "78+ Integrations across 9 Categories (INT-001..008), plus Developer Portal with API Keys, OAuth2, HMAC Webhooks, Logs, Usage & OpenAPI Docs (API-001..007).",
    highlights: ["INT-001 78+ Connectors", "INT-006 Entity Mapping", "API-004 HMAC Webhooks", "API-007 OpenAPI Docs"],
  },
  {
    id: "M28",
    code: "FIELD",
    name: "Field Force GPS Route Replay, Geofencing & Expenses",
    category: "OPS_AI_ADMIN",
    screenPrefix: "FIELD",
    screenCount: 9,
    screenIds: buildScreens("FIELD", 9),
    allowedRoles: [...MGR_UP, "FINANCE_ADMIN", "EMPLOYEE"],
    description: "Live GPS Map, Route Replay & Dwell Time (FIELD-003), Geofence Auto-Attendance (FIELD-004), and GPS Mileage & Expense Claims (FIELD-006..009).",
    highlights: ["FIELD-002 Live GPS Map", "FIELD-003 Route Replay", "FIELD-004 Geofences", "FIELD-007 GPS Mileage"],
  },
  {
    id: "M29",
    code: "MOB",
    name: "Android/iOS Mobile Companion App & Kiosk",
    category: "OPS_AI_ADMIN",
    screenPrefix: "MOB",
    screenCount: 11,
    screenIds: [...buildScreens("MOB", 11), ...buildScreens("KIOSK", 4)],
    allowedRoles: ALL_ROLES,
    description: "Android & iOS Mobile Companion App (MOB-001..011) with GPS Check-In/Out, Mobile Tasks, Timesheets, Manager Dashboard, and Shared Tablet Kiosk.",
    highlights: ["MOB-002 Mobile Dash", "MOB-003 GPS Check-In", "MOB-011 Mobile Manager", "KIOSK-001 Face Kiosk"],
  },
  {
    id: "M30",
    code: "MDM",
    name: "Corporate MDM & Desktop Agent Fleet Deployment",
    category: "OPS_AI_ADMIN",
    screenPrefix: "MDM",
    screenCount: 8,
    screenIds: [
      ...buildScreens("MDM", 8),
      ...buildScreens("AGENT", 6),
      ...buildScreens("DEPLOY", 4),
      "DA-1", "DA-2", "DA-3", "DA-4", "DA-5", "DA-6", "DA-7", "DA-8",
      "DA-9", "DA-10", "DA-11", "DA-12", "DA-13", "DA-14", "DA-15", "DA-16",
    ],
    allowedRoles: ["SUPER_ADMIN", "ORG_ADMIN", "SECURITY_ADMIN"],
    description: "Corporate Mobile Device Management (MDM-001..006), Desktop Agent UI & Fleet Control (AGENT-001..006, DA-1..16), and GPO/Intune/Jamf Deployment & Atomic Rollback (DEPLOY-001..003).",
    highlights: ["MDM-006 Remote Lock", "AGENT-005 6 Tracker Modes", "DEPLOY-001 GPO/Intune", "DEPLOY-003 Atomic Rollback"],
  },
  {
    id: "M31",
    code: "SUPER",
    name: "SaaS Super Admin, Entitlements, Storage & SSL Pinning",
    category: "OPS_AI_ADMIN",
    screenPrefix: "SUPER",
    screenCount: 10,
    screenIds: [
      ...buildScreens("SUPER", 10),
      ...buildScreens("ENTITLE", 1),
      "SA-1", "SA-2", "SA-3", "SA-4", "SA-5", "SA-6",
    ],
    allowedRoles: ["SUPER_ADMIN"],
    description: "Multi-tenant control plane (SUPER-001..007), Audited Impersonation (SUPER-002), 18 Add-Ons Entitlement Engine (ENTITLE-001), Storage Router (SA-5), and SSL Pin Checker (SA-6).",
    highlights: ["SUPER-002 Impersonate", "ENTITLE-001 18 Add-Ons", "SA-5 Storage Router", "SA-6 SSL Pinning"],
  },
  {
    id: "M32",
    code: "ADMIN",
    name: "RBAC Matrix, 4-Tier Config, White-Label & Settings",
    category: "OPS_AI_ADMIN",
    screenPrefix: "ADMIN",
    screenCount: 14,
    screenIds: [
      ...buildScreens("ADMIN", 14),
      ...buildScreens("PERM", 2),
      ...buildScreens("CONFIG", 4),
      ...buildScreens("BRAND", 2),
      ...buildScreens("SET", 8),
      ...buildScreens("WHITE", 3),
      ...buildScreens("EMAIL", 3),
      ...buildScreens("ONPREM", 3),
    ],
    allowedRoles: ["SUPER_ADMIN", "ORG_ADMIN"],
    description: "33×8×9 RBAC Matrix & 9 Sensitive Gates (PERM-001..002), 4-Tier Tracking Config Inheritance (CONFIG-001..004), White-Label & Custom SMTP (BRAND-001..002), and System Settings (SET-001..008).",
    highlights: ["PERM-001 33×8×9 Matrix", "CONFIG-001 4-Tier Policy", "BRAND-001 White-Label", "SET-002 3-Tier Timezone"],
  },
  {
    id: "M33",
    code: "EMP",
    name: "Employee Self-Service & Transparency Portal",
    category: "WORKFORCE",
    screenPrefix: "EMP",
    screenCount: 13,
    screenIds: buildScreens("EMP", 13),
    allowedRoles: ALL_ROLES,
    description: "Complete 13-Screen Employee Self-Service Portal (EMP-001..013) with personal dashboard, attendance, timesheets, screenshots, leave requests, KPIs, OKRs, payslips, and Privacy Center.",
    highlights: ["EMP-001 My Dashboard", "EMP-006 My Screenshots", "EMP-009 My Leave", "EMP-013 My Settings"],
  },
];

export interface PhaseSpecEntry {
  phaseNumber: number;
  phaseCode: string;
  title: string;
  docFile: string;
  primaryModuleId: string;
  defaultScreenId: string;
  keyScreens: string[];
}

export const ALL_30_PHASES: PhaseSpecEntry[] = [
  { phaseNumber: 1, phaseCode: "PHASE_01", title: "128GB RAM Server Infra, Hybrid DB & System Health", docFile: "PHASE_01_INFRASTRUCTURE_AND_HYBRID_DB.md", primaryModuleId: "M02", defaultScreenId: "SYS-001", keyScreens: ["SYS-001", "SYS-002", "SYS-003"] },
  { phaseNumber: 2, phaseCode: "PHASE_02", title: "Global Shell (G-001), AR Drawer, Search, Notif & Support", docFile: "PHASE_02_GLOBAL_SHELL_DRAWER_SEARCH_AND_NOTIFICATIONS.md", primaryModuleId: "M02", defaultScreenId: "G-001", keyScreens: ["G-001", "SEARCH-001", "NOTIF-001", "HELP-001", "SUPPORT-001"] },
  { phaseNumber: 3, phaseCode: "PHASE_03", title: "Authentication, SAML/OIDC SSO, TOTP MFA & 8-Step Wizard", docFile: "PHASE_03_AUTHENTICATION_SSO_MFA_AND_ONBOARDING_WIZARD.md", primaryModuleId: "M01", defaultScreenId: "AUTH-001", keyScreens: ["AUTH-001", "AUTH-002", "AUTH-005", "SEC-008", "SEC-010"] },
  { phaseNumber: 4, phaseCode: "PHASE_04", title: "SaaS Super Admin, Impersonation, 18 Add-Ons, SA-5 & SA-6", docFile: "PHASE_04_SAAS_SUPER_ADMIN_ENTITLEMENTS_AND_BILLING.md", primaryModuleId: "M31", defaultScreenId: "SUPER-001", keyScreens: ["SUPER-001", "SUPER-002", "ENTITLE-001", "SA-5", "SA-6", "BILLING-001"] },
  { phaseNumber: 5, phaseCode: "PHASE_05", title: "Organization Hierarchy, Closure Table & Multi-Subsidiaries", docFile: "PHASE_05_ORGANIZATION_HIERARCHY_AND_MULTI_TENANT_SUBSIDIARIES.md", primaryModuleId: "M01", defaultScreenId: "ORG-008", keyScreens: ["ORG-001", "ORG-008", "ORG-009", "ENT-001", "ENT-003"] },
  { phaseNumber: 6, phaseCode: "PHASE_06", title: "33×8×9 RBAC Matrix, 9 Sensitive Gates & 4-Tier Config", docFile: "PHASE_06_RBAC_PERMISSION_MATRIX_AND_ADMIN_CONFIG_ENGINE.md", primaryModuleId: "M32", defaultScreenId: "PERM-001", keyScreens: ["ADMIN-001", "PERM-001", "PERM-002", "CONFIG-001", "BRAND-001", "SET-001"] },
  { phaseNumber: 7, phaseCode: "PHASE_07", title: "Workforce 16-Tab Profile, Hybrid WFO/WFH, Devices & Import", docFile: "PHASE_07_WORKFORCE_HYBRID_WORK_DEVICES_AND_BULK_IMPORT.md", primaryModuleId: "M04", defaultScreenId: "WF-003", keyScreens: ["WF-001", "WF-003", "HYB-001", "DEVICE-001", "BULK-001", "IMPORT-001", "ARCHIVE-001"] },
  { phaseNumber: 8, phaseCode: "PHASE_08", title: "Desktop Agent Native OS Hooks, <2% CPU Job Object & Spool", docFile: "PHASE_08_DESKTOP_AGENT_CORE_OS_HOOKS_AND_SQLITE_SPOOL.md", primaryModuleId: "M30", defaultScreenId: "AGENT-001", keyScreens: ["AGENT-001", "DA-4", "DA-13"] },
  { phaseNumber: 9, phaseCode: "PHASE_09", title: "Desktop Agent 6 Tracker Modes (DA-1..16) & Fleet Rollback", docFile: "PHASE_09_DESKTOP_AGENT_UI_MODES_AND_FLEET_DEPLOYMENT.md", primaryModuleId: "M30", defaultScreenId: "DEPLOY-001", keyScreens: ["AGENT-005", "DA-1", "DA-16", "DEPLOY-001", "DEPLOY-003"] },
  { phaseNumber: 10, phaseCode: "PHASE_10", title: "8-State Time Engine, Audio Anti-Idle, Away & Personal Mode", docFile: "PHASE_10_TIME_ENGINE_AWAY_MANAGEMENT_AND_PERSONAL_MODE.md", primaryModuleId: "M05", defaultScreenId: "TIME-008", keyScreens: ["TIME-001", "TIME-006", "TIME-008", "TIME-009"] },
  { phaseNumber: 11, phaseCode: "PHASE_11", title: "Shifts, Attendance State Machine, Overrides & BPO Shrinkage", docFile: "PHASE_11_SHIFTS_ATTENDANCE_ENGINE_SHRINKAGE_AND_EXCEPTIONS.md", primaryModuleId: "M06", defaultScreenId: "ATT-010", keyScreens: ["SHIFT-001", "ATT-001", "ATT-006", "ATT-010", "ATT-012"] },
  { phaseNumber: 12, phaseCode: "PHASE_12", title: "Activity Engine, App/URL Telemetry & Keystroke Intensity", docFile: "PHASE_12_ACTIVITY_ENGINE_APPS_URLS_AND_KEYSTROKE_INTENSITY.md", primaryModuleId: "M08", defaultScreenId: "ACT-001", keyScreens: ["ACT-001", "ACT-002", "ACT-003", "ACT-006", "ACT-007"] },
  { phaseNumber: 13, phaseCode: "PHASE_13", title: "6-Way Productivity, Level-2 Regex & Historical Reclassify", docFile: "PHASE_13_PRODUCTIVITY_ENGINE_RULES_AND_WORK_LIFE_BALANCE.md", primaryModuleId: "M07", defaultScreenId: "PROD-006", keyScreens: ["PROD-001", "PROD-006", "PROD-007", "PROD-008", "PROD-011"] },
  { phaseNumber: 14, phaseCode: "PHASE_14", title: "Application Governance & Software License Waste Calculator", docFile: "PHASE_14_SOFTWARE_GOVERNANCE_AND_LICENSE_OPTIMIZATION.md", primaryModuleId: "M09", defaultScreenId: "LIC-003", keyScreens: ["APP-001", "APP-004", "LIC-001", "LIC-003", "LIC-005"] },
  { phaseNumber: 15, phaseCode: "PHASE_15", title: "Screenshot Engine, Capture Now, Privacy Blur & Audit", docFile: "PHASE_15_SCREENSHOT_ENGINE_PRIVACY_BLUR_AND_AUDITED_ACTIONS.md", primaryModuleId: "M11", defaultScreenId: "SS-006", keyScreens: ["SS-001", "SS-006", "SS-007", "SS-009", "MON-007"] },
  { phaseNumber: 16, phaseCode: "PHASE_16", title: "Live Monitor 30-FPS WebRTC Streaming & Office TV Wallboard", docFile: "PHASE_16_LIVE_MONITOR_WEBRTC_STREAMING_AND_OFFICE_TV.md", primaryModuleId: "M10", defaultScreenId: "MON-005", keyScreens: ["MON-001", "MON-003", "MON-005", "MON-006"] },
  { phaseNumber: 17, phaseCode: "PHASE_17", title: "Screen Recording Clips, Timeline Markers & Audio Review", docFile: "PHASE_17_SCREEN_RECORDING_CLIPS_MARKERS_AND_AUDIO_TRACKING.md", primaryModuleId: "M12", defaultScreenId: "REC-008", keyScreens: ["REC-001", "REC-005", "REC-008", "AUDIO-001", "AUDIO-005"] },
  { phaseNumber: 18, phaseCode: "PHASE_18", title: "Executive, Manager & Employee Dashboards + Widget Builder", docFile: "PHASE_18_EXECUTIVE_MANAGER_DASHBOARDS_AND_WIDGET_BUILDER.md", primaryModuleId: "M03", defaultScreenId: "DASH-001", keyScreens: ["DASH-001", "DASH-002", "DASH-003", "DB-001"] },
  { phaseNumber: 19, phaseCode: "PHASE_19", title: "Projects 10-Tab View, Gantt, Agile Sprints, Bugs & Trackers", docFile: "PHASE_19_PROJECTS_SPRINTS_BUG_TRACKING_AND_CUSTOM_TRACKERS.md", primaryModuleId: "M13", defaultScreenId: "PROJ-004", keyScreens: ["PROJ-001", "PROJ-004", "PROJ-006", "PROJ-010", "PROJ-011", "CUSTOM-001"] },
  { phaseNumber: 20, phaseCode: "PHASE_20", title: "Tasks Kanban, Dependencies DAG, Burndown & Browser Ext", docFile: "PHASE_20_TASKS_KANBAN_DEPENDENCIES_AND_BROWSER_EXTENSION.md", primaryModuleId: "M14", defaultScreenId: "TASK-002", keyScreens: ["TASK-001", "TASK-002", "TASK-008", "TASK-014", "EXT-001"] },
  { phaseNumber: 21, phaseCode: "PHASE_21", title: "Timesheets, Multi-Tier Pay Rates, Lock Workflow & Billing", docFile: "PHASE_21_TIMESHEETS_PAY_RATES_LOCK_WORKFLOW_AND_CLIENT_BILLING.md", primaryModuleId: "M15", defaultScreenId: "TS-010", keyScreens: ["TS-001", "TS-009", "TS-010", "TS-011", "BILL-001", "BILL-005"] },
  { phaseNumber: 22, phaseCode: "PHASE_22", title: "Workforce Analytics, Focus Engine, Lifetime Heatmaps & Trends", docFile: "PHASE_22_WORKFORCE_ANALYTICS_UTILIZATION_HEATMAPS_AND_PATTERNS.md", primaryModuleId: "M08", defaultScreenId: "ANA-010", keyScreens: ["ANA-001", "ANA-002", "ANA-008", "ANA-010", "ANA-011", "PATTERN-001"] },
  { phaseNumber: 23, phaseCode: "PHASE_23", title: "Reports, Central Data Hub, 4-Way Reconciliation & Storage", docFile: "PHASE_23_REPORTS_DATA_HUB_RECONCILIATION_AND_STORAGE_MGMT.md", primaryModuleId: "M24", defaultScreenId: "REP-014", keyScreens: ["REP-001", "REP-014", "REP-016", "EXP-001", "DATA-002", "STORAGE-001"] },
  { phaseNumber: 24, phaseCode: "PHASE_24", title: "Smart Alerts & Visual WHEN→CONDITION→ACTION Automation", docFile: "PHASE_24_ALERTS_AND_RULE_AUTOMATION_ENGINE.md", primaryModuleId: "M23", defaultScreenId: "AUTO-002", keyScreens: ["ALERT-001", "ALERT-002", "AUTO-001", "AUTO-002"] },
  { phaseNumber: 25, phaseCode: "PHASE_25", title: "Security, 11-Layer DLP, USB Policy & Anti-Jiggler Forensics", docFile: "PHASE_25_SECURITY_11_LAYER_DLP_AND_SUSPICIOUS_ACTIVITY.md", primaryModuleId: "M25", defaultScreenId: "DLP-001", keyScreens: ["SEC-003", "DLP-001", "DLP-011", "SUSP-001", "SUSP-004"] },
  { phaseNumber: 26, phaseCode: "PHASE_26", title: "Employee Privacy Center & SHA-256 Hash-Chained Audit Logs", docFile: "PHASE_26_PRIVACY_CONSENT_CENTER_AND_IMMUTABLE_AUDIT_LOGS.md", primaryModuleId: "M25", defaultScreenId: "PRIV-001", keyScreens: ["PRIV-001", "PRIV-003", "PRIV-005", "AUDIT-001", "AUDIT-002"] },
  { phaseNumber: 27, phaseCode: "PHASE_27", title: "HR Lifecycle, Leave Accrual, 360 Reviews, KPI, OKR & Payroll", docFile: "PHASE_27_HR_LEAVE_ACCRUAL_PERFORMANCE_KPI_OKR_AND_PAYROLL.md", primaryModuleId: "M17", defaultScreenId: "HR-005", keyScreens: ["HR-005", "LEAVE-009", "PERF-003", "KPI-001", "OKR-001", "PAY-001"] },
  { phaseNumber: 28, phaseCode: "PHASE_28", title: "Internal Communication & Task Timer on Communicator", docFile: "PHASE_28_COMMUNICATION_SUITE_AND_TASK_COMMUNICATOR.md", primaryModuleId: "M23", defaultScreenId: "COM-003", keyScreens: ["COM-001", "COM-002", "COM-003", "COM-004", "COM-006"] },
  { phaseNumber: 29, phaseCode: "PHASE_29", title: "Field GPS Route Replay, Geofences, Mileage, Mobile & MDM", docFile: "PHASE_29_FIELD_WORKFORCE_GPS_GEOFENCING_EXPENSES_AND_MDM.md", primaryModuleId: "M28", defaultScreenId: "FIELD-003", keyScreens: ["FIELD-002", "FIELD-003", "FIELD-007", "MOB-001", "MDM-001", "MDM-006"] },
  { phaseNumber: 30, phaseCode: "PHASE_30", title: "HydiAI NLQ, Flight-Risk/Burnout, 78+ Integrations & Emp Portal", docFile: "PHASE_30_HYDIAI_ATTRITION_78_INTEGRATIONS_API_AND_EMP_PORTAL.md", primaryModuleId: "M26", defaultScreenId: "AI-008", keyScreens: ["AI-001", "AI-008", "AI-010", "INT-001", "API-001", "EMP-001"] },
];

export const ALL_SCREEN_IDS: { screenId: string; moduleId: string; moduleName: string; category: WorkspaceGroup }[] =
  CORE_MODULES.flatMap((m) =>
    m.screenIds.map((sid) => ({
      screenId: sid,
      moduleId: m.id,
      moduleName: m.name,
      category: m.category,
    }))
  );

export interface EnterpriseExtensionSpec {
  id: string;
  title: string;
  moduleCode: string;
  screenId: string;
  status: "PRODUCTION_ACTIVE";
}

export const ENTERPRISE_EXTENSIONS_45: EnterpriseExtensionSpec[] = [
  { id: "MISSING-01", title: "Hybrid Work (WFO vs WFH) Policy & Location Compliance", moduleCode: "M04", screenId: "HYB-001", status: "PRODUCTION_ACTIVE" },
  { id: "MISSING-02", title: "Software License Optimization & Unused Seat Reclaim", moduleCode: "M09", screenId: "LIC-001", status: "PRODUCTION_ACTIVE" },
  { id: "MISSING-03", title: "Suspicious Activity & Mouse-Jiggler Anti-Cheat Engine", moduleCode: "M25", screenId: "SUSP-001", status: "PRODUCTION_ACTIVE" },
  { id: "MISSING-04", title: "Employee Privacy Center & Transparency Access Log", moduleCode: "M25", screenId: "PRIV-001", status: "PRODUCTION_ACTIVE" },
  { id: "MISSING-05", title: "BPO & Call-Center Shrinkage Calculator", moduleCode: "M06", screenId: "ATT-010", status: "PRODUCTION_ACTIVE" },
  { id: "MISSING-06", title: "Synchronized Screen + Audio Call Recording Studio", moduleCode: "M12", screenId: "AUDIO-005", status: "PRODUCTION_ACTIVE" },
  { id: "MISSING-07", title: "Desktop Agent Fleet Silent Deployment Wizard (MSI/PKG/GPO)", moduleCode: "M30", screenId: "DEPLOY-001", status: "PRODUCTION_ACTIVE" },
  { id: "MISSING-08", title: "Custom Drag-and-Drop Dashboard Widget Builder", moduleCode: "M03", screenId: "DB-001", status: "PRODUCTION_ACTIVE" },
  { id: "MISSING-09", title: "Custom Entity & Issue Tracker Schema Builder", moduleCode: "M13", screenId: "CUSTOM-001", status: "PRODUCTION_ACTIVE" },
  { id: "MISSING-10", title: "Multi-Tenant S3/MinIO Storage Router & BYOS KMS", moduleCode: "M31", screenId: "SA-5", status: "PRODUCTION_ACTIVE" },
  { id: "MISSING-11", title: "Endpoint mTLS & SSL Certificate Pinning Verifier", moduleCode: "M31", screenId: "SA-6", status: "PRODUCTION_ACTIVE" },
  { id: "MISSING-12", title: "Hardware Asset & Peripherals Lifecycle Inventory", moduleCode: "M04", screenId: "DEVICE-001", status: "PRODUCTION_ACTIVE" },
  { id: "MISSING-13", title: "Bulk CSV/SCIM Onboarding & Validation Sandbox", moduleCode: "M04", screenId: "IMPORT-001", status: "PRODUCTION_ACTIVE" },
  { id: "MISSING-14", title: "Cold-Storage Legal Hold & Terminated Employee Archive", moduleCode: "M04", screenId: "ARCHIVE-001", status: "PRODUCTION_ACTIVE" },
  { id: "MISSING-15", title: "Pulse eNPS & Anonymous Whistleblower Surveys", moduleCode: "M17", screenId: "SURVEY-001", status: "PRODUCTION_ACTIVE" },
  { id: "MISSING-16", title: "Expense Reimbursement & Receipt OCR Audit", moduleCode: "M22", screenId: "EXP-001", status: "PRODUCTION_ACTIVE" },
  { id: "MISSING-17", title: "Real-Time Smart Alert & Webhook Escalation Engine", moduleCode: "M23", screenId: "ALERT-001", status: "PRODUCTION_ACTIVE" },
  { id: "MISSING-18", title: "External Client Read-Only Project & Proof-of-Work Portal", moduleCode: "M23", screenId: "PORTAL-001", status: "PRODUCTION_ACTIVE" },
  { id: "MISSING-19", title: "Cross-Industry Productivity Benchmarking Index", moduleCode: "M24", screenId: "BENCH-001", status: "PRODUCTION_ACTIVE" },
  { id: "MISSING-20", title: "Department Capacity Planning & Hiring Forecaster", moduleCode: "M24", screenId: "CAP-001", status: "PRODUCTION_ACTIVE" },
  { id: "MISSING-21", title: "Team Workload Balancing & Overtime Redistribution", moduleCode: "M24", screenId: "WORKLOAD-001", status: "PRODUCTION_ACTIVE" },
  { id: "MISSING-22", title: "Shared Tablet Kiosk Clock-In with Face-ID & QR", moduleCode: "M29", screenId: "KIOSK-001", status: "PRODUCTION_ACTIVE" },
  { id: "MISSING-23", title: "Custom Domain & White-Label Theme Engine", moduleCode: "M32", screenId: "WHITE-001", status: "PRODUCTION_ACTIVE" },
  { id: "MISSING-24", title: "Transactional Email & Slack Notification Designer", moduleCode: "M32", screenId: "EMAIL-001", status: "PRODUCTION_ACTIVE" },
  { id: "MISSING-25", title: "GDPR Right-to-Erasure & Automated Data Retention Purge", moduleCode: "M32", screenId: "DATA-001", status: "PRODUCTION_ACTIVE" },
  { id: "MISSING-26", title: "Air-Gapped On-Premises Kubernetes/Docker Appliance Control", moduleCode: "M32", screenId: "ONPREM-001", status: "PRODUCTION_ACTIVE" },
  { id: "MISSING-27", title: "Command-K Global Federated Search & Action Palette", moduleCode: "M02", screenId: "SEARCH-001", status: "PRODUCTION_ACTIVE" },
  { id: "MISSING-28", title: "Real-Time Priority Notification & Approval Center", moduleCode: "M02", screenId: "NOTIF-001", status: "PRODUCTION_ACTIVE" },
  { id: "MISSING-29", title: "In-App Agent Log Collector & HAR Support Bundle", moduleCode: "M02", screenId: "SUPPORT-001", status: "PRODUCTION_ACTIVE" },
  { id: "MISSING-30", title: "Office TV Full-Screen Auto-Rotating Wallboard Mode", moduleCode: "M10", screenId: "MON-005", status: "PRODUCTION_ACTIVE" },
  { id: "MISSING-31", title: "Level-2 Window Title & URL Regex Productivity Classifier", moduleCode: "M07", screenId: "PROD-005", status: "PRODUCTION_ACTIVE" },
  { id: "MISSING-32", title: "1-Click 90-Day Historical Productivity Reclassification", moduleCode: "M07", screenId: "PROD-008", status: "PRODUCTION_ACTIVE" },
  { id: "MISSING-33", title: "USB Hardware VID/PID Whitelist & Read-Only Kernel Policy", moduleCode: "M25", screenId: "DLP-004", status: "PRODUCTION_ACTIVE" },
  { id: "MISSING-34", title: "SHA-256 Cryptographic Hash-Chained Immutable Audit Ledger", moduleCode: "M25", screenId: "AUDIT-002", status: "PRODUCTION_ACTIVE" },
  { id: "MISSING-35", title: "Deterministic 5-Stage Timesheet Lock State Machine", moduleCode: "M15", screenId: "TS-008", status: "PRODUCTION_ACTIVE" },
  { id: "MISSING-36", title: "HydiAI Natural Language Query (Text-to-ClickHouse SQL)", moduleCode: "M26", screenId: "AI-008", status: "PRODUCTION_ACTIVE" },
  { id: "MISSING-37", title: "Predictive Employee Burnout & Cognitive Fatigue Index", moduleCode: "M26", screenId: "AI-009", status: "PRODUCTION_ACTIVE" },
  { id: "MISSING-38", title: "Predictive Flight-Risk & Voluntary Attrition Forecaster", moduleCode: "M26", screenId: "AI-010", status: "PRODUCTION_ACTIVE" },
  { id: "MISSING-39", title: "Embedded 1-Click Task Timer inside Team Chat Messages", moduleCode: "M23", screenId: "COM-003", status: "PRODUCTION_ACTIVE" },
  { id: "MISSING-40", title: "Instant On-Demand Screenshot Capture via WebSocket", moduleCode: "M11", screenId: "SS-006", status: "PRODUCTION_ACTIVE" },
  { id: "MISSING-41", title: "Sensitive App Auto-Blur & Redaction Engine", moduleCode: "M11", screenId: "SS-007", status: "PRODUCTION_ACTIVE" },
  { id: "MISSING-42", title: "Audited High-Res Screenshot Lightbox with Keystroke Context", moduleCode: "M11", screenId: "SS-009", status: "PRODUCTION_ACTIVE" },
  { id: "MISSING-43", title: "Audited SaaS Super Admin Tenant Impersonation Session", moduleCode: "M31", screenId: "SUPER-002", status: "PRODUCTION_ACTIVE" },
  { id: "MISSING-44", title: "Field Force GPS Breadcrumb Replay & Verified Mileage Calc", moduleCode: "M28", screenId: "FIELD-003", status: "PRODUCTION_ACTIVE" },
  { id: "MISSING-45", title: "Dual-Process Desktop Agent Watchdog & Offline SQLite Sync", moduleCode: "M30", screenId: "AGENT-001", status: "PRODUCTION_ACTIVE" },
];

export interface EmployeeRecord {
  id: string;
  name: string;
  roleTitle: string;
  systemRole: SystemRole;
  department: string;
  location: string;
  workMode: "WFO" | "WFH" | "HYBRID";
  status: "ACTIVE" | "PASSIVE" | "IDLE" | "MEETING" | "BREAK" | "PERSONAL" | "OFFLINE";
  currentApp: string;
  currentWindowTitle: string;
  productivityScore: number;
  activeHoursToday: string;
  productivePct: number;
  neutralPct: number;
  unproductivePct: number;
  keystrokesPerMin: number;
  mouseClicksPerMin: number;
  agentVersion: string;
  osPlatform: "Windows 11 Pro" | "macOS 15.2" | "Ubuntu 24.04 LTS";
  burnoutRisk: "LOW" | "MODERATE" | "HIGH";
  flightRiskScore: number;
  salaryCurrency: string;
  hourlyBillRate: number;
  hardwareAssetId: string;
  monitorsCount: number;
}

export const INITIAL_EMPLOYEES: EmployeeRecord[] = [
  {
    id: "emp-win-ramandeep",
    name: "Ramandeep",
    roleTitle: "Lead Systems Engineer & Workstation Owner",
    systemRole: "ORG_ADMIN",
    department: "Platform Engineering",
    location: "Local Workstation (India Standard Time)",
    workMode: "WFO",
    status: "ACTIVE",
    currentApp: "HydiEms Desktop Agent",
    currentWindowTitle: "Active Workstation Session (RAMANDEEP)",
    productivityScore: 98.5,
    activeHoursToday: "01h 00m",
    productivePct: 95,
    neutralPct: 4,
    unproductivePct: 1,
    keystrokesPerMin: 120,
    mouseClicksPerMin: 35,
    agentVersion: "2.5.0-win-x64",
    osPlatform: "Windows 11 Pro",
    burnoutRisk: "LOW",
    flightRiskScore: 5,
    salaryCurrency: "INR",
    hourlyBillRate: 150,
    hardwareAssetId: "HW-RAMANDEEP",
    monitorsCount: 1,
  },
];

export interface ScreenshotItem {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  capturedAt: string;
  appName: string;
  windowTitle: string;
  activityPct: number;
  keystrokes: number;
  clicks: number;
  isBlurred: boolean;
  classification: "PRODUCTIVE" | "NEUTRAL" | "UNPRODUCTIVE";
  monitorIndex: number;
  storageBucket: string;
  resolution?: string;
  format?: string;
  fileSizeBytes?: number;
  compressionQuality?: number;
  triggerSource?: "SCHEDULED_INTERVAL" | "RANDOM_INTERVAL" | "MANUAL_CAPTURE_NOW" | "EVENT_TRIGGERED";
  eventDetails?: string;
  deviceId?: string;
  deviceHost?: string;
  deviceOs?: string;
  deviceIp?: string;
  agentVersion?: string;
}

export const INITIAL_SCREENSHOTS: ScreenshotItem[] = [];

export interface DLPIncident {
  id: string;
  timestamp: string;
  employeeId: string;
  employeeName: string;
  channel:
    | "USB_STORAGE"
    | "CLIPBOARD"
    | "PRINT_SPOOLER"
    | "CLOUD_UPLOAD"
    | "SCREEN_CAPTURE"
    | "UNAPPROVED_AI"
    | "SOURCE_CODE_GIT"
    | "MOUSE_JIGGLER";
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  description: string;
  hardwareIdOrTarget: string;
  actionTaken: "BLOCKED" | "QUARANTINED" | "REDACTED" | "FLAGGED_FOR_REVIEW";
  investigationStage: number; // 1..6
}

export const INITIAL_DLP_INCIDENTS: DLPIncident[] = [];

export async function fetchApi<T>(path: string, fallback: T, options?: RequestInit): Promise<T> {
  const baseUrl =
    typeof window !== "undefined"
      ? ""
      : process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000";
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
    });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export interface ProductionFeature {
  id: string;
  name: string;
  category: WorkspaceGroup;
  screenId: string;
  allowedRoles: SystemRole[];
  badge?: string;
}

export interface ProductionSection {
  id: string;
  name: string;
  allowedRoles: SystemRole[];
  features: ProductionFeature[];
}

export const PRODUCTION_SECTIONS: ProductionSection[] = [
  {
    id: "dashboards",
    name: "Dashboards & Analytics",
    allowedRoles: ALL_ROLES,
    features: [
      {
        id: "executive_overview",
        name: "Executive Overview",
        category: "DASHBOARDS",
        screenId: "DASH-001",
        allowedRoles: ["SUPER_ADMIN", "ORG_ADMIN", "EXECUTIVE"],
      },
      {
        id: "team_analytics",
        name: "Team Performance",
        category: "DASHBOARDS",
        screenId: "DASH-002",
        allowedRoles: ["SUPER_ADMIN", "ORG_ADMIN", "EXECUTIVE", "DEPT_HEAD", "MANAGER"],
      },
      {
        id: "personal_workspace",
        name: "My Personal Workspace",
        category: "DASHBOARDS",
        screenId: "DASH-003",
        allowedRoles: ALL_ROLES,
      },
      {
        id: "productivity_trends",
        name: "Productivity & App Usage",
        category: "PRODUCTIVITY_APPS",
        screenId: "PROD-001",
        allowedRoles: ["SUPER_ADMIN", "ORG_ADMIN", "EXECUTIVE", "DEPT_HEAD", "MANAGER"],
      },
    ],
  },
  {
    id: "surveillance",
    name: "Live Surveillance & Media",
    allowedRoles: ["SUPER_ADMIN", "ORG_ADMIN", "MANAGER", "SECURITY_ADMIN"],
    features: [
      {
        id: "live_cctv",
        name: "Live Screen & CCTV Station",
        category: "LIVE_MONITOR_MEDIA",
        screenId: "MON-001",
        allowedRoles: ["SUPER_ADMIN", "ORG_ADMIN", "MANAGER", "SECURITY_ADMIN"],
        badge: "LIVE REC",
      },
      {
        id: "screenshots_gallery",
        name: "Screenshot Snapshots",
        category: "LIVE_MONITOR_MEDIA",
        screenId: "SS-001",
        allowedRoles: ["SUPER_ADMIN", "ORG_ADMIN", "MANAGER", "SECURITY_ADMIN"],
      },
      {
        id: "screen_recordings",
        name: "Activity Recordings & Clips",
        category: "LIVE_MONITOR_MEDIA",
        screenId: "REC-001",
        allowedRoles: ["SUPER_ADMIN", "ORG_ADMIN", "MANAGER", "SECURITY_ADMIN"],
      },
    ],
  },
  {
    id: "workforce",
    name: "Workforce & Attendance",
    allowedRoles: ALL_ROLES,
    features: [
      {
        id: "employee_directory",
        name: "Employee Directory",
        category: "WORKFORCE",
        screenId: "WF-001",
        allowedRoles: ["SUPER_ADMIN", "ORG_ADMIN", "MANAGER", "HR_ADMIN"],
      },
      {
        id: "attendance_shifts",
        name: "Attendance & Shifts",
        category: "TIME_ATTENDANCE",
        screenId: "ATT-001",
        allowedRoles: ALL_ROLES,
      },
      {
        id: "time_tracking",
        name: "Time Tracking & Activity",
        category: "TIME_ATTENDANCE",
        screenId: "TIME-001",
        allowedRoles: ALL_ROLES,
      },
      {
        id: "leaves_holidays",
        name: "Leaves & Holidays",
        category: "HR_PERF_PAYROLL",
        screenId: "LEAVE-001",
        allowedRoles: ALL_ROLES,
      },
    ],
  },
  {
    id: "projects",
    name: "Projects & Tasks",
    allowedRoles: ALL_ROLES,
    features: [
      {
        id: "active_projects",
        name: "Active Projects",
        category: "PROJECTS_TASKS_BILLING",
        screenId: "PROJ-001",
        allowedRoles: ["SUPER_ADMIN", "ORG_ADMIN", "MANAGER", "FINANCE_ADMIN"],
      },
      {
        id: "kanban_tasks",
        name: "Kanban Task Board",
        category: "PROJECTS_TASKS_BILLING",
        screenId: "TASK-001",
        allowedRoles: ALL_ROLES,
      },
      {
        id: "timesheets_approvals",
        name: "Timesheets & Approvals",
        category: "PROJECTS_TASKS_BILLING",
        screenId: "TS-001",
        allowedRoles: ALL_ROLES,
      },
      {
        id: "client_billing",
        name: "Client Invoicing & Billing",
        category: "PROJECTS_TASKS_BILLING",
        screenId: "BILL-001",
        allowedRoles: ["SUPER_ADMIN", "ORG_ADMIN", "FINANCE_ADMIN"],
      },
    ],
  },
  {
    id: "security",
    name: "Security & DLP",
    allowedRoles: ["SUPER_ADMIN", "ORG_ADMIN", "SECURITY_ADMIN"],
    features: [
      {
        id: "dlp_control",
        name: "Data Loss Prevention (DLP)",
        category: "SECURITY_DLP_AUDIT",
        screenId: "DLP-001",
        allowedRoles: ["SUPER_ADMIN", "ORG_ADMIN", "SECURITY_ADMIN"],
      },
      {
        id: "usb_hardware",
        name: "USB & Device Access",
        category: "SECURITY_DLP_AUDIT",
        screenId: "SEC-002",
        allowedRoles: ["SUPER_ADMIN", "ORG_ADMIN", "SECURITY_ADMIN"],
      },
      {
        id: "suspicious_activity",
        name: "Anti-Cheat & Fraud Rules",
        category: "SECURITY_DLP_AUDIT",
        screenId: "SUSP-001",
        allowedRoles: ["SUPER_ADMIN", "ORG_ADMIN", "SECURITY_ADMIN"],
      },
      {
        id: "audit_trail",
        name: "Audit Logs & Access History",
        category: "SECURITY_DLP_AUDIT",
        screenId: "AUDIT-001",
        allowedRoles: ["SUPER_ADMIN", "ORG_ADMIN", "SECURITY_ADMIN"],
      },
    ],
  },
  {
    id: "admin",
    name: "Organization & Settings",
    allowedRoles: ["SUPER_ADMIN", "ORG_ADMIN", "SECURITY_ADMIN", "HR_ADMIN"],
    features: [
      {
        id: "org_structure",
        name: "Departments & Teams",
        category: "OPS_AI_ADMIN",
        screenId: "ORG-001",
        allowedRoles: ["SUPER_ADMIN", "ORG_ADMIN"],
      },
      {
        id: "device_inventory",
        name: "Device Inventory & Health",
        category: "OPS_AI_ADMIN",
        screenId: "DEVICE-001",
        allowedRoles: ["SUPER_ADMIN", "ORG_ADMIN", "SECURITY_ADMIN"],
      },
      {
        id: "rbac_roles",
        name: "Roles & Permissions",
        category: "OPS_AI_ADMIN",
        screenId: "ADMIN-002",
        allowedRoles: ["SUPER_ADMIN", "ORG_ADMIN"],
      },
      {
        id: "tracking_policies",
        name: "Company Tracking Policies",
        category: "OPS_AI_ADMIN",
        screenId: "ADMIN-005",
        allowedRoles: ["SUPER_ADMIN", "ORG_ADMIN"],
      },
    ],
  },
  {
    id: "platform",
    name: "Platform Administration",
    allowedRoles: ["SUPER_ADMIN"],
    features: [
      {
        id: "tenant_organizations",
        name: "Tenant Organizations",
        category: "OPS_AI_ADMIN",
        screenId: "SUPER-002",
        allowedRoles: ["SUPER_ADMIN"],
      },
      {
        id: "storage_routing",
        name: "Storage Routers & Encryption",
        category: "OPS_AI_ADMIN",
        screenId: "SUPER-005",
        allowedRoles: ["SUPER_ADMIN"],
      },
      {
        id: "system_health",
        name: "Infrastructure Health",
        category: "OPS_AI_ADMIN",
        screenId: "SUPER-006",
        allowedRoles: ["SUPER_ADMIN"],
      },
    ],
  },
];

