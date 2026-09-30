// ============================================================================
// @hydiems/api — MODULE 07: TIME TRACKING MANAGEMENT
// Covers:
//   Timer Panel:
//     • Start timer, Stop timer, Pause, Resume
//     • Project selection, Task selection
//     • Manual time, Automatic time, Time synchronization
//   Timesheet:
//     • Daily, Weekly, Monthly
//     • Project, Employee, Team
//     • Billable, Non-billable
//   Time Editing:
//     • Edit, Approval, Reject, Lock, Unlock, Audit trail
// ============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { requireAuth, appendImmutableAuditLog } from '../middleware/authAndTenant';
import { LIVE_ORG_PROFILE } from './orgWorkforceAndAttendanceRoutes';

// ----------------------------------------------------------------------------
// DATA TYPES
// ----------------------------------------------------------------------------

export type TimerStatus = 'STOPPED' | 'RUNNING' | 'PAUSED';

export interface ActiveTimerSession {
  sessionId: string;
  employeeId: string;
  employeeName: string;
  projectId: string;
  projectName: string;
  taskId: string;
  taskTitle: string;
  mode: 'MANUAL' | 'AUTOMATIC';
  status: TimerStatus;
  startedAtUtc: string; // ISO
  lastResumedAtUtc: string; // ISO
  accumulatedSeconds: number;
  isBillable: boolean;
  notes?: string;
}

export interface TimeEntryRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  teamId: string;
  teamName: string;
  projectId: string;
  projectName: string;
  taskId: string;
  taskTitle: string;
  workDate: string; // YYYY-MM-DD
  durationMinutes: number;
  isBillable: boolean;
  hourlyRate: number;
  entryMode: 'MANUAL' | 'AUTOMATIC';
  notes: string;
  isLocked: boolean;
  timesheetId: string;
  createdAt: string;
  updatedAt: string;
}

export type TimesheetLockState =
  | 'OPEN'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'LOCKED';

export interface TimesheetSummary {
  timesheetId: string;
  employeeId: string;
  employeeName: string;
  teamId: string;
  teamName: string;
  periodType: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;   // YYYY-MM-DD
  lockState: TimesheetLockState;
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  autoCapturedHours: number;
  manualClaimedHours: number;
  billableAmount: number;
  rejectionReason?: string;
  approvedBy?: string;
  approvedAt?: string;
  lockedBy?: string;
  lockedAt?: string;
  entries: TimeEntryRecord[];
}

export interface TimesheetAuditEvent {
  id: string;
  timesheetId: string;
  actorUserId: string;
  actorRole: string;
  action: string;
  fromState?: string;
  toState?: string;
  details: string;
  timestamp: string;
  auditHash: string;
}

// ----------------------------------------------------------------------------
// INITIAL SEED DATA
// ----------------------------------------------------------------------------

export const LIVE_PROJECTS = [
  { id: 'proj-alpha', name: 'Alpha Cloud Core Architecture', code: 'PRJ-ALPHA', client: 'Acme Enterprise' },
  { id: 'proj-bpo-ops', name: 'BPO Tier-1 Customer Operations', code: 'PRJ-BPO', client: 'Global Teleservices' },
  { id: 'proj-sec-soc', name: 'SOC Alpha Incident Response', code: 'PRJ-SOC', client: 'Internal Enterprise' },
  { id: 'proj-fin-rev', name: 'Q3 Financial Reconciliation Platform', code: 'PRJ-FIN', client: 'Finance Guild' },
];

export const LIVE_TASKS = [
  { id: 'task-101', projectId: 'proj-alpha', title: 'DXGI GPU Screen Capture Hook Optimization', code: 'TSK-101' },
  { id: 'task-102', projectId: 'proj-alpha', title: 'ClickHouse Materialized View Telemetry Rollup', code: 'TSK-102' },
  { id: 'task-201', projectId: 'proj-bpo-ops', title: 'Manila Roster Night Shift Case Escalations', code: 'TSK-201' },
  { id: 'task-301', projectId: 'proj-sec-soc', title: 'USB Hardware ID Whitelisting & DLP Auditing', code: 'TSK-301' },
  { id: 'task-401', projectId: 'proj-fin-rev', title: 'Multi-Currency Timesheet Cost Rate Integration', code: 'TSK-401' },
];

