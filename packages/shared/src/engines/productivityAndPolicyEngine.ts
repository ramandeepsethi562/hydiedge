// ============================================================================
// @hydiems/shared — 4-Tier Policy Inheritance Resolver, Level-2 Regex
// Productivity Engine, Software License Waste Calculator & 4-Way Reconciliation
// ============================================================================
import { ProductivityCategory } from '../types';

export type PolicyScopeLevel = 'EMPLOYEE' | 'TEAM' | 'DEPARTMENT' | 'ORG_GLOBAL';

export interface ProductivityRuleEntry {
  ruleId: string;
  scopeLevel: PolicyScopeLevel;
  scopeTargetId: string; // employeeId | teamId | deptId | orgId
  matchType: 'EXACT_PROCESS' | 'EXACT_DOMAIN' | 'WINDOW_TITLE_REGEX' | 'URL_REGEX';
  pattern: string;
  category: ProductivityCategory;
  priority: number;
}

const SCOPE_PRECEDENCE: Record<PolicyScopeLevel, number> = {
  EMPLOYEE: 400,
  TEAM: 300,
  DEPARTMENT: 200,
  ORG_GLOBAL: 100,
};

/**
 * Resolves the productivity classification for an app/window/URL using
 * 4-Tier Hierarchy (Employee > Team > Department > Global) + Level-2 Regex rules (PROD-006).
 */
export function classifyAppAndUrlProductivity(
  processName: string,
  windowTitle: string,
  urlFull: string,
  urlDomain: string,
  context: { orgId: string; deptId?: string; teamId?: string; employeeId: string },
  rules: ProductivityRuleEntry[]
): ProductivityCategory {
  const applicable = rules
    .filter((r) => {
      if (r.scopeLevel === 'EMPLOYEE') return r.scopeTargetId === context.employeeId;
      if (r.scopeLevel === 'TEAM') return r.scopeTargetId === context.teamId;
      if (r.scopeLevel === 'DEPARTMENT') return r.scopeTargetId === context.deptId;
      return r.scopeTargetId === context.orgId;
    })
    .sort((a, b) => {
      const scopeDiff = SCOPE_PRECEDENCE[b.scopeLevel] - SCOPE_PRECEDENCE[a.scopeLevel];
      if (scopeDiff !== 0) return scopeDiff;
      return b.priority - a.priority;
    });

  for (const rule of applicable) {
    if (
      rule.matchType === 'EXACT_PROCESS' &&
      processName.toLowerCase() === rule.pattern.toLowerCase()
    ) {
      return rule.category;
    }
    if (
      rule.matchType === 'EXACT_DOMAIN' &&
      urlDomain.toLowerCase() === rule.pattern.toLowerCase()
    ) {
      return rule.category;
    }
    if (rule.matchType === 'WINDOW_TITLE_REGEX' && windowTitle) {
      try {
        if (new RegExp(rule.pattern, 'i').test(windowTitle)) return rule.category;
      } catch {
        // Ignore invalid user regex
      }
    }
    if (rule.matchType === 'URL_REGEX' && urlFull) {
      try {
        if (new RegExp(rule.pattern, 'i').test(urlFull)) return rule.category;
      } catch {
        // Ignore invalid user regex
      }
    }
  }

  return 'NEUTRAL';
}

/**
 * Software License Waste & ROI Calculator (LIC-003, LIC-004)
 */
export interface SoftwareLicenseContractInput {
  contractId: string;
  softwareName: string;
  vendorName: string;
  purchasedSeats: number;
  assignedSeats: number;
  activeUsersLast30Days: number;
  costPerSeatMonthlyUsd: number;
}

export interface LicenseOptimizationResult {
  contractId: string;
  softwareName: string;
  unusedSeats: number;
  unassignedSeats: number;
  inactiveAssignedSeats: number;
  monthlySpendUsd: number;
  monthlyWasteUsd: number;
  annualRecoverableSavingsUsd: number;
  utilizationPct: number;
}

export function calculateLicenseWaste(
  contract: SoftwareLicenseContractInput
): LicenseOptimizationResult {
  const unusedSeats = Math.max(0, contract.purchasedSeats - contract.activeUsersLast30Days);
  const unassignedSeats = Math.max(0, contract.purchasedSeats - contract.assignedSeats);
  const inactiveAssignedSeats = Math.max(
    0,
    contract.assignedSeats - contract.activeUsersLast30Days
  );
  const monthlySpendUsd = contract.purchasedSeats * contract.costPerSeatMonthlyUsd;
  const monthlyWasteUsd = unusedSeats * contract.costPerSeatMonthlyUsd;
  const annualRecoverableSavingsUsd = monthlyWasteUsd * 12;
  const utilizationPct =
    contract.purchasedSeats > 0
      ? Number(((contract.activeUsersLast30Days / contract.purchasedSeats) * 100).toFixed(1))
      : 0;

  return {
    contractId: contract.contractId,
    softwareName: contract.softwareName,
    unusedSeats,
    unassignedSeats,
    inactiveAssignedSeats,
    monthlySpendUsd: Number(monthlySpendUsd.toFixed(2)),
    monthlyWasteUsd: Number(monthlyWasteUsd.toFixed(2)),
    annualRecoverableSavingsUsd: Number(annualRecoverableSavingsUsd.toFixed(2)),
    utilizationPct,
  };
}

/**
 * 4-Way Data Reconciliation Engine (DATA-002)
 * Compares Agent Raw Telemetry vs Attendance Hours vs Timesheet Hours vs Project Task Hours
 */
export interface FourWayReconciliationRow {
  employeeId: string;
  date: string;
  agentRawEffectiveSeconds: number;
  attendanceLoggedSeconds: number;
  timesheetSubmittedSeconds: number;
  projectTaskAttributedSeconds: number;
}

export interface ReconciliationAuditFinding {
  employeeId: string;
  date: string;
  isConsistent: boolean;
  maxVarianceMinutes: number;
  anomalyFlags: string[];
}

export function reconcileFourWayWorkforceData(
  row: FourWayReconciliationRow,
  toleranceMinutes = 5
): ReconciliationAuditFinding {
  const valuesMin = [
    row.agentRawEffectiveSeconds / 60,
    row.attendanceLoggedSeconds / 60,
    row.timesheetSubmittedSeconds / 60,
    row.projectTaskAttributedSeconds / 60,
  ];
  const maxVal = Math.max(...valuesMin);
  const minVal = Math.min(...valuesMin);
  const maxVarianceMinutes = Number((maxVal - minVal).toFixed(1));
  const anomalyFlags: string[] = [];

  if (
    row.timesheetSubmittedSeconds - row.agentRawEffectiveSeconds >
    toleranceMinutes * 60
  ) {
    anomalyFlags.push('TIMESHEET_EXCEEDS_AGENT_TELEMETRY');
  }
  if (
    row.agentRawEffectiveSeconds - row.projectTaskAttributedSeconds >
    30 * 60
  ) {
    anomalyFlags.push('UNATTRIBUTED_PROJECT_TASK_TIME');
  }
  if (
    Math.abs(row.attendanceLoggedSeconds - row.agentRawEffectiveSeconds) >
    toleranceMinutes * 60
  ) {
    anomalyFlags.push('ATTENDANCE_VS_AGENT_DRIFT');
  }

  return {
    employeeId: row.employeeId,
    date: row.date,
    isConsistent: anomalyFlags.length === 0,
    maxVarianceMinutes,
    anomalyFlags,
  };
}
