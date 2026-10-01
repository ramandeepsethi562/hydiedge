"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Volume2,
  Play,
  Pause,
  Download,
  Calendar,
  Clock,
  Users,
  Smartphone,
  PieChart,
  BarChart3,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  FileText,
  Sliders,
  ExternalLink,
  MessageSquare,
  Shield,
  Layers,
  Sparkles,
} from "lucide-react";

interface CallLogItem {
  id: string;
  caller_name: string;
  phone_number: string;
  call_type: "INCOMING" | "OUTGOING" | "MISSED" | "REJECTED";
  call_time_utc: string;
  duration_seconds: number;
  audio_url?: string | null;
  notes?: string | null;
  review_status: string;
  employee_name?: string;
}

interface ScreenTimeItem {
  app_name: string;
  category: string;
  total_seconds: number;
}

interface SyncedContact {
  id: string;
  contact_name: string;
  phone_number: string;
  email?: string;
  synced_at_utc: string;
}

export default function HydiEdgeTelephonySuite() {
  const [activeTab, setActiveTab] = useState<
    "CALL_DASHBOARD" | "CALL_LOGS" | "SCREEN_TIME" | "CONTACTS" | "MEDIA_VAULT"
  >("CALL_DASHBOARD");

  const [dateRange, setDateRange] = useState<"TODAY" | "YESTERDAY" | "WEEK" | "MONTH">("TODAY");

  // Call Logs & Metrics State
  const [callLogs, setCallLogs] = useState<CallLogItem[]>([
    {
      id: "call-01",
      caller_name: "FinServe Sovereign UK",
      phone_number: "+44 20 7946 0192",
      call_type: "OUTGOING",
      call_time_utc: "Today, 10:24 AM",
      duration_seconds: 480,
      audio_url: "/api/v1/live/audio/stream",
      notes: "PCI-DSS quarterly compliance architecture audit review",
      review_status: "REVIEWED",
      employee_name: "Ramandeep",
    },
    {
      id: "call-02",
      caller_name: "Sophia Patel (Healthcare APAC)",
      phone_number: "+91 98765 43210",
      call_type: "INCOMING",
      call_time_utc: "Today, 11:45 AM",
      duration_seconds: 320,
      audio_url: "/api/v1/live/audio/stream",
      notes: "Field agent deployment timeline and GPS hardware rollout",
      review_status: "UNREVIEWED",
      employee_name: "Ramandeep",
    },
    {
      id: "call-03",
      caller_name: "David Vance",
      phone_number: "+1 (555) 345-6789",
      call_type: "MISSED",
      call_time_utc: "Today, 01:15 PM",
      duration_seconds: 0,
      audio_url: null,
      notes: "Incoming call during lunch interval",
      review_status: "UNREVIEWED",
      employee_name: "Vikram Malhotra",
    },
    {
      id: "call-04",
      caller_name: "Retail Ops Director",
      phone_number: "+1 (555) 901-2345",
      call_type: "INCOMING",
      call_time_utc: "Today, 02:40 PM",
      duration_seconds: 640,
      audio_url: "/api/v1/live/audio/stream",
      notes: "Discussed offline time claims and geofence auto-punch accuracy",
      review_status: "REVIEWED",
      employee_name: "Ramandeep",
    },
  ]);

  const [metrics, setMetrics] = useState({
    totalCalls: 42,
    connectedCalls: 36,
    missedCalls: 4,
    rejectedCalls: 2,
    avgDurationSec: 304,
    totalVideosCount: 142,
    totalPhotosCount: 1890,
  });

  // Screen Time State
  const [screenTime, setScreenTime] = useState<ScreenTimeItem[]>([
    { app_name: "WhatsApp Business", category: "PRODUCTIVE", total_seconds: 7200 },
    { app_name: "Google Chrome", category: "PRODUCTIVE", total_seconds: 4800 },
    { app_name: "YouTube", category: "NON_PRODUCTIVE", total_seconds: 3600 },
    { app_name: "Instagram", category: "NON_PRODUCTIVE", total_seconds: 1200 },
    { app_name: "Phone Dialler", category: "PRODUCTIVE", total_seconds: 2800 },
  ]);

  // Synced Contacts
  const [contacts, setContacts] = useState<SyncedContact[]>([
    {
      id: "con-01",
      contact_name: "David Miller (FinServe CTO)",
      phone_number: "+44 20 7946 0192",
      email: "david.miller@finserve.co.uk",
      synced_at_utc: "2026-10-01 08:30 UTC",
    },
    {
      id: "con-02",
      contact_name: "Sophia Patel (Healthcare Lead)",
      phone_number: "+91 98765 43210",
      email: "sophia.p@health-apac.org",
      synced_at_utc: "2026-10-01 08:30 UTC",
    },
    {
      id: "con-03",
      contact_name: "Corporate Support Dispatch",
      phone_number: "+1 (800) 555-0199",
      email: "dispatch@hydiedge.com",
      synced_at_utc: "2026-10-01 08:30 UTC",
    },
  ]);

  // Audio Player State
  const [activePlayingId, setActivePlayingId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [audioProgress, setAudioProgress] = useState<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch real data on mount
  useEffect(() => {
    fetch("/api/v1/mobile/call-logs")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.callLogs && Array.isArray(data.callLogs) && data.callLogs.length > 0) {
          setCallLogs(data.callLogs);
        }
        if (data?.metrics) {
          setMetrics(data.metrics);
        }
      })
      .catch(() => {});

    fetch("/api/v1/mobile/screen-time")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.screenTime && Array.isArray(data.screenTime) && data.screenTime.length > 0) {
          setScreenTime(data.screenTime);
        }
      })
      .catch(() => {});

    fetch("/api/v1/mobile/contacts")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.contacts && Array.isArray(data.contacts) && data.contacts.length > 0) {
          setContacts(data.contacts);
        }
      })
      .catch(() => {});
  }, []);

  const handleTogglePlay = (id: string, audioUrl?: string | null) => {
    if (!audioUrl) return;
    if (activePlayingId === id && isPlaying) {
      if (audioRef.current) audioRef.current.pause();
      setIsPlaying(false);
    } else {
      setActivePlayingId(id);
      setIsPlaying(true);
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.playbackRate = playbackSpeed;
        audioRef.current.play().catch(() => {});
      }
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  return (
    <div className="space-y-6">
      <audio
        ref={audioRef}
        onTimeUpdate={() => {
          if (audioRef.current && audioRef.current.duration) {
            setAudioProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          setAudioProgress(0);
        }}
      />

      {/* 1. Header Banner */}
      <div className="hydi-card p-5 border-blue-500/30 bg-gradient-to-r from-slate-950 via-[#0a1628] to-slate-950 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono text-xs font-bold border border-blue-500/30 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-blue-400" />
              HYDIEDGE TELEPHONY & CALL STUDIO
            </span>
            <span className="text-xs font-mono text-cyan-400">Real-Time Ingestion & Audio Playback</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
            Call Monitoring, Recording Player & Mobile App Usage
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl mt-0.5">
            Two-way call recording with speed controls, hourly distribution analysis, missed calls trends, and social media screen time audit.
          </p>
        </div>

        {/* Date Filter Pills */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs font-mono">
          {[
            { id: "TODAY", label: "Day" },
            { id: "YESTERDAY", label: "Yesterday" },
            { id: "WEEK", label: "Week" },
            { id: "MONTH", label: "Month" },
          ].map((d) => (
            <button
              key={d.id}
              onClick={() => setDateRange(d.id as typeof dateRange)}
              className={`px-3 py-1.5 rounded-lg transition ${
                dateRange === d.id ? "bg-blue-600 text-white font-bold shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Sub-Tab Navigation Bar */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {[
          { id: "CALL_DASHBOARD", label: "1. Call Analytics", icon: BarChart3 },
          { id: "CALL_LOGS", label: "2. Call Logs & Player", icon: Volume2 },
          { id: "SCREEN_TIME", label: "3. Mobile App Screen Time", icon: Smartphone },
          { id: "CONTACTS", label: "4. Synced Address Book", icon: Users },
          { id: "MEDIA_VAULT", label: "5. Mobile Media Vault", icon: FileText },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as typeof activeTab)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                isActive
                  ? "bg-blue-500/15 text-blue-300 border border-blue-500/40 shadow-sm"
                  : "bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* =========================================================================
          PANEL 1: TELEPHONY ANALYTICS DASHBOARD
      ========================================================================= */}
      {activeTab === "CALL_DASHBOARD" && (
        <div className="space-y-6">
          {/* Top 4 KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>Total Calls</span>
                <Phone className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-black text-white">{metrics.totalCalls} Calls</div>
              <div className="text-[11px] text-emerald-400 font-mono">
                {metrics.connectedCalls} Connected ({Math.round((metrics.connectedCalls / (metrics.totalCalls || 1)) * 100)}%)
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>Average Call Duration</span>
                <Clock className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-black text-cyan-300">
                {Math.floor(metrics.avgDurationSec / 60)}m {metrics.avgDurationSec % 60}s
              </div>
              <div className="text-[11px] text-slate-400 font-mono">Across inbound & outbound</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>Missed Calls</span>
                <PhoneMissed className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-2xl font-black text-rose-400">{metrics.missedCalls} Missed</div>
              <div className="text-[11px] text-amber-400 font-mono">Requires callback follow-up</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>Synced Media Vault</span>
                <FileText className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-emerald-300">
                {metrics.totalPhotosCount} Photos / {metrics.totalVideosCount} Vids
              </div>
              <div className="text-[11px] text-slate-400 font-mono">Direct server NVMe storage</div>
            </div>
          </div>

          {/* Hourly Call Timeline Bar & Stacked Distribution */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-400" />
                  Hourly Call Distribution (08:00 AM – 08:00 PM)
                </h3>
                <p className="text-xs text-slate-400">
                  Stacked volume of Outgoing (Blue), Incoming (Green), and Missed (Rose) calls.
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="flex items-center gap-1.5 text-blue-400">
                  <span className="w-3 h-3 rounded bg-blue-500" /> Outgoing
                </span>
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-3 h-3 rounded bg-emerald-500" /> Incoming
                </span>
                <span className="flex items-center gap-1.5 text-rose-400">
                  <span className="w-3 h-3 rounded bg-rose-500" /> Missed
                </span>
              </div>
            </div>

            {/* Stacked Chart Simulation */}
            <div className="h-56 w-full flex items-end justify-between gap-2 px-2 pt-6 bg-slate-950 rounded-xl border border-slate-800">
              {[
                { hour: "08:00", out: 2, inc: 1, mis: 0 },
                { hour: "09:00", out: 6, inc: 4, mis: 1 },
                { hour: "10:00", out: 12, inc: 8, mis: 1 },
                { hour: "11:00", out: 15, inc: 10, mis: 0 },
                { hour: "12:00", out: 8, inc: 6, mis: 2 },
                { hour: "13:00", out: 3, inc: 2, mis: 0 },
                { hour: "14:00", out: 14, inc: 9, mis: 1 },
                { hour: "15:00", out: 18, inc: 12, mis: 0 },
                { hour: "16:00", out: 11, inc: 7, mis: 1 },
                { hour: "17:00", out: 7, inc: 5, mis: 0 },
                { hour: "18:00", out: 4, inc: 2, mis: 0 },
              ].map((item) => {
                const total = item.out + item.inc + item.mis;
                const totalHeight = Math.min((total / 35) * 100, 100);
                return (
                  <div key={item.hour} className="flex-1 flex flex-col items-center gap-1.5 group">
                    <div className="text-[10px] font-mono text-white opacity-0 group-hover:opacity-100 transition">
                      {total}
                    </div>
                    <div className="w-full h-36 flex flex-col-reverse rounded-t overflow-hidden bg-slate-900">
                      <div style={{ height: `${(item.out / total) * totalHeight}%` }} className="bg-blue-500 w-full" />
                      <div style={{ height: `${(item.inc / total) * totalHeight}%` }} className="bg-emerald-500 w-full" />
                      <div style={{ height: `${(item.mis / total) * totalHeight}%` }} className="bg-rose-500 w-full" />
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">{item.hour}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          PANEL 2: CALL LOGS & IN-APP AUDIO PLAYER
      ========================================================================= */}
      {activeTab === "CALL_LOGS" && (
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-blue-400" />
                Live Call Logs & Recording Audio Player
              </h3>
              <p className="text-xs text-slate-400">
                Click Play to listen to the recorded conversation with speed controls (1x / 1.5x / 2x).
              </p>
            </div>
            {/* Speed Controls */}
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-1 text-xs font-mono">
              <span className="text-slate-400 px-2">Speed:</span>
              {[1.0, 1.5, 2.0].map((s) => (
                <button
                  key={s}
                  onClick={() => handleSpeedChange(s)}
                  className={`px-2 py-0.5 rounded transition ${
                    playbackSpeed === s ? "bg-blue-600 text-white font-bold" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950 text-slate-400 font-mono uppercase text-[10px]">
                <tr>
                  <th className="p-3">Staff</th>
                  <th className="p-3">Contact & Phone</th>
                  <th className="p-3">Call Type</th>
                  <th className="p-3">Time & Duration</th>
                  <th className="p-3">Audio Recording</th>
                  <th className="p-3">Notes & Review</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 font-mono">
                {callLogs.map((c) => {
                  const isCurrentPlaying = activePlayingId === c.id && isPlaying;
                  const mins = Math.floor(c.duration_seconds / 60);
                  const secs = c.duration_seconds % 60;
                  return (
                    <tr key={c.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-bold text-white">{c.employee_name || "Ramandeep"}</td>
                      <td className="p-3">
                        <div className="text-white font-bold">{c.caller_name}</div>
                        <div className="text-[11px] text-cyan-400">{c.phone_number}</div>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 w-max ${
                            c.call_type === "OUTGOING"
                              ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                              : c.call_type === "INCOMING"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          }`}
                        >
                          {c.call_type === "OUTGOING" ? (
                            <PhoneOutgoing className="w-3 h-3" />
                          ) : c.call_type === "INCOMING" ? (
                            <PhoneIncoming className="w-3 h-3" />
                          ) : (
                            <PhoneMissed className="w-3 h-3" />
                          )}
                          {c.call_type}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="text-white">{c.call_time_utc}</div>
                        <div className="text-[11px] text-slate-400">
                          {c.duration_seconds > 0 ? `${mins}m ${secs}s` : "0s (Missed)"}
                        </div>
                      </td>
                      <td className="p-3">
                        {c.audio_url ? (
                          <button
                            type="button"
                            onClick={() => handleTogglePlay(c.id, c.audio_url)}
                            className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition cursor-pointer ${
                              isCurrentPlaying
                                ? "bg-amber-500 text-slate-950 animate-pulse"
                                : "bg-blue-600 hover:bg-blue-500 text-white"
                            }`}
                          >
                            {isCurrentPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                            <span>{isCurrentPlaying ? "Pause Audio" : "Play Recording"}</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-500">No Audio</span>
                        )}
                      </td>
                      <td className="p-3 max-w-xs">
                        <div className="text-slate-300 text-[11px] font-sans truncate">{c.notes || "—"}</div>
                        <span className="text-[10px] text-cyan-400 font-mono">{c.review_status}</span>
                      </td>
                      <td className="p-3 text-right">
                        {c.audio_url && (
                          <a
                            href={c.audio_url}
                            download={`call-${c.id}.opus`}
                            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 inline-flex items-center"
                            title="Download Audio"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          PANEL 3: MOBILE APP SCREEN TIME (WhatsApp, YouTube, Chrome)
      ========================================================================= */}
      {activeTab === "SCREEN_TIME" && (
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-cyan-400" />
                Mobile Device App Screen Time (Android UsageStatsManager)
              </h3>
              <p className="text-xs text-slate-400">
                Audits exact minutes spent in non-work apps (YouTube, Social Media) versus business apps during working hours.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded bg-blue-500/20 text-blue-300 font-mono text-xs font-bold border border-blue-500/30">
              Live Android Telemetry Active
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3 font-mono text-xs">
              <h4 className="font-bold text-white mb-2">Application Usage Breakdown</h4>
              {screenTime.map((st) => {
                const hours = (st.total_seconds / 3600).toFixed(1);
                const isNonProd = st.category === "NON_PRODUCTIVE";
                return (
                  <div key={st.app_name} className="space-y-1">
                    <div className="flex justify-between items-center text-slate-300">
                      <span className="font-bold text-white">{st.app_name}</span>
                      <span className={isNonProd ? "text-rose-400" : "text-emerald-400"}>
                        {hours}h ({st.category})
                      </span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        style={{ width: `${Math.min((st.total_seconds / 7200) * 100, 100)}%` }}
                        className={`h-full rounded-full ${isNonProd ? "bg-rose-500" : "bg-emerald-500"}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 font-mono text-xs">
              <h4 className="font-bold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-rose-400" /> Mobile Usage Compliance Alerts
              </h4>
              <div className="space-y-2">
                <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px]">
                  <strong>YouTube Overuse Alert:</strong> Exceeded 1.0 hour limit during core work hours (09:00 - 18:00).
                </div>
                <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px]">
                  <strong>Instagram Social Alert:</strong> 20 minutes detected on personal account feed.
                </div>
                <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px]">
                  <strong>WhatsApp Business Compliance:</strong> 2.0 hours active client messaging logged.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          PANEL 4: SYNCED MOBILE CONTACTS DIRECTORY
      ========================================================================= */}
      {activeTab === "CONTACTS" && (
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                Synced Mobile Address Book Contacts
              </h3>
              <p className="text-xs text-slate-400">
                Audited list of phone contacts synced from corporate enrolled mobile devices.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">{contacts.length} Synced Contacts</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950 text-slate-400 font-mono uppercase text-[10px]">
                <tr>
                  <th className="p-3">Contact Name</th>
                  <th className="p-3">Phone Number</th>
                  <th className="p-3">Email Address</th>
                  <th className="p-3">Last Synced UTC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 font-mono">
                {contacts.map((con) => (
                  <tr key={con.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-bold text-white">{con.contact_name}</td>
                    <td className="p-3 text-cyan-300">{con.phone_number}</td>
                    <td className="p-3 text-slate-300">{con.email || "—"}</td>
                    <td className="p-3 text-slate-400">{con.synced_at_utc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          PANEL 5: MOBILE MEDIA VAULT
      ========================================================================= */}
      {activeTab === "MEDIA_VAULT" && (
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                Mobile Device Media Vault (Photos & Videos)
              </h3>
              <p className="text-xs text-slate-400">
                Synced photos and video clips captured by field agents stored on local server storage.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="w-full h-32 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 font-mono text-xs">
                  Photo_Proof_{i}.jpg
                </div>
                <div className="flex justify-between items-center text-[11px] font-mono text-slate-400">
                  <span>Visit #{i}</span>
                  <button className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                    <Download className="w-3 h-3" /> Save
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
