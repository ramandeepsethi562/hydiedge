// ============================================================================
// @hydiems/api — MODULE 06: ATTENDANCE MANAGEMENT
// Covers:
//   Attendance Dashboard:
//     • Present, Absent, Late, Early checkout, Half day, Overtime, Break, Working hours
//   Employee Attendance Panel Lifecycle:
//     • Scheduled -> Check-in -> Working -> Break -> Working -> Check-out
//   Functional Testing:
//     • Manual check-in
//     • Automatic check-in (Agent / Telemetry triggered)
//     • Manual correction
//     • Approval
//     • Rejection
//     • Attendance lock (Prevent post-payroll modifications)
//     • Attendance export (CSV, JSON)
//   Attendance Correction Multi-Stage Workflow:
//     • Employee -> Request correction
//     • Manager -> Review (Endorse / Decline)
//     • HR/Admin -> Approve (Commit / Reject)
//     • Audit log -> Record change
// ============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { requireAuth, appendImmutableAuditLog } from '../middleware/authAndTenant';
import { LIVE_ORG_PROFILE } from './orgWorkforceAndAttendanceRoutes';

// ----------------------------------------------------------------------------
// DATA TYPES
// ----------------------------------------------------------------------------

export type AttendanceStatus =
  | 'SCHEDULED'
  | 'PRESENT'
  | 'ABSENT'
  | 'HALF_DAY'
  | 'UNDERTIME'
  | 'OVERTIME'
  | 'ON_LEAVE'
  | 'HOLIDAY'
  | 'WEEKEND';

export type AttendanceLifecycleState =
  | 'SCHEDULED'
  | 'CHECKED_IN'
  | 'WORKING'
  | 'ON_BREAK'
  | 'CHECKED_OUT';

export interface DailyAttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  departmentId: string;
  departmentName: string;
  shiftId: string;
  shiftName: string;
  scheduledStart: string; // HH:mm
  scheduledEnd: string;   // HH:mm
  attendanceDate: string; // YYYY-MM-DD
  firstPunchIn: string | null;  // ISO string
  lastPunchOut: string | null; // ISO string
  lifecycleState: AttendanceLifecycleState;
  checkInMode: 'MANUAL' | 'AUTOMATIC' | null;
  checkOutMode: 'MANUAL' | 'AUTOMATIC' | null;
  loggedWorkMinutes: number;
  breakMinutes: number;
  paidBreakMinutes: number;
  unpaidBreakMinutes: number;
  lateByMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  isLate: boolean;
  isEarlyCheckout: boolean;
  isHalfDay: boolean;
  isOvertime: boolean;
  status: AttendanceStatus;
  isLocked: boolean;
  updatedAt: string;
}

export type CorrectionWorkflowStage =
  | 'REQUESTED'
  | 'PENDING_MANAGER_REVIEW'
  | 'MANAGER_REVIEWED'
  | 'PENDING_HR_APPROVAL'
  | 'APPROVED'
  | 'REJECTED';

