// ============================================================================
// @hydiems/api — Real-Time Live Telemetry, Workforce, Screenshot & DLP State
// Synchronizes incoming Windows Desktop Agent telemetry with ClickHouse, MySQL,
// Redis, S3 NVMe Storage, and the Next.js Live Dashboard
// ============================================================================
import {
  insertActivitySlicesBatch,
  recordAgentHeartbeatPresence,
  executeMysqlQuery,
} from '@hydiems/database';

export interface LiveEmployeeRecord {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  email: string;
  designation: string;
  department: string;
  team: string;
  location: string;
  workMode: 'OFFICE' | 'REMOTE' | 'HYBRID' | 'FIELD';
  trackerMode: 'INTERACTIVE' | 'AUTOMATIC' | 'SILENT_STEALTH' | 'VISIBLE' | 'MANUAL' | 'TASK_BASED';
  currentStatus: 'PRODUCTIVE' | 'WORKING' | 'NEUTRAL' | 'NON_PRODUCTIVE' | 'IDLE' | 'AWAY' | 'OFFLINE';
  currentApp: string;
  currentWindowTitle: string;
  deviceId: string;
  osName: string;
  todayEffectiveHours: number;
  todayProductiveHours: number;
  todayIdleMinutes: number;
  productivityScorePct: number;
  keystrokesToday: number;
  mouseClicksToday: number;
  agentVersion: string;
  lastSeenUtc: string;
  latestScreenshotUrl?: string;
  systemInfo?: LiveSystemInfoRecord;
}

export interface LiveProcessConsumptionRecord {
  processName: string;
  processTitle: string;
  cpuConsumptionPct: number;
  memoryUsageMb: number;
  memoryUsagePct: number;
}

export interface LiveSystemInfoRecord {
  deviceId: string;
  employeeId: string;
  employeeName: string;
  macAddress: string;
  machineName: string;
  osVersion: string;
  cpuConsumptionPct: number;
  memoryUsagePct: number;
  totalMemoryMb: number;
  usedMemoryMb: number;
  diskConsumptionPct: number;
  totalDiskGb: number;
  usedDiskGb: number;
  downloadSpeedKbps: number;
  uploadSpeedKbps: number;
  downloadSpeedMbps: number;
  uploadSpeedMbps: number;
  speedTestDownloadMbps: number;
  speedTestUploadMbps: number;
  capturedAtUtc: string;
  systemProcessesData: LiveProcessConsumptionRecord[];
}

export interface LiveWorkTimeMatrixViolationRecord {
  violationId: string;
  deviceId: string;
  employeeId: string;
  ruleType: string;
  violationTitle: string;
  violationDescription: string;
  selectedReason: string;
  userExplanation: string;
  respondedAtUtc: string;
}

export interface LiveActivitySliceRecord {
  sliceId: string;
  employeeId: string;
  employeeName: string;
  deviceId: string;
  sliceStartUtc: string;
  durationSec: number;
  processName: string;
  windowTitle: string;
  urlDomain: string;
  keystrokesCount: number;
  mouseClicksCount: number;
  mouseScrollsCount: number;
  mouseDistancePx: number;
  osIdleSeconds: number;
  activeMicDb: number;
  activeSpeakerDb: number;
  primaryTimeState: string;
  productivityCategory: string;
  isIdleSuppressedByAudioCall?: boolean;
}

export interface LiveScreenshotRecord {
  screenshotId: string;
  employeeId: string;
  employeeName: string;
  deviceId: string;
  capturedAtUtc: string;
  monitorIndex: number;
  resolution: string;
  format: string;
  activeApp: string;
  windowTitle: string;
  activityScorePct: number;
  keystrokesInWindow: number;
  clicksInWindow: number;
  isPrivacyBlurred: boolean;
  isFlaggedSuspicious: boolean;
  triggerSource: string;
  thumbnailSignedUrl: string;
}

export interface LiveDlpIncidentRecord {
  incidentId: string;
  employeeId: string;
  employeeName: string;
  deviceId: string;
  channel: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  actionTaken: string;
  description: string;
  fileName?: string;
  investigationStage: string;
  detectedAtUtc: string;
}

export const LIVE_SCREENSHOT_BLOBS = new Map<string, { buffer: Buffer; mimeType: string }>();

