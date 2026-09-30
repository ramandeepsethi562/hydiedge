// ============================================================================
// @hydiems/shared — Daily Attendance State Machine & BPO Shrinkage Engine
// Covers SHIFT-001..005, ATT-001..012, and Override Governance Matrix
// ============================================================================
import { AttendanceStatus } from '../types';

export interface ShiftPolicyRule {
  shiftId: string;
  shiftName: string;
  scheduledStartMinFromMidnight: number; // e.g., 09:00 = 540
  scheduledEndMinFromMidnight: number;   // e.g., 18:00 = 1080
  fullDayMinMinutes: number;             // e.g., 480 (8h)
  halfDayMinMinutes: number;             // e.g., 240 (4h)
  lateGraceMinutes: number;              // e.g., 15m
  earlyLeaveGraceMinutes: number;        // e.g., 15m
  overtimeThresholdMinutes: number;      // e.g., 510 (8.5h)
  isCrossMidnightNightShift: boolean;
}

export interface DailyAttendanceInput {
  employeeId: string;
  attendanceDate: string; // YYYY-MM-DD anchored to Shift Start Date
  firstPunchInMinFromShiftDayStart: number | null;
  lastPunchOutMinFromShiftDayStart: number | null;
  effectiveWorkingMinutes: number;
  approvedLeaveFraction: 0 | 0.5 | 1;
  isPublicHoliday: boolean;
  isWeeklyOff: boolean;
}

export interface DailyAttendanceEvaluation {
  status: AttendanceStatus;
  isLateIn: boolean;
  lateByMinutes: number;
  isEarlyOut: boolean;
  earlyByMinutes: number;
  undertimeMinutes: number;
  overtimeMinutes: number;
  payableHours: number;
}

export function evaluateDailyAttendance(
  input: DailyAttendanceInput,
  shift: ShiftPolicyRule
): DailyAttendanceEvaluation {
  if (input.isPublicHoliday && input.effectiveWorkingMinutes === 0) {
    return {
      status: 'HOLIDAY',
      isLateIn: false,
      lateByMinutes: 0,
      isEarlyOut: false,
      earlyByMinutes: 0,
      undertimeMinutes: 0,
      overtimeMinutes: 0,
      payableHours: shift.fullDayMinMinutes / 60,
    };
  }

  if (input.isWeeklyOff && input.effectiveWorkingMinutes === 0) {
    return {
      status: 'WEEKEND',
      isLateIn: false,
      lateByMinutes: 0,
      isEarlyOut: false,
      earlyByMinutes: 0,
      undertimeMinutes: 0,
      overtimeMinutes: 0,
      payableHours: 0,
    };
  }

  if (input.approvedLeaveFraction === 1 && input.effectiveWorkingMinutes === 0) {
    return {
      status: 'ON_LEAVE',
      isLateIn: false,
      lateByMinutes: 0,
      isEarlyOut: false,
      earlyByMinutes: 0,
      undertimeMinutes: 0,
      overtimeMinutes: 0,
      payableHours: shift.fullDayMinMinutes / 60,
    };
  }

  const lateCutoff = shift.scheduledStartMinFromMidnight + shift.lateGraceMinutes;
  const isLateIn =
    input.firstPunchInMinFromShiftDayStart !== null &&
    input.firstPunchInMinFromShiftDayStart > lateCutoff;
  const lateByMinutes =
    input.firstPunchInMinFromShiftDayStart !== null &&
    input.firstPunchInMinFromShiftDayStart > shift.scheduledStartMinFromMidnight
      ? input.firstPunchInMinFromShiftDayStart - shift.scheduledStartMinFromMidnight
      : 0;

  const earlyCutoff = shift.scheduledEndMinFromMidnight - shift.earlyLeaveGraceMinutes;
  const isEarlyOut =
    input.lastPunchOutMinFromShiftDayStart !== null &&
    input.lastPunchOutMinFromShiftDayStart < earlyCutoff;
  const earlyByMinutes =
    input.lastPunchOutMinFromShiftDayStart !== null &&
    input.lastPunchOutMinFromShiftDayStart < shift.scheduledEndMinFromMidnight
      ? shift.scheduledEndMinFromMidnight - input.lastPunchOutMinFromShiftDayStart
      : 0;

  const worked = input.effectiveWorkingMinutes;
  let status: AttendanceStatus = 'ABSENT';
  if (worked >= shift.overtimeThresholdMinutes) {
    status = 'OVERTIME';
  } else if (worked >= shift.fullDayMinMinutes) {
    status = 'FULL_DAY';
  } else if (worked >= shift.halfDayMinMinutes) {
    status = worked < shift.fullDayMinMinutes ? 'UNDERTIME' : 'HALF_DAY';
    if (input.approvedLeaveFraction === 0.5 || worked < shift.fullDayMinMinutes * 0.75) {
      status = 'HALF_DAY';
    }
  } else {
    status = 'ABSENT';
  }

  const undertimeMinutes = Math.max(0, shift.fullDayMinMinutes - worked);
  const overtimeMinutes = Math.max(0, worked - shift.overtimeThresholdMinutes);

  return {
    status,
    isLateIn,
    lateByMinutes,
    isEarlyOut,
    earlyByMinutes,
    undertimeMinutes,
    overtimeMinutes,
    payableHours: Number((worked / 60).toFixed(2)),
  };
}

