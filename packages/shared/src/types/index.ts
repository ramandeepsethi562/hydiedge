// ============================================================================
// @hydiems/shared — Core Domain Enums, Types, Roles, Modules & Add-Ons
// ============================================================================

export type SystemRole =
  | 'SUPER_ADMIN'
  | 'ORG_ADMIN'
  | 'EXECUTIVE'
  | 'DEPT_HEAD'
  | 'MANAGER'
  | 'HR_ADMIN'
  | 'FINANCE_ADMIN'
  | 'SECURITY_ADMIN'
  | 'EMPLOYEE';

export type ModuleKey =
  | 'M01_AUTH'
  | 'M02_ORG_SETUP'
  | 'M03_EXEC_DASHBOARD'
  | 'M04_WORKFORCE'
  | 'M05_ATTENDANCE'
  | 'M06_TIME_TRACKING'
  | 'M07_PRODUCTIVITY'
  | 'M08_ACTIVITY'
  | 'M09_LIVE_MONITORING'
  | 'M10_SCREENSHOTS'
  | 'M11_SCREEN_RECORDING'
  | 'M12_PROJECTS'
  | 'M13_TASKS'
  | 'M14_TIMESHEETS'
  | 'M15_CLIENTS_BILLING'
  | 'M16_WORKFORCE_ANALYTICS'
  | 'M17_REPORTS'
  | 'M18_ALERTS_AUTOMATION'
  | 'M19_LEAVE_HOLIDAYS'
  | 'M20_SHIFTS_SCHEDULING'
  | 'M21_PERFORMANCE'
  | 'M22_KPI_OKR'
  | 'M23_COMMUNICATION'
  | 'M24_FIELD_WORKFORCE'
  | 'M25_SECURITY_DLP'
  | 'M26_HR_MANAGEMENT'
  | 'M27_PAYROLL'
  | 'M28_AI_INTELLIGENCE'
  | 'M29_INTEGRATIONS'
  | 'M30_ADMINISTRATION'
  | 'M31_BILLING_SUBSCRIPTION'
  | 'M32_EMPLOYEE_PORTAL'
  | 'M33_DESKTOP_AGENT';

export type PermissionVerb =
  | 'VIEW'
  | 'CREATE'
  | 'EDIT'
  | 'DELETE'
  | 'APPROVE'
  | 'EXPORT'
  | 'CONFIGURE'
  | 'ADMINISTER';

export type SensitivePermissionGate =
  | 'GATE_VIEW_UNBLURRED_SCREENSHOTS'
  | 'GATE_TRIGGER_INSTANT_CAPTURE_NOW'
  | 'GATE_VIEW_LIVE_WEBRTC_STREAM'
  | 'GATE_DELETE_SCREENSHOTS_OR_RECORDINGS'
  | 'GATE_LISTEN_TO_AUDIO_RECORDINGS'
  | 'GATE_VIEW_KEYSTROKE_TEXT_LOGS'
  | 'GATE_OVERRIDE_LOCKED_TIMESHEETS'
  | 'GATE_EXPORT_DLP_EVIDENCE_FILES'
  | 'GATE_SUPER_ADMIN_TENANT_IMPERSONATION';

export type AddOnCode =
  | 'ADDON_SCREENSHOTS_10X'
  | 'ADDON_LIVE_STREAMING_WEBRTC'
  | 'ADDON_SCREEN_RECORDING'
  | 'ADDON_AUDIO_TRACKING'
  | 'ADDON_KEYSTROKE_AUDIT'
  | 'ADDON_11_LAYER_DLP'
  | 'ADDON_SUSPICIOUS_ACTIVITY_AI'
  | 'ADDON_OFFICE_TV_WALLBOARD'
  | 'ADDON_LICENSE_OPTIMIZATION'
  | 'ADDON_FIELD_GPS_GEOFENCE'
  | 'ADDON_CORPORATE_MDM'
  | 'ADDON_AGILE_PROJECTS_BUGS'
  | 'ADDON_CUSTOM_TRACKERS'
  | 'ADDON_CLIENT_INVOICING'
  | 'ADDON_PAYROLL_ENGINE'
  | 'ADDON_HYDIAI_ASSISTANT'
  | 'ADDON_WHITE_LABEL_DOMAIN'
  | 'ADDON_DEDICATED_S3_SFTP_STORAGE';

export type TimeState8 =
  | 'WORKING'
  | 'PRODUCTIVE'
  | 'NON_PRODUCTIVE'
  | 'NEUTRAL'
  | 'NO_IMPACT'
  | 'IDLE'
  | 'AWAY'
  | 'OFFLINE';

export type ProductivityCategory =
  | 'PRODUCTIVE'
  | 'NON_PRODUCTIVE'
  | 'NEUTRAL'
  | 'NO_IMPACT';

export type TrackerMode =
  | 'INTERACTIVE'
  | 'AUTOMATIC'
  | 'SILENT_STEALTH'
  | 'VISIBLE'
  | 'MANUAL'
  | 'TASK_BASED';

export type AttendanceStatus =
  | 'FULL_DAY'
  | 'HALF_DAY'
  | 'UNDERTIME'
  | 'OVERTIME'
  | 'ABSENT'
  | 'ON_LEAVE'
  | 'HOLIDAY'
  | 'WEEKEND';

export type TimesheetLockState =
  | 'OPEN'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'LOCKED';

export type DlpChannel =
  | 'FILE_TRANSFER'
  | 'WEB_UPLOAD'
  | 'WEB_DOWNLOAD'
  | 'CLIPBOARD'
  | 'PRINT_SPOOLER'
  | 'EMAIL_ATTACHMENT'
  | 'CLOUD_STORAGE_SYNC'
  | 'USB_REMOVABLE_MEDIA'
  | 'APP_BLOCKLIST'
  | 'URL_BLOCKLIST'
  | 'SCREEN_CAPTURE_GUARD';

export type InvestigationStage =
  | 'ALERT'
  | 'REVIEW'
  | 'ASSIGN'
  | 'INVESTIGATE'
  | 'RESOLVE'
  | 'CLOSE';

export type WorkMode =
  | 'OFFICE'
  | 'REMOTE'
  | 'HYBRID'
  | 'FIELD'
  | 'ON_LEAVE';

export type StorageProviderType =
  | 'LOCAL_NVME_MINIO'
  | 'AWS_S3'
  | 'CLOUDFLARE_R2'
  | 'TENANT_SFTP_FTPS';

export interface TenantEntitlements {
  orgId: string;
  planCode: 'STARTER' | 'GROWTH' | 'ENTERPRISE' | 'SOVEREIGN_DEDICATED';
  maxSeats: number;
  activeSeats: number;
  enabledModules: ModuleKey[];
  enabledAddOns: AddOnCode[];
  storageQuotaGb: number;
  storageProvider: StorageProviderType;
}

export interface ActivitySlice10s {
  sliceId: string;
  orgId: string;
  employeeId: string;
  deviceId: string;
  sliceStartUtc: string; // ISO-8601 UTC
  durationSec: number;   // 1..10
  processName: string;
  windowTitle: string;
  urlFull: string;
  urlDomain: string;
  browserName: string;
  keystrokesCount: number;
  mouseClicksCount: number;
  mouseDistancePx: number;
  scrollTicks: number;
  idleSecondsElapsed: number;
  activeMicDb: number;
  activeSpeakerDb: number;
  isPersonalMode: boolean;
  isAwayBreak: boolean;
  awayReasonCode?: string;
  awayCountsAsWork?: boolean;
  projectId?: string;
  taskId?: string;
  monitorIndex: number;
}