export const LIVE_EMPLOYEES: LiveEmployeeRecord[] = [
  {
    employeeId: 'emp-win-ramandeep',
    employeeCode: 'RAMAN-001',
    fullName: 'Ramandeep',
    email: 'ramandeep@hydiedge.com',
    designation: 'Chief Technology Officer & Lead Architect',
    department: 'Platform Engineering & AI',
    team: 'Core Architecture',
    location: 'HQ Enterprise Office (IST)',
    workMode: 'OFFICE',
    trackerMode: 'INTERACTIVE',
    currentStatus: 'PRODUCTIVE',
    currentApp: 'HydiEdge Desktop Agent',
    currentWindowTitle: 'Active Workstation Session (RAMANDEEP)',
    deviceId: 'RAMANDEEP',
    osName: 'Windows 11 Pro 64-bit',
    todayEffectiveHours: 5.4,
    todayProductiveHours: 5.1,
    todayIdleMinutes: 8,
    productivityScorePct: 98.5,
    keystrokesToday: 4820,
    mouseClicksToday: 2150,
    agentVersion: '2.5.0-win-x64',
    lastSeenUtc: new Date().toISOString(),
  },
  {
    employeeId: 'emp-02',
    employeeCode: 'EMP-002',
    fullName: 'Vikram Malhotra',
    email: 'vikram.m@hydiedge.com',
    designation: 'Senior Field Operations Engineer',
    department: 'Global Customer Operations & Field Force',
    team: 'Enterprise Field Solutions',
    location: 'North India Territory',
    workMode: 'FIELD',
    trackerMode: 'AUTOMATIC',
    currentStatus: 'WORKING',
    currentApp: 'HydiEdge Mobile Companion',
    currentWindowTitle: 'Field Route & Telephony Sync',
    deviceId: 'ANDROID-S24-ULTRA',
    osName: 'Android 15 (OneUI 7)',
    todayEffectiveHours: 6.2,
    todayProductiveHours: 5.8,
    todayIdleMinutes: 14,
    productivityScorePct: 93.5,
    keystrokesToday: 1200,
    mouseClicksToday: 890,
    agentVersion: '2.5.0-android',
    lastSeenUtc: new Date().toISOString(),
  },
  {
    employeeId: 'emp-03',
    employeeCode: 'EMP-003',
    fullName: 'Sophia Patel',
    email: 'sophia.p@hydiedge.com',
    designation: 'Engineering Manager',
    department: 'Platform Engineering & AI',
    team: 'Core Telemetry & Distributed Systems',
    location: 'US East HQ (New York)',
    workMode: 'OFFICE',
    trackerMode: 'INTERACTIVE',
    currentStatus: 'PRODUCTIVE',
    currentApp: 'Visual Studio Code',
    currentWindowTitle: 'HydiEdge Microservices Gateway',
    deviceId: 'WIN-NY-ENG03',
    osName: 'Windows 11 Enterprise',
    todayEffectiveHours: 7.1,
    todayProductiveHours: 6.7,
    todayIdleMinutes: 18,
    productivityScorePct: 94.3,
    keystrokesToday: 6420,
    mouseClicksToday: 3100,
    agentVersion: '2.5.0-win-x64',
    lastSeenUtc: new Date().toISOString(),
  },
  {
    employeeId: 'emp-04',
    employeeCode: 'EMP-004',
    fullName: 'David Miller',
    email: 'david.m@hydiedge.com',
    designation: 'SOC Lead & DLP Investigator',
    department: 'Cybersecurity & DLP Operations',
    team: 'Insider Threat & DLP Forensics',
    location: 'US East HQ (New York)',
    workMode: 'OFFICE',
    trackerMode: 'SILENT_STEALTH',
    currentStatus: 'WORKING',
    currentApp: 'HydiEdge SOC Wallboard',
    currentWindowTitle: 'DLP Threat Monitoring & Forensics',
    deviceId: 'WIN-NY-SEC04',
    osName: 'Windows 11 Enterprise',
    todayEffectiveHours: 6.8,
    todayProductiveHours: 6.5,
    todayIdleMinutes: 10,
    productivityScorePct: 96.0,
    keystrokesToday: 5120,
    mouseClicksToday: 2400,
    agentVersion: '2.5.0-win-x64',
    lastSeenUtc: new Date().toISOString(),
  },
  {
    employeeId: 'emp-05',
    employeeCode: 'EMP-005',
    fullName: 'Sarah Connor',
    email: 'sarah.c@hydiedge.com',
    designation: 'Head of People Operations',
    department: 'People, Talent & Corporate Finance',
    team: 'People Operations',
    location: 'London Corporate Office',
    workMode: 'HYBRID',
    trackerMode: 'INTERACTIVE',
    currentStatus: 'PRODUCTIVE',
    currentApp: 'Workforce Performance Suite',
    currentWindowTitle: 'Q4 Workforce Allocation Matrix',
    deviceId: 'MAC-LON-HR05',
    osName: 'macOS Sequoia 15.1',
    todayEffectiveHours: 5.9,
    todayProductiveHours: 5.4,
    todayIdleMinutes: 20,
    productivityScorePct: 91.5,
    keystrokesToday: 3840,
    mouseClicksToday: 1950,
    agentVersion: '2.5.0-macos-arm64',
    lastSeenUtc: new Date().toISOString(),
  },
];

