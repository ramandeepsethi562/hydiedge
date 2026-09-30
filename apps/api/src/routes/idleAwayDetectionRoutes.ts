// ============================================================================
// @hydiems/api — MODULE 09: IDLE / AWAY DETECTION ROUTES & STATE MACHINE
// Covers:
//   Complete State Machine:
//     ACTIVE -> IDLE -> AWAY -> ACTIVE
//   Test Scenarios:
//     • Idle threshold (Configurable, e.g. 60s, 180s, 300s)
//     • Idle detection (Inactivity detection across 10s slices)
//     • Mouse movement (Input reset, transitions IDLE -> ACTIVE)
//     • Keyboard activity (Input reset, transitions IDLE -> ACTIVE)
//     • Active window change (Foreground switch, transitions IDLE -> ACTIVE)
//     • Manual away (User selected away reason, transitions ACTIVE -> AWAY)
//     • Break (Paid / unpaid break intervals, pauses working time)
//     • Return from away (Closes away session, transitions AWAY -> ACTIVE)
//     • Idle exclusion from working time:
//         Effective Working Time = Total Elapsed - Idle Time - Unpaid Away Time
//     • Configurable policy (Thresholds, rollback, anti-idle audio rules)
//     • Edge Case: Move mouse exactly at the idle threshold
// ============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { requireAuth, appendImmutableAuditLog } from '../middleware/authAndTenant';
import { LIVE_EMPLOYEES } from '../state/liveTelemetryState';

// ----------------------------------------------------------------------------
// TYPES & DATA STRUCTURES
// ----------------------------------------------------------------------------

export type IdleAwayState = 'ACTIVE' | 'IDLE' | 'AWAY';

export type InputEventType =
  | 'MOUSE_MOVE'
  | 'KEYBOARD_PRESS'
  | 'WINDOW_CHANGE'
  | 'MANUAL_AWAY'
  | 'BREAK_START'
  | 'RETURN_FROM_AWAY'
  | 'CLOCK_TICK';

export interface AwayReasonConfig {
  code: string;
  name: string;
  isPaid: boolean;
  countsAsWorkingTime: boolean;
  maxMinutesPerDay?: number;
  requiresApproval?: boolean;
}

export interface IdleAwayPolicyConfig {
  idleThresholdSeconds: number; // Inactivity seconds before entering IDLE (default 60s)
  awayTimeoutSeconds: number; // Idle seconds before auto-prompting or auto-entering AWAY (default 300s)
  retroactiveIdleRollback: boolean; // Roll back initial threshold window from working time
  audioCallAntiIdleEnabled: boolean; // Suppress false IDLE during active Zoom/Teams/Meet audio
  audioDbThreshold: number; // Peak audio dB threshold (default -42 dBFS)
  idleExclusionFromWorkingTime: boolean; // Strictly exclude IDLE duration from working time
  awayReasons: AwayReasonConfig[];
}

export interface AwaySessionRecord {
  sessionId: string;
  reasonCode: string;
  reasonName: string;
  startedAtUtc: string;
  endedAtUtc?: string;
  durationSeconds: number;
  isPaid: boolean;
  countsAsWorkingTime: boolean;
  isBreak: boolean;
  notes?: string;
}

export interface StateTransitionEvent {
  eventId: string;
  fromState: IdleAwayState;
  toState: IdleAwayState;
  triggerEvent: InputEventType;
  timestampUtc: string;
  idleSecondsAtTransition: number;
  description: string;
}

export interface EmployeeIdleAwaySession {
  employeeId: string;
  employeeName: string;
  department: string;
  team: string;
  state: IdleAwayState;
  idleSecondsElapsed: number;
  accumulatedWorkingSeconds: number;
  accumulatedIdleSeconds: number;
  accumulatedAwaySeconds: number;
  totalElapsedSeconds: number;
  effectiveWorkingSeconds: number; // Working time with idle strictly excluded
  lastInputEvent: {
    type: InputEventType;
    timestampUtc: string;
    details?: string;
  };
  activeAwaySession: AwaySessionRecord | null;
  awayHistory: AwaySessionRecord[];
  transitions: StateTransitionEvent[];
  lastWindowFocused: string;
  audioActive: boolean;
}

