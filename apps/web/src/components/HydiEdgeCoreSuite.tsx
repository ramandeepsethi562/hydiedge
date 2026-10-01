"use client";

import React, { useState, useMemo } from "react";
import {
  Clock,
  Calendar,
  BarChart3,
  TrendingUp,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldAlert,
  Filter,
  Download,
  Plus,
  ChevronRight,
  ChevronDown,
  Eye,
  Check,
  X,
  Sparkles,
  RefreshCw,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  PieChart,
  Activity,
  Zap,
  Play,
  Pause,
  Coffee,
  Award,
  Search,
  Info,
  Sliders,
  Shield,
  HelpCircle,
  FolderKanban,
  Edit3,
  Send,
  SlidersHorizontal,
} from "lucide-react";

// Types
export type HydiEdgeCoreTab =
  | "OVERVIEW"
  | "ATTENDANCE_BEHAVIOR"
  | "TIME_CLAIM_QUEUE"
  | "HEATMAPS"
  | "PRODUCTIVITY_PROFILES"
  | "ACTIVITY_ENGINE"
  | "REPORTS_CENTER";

interface EmployeeAttendanceRow {
  id: string;
  name: string;
  avatar: string;
  role: string;
  team: string;
  startTime: string;
  endTime: string;
  totalWorkHours: number;
  productiveHours: number;
  idleHours: number;
  awayHours: number;
  behaviorSegments: Array<{
    type: "ACTIVE" | "IDLE" | "AWAY" | "OFFLINE";
    durationMinutes: number;
    start: string;
    end: string;
    reason?: string;
  }>;
}

interface TimeClaimItem {
  id: string;
  employeeId: string;
  employeeName: string;
  team: string;
  date: string;
  timeSlot: string;
  durationMinutes: number;
  category: "Client Call" | "Testing" | "KT Session" | "Design Whiteboard" | "Power Outage" | "Meeting";
  description: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason?: string;
  submittedAt: string;
}

interface SuspiciousActivityIncident {
  id: string;
  employeeName: string;
  team: string;
  timestamp: string;
  durationMinutes: number;
  detectionType: "Mouse Jiggler" | "Stuck Key / Key Weight" | "Auto-Clicker (50ms)" | "Synthetic Input Stream";
  confidenceScore: number;
  status: "INVESTIGATING" | "RESOLVED" | "FLAGGED_HR";
}