export async function syncWorkforceFromMysql(): Promise<number> {
  try {
    const rows = await executeMysqlQuery<Array<Record<string, unknown>>>(
      `SELECT e.id as employeeId, e.employee_code as employeeCode, u.full_name as fullName,
              u.email, e.job_title as designation, COALESCE(d.name, 'Platform Engineering & AI') as department,
              COALESCE(t.name, 'Core Platform') as team,
              COALESCE(e.work_mode, 'OFFICE') as workMode,
              COALESCE(e.tracker_mode, 'INTERACTIVE') as trackerMode,
              COALESCE(e.status, 'ACTIVE') as status
       FROM employees e
       LEFT JOIN users u ON e.user_id = u.id
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN teams t ON e.team_id = t.id
       WHERE e.status = 'ACTIVE'`
    );

    for (const r of rows) {
      const empId = String(r.employeeId);
      const existing = LIVE_EMPLOYEES.find((e) => e.employeeId === empId);
      if (existing) {
        existing.employeeCode = String(r.employeeCode);
        existing.fullName = String(r.fullName || existing.fullName);
        existing.email = String(r.email || existing.email);
        existing.designation = String(r.designation || existing.designation);
        existing.department = String(r.department || existing.department);
        existing.team = String(r.team || existing.team);
        existing.workMode = (r.workMode as LiveEmployeeRecord['workMode']) || existing.workMode;
        existing.trackerMode = (r.trackerMode as LiveEmployeeRecord['trackerMode']) || existing.trackerMode;
      }
    }
    return rows.length;
  } catch (err) {
    console.error('syncWorkforceFromMysql warning:', err);
    return 0;
  }
}

export const LIVE_ACTIVITY_SLICES: LiveActivitySliceRecord[] = [];

export const LIVE_SCREENSHOTS: LiveScreenshotRecord[] = [];

export const LIVE_DLP_INCIDENTS: LiveDlpIncidentRecord[] = [];