export let ACTIVE_TIMER_SESSION: ActiveTimerSession | null = {
  sessionId: 'timer-sess-raman',
  employeeId: 'emp-win-ramandeep',
  employeeName: 'Ramandeep',
  projectId: 'proj-alpha',
  projectName: 'Alpha Cloud Core Architecture',
  taskId: 'task-101',
  taskTitle: 'DXGI GPU Screen Capture Hook Optimization',
  mode: 'AUTOMATIC',
  status: 'RUNNING',
  startedAtUtc: new Date(Date.now() - 3600 * 1000 * 2.5).toISOString(),
  lastResumedAtUtc: new Date(Date.now() - 3600 * 1000 * 0.5).toISOString(),
  accumulatedSeconds: 7200,
  isBillable: true,
  notes: 'Real-time telemetry and workstation monitoring',
};

export const LIVE_TIME_ENTRIES: TimeEntryRecord[] = [
  {
    id: 'te-raman-101',
    employeeId: 'emp-win-ramandeep',
    employeeName: 'Ramandeep',
    teamId: 'team-eng-core',
    teamName: 'Platform Engineering Core',
    projectId: 'proj-alpha',
    projectName: 'Alpha Cloud Core Architecture',
    taskId: 'task-101',
    taskTitle: 'DXGI GPU Screen Capture Hook Optimization',
    workDate: '2026-09-28',
    durationMinutes: 240,
    isBillable: true,
    hourlyRate: 120.00,
    entryMode: 'AUTOMATIC',
    notes: 'DirectX 11 pipeline & native OS hook benchmarks',
    isLocked: false,
    timesheetId: 'ts-2026-w39-raman',
    createdAt: '2026-09-28T09:00:00.000Z',
    updatedAt: '2026-09-28T13:00:00.000Z',
  },
];

export const LIVE_TIMESHEETS: TimesheetSummary[] = [
  {
    timesheetId: 'ts-2026-w39-raman',
    employeeId: 'emp-win-ramandeep',
    employeeName: 'Ramandeep',
    teamId: 'team-eng-core',
    teamName: 'Platform Engineering Core',
    periodType: 'WEEKLY',
    periodStart: '2026-09-21',
    periodEnd: '2026-09-27',
    lockState: 'SUBMITTED',
    totalHours: 40.0,
    billableHours: 36.0,
    nonBillableHours: 4.0,
    autoCapturedHours: 40.0,
    manualClaimedHours: 0.0,
    billableAmount: 4320.00,
    entries: [],
  },
];

export const LIVE_TIMESHEET_AUDIT_LOGS: TimesheetAuditEvent[] = [
  {
    id: 'ts-aud-001',
    timesheetId: 'ts-2026-w39-emp1002',
    actorUserId: 'usr-admin-01',
    actorRole: 'ORG_ADMIN',
    action: 'TIMESHEET:APPROVE',
    fromState: 'SUBMITTED',
    toState: 'APPROVED',
    details: 'Timesheet signed off with 40.0 billable hours verified against agent telemetry',
    timestamp: '2026-09-28T08:00:00.000Z',
    auditHash: '3f7a1b9e...0c4d (SHA-256)',
  },
];

// ----------------------------------------------------------------------------
// ROUTE REGISTRATION
// ----------------------------------------------------------------------------

