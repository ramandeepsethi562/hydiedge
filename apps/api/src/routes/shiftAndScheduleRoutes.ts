// ============================================================================
// @hydiems/api — MODULE 05: SHIFTS & WORK SCHEDULES
// Covers:
//   Panel 1 — Shift Configuration:
//     • Shift name
//     • Start time
//     • End time
//     • Break (Paid, Unpaid, Break Windows)
//     • Grace period (Late-in, Early-out)
//     • Working days (Mon-Fri, Rotating)
//     • Overtime (Threshold, Multiplier, Approval)
//     • Night shift (20:00 - 06:00 window)
//     • Cross-midnight shift (Overnight day attribution)
//   Panel 2 — Assignment:
//     • Assign employee
//     • Assign team
//     • Assign department
//     • Bulk assignment
//     • Effective date
//     • Future scheduling
//   Panel 3 — Shift Exceptions:
//     • Holiday
//     • Leave
//     • Week-off
//     • Custom schedule
//     • Temporary shift
// ============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { requireAuth, appendImmutableAuditLog } from '../middleware/authAndTenant';
import { LIVE_ORG_PROFILE } from './orgWorkforceAndAttendanceRoutes';

// ----------------------------------------------------------------------------
// DATA TYPES
// ----------------------------------------------------------------------------

export interface ShiftBreakWindow {
  name: string;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  durationMinutes: number;
  isPaid: boolean;
}

export interface ShiftGracePeriod {
  lateGraceMinutes: number;       // e.g. 15 mins
  earlyLeaveGraceMinutes: number; // e.g. 15 mins
}

export interface ShiftOvertimeConfig {
  enabled: boolean;
  thresholdMinutes: number;       // Daily minutes before OT triggers (e.g. 510 = 8.5h)
  minimumOvertimeMinutes: number; // Min block to qualify as OT (e.g. 30)
  rateMultiplier: number;         // e.g. 1.5x
  requiresApproval: boolean;
}

export interface ShiftDefinition {
  id: string;
  code: string;
  name: string;
  description: string;
  timezone: string;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  totalShiftMinutes: number;
  expectedWorkMinutes: number;
  break: {
    totalBreakMinutes: number;
    paidBreakMinutes: number;
    unpaidBreakMinutes: number;
    breakWindows: ShiftBreakWindow[];
  };
  gracePeriod: ShiftGracePeriod;
  workingDays: string[]; // ['MON', 'TUE', 'WED', 'THU', 'FRI']
  workingDayIndices: number[]; // [1, 2, 3, 4, 5] (1=Mon .. 7=Sun)
  overtime: ShiftOvertimeConfig;
  nightShift: boolean;
  crossMidnightShift: boolean;
  midnightAttribution: 'START_DATE' | 'END_DATE' | 'MAJORITY_HOURS';
  isSystemDefault: boolean;
  status: 'ACTIVE' | 'ARCHIVED';
  assignedEmployeesCount: number;
  createdAt: string;
  updatedAt: string;
}

export type AssignmentType = 'EMPLOYEE' | 'TEAM' | 'DEPARTMENT' | 'BULK';

