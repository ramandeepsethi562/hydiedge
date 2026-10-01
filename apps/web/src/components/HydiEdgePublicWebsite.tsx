"use client";

import React, { useState } from "react";
import {
  Shield,
  ShieldCheck,
  Zap,
  Users,
  Laptop,
  Clock,
  Activity,
  DollarSign,
  CheckCircle2,
  ArrowRight,
  Monitor,
  Camera,
  FileSpreadsheet,
  MapPin,
  Smartphone,
  Lock,
  Cpu,
  ChevronDown,
  Sparkles,
  Play,
  Download,
  Building2,
  Mail,
  Phone,
  HelpCircle,
  TrendingUp,
  Star,
  Award,
  Globe,
  Sliders,
  Check,
  X,
} from "lucide-react";

interface HydiEdgePublicWebsiteProps {
  onEnterApp?: () => void;
}

export default function HydiEdgePublicWebsite({ onEnterApp }: HydiEdgePublicWebsiteProps) {
  // Pricing Calculator State
  const [seats, setSeats] = useState<number>(25);
  const [billingCycle, setBillingCycle] = useState<"MONTHLY" | "ANNUAL">("ANNUAL");
  const [currency, setCurrency] = useState<"INR" | "USD">("INR");

  // Active Feature Tab
  const [activeFeatureTab, setActiveFeatureTab] = useState<number>(0);

  // Free Trial Modal State
  const [showTrialModal, setShowTrialModal] = useState<boolean>(false);
  const [trialPlan, setTrialPlan] = useState<string>("ENTERPRISE");
  const [trialCompanyName, setTrialCompanyName] = useState<string>("");
  const [trialContactName, setTrialContactName] = useState<string>("");
  const [trialEmail, setTrialEmail] = useState<string>("");
  const [trialPhone, setTrialPhone] = useState<string>("");
  const [trialPassword, setTrialPassword] = useState<string>("");
  const [trialSubmitting, setTrialSubmitting] = useState<boolean>(false);
  const [trialSuccessData, setTrialSuccessData] = useState<any | null>(null);

  // Buy Plan Modal State
  const [showBuyModal, setShowBuyModal] = useState<boolean>(false);
  const [buyPlan, setBuyPlan] = useState<string>("ENTERPRISE");
  const [buySuccess, setBuySuccess] = useState<boolean>(false);

  // Pricing Data
  const PRICING_TIERS = [
    {
      code: "STARTER",
      name: "Starter Essentials",
      tagline: "Essential time tracking, shift attendance & activity analytics",
      rateInr: 199,
      rateUsd: 2.99,
      isPopular: false,
      color: "blue",
      features: [
        "Deterministic 8-State Time Tracking",
        "Shift & Attendance Management",
        "Application & Website URL Tracking",
        "Employee Timesheets & Approvals",
        "Hardware Device Inventory",
        "Focus Time vs Context Switching",
        "Local NVMe Storage (30 Days)",
        "Standard Email Support",
      ],
    },
    {
      code: "PROFESSIONAL",
      name: "Professional Growth",
      tagline: "Proof of work with automated screenshots & agile project tracking",
      rateInr: 399,
      rateUsd: 5.99,
      isPopular: false,
      color: "emerald",
      features: [
        "Everything in Starter, plus:",
        "Automated Screenshots (Up to 10x/hr)",
        "Intelligent Privacy Blur & PII Masking",
        "Agile Projects, Kanban Boards & Sprints",
        "Bug Tracking & Custom Tracker Schemas",
        "Away Reason Prompts & Rollback",
        "Client Billing & Multi-Tier Pay Rates",
        "Local NVMe Storage (90 Days)",
        "Priority Support & SLA",
      ],
    },
    {
      code: "ENTERPRISE",
      name: "Enterprise Complete",
      tagline: "Live WebRTC streaming, 11-layer DLP & Precision Payroll Studio",
      rateInr: 699,
      rateUsd: 9.99,
      isPopular: true,
      color: "indigo",
      features: [
        "Everything in Professional, plus:",
        "30-FPS WebRTC Live Screen Streaming",
        "Office TV Operations Wallboard",
        "11-Layer Data Loss Prevention (DLP)",
        "USB Storage Whitelisting & Block",
        "Anti-Cheat Mouse Jiggler Detection",
        "Precision Payroll Studio with Formulas",
        "Inline Payslip Adjustments (Zero Batch Rerun)",
        "1-Click Corporate Bank Bulk Payout (.csv)",
        "BPO Shrinkage Real-Time Engine",
        "Machine-Based HWID Anti-Piracy Lock",
        "Local NVMe Storage (180 Days)",
      ],
    },
    {
      code: "ULTIMATE",
      name: "Ultimate Sovereign Suite",
      tagline: "Total monitoring, audio capture, Field GPS, MDM & HydiAI analytics",
      rateInr: 999,
      rateUsd: 14.99,
      isPopular: false,
      color: "purple",
      features: [
        "Everything in Enterprise, plus:",
        "Continuous Screen Recording Clips",
        "Microphone & Loopback Audio Tracking (Opus)",
        "Field Staff GPS Route Replay & Dwell",
        "Geofenced Jobsites with Auto-Attendance",
        "GPS Mileage Claims & Multi-Tier Approval",
        "Mobile Telephony & Call Logs Sync",
        "Corporate MDM Remote Device Lock",
        "HydiAI Flight-Risk & Burnout Predictor",
        "Natural Language Text-to-SQL Analytics",
        "Dedicated Account Manager & 24/7 SLA",
      ],
    },
  ];

  // Submit Free Trial Provisioning
  const handleFreeTrialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrialSubmitting(true);
    try {
      const res = await fetch("https://api.hydiedge.com/api/v1/public/free-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: trialCompanyName,
          contactName: trialContactName,
          workEmail: trialEmail,
          phone: trialPhone,
          password: trialPassword,
          companySize: seats,
          planCode: trialPlan,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTrialSuccessData(data);
      } else {
        alert(data.error || "Trial creation failed");
      }
    } catch (err) {
      alert("Error connecting to server. Please try again.");
    } finally {
      setTrialSubmitting(false);
    }
  };

  const calculateEffectiveRate = (baseRate: number) => {
    return billingCycle === "ANNUAL" ? Math.round(baseRate * 0.8) : baseRate;
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 selection:bg-blue-600 selection:text-white font-sans antialiased">
      {/* 1. TOP ANNOUNCEMENT BANNER */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-600 to-purple-700 text-white px-4 py-2 text-center text-xs font-semibold flex items-center justify-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
        <span>
          HydiEdge 2026 Enterprise Release is Live! Full Jesto-Parity Payroll, WebRTC Live TV & HWID Anti-Piracy Protection.
        </span>
        <button
          onClick={() => {
            setTrialPlan("ENTERPRISE");
            setShowTrialModal(true);
          }}
          className="underline font-bold hover:text-amber-200 cursor-pointer"
        >
          Claim 7-Day Free Trial →
        </button>
      </div>

      {/* 2. NAVIGATION BAR */}
      <nav className="sticky top-0 z-40 bg-[#070b14]/90 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-white">HydiEdge</span>
              <span className="ml-1.5 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                ENTERPRISE
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-7 text-xs font-semibold text-slate-300">
            <a href="#features" className="hover:text-white transition">Features</a>
            <a href="#payroll" className="hover:text-white transition">Payroll Studio</a>
            <a href="#security" className="hover:text-white transition">11-Layer DLP</a>
            <a href="#pricing" className="hover:text-white transition">Pricing</a>
            <a href="#anti-piracy" className="hover:text-white transition">HWID Anti-Piracy</a>
            <a href="#faq" className="hover:text-white transition">FAQ</a>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onEnterApp}
              className="text-xs font-semibold text-slate-300 hover:text-white px-3 py-2 rounded-lg hover:bg-slate-800 transition"
            >
              Sign In to Console
            </button>
            <button
              onClick={() => {
                setTrialPlan("ENTERPRISE");
                setShowTrialModal(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-500/25 transition cursor-pointer"
            >
              Start 7-Day Free Trial
            </button>
          </div>
        </div>
      </nav>

      {/* 3. HERO SECTION */}
      <section className="relative pt-16 pb-20 px-4 overflow-hidden">
        {/* Glow ambient background effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-gradient-to-tr from-blue-600/15 via-indigo-500/15 to-purple-600/15 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-700/80 text-xs text-slate-300 mb-6 shadow-inner">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-white">HydiEdge v2.5 Release</span>
            <span className="text-slate-500">•</span>
            <span className="text-indigo-300">Hardware-Bound Anti-Piracy & 7-Day Trial</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.15]">
            Unified Workforce Intelligence, Real-Time Monitoring &{" "}
            <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
              Precision Payroll
            </span>
          </h1>

          <p className="mt-5 text-base sm:text-lg text-slate-300 max-w-3xl mx-auto leading-relaxed">
            Eliminate productivity blind spots, prevent corporate data leaks with 11-layer DLP, stream 30-FPS WebRTC screens, track field staff with GPS geofencing, and process zero-error payroll with instant corporate bank disbursement.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <button
              onClick={() => {
                setTrialPlan("ENTERPRISE");
                setShowTrialModal(true);
              }}
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-400 text-white text-sm font-bold shadow-xl shadow-blue-600/30 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              Start 7-Day Free Trial <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onEnterApp}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 text-sm font-semibold border border-slate-700/80 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Play className="w-4 h-4 text-cyan-400 fill-cyan-400/20" /> Explore Live Enterprise Demo
            </button>
          </div>

          <div className="mt-4 text-xs text-slate-400 flex items-center justify-center gap-4">
            <span className="flex items-center gap-1"><Check className="w-3.5 h-3.5 text-emerald-400" /> No Credit Card Required</span>
            <span className="flex items-center gap-1"><Check className="w-3.5 h-3.5 text-emerald-400" /> Instant Tenant Provisioning</span>
            <span className="flex items-center gap-1"><Check className="w-3.5 h-3.5 text-emerald-400" /> Machine HWID Binding Protection</span>
          </div>

          {/* Social Proof Numbers */}
          <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto border-t border-slate-800/80 pt-8">
            <div>
              <div className="text-2xl sm:text-3xl font-black text-white">250,000+</div>
              <div className="text-xs text-slate-400 mt-1">Endpoints Monitored</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-blue-400">99.99%</div>
              <div className="text-xs text-slate-400 mt-1">System Uptime SLA</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-400">11 Layers</div>
              <div className="text-xs text-slate-400 mt-1">DLP & Anti-Cheat Protection</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-purple-400">0 Errors</div>
              <div className="text-xs text-slate-400 mt-1">Precision Payroll Engine</div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. INTERACTIVE FEATURE SUITE SHOWCASE */}
      <section id="features" className="py-16 px-4 bg-slate-950/60 border-y border-slate-800/60">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <span className="text-xs font-mono uppercase tracking-wider text-indigo-400 font-bold">
              Core Capabilities
            </span>
            <h2 className="text-3xl font-black text-white mt-1">
              Everything Your Organization Needs in One Unified Engine
            </h2>
            <p className="text-xs text-slate-400 mt-2">
              Replace 6 fragmented tools (Time tracking, screenshot monitor, DLP agent, payroll software, GPS field tracker, and MDM) with HydiEdge.
            </p>
          </div>

          {/* Feature Navigation Tabs */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {[
              { label: "Live WebRTC Streaming & TV", icon: Monitor },
              { label: "8-State Time & BPO Shrinkage", icon: Clock },
              { label: "11-Layer DLP & Anti-Cheat", icon: ShieldCheck },
              { label: "Precision Payroll Studio", icon: FileSpreadsheet },
              { label: "Field Staff GPS & Geofencing", icon: MapPin },
              { label: "HWID Anti-Piracy Binding", icon: Cpu },
            ].map((tab, idx) => {
              const Icon = tab.icon;
              return (
                <button
                  key={idx}
                  onClick={() => setActiveFeatureTab(idx)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activeFeatureTab === idx
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25 border border-blue-400/30"
                      : "bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Feature Tab Content Preview */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
            {activeFeatureTab === 0 && (
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 text-xs font-mono">
                    <Monitor className="w-3.5 h-3.5" /> Zero Lag 30-FPS Video
                  </div>
                  <h3 className="text-2xl font-black text-white">
                    Live WebRTC Screen Streaming & Office TV Wallboard
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Watch employee screens live with sub-second latency over WebRTC. Switch between Tiny, Small, Medium, and Large grids, or launch full-screen auto-rotating Office TV wallboards for operations control centers.
                  </p>
                  <ul className="space-y-2 text-xs text-slate-300">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Full-Screen 30-FPS WebRTC with TURN/STUN NAT traversal</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> 2-FPS WebP over WebSocket automatic fallback for strict corporate firewalls</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Multi-monitor support (Monitors 1, 2, 3)</li>
                  </ul>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 font-mono text-xs">
                  <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-2">
                    <span>LIVEKIT ROOM: room-ops-blr</span>
                    <span className="text-emerald-400">● 30 FPS STREAMING</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
                      <div className="text-white font-bold">Ramandeep S. (Admin)</div>
                      <div className="text-cyan-400">Visual Studio Code</div>
                      <div className="text-slate-400 mt-1">98% Productive • Active</div>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
                      <div className="text-white font-bold">Priya Sharma</div>
                      <div className="text-cyan-400">Figma Design Studio</div>
                      <div className="text-slate-400 mt-1">94% Productive • Active</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeFeatureTab === 1 && (
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/10 text-amber-400 text-xs font-mono">
                    <Clock className="w-3.5 h-3.5" /> Deterministic 8-State Classification
                  </div>
                  <h3 className="text-2xl font-black text-white">
                    Deterministic Time Engine & BPO Shrinkage Calculator
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Classify every second into 8 deterministic states: Working, Productive, Non-Productive, Neutral, No-Impact, Idle, Away, and Offline. Calculate internal and external BPO shrinkage in real-time.
                  </p>
                  <ul className="space-y-2 text-xs text-slate-300">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Anti-idle detection with Zoom/Teams audio protection</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Real-time BPO shrinkage formula: (Shrinkage Hrs / Planned Hrs) × 100</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Attendance regularization & manager approval chains</li>
                  </ul>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 font-mono text-xs">
                  <div className="text-slate-400 border-b border-slate-800 pb-2">TIME ENGINE BREAKDOWN</div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-slate-300">
                      <span>Productive (Code/Jira/Docs)</span>
                      <span className="text-emerald-400 font-bold">6h 45m (84.4%)</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-300">
                      <span>Idle / Away (Tea/Lunch)</span>
                      <span className="text-amber-400 font-bold">55m (11.5%)</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-300">
                      <span>BPO Shrinkage Index</span>
                      <span className="text-cyan-400 font-bold">4.1% (Ideal &lt; 8%)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeFeatureTab === 2 && (
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-500/10 text-red-400 text-xs font-mono">
                    <ShieldCheck className="w-3.5 h-3.5" /> 11-Layer Endpoint Defense
                  </div>
                  <h3 className="text-2xl font-black text-white">
                    11-Layer Data Loss Prevention & Anti-Cheat Detection
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Protect intellectual property with hardware USB storage locks, file transfer blocking, cloud upload inspection, and automated detection of physical/software mouse jigglers.
                  </p>
                  <ul className="space-y-2 text-xs text-slate-300">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> USB Hardware ID whitelisting and read-only mode</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Anti-Cheat: mouse jiggler, stuck key & auto-clicker detection</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Tamper-evident SHA-256 hash-chained immutable audit log</li>
                  </ul>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5 font-mono text-xs">
                  <div className="text-red-400 border-b border-slate-800 pb-2">SECURITY EVENT FEED</div>
                  <div className="bg-red-950/40 border border-red-800 p-2.5 rounded text-[11px]">
                    <div className="font-bold text-red-300">BLOCKED: Unauthorized USB Storage</div>
                    <div className="text-slate-400 mt-0.5">Device: SanDisk Ultra 64GB (VID: 0781, PID: 5581)</div>
                  </div>
                  <div className="bg-amber-950/40 border border-amber-800 p-2.5 rounded text-[11px]">
                    <div className="font-bold text-amber-300">ALERT: Repetitive Mouse Jiggler Trajectory</div>
                    <div className="text-slate-400 mt-0.5">Pattern: 120 RPM sinusoidal circular movement</div>
                  </div>
                </div>
              </div>
            )}

            {activeFeatureTab === 3 && (
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 text-xs font-mono">
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Full Jesto Parity
                  </div>
                  <h3 className="text-2xl font-black text-white">
                    Precision Payroll Studio with Custom Formulas
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Custom earning/deduction formula engine, salary structure bulk assignment, inline payslip adjustments without batch reruns, and 1-click corporate bank payout file generator.
                  </p>
                  <ul className="space-y-2 text-xs text-slate-300">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Custom formula engine: CTC * 0.50, BASIC * 0.40, slab-based TDS</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Inline Payslip Adjustments: LOP days, bonus, withholding in-place</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> 1-Click Corporate Bank Bulk Payout File (.csv format)</li>
                  </ul>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5 font-mono text-xs">
                  <div className="text-emerald-400 border-b border-slate-800 pb-2">PAY RUN DISBURSEMENT ENGINE</div>
                  <div className="bg-slate-900 p-2.5 rounded border border-slate-800 text-[11px]">
                    <div className="text-white font-bold">September 2026 Pay Run (5 Payslips)</div>
                    <div className="text-slate-400">Total Net Disbursed: ₹841,250.00</div>
                    <div className="text-cyan-400 mt-1">Bank Payout File: bank_disbursement_sep2026.csv</div>
                  </div>
                </div>
              </div>
            )}

            {activeFeatureTab === 4 && (
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-cyan-500/10 text-cyan-400 text-xs font-mono">
                    <MapPin className="w-3.5 h-3.5" /> Real-Time GPS Tracking
                  </div>
                  <h3 className="text-2xl font-black text-white">
                    Field Workforce GPS Tracking & Geofenced Jobsites
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Track field staff live with route replays, dwell times, and circular/polygon geofences. Auto-punch attendance upon entry and calculate exact fuel mileage claims.
                  </p>
                  <ul className="space-y-2 text-xs text-slate-300">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Circular & polygon geofenced client sites with Haversine detection</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Client Visit Outcome Notes with selfie proof photo</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Automated GPS mileage calculation preventing falsified travel claims</li>
                  </ul>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5 font-mono text-xs">
                  <div className="text-cyan-400 border-b border-slate-800 pb-2">LIVE GPS TELEMETRY</div>
                  <div className="bg-slate-900 p-2.5 rounded border border-slate-800 text-[11px]">
                    <div className="text-white font-bold">Field Rep: Amit Saxena</div>
                    <div className="text-slate-400">Speed: 42 km/h • Traveled: 38.4 km</div>
                    <div className="text-emerald-400 mt-1">Inside Geofence: Apex Global HQ (Connaught Place)</div>
                  </div>
                </div>
              </div>
            )}

            {activeFeatureTab === 5 && (
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-purple-500/10 text-purple-400 text-xs font-mono">
                    <Cpu className="w-3.5 h-3.5" /> Anti-Piracy Architecture
                  </div>
                  <h3 className="text-2xl font-black text-white">
                    Machine-Based HWID Anti-Piracy & Seat Quota Binding
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Protect your commercial investment and enterprise fleet. HydiEdge binds every desktop agent install to the machine’s physical CPU ID, Motherboard UUID, and primary MAC address.
                  </p>
                  <ul className="space-y-2 text-xs text-slate-300">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Cryptographic HMAC-SHA256 hardware certificate issued on setup</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Strict seat enforcement: prevents rogue cloned VMs or folder copies</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> 1-Click SuperAdmin Device Revocation to reallocate seats instantly</li>
                  </ul>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5 font-mono text-xs">
                  <div className="text-purple-400 border-b border-slate-800 pb-2">HWID CERTIFICATE ISSUED</div>
                  <div className="bg-slate-900 p-2.5 rounded border border-slate-800 text-[11px]">
                    <div className="text-white font-bold">Device: DEV-DESKTOP-01 (Ramandeep)</div>
                    <div className="text-slate-400 font-mono text-[10px]">
                      HWID: a9f8e4c7...b2e104 (Bound to Seat 1 of 25)
                    </div>
                    <div className="text-emerald-400 mt-1">● CERTIFICATE VALID • CLONING BLOCKED</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 5. INTERACTIVE PER-USER PRICING CALCULATOR (THE SELLING SYSTEM) */}
      <section id="pricing" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-mono uppercase tracking-wider text-blue-400 font-bold">
              Transparent Per-User Pricing
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white mt-1">
              Choose the Perfect Plan for Your Team
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-2">
              Every plan includes a 7-day free trial with full feature access and zero credit card required.
            </p>

            {/* Billing Controls */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-6">
              {/* Currency Toggle */}
              <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-bold">
                <button
                  onClick={() => setCurrency("INR")}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    currency === "INR" ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  ₹ INR (India)
                </button>
                <button
                  onClick={() => setCurrency("USD")}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    currency === "USD" ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  $ USD (Global)
                </button>
              </div>

              {/* Monthly vs Annual Toggle */}
              <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-bold">
                <button
                  onClick={() => setBillingCycle("MONTHLY")}
                  className={`px-3.5 py-1.5 rounded-lg transition ${
                    billingCycle === "MONTHLY"
                      ? "bg-blue-600 text-white shadow"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Monthly Billing
                </button>
                <button
                  onClick={() => setBillingCycle("ANNUAL")}
                  className={`px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                    billingCycle === "ANNUAL"
                      ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Annual Billing
                  <span className="px-1.5 py-0.5 text-[10px] rounded bg-emerald-950 text-emerald-300 font-extrabold border border-emerald-700">
                    Save 20%
                  </span>
                </button>
              </div>
            </div>

            {/* Seats Slider */}
            <div className="mt-8 max-w-xl mx-auto bg-slate-900/90 p-4 rounded-2xl border border-slate-800 shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-blue-400" /> Team Size:
                </span>
                <span className="text-sm font-black text-white font-mono bg-blue-600/20 text-blue-300 px-3 py-0.5 rounded-full border border-blue-500/30">
                  {seats} Users / Seats
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="500"
                step="5"
                value={seats}
                onChange={(e) => setSeats(Number(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1.5">
                <span>5 Seats</span>
                <span>50 Seats</span>
                <span>150 Seats</span>
                <span>500+ Enterprise</span>
              </div>
            </div>
          </div>

          {/* Pricing Cards Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PRICING_TIERS.map((tier) => {
              const baseRate = currency === "USD" ? tier.rateUsd : tier.rateInr;
              const effectiveRate = calculateEffectiveRate(baseRate);
              const monthlySubtotal = effectiveRate * seats;
              const symbol = currency === "USD" ? "$" : "₹";

              return (
                <div
                  key={tier.code}
                  className={`relative bg-slate-900/90 rounded-2xl p-6 flex flex-col justify-between border transition shadow-xl ${
                    tier.isPopular
                      ? "border-blue-500/80 shadow-blue-500/15 ring-2 ring-blue-500/30"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  {tier.isPopular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-[10px] font-black uppercase tracking-wider text-white shadow-lg">
                      Most Popular Plan
                    </div>
                  )}

                  <div>
                    <h3 className="text-lg font-black text-white">{tier.name}</h3>
                    <p className="text-[11px] text-slate-400 mt-1 min-h-[32px]">{tier.tagline}</p>

                    <div className="mt-5 pb-5 border-b border-slate-800">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-white">
                          {symbol}{effectiveRate}
                        </span>
                        <span className="text-xs text-slate-400">/ user / mo</span>
                      </div>
                      {billingCycle === "ANNUAL" && (
                        <div className="text-[10px] text-emerald-400 font-mono mt-0.5">
                          Save 20% with annual commitment
                        </div>
                      )}

                      <div className="mt-3 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
                        <div className="text-[10px] text-slate-400">For {seats} users:</div>
                        <div className="text-sm font-bold text-white font-mono">
                          {symbol}{monthlySubtotal.toLocaleString("en-IN")}/month
                        </div>
                        {billingCycle === "ANNUAL" && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            ({symbol}{(monthlySubtotal * 12).toLocaleString("en-IN")}/year billed annually)
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Features List */}
                    <ul className="mt-5 space-y-2.5 text-xs text-slate-300">
                      {tier.features.map((feat, fidx) => (
                        <li key={fidx} className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-8 space-y-2">
                    <button
                      onClick={() => {
                        setTrialPlan(tier.code);
                        setShowTrialModal(true);
                      }}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        tier.isPopular
                          ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25"
                          : "bg-slate-800 hover:bg-slate-700 text-slate-200"
                      }`}
                    >
                      Start 7-Day Free Trial
                    </button>
                    <button
                      onClick={() => {
                        setBuyPlan(tier.code);
                        setShowBuyModal(true);
                      }}
                      className="w-full py-2 rounded-xl text-[11px] font-semibold text-slate-400 hover:text-white hover:bg-slate-800/60 transition cursor-pointer"
                    >
                      Buy Now →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 6. SECURITY & ANTI-PIRACY SECTION */}
      <section id="anti-piracy" className="py-16 px-4 bg-slate-950/80 border-t border-slate-800/80">
        <div className="max-w-5xl mx-auto">
          <div className="bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-900/40 rounded-3xl p-8 sm:p-10 shadow-2xl flex flex-col md:flex-row items-center gap-8">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0 shadow-lg">
              <Cpu className="w-8 h-8 text-indigo-400" />
            </div>
            <div className="space-y-3">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Hardware-Bound Piracy Defense
              </span>
              <h3 className="text-2xl font-black text-white">
                Machine-Based Hardware Binding (Anti-Piracy Architecture)
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                When you deploy HydiEdge across your organization, our setup engine computes a hardware hash of the CPU ID, Motherboard UUID, and primary MAC address. The desktop agent is cryptographically bound to that physical workstation, preventing cloned virtual machines, unauthorized license duplication, or seat quota leakage.
              </p>
              <div className="flex flex-wrap gap-4 text-xs font-mono text-slate-400 pt-1">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" /> HMAC-SHA256 HWID Tokens
                </span>
                <span className="flex items-center gap-1.5 text-cyan-400">
                  <Laptop className="w-3.5 h-3.5" /> 1-Click SuperAdmin Device Reallocation
                </span>
                <span className="flex items-center gap-1.5 text-purple-400">
                  <Lock className="w-3.5 h-3.5" /> Cloned VM Block
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. FAQ SECTION */}
      <section id="faq" className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <span className="text-xs font-mono uppercase tracking-wider text-blue-400 font-bold">Got Questions?</span>
            <h2 className="text-3xl font-black text-white mt-1">Frequently Asked Questions</h2>
          </div>

          <div className="space-y-3.5">
            {[
              {
                q: "How does the 7-day free trial work?",
                a: "You get full, unrestricted access to the complete HydiEdge suite for 7 days. Zero credit card is required to sign up. Your organization and SuperAdmin license key are provisioned instantly upon submitting the trial form.",
              },
              {
                q: "What is machine-based authentication?",
                a: "To prevent software piracy and rogue installs, the HydiEdge desktop agent binds to the workstation's physical hardware identity (CPU serial, Motherboard UUID, and MAC address). This ensures your purchased seats are only used on company-authorized machines.",
              },
              {
                q: "Can I upgrade or add seats later?",
                a: "Yes! You can add or reallocate seats at any time directly through the SuperAdmin Licensing Studio. Adding seats takes effect immediately without reinstalling the desktop agent.",
              },
              {
                q: "Where is our monitoring and employee data stored?",
                a: "All database records, high-velocity ClickHouse telemetry, and MinIO NVMe object screenshots/recordings are securely hosted on your dedicated private cluster. No data is shared with third parties or external clouds.",
              },
              {
                q: "How does the Jesto-parity Payroll Studio work?",
                a: "Our payroll engine supports custom mathematical formulas (e.g. CTC * 0.50, BASIC * 0.40), inline payslip adjustments for LOP and bonuses without rerunning batches, and 1-click corporate bank bulk disbursement (.csv format).",
              },
            ].map((faq, idx) => (
              <div key={idx} className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-1.5">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-blue-400" /> {faq.q}
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed pl-6">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. FOOTER */}
      <footer className="bg-slate-950 border-t border-slate-800/80 py-12 px-4 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-white">HydiEdge Enterprise</span>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#pricing" className="hover:text-white">Pricing</a>
            <a href="#security" className="hover:text-white">Security & Compliance</a>
            <a href="#anti-piracy" className="hover:text-white">Anti-Piracy</a>
            <button onClick={onEnterApp} className="hover:text-white">Enterprise Console</button>
          </div>

          <div>
            © 2026 HydiEdge Enterprise. All rights reserved. Real Live MySQL & NVMe Storage.
          </div>
        </div>
      </footer>

      {/* 9. FREE TRIAL PROVISIONING MODAL */}
      {showTrialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Start Your 7-Day Free Trial</h3>
                  <p className="text-[10px] text-slate-400">No Credit Card • Instant Workspace Provisioning</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowTrialModal(false);
                  setTrialSuccessData(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {trialSuccessData ? (
              <div className="p-6 space-y-4 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-lg font-black text-white">Your 7-Day Free Trial is Active!</h4>
                <p className="text-xs text-slate-300">
                  We have provisioned your enterprise workspace for <strong>{trialSuccessData.organization.name}</strong>.
                </p>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-left font-mono text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">License Key:</span>
                    <span className="text-cyan-400 font-bold">{trialSuccessData.credentials.licenseKey}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Admin Email:</span>
                    <span className="text-white">{trialSuccessData.credentials.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Licensed Seats:</span>
                    <span className="text-white">{trialSuccessData.credentials.seatLimit} Users</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Trial Valid Until:</span>
                    <span className="text-amber-400">{new Date(trialSuccessData.trialEndsAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    onClick={onEnterApp}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold shadow-lg"
                  >
                    Open Enterprise Dashboard Now →
                  </button>
                  <a
                    href="https://hydiedge.com/downloads/HydiEdge.Setup.exe"
                    className="w-full py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold hover:bg-slate-700 flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" /> Download Desktop Agent (.exe)
                  </a>
                </div>
              </div>
            ) : (
              <form onSubmit={handleFreeTrialSubmit} className="p-5 space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Company Legal Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Global Logistics"
                    value={trialCompanyName}
                    onChange={(e) => setTrialCompanyName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Admin Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rajesh Mehra"
                      value={trialContactName}
                      onChange={(e) => setTrialContactName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Work Email</label>
                    <input
                      type="email"
                      required
                      placeholder="rajesh@acmeglobal.in"
                      value={trialEmail}
                      onChange={(e) => setTrialEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Phone Number</label>
                    <input
                      type="tel"
                      required
                      placeholder="+91 98110 23456"
                      value={trialPhone}
                      onChange={(e) => setTrialPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Admin Password</label>
                    <input
                      type="password"
                      required
                      placeholder="Min 6 characters"
                      value={trialPassword}
                      onChange={(e) => setTrialPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Selected Plan Tier</label>
                  <select
                    value={trialPlan}
                    onChange={(e) => setTrialPlan(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="STARTER">Starter Essentials (₹199 / user / mo)</option>
                    <option value="PROFESSIONAL">Professional Growth (₹399 / user / mo)</option>
                    <option value="ENTERPRISE">Enterprise Complete (₹699 / user / mo) — Recommended</option>
                    <option value="ULTIMATE">Ultimate Suite (₹999 / user / mo)</option>
                  </select>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 7 Days of Free Unrestricted Access
                  </div>
                  <div>Your plan includes {seats} users with full live monitoring, payroll, and 11-layer DLP.</div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowTrialModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={trialSubmitting}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-500/20"
                  >
                    {trialSubmitting ? "Provisioning..." : "Launch 7-Day Free Trial"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 10. BUY PLAN / CHECKOUT MODAL */}
      {showBuyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Purchase {buyPlan} License</h3>
              </div>
              <button
                onClick={() => setShowBuyModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Plan:</span>
                  <span className="text-white font-bold">{buyPlan}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Seats:</span>
                  <span className="text-white font-bold">{seats} Users</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Billing Cycle:</span>
                  <span className="text-white font-bold">{billingCycle} (20% Discount)</span>
                </div>
                <div className="flex justify-between text-slate-400 border-t border-slate-800 pt-2">
                  <span>Total Amount ({currency}):</span>
                  <span className="text-emerald-400 font-bold text-sm">
                    {currency === "USD" ? "$" : "₹"}
                    {(
                      (billingCycle === "ANNUAL"
                        ? Math.round((currency === "USD" ? 9.99 : 699) * 0.8) * seats * 12
                        : (currency === "USD" ? 9.99 : 699) * seats)
                    ).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-300">
                Choose your payment method:
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    alert("Redirecting to Razorpay / Corporate NetBanking gateway...");
                    setShowBuyModal(false);
                  }}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-blue-500 font-semibold text-center text-slate-200 transition"
                >
                  Corporate NetBanking / UPI
                </button>
                <button
                  type="button"
                  onClick={() => {
                    alert("Invoice generated! Bank transfer NEFT details sent to your registered billing email.");
                    setShowBuyModal(false);
                  }}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-blue-500 font-semibold text-center text-slate-200 transition"
                >
                  Wire / NEFT Invoice
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowBuyModal(false)}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold mt-2"
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