export async function ingestLiveAgentSlice(params: {
  orgId: string;
  employeeId: string;
  employeeName?: string;
  deviceId: string;
  osName?: string;
  trackerMode?: string;
  sliceId: string;
  sliceStartUtc: string;
  durationSec: number;
  processName: string;
  windowTitle: string;
  urlDomain?: string;
  keystrokesCount: number;
  mouseClicksCount: number;
  mouseScrollsCount?: number;
  mouseDistancePx?: number;
  osIdleSeconds?: number;
  primaryTimeState: string;
  productivityCategory: string;
  isIdleSuppressedByAudioCall?: boolean;
}): Promise<LiveEmployeeRecord> {
  const nowIso = new Date().toISOString();

  // 1. Upsert live employee state
  let emp = LIVE_EMPLOYEES.find(
    (e) => e.employeeId === params.employeeId || e.deviceId === params.deviceId
  );

  const statusMap: Record<string, LiveEmployeeRecord['currentStatus']> = {
    PRODUCTIVE: 'PRODUCTIVE',
    WORKING: 'WORKING',
    NEUTRAL: 'NEUTRAL',
    NON_PRODUCTIVE: 'NON_PRODUCTIVE',
    IDLE: 'IDLE',
    AWAY: 'AWAY',
    OFFLINE: 'OFFLINE',
  };
  const mappedStatus = statusMap[params.primaryTimeState] || 'PRODUCTIVE';

  if (!emp) {
    emp = {
      employeeId: params.employeeId,
      employeeCode: `WIN-${params.deviceId.slice(0, 6).toUpperCase()}`,
      fullName: params.employeeName || `Windows Workstation (${params.deviceId})`,
      email: `${params.employeeId.toLowerCase()}@hydiedge.com`,
      designation: 'Connected Windows Workstation Agent',
      department: 'Platform Engineering',
      team: 'Core Platform',
      location: 'Live Windows Endpoint',
      workMode: 'HYBRID',
      trackerMode: (params.trackerMode as LiveEmployeeRecord['trackerMode']) || 'INTERACTIVE',
      currentStatus: mappedStatus,
      currentApp: params.processName,
      currentWindowTitle: params.windowTitle,
      deviceId: params.deviceId,
      osName: params.osName || 'Windows 11 Pro (Live Agent)',
      todayEffectiveHours: 1.2,
      todayProductiveHours: 1.1,
      todayIdleMinutes: 2,
      productivityScorePct: 94.6,
      keystrokesToday: params.keystrokesCount,
      mouseClicksToday: params.mouseClicksCount,
      agentVersion: '2.5.0-win-x64',
      lastSeenUtc: nowIso,
    };
    LIVE_EMPLOYEES.unshift(emp);
  } else {
    emp.currentStatus = mappedStatus;
    emp.currentApp = params.processName;
    emp.currentWindowTitle = params.windowTitle;
    emp.deviceId = params.deviceId;
    if (params.osName) emp.osName = params.osName;
    emp.keystrokesToday += params.keystrokesCount;
    emp.mouseClicksToday += params.mouseClicksCount;
    emp.todayEffectiveHours = Number((emp.todayEffectiveHours + params.durationSec / 3600).toFixed(2));
    if (mappedStatus === 'PRODUCTIVE' || mappedStatus === 'WORKING') {
      emp.todayProductiveHours = Number((emp.todayProductiveHours + params.durationSec / 3600).toFixed(2));
    } else if (mappedStatus === 'IDLE') {
      emp.todayIdleMinutes = Math.round(emp.todayIdleMinutes + params.durationSec / 60);
    }
    emp.lastSeenUtc = nowIso;
  }

  // 2. Prepend to live activity timeline (keep latest 200 slices in memory)
  const sliceRecord: LiveActivitySliceRecord = {
    sliceId: params.sliceId,
    employeeId: emp.employeeId,
    employeeName: emp.fullName,
    deviceId: params.deviceId,
    sliceStartUtc: params.sliceStartUtc,
    durationSec: params.durationSec,
    processName: params.processName,
    windowTitle: params.windowTitle,
    urlDomain: params.urlDomain || '',
    keystrokesCount: params.keystrokesCount,
    mouseClicksCount: params.mouseClicksCount,
    mouseScrollsCount: params.mouseScrollsCount || 0,
    mouseDistancePx: params.mouseDistancePx || 0,
    osIdleSeconds: params.osIdleSeconds || 0,
    activeMicDb: -60,
    activeSpeakerDb: -60,
    primaryTimeState: params.primaryTimeState,
    productivityCategory: params.productivityCategory,
    isIdleSuppressedByAudioCall: params.isIdleSuppressedByAudioCall,
  };
  LIVE_ACTIVITY_SLICES.unshift(sliceRecord);
  if (LIVE_ACTIVITY_SLICES.length > 200) {
    LIVE_ACTIVITY_SLICES.length = 200;
  }

  // 3. Persist to Redis Presence + ClickHouse MergeTree + MySQL asynchronously
  try {
    await recordAgentHeartbeatPresence({
      orgId: params.orgId,
      employeeId: emp.employeeId,
      deviceId: params.deviceId,
      timeState: mappedStatus as any,
      activeProcess: params.processName,
      activeWindowTitle: params.windowTitle,
      activeUrlDomain: params.urlDomain || '',
      lastHeartbeatUtc: nowIso,
      agentVersion: emp.agentVersion,
      sqlitePendingRows: 0,
    });
  } catch {
    // Non-blocking
  }

  try {
    await insertActivitySlicesBatch([
      {
        sliceId: params.sliceId,
        orgId: params.orgId,
        employeeId: emp.employeeId,
        deviceId: params.deviceId,
        departmentId: 'dept-eng',
        teamId: 'team-core',
        sliceStartUtc: params.sliceStartUtc,
        durationSec: params.durationSec,
        processName: params.processName,
        windowTitle: params.windowTitle,
        urlFull: '',
        urlDomain: params.urlDomain || '',
        browserName: '',
        keystrokesCount: params.keystrokesCount,
        mouseClicksCount: params.mouseClicksCount,
        mouseDistancePx: params.mouseDistancePx || 0,
        scrollTicks: params.mouseScrollsCount || 0,
        idleSecondsElapsed: params.osIdleSeconds || 0,
        activeMicDb: -60,
        activeSpeakerDb: -60,
        isPersonalMode: false,
        isAwayBreak: mappedStatus === 'AWAY',
        monitorIndex: 0,
        timeState: mappedStatus as any,
        productivityCategory: (params.productivityCategory as any) || 'PRODUCTIVE',
        productivityWeight: mappedStatus === 'PRODUCTIVE' ? 1 : 0.5,
      },
    ]);
  } catch {
    // Non-blocking
  }

  return emp;
}