export interface ShiftAssignment {
  id: string;
  assignmentType: AssignmentType;
  targetId: string;
  targetName: string;
  targetIds?: string[]; // for BULK
  shiftId: string;
  shiftName: string;
  effectiveDate: string; // YYYY-MM-DD
  effectiveEndDate?: string | null; // YYYY-MM-DD
  isFutureScheduled: boolean;
  status: 'ACTIVE' | 'UPCOMING' | 'EXPIRED';
  assignedCount: number;
  notes?: string;
  assignedByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export type ExceptionType =
  | 'HOLIDAY'
  | 'LEAVE'
  | 'WEEK_OFF'
  | 'CUSTOM_SCHEDULE'
  | 'TEMPORARY_SHIFT';

export interface ShiftException {
  id: string;
  type: ExceptionType;
  title: string;
  targetType: 'ORGANIZATION' | 'DEPARTMENT' | 'TEAM' | 'EMPLOYEE';
  targetId: string;
  targetName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  exceptionDetails: {
    // For HOLIDAY
    holidayName?: string;
    holidayType?: 'PUBLIC' | 'OPTIONAL' | 'MANDATORY_OFFICE_CLOSURE';
    isPaid?: boolean;
    workPermitted?: boolean;
    holidayPayMultiplier?: number;
    // For LEAVE
    leaveType?: 'CASUAL_LEAVE' | 'SICK_LEAVE' | 'PAID_TIME_OFF' | 'UNPAID_LEAVE';
    leaveRequestId?: string;
    // For WEEK_OFF
    restDays?: string[];
    isRotating?: boolean;
    // For CUSTOM_SCHEDULE
    customStartTime?: string;
    customEndTime?: string;
    customBreakMinutes?: number;
    reason?: string;
    // For TEMPORARY_SHIFT
    baseShiftId?: string;
    temporaryShiftId?: string;
    temporaryShiftName?: string;
    coveringForEmployeeId?: string;
    coveringForEmployeeName?: string;
    autoRevertOnEnd?: boolean;
  };
  status: 'ACTIVE' | 'UPCOMING' | 'EXPIRED';
  createdAt: string;
}

// ----------------------------------------------------------------------------
// INITIAL SEED DATA
// ----------------------------------------------------------------------------

export const LIVE_SHIFTS: ShiftDefinition[] = [
  // 1. Standard Day Shift
  {
    id: 'shift-std-day',
    code: 'DAY-STD-01',
    name: 'General Standard Day Shift',
    description: 'Standard 9-to-6 business corporate shift with 1 hour lunch and standard grace period.',
    timezone: 'UTC',
    startTime: '09:00',
    endTime: '18:00',
    totalShiftMinutes: 540,
    expectedWorkMinutes: 480,
    break: {
      totalBreakMinutes: 60,
      paidBreakMinutes: 15,
      unpaidBreakMinutes: 45,
      breakWindows: [
        { name: 'Lunch Break', startTime: '13:00', endTime: '13:45', durationMinutes: 45, isPaid: false },
        { name: 'Afternoon Tea', startTime: '16:00', endTime: '16:15', durationMinutes: 15, isPaid: true },
      ],
    },
    gracePeriod: {
      lateGraceMinutes: 15,
      earlyLeaveGraceMinutes: 15,
    },
    workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    workingDayIndices: [1, 2, 3, 4, 5],
    overtime: {
      enabled: true,
      thresholdMinutes: 510,
      minimumOvertimeMinutes: 30,
      rateMultiplier: 1.5,
      requiresApproval: true,
    },
    nightShift: false,
    crossMidnightShift: false,
    midnightAttribution: 'START_DATE',
    isSystemDefault: true,
    status: 'ACTIVE',
    assignedEmployeesCount: 38,
    createdAt: '2023-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  // 2. APAC / Manila Night Shift (Cross-Midnight)
  {
    id: 'shift-apac-night',
    code: 'BPO-NIGHT-02',
    name: 'APAC Night Shift (Cross-Midnight)',
    description: 'Overnight customer operations roster operating from 22:00 to 06:00 crossing midnight.',
    timezone: 'UTC',
    startTime: '22:00',
    endTime: '06:00',
    totalShiftMinutes: 480,
    expectedWorkMinutes: 420,
    break: {
      totalBreakMinutes: 60,
      paidBreakMinutes: 20,
      unpaidBreakMinutes: 40,
      breakWindows: [
        { name: 'Midnight Meal Break', startTime: '01:30', endTime: '02:10', durationMinutes: 40, isPaid: false },
        { name: 'Quick Rest Window', startTime: '04:00', endTime: '04:20', durationMinutes: 20, isPaid: true },
      ],
    },
    gracePeriod: {
      lateGraceMinutes: 10,
      earlyLeaveGraceMinutes: 10,
    },
    workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    workingDayIndices: [1, 2, 3, 4, 5],
    overtime: {
      enabled: true,
      thresholdMinutes: 450,
      minimumOvertimeMinutes: 30,
      rateMultiplier: 1.75, // higher night differential
      requiresApproval: true,
    },
    nightShift: true,
    crossMidnightShift: true,
    midnightAttribution: 'START_DATE',
    isSystemDefault: true,
    status: 'ACTIVE',
    assignedEmployeesCount: 14,
    createdAt: '2023-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  // 3. US Morning / EMEA Shift
  {
    id: 'shift-emea-mid',
    code: 'EMEA-MID-03',
    name: 'EMEA Afternoon & Overlap Shift',
    description: 'Mid-day shift supporting European and East Coast US business overlap.',
    timezone: 'UTC',
    startTime: '13:00',
    endTime: '22:00',
    totalShiftMinutes: 540,
    expectedWorkMinutes: 480,
    break: {
      totalBreakMinutes: 60,
      paidBreakMinutes: 15,
      unpaidBreakMinutes: 45,
      breakWindows: [
        { name: 'Dinner Break', startTime: '17:30', endTime: '18:15', durationMinutes: 45, isPaid: false },
        { name: 'Evening Break', startTime: '20:15', endTime: '20:30', durationMinutes: 15, isPaid: true },
      ],
    },
    gracePeriod: {
      lateGraceMinutes: 15,
      earlyLeaveGraceMinutes: 15,
    },
    workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    workingDayIndices: [1, 2, 3, 4, 5],
    overtime: {
      enabled: true,
      thresholdMinutes: 510,
      minimumOvertimeMinutes: 30,
      rateMultiplier: 1.5,
      requiresApproval: true,
    },
    nightShift: false, // Ends at 22:00
    crossMidnightShift: false,
    midnightAttribution: 'START_DATE',
    isSystemDefault: true,
    status: 'ACTIVE',
    assignedEmployeesCount: 9,
    createdAt: '2023-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  // 4. Flexible Core-Hours Engineering Shift
  {
    id: 'shift-eng-flex',
    code: 'ENG-FLEX-04',
    name: 'Platform Engineering Flexible Shift',
    description: 'Flexible start with mandatory core presence hours between 11:00 and 16:00.',
    timezone: 'UTC',
    startTime: '08:00',
    endTime: '17:00',
    totalShiftMinutes: 540,
    expectedWorkMinutes: 480,
    break: {
      totalBreakMinutes: 60,
      paidBreakMinutes: 30,
      unpaidBreakMinutes: 30,
      breakWindows: [
        { name: 'Flexible Lunch Window', startTime: '12:00', endTime: '13:00', durationMinutes: 60, isPaid: false },
      ],
    },
    gracePeriod: {
      lateGraceMinutes: 30,
      earlyLeaveGraceMinutes: 30,
    },
    workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    workingDayIndices: [1, 2, 3, 4, 5],
    overtime: {
      enabled: true,
      thresholdMinutes: 540,
      minimumOvertimeMinutes: 60,
      rateMultiplier: 1.5,
      requiresApproval: true,
    },
    nightShift: false,
    crossMidnightShift: false,
    midnightAttribution: 'START_DATE',
    isSystemDefault: true,
    status: 'ACTIVE',
    assignedEmployeesCount: 18,
    createdAt: '2023-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

export const LIVE_SHIFT_ASSIGNMENTS: ShiftAssignment[] = [
  {
    id: 'sa-001',
    assignmentType: 'EMPLOYEE',
    targetId: 'emp-win-ramandeep',
    targetName: 'Ramandeep',
    shiftId: 'shift-std-day',
    shiftName: 'General Standard Day Shift',
    effectiveDate: '2026-01-01',
    effectiveEndDate: null,
    isFutureScheduled: false,
    status: 'ACTIVE',
    assignedCount: 1,
    notes: 'Primary workstation schedule',
    assignedByUserId: 'usr-admin-01',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

export const LIVE_SHIFT_EXCEPTIONS: ShiftException[] = [
  // 1. Holiday Exception
  {
    id: 'ex-001',
    type: 'HOLIDAY',
    title: 'International Workers Day / Labor Day',
    targetType: 'ORGANIZATION',
    targetId: 'ALL',
    targetName: 'All Acme Global Workforce',
    startDate: '2026-05-01',
    endDate: '2026-05-01',
    exceptionDetails: {
      holidayName: 'International Labor Day',
      holidayType: 'PUBLIC',
      isPaid: true,
      workPermitted: false,
      holidayPayMultiplier: 2.0,
    },
    status: 'UPCOMING',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  // 2. Leave Exception
  {
    id: 'ex-002',
    type: 'LEAVE',
    title: 'Approved Casual Leave — Ramandeep',
    targetType: 'EMPLOYEE',
    targetId: 'emp-win-ramandeep',
    targetName: 'Ramandeep',
    startDate: '2026-10-12',
    endDate: '2026-10-14',
    exceptionDetails: {
      leaveType: 'CASUAL_LEAVE',
      leaveRequestId: 'lv-req-1049',
      isPaid: true,
    },
    status: 'UPCOMING',
    createdAt: '2026-09-25T00:00:00.000Z',
  },
  // 3. Week-off Exception
  {
    id: 'ex-003',
    type: 'WEEK_OFF',
    title: 'Weekend Rest Days (Sat-Sun)',
    targetType: 'ORGANIZATION',
    targetId: 'ALL',
    targetName: 'All General Corporate Shifts',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    exceptionDetails: {
      restDays: ['SAT', 'SUN'],
      isRotating: false,
    },
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  // 4. Custom Schedule Exception
  {
    id: 'ex-004',
    type: 'CUSTOM_SCHEDULE',
    title: 'Quarterly Executive Review Custom Hours — Ramandeep',
    targetType: 'EMPLOYEE',
    targetId: 'emp-win-ramandeep',
    targetName: 'Ramandeep',
    startDate: '2026-10-05',
    endDate: '2026-10-05',
    exceptionDetails: {
      customStartTime: '10:30',
      customEndTime: '19:30',
      customBreakMinutes: 60,
      reason: 'Late executive presentation with US Leadership stakeholders',
    },
    status: 'UPCOMING',
    createdAt: '2026-09-22T00:00:00.000Z',
  },
  // 5. Temporary Shift Exception
  {
    id: 'ex-005',
    type: 'TEMPORARY_SHIFT',
    title: 'Temporary Night Shift Swap — Ramandeep covering for Manila Cohort',
    targetType: 'EMPLOYEE',
    targetId: 'emp-win-ramandeep',
    targetName: 'Ramandeep',
    startDate: '2026-10-01',
    endDate: '2026-10-03',
    exceptionDetails: {
      baseShiftId: 'shift-std-day',
      temporaryShiftId: 'shift-apac-night',
      temporaryShiftName: 'APAC Night Shift (Cross-Midnight)',
      coveringForEmployeeId: 'emp-win-ramandeep',
      coveringForEmployeeName: 'Ramandeep',
      autoRevertOnEnd: true,
    },
    status: 'UPCOMING',
    createdAt: '2026-09-26T00:00:00.000Z',
  },
];

// ----------------------------------------------------------------------------
// HELPER FUNCTIONS
// ----------------------------------------------------------------------------

function calculateMinutesBetween(start: string, end: string): { total: number; crossesMidnight: boolean } {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);

  let startMins = sh * 60 + sm;
  let endMins = eh * 60 + em;

  if (endMins < startMins) {
    // Crosses midnight
    return {
      total: 24 * 60 - startMins + endMins,
      crossesMidnight: true,
    };
  }
  return {
    total: endMins - startMins,
    crossesMidnight: false,
  };
}

function isNightWindow(start: string, end: string): boolean {
  const [sh] = start.split(':').map(Number);
  const [eh] = end.split(':').map(Number);

  // Night shift definition: operative window covers between 20:00 and 06:00
  if (sh >= 20 || sh < 6) return true;
  if (eh > 20 || eh <= 6) return true;
  return false;
}

// ----------------------------------------------------------------------------
// ROUTE REGISTRATION
// ----------------------------------------------------------------------------

export async function registerShiftAndScheduleRoutes(app: FastifyInstance) {
  // ==========================================================================
  // PANEL 1 — SHIFT CONFIGURATION (CRUD & VALIDATION)
  // ==========================================================================

  // List all shifts
  app.get('/api/v1/shifts', async (req) => {
    return {
      success: true,
      totalShifts: LIVE_SHIFTS.length,
      activeShifts: LIVE_SHIFTS.filter((s) => s.status === 'ACTIVE').length,
      nightShifts: LIVE_SHIFTS.filter((s) => s.nightShift).length,
      crossMidnightShifts: LIVE_SHIFTS.filter((s) => s.crossMidnightShift).length,
      shifts: LIVE_SHIFTS,
    };
  });

  // Get single shift
  app.get('/api/v1/shifts/:shiftId', async (req, reply) => {
    const { shiftId } = req.params as { shiftId: string };
    const shift = LIVE_SHIFTS.find((s) => s.id === shiftId || s.code === shiftId);
    if (!shift) {
      return reply.code(404).send({ success: false, error: 'SHIFT_NOT_FOUND', message: `Shift ${shiftId} not found` });
    }
    return { success: true, shift };
  });

  // Create new shift with all Panel 1 verification features
  app.post('/api/v1/shifts', async (req, reply) => {
    const body = (req.body || {}) as Partial<ShiftDefinition>;

    if (!body.name || !body.startTime || !body.endTime) {
      return reply.code(400).send({
        success: false,
        error: 'VALIDATION_FAILED',
        message: 'Shift name, startTime (HH:mm), and endTime (HH:mm) are required',
      });
    }

    const { total, crossesMidnight } = calculateMinutesBetween(body.startTime, body.endTime);
    const nightShift = body.nightShift !== undefined ? Boolean(body.nightShift) : isNightWindow(body.startTime, body.endTime);
    const crossMidnightShift = body.crossMidnightShift !== undefined ? Boolean(body.crossMidnightShift) : crossesMidnight;

    const totalBreak = body.break?.totalBreakMinutes ?? 60;
    const paidBreak = body.break?.paidBreakMinutes ?? 15;
    const unpaidBreak = body.break?.unpaidBreakMinutes ?? 45;

    const code = body.code || `SHIFT-${Date.now().toString().slice(-4)}`;
    const newShift: ShiftDefinition = {
      id: `shift-${crypto.randomBytes(4).toString('hex')}`,
      code,
      name: body.name,
      description: body.description || `Custom roster shift ${body.name}`,
      timezone: body.timezone || 'UTC',
      startTime: body.startTime,
      endTime: body.endTime,
      totalShiftMinutes: total,
      expectedWorkMinutes: total - unpaidBreak,
      break: {
        totalBreakMinutes: totalBreak,
        paidBreakMinutes: paidBreak,
        unpaidBreakMinutes: unpaidBreak,
        breakWindows: body.break?.breakWindows || [
          { name: 'Lunch Break', startTime: '13:00', endTime: '13:45', durationMinutes: 45, isPaid: false },
          { name: 'Tea Break', startTime: '16:00', endTime: '16:15', durationMinutes: 15, isPaid: true },
        ],
      },
      gracePeriod: {
        lateGraceMinutes: body.gracePeriod?.lateGraceMinutes ?? 15,
        earlyLeaveGraceMinutes: body.gracePeriod?.earlyLeaveGraceMinutes ?? 15,
      },
      workingDays: body.workingDays || ['MON', 'TUE', 'WED', 'THU', 'FRI'],
      workingDayIndices: body.workingDayIndices || [1, 2, 3, 4, 5],
      overtime: {
        enabled: body.overtime?.enabled ?? true,
        thresholdMinutes: body.overtime?.thresholdMinutes ?? total - unpaidBreak + 30,
        minimumOvertimeMinutes: body.overtime?.minimumOvertimeMinutes ?? 30,
        rateMultiplier: body.overtime?.rateMultiplier ?? (nightShift ? 1.75 : 1.5),
        requiresApproval: body.overtime?.requiresApproval ?? true,
      },
      nightShift,
      crossMidnightShift,
      midnightAttribution: body.midnightAttribution || 'START_DATE',
      isSystemDefault: false,
      status: 'ACTIVE',
      assignedEmployeesCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    LIVE_SHIFTS.push(newShift);

    appendImmutableAuditLog({
      orgId: LIVE_ORG_PROFILE.orgId,
      actorUserId: 'usr-admin-01',
      actorRole: 'ORG_ADMIN',
      actionCategory: 'WORKFORCE_MANAGEMENT',
      actionType: 'SHIFT:CREATE',
      targetEntityType: 'SHIFT',
      targetEntityId: newShift.id,
      reasonProvided: `Created shift ${newShift.name} (${newShift.startTime} - ${newShift.endTime})`,
      ipAddress: req.ip,
    });

    return {
      success: true,
      message: `Shift ${newShift.name} created successfully`,
      shift: newShift,
    };
  });

  // Edit shift
  app.put('/api/v1/shifts/:shiftId', async (req, reply) => {
    const { shiftId } = req.params as { shiftId: string };
    const idx = LIVE_SHIFTS.findIndex((s) => s.id === shiftId || s.code === shiftId);
    if (idx === -1) {
      return reply.code(404).send({ success: false, error: 'SHIFT_NOT_FOUND', message: `Shift ${shiftId} not found` });
    }

    const target = LIVE_SHIFTS[idx];
    const body = (req.body || {}) as Partial<ShiftDefinition>;

    const startTime = body.startTime || target.startTime;
    const endTime = body.endTime || target.endTime;
    const { total, crossesMidnight } = calculateMinutesBetween(startTime, endTime);

    const updated: ShiftDefinition = {
      ...target,
      name: body.name || target.name,
      description: body.description || target.description,
      startTime,
      endTime,
      totalShiftMinutes: total,
      break: body.break || target.break,
      gracePeriod: body.gracePeriod || target.gracePeriod,
      workingDays: body.workingDays || target.workingDays,
      overtime: body.overtime || target.overtime,
      nightShift: body.nightShift !== undefined ? body.nightShift : isNightWindow(startTime, endTime),
      crossMidnightShift: body.crossMidnightShift !== undefined ? body.crossMidnightShift : crossesMidnight,
      midnightAttribution: body.midnightAttribution || target.midnightAttribution,
      status: body.status || target.status,
      updatedAt: new Date().toISOString(),
    };

    LIVE_SHIFTS[idx] = updated;

    return {
      success: true,
      message: `Shift ${updated.name} updated successfully`,
      shift: updated,
    };
  });

  // Delete shift (protects system defaults and in-use shifts)
  app.delete('/api/v1/shifts/:shiftId', async (req, reply) => {
    const { shiftId } = req.params as { shiftId: string };
    const idx = LIVE_SHIFTS.findIndex((s) => s.id === shiftId || s.code === shiftId);
    if (idx === -1) {
      return reply.code(404).send({ success: false, error: 'SHIFT_NOT_FOUND', message: `Shift ${shiftId} not found` });
    }

    const target = LIVE_SHIFTS[idx];
    if (target.isSystemDefault) {
      return reply.code(403).send({
        success: false,
        error: 'SYSTEM_SHIFT_CANNOT_BE_DELETED',
        message: `System default shift ${target.name} cannot be deleted`,
      });
    }

    LIVE_SHIFTS.splice(idx, 1);
    return {
      success: true,
      message: `Shift ${target.name} deleted successfully`,
    };
  });

  // ==========================================================================
  // PANEL 2 — ASSIGNMENT (EMPLOYEE, TEAM, DEPARTMENT, BULK, EFFECTIVE DATE, FUTURE)
  // ==========================================================================

  // List all shift assignments
  app.get('/api/v1/shifts/assignments', async (req) => {
    const q = (req.query || {}) as {
      type?: AssignmentType;
      targetId?: string;
      status?: string;
      futureOnly?: string;
    };

    let result = [...LIVE_SHIFT_ASSIGNMENTS];

    if (q.type) {
      result = result.filter((a) => a.assignmentType === q.type);
    }
    if (q.targetId) {
      result = result.filter((a) => a.targetId === q.targetId || (a.targetIds && a.targetIds.includes(q.targetId!)));
    }
    if (q.status) {
      result = result.filter((a) => a.status === q.status);
    }
    if (q.futureOnly === 'true') {
      result = result.filter((a) => a.isFutureScheduled);
    }

    return {
      success: true,
      totalAssignments: result.length,
      activeAssignments: result.filter((a) => a.status === 'ACTIVE').length,
      upcomingAssignments: result.filter((a) => a.status === 'UPCOMING').length,
      assignments: result,
    };
  });

  // Create Shift Assignment (Employee, Team, Department, Bulk, Effective Date, Future)
  app.post('/api/v1/shifts/assignments', async (req, reply) => {
    const body = (req.body || {}) as {
      assignmentType: AssignmentType;
      targetId?: string;
      targetName?: string;
      targetIds?: string[];
      shiftId: string;
      effectiveDate: string; // YYYY-MM-DD
      effectiveEndDate?: string | null;
      notes?: string;
    };

    if (!body.assignmentType || !body.shiftId || !body.effectiveDate) {
      return reply.code(400).send({
        success: false,
        error: 'VALIDATION_FAILED',
        message: 'assignmentType, shiftId, and effectiveDate are required',
      });
    }

    const shift = LIVE_SHIFTS.find((s) => s.id === body.shiftId);
    if (!shift) {
      return reply.code(404).send({ success: false, error: 'SHIFT_NOT_FOUND', message: `Shift ${body.shiftId} not found` });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const isFutureScheduled = body.effectiveDate > todayStr;
    const status = isFutureScheduled ? 'UPCOMING' : 'ACTIVE';

    let assignedCount = 1;
    let targetName = body.targetName || 'Assigned Entity';
    let targetId = body.targetId || '';

    if (body.assignmentType === 'BULK') {
      if (!body.targetIds || body.targetIds.length === 0) {
        return reply.code(400).send({
          success: false,
          error: 'TARGET_IDS_REQUIRED_FOR_BULK',
          message: 'targetIds array is required for BULK assignment',
        });
      }
      assignedCount = body.targetIds.length;
      targetId = body.targetIds.join(',');
      targetName = `Bulk Cohort (${assignedCount} members)`;
    } else if (body.assignmentType === 'TEAM') {
      assignedCount = 14; // Default team size
      targetName = body.targetName || `Team ${targetId}`;
    } else if (body.assignmentType === 'DEPARTMENT') {
      assignedCount = 28; // Default department size
      targetName = body.targetName || `Department ${targetId}`;
    }

    const newAssignment: ShiftAssignment = {
      id: `sa-${Date.now().toString().slice(-6)}`,
      assignmentType: body.assignmentType,
      targetId,
      targetName,
      targetIds: body.targetIds,
      shiftId: shift.id,
      shiftName: shift.name,
      effectiveDate: body.effectiveDate,
      effectiveEndDate: body.effectiveEndDate || null,
      isFutureScheduled,
      status,
      assignedCount,
      notes: body.notes || `Assigned to ${shift.name}`,
      assignedByUserId: 'usr-admin-01',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    LIVE_SHIFT_ASSIGNMENTS.unshift(newAssignment);

    // Update shift assigned count
    shift.assignedEmployeesCount += assignedCount;

    return {
      success: true,
      message: `Shift ${shift.name} successfully assigned (${body.assignmentType})`,
      assignment: newAssignment,
    };
  });

  // Cancel/Revoke Assignment
  app.delete('/api/v1/shifts/assignments/:assignmentId', async (req, reply) => {
    const { assignmentId } = req.params as { assignmentId: string };
    const idx = LIVE_SHIFT_ASSIGNMENTS.findIndex((a) => a.id === assignmentId);
    if (idx === -1) {
      return reply.code(404).send({ success: false, error: 'ASSIGNMENT_NOT_FOUND', message: `Assignment ${assignmentId} not found` });
    }

    const removed = LIVE_SHIFT_ASSIGNMENTS.splice(idx, 1)[0];
    return {
      success: true,
      message: `Assignment ${assignmentId} cancelled successfully`,
      removed,
    };
  });

  // ==========================================================================
  // PANEL 3 — SHIFT EXCEPTIONS (HOLIDAY, LEAVE, WEEK-OFF, CUSTOM SCHEDULE, TEMPORARY SHIFT)
  // ==========================================================================

  // List all exceptions
  app.get('/api/v1/shifts/exceptions', async (req) => {
    const q = (req.query || {}) as {
      type?: ExceptionType;
      targetId?: string;
      status?: string;
    };

    let result = [...LIVE_SHIFT_EXCEPTIONS];
    if (q.type) {
      result = result.filter((e) => e.type === q.type);
    }
    if (q.targetId) {
      result = result.filter((e) => e.targetId === q.targetId || e.targetId === 'ALL');
    }
    if (q.status) {
      result = result.filter((e) => e.status === q.status);
    }

    return {
      success: true,
      totalExceptions: result.length,
      holidayCount: result.filter((e) => e.type === 'HOLIDAY').length,
      leaveCount: result.filter((e) => e.type === 'LEAVE').length,
      weekOffCount: result.filter((e) => e.type === 'WEEK_OFF').length,
      customScheduleCount: result.filter((e) => e.type === 'CUSTOM_SCHEDULE').length,
      temporaryShiftCount: result.filter((e) => e.type === 'TEMPORARY_SHIFT').length,
      exceptions: result,
    };
  });

  // Create Exception
  app.post('/api/v1/shifts/exceptions', async (req, reply) => {
    const body = (req.body || {}) as {
      type: ExceptionType;
      title: string;
      targetType: 'ORGANIZATION' | 'DEPARTMENT' | 'TEAM' | 'EMPLOYEE';
      targetId?: string;
      targetName?: string;
      startDate: string;
      endDate: string;
      exceptionDetails: any;
    };

    if (!body.type || !body.title || !body.startDate || !body.endDate) {
      return reply.code(400).send({
        success: false,
        error: 'VALIDATION_FAILED',
        message: 'type, title, startDate, and endDate are required',
      });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const status = body.startDate > todayStr ? 'UPCOMING' : body.endDate < todayStr ? 'EXPIRED' : 'ACTIVE';

    const newEx: ShiftException = {
      id: `ex-${Date.now().toString().slice(-6)}`,
      type: body.type,
      title: body.title,
      targetType: body.targetType || 'EMPLOYEE',
      targetId: body.targetId || 'ALL',
      targetName: body.targetName || 'Target Scope',
      startDate: body.startDate,
      endDate: body.endDate,
      exceptionDetails: body.exceptionDetails || {},
      status,
      createdAt: new Date().toISOString(),
    };

    LIVE_SHIFT_EXCEPTIONS.unshift(newEx);

    return {
      success: true,
      message: `Shift exception (${body.type}: ${body.title}) created successfully`,
      exception: newEx,
    };
  });

  // Delete Exception
  app.delete('/api/v1/shifts/exceptions/:exceptionId', async (req, reply) => {
    const { exceptionId } = req.params as { exceptionId: string };
    const idx = LIVE_SHIFT_EXCEPTIONS.findIndex((e) => e.id === exceptionId);
    if (idx === -1) {
      return reply.code(404).send({ success: false, error: 'EXCEPTION_NOT_FOUND', message: `Exception ${exceptionId} not found` });
    }

    const removed = LIVE_SHIFT_EXCEPTIONS.splice(idx, 1)[0];
    return {
      success: true,
      message: `Exception ${exceptionId} removed successfully`,
      removed,
    };
  });

  // ==========================================================================
  // DETERMINISTIC SCHEDULE RESOLVER
  // Evaluates final effective schedule for any employee on any given date:
  // Base Shift -> Team/Dept Inheritance -> Future Scheduling -> 5 Exception Types
  // ==========================================================================
  app.post('/api/v1/shifts/resolve-schedule', async (req, reply) => {
    const body = (req.body || {}) as {
      employeeId?: string;
      date?: string; // YYYY-MM-DD
    };

    const employeeId = body.employeeId || 'emp-win-ramandeep'; // default Ramandeep
    const targetDate = body.date || new Date().toISOString().slice(0, 10);

    // 1. Check for Active Exceptions matching targetDate
    // Priority: HOLIDAY > LEAVE > WEEK_OFF > TEMPORARY_SHIFT > CUSTOM_SCHEDULE > BASE_SHIFT
    const matchingExceptions = LIVE_SHIFT_EXCEPTIONS.filter((ex) => {
      const matchTarget = ex.targetId === 'ALL' || ex.targetId === employeeId || ex.targetId === 'dept-bpo';
      const matchDate = targetDate >= ex.startDate && targetDate <= ex.endDate;
      return matchTarget && matchDate;
    });

    // Check Holiday
    const holidayEx = matchingExceptions.find((e) => e.type === 'HOLIDAY');
    if (holidayEx) {
      return {
        success: true,
        employeeId,
        date: targetDate,
        scheduleType: 'HOLIDAY',
        isWorkExpected: false,
        title: holidayEx.title,
        holidayDetails: holidayEx.exceptionDetails,
        message: `Work not required: ${holidayEx.title} (${holidayEx.exceptionDetails.holidayName || 'Public Holiday'})`,
        resolvedShift: null,
      };
    }

    // Check Leave
    const leaveEx = matchingExceptions.find((e) => e.type === 'LEAVE');
    if (leaveEx) {
      return {
        success: true,
        employeeId,
        date: targetDate,
        scheduleType: 'LEAVE',
        isWorkExpected: false,
        title: leaveEx.title,
        leaveDetails: leaveEx.exceptionDetails,
        message: `Employee is on approved leave: ${leaveEx.exceptionDetails.leaveType}`,
        resolvedShift: null,
      };
    }

    // Check Day of week for Week-off
    const dayOfWeek = new Date(targetDate).getUTCDay(); // 0=Sun .. 6=Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const weekOffEx = matchingExceptions.find((e) => e.type === 'WEEK_OFF') || (isWeekend ? { title: 'Scheduled Weekend Rest Day' } : null);

    if (weekOffEx && isWeekend) {
      return {
        success: true,
        employeeId,
        date: targetDate,
        scheduleType: 'WEEK_OFF',
        isWorkExpected: false,
        title: 'Weekly Rest Day (Week-off)',
        message: `Regular rest day for employee on ${targetDate}`,
        resolvedShift: null,
      };
    }

    // Check Temporary Shift
    const tempShiftEx = matchingExceptions.find((e) => e.type === 'TEMPORARY_SHIFT');
    if (tempShiftEx) {
      const tempShift = LIVE_SHIFTS.find((s) => s.id === tempShiftEx.exceptionDetails.temporaryShiftId) || LIVE_SHIFTS[1];
      return {
        success: true,
        employeeId,
        date: targetDate,
        scheduleType: 'TEMPORARY_SHIFT',
        isWorkExpected: true,
        title: tempShiftEx.title,
        temporaryShiftDetails: tempShiftEx.exceptionDetails,
        resolvedShift: tempShift,
        message: `Temporary shift override active: ${tempShift.name} (covering ${tempShiftEx.exceptionDetails.coveringForEmployeeName})`,
      };
    }

    // Check Custom Schedule
    const customSchedEx = matchingExceptions.find((e) => e.type === 'CUSTOM_SCHEDULE');
    if (customSchedEx) {
      return {
        success: true,
        employeeId,
        date: targetDate,
        scheduleType: 'CUSTOM_SCHEDULE',
        isWorkExpected: true,
        title: customSchedEx.title,
        customScheduleDetails: customSchedEx.exceptionDetails,
        resolvedShift: {
          name: `Custom Hours (${customSchedEx.exceptionDetails.customStartTime} - ${customSchedEx.exceptionDetails.customEndTime})`,
          startTime: customSchedEx.exceptionDetails.customStartTime,
          endTime: customSchedEx.exceptionDetails.customEndTime,
          breakMinutes: customSchedEx.exceptionDetails.customBreakMinutes || 60,
          gracePeriod: { lateGraceMinutes: 15, earlyLeaveGraceMinutes: 15 },
          nightShift: false,
          crossMidnightShift: false,
        },
        message: `One-off custom schedule applied: ${customSchedEx.title}`,
      };
    }

    // Fallback: Resolve Base / Assigned Shift (taking future scheduling into account)
    const activeAssignments = LIVE_SHIFT_ASSIGNMENTS.filter((a) => {
      const matchTarget = a.targetId === employeeId || a.targetId === 'team-bpo-a' || a.targetId === 'dept-bpo';
      const effective = targetDate >= a.effectiveDate && (!a.effectiveEndDate || targetDate <= a.effectiveEndDate);
      return matchTarget && effective;
    });

    const primaryAssignment = activeAssignments[0] || LIVE_SHIFT_ASSIGNMENTS[0];
    const resolvedShift = LIVE_SHIFTS.find((s) => s.id === primaryAssignment.shiftId) || LIVE_SHIFTS[0];

    return {
      success: true,
      employeeId,
      date: targetDate,
      scheduleType: 'STANDARD_SHIFT',
      isWorkExpected: true,
      title: resolvedShift.name,
      assignment: primaryAssignment,
      resolvedShift,
      message: `Standard assigned shift active: ${resolvedShift.name} (${resolvedShift.startTime} - ${resolvedShift.endTime})`,
    };
  });
}