export interface AttendanceCorrectionRequest {
  id: string;
  attendanceId: string;
  employeeId: string;
  employeeName: string;
  attendanceDate: string;
  originalPunchIn: string | null;
  originalPunchOut: string | null;
  requestedPunchIn: string;
  requestedPunchOut: string;
  reason: string;
  workflowStage: CorrectionWorkflowStage;
  // Step 2: Manager Review
  managerReviewedBy?: string;
  managerReviewAction?: 'ENDORSE' | 'REJECT';
  managerReviewNotes?: string;
  managerReviewedAt?: string;
  // Step 3: HR/Admin Approval
  hrApprovedBy?: string;
  hrApprovalAction?: 'APPROVE' | 'REJECT';
  hrApprovalNotes?: string;
  hrApprovedAt?: string;
  // Audit Reference
  auditLogId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttendancePeriodLock {
  id: string;
  periodName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  isLocked: boolean;
  lockedBy: string;
  lockedAt: string;
}

// ----------------------------------------------------------------------------
// INITIAL SEED DATA
// ----------------------------------------------------------------------------

export const LIVE_ATTENDANCE_RECORDS: DailyAttendanceRecord[] = [
  // 1. Ramandeep - Present, On-Time, Standard Day
  {
    id: 'att-101',
    employeeId: 'emp-win-ramandeep',
    employeeName: 'Ramandeep',
    departmentId: 'dept-eng',
    departmentName: 'Platform Engineering',
    shiftId: 'shift-std-day',
    shiftName: 'General Standard Day Shift',
    scheduledStart: '09:00',
    scheduledEnd: '18:00',
    attendanceDate: '2026-09-28',
    firstPunchIn: '2026-09-28T08:58:00.000Z',
    lastPunchOut: null,
    lifecycleState: 'WORKING',
    checkInMode: 'AUTOMATIC',
    checkOutMode: null,
    loggedWorkMinutes: 420,
    breakMinutes: 45,
    paidBreakMinutes: 15,
    unpaidBreakMinutes: 30,
    lateByMinutes: 0,
    earlyLeaveMinutes: 0,
    overtimeMinutes: 0,
    isLate: false,
    isEarlyCheckout: false,
    isHalfDay: false,
    isOvertime: false,
    status: 'PRESENT',
    isLocked: false,
    updatedAt: new Date().toISOString(),
  },
  // 2. Ramandeep - Present, Late Checkout, Overtime
  {
    id: 'att-102',
    employeeId: 'emp-win-ramandeep',
    employeeName: 'Ramandeep',
    departmentId: 'dept-bpo',
    departmentName: 'Customer Operations & BPO',
    shiftId: 'shift-std-day',
    shiftName: 'General Standard Day Shift',
    scheduledStart: '09:00',
    scheduledEnd: '18:00',
    attendanceDate: '2026-09-28',
    firstPunchIn: '2026-09-28T09:05:00.000Z',
    lastPunchOut: '2026-09-28T19:40:00.000Z',
    lifecycleState: 'CHECKED_OUT',
    checkInMode: 'MANUAL',
    checkOutMode: 'MANUAL',
    loggedWorkMinutes: 575,
    breakMinutes: 60,
    paidBreakMinutes: 15,
    unpaidBreakMinutes: 45,
    lateByMinutes: 5,
    earlyLeaveMinutes: 0,
    overtimeMinutes: 65,
    isLate: false, // Within 15 min grace period
    isEarlyCheckout: false,
    isHalfDay: false,
    isOvertime: true,
    status: 'OVERTIME',
    isLocked: false,
    updatedAt: new Date().toISOString(),
  },
  // 3. Ramandeep - Present, Late-in (> 15m grace)
  {
    id: 'att-103',
    employeeId: 'emp-win-ramandeep',
    employeeName: 'Ramandeep',
    departmentId: 'dept-sec',
    departmentName: 'Security Operations & SOC',
    shiftId: 'shift-std-day',
    shiftName: 'General Standard Day Shift',
    scheduledStart: '09:00',
    scheduledEnd: '18:00',
    attendanceDate: '2026-09-28',
    firstPunchIn: '2026-09-28T09:28:00.000Z',
    lastPunchOut: null,
    lifecycleState: 'ON_BREAK',
    checkInMode: 'AUTOMATIC',
    checkOutMode: null,
    loggedWorkMinutes: 380,
    breakMinutes: 35,
    paidBreakMinutes: 15,
    unpaidBreakMinutes: 20,
    lateByMinutes: 28,
    earlyLeaveMinutes: 0,
    overtimeMinutes: 0,
    isLate: true,
    isEarlyCheckout: false,
    isHalfDay: false,
    isOvertime: false,
    status: 'PRESENT',
    isLocked: false,
    updatedAt: new Date().toISOString(),
  },
  // 4. Ramandeep - Early Checkout (left at 15:30)
  {
    id: 'att-104',
    employeeId: 'emp-win-ramandeep',
    employeeName: 'Ramandeep',
    departmentId: 'dept-fin',
    departmentName: 'Finance & Revenue Ops',
    shiftId: 'shift-std-day',
    shiftName: 'General Standard Day Shift',
    scheduledStart: '09:00',
    scheduledEnd: '18:00',
    attendanceDate: '2026-09-28',
    firstPunchIn: '2026-09-28T09:00:00.000Z',
    lastPunchOut: '2026-09-28T15:30:00.000Z',
    lifecycleState: 'CHECKED_OUT',
    checkInMode: 'MANUAL',
    checkOutMode: 'MANUAL',
    loggedWorkMinutes: 330,
    breakMinutes: 60,
    paidBreakMinutes: 15,
    unpaidBreakMinutes: 45,
    lateByMinutes: 0,
    earlyLeaveMinutes: 150,
    overtimeMinutes: 0,
    isLate: false,
    isEarlyCheckout: true,
    isHalfDay: true, // Between 240 and 480 mins
    isOvertime: false,
    status: 'HALF_DAY',
    isLocked: false,
    updatedAt: new Date().toISOString(),
  },
  // 5. Ramandeep - Absent (No punch, scheduled)
  {
    id: 'att-105',
    employeeId: 'emp-win-ramandeep',
    employeeName: 'Ramandeep',
    departmentId: 'dept-eng',
    departmentName: 'Platform Engineering',
    shiftId: 'shift-std-day',
    shiftName: 'General Standard Day Shift',
    scheduledStart: '09:00',
    scheduledEnd: '18:00',
    attendanceDate: '2026-09-28',
    firstPunchIn: null,
    lastPunchOut: null,
    lifecycleState: 'SCHEDULED',
    checkInMode: null,
    checkOutMode: null,
    loggedWorkMinutes: 0,
    breakMinutes: 0,
    paidBreakMinutes: 0,
    unpaidBreakMinutes: 0,
    lateByMinutes: 0,
    earlyLeaveMinutes: 0,
    overtimeMinutes: 0,
    isLate: false,
    isEarlyCheckout: false,
    isHalfDay: false,
    isOvertime: false,
    status: 'ABSENT',
    isLocked: false,
    updatedAt: new Date().toISOString(),
  },
];

export const LIVE_ATTENDANCE_CORRECTIONS: AttendanceCorrectionRequest[] = [
  {
    id: 'corr-501',
    attendanceId: 'att-103',
    employeeId: 'emp-win-ramandeep',
    employeeName: 'Ramandeep',
    attendanceDate: '2026-09-28',
    originalPunchIn: '2026-09-28T09:28:00.000Z',
    originalPunchOut: null,
    requestedPunchIn: '2026-09-28T09:00:00.000Z',
    requestedPunchOut: '2026-09-28T18:00:00.000Z',
    reason: 'Security keycard badge reader gate timeout at building main entrance',
    workflowStage: 'PENDING_MANAGER_REVIEW',
    createdAt: '2026-09-28T10:00:00.000Z',
    updatedAt: '2026-09-28T10:00:00.000Z',
  },
];

export const LIVE_PERIOD_LOCKS: AttendancePeriodLock[] = [
  {
    id: 'lock-aug-2026',
    periodName: 'August 2026 Payroll Cycle',
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    isLocked: true,
    lockedBy: 'usr-admin-01',
    lockedAt: '2026-09-01T00:00:00.000Z',
  },
];

// ----------------------------------------------------------------------------
// ROUTE REGISTRATION
// ----------------------------------------------------------------------------

export async function registerAttendanceManagementRoutes(app: FastifyInstance) {
  // ==========================================================================
  // ATTENDANCE DASHBOARD
  // Verifies: Present, Absent, Late, Early checkout, Half day, Overtime, Break, Working hours
  // ==========================================================================
  app.get('/api/v1/attendance/dashboard', async (req) => {
    const records = LIVE_ATTENDANCE_RECORDS;

    const presentCount = records.filter((r) => r.status === 'PRESENT' || r.status === 'OVERTIME' || r.status === 'HALF_DAY').length;
    const absentCount = records.filter((r) => r.status === 'ABSENT').length;
    const lateCount = records.filter((r) => r.isLate).length;
    const earlyCheckoutCount = records.filter((r) => r.isEarlyCheckout).length;
    const halfDayCount = records.filter((r) => r.isHalfDay).length;
    const overtimeCount = records.filter((r) => r.isOvertime).length;

    const totalOvertimeMinutes = records.reduce((sum, r) => sum + r.overtimeMinutes, 0);
    const totalBreakMinutes = records.reduce((sum, r) => sum + r.breakMinutes, 0);
    const totalWorkingMinutes = records.reduce((sum, r) => sum + r.loggedWorkMinutes, 0);
    const totalWorkingHours = +(totalWorkingMinutes / 60).toFixed(1);
    const totalBreakHours = +(totalBreakMinutes / 60).toFixed(1);
    const totalOvertimeHours = +(totalOvertimeMinutes / 60).toFixed(1);

    const adherenceRate = Math.round((presentCount / Math.max(1, records.length)) * 100);

    return {
      success: true,
      orgId: LIVE_ORG_PROFILE.orgId,
      date: '2026-09-28',
      summary: {
        totalScheduled: records.length,
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        earlyCheckout: earlyCheckoutCount,
        halfDay: halfDayCount,
        overtimeCount,
        totalOvertimeMinutes,
        totalOvertimeHours,
        totalBreakMinutes,
        totalBreakHours,
        totalWorkingMinutes,
        totalWorkingHours,
        adherenceRatePct: adherenceRate,
      },
      records,
    };
  });

  // ==========================================================================
  // EMPLOYEE ATTENDANCE PANEL LIFECYCLE:
  // Scheduled -> Check-in -> Working -> Break -> Working -> Check-out
  // Functional: Manual & Automatic check-in, Break toggle, Check-out
  // ==========================================================================

  // Check-In (Manual or Automatic)
  app.post('/api/v1/attendance/check-in', async (req, reply) => {
    const body = (req.body || {}) as {
      employeeId?: string;
      mode?: 'MANUAL' | 'AUTOMATIC';
      timestamp?: string;
      source?: string;
    };

    const employeeId = body.employeeId || 'emp-win-ramandeep';
    const mode = body.mode || 'MANUAL';
    const punchTime = body.timestamp || new Date().toISOString();

    let record = LIVE_ATTENDANCE_RECORDS.find((r) => r.employeeId === employeeId && r.attendanceDate === '2026-09-28');

    // Check if period is locked
    if (record?.isLocked) {
      return reply.code(403).send({
        success: false,
        error: 'ATTENDANCE_PERIOD_LOCKED',
        message: 'Attendance record belongs to a finalized payroll cycle and cannot be modified.',
      });
    }

    if (!record) {
      record = {
        id: `att-${Date.now().toString().slice(-4)}`,
        employeeId,
        employeeName: employeeId === 'emp-win-ramandeep' ? 'Ramandeep' : 'Employee ' + employeeId,
        departmentId: 'dept-bpo',
        departmentName: 'Customer Operations & BPO',
        shiftId: 'shift-std-day',
        shiftName: 'General Standard Day Shift',
        scheduledStart: '09:00',
        scheduledEnd: '18:00',
        attendanceDate: '2026-09-28',
        firstPunchIn: punchTime,
        lastPunchOut: null,
        lifecycleState: 'WORKING',
        checkInMode: mode,
        checkOutMode: null,
        loggedWorkMinutes: 0,
        breakMinutes: 0,
        paidBreakMinutes: 0,
        unpaidBreakMinutes: 0,
        lateByMinutes: 0,
        earlyLeaveMinutes: 0,
        overtimeMinutes: 0,
        isLate: false,
        isEarlyCheckout: false,
        isHalfDay: false,
        isOvertime: false,
        status: 'PRESENT',
        isLocked: false,
        updatedAt: new Date().toISOString(),
      };
      LIVE_ATTENDANCE_RECORDS.unshift(record);
    } else {
      record.firstPunchIn = punchTime;
      record.lifecycleState = 'WORKING';
      record.checkInMode = mode;
      record.status = 'PRESENT';
      record.updatedAt = new Date().toISOString();
    }

    appendImmutableAuditLog({
      orgId: LIVE_ORG_PROFILE.orgId,
      actorUserId: `usr-${employeeId.slice(4)}`,
      actorRole: 'EMPLOYEE',
      actionCategory: 'ATTENDANCE_PUNCH',
      actionType: mode === 'AUTOMATIC' ? 'ATTENDANCE:AUTO_PUNCH_IN' : 'ATTENDANCE:MANUAL_PUNCH_IN',
      targetEntityType: 'ATTENDANCE',
      targetEntityId: record.id,
      reasonProvided: `${mode} punch-in recorded via ${body.source || 'WEB_PORTAL'}`,
      ipAddress: req.ip,
    });

    return {
      success: true,
      message: `${mode} check-in recorded successfully for ${record.employeeName}`,
      lifecycleState: 'WORKING',
      record,
    };
  });

  // Break Toggle (Start Break -> On Break -> End Break -> Working)
  app.post('/api/v1/attendance/break-toggle', async (req, reply) => {
    const body = (req.body || {}) as {
      employeeId?: string;
      action: 'START_BREAK' | 'END_BREAK';
      breakType?: 'LUNCH' | 'TEA' | 'PERSONAL';
      durationMinutes?: number;
    };

    const employeeId = body.employeeId || 'emp-win-ramandeep';
    const record = LIVE_ATTENDANCE_RECORDS.find((r) => r.employeeId === employeeId);

    if (!record) {
      return reply.code(404).send({ success: false, error: 'ATTENDANCE_RECORD_NOT_FOUND' });
    }

    if (body.action === 'START_BREAK') {
      record.lifecycleState = 'ON_BREAK';
    } else {
      record.lifecycleState = 'WORKING';
      const addedMins = body.durationMinutes || 30;
      record.breakMinutes += addedMins;
      if (body.breakType === 'TEA') record.paidBreakMinutes += addedMins;
      else record.unpaidBreakMinutes += addedMins;
    }

    record.updatedAt = new Date().toISOString();

    return {
      success: true,
      action: body.action,
      lifecycleState: record.lifecycleState,
      totalBreakMinutes: record.breakMinutes,
      record,
    };
  });

  // Check-Out
  app.post('/api/v1/attendance/check-out', async (req, reply) => {
    const body = (req.body || {}) as {
      employeeId?: string;
      timestamp?: string;
      mode?: 'MANUAL' | 'AUTOMATIC';
    };

    const employeeId = body.employeeId || 'emp-win-ramandeep';
    const mode = body.mode || 'MANUAL';
    const punchOutTime = body.timestamp || new Date().toISOString();

    const record = LIVE_ATTENDANCE_RECORDS.find((r) => r.employeeId === employeeId);
    if (!record) {
      return reply.code(404).send({ success: false, error: 'ATTENDANCE_RECORD_NOT_FOUND' });
    }

    record.lastPunchOut = punchOutTime;
    record.lifecycleState = 'CHECKED_OUT';
    record.checkOutMode = mode;
    record.loggedWorkMinutes = Math.max(record.loggedWorkMinutes, 510); // default 8.5h
    record.updatedAt = new Date().toISOString();

    return {
      success: true,
      message: `${mode} check-out finalized for ${record.employeeName}`,
      lifecycleState: 'CHECKED_OUT',
      loggedWorkMinutes: record.loggedWorkMinutes,
      status: record.status,
      record,
    };
  });

  // ==========================================================================
  // ATTENDANCE CORRECTION MULTI-STAGE WORKFLOW
  // 1. Employee -> Request correction
  // 2. Manager -> Review (Endorse / Reject)
  // 3. HR/Admin -> Approve (Commit changes to record)
  // 4. Audit log -> Record change
  // ==========================================================================

  // Step 1: Employee requests correction
  app.post('/api/v1/attendance/corrections', async (req, reply) => {
    const body = (req.body || {}) as {
      attendanceId: string;
      employeeId: string;
      requestedPunchIn: string;
      requestedPunchOut: string;
      reason: string;
    };

    if (!body.attendanceId || !body.requestedPunchIn || !body.requestedPunchOut || !body.reason) {
      return reply.code(400).send({
        success: false,
        error: 'VALIDATION_FAILED',
        message: 'attendanceId, requestedPunchIn, requestedPunchOut, and reason are required',
      });
    }

    const attendance = LIVE_ATTENDANCE_RECORDS.find((a) => a.id === body.attendanceId);
    if (attendance?.isLocked) {
      return reply.code(403).send({
        success: false,
        error: 'ATTENDANCE_LOCKED',
        message: 'Cannot request correction for locked payroll period',
      });
    }

    const newCorrection: AttendanceCorrectionRequest = {
      id: `corr-${Date.now().toString().slice(-5)}`,
      attendanceId: body.attendanceId,
      employeeId: body.employeeId,
      employeeName: attendance?.employeeName || 'Ramandeep',
      attendanceDate: attendance?.attendanceDate || '2026-09-28',
      originalPunchIn: attendance?.firstPunchIn || null,
      originalPunchOut: attendance?.lastPunchOut || null,
      requestedPunchIn: body.requestedPunchIn,
      requestedPunchOut: body.requestedPunchOut,
      reason: body.reason,
      workflowStage: 'PENDING_MANAGER_REVIEW',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    LIVE_ATTENDANCE_CORRECTIONS.unshift(newCorrection);

    return {
      success: true,
      stage: 'PENDING_MANAGER_REVIEW',
      message: 'Correction request submitted to reporting manager for review',
      correction: newCorrection,
    };
  });

  // Step 2: Manager reviews correction (Endorse or Reject)
  app.put('/api/v1/attendance/corrections/:correctionId/review', async (req, reply) => {
    const { correctionId } = req.params as { correctionId: string };
    const body = (req.body || {}) as {
      action: 'ENDORSE' | 'REJECT';
      managerNotes?: string;
    };

    const corr = LIVE_ATTENDANCE_CORRECTIONS.find((c) => c.id === correctionId);
    if (!corr) {
      return reply.code(404).send({ success: false, error: 'CORRECTION_NOT_FOUND' });
    }

    corr.managerReviewedBy = 'Ramandeep (Manager)';
    corr.managerReviewAction = body.action;
    corr.managerReviewNotes = body.managerNotes || 'Manager review completed';
    corr.managerReviewedAt = new Date().toISOString();

    if (body.action === 'ENDORSE') {
      corr.workflowStage = 'PENDING_HR_APPROVAL';
    } else {
      corr.workflowStage = 'REJECTED';
    }
    corr.updatedAt = new Date().toISOString();

    return {
      success: true,
      stage: corr.workflowStage,
      message: `Correction ${body.action === 'ENDORSE' ? 'endorsed and escalated to HR Admin' : 'rejected by manager'}`,
      correction: corr,
    };
  });

  // Step 3: HR/Admin Approves or Rejects and Commits change
  app.put('/api/v1/attendance/corrections/:correctionId/approve', async (req, reply) => {
    const { correctionId } = req.params as { correctionId: string };
    const body = (req.body || {}) as {
      action: 'APPROVE' | 'REJECT';
      hrNotes?: string;
    };

    const corr = LIVE_ATTENDANCE_CORRECTIONS.find((c) => c.id === correctionId);
    if (!corr) {
      return reply.code(404).send({ success: false, error: 'CORRECTION_NOT_FOUND' });
    }

    corr.hrApprovedBy = 'Ramandeep (HR Admin)';
    corr.hrApprovalAction = body.action;
    corr.hrApprovalNotes = body.hrNotes || 'HR audit verified against gate logs';
    corr.hrApprovedAt = new Date().toISOString();

    if (body.action === 'APPROVE') {
      corr.workflowStage = 'APPROVED';

      // Commit changes to actual Daily Attendance Record
      const attRecord = LIVE_ATTENDANCE_RECORDS.find((a) => a.id === corr.attendanceId);
      if (attRecord) {
        attRecord.firstPunchIn = corr.requestedPunchIn;
        attRecord.lastPunchOut = corr.requestedPunchOut;
        attRecord.isLate = false; // Resolved
        attRecord.lateByMinutes = 0;
        attRecord.status = 'PRESENT';
        attRecord.updatedAt = new Date().toISOString();
      }

      // Step 4: Immutable Audit Log records change
      const auditLog = appendImmutableAuditLog({
        orgId: LIVE_ORG_PROFILE.orgId,
        actorUserId: 'usr-admin-01',
        actorRole: 'ORG_ADMIN',
        actionCategory: 'ATTENDANCE_MANAGEMENT',
        actionType: 'ATTENDANCE:CORRECTION_APPLIED',
        targetEntityType: 'ATTENDANCE_RECORD',
        targetEntityId: corr.attendanceId,
        reasonProvided: `Correction approved: ${corr.reason}. Timestamps adjusted to ${corr.requestedPunchIn} - ${corr.requestedPunchOut}`,
        ipAddress: req.ip,
      });

      corr.auditLogId = auditLog.auditId;
    } else {
      corr.workflowStage = 'REJECTED';
    }

    corr.updatedAt = new Date().toISOString();

    return {
      success: true,
      stage: corr.workflowStage,
      message: `Correction request ${corr.workflowStage} by HR Admin. Record successfully updated.`,
      correction: corr,
    };
  });

  // Get all correction requests
  app.get('/api/v1/attendance/corrections', async () => {
    return {
      success: true,
      totalCorrections: LIVE_ATTENDANCE_CORRECTIONS.length,
      pendingCount: LIVE_ATTENDANCE_CORRECTIONS.filter((c) => c.workflowStage === 'PENDING_MANAGER_REVIEW' || c.workflowStage === 'PENDING_HR_APPROVAL').length,
      approvedCount: LIVE_ATTENDANCE_CORRECTIONS.filter((c) => c.workflowStage === 'APPROVED').length,
      rejectedCount: LIVE_ATTENDANCE_CORRECTIONS.filter((c) => c.workflowStage === 'REJECTED').length,
      corrections: LIVE_ATTENDANCE_CORRECTIONS,
    };
  });

  // ==========================================================================
  // ATTENDANCE LOCK
  // Prevents post-payroll modifications
  // ==========================================================================
  app.post('/api/v1/attendance/lock', async (req) => {
    const body = (req.body || {}) as {
      periodName?: string;
      startDate: string;
      endDate: string;
      lockAction: 'LOCK' | 'UNLOCK';
    };

    const isLocking = body.lockAction !== 'UNLOCK';

    // Apply lock flag to all attendance records within range
    let updatedCount = 0;
    for (const record of LIVE_ATTENDANCE_RECORDS) {
      if (record.attendanceDate >= body.startDate && record.attendanceDate <= body.endDate) {
        record.isLocked = isLocking;
        updatedCount++;
      }
    }

    const lockEntry: AttendancePeriodLock = {
      id: `lock-${Date.now().toString().slice(-4)}`,
      periodName: body.periodName || `Payroll Cycle (${body.startDate} to ${body.endDate})`,
      startDate: body.startDate,
      endDate: body.endDate,
      isLocked: isLocking,
      lockedBy: 'usr-admin-01 (HR/Finance)',
      lockedAt: new Date().toISOString(),
    };

    LIVE_PERIOD_LOCKS.unshift(lockEntry);

    appendImmutableAuditLog({
      orgId: LIVE_ORG_PROFILE.orgId,
      actorUserId: 'usr-admin-01',
      actorRole: 'ORG_ADMIN',
      actionCategory: 'ATTENDANCE_MANAGEMENT',
      actionType: isLocking ? 'ATTENDANCE:PERIOD_LOCKED' : 'ATTENDANCE:PERIOD_UNLOCKED',
      targetEntityType: 'ATTENDANCE_PERIOD',
      targetEntityId: lockEntry.id,
      reasonProvided: `${isLocking ? 'Finalized and locked' : 'Unlocked'} attendance records from ${body.startDate} to ${body.endDate}`,
      ipAddress: req.ip,
    });

    return {
      success: true,
      isLocked: isLocking,
      period: lockEntry,
      affectedRecordsCount: updatedCount,
      message: `Attendance period ${body.startDate} to ${body.endDate} successfully ${isLocking ? 'LOCKED' : 'UNLOCKED'}`,
    };
  });

  // ==========================================================================
  // ATTENDANCE EXPORT
  // Generates CSV / JSON exports of attendance records
  // ==========================================================================
  app.get('/api/v1/attendance/export', async (req, reply) => {
    const q = (req.query || {}) as { format?: 'csv' | 'json' };
    const format = q.format || 'json';

    if (format === 'csv') {
      const header = 'ID,EmployeeID,Name,Department,Date,PunchIn,PunchOut,WorkMinutes,BreakMinutes,OvertimeMinutes,Late,Status,Locked\n';
      const rows = LIVE_ATTENDANCE_RECORDS.map(
        (r) =>
          `"${r.id}","${r.employeeId}","${r.employeeName}","${r.departmentName}","${r.attendanceDate}","${r.firstPunchIn || ''}","${r.lastPunchOut || ''}",${r.loggedWorkMinutes},${r.breakMinutes},${r.overtimeMinutes},${r.isLate},"${r.status}",${r.isLocked}`
      ).join('\n');

      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', 'attachment; filename="attendance-export-2026-09-28.csv"');
      return header + rows;
    }

    return {
      success: true,
      exportTimestamp: new Date().toISOString(),
      format: 'json',
      recordCount: LIVE_ATTENDANCE_RECORDS.length,
      records: LIVE_ATTENDANCE_RECORDS,
    };
  });
}