export async function ingestLiveScreenshot(params: {
  orgId: string;
  employeeId: string;
  employeeName?: string;
  deviceId: string;
  monitorIndex: number;
  resolution: string;
  activeApp: string;
  windowTitle: string;
  keystrokesInWindow: number;
  clicksInWindow: number;
  isPrivacyBlurred: boolean;
  triggerSource: string;
  imageBuffer: Buffer;
  mimeType: string;
}): Promise<LiveScreenshotRecord> {
  const screenshotId = `ss-live-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const capturedAtUtc = new Date().toISOString();

  LIVE_SCREENSHOT_BLOBS.set(screenshotId, {
    buffer: params.imageBuffer,
    mimeType: params.mimeType || 'image/bmp',
  });
  // Keep latest 50 blobs in memory
  if (LIVE_SCREENSHOT_BLOBS.size > 50) {
    const oldestKey = LIVE_SCREENSHOT_BLOBS.keys().next().value;
    if (oldestKey) LIVE_SCREENSHOT_BLOBS.delete(oldestKey);
  }

  // Also upload to S3 NVMe container (http://minio:9000)
  const s3Endpoint = process.env.S3_ENDPOINT || 'http://minio:9000';
  const ext = params.mimeType.includes('png')
    ? 'png'
    : params.mimeType.includes('jpeg') || params.mimeType.includes('jpg')
    ? 'jpg'
    : 'bmp';
  const objectKey = `hydiems-screenshots/${screenshotId}.${ext}`;

  try {
    await fetch(`${s3Endpoint}/${objectKey}`, {
      method: 'PUT',
      headers: { 'Content-Type': params.mimeType },
      body: params.imageBuffer,
    });
  } catch {
    // Non-blocking fallback to /api/v1/screenshots/:id/image
  }

  const imageUrl = `/api/v1/screenshots/${screenshotId}/image`;

  const emp = LIVE_EMPLOYEES.find(
    (e) => e.employeeId === params.employeeId || e.deviceId === params.deviceId
  );
  if (emp) {
    emp.latestScreenshotUrl = imageUrl;
    emp.currentApp = params.activeApp;
    emp.currentWindowTitle = params.windowTitle;
    emp.lastSeenUtc = capturedAtUtc;
  }

  const record: LiveScreenshotRecord = {
    screenshotId,
    employeeId: emp ? emp.employeeId : params.employeeId,
    employeeName: emp ? emp.fullName : params.employeeName || `Windows Agent (${params.deviceId})`,
    deviceId: params.deviceId,
    capturedAtUtc,
    monitorIndex: params.monitorIndex,
    resolution: params.resolution,
    format: ext.toUpperCase(),
    activeApp: params.activeApp,
    windowTitle: params.windowTitle,
    activityScorePct: Math.min(100, Math.max(45, (params.keystrokesInWindow + params.clicksInWindow) * 4)),
    keystrokesInWindow: params.keystrokesInWindow,
    clicksInWindow: params.clicksInWindow,
    isPrivacyBlurred: params.isPrivacyBlurred,
    isFlaggedSuspicious: false,
    triggerSource: params.triggerSource,
    thumbnailSignedUrl: imageUrl,
  };

  LIVE_SCREENSHOTS.unshift(record);
  if (LIVE_SCREENSHOTS.length > 60) {
    LIVE_SCREENSHOTS.length = 60;
  }

  try {
    await executeMysqlQuery(
      `INSERT IGNORE INTO screenshots (id, org_id, employee_id, device_id, captured_at_utc, monitor_index, resolution, storage_object_key, sha256_checksum, active_process_name, active_window_title, keystrokes_count, mouse_clicks_count, activity_score_pct, blur_mode)
       VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        screenshotId,
        params.orgId,
        record.employeeId,
        params.deviceId,
        params.monitorIndex,
        params.resolution,
        objectKey,
        screenshotId,
        params.activeApp,
        params.windowTitle,
        params.keystrokesInWindow,
        params.clicksInWindow,
        record.activityScorePct,
        params.isPrivacyBlurred ? 'PARTIAL_BLUR' : 'NONE',
      ]
    );
  } catch {
    // Non-blocking
  }

  return record;
}

export const LIVE_SYSTEM_INFO = new Map<string, LiveSystemInfoRecord>();
export const LIVE_WORK_MATRIX_VIOLATIONS: LiveWorkTimeMatrixViolationRecord[] = [];

function parseNum(val: any, fallback: number): number {
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  if (typeof val === 'string') {
    const cleaned = parseFloat(val.replace(/[^0-9.]/g, ''));
    if (!Number.isNaN(cleaned)) return cleaned;
  }
  return fallback;
}

