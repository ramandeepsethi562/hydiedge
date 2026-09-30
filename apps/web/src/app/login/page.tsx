"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  KeyRound,
  Lock,
  Fingerprint,
  Building2,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Globe,
  Laptop,
} from "lucide-react";

export default function LoginPage() {
  const [activeScreen, setActiveScreen] = useState<"AUTH-001" | "AUTH-002" | "AUTH-003" | "AUTH-004">("AUTH-001");
  const [email, setEmail] = useState("admin@acme-enterprise.io");
  const [password, setPassword] = useState("••••••••••••••");
  const [totpCode, setTotpCode] = useState("482910");
  const [ssoDomain, setSsoDomain] = useState("acme-enterprise.okta.com");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleAction = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 4000);
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col justify-between p-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between max-w-7xl w-full mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center font-bold text-lg shadow-lg shadow-blue-500/20">
            H
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight">HydiEms</span>
              <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
                v2.5 Enterprise
              </span>
            </div>
            <p className="text-xs text-slate-400">Zero-Trust Identity & Multi-Tenant SSO Gateway</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(["AUTH-001", "AUTH-002", "AUTH-003", "AUTH-004"] as const).map((scr) => (
            <button
              key={scr}
              onClick={() => setActiveScreen(scr)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition ${
                activeScreen === scr
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                  : "bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700"
              }`}
            >
              {scr}
            </button>
          ))}
          <Link
            href="/onboarding"
            className="px-3 py-1.5 rounded-lg text-xs font-mono bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30"
          >
            AUTH-005 Onboarding →
          </Link>
          <Link
            href="/"
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5"
          >
            Enter Platform Shell <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Main Auth Container */}
      <div className="max-w-5xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center my-8">
        {/* Left Security Posture Overview */}
        <div className="lg:col-span-6 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs">
            <ShieldCheck className="w-4 h-4" /> SOC2 Type II • ISO 27001 • GDPR • HIPAA Ready
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
            Enterprise Workforce Intelligence &{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">
              11-Layer Endpoint Security
            </span>
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Authenticate via SAML 2.0 / OIDC (Okta, Azure Entra ID, Google Workspace, PingIdentity),
            enforce hardware FIDO2/WebAuthn & TOTP 2FA, and verify Desktop Agent mTLS device posture.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="hydi-card p-3.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-400">
                <Lock className="w-4 h-4" /> RS256 JWT + Redis JTI
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                15-minute short-lived access tokens with instant Redis session revocation.
              </p>
            </div>
            <div className="hydi-card p-3.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                <Fingerprint className="w-4 h-4" /> Adaptive MFA & Geo-IP
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Step-up TOTP & WebAuthn prompts on untrusted ASN or impossible travel.
              </p>
            </div>
          </div>
        </div>

        {/* Right Interactive Auth Card */}
        <div className="lg:col-span-6">
          <div className="hydi-card p-6 sm:p-8 shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
              <div>
                <span className="text-[11px] font-mono text-blue-400 uppercase">{activeScreen}</span>
                <h2 className="text-lg font-bold text-white">
                  {activeScreen === "AUTH-001" && "Enterprise Sign In & SAML/OIDC"}
                  {activeScreen === "AUTH-002" && "Multi-Factor Authentication (TOTP / Backup)"}
                  {activeScreen === "AUTH-003" && "Self-Service Password Recovery & Rotation"}
                  {activeScreen === "AUTH-004" && "Enterprise SSO Domain Discovery"}
                </h2>
              </div>
              <KeyRound className="w-6 h-6 text-blue-400" />
            </div>

            {statusMsg && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{statusMsg}</span>
              </div>
            )}

            {activeScreen === "AUTH-001" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Work Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900/90 border border-slate-700 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">Password</span>
                    <button
                      type="button"
                      onClick={() => setActiveScreen("AUTH-003")}
                      className="text-blue-400 hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900/90 border border-slate-700 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded bg-slate-800 border-slate-700" />
                    Bind session to Desktop Agent HWID
                  </label>
                  <span className="font-mono text-[11px] text-emerald-400">TLS 1.3 Verified</span>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveScreen("AUTH-002")}
                    className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition"
                  >
                    Sign In & Verify 2FA
                  </button>
                  <Link
                    href="/"
                    className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm flex items-center gap-1.5"
                  >
                    Instant Demo <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>

                <div className="relative my-4 flex items-center justify-center">
                  <div className="border-t border-slate-800 w-full" />
                  <span className="bg-[#151f32] px-3 text-[11px] text-slate-400 uppercase font-mono">
                    Or Federated Identity
                  </span>
                  <div className="border-t border-slate-800 w-full" />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveScreen("AUTH-004")}
                    className="py-2 px-3 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200"
                  >
                    Okta SAML 2.0
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveScreen("AUTH-004")}
                    className="py-2 px-3 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200"
                  >
                    Entra ID OIDC
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveScreen("AUTH-004")}
                    className="py-2 px-3 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200"
                  >
                    Google Workspace
                  </button>
                </div>
              </div>
            )}

            {activeScreen === "AUTH-002" && (
              <div className="space-y-4">
                <p className="text-xs text-slate-300">
                  Enter the 6-digit RFC 6238 TOTP code from your authenticator app or use a hardware YubiKey passkey.
                </p>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">6-Digit Authenticator Code</label>
                  <input
                    type="text"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-slate-900 border border-blue-500/50 text-center font-mono text-xl tracking-[0.4em] text-white"
                  />
                </div>
                <div className="flex gap-2">
                  <Link
                    href="/"
                    className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-center font-semibold text-sm"
                  >
                    Verify TOTP & Launch Workspace
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleAction("WebAuthn FIDO2 Hardware Key challenge verified.")}
                    className="px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200"
                  >
                    Use YubiKey
                  </button>
                </div>
              </div>
            )}

            {activeScreen === "AUTH-003" && (
              <div className="space-y-4">
                <p className="text-xs text-slate-300">
                  Password reset enforces NIST SP 800-63B entropy checks, HaveIBeenPwned k-anonymity screening, and revokes active Redis refresh tokens.
                </p>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white"
                />
                <button
                  type="button"
                  onClick={() => handleAction(`Cryptographic reset link dispatched to ${email} (15-min TTL).`)}
                  className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm"
                >
                  Send Signed Recovery Token
                </button>
              </div>
            )}

            {activeScreen === "AUTH-004" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Identity Provider Tenant Domain</label>
                  <input
                    type="text"
                    value={ssoDomain}
                    onChange={(e) => setSsoDomain(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-sm font-mono text-white"
                  />
                </div>
                <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">ACS Endpoint:</span>
                    <span className="font-mono text-slate-200">https://api.hydiems.io/v1/auth/saml/acs</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">SCIM 2.0 Sync:</span>
                    <span className="font-mono text-emerald-400">Active (1 Provisioned User: Ramandeep)</span>
                  </div>
                </div>
                <Link
                  href="/"
                  className="block w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-center font-semibold text-sm"
                >
                  Initiate SAML 2.0 Handshake →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-7xl w-full mx-auto flex flex-wrap items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-4">
        <span>HydiEms Enterprise v2.5 • 33 Modules • 45 Enterprise Extensions • 422 Screen IDs</span>
        <div className="flex items-center gap-4">
          <Link href="/onboarding" className="hover:text-blue-400">
            8-Step Organization Onboarding (AUTH-005)
          </Link>
          <Link href="/" className="hover:text-blue-400">
            Main Application Shell (G-001)
          </Link>
        </div>
      </div>
    </div>
  );
}
