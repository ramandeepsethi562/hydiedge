"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Building2,
  Clock,
  ShieldAlert,
  Camera,
  Laptop,
  Users,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Server,
} from "lucide-react";

const ONBOARDING_STEPS = [
  { step: 1, title: "Organization & Tenant Region", desc: "Configure legal entity, AWS/MinIO S3 residency, and primary timezone." },
  { step: 2, title: "Work Schedules & Shifts", desc: "Define core hours, grace periods, overtime multipliers, and BPO shrinkage targets." },
  { step: 3, title: "8-State Time & Idle Engine", desc: "Configure idle thresholds (180s default), Personal Mode rules, and Away Reasons." },
  { step: 4, title: "Screenshots & WebRTC Live Monitor", desc: "Set capture frequency (1–3x/10min), privacy blur (SS-007), and retention TTL." },
  { step: 5, title: "6-Way Productivity Matrix", desc: "Map domain/app classifications & Level-2 window title regex overrides." },
  { step: 6, title: "11-Layer Endpoint DLP & USB Policy", desc: "Configure USB Hardware ID whitelist, clipboard/print blocks, and anti-jiggler AI." },
  { step: 7, title: "SCIM 2.0 Directory & HRIS Sync", desc: "Connect Okta, Azure Entra ID, Workday, BambooHR, Jira, and Slack." },
  { step: 8, title: "Desktop Agent Fleet Rollout", desc: "Generate MSI/PKG/DEB installers with embedded organization enrollment tokens." },
];

export default function OnboardingWizardPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [orgName, setOrgName] = useState("Acme Global Technologies Inc.");
  const [region, setRegion] = useState("eu-central-1 (Frankfurt — GDPR Strict)");
  const [idleThreshold, setIdleThreshold] = useState(180);
  const [ssFreq, setSsFreq] = useState("2 per 10 mins (Randomized)");
  const [privacyBlur, setPrivacyBlur] = useState(true);
  const [usbPolicy, setUsbPolicy] = useState("READ_ONLY_WHITELIST");

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 p-6 flex flex-col justify-between">
      {/* Header */}
      <div className="max-w-6xl w-full mx-auto flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-bold">H</div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold">Organization Onboarding Wizard</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                AUTH-005
              </span>
            </div>
            <p className="text-xs text-slate-400">8-Step Zero-Friction Enterprise Tenant Provisioning</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-xs text-slate-400 hover:text-white">
            ← Back to AUTH-001
          </Link>
          <Link
            href="/"
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5"
          >
            Launch Enterprise Console <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Wizard Body */}
      <div className="max-w-6xl w-full mx-auto my-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Stepper Sidebar */}
        <div className="lg:col-span-4 space-y-2">
          {ONBOARDING_STEPS.map((item) => {
            const active = item.step === currentStep;
            const completed = item.step < currentStep;
            return (
              <button
                key={item.step}
                onClick={() => setCurrentStep(item.step)}
                className={`w-full text-left p-3 rounded-xl border transition flex items-start gap-3 ${
                  active
                    ? "bg-blue-600/15 border-blue-500 text-white"
                    : completed
                    ? "bg-emerald-950/20 border-emerald-500/30 text-slate-200"
                    : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                    completed
                      ? "bg-emerald-500 text-slate-950"
                      : active
                      ? "bg-blue-500 text-white"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {completed ? "✓" : item.step}
                </div>
                <div>
                  <div className="text-xs font-semibold">{item.title}</div>
                  <div className="text-[11px] text-slate-400 line-clamp-1">{item.desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Step Configuration */}
        <div className="lg:col-span-8 hydi-card p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
              <div>
                <span className="text-xs font-mono text-blue-400">
                  STEP {currentStep} OF {ONBOARDING_STEPS.length} • AUTH-005
                </span>
                <h2 className="text-xl font-bold text-white mt-0.5">
                  {ONBOARDING_STEPS[currentStep - 1].title}
                </h2>
                <p className="text-xs text-slate-400 mt-1">{ONBOARDING_STEPS[currentStep - 1].desc}</p>
              </div>
              <Server className="w-7 h-7 text-blue-400" />
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Enterprise Tenant Name</label>
                  <input
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Data Residency & S3 Bucket Target (SA-5)</label>
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white"
                  >
                    <option>eu-central-1 (Frankfurt — GDPR Strict)</option>
                    <option>us-east-1 (N. Virginia — SOC2 Primary)</option>
                    <option>ap-south-1 (Mumbai — DPDP Compliant)</option>
                    <option>Customer BYOS S3 / On-Prem MinIO</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Idle Detection Threshold (Seconds)</label>
                  <input
                    type="number"
                    value={idleThreshold}
                    onChange={(e) => setIdleThreshold(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Screenshot Capture Policy (SS-006)</label>
                  <select
                    value={ssFreq}
                    onChange={(e) => setSsFreq(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white"
                  >
                    <option>1 per 10 mins (Low Bandwidth)</option>
                    <option>2 per 10 mins (Randomized)</option>
                    <option>3 per 10 mins (High Compliance)</option>
                  </select>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-white">Enable Sensitive App Privacy Blur (SS-007)</div>
                    <div className="text-[11px] text-slate-400">
                      Automatically blur banking, healthcare, password managers, and personal mode windows.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={privacyBlur}
                    onChange={(e) => setPrivacyBlur(e.target.checked)}
                    className="w-4 h-4 accent-blue-600"
                  />
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <div>
                    <div className="text-xs font-semibold text-white">Default USB Mass Storage Policy (DLP-004)</div>
                    <div className="text-[11px] text-slate-400">
                      Enforce kernel-level VID/PID hardware whitelist on Windows, macOS, and Linux agents.
                    </div>
                  </div>
                  <select
                    value={usbPolicy}
                    onChange={(e) => setUsbPolicy(e.target.value)}
                    className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-xs text-cyan-300 font-mono"
                  >
                    <option value="ALLOW_ALL">ALLOW_ALL</option>
                    <option value="READ_ONLY_WHITELIST">READ_ONLY_WHITELIST</option>
                    <option value="BLOCK_STORAGE">BLOCK_STORAGE</option>
                  </select>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/25 text-xs text-blue-200 flex items-center justify-between">
                <div>
                  <span className="font-semibold">Agent Enrollment Token Ready:</span>{" "}
                  <code className="font-mono text-cyan-300">hydi_enroll_live_99482a7c1f8b</code>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px]">
                  mTLS + SSL Pinning Active
                </span>
              </div>
            </div>
          </div>

          {/* Step Navigation Buttons */}
          <div className="flex items-center justify-between pt-6 mt-6 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
              disabled={currentStep === 1}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-semibold flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Previous Step
            </button>
            <div className="flex items-center gap-3">
              {currentStep < ONBOARDING_STEPS.length ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep((s) => Math.min(ONBOARDING_STEPS.length, s + 1))}
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  Save & Continue <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <Link
                  href="/"
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  Complete Provisioning & Launch HydiEms <CheckCircle2 className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl w-full mx-auto text-center text-xs text-slate-500">
        HydiEms Enterprise Provisioning Engine • PostgreSQL RLS + TimescaleDB + ClickHouse + MinIO S3
      </div>
    </div>
  );
}