export async function ingestLiveSystemInfo(raw: Record<string, any>): Promise<LiveSystemInfoRecord> {
  const deviceId = String(raw.deviceId || raw.DeviceId || 'WIN-WORKSTATION-01');
  const employeeId = String(raw.employeeId || raw.EmployeeId || `emp-${deviceId.toLowerCase()}`);
  const employeeName = String(raw.employeeName || raw.EmployeeName || `Windows Agent (${deviceId})`);

  const processesRaw: Array<Record<string, any>> = Array.isArray(
    raw.systemProcessesData || raw.SystemProcessesData || raw.TopProcesses || raw.topProcesses
  )
    ? raw.systemProcessesData || raw.SystemProcessesData || raw.TopProcesses || raw.topProcesses
    : [];

  const totalRamGb = parseNum(raw.TotalRamGb ?? raw.totalRamGb, 16);
  const totalMemoryMb = parseNum(raw.totalMemoryMb ?? raw.TotalMemoryMb, Math.round(totalRamGb * 1024));
  const memoryUsagePct = parseNum(
    raw.memoryUsagePct ?? raw.MemoryUsagePct ?? raw.MemoryUsagePercent,
    48.5
  );

  const record: LiveSystemInfoRecord = {
    deviceId,
    employeeId,
    employeeName,
    macAddress: String(raw.macAddress || raw.MACAddress || deviceId),
    machineName: String(raw.machineName || raw.MachineName || deviceId),
    osVersion: String(raw.osVersion || raw.OSVersion || raw.Location || 'Windows 11 Pro'),
    cpuConsumptionPct: parseNum(
      raw.cpuConsumptionPct ?? raw.CpuConsumptionPct ?? raw.CpuUsagePercent,
      4.2
    ),
    memoryUsagePct,
    totalMemoryMb,
    usedMemoryMb: parseNum(
      raw.usedMemoryMb ?? raw.UsedMemoryMb,
      Math.round((totalMemoryMb * memoryUsagePct) / 100)
    ),
    diskConsumptionPct: parseNum(
      raw.diskConsumptionPct ?? raw.DiskConsumptionPct ?? raw.DiskUsagePercent,
      42.1
    ),
    totalDiskGb: parseNum(raw.totalDiskGb ?? raw.TotalDiskGb, 512),
    usedDiskGb: parseNum(raw.usedDiskGb ?? raw.UsedDiskGb, 215),
    downloadSpeedKbps: parseNum(
      raw.downloadSpeedKbps ?? raw.DownloadSpeedKbps ?? raw.NetworkReceived,
      1240
    ),
    uploadSpeedKbps: parseNum(
      raw.uploadSpeedKbps ?? raw.UploadSpeedKbps ?? raw.NetworkSent,
      420
    ),
    downloadSpeedMbps: parseNum(raw.downloadSpeedMbps ?? raw.DownloadSpeedMbps, 1.24),
    uploadSpeedMbps: parseNum(raw.uploadSpeedMbps ?? raw.UploadSpeedMbps, 0.42),
    speedTestDownloadMbps: parseNum(
      raw.speedTestDownloadMbps ?? raw.SpeedTestDownloadMbps ?? raw.DownloadSpeed,
      185.4
    ),
    speedTestUploadMbps: parseNum(
      raw.speedTestUploadMbps ?? raw.SpeedTestUploadMbps ?? raw.UploadSpeed,
      94.2
    ),
    capturedAtUtc: String(
      raw.capturedAtUtc || raw.CapturedAtUtc || raw.CollectedAtUtc || new Date().toISOString()
    ),
    systemProcessesData: processesRaw.slice(0, 12).map((p) => ({
      processName: String(p.processName || p.ProcessName || 'System'),
      processTitle: String(
        p.processTitle || p.ProcessTitle || p.WindowTitle || p.processName || p.ProcessName || 'Process'
      ),
      cpuConsumptionPct: parseNum(
        p.cpuConsumptionPct ?? p.CpuConsumptionPct ?? p.CpuPercent,
        0
      ),
      memoryUsageMb: parseNum(p.memoryUsageMb ?? p.MemoryUsageMb ?? p.MemoryMb, 0),
      memoryUsagePct: parseNum(p.memoryUsagePct ?? p.MemoryUsagePct, 0),
    })),
  };

  LIVE_SYSTEM_INFO.set(deviceId, record);

  const emp = LIVE_EMPLOYEES.find(
    (e) => e.employeeId === employeeId || e.deviceId === deviceId
  );
  if (emp) {
    emp.systemInfo = record;
    emp.lastSeenUtc = record.capturedAtUtc;
  }

  return record;
}

export async function ingestWorkTimeMatrixViolation(
  raw: Record<string, any>
): Promise<LiveWorkTimeMatrixViolationRecord> {
  const deviceId = String(raw.deviceId || raw.DeviceId || 'WIN-WORKSTATION-01');
  const employeeId = String(raw.employeeId || raw.EmployeeId || `emp-${deviceId.toLowerCase()}`);

  const record: LiveWorkTimeMatrixViolationRecord = {
    violationId: String(raw.violationId || raw.ViolationId || `wtm-${Date.now()}`),
    deviceId,
    employeeId,
    ruleType: String(raw.ruleType || raw.RuleType || 'LESS_PRODUCTIVE_HOURS'),
    violationTitle: String(
      raw.violationTitle || raw.ViolationTitle || 'Work Time Matrix Threshold Prompt'
    ),
    violationDescription: String(
      raw.violationDescription ||
        raw.ViolationDescription ||
        'Behavioural threshold triggered on workstation.'
    ),
    selectedReason: String(raw.selectedReason || raw.SelectedReason || 'Client Meeting'),
    userExplanation: String(raw.userExplanation || raw.UserExplanation || 'Attended sprint planning.'),
    respondedAtUtc: String(raw.respondedAtUtc || raw.RespondedAtUtc || new Date().toISOString()),
  };

  LIVE_WORK_MATRIX_VIOLATIONS.unshift(record);
  if (LIVE_WORK_MATRIX_VIOLATIONS.length > 50) {
    LIVE_WORK_MATRIX_VIOLATIONS.length = 50;
  }

  return record;
}