/**
 * BPO / Contact Center Workforce Shrinkage Formula (ATT-010)
 * External Shrinkage = Paid Leave + Unpaid Leave + Holidays + Absenteeism + Late/Early Loss
 * Internal Shrinkage = Training + Coaching + Team Meetings + System Downtime + Aux Breaks
 */
export interface ShrinkageInputHours {
  totalRosteredScheduledHours: number;
  paidLeaveHours: number;
  unpaidAbsentHours: number;
  publicHolidayHours: number;
  lateAndEarlyLossHours: number;
  trainingAndCoachingHours: number;
  internalMeetingHours: number;
  systemAndPowerDowntimeHours: number;
  auxBreakHours: number;
}

export interface ShrinkageReportMetrics {
  externalShrinkageHours: number;
  externalShrinkagePct: number;
  internalShrinkageHours: number;
  internalShrinkagePct: number;
  totalShrinkageHours: number;
  totalShrinkagePct: number;
  netProductiveFloorHours: number;
  adherenceScorePct: number;
}

export function calculateWorkforceShrinkage(
  input: ShrinkageInputHours
): ShrinkageReportMetrics {
  const denom = Math.max(1, input.totalRosteredScheduledHours);
  const externalShrinkageHours =
    input.paidLeaveHours +
    input.unpaidAbsentHours +
    input.publicHolidayHours +
    input.lateAndEarlyLossHours;
  const internalShrinkageHours =
    input.trainingAndCoachingHours +
    input.internalMeetingHours +
    input.systemAndPowerDowntimeHours +
    input.auxBreakHours;
  const totalShrinkageHours = externalShrinkageHours + internalShrinkageHours;
  const netProductiveFloorHours = Math.max(0, denom - totalShrinkageHours);

  return {
    externalShrinkageHours: Number(externalShrinkageHours.toFixed(2)),
    externalShrinkagePct: Number(((externalShrinkageHours / denom) * 100).toFixed(2)),
    internalShrinkageHours: Number(internalShrinkageHours.toFixed(2)),
    internalShrinkagePct: Number(((internalShrinkageHours / denom) * 100).toFixed(2)),
    totalShrinkageHours: Number(totalShrinkageHours.toFixed(2)),
    totalShrinkagePct: Number(((totalShrinkageHours / denom) * 100).toFixed(2)),
    netProductiveFloorHours: Number(netProductiveFloorHours.toFixed(2)),
    adherenceScorePct: Number(((netProductiveFloorHours / denom) * 100).toFixed(2)),
  };
}
