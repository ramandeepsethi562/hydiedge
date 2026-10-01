"use client";

import React, { useEffect, useState } from "react";
import {
  Key,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Laptop,
  Users,
  Plus,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Lock,
  Unlock,
  DollarSign,
  TrendingUp,
  Cpu,
  HardDrive,
  Copy,
  ChevronRight,
  ExternalLink,
  Ban,
} from "lucide-react";

interface TenantLicense {
  id: string;
  orgId: string;
  orgName: string;
  orgSlug: string;
  licenseKey: string;
  planCode: "STARTER" | "PROFESSIONAL" | "ENTERPRISE" | "ULTIMATE";
  seatLimit: number;
  activeMachines: number;
  pricePerUserMonthly: number;
  billingCycle: "MONTHLY" | "ANNUAL";
  currency: string;
  status: "ACTIVE" | "TRIAL" | "EXPIRED" | "SUSPENDED";
  isTrial: boolean;
  daysLeft: number;
  expiresAt: string;
  trialEndsAt?: string;
  hwidBindingRequired: boolean;
}

interface MachineLicense {
  id: string;
  org_id: string;
  machine_fingerprint: string;
  hostname: string;
  os_platform: string;
  os_version: string;
  cpu_identifier: string;
  mac_address: string;
  disk_serial: string;
  status: "ACTIVE" | "REVOKED" | "SUSPENDED";
  activated_at: string;
  last_heartbeat_at: string;
  revoked_at?: string;
  revocation_reason?: string;
}

interface LicensingSummary {
  totalLicenses: number;
  activeLicensesCount: number;
  trialLicensesCount: number;
  totalSeatsSold: number;
  totalActiveMachines: number;
  seatOccupancyPct: number;
  totalAnnualizedRevenueInr: number;
}