// ----------------------------------------------------------------------------
// CONTINUOUS LIVE VIDEO STREAMING (MJPEG MULTIPART & WEBSOCKET BROADCAST)
// ----------------------------------------------------------------------------
export interface LiveStreamFrame {
  buffer: Buffer;
  mimeType: string;
  capturedAtUtc: string;
  employeeId: string;
  deviceId: string;
}

export let LATEST_LIVE_STREAM_FRAME: LiveStreamFrame | null = null;
export const ACTIVE_STREAM_HTTP_RESPONSES = new Set<any>();

export function pushLiveStreamFrame(frame: LiveStreamFrame) {
  LATEST_LIVE_STREAM_FRAME = frame;

  // Broadcast to all connected MJPEG HTTP clients (e.g. Chrome <img src="/api/v1/live/stream" />)
  for (const rawReply of Array.from(ACTIVE_STREAM_HTTP_RESPONSES)) {
    try {
      rawReply.write(
        `--frame\r\nContent-Type: ${frame.mimeType}\r\nContent-Length: ${frame.buffer.length}\r\n\r\n`
      );
      rawReply.write(frame.buffer);
      rawReply.write('\r\n');
    } catch {
      ACTIVE_STREAM_HTTP_RESPONSES.delete(rawReply);
    }
  }
}

// ----------------------------------------------------------------------------
// CONTINUOUS LIVE WEBCAM VIDEO STREAMING (MJPEG MULTIPART & FAST FRAMES)
// ----------------------------------------------------------------------------
export interface LiveVideoFrame {
  buffer: Buffer;
  mimeType: string;
  capturedAtUtc: string;
  employeeId: string;
  deviceId: string;
}

export let LATEST_LIVE_VIDEO_FRAME: LiveVideoFrame | null = null;
export const ACTIVE_VIDEO_STREAM_RESPONSES = new Set<any>();

export function pushLiveVideoFrame(frame: LiveVideoFrame) {
  LATEST_LIVE_VIDEO_FRAME = frame;
  for (const rawReply of Array.from(ACTIVE_VIDEO_STREAM_RESPONSES)) {
    try {
      rawReply.write(
        `--frame\r\nContent-Type: ${frame.mimeType}\r\nContent-Length: ${frame.buffer.length}\r\n\r\n`
      );
      rawReply.write(frame.buffer);
      rawReply.write('\r\n');
    } catch {
      ACTIVE_VIDEO_STREAM_RESPONSES.delete(rawReply);
    }
  }
}

// ----------------------------------------------------------------------------
// CONTINUOUS LIVE AUDIO MONITORING & METRICS STATE
// ----------------------------------------------------------------------------
export interface LiveAudioState {
  employeeId: string;
  deviceId: string;
  deviceName: string;
  decibels: number;
  peakAmplitude: number;
  rmsLevel: number;
  isSpeechDetected: boolean;
  sampleRate: number;
  spectrumBands: number[];
  audioPcmBase64?: string;
  timestampUtc: string;
}

export let LATEST_LIVE_AUDIO_STATE: LiveAudioState = {
  employeeId: 'emp-win-ramandeep',
  deviceId: 'RAMANDEEP',
  deviceName: 'Microphone (2- USB Audio Device)',
  decibels: -44.2,
  peakAmplitude: 1420,
  rmsLevel: 14.5,
  isSpeechDetected: false,
  sampleRate: 16000,
  spectrumBands: [15, 24, 38, 52, 65, 48, 35, 28, 20, 15, 10, 8, 5, 4, 3, 2],
  timestampUtc: new Date().toISOString(),
};

export function updateLiveAudioState(data: Partial<LiveAudioState>) {
  LATEST_LIVE_AUDIO_STATE = {
    ...LATEST_LIVE_AUDIO_STATE,
    ...data,
    timestampUtc: new Date().toISOString(),
  };
}

// ----------------------------------------------------------------------------
// ORGANISATION LIVE MONITORING PRIVACY & TRANSPARENCY POLICY
// ----------------------------------------------------------------------------
export interface OrgMonitoringPolicy {
  orgId: string;
  notificationCountdownSeconds: number; // 15, 30, 45, 60 (default: 15)
  notifyOnScreenMonitoring: boolean;     // default: true
  notifyOnWebcamMonitoring: boolean;     // default: true
  notifyOnMicMonitoring: boolean;        // default: true
  allowRemoteControl: boolean;           // default: true
  remoteControlRequiresConsent: boolean; // default: true
  showPersistentDesktopBanner: boolean;  // default: true
  updatedAt: string;
}

const ORG_MONITORING_POLICIES = new Map<string, OrgMonitoringPolicy>();

