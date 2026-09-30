// ============================================================================
// @hydiems/shared — Deterministic 8-State Time Classification Engine (TIME-008)
// Includes Active Audio Call Anti-Idle Rule & Retroactive Idle Rollback
// ============================================================================
import { ActivitySlice10s, ProductivityCategory, TimeState8 } from '../types';

export interface TimeEnginePolicyConfig {
  idleThresholdSeconds: number;          // e.g., 180s (3 minutes)
  audioCallAntiIdleEnabled: boolean;     // Prevents false IDLE during Zoom/Teams/Meet calls
  audioDbThreshold: number;              // e.g., -42 dBFS
  personalModeMaxMinutesPerDay: number;  // e.g., 60 minutes
}

const COMMUNICATION_PROCESS_MATCHERS = [
  'zoom',
  'teams',
  'ms-teams',
  'webex',
  'slack',
  'discord',
  'skype',
  'ringcentral',
];

const COMMUNICATION_URL_MATCHERS = [
  'meet.google.com',
  'teams.microsoft.com',
  'zoom.us',
  'app.slack.com/huddle',
];

export interface ClassifiedSliceResult {
  sliceId: string;
  primaryTimeState: TimeState8;
  productivityCategory: ProductivityCategory;
  isEffectiveWorkingTime: boolean;
  isIdleSuppressedByAudioCall: boolean;
  retroactiveIdleRollbackSeconds: number;
}

/**
 * Classifies a 10-second activity slice deterministically into one of the 8 states:
 * WORKING, PRODUCTIVE, NON_PRODUCTIVE, NEUTRAL, NO_IMPACT, IDLE, AWAY, OFFLINE
 */
export function classifyActivitySlice10s(
  slice: ActivitySlice10s,
  appProductivityCategory: ProductivityCategory,
  policy: TimeEnginePolicyConfig
): ClassifiedSliceResult {
  // Priority 1: Personal Mode (TIME-009) -> Privacy Pause (Not counted as work)
  if (slice.isPersonalMode) {
    return {
      sliceId: slice.sliceId,
      primaryTimeState: 'NO_IMPACT',
      productivityCategory: 'NO_IMPACT',
      isEffectiveWorkingTime: false,
      isIdleSuppressedByAudioCall: false,
      retroactiveIdleRollbackSeconds: 0,
    };
  }

  // Priority 2: Explicit Away / Break Reason (TIME-006..007)
  if (slice.isAwayBreak) {
    const countsAsWork = Boolean(slice.awayCountsAsWork);
    return {
      sliceId: slice.sliceId,
      primaryTimeState: 'AWAY',
      productivityCategory: countsAsWork ? 'PRODUCTIVE' : 'NEUTRAL',
      isEffectiveWorkingTime: countsAsWork,
      isIdleSuppressedByAudioCall: false,
      retroactiveIdleRollbackSeconds: 0,
    };
  }

  // Priority 3: Check Active Audio Call Anti-Idle Rule (Zoom / Teams / Google Meet)
  const procLower = (slice.processName || '').toLowerCase();
  const urlLower = (slice.urlFull || '').toLowerCase();
  const isMeetingApp =
    COMMUNICATION_PROCESS_MATCHERS.some((m) => procLower.includes(m)) ||
    COMMUNICATION_URL_MATCHERS.some((m) => urlLower.includes(m));
  const hasActiveAudioStream =
    slice.activeMicDb > policy.audioDbThreshold ||
    slice.activeSpeakerDb > policy.audioDbThreshold;

  const isIdleSuppressedByAudioCall =
    policy.audioCallAntiIdleEnabled &&
    isMeetingApp &&
    hasActiveAudioStream &&
    slice.idleSecondsElapsed >= policy.idleThresholdSeconds;

  // Priority 4: Idle Threshold Check + Retroactive Idle Rollback
  if (
    slice.idleSecondsElapsed >= policy.idleThresholdSeconds &&
    !isIdleSuppressedByAudioCall
  ) {
    // When the slice first crosses the idle threshold, roll back the initial threshold window
    const crossedThresholdOnThisSlice =
      slice.idleSecondsElapsed - slice.durationSec < policy.idleThresholdSeconds;
    return {
      sliceId: slice.sliceId,
      primaryTimeState: 'IDLE',
      productivityCategory: 'NEUTRAL',
      isEffectiveWorkingTime: false,
      isIdleSuppressedByAudioCall: false,
      retroactiveIdleRollbackSeconds: crossedThresholdOnThisSlice
        ? policy.idleThresholdSeconds
        : 0,
    };
  }

  // Priority 5: Active Input or Audio-Protected Meeting -> Classify by Productivity Rule
  return {
    sliceId: slice.sliceId,
    primaryTimeState: appProductivityCategory,
    productivityCategory: appProductivityCategory,
    isEffectiveWorkingTime: appProductivityCategory !== 'NO_IMPACT',
    isIdleSuppressedByAudioCall,
    retroactiveIdleRollbackSeconds: 0,
  };
}