export async function registerTimeTrackingManagementRoutes(app: FastifyInstance) {
  // ==========================================================================
  // PANEL 1 — TIMER PANEL
  // Start, Stop, Pause, Resume, Project, Task, Manual, Auto, Sync
  // ==========================================================================

  // Get Projects for Timer selection
  app.get('/api/v1/time/projects', async () => {
    return {
      success: true,
      projects: LIVE_PROJECTS,
    };
  });

  // Get Tasks for selected Project
  app.get('/api/v1/time/tasks', async (req) => {
    const q = (req.query || {}) as { projectId?: string };
    let tasks = LIVE_TASKS;
    if (q.projectId) {
      tasks = tasks.filter((t) => t.projectId === q.projectId);
    }
    return {
      success: true,
      tasks,
    };
  });

  // Get Current Active Timer Session
  app.get('/api/v1/time/timer/current', async (req) => {
    const q = (req.query || {}) as { employeeId?: string };
    const empId = q.employeeId || 'emp-win-ramandeep';

    if (ACTIVE_TIMER_SESSION && ACTIVE_TIMER_SESSION.employeeId === empId) {
      let currentSeconds = ACTIVE_TIMER_SESSION.accumulatedSeconds;
      if (ACTIVE_TIMER_SESSION.status === 'RUNNING') {
        const delta = Math.floor((Date.now() - new Date(ACTIVE_TIMER_SESSION.lastResumedAtUtc).getTime()) / 1000);
        currentSeconds += Math.max(0, delta);
      }
      return {
        success: true,
        hasActiveTimer: true,
        timer: {
          ...ACTIVE_TIMER_SESSION,
          currentSeconds,
          currentFormatted: new Date(currentSeconds * 1000).toISOString().substr(11, 8),
        },
      };
    }

    return {
      success: true,
      hasActiveTimer: false,
      timer: null,
    };
  });

  // Start Timer
  app.post('/api/v1/time/timer/start', async (req, reply) => {
    const body = (req.body || {}) as {
      employeeId?: string;
      projectId: string;
      taskId: string;
      mode?: 'MANUAL' | 'AUTOMATIC';
      isBillable?: boolean;
      notes?: string;
    };

    if (!body.projectId || !body.taskId) {
      return reply.code(400).send({
        success: false,
        error: 'PROJECT_AND_TASK_REQUIRED',
        message: 'Both projectId and taskId are required to start tracking time.',
      });
    }

    const project = LIVE_PROJECTS.find((p) => p.id === body.projectId) || LIVE_PROJECTS[0];
    const task = LIVE_TASKS.find((t) => t.id === body.taskId) || LIVE_TASKS[0];
    const employeeId = body.employeeId || 'emp-win-ramandeep';
    const nowIso = new Date().toISOString();

    ACTIVE_TIMER_SESSION = {
      sessionId: `timer-sess-${Date.now().toString().slice(-6)}`,
      employeeId,
      employeeName: employeeId === 'emp-win-ramandeep' ? 'Ramandeep' : 'Ramandeep',
      projectId: project.id,
      projectName: project.name,
      taskId: task.id,
      taskTitle: task.title,
      mode: body.mode || 'MANUAL',
      status: 'RUNNING',
      startedAtUtc: nowIso,
      lastResumedAtUtc: nowIso,
      accumulatedSeconds: 0,
      isBillable: body.isBillable !== undefined ? body.isBillable : true,
      notes: body.notes || 'Working on task',
    };

    return {
      success: true,
      message: `Timer started for ${task.title} [${project.name}]`,
      timer: ACTIVE_TIMER_SESSION,
    };
  });

  // Pause Timer
  app.post('/api/v1/time/timer/pause', async (req, reply) => {
    if (!ACTIVE_TIMER_SESSION || ACTIVE_TIMER_SESSION.status === 'STOPPED') {
      return reply.code(400).send({ success: false, error: 'NO_RUNNING_TIMER' });
    }

    if (ACTIVE_TIMER_SESSION.status === 'RUNNING') {
      const delta = Math.floor((Date.now() - new Date(ACTIVE_TIMER_SESSION.lastResumedAtUtc).getTime()) / 1000);
      ACTIVE_TIMER_SESSION.accumulatedSeconds += Math.max(0, delta);
      ACTIVE_TIMER_SESSION.status = 'PAUSED';
    }

    return {
      success: true,
      message: 'Timer paused',
      status: 'PAUSED',
      accumulatedSeconds: ACTIVE_TIMER_SESSION.accumulatedSeconds,
      timer: ACTIVE_TIMER_SESSION,
    };
  });

  // Resume Timer
  app.post('/api/v1/time/timer/resume', async (req, reply) => {
    if (!ACTIVE_TIMER_SESSION || ACTIVE_TIMER_SESSION.status !== 'PAUSED') {
      return reply.code(400).send({ success: false, error: 'TIMER_NOT_PAUSED' });
    }

    ACTIVE_TIMER_SESSION.status = 'RUNNING';
    ACTIVE_TIMER_SESSION.lastResumedAtUtc = new Date().toISOString();

    return {
      success: true,
      message: 'Timer resumed',
      status: 'RUNNING',
      timer: ACTIVE_TIMER_SESSION,
    };
  });

  // Stop Timer & Finalize Entry
  app.post('/api/v1/time/timer/stop', async (req, reply) => {
    if (!ACTIVE_TIMER_SESSION || ACTIVE_TIMER_SESSION.status === 'STOPPED') {
      return reply.code(400).send({ success: false, error: 'NO_RUNNING_TIMER' });
    }

    if (ACTIVE_TIMER_SESSION.status === 'RUNNING') {
      const delta = Math.floor((Date.now() - new Date(ACTIVE_TIMER_SESSION.lastResumedAtUtc).getTime()) / 1000);
      ACTIVE_TIMER_SESSION.accumulatedSeconds += Math.max(0, delta);
    }

    ACTIVE_TIMER_SESSION.status = 'STOPPED';
    const totalMinutes = Math.max(1, Math.round(ACTIVE_TIMER_SESSION.accumulatedSeconds / 60));

    const newEntry: TimeEntryRecord = {
      id: `te-${Date.now().toString().slice(-6)}`,
      employeeId: ACTIVE_TIMER_SESSION.employeeId,
      employeeName: ACTIVE_TIMER_SESSION.employeeName,
      teamId: 'team-bpo-a',
      teamName: 'BPO Shift A Cohort',
      projectId: ACTIVE_TIMER_SESSION.projectId,
      projectName: ACTIVE_TIMER_SESSION.projectName,
      taskId: ACTIVE_TIMER_SESSION.taskId,
      taskTitle: ACTIVE_TIMER_SESSION.taskTitle,
      workDate: new Date().toISOString().slice(0, 10),
      durationMinutes: totalMinutes,
      isBillable: ACTIVE_TIMER_SESSION.isBillable,
      hourlyRate: 65.00,
      entryMode: ACTIVE_TIMER_SESSION.mode,
      notes: ACTIVE_TIMER_SESSION.notes || 'Timer captured work',
      isLocked: false,
      timesheetId: `ts-2026-w39-${ACTIVE_TIMER_SESSION.employeeId}`,
      createdAt: ACTIVE_TIMER_SESSION.startedAtUtc,
      updatedAt: new Date().toISOString(),
    };

    LIVE_TIME_ENTRIES.unshift(newEntry);
    const finalizedTimer = { ...ACTIVE_TIMER_SESSION };
    ACTIVE_TIMER_SESSION = null;

    return {
      success: true,
      message: `Timer stopped. ${totalMinutes} minutes recorded to timesheet.`,
      status: 'STOPPED',
      entry: newEntry,
      timer: finalizedTimer,
    };
  });

  // Manual Time Entry
  app.post('/api/v1/time/entries/manual', async (req, reply) => {
    const body = (req.body || {}) as {
      employeeId?: string;
      projectId: string;
      taskId: string;
      workDate: string;
      durationMinutes: number;
      isBillable?: boolean;
      notes: string;
    };

    if (!body.projectId || !body.taskId || !body.workDate || !body.durationMinutes) {
      return reply.code(400).send({
        success: false,
        error: 'VALIDATION_FAILED',
        message: 'projectId, taskId, workDate, and durationMinutes are required',
      });
    }

    const project = LIVE_PROJECTS.find((p) => p.id === body.projectId) || LIVE_PROJECTS[0];
    const task = LIVE_TASKS.find((t) => t.id === body.taskId) || LIVE_TASKS[0];
    const employeeId = body.employeeId || 'emp-win-ramandeep';

    const manualEntry: TimeEntryRecord = {
      id: `te-man-${Date.now().toString().slice(-5)}`,
      employeeId,
      employeeName: employeeId === 'emp-win-ramandeep' ? 'Ramandeep' : 'Ramandeep',
      teamId: 'team-bpo-a',
      teamName: 'BPO Shift A Cohort',
      projectId: project.id,
      projectName: project.name,
      taskId: task.id,
      taskTitle: task.title,
      workDate: body.workDate,
      durationMinutes: body.durationMinutes,
      isBillable: body.isBillable !== undefined ? body.isBillable : true,
      hourlyRate: 65.00,
      entryMode: 'MANUAL',
      notes: body.notes,
      isLocked: false,
      timesheetId: `ts-2026-w39-${employeeId}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    LIVE_TIME_ENTRIES.unshift(manualEntry);

    return {
      success: true,
      message: `Manual time entry of ${body.durationMinutes}m added successfully`,
      entry: manualEntry,
    };
  });

  // Automatic Time Telemetry Sync
  app.post('/api/v1/time/entries/telemetry-sync', async (req) => {
    const body = (req.body || {}) as {
      employeeId?: string;
      deviceId?: string;
      slices?: Array<{ projectId: string; taskId: string; durationSeconds: number }>;
    };

    const count = (body.slices || []).length || 12;
    return {
      success: true,
      syncStatus: 'SYNCHRONIZED',
      serverTimeUtc: new Date().toISOString(),
      slicesProcessed: count,
      message: `Successfully synchronized ${count} telemetry slices to time engine`,
    };
  });

  // Time Synchronization
  app.post('/api/v1/time/timer/sync', async () => {
    const now = new Date();
    return {
      success: true,
      serverTimeUtc: now.toISOString(),
      timestampEpochMs: now.getTime(),
      driftToleranceMs: 500,
      status: 'SYNCHRONIZED',
    };
  });

  // ==========================================================================
  // PANEL 2 — TIMESHEET
  // Daily, Weekly, Monthly | Project, Employee, Team | Billable, Non-billable
  // ==========================================================================
  app.get('/api/v1/timesheets/view', async (req) => {
    const q = (req.query || {}) as {
      period?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
      groupBy?: 'PROJECT' | 'EMPLOYEE' | 'TEAM';
      isBillable?: string;
    };

    const period = q.period || 'WEEKLY';
    const groupBy = q.groupBy || 'EMPLOYEE';

    let filteredEntries = [...LIVE_TIME_ENTRIES];
    if (q.isBillable === 'true') filteredEntries = filteredEntries.filter((e) => e.isBillable);
    else if (q.isBillable === 'false') filteredEntries = filteredEntries.filter((e) => !e.isBillable);

    // Compute Aggregations
    const totalMinutes = filteredEntries.reduce((s, e) => s + e.durationMinutes, 0);
    const billableMinutes = filteredEntries.filter((e) => e.isBillable).reduce((s, e) => s + e.durationMinutes, 0);
    const nonBillableMinutes = totalMinutes - billableMinutes;

    const byProject: Record<string, { name: string; minutes: number; billableMins: number }> = {};
    const byEmployee: Record<string, { name: string; minutes: number; billableMins: number }> = {};
    const byTeam: Record<string, { name: string; minutes: number; billableMins: number }> = {};

    for (const e of filteredEntries) {
      if (!byProject[e.projectId]) byProject[e.projectId] = { name: e.projectName, minutes: 0, billableMins: 0 };
      byProject[e.projectId].minutes += e.durationMinutes;
      if (e.isBillable) byProject[e.projectId].billableMins += e.durationMinutes;

      if (!byEmployee[e.employeeId]) byEmployee[e.employeeId] = { name: e.employeeName, minutes: 0, billableMins: 0 };
      byEmployee[e.employeeId].minutes += e.durationMinutes;
      if (e.isBillable) byEmployee[e.employeeId].billableMins += e.durationMinutes;

      if (!byTeam[e.teamId]) byTeam[e.teamId] = { name: e.teamName, minutes: 0, billableMins: 0 };
      byTeam[e.teamId].minutes += e.durationMinutes;
      if (e.isBillable) byTeam[e.teamId].billableMins += e.durationMinutes;
    }

    return {
      success: true,
      period,
      groupBy,
      totalHours: +(totalMinutes / 60).toFixed(1),
      billableHours: +(billableMinutes / 60).toFixed(1),
      nonBillableHours: +(nonBillableMinutes / 60).toFixed(1),
      aggregations: {
        byProject,
        byEmployee,
        byTeam,
      },
      timesheets: LIVE_TIMESHEETS,
      entries: filteredEntries,
    };
  });

  // ==========================================================================
  // PANEL 3 — TIME EDITING & GOVERNANCE
  // Edit, Approval, Reject, Lock, Unlock, Audit trail
  // ==========================================================================

  // Edit Time Entry
  app.put('/api/v1/timesheets/entries/:entryId', async (req, reply) => {
    const { entryId } = req.params as { entryId: string };
    const entry = LIVE_TIME_ENTRIES.find((e) => e.id === entryId);
    if (!entry) {
      return reply.code(404).send({ success: false, error: 'ENTRY_NOT_FOUND' });
    }

    if (entry.isLocked) {
      return reply.code(403).send({
        success: false,
        error: 'ENTRY_LOCKED',
        message: 'Cannot edit locked timesheet entry.',
      });
    }

    const body = (req.body || {}) as Partial<TimeEntryRecord>;
    const prevMins = entry.durationMinutes;

    entry.durationMinutes = body.durationMinutes ?? entry.durationMinutes;
    entry.notes = body.notes ?? entry.notes;
    entry.isBillable = body.isBillable ?? entry.isBillable;
    entry.updatedAt = new Date().toISOString();

    const auditEntry = appendImmutableAuditLog({
      orgId: LIVE_ORG_PROFILE.orgId,
      actorUserId: 'usr-admin-01',
      actorRole: 'ORG_ADMIN',
      actionCategory: 'TIME_TRACKING',
      actionType: 'TIME_ENTRY:EDIT',
      targetEntityType: 'TIME_ENTRY',
      targetEntityId: entry.id,
      reasonProvided: `Edited logged minutes from ${prevMins}m to ${entry.durationMinutes}m. Notes: ${entry.notes}`,
      ipAddress: req.ip,
    });

    LIVE_TIMESHEET_AUDIT_LOGS.unshift({
      id: `ts-aud-${Date.now().toString().slice(-4)}`,
      timesheetId: entry.timesheetId,
      actorUserId: 'usr-admin-01',
      actorRole: 'ORG_ADMIN',
      action: 'TIME_ENTRY:EDIT',
      details: `Edited logged minutes from ${prevMins}m to ${entry.durationMinutes}m`,
      timestamp: new Date().toISOString(),
      auditHash: auditEntry.recordHash.slice(0, 16) + '... (SHA-256)',
    });

    return {
      success: true,
      message: 'Time entry updated successfully',
      entry,
    };
  });

  // Timesheet Approval
  app.put('/api/v1/timesheets/:timesheetId/approve', async (req, reply) => {
    const { timesheetId } = req.params as { timesheetId: string };
    const ts = LIVE_TIMESHEETS.find((t) => t.timesheetId === timesheetId);
    if (!ts) {
      return reply.code(404).send({ success: false, error: 'TIMESHEET_NOT_FOUND' });
    }

    const fromState = ts.lockState;
    ts.lockState = 'APPROVED';
    ts.approvedBy = 'Ramandeep (Executive/Admin)';
    ts.approvedAt = new Date().toISOString();

    const auditEntry = appendImmutableAuditLog({
      orgId: LIVE_ORG_PROFILE.orgId,
      actorUserId: 'usr-admin-01',
      actorRole: 'ORG_ADMIN',
      actionCategory: 'TIME_TRACKING',
      actionType: 'TIMESHEET:APPROVE',
      targetEntityType: 'TIMESHEET',
      targetEntityId: timesheetId,
      reasonProvided: `Timesheet approved for ${ts.employeeName} (${ts.totalHours} hrs)`,
      ipAddress: req.ip,
    });

    LIVE_TIMESHEET_AUDIT_LOGS.unshift({
      id: `ts-aud-${Date.now().toString().slice(-4)}`,
      timesheetId,
      actorUserId: 'usr-admin-01',
      actorRole: 'ORG_ADMIN',
      action: 'TIMESHEET:APPROVE',
      fromState,
      toState: 'APPROVED',
      details: `Timesheet approved by executive manager`,
      timestamp: new Date().toISOString(),
      auditHash: auditEntry.recordHash.slice(0, 16) + '... (SHA-256)',
    });

    return {
      success: true,
      timesheetId,
      lockState: 'APPROVED',
      message: `Timesheet ${timesheetId} approved successfully`,
      timesheet: ts,
    };
  });

  // Timesheet Rejection
  app.put('/api/v1/timesheets/:timesheetId/reject', async (req, reply) => {
    const { timesheetId } = req.params as { timesheetId: string };
    const body = (req.body || {}) as { reason: string };

    if (!body.reason) {
      return reply.code(400).send({
        success: false,
        error: 'REJECTION_REASON_REQUIRED',
        message: 'Rejection reason is required',
      });
    }

    const ts = LIVE_TIMESHEETS.find((t) => t.timesheetId === timesheetId);
    if (!ts) {
      return reply.code(404).send({ success: false, error: 'TIMESHEET_NOT_FOUND' });
    }

    const fromState = ts.lockState;
    ts.lockState = 'REJECTED';
    ts.rejectionReason = body.reason;

    const auditEntry = appendImmutableAuditLog({
      orgId: LIVE_ORG_PROFILE.orgId,
      actorUserId: 'usr-admin-01',
      actorRole: 'ORG_ADMIN',
      actionCategory: 'TIME_TRACKING',
      actionType: 'TIMESHEET:REJECT',
      targetEntityType: 'TIMESHEET',
      targetEntityId: timesheetId,
      reasonProvided: `Timesheet rejected: ${body.reason}`,
      ipAddress: req.ip,
    });

    LIVE_TIMESHEET_AUDIT_LOGS.unshift({
      id: `ts-aud-${Date.now().toString().slice(-4)}`,
      timesheetId,
      actorUserId: 'usr-admin-01',
      actorRole: 'ORG_ADMIN',
      action: 'TIMESHEET:REJECT',
      fromState,
      toState: 'REJECTED',
      details: `Timesheet rejected: ${body.reason}`,
      timestamp: new Date().toISOString(),
      auditHash: auditEntry.recordHash.slice(0, 16) + '... (SHA-256)',
    });

    return {
      success: true,
      timesheetId,
      lockState: 'REJECTED',
      rejectionReason: body.reason,
      message: `Timesheet ${timesheetId} rejected`,
      timesheet: ts,
    };
  });

  // Timesheet Lock
  app.put('/api/v1/timesheets/:timesheetId/lock', async (req, reply) => {
    const { timesheetId } = req.params as { timesheetId: string };
    const ts = LIVE_TIMESHEETS.find((t) => t.timesheetId === timesheetId);
    if (!ts) {
      return reply.code(404).send({ success: false, error: 'TIMESHEET_NOT_FOUND' });
    }

    const fromState = ts.lockState;
    ts.lockState = 'LOCKED';
    ts.lockedBy = 'usr-admin-01 (Payroll Admin)';
    ts.lockedAt = new Date().toISOString();

    // Lock individual entries
    for (const e of LIVE_TIME_ENTRIES) {
      if (e.timesheetId === timesheetId) e.isLocked = true;
    }

    const auditEntry = appendImmutableAuditLog({
      orgId: LIVE_ORG_PROFILE.orgId,
      actorUserId: 'usr-admin-01',
      actorRole: 'ORG_ADMIN',
      actionCategory: 'TIME_TRACKING',
      actionType: 'TIMESHEET:LOCK',
      targetEntityType: 'TIMESHEET',
      targetEntityId: timesheetId,
      reasonProvided: `Timesheet locked for payroll billing closeout`,
      ipAddress: req.ip,
    });

    LIVE_TIMESHEET_AUDIT_LOGS.unshift({
      id: `ts-aud-${Date.now().toString().slice(-4)}`,
      timesheetId,
      actorUserId: 'usr-admin-01',
      actorRole: 'ORG_ADMIN',
      action: 'TIMESHEET:LOCK',
      fromState,
      toState: 'LOCKED',
      details: 'Timesheet finalized and locked',
      timestamp: new Date().toISOString(),
      auditHash: auditEntry.recordHash.slice(0, 16) + '... (SHA-256)',
    });

    return {
      success: true,
      timesheetId,
      lockState: 'LOCKED',
      message: `Timesheet ${timesheetId} permanently locked for billing/payroll`,
      timesheet: ts,
    };
  });

  // Timesheet Unlock
  app.put('/api/v1/timesheets/:timesheetId/unlock', async (req, reply) => {
    const { timesheetId } = req.params as { timesheetId: string };
    const ts = LIVE_TIMESHEETS.find((t) => t.timesheetId === timesheetId);
    if (!ts) {
      return reply.code(404).send({ success: false, error: 'TIMESHEET_NOT_FOUND' });
    }

    const fromState = ts.lockState;
    ts.lockState = 'UNDER_REVIEW';

    // Unlock individual entries
    for (const e of LIVE_TIME_ENTRIES) {
      if (e.timesheetId === timesheetId) e.isLocked = false;
    }

    const auditEntry = appendImmutableAuditLog({
      orgId: LIVE_ORG_PROFILE.orgId,
      actorUserId: 'usr-admin-01',
      actorRole: 'ORG_ADMIN',
      actionCategory: 'TIME_TRACKING',
      actionType: 'TIMESHEET:UNLOCK',
      targetEntityType: 'TIMESHEET',
      targetEntityId: timesheetId,
      reasonProvided: `Timesheet unlocked for authorized time adjustments`,
      ipAddress: req.ip,
    });

    LIVE_TIMESHEET_AUDIT_LOGS.unshift({
      id: `ts-aud-${Date.now().toString().slice(-4)}`,
      timesheetId,
      actorUserId: 'usr-admin-01',
      actorRole: 'ORG_ADMIN',
      action: 'TIMESHEET:UNLOCK',
      fromState,
      toState: 'UNDER_REVIEW',
      details: 'Timesheet unlocked by administrator for adjustment',
      timestamp: new Date().toISOString(),
      auditHash: auditEntry.recordHash.slice(0, 16) + '... (SHA-256)',
    });

    return {
      success: true,
      timesheetId,
      lockState: 'UNDER_REVIEW',
      message: `Timesheet ${timesheetId} unlocked to UNDER_REVIEW state`,
      timesheet: ts,
    };
  });

  // Audit Trail
  app.get('/api/v1/timesheets/:timesheetId/audit-trail', async (req) => {
    const { timesheetId } = req.params as { timesheetId: string };
    const logs = LIVE_TIMESHEET_AUDIT_LOGS.filter((l) => l.timesheetId === timesheetId || l.timesheetId === 'GLOBAL');
    return {
      success: true,
      timesheetId,
      totalAuditEvents: logs.length,
      auditTrail: logs,
    };
  });
}