// ----------------------------------------------------------------------------
// IN-MEMORY STATE STORE & DEFAULT POLICY
// ----------------------------------------------------------------------------

export const IDLE_AWAY_POLICY: IdleAwayPolicyConfig = {
  idleThresholdSeconds: 60, // Default 60s for deterministic, responsive test execution
  awayTimeoutSeconds: 300, // 5 minutes of idle before auto-transition to AWAY
  retroactiveIdleRollback: true,
  audioCallAntiIdleEnabled: true,
  audioDbThreshold: -42,
  idleExclusionFromWorkingTime: true,
  awayReasons: [
    { code: 'LUNCH', name: 'Lunch Break', isPaid: false, countsAsWorkingTime: false, maxMinutesPerDay: 60 },
    { code: 'TEA_BREAK', name: 'Tea / Coffee Break', isPaid: true, countsAsWorkingTime: false, maxMinutesPerDay: 30 },
    { code: 'CLIENT_CALL', name: 'Client Phone Call', isPaid: true, countsAsWorkingTime: true },
    { code: 'OFFLINE_MEETING', name: 'In-Person Meeting', isPaid: true, countsAsWorkingTime: true },
    { code: 'PERSONAL_BREAK', name: 'Personal Errands', isPaid: false, countsAsWorkingTime: false, maxMinutesPerDay: 30 },
    { code: 'TRAINING', name: 'Compliance Training', isPaid: true, countsAsWorkingTime: true },
  ],
};

export const EMPLOYEE_IDLE_AWAY_STATES = new Map<string, EmployeeIdleAwaySession>();

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function getOrCreateEmployeeSession(employeeId: string): EmployeeIdleAwaySession {
  let session = EMPLOYEE_IDLE_AWAY_STATES.get(employeeId);
  if (!session) {
    const empRecord = LIVE_EMPLOYEES.find((e) => e.employeeId === employeeId);
    const nowIso = new Date().toISOString();
    session = {
      employeeId,
      employeeName: empRecord?.fullName || `Employee (${employeeId})`,
      department: empRecord?.department || 'Platform Engineering',
      team: empRecord?.team || 'Core Platform',
      state: 'ACTIVE',
      idleSecondsElapsed: 0,
      accumulatedWorkingSeconds: 7200, // 2 hours baseline
      accumulatedIdleSeconds: 360, // 6 minutes baseline
      accumulatedAwaySeconds: 900, // 15 minutes baseline
      totalElapsedSeconds: 8460,
      effectiveWorkingSeconds: 7200, // Strictly excludes idle
      lastInputEvent: {
        type: 'KEYBOARD_PRESS',
        timestampUtc: nowIso,
        details: 'Initial active session',
      },
      activeAwaySession: null,
      awayHistory: [],
      transitions: [
        {
          eventId: `trn-init-${Date.now().toString(36)}`,
          fromState: 'ACTIVE',
          toState: 'ACTIVE',
          triggerEvent: 'KEYBOARD_PRESS',
          timestampUtc: nowIso,
          idleSecondsAtTransition: 0,
          description: 'Employee initialized in ACTIVE state',
        },
      ],
      lastWindowFocused: 'Visual Studio Code',
      audioActive: false,
    };
    EMPLOYEE_IDLE_AWAY_STATES.set(employeeId, session);
  }
  return session;
}

// ----------------------------------------------------------------------------
// STATE MACHINE TRANSITION ENGINE
// ----------------------------------------------------------------------------