export default function HydiEdgeCoreSuite() {
  const [activeTab, setActiveTab] = useState<HydiEdgeCoreTab>("OVERVIEW");
  const [dateRange, setDateRange] = useState<"TODAY" | "YESTERDAY" | "THIS_WEEK" | "LAST_WEEK" | "MONTH">("TODAY");
  const [selectedTeam, setSelectedTeam] = useState<string>("ALL");
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>("ALL");
  const [expandedUserTimeline, setExpandedUserTimeline] = useState<string | null>("emp-01");

  // Time Claim Submission Modal State
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [claimTargetInterval, setClaimTargetInterval] = useState<{ empId: string; empName: string; start: string; end: string; duration: number } | null>(null);
  const [claimCategory, setClaimCategory] = useState<TimeClaimItem["category"]>("Client Call");
  const [claimReason, setClaimReason] = useState("");

  // Time Claim Approval / Rejection Modal State
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [targetClaimIdToReject, setTargetClaimIdToReject] = useState<string | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");

  // Custom Report Builder Modal State
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportStep, setReportStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [selectedReportColumns, setSelectedReportColumns] = useState<string[]>([
    "Employee Name",
    "Employee Code",
    "Shift",
    "Clock In",
    "Clock Out",
    "Total Work Hours",
    "Productive Time",
    "Idle Time",
    "Away Time",
    "Productivity %",
  ]);

  // Seed Data: Attendance with continuous Behavior Bar (Green=Active, Yellow=Idle, Orange=Break/Away, White=Offline)
  const [attendanceData, setAttendanceData] = useState<EmployeeAttendanceRow[]>([
    {
      id: "emp-01",
      name: "Ramandeep",
      avatar: "RS",
      role: "Lead Systems Engineer",
      team: "Platform Architecture",
      startTime: "09:05 AM",
      endTime: "06:40 PM",
      totalWorkHours: 8.8,
      productiveHours: 7.9,
      idleHours: 0.4,
      awayHours: 0.5,
      behaviorSegments: [
        { type: "ACTIVE", durationMinutes: 120, start: "09:05 AM", end: "11:05 AM" },
        { type: "IDLE", durationMinutes: 20, start: "11:05 AM", end: "11:25 AM", reason: "No mouse/keyboard input" },
        { type: "ACTIVE", durationMinutes: 95, start: "11:25 AM", end: "01:00 PM" },
        { type: "AWAY", durationMinutes: 30, start: "01:00 PM", end: "01:30 PM", reason: "Lunch Break" },
        { type: "ACTIVE", durationMinutes: 180, start: "01:30 PM", end: "04:30 PM" },
        { type: "IDLE", durationMinutes: 15, start: "04:30 PM", end: "04:45 PM", reason: "Brief Idle" },
        { type: "ACTIVE", durationMinutes: 115, start: "04:45 PM", end: "06:40 PM" },
      ],
    },
    {
      id: "emp-02",
      name: "Vikram Malhotra",
      avatar: "VM",
      role: "Frontend Architect",
      team: "Web Engineering",
      startTime: "09:30 AM",
      endTime: "06:15 PM",
      totalWorkHours: 8.2,
      productiveHours: 6.8,
      idleHours: 0.8,
      awayHours: 0.6,
      behaviorSegments: [
        { type: "ACTIVE", durationMinutes: 150, start: "09:30 AM", end: "12:00 PM" },
        { type: "IDLE", durationMinutes: 45, start: "12:00 PM", end: "12:45 PM", reason: "Unclaimed Idle" },
        { type: "AWAY", durationMinutes: 35, start: "12:45 PM", end: "01:20 PM", reason: "Lunch" },
        { type: "ACTIVE", durationMinutes: 210, start: "01:20 PM", end: "04:50 PM" },
        { type: "ACTIVE", durationMinutes: 85, start: "04:50 PM", end: "06:15 PM" },
      ],
    },
    {
      id: "emp-03",
      name: "Ananya Iyer",
      avatar: "AI",
      role: "Senior QA Analyst",
      team: "Quality Assurance",
      startTime: "08:55 AM",
      endTime: "05:30 PM",
      totalWorkHours: 7.6,
      productiveHours: 6.4,
      idleHours: 0.5,
      awayHours: 0.7,
      behaviorSegments: [
        { type: "ACTIVE", durationMinutes: 180, start: "08:55 AM", end: "11:55 AM" },
        { type: "AWAY", durationMinutes: 40, start: "11:55 AM", end: "12:35 PM", reason: "Sprint Retro Meeting" },
        { type: "ACTIVE", durationMinutes: 145, start: "12:35 PM", end: "03:00 PM" },
        { type: "IDLE", durationMinutes: 30, start: "03:00 PM", end: "03:30 PM", reason: "System Standby" },
        { type: "ACTIVE", durationMinutes: 120, start: "03:30 PM", end: "05:30 PM" },
      ],
    },
    {
      id: "emp-04",
      name: "Marcus Vance",
      avatar: "MV",
      role: "DevOps & SRE Lead",
      team: "Cloud Infrastructure",
      startTime: "10:15 AM",
      endTime: "07:30 PM",
      totalWorkHours: 9.1,
      productiveHours: 8.4,
      idleHours: 0.3,
      awayHours: 0.4,
      behaviorSegments: [
        { type: "ACTIVE", durationMinutes: 210, start: "10:15 AM", end: "01:45 PM" },
        { type: "AWAY", durationMinutes: 25, start: "01:45 PM", end: "02:10 PM", reason: "Quick Lunch" },
        { type: "ACTIVE", durationMinutes: 240, start: "02:10 PM", end: "06:10 PM" },
        { type: "IDLE", durationMinutes: 20, start: "06:10 PM", end: "06:30 PM" },
        { type: "ACTIVE", durationMinutes: 60, start: "06:30 PM", end: "07:30 PM" },
      ],
    },
  ]);

  // Seed Data: Time Claim Requests
  const [timeClaims, setTimeClaims] = useState<TimeClaimItem[]>([
    {
      id: "claim-101",
      employeeId: "emp-02",
      employeeName: "Vikram Malhotra",
      team: "Web Engineering",
      date: "Today, 12:00 PM - 12:45 PM",
      timeSlot: "12:00 PM – 12:45 PM",
      durationMinutes: 45,
      category: "Client Call",
      description: "Discussed frontend architectural specifications and responsiveness on Zoom mobile call.",
      status: "PENDING",
      submittedAt: "12:50 PM",
    },
    {
      id: "claim-102",
      employeeId: "emp-03",
      employeeName: "Ananya Iyer",
      team: "Quality Assurance",
      date: "Today, 03:00 PM - 03:30 PM",
      timeSlot: "03:00 PM – 03:30 PM",
      durationMinutes: 30,
      category: "Testing",
      description: "Manual physical device testing on Android tablet (disconnected from workstation).",
      status: "PENDING",
      submittedAt: "03:35 PM",
    },
    {
      id: "claim-103",
      employeeId: "emp-01",
      employeeName: "Ramandeep",
      team: "Platform Architecture",
      date: "Yesterday, 04:00 PM - 04:45 PM",
      timeSlot: "04:00 PM – 04:45 PM",
      durationMinutes: 45,
      category: "KT Session",
      description: "Knowledge transfer session on ClickHouse telemetry pipelines with junior engineers.",
      status: "APPROVED",
      submittedAt: "Yesterday",
    },
  ]);

  // Seed Data: Anti-Cheat Suspicious Activity
  const [suspiciousIncidents, setSuspiciousIncidents] = useState<SuspiciousActivityIncident[]>([
    {
      id: "susp-01",
      employeeName: "Vikram Malhotra",
      team: "Web Engineering",
      timestamp: "11:28 AM",
      durationMinutes: 14,
      detectionType: "Mouse Jiggler",
      confidenceScore: 98,
      status: "INVESTIGATING",
    },
    {
      id: "susp-02",
      employeeName: "Devin Zhao",
      team: "Customer Success",
      timestamp: "02:15 PM",
      durationMinutes: 28,
      detectionType: "Stuck Key / Key Weight",
      confidenceScore: 94,
      status: "FLAGGED_HR",
    },
    {
      id: "susp-03",
      employeeName: "Rohan Patel",
      team: "Data Entry & BPO",
      timestamp: "03:40 PM",
      durationMinutes: 8,
      detectionType: "Auto-Clicker (50ms)",
      confidenceScore: 99,
      status: "RESOLVED",
    },
  ]);

  // Handle Approve Claim
  const handleApproveClaim = (claimId: string) => {
    setTimeClaims((prev) =>
      prev.map((c) => (c.id === claimId ? { ...c, status: "APPROVED" } : c))
    );
  };

  // Open Reject Modal
  const openRejectModal = (claimId: string) => {
    setTargetClaimIdToReject(claimId);
    setRejectionNote("");
    setRejectModalOpen(true);
  };

  // Submit Rejection
  const handleConfirmRejection = () => {
    if (!targetClaimIdToReject || !rejectionNote.trim()) return;
    setTimeClaims((prev) =>
      prev.map((c) =>
        c.id === targetClaimIdToReject
          ? { ...c, status: "REJECTED", rejectionReason: rejectionNote }
          : c
      )
    );
    setRejectModalOpen(false);
    setTargetClaimIdToReject(null);
  };

  // Handle Submit Claim from UI
  const handleOpenClaimModal = (empId: string, empName: string, start: string, end: string, duration: number) => {
    setClaimTargetInterval({ empId, empName, start, end, duration });
    setClaimCategory("Client Call");
    setClaimReason("");
    setClaimModalOpen(true);
  };

  const handleSubmitClaim = (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimTargetInterval || !claimReason.trim()) return;
    const newClaim: TimeClaimItem = {
      id: `claim-${Date.now()}`,
      employeeId: claimTargetInterval.empId,
      employeeName: claimTargetInterval.empName,
      team: "Platform Engineering",
      date: `Today, ${claimTargetInterval.start} - ${claimTargetInterval.end}`,
      timeSlot: `${claimTargetInterval.start} – ${claimTargetInterval.end}`,
      durationMinutes: claimTargetInterval.duration,
      category: claimCategory,
      description: claimReason,
      status: "PENDING",
      submittedAt: "Just now",
    };
    setTimeClaims([newClaim, ...timeClaims]);
    setClaimModalOpen(false);
    setClaimTargetInterval(null);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Mode Selector */}
      <div className="hydi-card p-5 border-emerald-500/30 bg-gradient-to-r from-slate-950 via-[#0a1628] to-slate-950 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-xs font-bold border border-emerald-500/30 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              HYDIEDGE WORKFORCE TRACKING SUITE
            </span>
            <span className="text-xs font-mono text-cyan-400">Enterprise High-Precision Time Telemetry</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
            Time Tracking, Behavior Bar & Attendance Analytics
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl mt-0.5">
            Continuous segmented timeline, idle interval Time Claims, 8.0h baseline Work-Life balance, 3 annual heatmaps, and anti-cheat intensity engine.
          </p>
        </div>

        {/* Global Date & Range Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs font-mono">
            {[
              { id: "TODAY", label: "Day" },
              { id: "YESTERDAY", label: "Yesterday" },
              { id: "THIS_WEEK", label: "Week" },
              { id: "LAST_WEEK", label: "Last Week" },
              { id: "MONTH", label: "Month" },
            ].map((d) => (
              <button
                key={d.id}
                onClick={() => setDateRange(d.id as typeof dateRange)}
                className={`px-3 py-1.5 rounded-lg transition ${
                  dateRange === d.id ? "bg-emerald-600 text-white font-bold shadow" : "text-slate-400 hover:text-white"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              setReportStep(1);
              setReportModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Custom Report Builder
          </button>
        </div>
      </div>

      {/* 2. Main Navigation Bar with 7 Core Modules */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {[
          { id: "OVERVIEW", label: "1. Time Tracker Overview", icon: BarChart3, badge: "8h Baseline" },
          { id: "ATTENDANCE_BEHAVIOR", label: "2. Attendance & Behavior Bar", icon: Clock, badge: "Continuous Bar" },
          { id: "TIME_CLAIM_QUEUE", label: "3. Time Claim Queue", icon: Edit3, badge: `${timeClaims.filter((c) => c.status === "PENDING").length} Pending` },
          { id: "HEATMAPS", label: "4. 3 Annual Heat Maps", icon: Calendar, badge: "Work/Prod/Away" },
          { id: "PRODUCTIVITY_PROFILES", label: "5. Productivity & 5-Min Bar", icon: Activity, badge: "Profiles" },
          { id: "ACTIVITY_ENGINE", label: "6. Activity & Anti-Cheat", icon: Zap, badge: "Intensity" },
          { id: "REPORTS_CENTER", label: "7. 12 Pre-Built Reports", icon: FileText, badge: "Late & Shrinkage" },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as HydiEdgeCoreTab)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                isActive
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 shadow-sm"
                  : "bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                    isActive ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* =========================================================================
          TAB 1: TIME TRACKER OVERVIEW
      ========================================================================= */}
      {activeTab === "OVERVIEW" && (
        <div className="space-y-6">
          {/* Top 4 KPI Cards for HydiEdge Core Suite */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>Average Start Time</span>
                <Clock className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-black text-white">09:18 AM</div>
              <div className="text-[11px] text-emerald-400 flex items-center gap-1 font-mono">
                <ArrowUpRight className="w-3.5 h-3.5" /> 12 mins earlier than yesterday
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>Total Working Time</span>
                <Clock className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-emerald-300">08h 24m</div>
              <div className="text-[11px] text-slate-400 font-mono">
                Across 42 tracked workstations
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>Average Last Seen</span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black text-white">06:42 PM</div>
              <div className="text-[11px] text-cyan-400 font-mono">Expected logout: 06:30 PM</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>Tracked Members</span>
                <Users className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-black text-white">42 / 48</div>
              <div className="text-[11px] text-emerald-400 font-mono">87.5% Workforce Present</div>
            </div>
          </div>

          {/* Work vs Life Balance Chart with 8.0h baseline line */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-400" />
                  Work vs Life Balance (8.0h Baseline Compliance)
                </h2>
                <p className="text-xs text-slate-400">
                  Daily working time versus standard healthy workload threshold (Dashed red line = 8h 00m)
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-3 h-3 rounded bg-emerald-500" /> Overworked (&gt;8h)
                </span>
                <span className="flex items-center gap-1.5 text-cyan-400">
                  <span className="w-3 h-3 rounded bg-cyan-500" /> Healthy (=8h)
                </span>
                <span className="flex items-center gap-1.5 text-amber-400">
                  <span className="w-3 h-3 rounded bg-amber-500" /> Underworked (&lt;8h)
                </span>
                <span className="flex items-center gap-1.5 text-rose-400">
                  <span className="w-3 h-0.5 border-b border-dashed border-rose-400" /> 8h Baseline
                </span>
              </div>
            </div>

            {/* SVG Visual Representation of the Bar Chart */}
            <div className="h-64 w-full relative flex items-end justify-between px-4 pt-8 pb-4 bg-slate-950/60 rounded-xl border border-slate-800/80">
              {/* Baseline 8.0h Dashed Line */}
              <div className="absolute left-0 right-0 top-[35%] border-b border-dashed border-rose-500/80 pointer-events-none flex items-center justify-end px-2">
                <span className="text-[10px] font-mono text-rose-400 bg-slate-950 px-1.5 py-0.5 rounded border border-rose-500/40">
                  8.0h Healthy Standard
                </span>
              </div>

              {[
                { day: "Monday", hours: 8.6, status: "OVER" },
                { day: "Tuesday", hours: 9.1, status: "OVER" },
                { day: "Wednesday", hours: 8.0, status: "HEALTHY" },
                { day: "Thursday", hours: 7.4, status: "UNDER" },
                { day: "Friday", hours: 8.4, status: "OVER" },
                { day: "Saturday", hours: 3.2, status: "UNDER" },
                { day: "Sunday", hours: 0.0, status: "OFF" },
              ].map((item) => {
                const heightPct = Math.min((item.hours / 11) * 100, 100);
                const color =
                  item.status === "OVER"
                    ? "bg-gradient-to-t from-emerald-600 to-emerald-400"
                    : item.status === "HEALTHY"
                    ? "bg-gradient-to-t from-cyan-600 to-cyan-400"
                    : item.status === "UNDER"
                    ? "bg-gradient-to-t from-amber-600 to-amber-400"
                    : "bg-slate-800";

                return (
                  <div key={item.day} className="flex-1 flex flex-col items-center gap-2 group z-10">
                    <div className="text-[11px] font-mono font-bold text-white opacity-0 group-hover:opacity-100 transition">
                      {item.hours}h
                    </div>
                    <div className="w-10 sm:w-14 h-44 flex items-end justify-center">
                      <div
                        style={{ height: `${heightPct}%` }}
                        className={`w-full rounded-t-lg ${color} shadow-lg transition-all duration-300 group-hover:scale-105`}
                      />
                    </div>
                    <div className="text-xs font-mono text-slate-400 mt-1">{item.day}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Productivity Split & Away Breakdown 2-Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Productivity Split Table */}
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <PieChart className="w-4 h-4 text-cyan-400" />
                Productivity Split & Man Days
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 text-slate-400 font-mono uppercase text-[10px]">
                    <tr>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5">Man Days</th>
                      <th className="p-2.5">Over-Worked (&gt;8h)</th>
                      <th className="p-2.5">Healthy (=8h)</th>
                      <th className="p-2.5">Under-Worked (&lt;8h)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    <tr className="hover:bg-slate-800/40">
                      <td className="p-2.5 font-bold text-white">Platform Architecture</td>
                      <td className="p-2.5 text-cyan-300">12 Days</td>
                      <td className="p-2.5 text-emerald-400 font-bold">8 (66.7%)</td>
                      <td className="p-2.5 text-blue-400">3 (25.0%)</td>
                      <td className="p-2.5 text-amber-400">1 (8.3%)</td>
                    </tr>
                    <tr className="hover:bg-slate-800/40">
                      <td className="p-2.5 font-bold text-white">Web Engineering</td>
                      <td className="p-2.5 text-cyan-300">18 Days</td>
                      <td className="p-2.5 text-emerald-400 font-bold">9 (50.0%)</td>
                      <td className="p-2.5 text-blue-400">6 (33.3%)</td>
                      <td className="p-2.5 text-amber-400">3 (16.7%)</td>
                    </tr>
                    <tr className="hover:bg-slate-800/40">
                      <td className="p-2.5 font-bold text-white">QA & Security</td>
                      <td className="p-2.5 text-cyan-300">10 Days</td>
                      <td className="p-2.5 text-emerald-400 font-bold">4 (40.0%)</td>
                      <td className="p-2.5 text-blue-400">4 (40.0%)</td>
                      <td className="p-2.5 text-amber-400">2 (20.0%)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: Time Away From System (Testing, Client Call, KT, Lunch, Tea, etc.) */}
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Coffee className="w-4 h-4 text-amber-400" />
                Time Away From System (Categorized Offline Time)
              </h3>
              <div className="space-y-3 font-mono text-xs">
                {[
                  { reason: "Testing (Physical Devices)", hours: "04h 15m", pct: 32, color: "bg-cyan-500" },
                  { reason: "Client Calls (Zoom / Offline)", hours: "03h 40m", pct: 28, color: "bg-emerald-500" },
                  { reason: "KT & Mentoring Sessions", hours: "02h 10m", pct: 16, color: "bg-blue-500" },
                  { reason: "Internal Team Meetings", hours: "01h 50m", pct: 14, color: "bg-violet-500" },
                  { reason: "Lunch Break", hours: "01h 00m", pct: 8, color: "bg-amber-500" },
                  { reason: "Tea / Coffee Break", hours: "00h 15m", pct: 2, color: "bg-rose-500" },
                ].map((item) => (
                  <div key={item.reason} className="space-y-1">
                    <div className="flex justify-between items-center text-slate-300">
                      <span>{item.reason}</span>
                      <span className="font-bold text-white">
                        {item.hours} ({item.pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div style={{ width: `${item.pct}%` }} className={`h-full rounded-full ${item.color}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: ATTENDANCE & CONTINUOUS BEHAVIOR BAR + DAY TIMELINE + TIME CLAIM
      ========================================================================= */}
      {activeTab === "ATTENDANCE_BEHAVIOR" && (
        <div className="space-y-6">
          {/* Behavior Bar Color Legend */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white font-mono">BEHAVIOR BAR LEGEND:</span>
              <span className="text-xs text-slate-400">Continuous 24h segmented visual representation of workforce states</span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-500" />
                <span className="text-emerald-300">Active (Working)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-amber-400" />
                <span className="text-amber-300">Idle (Inactivity)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-orange-500" />
                <span className="text-orange-300">Away / Break</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-slate-700" />
                <span className="text-slate-400">Offline</span>
              </div>
            </div>
          </div>

          {/* Daily Attendance Table with Integrated Continuous Behavior Bar */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                Employee Attendance & Daily Behavior Bars
              </h2>
              <span className="text-xs font-mono text-slate-400">Click any employee row to expand detailed 10-minute slot timeline</span>
            </div>

            <div className="space-y-3">
              {attendanceData.map((emp) => {
                const isExpanded = expandedUserTimeline === emp.id;
                return (
                  <div key={emp.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 hover:border-slate-700 transition">
                    {/* Top Row: Employee Info, Timings, Metrics */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold flex items-center justify-center font-mono text-xs">
                          {emp.avatar}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white flex items-center gap-2">
                            {emp.name}
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                              {emp.team}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 font-mono">
                            {emp.role} • Clock In: <strong className="text-emerald-400">{emp.startTime}</strong> • Clock Out: <strong className="text-cyan-400">{emp.endTime}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Work, Prod, Idle, Away Pills */}
                      <div className="flex items-center gap-2 text-xs font-mono">
                        <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300">
                          Total: <strong className="text-white">{emp.totalWorkHours}h</strong>
                        </span>
                        <span className="px-2 py-1 rounded bg-emerald-950/60 border border-emerald-800/40 text-emerald-300">
                          Prod: <strong>{emp.productiveHours}h</strong>
                        </span>
                        <span className="px-2 py-1 rounded bg-amber-950/60 border border-amber-800/40 text-amber-300">
                          Idle: <strong>{emp.idleHours}h</strong>
                        </span>
                        <span className="px-2 py-1 rounded bg-orange-950/60 border border-orange-800/40 text-orange-300">
                          Away: <strong>{emp.awayHours}h</strong>
                        </span>
                        <button
                          onClick={() => setExpandedUserTimeline(isExpanded ? null : emp.id)}
                          className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold transition cursor-pointer flex items-center gap-1 text-[11px]"
                        >
                          {isExpanded ? "Collapse Timeline" : "Inspect Timeline"}
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        </button>
                      </div>
                    </div>

                    {/* Continuous Behavior Bar */}
                    <div className="space-y-1">
                      <div className="w-full h-4 rounded-md bg-slate-900 flex overflow-hidden border border-slate-800/80">
                        {emp.behaviorSegments.map((seg, idx) => {
                          const totalMinutes = emp.behaviorSegments.reduce((acc, s) => acc + s.durationMinutes, 0);
                          const widthPct = (seg.durationMinutes / totalMinutes) * 100;
                          const bg =
                            seg.type === "ACTIVE"
                              ? "bg-emerald-500"
                              : seg.type === "IDLE"
                              ? "bg-amber-400"
                              : seg.type === "AWAY"
                              ? "bg-orange-500"
                              : "bg-slate-700";
                          return (
                            <div
                              key={idx}
                              style={{ width: `${widthPct}%` }}
                              title={`${seg.type}: ${seg.start} - ${seg.end} (${seg.durationMinutes}m) ${seg.reason || ""}`}
                              className={`h-full ${bg} hover:brightness-125 transition-all cursor-pointer relative group`}
                            />
                          );
                        })}
                      </div>
                      <div className="flex justify-between text-[10px] font-mono text-slate-400">
                        <span>{emp.startTime}</span>
                        <span>12:00 PM</span>
                        <span>03:00 PM</span>
                        <span>{emp.endTime}</span>
                      </div>
                    </div>

                    {/* Expanded Day Timeline & Time Claim Option */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-3 bg-slate-900/60 p-4 rounded-xl">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-white flex items-center gap-1.5 font-mono">
                            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                            DETAILED TIMELINE SLICES & OFFLINE TIME CLAIM
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Click <strong className="text-amber-400">Claim Time</strong> on idle intervals to submit an approval request
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                          {emp.behaviorSegments.map((seg, i) => (
                            <div
                              key={i}
                              className={`p-3 rounded-lg border text-xs font-mono space-y-1 ${
                                seg.type === "ACTIVE"
                                  ? "bg-emerald-950/30 border-emerald-800/50 text-emerald-200"
                                  : seg.type === "IDLE"
                                  ? "bg-amber-950/30 border-amber-800/50 text-amber-200"
                                  : "bg-orange-950/30 border-orange-800/50 text-orange-200"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold">{seg.type}</span>
                                <span className="text-[11px] text-slate-300">{seg.durationMinutes} mins</span>
                              </div>
                              <div className="text-[11px] text-slate-300">
                                {seg.start} – {seg.end}
                              </div>
                              {seg.reason && <div className="text-[10px] text-slate-400 truncate">{seg.reason}</div>}

                              {seg.type === "IDLE" && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenClaimModal(emp.id, emp.name, seg.start, seg.end, seg.durationMinutes)}
                                  className="mt-2 w-full py-1 rounded bg-amber-600/80 hover:bg-amber-500 text-white font-bold text-[11px] flex items-center justify-center gap-1 transition cursor-pointer"
                                >
                                  <Edit3 className="w-3 h-3" /> Claim Idle Time
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: TIME CLAIM MANAGER QUEUE (Approve / Reject with Reason)
      ========================================================================= */}
      {activeTab === "TIME_CLAIM_QUEUE" && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-cyan-400" />
                Offline Time Claim Review Queue
              </h2>
              <p className="text-xs text-slate-400">
                Supervisor portal for approving or rejecting manual offline time claims. Approvals automatically retroactively adjust productive hours.
              </p>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Pending Review: <strong>{timeClaims.filter((c) => c.status === "PENDING").length}</strong>
              </span>
              <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Approved: <strong>{timeClaims.filter((c) => c.status === "APPROVED").length}</strong>
              </span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950 text-slate-400 font-mono uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Employee</th>
                    <th className="p-3">Date & Slot</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Claim Reason & Justification</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 font-mono">
                  {timeClaims.map((claim) => (
                    <tr key={claim.id} className="hover:bg-slate-800/40">
                      <td className="p-3">
                        <div className="font-bold text-white">{claim.employeeName}</div>
                        <div className="text-[11px] text-slate-400">{claim.team}</div>
                      </td>
                      <td className="p-3">
                        <div className="text-white">{claim.date}</div>
                        <div className="text-[11px] text-cyan-400">{claim.durationMinutes} mins duration</div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold">
                          {claim.category}
                        </span>
                      </td>
                      <td className="p-3 max-w-xs">
                        <div className="text-slate-200">{claim.description}</div>
                        {claim.rejectionReason && (
                          <div className="text-[10px] text-rose-400 mt-1 font-sans">
                            Rejection Note: {claim.rejectionReason}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            claim.status === "APPROVED"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : claim.status === "REJECTED"
                              ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                              : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          }`}
                        >
                          {claim.status}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-2">
                        {claim.status === "PENDING" ? (
                          <>
                            <button
                              onClick={() => handleApproveClaim(claim.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition cursor-pointer text-[11px]"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => openRejectModal(claim.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white font-bold transition cursor-pointer text-[11px]"
                            >
                              Reject
                            </button>
                          </>
                        ) : (
                          <span className="text-[11px] text-slate-500">Processed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: 3 ANNUAL HEAT MAPS (Working Time, Productive Time, Away Time)
      ========================================================================= */}
      {activeTab === "HEATMAPS" && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" />
                3 Enterprise Annual Heat Maps
              </h2>
              <p className="text-xs text-slate-400">
                52-week activity matrices mapping Working Time, Productive Time, and Away/Idle Time.
              </p>
            </div>
            <div className="text-xs font-mono text-cyan-400">Showing Year 2026 (All 52 Weeks)</div>
          </div>

          {/* 1. Working Time Heatmap (Blue Gradient) */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-400 font-mono uppercase flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-blue-500" /> 1. Working Time Heatmap (0h – 10h+)
              </span>
              <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400">
                <span>0h</span>
                <span className="w-3 h-3 rounded-sm bg-slate-800" />
                <span className="w-3 h-3 rounded-sm bg-blue-950" />
                <span className="w-3 h-3 rounded-sm bg-blue-800" />
                <span className="w-3 h-3 rounded-sm bg-blue-600" />
                <span className="w-3 h-3 rounded-sm bg-blue-400" />
                <span>10h+</span>
              </div>
            </div>

            {/* Matrix Simulation */}
            <div className="grid grid-cols-26 sm:grid-cols-52 gap-1 overflow-x-auto p-2 bg-slate-950 rounded-xl border border-slate-800/80">
              {Array.from({ length: 52 * 7 }).map((_, idx) => {
                const isWeekend = idx % 7 === 5 || idx % 7 === 6;
                const hours = isWeekend ? 0 : ((idx * 7) % 9) + 2;
                const bg =
                  hours === 0
                    ? "bg-slate-900"
                    : hours < 4
                    ? "bg-blue-950"
                    : hours < 7
                    ? "bg-blue-800"
                    : hours < 9
                    ? "bg-blue-600"
                    : "bg-blue-400";
                return (
                  <div
                    key={idx}
                    title={`Day ${idx + 1}: ${hours}h Logged`}
                    className={`w-2.5 h-2.5 rounded-xs ${bg} hover:ring-1 hover:ring-white transition cursor-pointer`}
                  />
                );
              })}
            </div>
          </div>

          {/* 2. Productive Time Heatmap (Green Gradient) */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 font-mono uppercase flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-emerald-500" /> 2. Productive Time Heatmap (0h – 8h+)
              </span>
              <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400">
                <span>0h</span>
                <span className="w-3 h-3 rounded-sm bg-slate-800" />
                <span className="w-3 h-3 rounded-sm bg-emerald-950" />
                <span className="w-3 h-3 rounded-sm bg-emerald-800" />
                <span className="w-3 h-3 rounded-sm bg-emerald-600" />
                <span className="w-3 h-3 rounded-sm bg-emerald-400" />
                <span>8h+</span>
              </div>
            </div>

            <div className="grid grid-cols-26 sm:grid-cols-52 gap-1 overflow-x-auto p-2 bg-slate-950 rounded-xl border border-slate-800/80">
              {Array.from({ length: 52 * 7 }).map((_, idx) => {
                const isWeekend = idx % 7 === 5 || idx % 7 === 6;
                const hours = isWeekend ? 0 : ((idx * 5) % 8) + 1;
                const bg =
                  hours === 0
                    ? "bg-slate-900"
                    : hours < 3
                    ? "bg-emerald-950"
                    : hours < 5
                    ? "bg-emerald-800"
                    : hours < 7
                    ? "bg-emerald-600"
                    : "bg-emerald-400";
                return (
                  <div
                    key={idx}
                    title={`Day ${idx + 1}: ${hours}h Productive`}
                    className={`w-2.5 h-2.5 rounded-xs ${bg} hover:ring-1 hover:ring-white transition cursor-pointer`}
                  />
                );
              })}
            </div>
          </div>

          {/* 3. Away Time Heatmap (Amber Gradient) */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 font-mono uppercase flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-amber-500" /> 3. Away & Idle Time Heatmap (0h – 3h+)
              </span>
              <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400">
                <span>0h</span>
                <span className="w-3 h-3 rounded-sm bg-slate-800" />
                <span className="w-3 h-3 rounded-sm bg-amber-950" />
                <span className="w-3 h-3 rounded-sm bg-amber-800" />
                <span className="w-3 h-3 rounded-sm bg-amber-600" />
                <span className="w-3 h-3 rounded-sm bg-amber-400" />
                <span>3h+</span>
              </div>
            </div>

            <div className="grid grid-cols-26 sm:grid-cols-52 gap-1 overflow-x-auto p-2 bg-slate-950 rounded-xl border border-slate-800/80">
              {Array.from({ length: 52 * 7 }).map((_, idx) => {
                const isWeekend = idx % 7 === 5 || idx % 7 === 6;
                const hours = isWeekend ? 0 : (idx % 4) * 0.8;
                const bg =
                  hours === 0
                    ? "bg-slate-900"
                    : hours < 0.8
                    ? "bg-amber-950"
                    : hours < 1.5
                    ? "bg-amber-800"
                    : hours < 2.2
                    ? "bg-amber-600"
                    : "bg-amber-400";
                return (
                  <div
                    key={idx}
                    title={`Day ${idx + 1}: ${hours.toFixed(1)}h Away`}
                    className={`w-2.5 h-2.5 rounded-xs ${bg} hover:ring-1 hover:ring-white transition cursor-pointer`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 5: PRODUCTIVITY PROFILES & 5-MINUTE PRODUCTIVITY BAR
      ========================================================================= */}
      {activeTab === "PRODUCTIVITY_PROFILES" && (
        <div className="space-y-6">
          {/* Multi-Period Comparison Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
              <div className="text-xs text-slate-400 font-mono">This Day vs Yesterday</div>
              <div className="text-2xl font-black text-emerald-400">+4.8%</div>
              <div className="text-[11px] text-slate-400 font-mono">Productivity rose to 86.4%</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
              <div className="text-xs text-slate-400 font-mono">This Week vs Last Week</div>
              <div className="text-2xl font-black text-cyan-400">+2.1%</div>
              <div className="text-[11px] text-slate-400 font-mono">Average 41.2 hrs per employee</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
              <div className="text-xs text-slate-400 font-mono">Active Application Groups</div>
              <div className="text-2xl font-black text-white">4 Groups</div>
              <div className="text-[11px] text-slate-400 font-mono">Dev, Sales, QA, Management</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
              <div className="text-xs text-slate-400 font-mono">Idle Timeout Setting</div>
              <div className="text-2xl font-black text-amber-400">3 Minutes</div>
              <div className="text-[11px] text-slate-400 font-mono">Automatic standby trigger</div>
            </div>
          </div>

          {/* 5-Minute High-Density Productivity Bar */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  5-Minute Stacked Productivity Bar (09:00 AM – 06:00 PM)
                </h3>
                <p className="text-xs text-slate-400">
                  Granular 5-minute activity slices showing Productive (Green), Non-Productive (Red), and Neutral (Gray)
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-3 h-3 rounded-xs bg-emerald-500" /> Productive (88%)
                </span>
                <span className="flex items-center gap-1.5 text-rose-400">
                  <span className="w-3 h-3 rounded-xs bg-rose-500" /> Non-Productive (7%)
                </span>
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-3 h-3 rounded-xs bg-slate-600" /> Neutral / No Impact (5%)
                </span>
              </div>
            </div>

            {/* 108 segments for a 9-hour shift (12 per hour * 9) */}
            <div className="w-full flex h-8 rounded-lg overflow-hidden border border-slate-800 bg-slate-950 p-1 gap-0.5">
              {Array.from({ length: 108 }).map((_, i) => {
                const isNonProd = i === 24 || i === 25 || i === 70;
                const isNeutral = i === 48 || i === 49;
                const bg = isNonProd ? "bg-rose-500" : isNeutral ? "bg-slate-600" : "bg-emerald-500";
                return (
                  <div
                    key={i}
                    title={`Interval ${i + 1}: ${isNonProd ? "Non-Productive" : isNeutral ? "Neutral" : "Productive"}`}
                    className={`flex-1 h-full ${bg} hover:brightness-125 transition cursor-pointer`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] font-mono text-slate-400">
              <span>09:00 AM</span>
              <span>11:00 AM</span>
              <span>01:00 PM (Lunch)</span>
              <span>03:00 PM</span>
              <span>05:00 PM</span>
              <span>06:00 PM</span>
            </div>
          </div>

          {/* Department Profiles & App Classification Rules */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              Department Classification Profiles (Productive / Non-Productive / Neutral)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  dept: "Software Engineering",
                  productive: ["VS Code", "GitHub", "Terminal", "Postman", "Docker", "StackOverflow"],
                  neutral: ["Slack", "Google Meet", "Jira", "Notion"],
                  nonProd: ["Facebook", "Netflix", "Steam", "Instagram", "Shopping"],
                },
                {
                  dept: "Sales & Business Development",
                  productive: ["HubSpot CRM", "LinkedIn", "Salesforce", "Gmail", "Zoom"],
                  neutral: ["Google Docs", "Calendar", "WhatsApp Web"],
                  nonProd: ["GitHub", "Steam", "Twitch", "Reddit"],
                },
                {
                  dept: "Quality Assurance",
                  productive: ["Selenium", "Jira", "Postman", "Chrome DevTools", "Cypress"],
                  neutral: ["Slack", "Excel", "Zoom"],
                  nonProd: ["Gaming", "Video Streaming", "Social Media"],
                },
              ].map((p) => (
                <div key={p.dept} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="text-xs font-bold text-white border-b border-slate-800 pb-2">{p.dept}</div>
                  <div className="space-y-2 text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-emerald-400 font-bold block mb-1">PRODUCTIVE APPS:</span>
                      <div className="flex flex-wrap gap-1">
                        {p.productive.map((app) => (
                          <span key={app} className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 text-[10px] border border-emerald-500/20">
                            {app}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block mb-1">NEUTRAL / NO IMPACT:</span>
                      <div className="flex flex-wrap gap-1">
                        {p.neutral.map((app) => (
                          <span key={app} className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                            {app}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-rose-400 font-bold block mb-1">NON-PRODUCTIVE:</span>
                      <div className="flex flex-wrap gap-1">
                        {p.nonProd.map((app) => (
                          <span key={app} className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 text-[10px] border border-rose-500/20">
                            {app}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 6: ACTIVITY ENGINE & SUSPICIOUS ACTIVITY (Anti-Cheat)
      ========================================================================= */}
      {activeTab === "ACTIVITY_ENGINE" && (
        <div className="space-y-6">
          {/* Intensity Graph (Keystrokes vs Mouse Clicks Dual Curves) */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-cyan-400" />
                  Activity Intensity Graph (Keystrokes vs Mouse Clicks per 10 Mins)
                </h3>
                <p className="text-xs text-slate-400">
                  Continuous dual-frequency telemetry curves showing input volume throughout working hours.
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="flex items-center gap-1.5 text-blue-400">
                  <span className="w-3 h-0.5 bg-blue-500" /> Keystrokes (Blue Curve)
                </span>
                <span className="flex items-center gap-1.5 text-orange-400">
                  <span className="w-3 h-0.5 bg-orange-500" /> Mouse Clicks (Orange Curve)
                </span>
              </div>
            </div>

            {/* SVG Dual Curve Simulation */}
            <div className="h-56 w-full relative bg-slate-950 rounded-xl p-4 border border-slate-800 flex items-center justify-center">
              <svg className="w-full h-full" viewBox="0 0 800 200" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {/* Blue Keystrokes Area & Line */}
                <path
                  d="M0,160 Q100,60 200,90 T400,40 T600,120 T800,80 L800,200 L0,200 Z"
                  fill="url(#blueGrad)"
                />
                <path
                  d="M0,160 Q100,60 200,90 T400,40 T600,120 T800,80"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="3"
                />

                {/* Orange Mouse Clicks Line */}
                <path
                  d="M0,180 Q100,130 200,110 T400,90 T600,70 T800,140"
                  fill="none"
                  stroke="#f97316"
                  strokeWidth="2.5"
                  strokeDasharray="4 2"
                />
              </svg>
            </div>
            <div className="flex justify-between text-[10px] font-mono text-slate-400">
              <span>09:00 AM (480 keys / 90 clicks)</span>
              <span>12:00 PM (1,240 keys / 340 clicks)</span>
              <span>03:00 PM (1,890 keys / 420 clicks)</span>
              <span>06:00 PM (620 keys / 110 clicks)</span>
            </div>
          </div>

          {/* Suspicious Activity Anti-Cheat Detector */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-rose-500/30 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  Suspicious Activity & Anti-Cheat Engine (Hardware Jiggler / Key Weights)
                </h3>
                <p className="text-xs text-slate-400">
                  Automated heuristics detecting artificial inputs, mechanical coordinate oscillation, and key-weight cheats.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 font-mono text-xs font-bold border border-rose-500/40">
                {suspiciousIncidents.length} Flagged Incidents
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950 text-slate-400 font-mono uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Employee</th>
                    <th className="p-3">Time & Duration</th>
                    <th className="p-3">Cheat Heuristic Detected</th>
                    <th className="p-3">Confidence Score</th>
                    <th className="p-3">Investigation Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 font-mono">
                  {suspiciousIncidents.map((inc) => (
                    <tr key={inc.id} className="hover:bg-slate-800/40">
                      <td className="p-3">
                        <div className="font-bold text-white">{inc.employeeName}</div>
                        <div className="text-[11px] text-slate-400">{inc.team}</div>
                      </td>
                      <td className="p-3">
                        <div className="text-white">{inc.timestamp}</div>
                        <div className="text-[11px] text-amber-400">{inc.durationMinutes} mins continuous</div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                          {inc.detectionType}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="text-emerald-400 font-bold">{inc.confidenceScore}% AI Confidence</span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            inc.status === "RESOLVED"
                              ? "bg-slate-800 text-slate-300"
                              : inc.status === "FLAGGED_HR"
                              ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                              : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          }`}
                        >
                          {inc.status}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-2">
                        <button
                          onClick={() => {
                            setSuspiciousIncidents((prev) =>
                              prev.map((i) => (i.id === inc.id ? { ...i, status: "RESOLVED" } : i))
                            );
                          }}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer text-[11px]"
                        >
                          Mark Resolved
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 7: 12 PRE-BUILT REPORTS & METRICS
      ========================================================================= */}
      {activeTab === "REPORTS_CENTER" && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                12 Official HydiEdge Pre-Built Enterprise Reports
              </h2>
              <p className="text-xs text-slate-400">
                Exportable compliance matrices including Monthly Attendance (P/A/HP/WO), Late Employees with TLC & ALT, and BPO Shrinkage %.
              </p>
            </div>
            <button
              onClick={() => {
                setReportStep(1);
                setReportModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/30 transition cursor-pointer flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Build Custom Report
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                title: "1. Monthly Attendance Matrix",
                desc: "Full month grid with Present (P), Absent (A), Half Day (HD), and Weekly Off (WO) codes.",
                tag: "Monthly Compliance",
              },
              {
                title: "2. Late Employees Report (TLC & ALT)",
                desc: "Total Late Count (TLC) and Average Late Time (ALT) ranking chronic tardiness across departments.",
                tag: "Punctuality",
              },
              {
                title: "3. Break Time Split & Overshoot",
                desc: "Tea, Lunch, KT, Client Call, and Unplanned break minutes with overtime deduction flags.",
                tag: "Productivity",
              },
              {
                title: "4. BPO & Call Center Shrinkage %",
                desc: "Internal vs External shrinkage formula calculating unallocated and off-phone hours.",
                tag: "Contact Center",
              },
              {
                title: "5. Application & URL Audit Report",
                desc: "Per-user breakdown of window titles, visited domains, and categorized productive minutes.",
                tag: "Governance",
              },
              {
                title: "6. Time Claim Approval Audit",
                desc: "Complete history of submitted, approved, and rejected manual offline time intervals.",
                tag: "Payroll Audit",
              },
              {
                title: "7. Suspicious Activity & Anti-Cheat",
                desc: "Incidents of mouse jigglers, mechanical clickers, and key weights logged by endpoint agents.",
                tag: "Security",
              },
              {
                title: "8. Overtime & Shortfall Report",
                desc: "Hours exceeding standard 8.0h threshold versus undertime shortfall hours.",
                tag: "Payroll",
              },
              {
                title: "9. Remote vs Office Hybrid Comparison",
                desc: "Productivity, idle time, and work duration differences between WFH and In-Office employees.",
                tag: "Hybrid Work",
              },
              {
                title: "10. Top 10 Productive & Idle Performers",
                desc: "Leaderboard of top engineers by productive hours vs bottom quartile idle hours.",
                tag: "Performance",
              },
              {
                title: "11. Focus Time & Deep Work Blocks",
                desc: "Continuous uninterrupted work blocks >= 45 mins without context switching.",
                tag: "Engineering Flow",
              },
              {
                title: "12. Hardware Fleet Telemetry Audit",
                desc: "CPU, memory, agent version, and local SQLite spool synchronization status per workstation.",
                tag: "IT Operations",
              },
            ].map((rep) => (
              <div key={rep.title} className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-cyan-400 mb-1">
                    <span>{rep.tag}</span>
                    <span className="text-emerald-400">CSV / XLSX / PDF</span>
                  </div>
                  <h4 className="text-sm font-bold text-white">{rep.title}</h4>
                  <p className="text-xs text-slate-400 mt-1">{rep.desc}</p>
                </div>
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <button className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
                    <Download className="w-3.5 h-3.5" /> Export Data
                  </button>
                  <button className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1">
                    Preview <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 1: SUBMIT OFFLINE TIME CLAIM
      ========================================================================= */}
      {claimModalOpen && claimTargetInterval && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1322] border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-400" />
                Submit Offline Time Claim
              </h3>
              <button onClick={() => setClaimModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitClaim} className="space-y-4 text-xs font-mono">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                <div className="text-slate-400">Target Interval:</div>
                <div className="font-bold text-white text-sm">
                  {claimTargetInterval.start} – {claimTargetInterval.end} ({claimTargetInterval.duration} Minutes)
                </div>
                <div className="text-[11px] text-cyan-400">Employee: {claimTargetInterval.empName}</div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Claim Category</label>
                <select
                  value={claimCategory}
                  onChange={(e) => setClaimCategory(e.target.value as TimeClaimItem["category"])}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white"
                >
                  <option value="Client Call">Client Call (Zoom / Offline Phone)</option>
                  <option value="Testing">Testing (Physical Hardware Devices)</option>
                  <option value="KT Session">KT Session (Knowledge Transfer / Mentoring)</option>
                  <option value="Design Whiteboard">Design Whiteboard & Architecture</option>
                  <option value="Power Outage">Power Outage / Network Glitch</option>
                  <option value="Meeting">Internal Physical Team Meeting</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Detailed Justification & Description</label>
                <textarea
                  rows={3}
                  value={claimReason}
                  onChange={(e) => setClaimReason(e.target.value)}
                  placeholder="Explain the work performed away from the workstation..."
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-sans focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setClaimModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold transition flex items-center gap-1.5 shadow-lg shadow-amber-600/30"
                >
                  <Send className="w-4 h-4" /> Submit Claim for Manager Approval
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: REJECT CLAIM WITH MANDATORY REASON
      ========================================================================= */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1322] border border-rose-500/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-400" />
                Reject Time Claim Request
              </h3>
              <button onClick={() => setRejectModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono">
              <p className="text-slate-300">
                Please enter a mandatory rejection reason. The employee will receive this feedback on their attendance portal.
              </p>

              <div>
                <label className="block text-slate-300 mb-1 font-bold">Mandatory Rejection Note</label>
                <textarea
                  rows={3}
                  value={rejectionNote}
                  onChange={(e) => setRejectionNote(e.target.value)}
                  placeholder="e.g. Activity logs indicate zero camera/audio or meeting invite conflict during this interval..."
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-sans focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!rejectionNote.trim()}
                  onClick={handleConfirmRejection}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:bg-rose-900 text-white font-bold transition flex items-center gap-1.5 shadow-lg shadow-rose-600/30"
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: 5-STEP CUSTOM REPORT BUILDER WIZARD
      ========================================================================= */}
      {reportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1322] border border-slate-700 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl">
            {/* Header & Steps */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-emerald-400" />
                  Custom Report Builder Wizard (Step {reportStep} of 5)
                </h3>
                <p className="text-xs text-slate-400">Design tailor-made compliance and productivity export feeds</p>
              </div>
              <button onClick={() => setReportModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step Indicators */}
            <div className="flex justify-between items-center text-xs font-mono border-b border-slate-800/80 pb-3">
              {[
                { s: 1, label: "Participants" },
                { s: 2, label: "Timeframe" },
                { s: 3, label: "Columns" },
                { s: 4, label: "Grouping" },
                { s: 5, label: "Export" },
              ].map((step) => (
                <div
                  key={step.s}
                  className={`flex items-center gap-1.5 ${
                    reportStep === step.s
                      ? "text-emerald-400 font-bold"
                      : reportStep > step.s
                      ? "text-cyan-400"
                      : "text-slate-500"
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                      reportStep === step.s
                        ? "bg-emerald-500 text-slate-950 font-black"
                        : reportStep > step.s
                        ? "bg-cyan-500/20 text-cyan-300"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {step.s}
                  </span>
                  <span>{step.label}</span>
                </div>
              ))}
            </div>

            {/* Step 1: Participants */}
            {reportStep === 1 && (
              <div className="space-y-3 text-xs font-mono">
                <label className="block text-slate-300 font-bold">Select Scope of Participants:</label>
                <div className="grid grid-cols-2 gap-3">
                  {["All Organization Users", "By Department (Development / QA / Sales)", "By Team (Core Platform / SRE)", "Specific Filtered Users"].map((opt, i) => (
                    <div
                      key={opt}
                      className={`p-3 rounded-xl border cursor-pointer transition ${
                        i === 0 ? "bg-emerald-950/40 border-emerald-500 text-white font-bold" : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700"
                      }`}
                    >
                      {opt}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Timeframe */}
            {reportStep === 2 && (
              <div className="space-y-3 text-xs font-mono">
                <label className="block text-slate-300 font-bold">Select Date Range:</label>
                <div className="grid grid-cols-3 gap-3">
                  {["Today (Live)", "Yesterday", "Current Week", "Last Week", "This Month", "Custom Date Range"].map((opt, i) => (
                    <div
                      key={opt}
                      className={`p-3 rounded-xl border cursor-pointer text-center transition ${
                        i === 4 ? "bg-emerald-950/40 border-emerald-500 text-white font-bold" : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700"
                      }`}
                    >
                      {opt}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Column Selection */}
            {reportStep === 3 && (
              <div className="space-y-3 text-xs font-mono">
                <label className="block text-slate-300 font-bold">Select Report Columns to Include:</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
                  {[
                    "Employee Name",
                    "Employee Code",
                    "Designation",
                    "Department",
                    "Team",
                    "Shift Schedule",
                    "Clock In Time",
                    "Clock Out Time",
                    "Total Work Hours",
                    "Productive Time",
                    "Idle Time",
                    "Away Time",
                    "Productivity %",
                    "Keystrokes Count",
                    "Mouse Clicks Count",
                    "Late Entry Time",
                    "Early Logout Time",
                    "Overtime Hours",
                    "Undertime Shortfall",
                  ].map((col) => {
                    const isChecked = selectedReportColumns.includes(col);
                    return (
                      <label
                        key={col}
                        className={`p-2.5 rounded-lg border flex items-center gap-2 cursor-pointer transition ${
                          isChecked ? "bg-emerald-950/30 border-emerald-500/50 text-white" : "bg-slate-900 border-slate-800 text-slate-400"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setSelectedReportColumns((prev) =>
                              prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
                            );
                          }}
                          className="rounded text-emerald-500"
                        />
                        <span className="truncate">{col}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 4: Grouping & Aggregation */}
            {reportStep === 4 && (
              <div className="space-y-3 text-xs font-mono">
                <label className="block text-slate-300 font-bold">Aggregation & Sorting Level:</label>
                <div className="grid grid-cols-2 gap-3">
                  {["Group By Employee (Summary Totals)", "Group By Day (Daily Breakdown)", "Group By Department", "Raw 10-Minute Slices"].map((opt, i) => (
                    <div
                      key={opt}
                      className={`p-3 rounded-xl border cursor-pointer transition ${
                        i === 0 ? "bg-emerald-950/40 border-emerald-500 text-white font-bold" : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700"
                      }`}
                    >
                      {opt}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 5: Export / Complete */}
            {reportStep === 5 && (
              <div className="space-y-4 text-xs font-mono text-center py-4">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                <h4 className="text-base font-bold text-white">Your Custom Report Is Ready!</h4>
                <p className="text-slate-400 max-w-md mx-auto">
                  Aggregated across 42 employees with {selectedReportColumns.length} customized telemetry columns.
                </p>
                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  <button className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/30">
                    <Download className="w-4 h-4" /> Download XLSX (Excel)
                  </button>
                  <button className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1.5 shadow-lg shadow-blue-600/30">
                    <Download className="w-4 h-4" /> Download CSV
                  </button>
                  <button className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center gap-1.5">
                    <Download className="w-4 h-4" /> Download PDF
                  </button>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center border-t border-slate-800 pt-3">
              <button
                type="button"
                disabled={reportStep === 1}
                onClick={() => setReportStep((s) => Math.max(1, s - 1) as typeof reportStep)}
                className="px-4 py-2 rounded-xl bg-slate-800 disabled:opacity-40 text-slate-300 hover:text-white transition text-xs font-mono"
              >
                Previous Step
              </button>

              {reportStep < 5 ? (
                <button
                  type="button"
                  onClick={() => setReportStep((s) => Math.min(5, s + 1) as typeof reportStep)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold font-mono transition flex items-center gap-1"
                >
                  Next Step <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setReportModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold font-mono transition"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