export const DEFAULT_MONITORING_POLICY: OrgMonitoringPolicy = {
  orgId: 'org-acme-global-001',
  notificationCountdownSeconds: 15,
  notifyOnScreenMonitoring: true,
  notifyOnWebcamMonitoring: true,
  notifyOnMicMonitoring: true,
  allowRemoteControl: true,
  remoteControlRequiresConsent: true,
  showPersistentDesktopBanner: true,
  updatedAt: new Date().toISOString(),
};

export function getOrgMonitoringPolicy(orgId: string = 'org-acme-global-001'): OrgMonitoringPolicy {
  return ORG_MONITORING_POLICIES.get(orgId) || { ...DEFAULT_MONITORING_POLICY, orgId };
}

export function updateOrgMonitoringPolicy(orgId: string, updates: Partial<OrgMonitoringPolicy>): OrgMonitoringPolicy {
  const current = getOrgMonitoringPolicy(orgId);
  const updated: OrgMonitoringPolicy = {
    ...current,
    ...updates,
    orgId,
    updatedAt: new Date().toISOString(),
  };
  ORG_MONITORING_POLICIES.set(orgId, updated);
  return updated;
}

// ----------------------------------------------------------------------------
// ACTIVE LIVE MONITORING & REMOTE CONTROL SESSIONS
// ----------------------------------------------------------------------------
export interface ActiveMonitoringSession {
  sessionId: string;
  employeeId: string;
  employeeName: string;
  adminName: string;
  channels: Array<'SCREEN' | 'CAMERA' | 'AUDIO' | 'REMOTE_CONTROL'>;
  status: 'COUNTDOWN' | 'ACTIVE' | 'STOPPED' | 'REJECTED';
  countdownSeconds: number;
  remainingSeconds: number;
  startedAtUtc: string;
  activatedAtUtc?: string;
  stoppedAtUtc?: string;
}

export const ACTIVE_MONITORING_SESSIONS = new Map<string, ActiveMonitoringSession>();

export function createMonitoringSession(
  employeeId: string,
  employeeName: string,
  adminName: string,
  channels: Array<'SCREEN' | 'CAMERA' | 'AUDIO' | 'REMOTE_CONTROL'>,
  countdownSeconds: number
): ActiveMonitoringSession {
  const sessionId = `SESS-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const session: ActiveMonitoringSession = {
    sessionId,
    employeeId,
    employeeName,
    adminName,
    channels,
    status: countdownSeconds > 0 ? 'COUNTDOWN' : 'ACTIVE',
    countdownSeconds,
    remainingSeconds: countdownSeconds,
    startedAtUtc: new Date().toISOString(),
    activatedAtUtc: countdownSeconds === 0 ? new Date().toISOString() : undefined,
  };
  ACTIVE_MONITORING_SESSIONS.set(sessionId, session);
  ACTIVE_MONITORING_SESSIONS.set(employeeId, session); // quick lookup by employeeId
  return session;
}

export function getMonitoringSession(idOrEmp: string): ActiveMonitoringSession | undefined {
  return ACTIVE_MONITORING_SESSIONS.get(idOrEmp);
}

export function stopMonitoringSession(idOrEmp: string): boolean {
  const session = ACTIVE_MONITORING_SESSIONS.get(idOrEmp);
  if (session) {
    session.status = 'STOPPED';
    session.stoppedAtUtc = new Date().toISOString();
    return true;
  }
  return false;
}

// ----------------------------------------------------------------------------
// REMOTE CONTROL SYNTHETIC INPUT QUEUE
// ----------------------------------------------------------------------------
export interface RemoteControlInputEvent {
  employeeId: string;
  eventType: 'MOUSE_MOVE' | 'MOUSE_DOWN' | 'MOUSE_UP' | 'MOUSE_CLICK' | 'MOUSE_DOUBLE_CLICK' | 'MOUSE_WHEEL' | 'KEY_DOWN' | 'KEY_UP';
  normalizedX?: number; // 0.0 to 1.0
  normalizedY?: number; // 0.0 to 1.0
  button?: 'left' | 'right' | 'middle';
  delta?: number;
  keyCode?: number;
  key?: string;
  timestampUtc: string;
}

const PENDING_REMOTE_INPUTS = new Map<string, RemoteControlInputEvent[]>();

export function enqueueRemoteControlInput(event: RemoteControlInputEvent) {
  const existing = PENDING_REMOTE_INPUTS.get(event.employeeId) || [];
  existing.push(event);
  if (existing.length > 100) {
    existing.shift();
  }
  PENDING_REMOTE_INPUTS.set(event.employeeId, existing);
}

export function pollRemoteControlInputs(employeeId: string): RemoteControlInputEvent[] {
  const inputs = PENDING_REMOTE_INPUTS.get(employeeId) || [];
  PENDING_REMOTE_INPUTS.set(employeeId, []);
  return inputs;
}