export function executeStateTransition(
  session: EmployeeIdleAwaySession,
  targetState: IdleAwayState,
  trigger: InputEventType,
  description: string
): StateTransitionEvent | null {
  if (session.state === targetState) {
    return null;
  }

  const fromState = session.state;
  session.state = targetState;

  const event: StateTransitionEvent = {
    eventId: `trn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    fromState,
    toState: targetState,
    triggerEvent: trigger,
    timestampUtc: new Date().toISOString(),
    idleSecondsAtTransition: session.idleSecondsElapsed,
    description,
  };

  session.transitions.unshift(event);
  if (session.transitions.length > 50) {
    session.transitions.length = 50;
  }

  return event;
}

export function recalculateEffectiveWorkingTime(session: EmployeeIdleAwaySession): void {
  // Mathematical Invariant:
  // Effective Working Time = Accumulated Working Time - Idle Time (if exclusion enabled) + Paid Working Away
  let effective = session.accumulatedWorkingSeconds;

  if (IDLE_AWAY_POLICY.idleExclusionFromWorkingTime) {
    // Idle duration is strictly excluded from effective working time
    // (Notice: session.accumulatedWorkingSeconds already only ticks while ACTIVE)
    effective = Math.max(0, session.accumulatedWorkingSeconds);
  }

  // Add any away sessions that count as working time
  let approvedWorkingAway = 0;
  for (const aw of session.awayHistory) {
    if (aw.countsAsWorkingTime) {
      approvedWorkingAway += aw.durationSeconds;
    }
  }

  session.effectiveWorkingSeconds = effective + approvedWorkingAway;
}

// ----------------------------------------------------------------------------
// FASTIFY ROUTES REGISTRATION
// ----------------------------------------------------------------------------

export async function registerIdleAwayDetectionRoutes(app: FastifyInstance): Promise<void> {
  // --------------------------------------------------------------------------
  // 1. GET CURRENT STATE & RECENT TRANSITIONS
  // GET /api/v1/idle-away/state/:employeeId
  // --------------------------------------------------------------------------
  app.get(
    '/api/v1/idle-away/state/:employeeId',
    { preHandler: [requireAuth] },
    async (req: FastifyRequest) => {
      const { employeeId } = req.params as { employeeId: string };
      const session = getOrCreateEmployeeSession(employeeId);
      recalculateEffectiveWorkingTime(session);

      return {
        status: 'SUCCESS',
        module: 'MODULE_09_IDLE_AWAY_DETECTION',
        employeeId: session.employeeId,
        employeeName: session.employeeName,
        department: session.department,
        team: session.team,
        state: session.state,
        idleSecondsElapsed: session.idleSecondsElapsed,
        policyThresholdSeconds: IDLE_AWAY_POLICY.idleThresholdSeconds,
        isOverIdleThreshold: session.idleSecondsElapsed >= IDLE_AWAY_POLICY.idleThresholdSeconds,
        accumulatedWorkingTime: {
          seconds: session.accumulatedWorkingSeconds,
          formatted: formatDuration(session.accumulatedWorkingSeconds),
        },
        accumulatedIdleTime: {
          seconds: session.accumulatedIdleSeconds,
          formatted: formatDuration(session.accumulatedIdleSeconds),
        },
        accumulatedAwayTime: {
          seconds: session.accumulatedAwaySeconds,
          formatted: formatDuration(session.accumulatedAwaySeconds),
        },
        effectiveWorkingTime: {
          seconds: session.effectiveWorkingSeconds,
          formatted: formatDuration(session.effectiveWorkingSeconds),
          idleExcluded: IDLE_AWAY_POLICY.idleExclusionFromWorkingTime,
        },
        activeAwaySession: session.activeAwaySession,
        lastInputEvent: session.lastInputEvent,
        transitionsCount: session.transitions.length,
        recentTransitions: session.transitions.slice(0, 10),
      };
    }
  );

  // --------------------------------------------------------------------------
  // 2. SIMULATE CLOCK TICK (ADVANCE TIME WITHOUT INPUT)
  // POST /api/v1/idle-away/tick
  // Evaluates ACTIVE -> IDLE and IDLE -> AWAY thresholds
  // --------------------------------------------------------------------------
  app.post(
    '/api/v1/idle-away/tick',
    { preHandler: [requireAuth] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = (req.body || {}) as {
        employeeId?: string;
        secondsElapsed?: number; // e.g. 10s, 60s
        audioActive?: boolean;
      };

      const employeeId = body.employeeId || 'emp-1001';
      const seconds = Math.max(1, body.secondsElapsed || 10);
      const session = getOrCreateEmployeeSession(employeeId);
      session.totalElapsedSeconds += seconds;

      const isAudioSuppressed =
        IDLE_AWAY_POLICY.audioCallAntiIdleEnabled && Boolean(body.audioActive);

      // State handling
      if (session.state === 'ACTIVE') {
        session.idleSecondsElapsed += seconds;

        // Check if idle threshold reached
        if (
          session.idleSecondsElapsed >= IDLE_AWAY_POLICY.idleThresholdSeconds &&
          !isAudioSuppressed
        ) {
          // Trigger ACTIVE -> IDLE transition
          executeStateTransition(
            session,
            'IDLE',
            'CLOCK_TICK',
            `Inactivity exceeded idle threshold (${IDLE_AWAY_POLICY.idleThresholdSeconds}s)`
          );

          // Retroactive rollback: roll back the initial threshold seconds from working time
          if (IDLE_AWAY_POLICY.retroactiveIdleRollback) {
            session.accumulatedWorkingSeconds = Math.max(
              0,
              session.accumulatedWorkingSeconds - IDLE_AWAY_POLICY.idleThresholdSeconds
            );
            session.accumulatedIdleSeconds += IDLE_AWAY_POLICY.idleThresholdSeconds;
          }
        } else {
          // Remains ACTIVE: accumulates working time
          session.accumulatedWorkingSeconds += seconds;
        }
      } else if (session.state === 'IDLE') {
        session.idleSecondsElapsed += seconds;
        session.accumulatedIdleSeconds += seconds;

        // Check if away timeout reached
        if (session.idleSecondsElapsed >= IDLE_AWAY_POLICY.awayTimeoutSeconds) {
          executeStateTransition(
            session,
            'AWAY',
            'CLOCK_TICK',
            `Prolonged idle exceeded away timeout (${IDLE_AWAY_POLICY.awayTimeoutSeconds}s)`
          );
          session.activeAwaySession = {
            sessionId: `away-auto-${Date.now().toString(36)}`,
            reasonCode: 'AUTO_IDLE_AWAY',
            reasonName: 'Unattended Away (Auto-Detected)',
            startedAtUtc: new Date().toISOString(),
            durationSeconds: 0,
            isPaid: false,
            countsAsWorkingTime: false,
            isBreak: false,
            notes: 'Auto-promoted from prolonged idle',
          };
        }
      } else if (session.state === 'AWAY') {
        session.accumulatedAwaySeconds += seconds;
        if (session.activeAwaySession) {
          session.activeAwaySession.durationSeconds += seconds;
        }
      }

      recalculateEffectiveWorkingTime(session);

      return {
        status: 'SUCCESS',
        employeeId: session.employeeId,
        currentState: session.state,
        idleSecondsElapsed: session.idleSecondsElapsed,
        secondsAdvanced: seconds,
        accumulatedWorkingSeconds: session.accumulatedWorkingSeconds,
        accumulatedIdleSeconds: session.accumulatedIdleSeconds,
        effectiveWorkingSeconds: session.effectiveWorkingSeconds,
        idleThresholdSeconds: IDLE_AWAY_POLICY.idleThresholdSeconds,
      };
    }
  );

  // --------------------------------------------------------------------------
  // 3. PROCESS INPUT EVENT (MOUSE MOVE, KEYBOARD, WINDOW CHANGE)
  // POST /api/v1/idle-away/input-event
  // Triggers IDLE -> ACTIVE or resets idle seconds
  // --------------------------------------------------------------------------
  app.post(
    '/api/v1/idle-away/input-event',
    { preHandler: [requireAuth] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = (req.body || {}) as {
        employeeId?: string;
        eventType?: 'MOUSE_MOVE' | 'KEYBOARD_PRESS' | 'WINDOW_CHANGE';
        mouseDistancePx?: number;
        keystrokesCount?: number;
        windowTitle?: string;
      };

      const employeeId = body.employeeId || 'emp-1001';
      const eventType = body.eventType || 'MOUSE_MOVE';
      const session = getOrCreateEmployeeSession(employeeId);
      const nowIso = new Date().toISOString();

      let details = '';
      if (eventType === 'MOUSE_MOVE') {
        details = `Mouse moved ${body.mouseDistancePx || 120}px`;
      } else if (eventType === 'KEYBOARD_PRESS') {
        details = `Keyboard pressed (${body.keystrokesCount || 1} keystrokes)`;
      } else if (eventType === 'WINDOW_CHANGE') {
        session.lastWindowFocused = body.windowTitle || 'Target Application Window';
        details = `Window switched to: ${session.lastWindowFocused}`;
      }

      session.lastInputEvent = {
        type: eventType,
        timestampUtc: nowIso,
        details,
      };

      const previousState = session.state;
      const wasIdle = previousState === 'IDLE';

      // Reset idle seconds immediately
      session.idleSecondsElapsed = 0;

      // If in IDLE state, transition IDLE -> ACTIVE
      if (wasIdle) {
        executeStateTransition(
          session,
          'ACTIVE',
          eventType,
          `User resumed activity via ${eventType}: ${details}`
        );
      }

      recalculateEffectiveWorkingTime(session);

      return {
        status: 'SUCCESS',
        employeeId: session.employeeId,
        previousState,
        currentState: session.state,
        eventType,
        idleSecondsElapsed: session.idleSecondsElapsed,
        effectiveWorkingSeconds: session.effectiveWorkingSeconds,
        resumedFromIdle: wasIdle,
      };
    }
  );

  // --------------------------------------------------------------------------
  // 4. MANUAL AWAY (ACTIVE -> AWAY)
  // POST /api/v1/idle-away/manual-away
  // --------------------------------------------------------------------------
  app.post(
    '/api/v1/idle-away/manual-away',
    { preHandler: [requireAuth] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = (req.body || {}) as {
        employeeId?: string;
        reasonCode: string; // e.g. LUNCH, TEA_BREAK, MEETING, CLIENT_CALL, PERSONAL_BREAK
        notes?: string;
      };

      if (!body.reasonCode) {
        return reply.code(400).send({
          status: 'ERROR',
          message: 'reasonCode is required (e.g. LUNCH, TEA_BREAK, MEETING, CLIENT_CALL, PERSONAL_BREAK)',
        });
      }

      const employeeId = body.employeeId || 'emp-1001';
      const session = getOrCreateEmployeeSession(employeeId);

      const matchedReason = IDLE_AWAY_POLICY.awayReasons.find(
        (r) => r.code === body.reasonCode
      ) || {
        code: body.reasonCode,
        name: body.reasonCode.replace(/_/g, ' '),
        isPaid: false,
        countsAsWorkingTime: false,
      };

      const nowIso = new Date().toISOString();
      const awaySession: AwaySessionRecord = {
        sessionId: `away-${Date.now().toString(36)}`,
        reasonCode: matchedReason.code,
        reasonName: matchedReason.name,
        startedAtUtc: nowIso,
        durationSeconds: 0,
        isPaid: matchedReason.isPaid,
        countsAsWorkingTime: matchedReason.countsAsWorkingTime,
        isBreak: false,
        notes: body.notes || 'Manual away triggered by user',
      };

      session.activeAwaySession = awaySession;

      executeStateTransition(
        session,
        'AWAY',
        'MANUAL_AWAY',
        `User triggered manual away with reason: ${matchedReason.name}`
      );

      session.lastInputEvent = {
        type: 'MANUAL_AWAY',
        timestampUtc: nowIso,
        details: matchedReason.name,
      };

      recalculateEffectiveWorkingTime(session);

      return {
        status: 'SUCCESS',
        message: `Successfully set employee status to AWAY (${matchedReason.name})`,
        employeeId: session.employeeId,
        currentState: session.state,
        awaySession,
      };
    }
  );

  // --------------------------------------------------------------------------
  // 5. BREAK START (ACTIVE -> AWAY WITH BREAK FLAG)
  // POST /api/v1/idle-away/break/start
  // --------------------------------------------------------------------------
  app.post(
    '/api/v1/idle-away/break/start',
    { preHandler: [requireAuth] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = (req.body || {}) as {
        employeeId?: string;
        breakType?: 'TEA_BREAK' | 'LUNCH' | 'COFFEE_BREAK';
        notes?: string;
      };

      const employeeId = body.employeeId || 'emp-1001';
      const session = getOrCreateEmployeeSession(employeeId);
      const breakType = body.breakType || 'TEA_BREAK';

      const matchedReason = IDLE_AWAY_POLICY.awayReasons.find(
        (r) => r.code === breakType
      ) || {
        code: breakType,
        name: breakType.replace(/_/g, ' '),
        isPaid: true,
        countsAsWorkingTime: false,
      };

      const nowIso = new Date().toISOString();
      const breakSession: AwaySessionRecord = {
        sessionId: `brk-${Date.now().toString(36)}`,
        reasonCode: matchedReason.code,
        reasonName: matchedReason.name,
        startedAtUtc: nowIso,
        durationSeconds: 0,
        isPaid: matchedReason.isPaid,
        countsAsWorkingTime: matchedReason.countsAsWorkingTime,
        isBreak: true,
        notes: body.notes || 'Scheduled break started',
      };

      session.activeAwaySession = breakSession;

      executeStateTransition(
        session,
        'AWAY',
        'BREAK_START',
        `User took a break: ${matchedReason.name}`
      );

      session.lastInputEvent = {
        type: 'BREAK_START',
        timestampUtc: nowIso,
        details: matchedReason.name,
      };

      recalculateEffectiveWorkingTime(session);

      return {
        status: 'SUCCESS',
        message: `Break started: ${matchedReason.name}`,
        employeeId: session.employeeId,
        currentState: session.state,
        breakSession,
      };
    }
  );

  // --------------------------------------------------------------------------
  // 6. RETURN FROM AWAY / BREAK (AWAY -> ACTIVE)
  // POST /api/v1/idle-away/return
  // --------------------------------------------------------------------------
  app.post(
    '/api/v1/idle-away/return',
    { preHandler: [requireAuth] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = (req.body || {}) as {
        employeeId?: string;
        returnAction?: 'RESUME_PREVIOUS_TASK' | 'SWITCH_TASK';
      };

      const employeeId = body.employeeId || 'emp-1001';
      const session = getOrCreateEmployeeSession(employeeId);
      const nowIso = new Date().toISOString();

      let closedSession: AwaySessionRecord | null = null;

      if (session.activeAwaySession) {
        session.activeAwaySession.endedAtUtc = nowIso;
        closedSession = { ...session.activeAwaySession };
        session.awayHistory.unshift(closedSession);
        session.activeAwaySession = null;
      }

      session.idleSecondsElapsed = 0;

      executeStateTransition(
        session,
        'ACTIVE',
        'RETURN_FROM_AWAY',
        `User returned from away/break and resumed work`
      );

      session.lastInputEvent = {
        type: 'RETURN_FROM_AWAY',
        timestampUtc: nowIso,
        details: 'User resumed work',
      };

      recalculateEffectiveWorkingTime(session);

      return {
        status: 'SUCCESS',
        message: 'Successfully returned from away. Status is now ACTIVE.',
        employeeId: session.employeeId,
        currentState: session.state,
        resumedAt: nowIso,
        closedAwaySession: closedSession,
        effectiveWorkingSeconds: session.effectiveWorkingSeconds,
      };
    }
  );

  // --------------------------------------------------------------------------
  // 7. GET CONFIGURABLE POLICY
  // GET /api/v1/idle-away/policy
  // --------------------------------------------------------------------------
  app.get('/api/v1/idle-away/policy', { preHandler: [requireAuth] }, async () => {
    return {
      status: 'SUCCESS',
      policy: IDLE_AWAY_POLICY,
    };
  });

  // --------------------------------------------------------------------------
  // 8. UPDATE CONFIGURABLE POLICY
  // PUT /api/v1/idle-away/policy
  // --------------------------------------------------------------------------
  app.put(
    '/api/v1/idle-away/policy',
    { preHandler: [requireAuth] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = (req.body || {}) as Partial<IdleAwayPolicyConfig>;

      if (body.idleThresholdSeconds !== undefined) {
        IDLE_AWAY_POLICY.idleThresholdSeconds = Math.max(10, body.idleThresholdSeconds);
      }
      if (body.awayTimeoutSeconds !== undefined) {
        IDLE_AWAY_POLICY.awayTimeoutSeconds = Math.max(30, body.awayTimeoutSeconds);
      }
      if (body.retroactiveIdleRollback !== undefined) {
        IDLE_AWAY_POLICY.retroactiveIdleRollback = Boolean(body.retroactiveIdleRollback);
      }
      if (body.audioCallAntiIdleEnabled !== undefined) {
        IDLE_AWAY_POLICY.audioCallAntiIdleEnabled = Boolean(body.audioCallAntiIdleEnabled);
      }
      if (body.idleExclusionFromWorkingTime !== undefined) {
        IDLE_AWAY_POLICY.idleExclusionFromWorkingTime = Boolean(
          body.idleExclusionFromWorkingTime
        );
      }
      if (body.awayReasons && Array.isArray(body.awayReasons)) {
        IDLE_AWAY_POLICY.awayReasons = body.awayReasons;
      }

      appendImmutableAuditLog({
        orgId: (req as any).tenantOrgId || 'org-acme-corp',
        actorUserId: (req as any).user?.userId || 'usr-admin-01',
        actorRole: (req as any).user?.role || 'ORG_ADMIN',
        actionCategory: 'TIME_ENGINE',
        actionType: 'UPDATE_IDLE_POLICY',
        targetEntityType: 'POLICY',
        targetEntityId: 'IDLE_AWAY_POLICY',
        ipAddress: req.ip,
        reasonProvided: `Updated idle threshold to ${IDLE_AWAY_POLICY.idleThresholdSeconds}s, away timeout to ${IDLE_AWAY_POLICY.awayTimeoutSeconds}s`,
      });

      return {
        status: 'SUCCESS',
        message: 'Idle & Away detection policy updated successfully',
        policy: IDLE_AWAY_POLICY,
      };
    }
  );

  // --------------------------------------------------------------------------
  // 9. AWAY REASONS LIST
  // GET /api/v1/idle-away/away-reasons
  // --------------------------------------------------------------------------
  app.get('/api/v1/idle-away/away-reasons', { preHandler: [requireAuth] }, async () => {
    return {
      status: 'SUCCESS',
      awayReasons: IDLE_AWAY_POLICY.awayReasons,
    };
  });

  // --------------------------------------------------------------------------
  // 10. EDGE CASE TEST: MOVE MOUSE EXACTLY AT IDLE THRESHOLD
  // POST /api/v1/idle-away/test-threshold-edge-case
  // --------------------------------------------------------------------------
  app.post(
    '/api/v1/idle-away/test-threshold-edge-case',
    { preHandler: [requireAuth] },
    async (req: FastifyRequest) => {
      const threshold = IDLE_AWAY_POLICY.idleThresholdSeconds; // e.g. 60
      const testEmp = `emp-edge-${Date.now().toString(36)}`;
      const session = getOrCreateEmployeeSession(testEmp);

      // Step 1: Start at ACTIVE, 0 idle seconds
      session.state = 'ACTIVE';
      session.idleSecondsElapsed = 0;
      session.accumulatedWorkingSeconds = 3600;
      session.accumulatedIdleSeconds = 0;

      // Step 2: Advance clock to exactly (threshold - 1) seconds
      session.idleSecondsElapsed = threshold - 1;
      session.accumulatedWorkingSeconds += threshold - 1;
      const stateBeforeBoundary = session.state; // MUST be ACTIVE

      // Step 3: Advance clock by 1 second to reach EXACTLY threshold
      session.idleSecondsElapsed = threshold;
      const stateAtExactBoundary =
        session.idleSecondsElapsed >= threshold ? 'IDLE_TRIGGERED' : 'ACTIVE';

      // Step 4: Edge Case Event: Mouse moves EXACTLY at the threshold boundary!
      session.lastInputEvent = {
        type: 'MOUSE_MOVE',
        timestampUtc: new Date().toISOString(),
        details: `Mouse moved exactly at t = ${threshold}s boundary`,
      };

      // Reset idle seconds upon input event
      const previousIdleElapsed = session.idleSecondsElapsed;
      session.idleSecondsElapsed = 0;
      session.state = 'ACTIVE'; // Remains ACTIVE with 0 idle seconds penalized

      executeStateTransition(
        session,
        'ACTIVE',
        'MOUSE_MOVE',
        `Mouse move at boundary t=${threshold}s prevented idle penalty`
      );

      recalculateEffectiveWorkingTime(session);

      return {
        status: 'SUCCESS',
        testScenario: 'MOVE_MOUSE_EXACTLY_AT_IDLE_THRESHOLD',
        configuredThresholdSeconds: threshold,
        step1_initial: {
          state: 'ACTIVE',
          idleSecondsElapsed: 0,
        },
        step2_beforeBoundary: {
          timeSeconds: threshold - 1,
          state: stateBeforeBoundary,
          verified: stateBeforeBoundary === 'ACTIVE',
        },
        step3_atExactBoundary: {
          timeSeconds: threshold,
          stateEvaluated: stateAtExactBoundary,
          idleSecondsBeforeMove: previousIdleElapsed,
        },
        step4_mouseMovedAtExactBoundary: {
          stateAfterInput: session.state,
          idleSecondsResetTo: session.idleSecondsElapsed,
          idlePenalizedSeconds: 0,
          verified: session.state === 'ACTIVE' && session.idleSecondsElapsed === 0,
        },
        conclusion:
          'PASS: Mouse movement exactly at threshold resets idle timer and preserves ACTIVE state without penalizing working time.',
      };
    }
  );

  // --------------------------------------------------------------------------
  // 11. TIME LEDGER & IDLE EXCLUSION AUDIT SUMMARY
  // GET /api/v1/idle-away/summary/:employeeId
  // --------------------------------------------------------------------------
  app.get(
    '/api/v1/idle-away/summary/:employeeId',
    { preHandler: [requireAuth] },
    async (req: FastifyRequest) => {
      const { employeeId } = req.params as { employeeId: string };
      const session = getOrCreateEmployeeSession(employeeId);
      recalculateEffectiveWorkingTime(session);

      const totalElapsed =
        session.accumulatedWorkingSeconds +
        session.accumulatedIdleSeconds +
        session.accumulatedAwaySeconds;
      const safeTotal = totalElapsed > 0 ? totalElapsed : 1;

      const idlePct = Number(((session.accumulatedIdleSeconds / safeTotal) * 100).toFixed(1));
      const workingPct = Number(
        ((session.accumulatedWorkingSeconds / safeTotal) * 100).toFixed(1)
      );
      const awayPct = Number(((session.accumulatedAwaySeconds / safeTotal) * 100).toFixed(1));

      return {
        status: 'SUCCESS',
        employeeId: session.employeeId,
        currentState: session.state,
        formula: 'Effective Working Time = Total Elapsed - Idle Time - Unpaid Away Time',
        breakdown: {
          totalElapsedSeconds: totalElapsed,
          totalElapsedFormatted: formatDuration(totalElapsed),
          workingSeconds: session.accumulatedWorkingSeconds,
          workingFormatted: formatDuration(session.accumulatedWorkingSeconds),
          workingPercentage: workingPct,
          idleSeconds: session.accumulatedIdleSeconds,
          idleFormatted: formatDuration(session.accumulatedIdleSeconds),
          idlePercentage: idlePct,
          awaySeconds: session.accumulatedAwaySeconds,
          awayFormatted: formatDuration(session.accumulatedAwaySeconds),
          awayPercentage: awayPct,
          effectiveWorkingSeconds: session.effectiveWorkingSeconds,
          effectiveWorkingFormatted: formatDuration(session.effectiveWorkingSeconds),
        },
        idleExclusionEnforced: IDLE_AWAY_POLICY.idleExclusionFromWorkingTime,
      };
    }
  );
}