export default function HydiEdgeLicensingStudio() {
  const [licenses, setLicenses] = useState<TenantLicense[]>([]);
  const [summary, setSummary] = useState<LicensingSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Machine Inspector Modal State
  const [selectedLicense, setSelectedLicense] = useState<TenantLicense | null>(null);
  const [machines, setMachines] = useState<MachineLicense[]>([]);
  const [loadingMachines, setLoadingMachines] = useState<boolean>(false);
  const [showMachineModal, setShowMachineModal] = useState<boolean>(false);

  // Create License Modal State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [createOrgId, setCreateOrgId] = useState<string>("org-acme-global-001");
  const [createPlan, setCreatePlan] = useState<"STARTER" | "PROFESSIONAL" | "ENTERPRISE" | "ULTIMATE">("ENTERPRISE");
  const [createSeats, setCreateSeats] = useState<number>(25);
  const [createPricePerUser, setCreatePricePerUser] = useState<number>(699);
  const [createCycle, setCreateCycle] = useState<"MONTHLY" | "ANNUAL">("ANNUAL");
  const [createMonths, setCreateMonths] = useState<number>(12);
  const [createHwidLock, setCreateHwidLock] = useState<boolean>(true);
  const [createIsTrial, setCreateIsTrial] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);

  // Fetch Licenses
  const fetchLicenses = async () => {
    setLoading(true);
    try {
      const res = await fetch("https://api.hydiedge.com/api/v1/super-admin/licenses");
      const data = await res.json();
      if (data.licenses) {
        setLicenses(data.licenses);
        setSummary(data.summary);
      }
    } catch (err) {
      console.error("Failed to fetch licenses:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLicenses();
  }, []);

  // Inspect Machines for a License
  const handleInspectMachines = async (lic: TenantLicense) => {
    setSelectedLicense(lic);
    setShowMachineModal(true);
    setLoadingMachines(true);
    try {
      const res = await fetch(`https://api.hydiedge.com/api/v1/super-admin/licenses/${lic.id}/machines`);
      const data = await res.json();
      setMachines(data.machines || []);
    } catch (err) {
      console.error("Failed to fetch machines:", err);
    } finally {
      setLoadingMachines(false);
    }
  };

  // Revoke Machine HWID Binding
  const handleRevokeMachine = async (machineId: string) => {
    if (!confirm("Are you sure you want to revoke this machine? It will immediately disconnect the agent and free 1 seat for the tenant.")) {
      return;
    }
    try {
      const res = await fetch(`https://api.hydiedge.com/api/v1/super-admin/machines/${machineId}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Manually revoked by SuperAdmin" }),
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        if (selectedLicense) {
          handleInspectMachines(selectedLicense);
          fetchLicenses();
        }
      }
    } catch (err) {
      alert("Failed to revoke machine");
    }
  };

  // Add 10 Seats Quick Action
  const handleAddSeats = async (licenseId: string, currentSeats: number) => {
    const newSeats = currentSeats + 10;
    try {
      const res = await fetch(`https://api.hydiedge.com/api/v1/super-admin/licenses/${licenseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seatLimit: newSeats }),
      });
      const data = await res.json();
      if (data.success) {
        fetchLicenses();
      }
    } catch (err) {
      alert("Failed to update seats");
    }
  };

  // Extend 30 Days Quick Action
  const handleExtendDays = async (licenseId: string) => {
    try {
      const res = await fetch(`https://api.hydiedge.com/api/v1/super-admin/licenses/${licenseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extendDays: 30 }),
      });
      const data = await res.json();
      if (data.success) {
        fetchLicenses();
      }
    } catch (err) {
      alert("Failed to extend license");
    }
  };

  // Create License Submit
  const handleCreateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("https://api.hydiedge.com/api/v1/super-admin/licenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: createOrgId,
          planCode: createPlan,
          seatLimit: createSeats,
          pricePerUserMonthly: createPricePerUser,
          billingCycle: createCycle,
          durationMonths: createMonths,
          hwidBindingRequired: createHwidLock,
          isTrial: createIsTrial,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert("License successfully generated!");
        setShowCreateModal(false);
        fetchLicenses();
      } else {
        alert(data.error || "Failed to create license");
      }
    } catch (err) {
      alert("Failed to create license");
    } finally {
      setCreating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const filteredLicenses = licenses.filter((lic) => {
    const matchQuery =
      lic.orgName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lic.licenseKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lic.planCode.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === "ALL" || lic.status === statusFilter;
    return matchQuery && matchStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 p-6 rounded-2xl border border-indigo-900/40 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              SuperAdmin Control Plane
            </span>
            <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Machine-Based Anti-Piracy Active
            </span>
          </div>
          <h1 className="text-2xl font-black text-white mt-1">
            Enterprise Seat-Based Licensing & HWID Anti-Piracy Studio
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl mt-0.5">
            Sell and provision per-user licenses, manage 7-day trials, track active hardware bindings, and lock agent endpoints to authorized machine fingerprints.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchLicenses}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-500/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Issue New License
          </button>
        </div>
      </div>

      {/* KPI Metrics Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
            <div className="text-[11px] font-mono uppercase text-slate-400 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Annualized MRR
            </div>
            <div className="text-xl font-black text-white mt-1.5">
              ₹{(summary.totalAnnualizedRevenueInr).toLocaleString("en-IN")}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Across active seat contracts</div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
            <div className="text-[11px] font-mono uppercase text-slate-400 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-400" /> Total Seats Sold
            </div>
            <div className="text-xl font-black text-blue-400 mt-1.5">
              {summary.totalSeatsSold.toLocaleString()} Seats
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Licensed user capacity</div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
            <div className="text-[11px] font-mono uppercase text-slate-400 flex items-center gap-1.5">
              <Laptop className="w-3.5 h-3.5 text-cyan-400" /> Active Machines
            </div>
            <div className="text-xl font-black text-cyan-400 mt-1.5">
              {summary.totalActiveMachines.toLocaleString()} Devices
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {summary.seatOccupancyPct}% Occupancy Rate
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
            <div className="text-[11px] font-mono uppercase text-slate-400 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-amber-400" /> Active Licenses
            </div>
            <div className="text-xl font-black text-emerald-400 mt-1.5">
              {summary.activeLicensesCount} Paid
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Paid enterprise organizations</div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
            <div className="text-[11px] font-mono uppercase text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-purple-400" /> 7-Day Trials
            </div>
            <div className="text-xl font-black text-purple-400 mt-1.5">
              {summary.trialLicensesCount} Trials
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Evaluating HydiEdge suite</div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
            <div className="text-[11px] font-mono uppercase text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Anti-Piracy Lock
            </div>
            <div className="text-xl font-black text-emerald-400 mt-1.5">100% HWID</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Hardware cloned VM block</div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by company, license key, or plan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <span className="text-[11px] font-mono text-slate-400 uppercase">Filter:</span>
          {["ALL", "ACTIVE", "TRIAL", "EXPIRED", "SUSPENDED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                statusFilter === st
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Licenses Table */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-bold text-white">Issued Organization Licenses</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300">
              {filteredLicenses.length} total
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Pricing Model: Per User / Month Seat Quota
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-950 text-slate-400 font-mono uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Organization</th>
                <th className="py-3 px-4">License Key</th>
                <th className="py-3 px-4">Tier & Pricing</th>
                <th className="py-3 px-4">Seat Quota & Occupancy</th>
                <th className="py-3 px-4">Expiry / Days Left</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredLicenses.map((lic) => {
                const occupancyPct =
                  lic.seatLimit > 0
                    ? Math.min(100, Math.round((lic.activeMachines / lic.seatLimit) * 100))
                    : 0;

                return (
                  <tr key={lic.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{lic.orgName}</div>
                      <div className="text-[10px] font-mono text-slate-400">{lic.orgSlug}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[11px] text-cyan-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                          {lic.licenseKey}
                        </span>
                        <button
                          onClick={() => copyToClipboard(lic.licenseKey)}
                          title="Copy License Key"
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {copiedKey === lic.licenseKey && (
                        <div className="text-[9px] text-emerald-400 font-mono">Copied!</div>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            lic.planCode === "ULTIMATE"
                              ? "bg-purple-950 text-purple-300 border border-purple-800"
                              : lic.planCode === "ENTERPRISE"
                              ? "bg-blue-950 text-blue-300 border border-blue-800"
                              : lic.planCode === "PROFESSIONAL"
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                              : "bg-slate-800 text-slate-300 border border-slate-700"
                          }`}
                        >
                          {lic.planCode}
                        </span>
                        <span className="font-mono text-slate-300">
                          ₹{lic.pricePerUserMonthly}/user/mo
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Billed {lic.billingCycle.toLowerCase()}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-mono text-xs font-semibold text-white">
                          {lic.activeMachines} / {lic.seatLimit} Seats
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {occupancyPct}%
                        </span>
                      </div>
                      <div className="w-36 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            occupancyPct >= 100
                              ? "bg-red-500"
                              : occupancyPct >= 80
                              ? "bg-amber-500"
                              : "bg-blue-500"
                          }`}
                          style={{ width: `${occupancyPct}%` }}
                        />
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-mono text-xs text-white">
                        {new Date(lic.expiresAt).toLocaleDateString()}
                      </div>
                      <div
                        className={`text-[10px] font-mono ${
                          lic.daysLeft <= 3
                            ? "text-red-400 font-bold"
                            : lic.daysLeft <= 7
                            ? "text-amber-400"
                            : "text-slate-400"
                        }`}
                      >
                        {lic.daysLeft} days remaining
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          lic.status === "ACTIVE"
                            ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                            : lic.status === "TRIAL"
                            ? "bg-purple-950 text-purple-300 border border-purple-800"
                            : lic.status === "EXPIRED"
                            ? "bg-red-950 text-red-300 border border-red-800"
                            : "bg-slate-800 text-slate-300 border border-slate-700"
                        }`}
                      >
                        {lic.status === "ACTIVE" && <CheckCircle2 className="w-3 h-3" />}
                        {lic.status === "TRIAL" && <Clock className="w-3 h-3" />}
                        {lic.status === "EXPIRED" && <AlertTriangle className="w-3 h-3" />}
                        {lic.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleInspectMachines(lic)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-semibold border border-slate-700 transition"
                        >
                          View Machines ({lic.activeMachines})
                        </button>
                        <button
                          onClick={() => handleAddSeats(lic.id, lic.seatLimit)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 text-[11px] font-semibold border border-slate-700 transition"
                          title="Add 10 Seats"
                        >
                          +10 Seats
                        </button>
                        <button
                          onClick={() => handleExtendDays(lic.id)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[11px] font-semibold border border-slate-700 transition"
                          title="Extend 30 Days"
                        >
                          +30 Days
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Machine Inspector Modal (HWID Anti-Piracy Explorer) */}
      {showMachineModal && selectedLicense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <Laptop className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Hardware Fingerprint & Machine Bindings — {selectedLicense.orgName}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    License: {selectedLicense.licenseKey} • {machines.length} of {selectedLicense.seatLimit} seats active
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMachineModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>
                    <strong>Anti-Piracy Enforcement:</strong> Every agent setup verifies CPU, Motherboard, and MAC address. Unbinding a machine frees a seat immediately.
                  </span>
                </div>
                <button
                  onClick={() => handleInspectMachines(selectedLicense)}
                  className="px-2.5 py-1 rounded bg-slate-800 text-slate-200 text-xs font-semibold hover:bg-slate-700"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingMachines ? "animate-spin" : ""}`} />
                </button>
              </div>

              {loadingMachines ? (
                <div className="py-12 text-center text-slate-400 text-xs">Loading machine hardware bindings...</div>
              ) : machines.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No desktop machines have connected under this license yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-950 text-slate-400 font-mono uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Device Hostname</th>
                        <th className="py-2.5 px-3">OS Platform</th>
                        <th className="py-2.5 px-3">Hardware Fingerprint (HWID)</th>
                        <th className="py-2.5 px-3">Activated At</th>
                        <th className="py-2.5 px-3">Last Heartbeat</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {machines.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-800/20">
                          <td className="py-2.5 px-3 font-semibold text-white">
                            <div className="flex items-center gap-1.5">
                              <Laptop className="w-3.5 h-3.5 text-cyan-400" />
                              {m.hostname}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">{m.mac_address || "MAC N/A"}</div>
                          </td>

                          <td className="py-2.5 px-3">
                            <div>{m.os_platform}</div>
                            <div className="text-[10px] text-slate-400">{m.os_version}</div>
                          </td>

                          <td className="py-2.5 px-3">
                            <span className="font-mono text-[10px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                              {m.machine_fingerprint.slice(0, 16)}...
                            </span>
                          </td>

                          <td className="py-2.5 px-3 font-mono text-[10px] text-slate-400">
                            {new Date(m.activated_at).toLocaleDateString()}
                          </td>

                          <td className="py-2.5 px-3 font-mono text-[10px] text-slate-400">
                            {m.last_heartbeat_at ? new Date(m.last_heartbeat_at).toLocaleTimeString() : "Never"}
                          </td>

                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                m.status === "ACTIVE"
                                  ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                                  : "bg-red-950 text-red-300 border border-red-800"
                              }`}
                            >
                              {m.status}
                            </span>
                          </td>

                          <td className="py-2.5 px-3 text-right">
                            {m.status === "ACTIVE" ? (
                              <button
                                onClick={() => handleRevokeMachine(m.id)}
                                className="px-2.5 py-1 rounded bg-red-950/60 hover:bg-red-900/80 text-red-300 text-[10px] font-bold border border-red-800 transition"
                              >
                                Revoke Binding
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-500 font-mono">Revoked</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowMachineModal(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Sell License Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Generate & Sell Per-User License</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLicense} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Target Organization</label>
                <select
                  value={createOrgId}
                  onChange={(e) => setCreateOrgId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="org-acme-global-001">Acme Global Enterprises (org-acme-global-001)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Plan Tier</label>
                  <select
                    value={createPlan}
                    onChange={(e: any) => {
                      const p = e.target.value;
                      setCreatePlan(p);
                      setCreatePricePerUser(
                        p === "STARTER" ? 199 : p === "PROFESSIONAL" ? 399 : p === "ENTERPRISE" ? 699 : 999
                      );
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="STARTER">Starter Essentials (₹199)</option>
                    <option value="PROFESSIONAL">Professional Growth (₹399)</option>
                    <option value="ENTERPRISE">Enterprise Complete (₹699)</option>
                    <option value="ULTIMATE">Ultimate Suite (₹999)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Number of Seats</label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={createSeats}
                    onChange={(e) => setCreateSeats(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Price Per User / Month (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={createPricePerUser}
                    onChange={(e) => setCreatePricePerUser(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Contract Duration (Months)</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={createMonths}
                    onChange={(e) => setCreateMonths(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createHwidLock}
                    onChange={(e) => setCreateHwidLock(e.target.checked)}
                    className="rounded border-slate-700 text-blue-600 focus:ring-0"
                  />
                  <span className="text-xs text-white font-semibold">
                    Enforce Machine-Based HWID Anti-Piracy Lock
                  </span>
                </label>
                <p className="text-[10px] text-slate-400 pl-6">
                  Prevents users from installing the desktop agent on unauthorized machines beyond their purchased seat limit.
                </p>

                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={createIsTrial}
                    onChange={(e) => setCreateIsTrial(e.target.checked)}
                    className="rounded border-slate-700 text-purple-600 focus:ring-0"
                  />
                  <span className="text-xs text-purple-300 font-semibold">
                    Mark as Evaluation / Trial License
                  </span>
                </label>
              </div>

              {/* Total Summary */}
              <div className="p-3 bg-indigo-950/40 rounded-xl border border-indigo-900/40 flex items-center justify-between text-xs">
                <span className="text-slate-300">Contract Total ({createSeats} seats × {createMonths} mo):</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  ₹{(createSeats * createPricePerUser * createMonths).toLocaleString("en-IN")}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-500/20"
                >
                  {creating ? "Generating..." : "Generate & Issue License"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
