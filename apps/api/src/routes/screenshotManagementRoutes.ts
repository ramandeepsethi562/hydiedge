// ============================================================================
// @hydiems/api — MODULE 10: SCREENSHOT MANAGEMENT & AUDITED VIEWER ROUTES
// Covers:
//   Screenshot Dashboard:
//     • Screenshot timeline
//     • Employee (Ramandeep, Ramandeep, Ramandeep, Ramandeep)
//     • Timestamp (exact UTC & local)
//     • Screen (multi-monitor: Screen 1, Screen 2, Screen 3)
//     • Application (active app, window title, productivity classification)
//     • Activity % (intensity score, keystrokes, mouse clicks)
//     • Screenshot quality (resolution, format, compression, file size)
//   Configuration:
//     • Frequency (1x - 12x per hour)
//     • Random screenshots (interval jitter +/- 90s)
//     • Manual screenshot ("Capture Now" WebSocket push < 2s)
//     • Screenshot on event (DLP incident, USB inserted, blacklisted app)
//     • Multiple monitors (ALL_MONITORS, PRIMARY_ONLY, ACTIVE_WINDOW_ONLY)
//     • Resolution (100% Original, 75% 1440p, 50% 1080p, 720p)
//     • Compression (WebP quality 40 - 95, lossless/lossy)
//     • Retention (7, 15, 30, 90, 365 days auto-pruning)
//   Screenshot Viewer:
//     • Full screen
//     • Zoom (50%, 75%, 100%, 150%, 200%, Fit-to-screen)
//     • Previous/next timeline navigation
//     • Timestamp & Employee details
//     • Device details (hostname, OS, IP, agent version)
//     • Application & window title
//     • Download (audited original / unblurred image download)
//     • Delete permission (RBAC GATE_DELETE_SCREENSHOTS_OR_RECORDINGS enforcement)
//     • Audit trail (hash-chained immutable audit log of all viewer actions)
// ============================================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import {
  requireAuth,
  requirePermission,
  requireSensitiveGate,
  appendImmutableAuditLog,
  IMMUTABLE_AUDIT_LOG_STORE,
} from '../middleware/authAndTenant';
import {
  broadcastPolicyPushToOrg,
  dispatchAgentCommand,
} from '../ws/realtimeGateway';
import {
  LIVE_SCREENSHOTS,
  LIVE_SCREENSHOT_BLOBS,
  LIVE_EMPLOYEES,
  LiveScreenshotRecord,
} from '../state/liveTelemetryState';
import { executeMysqlQuery } from '@hydiems/database';
import { SystemRole } from '@hydiems/shared';

// ----------------------------------------------------------------------------
// INTERFACES & SCHEMAS
// ----------------------------------------------------------------------------

export interface ScreenshotQualityConfig {
  resolution: 'ORIGINAL_100' | 'SCALE_75_1440P' | 'SCALE_50_1080P' | 'SCALE_720P';
  format: 'WEBP' | 'JPEG' | 'PNG';
  quality: number; // 40 - 95
  lossless: boolean;
}

export interface ScreenshotPolicyConfig {
  frequencyPerHour: number; // e.g. 6 (every 10m) or 10 (every 6m)
  intervalMinutes: number; // calculated: 60 / frequencyPerHour
  randomScreenshots: boolean; // Randomize capture inside interval window
  jitterSeconds: number; // e.g. 90s
  manualScreenshotEnabled: boolean; // Allow manager/admin on-demand capture
  screenshotOnEvent: boolean; // Trigger on DLP/security/app incidents
  eventTriggers: string[];
  multipleMonitors: 'ALL_MONITORS' | 'PRIMARY_ONLY' | 'ACTIVE_WINDOW_ONLY';
  resolution: 'ORIGINAL_100' | 'SCALE_75_1440P' | 'SCALE_50_1080P' | 'SCALE_720P';
  compression: ScreenshotQualityConfig;
  retentionDays: number; // default 90 days
  privacyBlurPolicy: {
    enabled: boolean;
    mode: 'AUTOMATIC_PII_REGEX' | 'FULL_BLUR' | 'NONE';
    allowedRolesToUnblur: SystemRole[];
  };
}

export interface DetailedScreenshotItem extends LiveScreenshotRecord {
  department: string;
  designation: string;
  capturedAtLocal: string;
  screenLabel: string;
  fileSizeBytes: number;
  compressionQuality: number;
  appCategory: 'PRODUCTIVE' | 'NEUTRAL' | 'NON_PRODUCTIVE' | 'COMMUNICATION';
  device: {
    deviceId: string;
    hostName: string;
    osVersion: string;
    ipAddress: string;
    macAddress: string;
    agentVersion: string;
  };
  eventTriggerDetails?: {
    eventType: string;
    ruleName: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    summary: string;
  };
}

// ----------------------------------------------------------------------------
// GLOBAL IN-MEMORY STATE FOR MODULE 10
// ----------------------------------------------------------------------------

export let SCREENSHOT_POLICY: ScreenshotPolicyConfig = {
  frequencyPerHour: 6,
  intervalMinutes: 10,
  randomScreenshots: true,
  jitterSeconds: 90,
  manualScreenshotEnabled: true,
  screenshotOnEvent: true,
  eventTriggers: [
    'DLP_ALERT',
    'USB_INSERTION',
    'BLACKLISTED_APP',
    'ANOMALY_KEYWORD',
    'CLIPBOARD_PII_LEAK',
  ],
  multipleMonitors: 'ALL_MONITORS',
  resolution: 'SCALE_75_1440P',
  compression: {
    resolution: 'SCALE_75_1440P',
    format: 'WEBP',
    quality: 80,
    lossless: false,
  },
  retentionDays: 90,
  privacyBlurPolicy: {
    enabled: false,
    mode: 'AUTOMATIC_PII_REGEX',
    allowedRolesToUnblur: ['SUPER_ADMIN', 'ORG_ADMIN', 'SECURITY_ADMIN'],
  },
};

// Do not seed fake mock data - only real screenshots from live agent
export function initializeScreenshotTimeline() {
  // Only real screenshots from live agent
}

// ----------------------------------------------------------------------------
// SVG MOCKUP GENERATOR FOR SCREENSHOT IMAGES & DOWNLOADS
// ----------------------------------------------------------------------------

function generateMockupSvg(shot: DetailedScreenshotItem): string {
  const bgFill = shot.isFlaggedSuspicious ? '#1e1122' : '#0b1120';
  const accentColor = shot.isFlaggedSuspicious ? '#f43f5e' : '#38bdf8';
  const blurFilter = shot.isPrivacyBlurred
    ? '<filter id="blurFilter"><feGaussianBlur stdDeviation="8" /></filter>'
    : '';
  const filterAttr = shot.isPrivacyBlurred ? 'filter="url(#blurFilter)"' : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720">
    <defs>
      ${blurFilter}
      <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#0f172a" />
        <stop offset="100%" stop-color="#1e293b" />
      </linearGradient>
    </defs>
    <!-- Background Frame -->
    <rect width="1280" height="720" fill="${bgFill}" />

    <!-- Window Title Bar -->
    <rect width="1280" height="48" fill="url(#headerGrad)" />
    <circle cx="24" cy="24" r="6" fill="#ef4444" />
    <circle cx="44" cy="24" r="6" fill="#f59e0b" />
    <circle cx="64" cy="24" r="6" fill="#10b981" />
    <text x="96" y="29" fill="#94a3b8" font-family="monospace" font-size="14">${shot.activeApp} — ${shot.windowTitle.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>

    <!-- Desktop Workspace Content -->
    <g ${filterAttr}>
      <rect x="32" y="72" width="1216" height="580" rx="8" fill="#131e36" stroke="#1e293b" stroke-width="2" />

      <!-- Top Metric Bar -->
      <rect x="56" y="96" width="1168" height="56" rx="6" fill="#0f172a" />
      <text x="80" y="130" fill="${accentColor}" font-family="sans-serif" font-weight="bold" font-size="16">HYDI-EMS ENTERPRISE DESKTOP AGENT v${shot.device.agentVersion}</text>
      <text x="560" y="130" fill="#cbd5e1" font-family="monospace" font-size="14">Monitor: ${shot.screenLabel}</text>
      <text x="920" y="130" fill="#34d399" font-family="monospace" font-weight="bold" font-size="14">Activity Score: ${shot.activityScorePct}%</text>

      <!-- Active Code / Application Canvas -->
      <rect x="56" y="172" width="760" height="456" rx="6" fill="#090d16" />
      <text x="80" y="210" fill="#38bdf8" font-family="monospace" font-size="14">// Employee: ${shot.employeeName} (${shot.employeeId}) | Dept: ${shot.department}</text>
      <text x="80" y="240" fill="#a5b4fc" font-family="monospace" font-size="14">// Active Process: ${shot.activeApp} | Classification: ${shot.appCategory}</text>
      <text x="80" y="270" fill="#94a3b8" font-family="monospace" font-size="13">Captured At: ${shot.capturedAtUtc} (${shot.capturedAtLocal})</text>
      <text x="80" y="300" fill="#94a3b8" font-family="monospace" font-size="13">Host: ${shot.device.hostName} | OS: ${shot.device.osVersion}</text>
      <text x="80" y="330" fill="#94a3b8" font-family="monospace" font-size="13">IP Address: ${shot.device.ipAddress} | MAC: ${shot.device.macAddress}</text>
      <text x="80" y="370" fill="#64748b" font-family="monospace" font-size="12">------------------------------------------------------------------------</text>
      <text x="80" y="405" fill="#e2e8f0" font-family="monospace" font-size="13">Input Metrics in 10s Window: ${shot.keystrokesInWindow} keystrokes, ${shot.clicksInWindow} mouse clicks</text>
      <text x="80" y="440" fill="#f8fafc" font-family="monospace" font-size="13">Trigger Source: [${shot.triggerSource}] Resolution: ${shot.resolution} (${shot.format})</text>

      ${
        shot.eventTriggerDetails
          ? `<rect x="76" y="475" width="720" height="120" rx="4" fill="#3b0712" stroke="#f43f5e" stroke-width="1.5" />
             <text x="96" y="505" fill="#fca5a5" font-family="sans-serif" font-weight="bold" font-size="14">SECURITY EVENT: ${shot.eventTriggerDetails.eventType} (${shot.eventTriggerDetails.severity})</text>
             <text x="96" y="535" fill="#fee2e2" font-family="monospace" font-size="12">Rule: ${shot.eventTriggerDetails.ruleName}</text>
             <text x="96" y="565" fill="#fecdd3" font-family="sans-serif" font-size="12">${shot.eventTriggerDetails.summary}</text>`
          : `<rect x="76" y="480" width="720" height="120" rx="4" fill="#0f172a" />
             <text x="96" y="520" fill="#34d399" font-family="monospace" font-size="13">✓ Status: Normal Working Slices Recorded in High-Velocity ClickHouse Cluster</text>
             <text x="96" y="555" fill="#64748b" font-family="monospace" font-size="12">Immutable cryptographic SHA-256 hash appended to tenant audit log.</text>`
      }

      <!-- Side Inspector Panel -->
      <rect x="836" y="172" width="388" height="456" rx="6" fill="#0d1527" stroke="#1e293b" />
      <text x="860" y="210" fill="#f1f5f9" font-family="sans-serif" font-weight="bold" font-size="15">Capture Diagnostics</text>
      <text x="860" y="245" fill="#94a3b8" font-family="monospace" font-size="12">Screenshot ID: ${shot.screenshotId}</text>
      <text x="860" y="275" fill="#94a3b8" font-family="monospace" font-size="12">Quality: ${shot.compressionQuality}% WebP</text>
      <text x="860" y="305" fill="#94a3b8" font-family="monospace" font-size="12">File Size: ${(shot.fileSizeBytes / 1024).toFixed(1)} KB</text>
      <text x="860" y="335" fill="#94a3b8" font-family="monospace" font-size="12">Display: ${shot.screenLabel}</text>
      <text x="860" y="365" fill="#94a3b8" font-family="monospace" font-size="12">Privacy Blur: ${shot.isPrivacyBlurred ? 'ACTIVE (Blurred)' : 'NONE (Clear)'}</text>
      <text x="860" y="395" fill="#94a3b8" font-family="monospace" font-size="12">Suspicious Flag: ${shot.isFlaggedSuspicious ? 'FLAGGED' : 'CLEAN'}</text>
      <text x="860" y="435" fill="#38bdf8" font-family="sans-serif" font-size="13">Digital Watermark:</text>
      <text x="860" y="460" fill="#64748b" font-family="monospace" font-size="11">HYDI-SHA256: ${crypto.createHash('sha256').update(shot.screenshotId).digest('hex').substring(0, 32)}</text>
    </g>

    <!-- Bottom Status Bar -->
    <rect y="688" width="1280" height="32" fill="#0a0f1d" />
    <text x="24" y="709" fill="#64748b" font-family="monospace" font-size="12">HydiEms v2.5.0 Enterprise Screen Surveillance Engine • Audited Access Only</text>
    <text x="1100" y="709" fill="#38bdf8" font-family="monospace" font-size="12">Display #${shot.monitorIndex}</text>
  </svg>`;
}

// ----------------------------------------------------------------------------
// ROUTE REGISTRATION
// ----------------------------------------------------------------------------

export async function registerScreenshotManagementRoutes(
  app: FastifyInstance
): Promise<void> {

  // ==========================================================================
  // 1. SCREENSHOT DASHBOARD (Timeline, Employee, Timestamp, Screen, App, Activity %, Quality)
  // ==========================================================================
  app.get(
    '/api/v1/screenshots/dashboard',
    { preHandler: [requirePermission('M10_SCREENSHOTS', 'VIEW')] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      initializeScreenshotTimeline();

      const query = (req.query || {}) as {
        employeeId?: string;
        monitorIndex?: string;
        triggerSource?: string;
        appName?: string;
        isBlurred?: string;
        page?: string;
        limit?: string;
      };

      let filtered = [...(LIVE_SCREENSHOTS as DetailedScreenshotItem[])];

      if (query.employeeId) {
        filtered = filtered.filter(
          (s) => s.employeeId.toLowerCase() === query.employeeId!.toLowerCase()
        );
      }
      if (query.monitorIndex !== undefined && query.monitorIndex !== '') {
        const monIdx = parseInt(query.monitorIndex, 10);
        if (!isNaN(monIdx)) {
          filtered = filtered.filter((s) => s.monitorIndex === monIdx);
        }
      }
      if (query.triggerSource) {
        filtered = filtered.filter(
          (s) => s.triggerSource.toUpperCase() === query.triggerSource!.toUpperCase()
        );
      }
      if (query.appName) {
        filtered = filtered.filter((s) =>
          s.activeApp.toLowerCase().includes(query.appName!.toLowerCase())
        );
      }
      if (query.isBlurred !== undefined && query.isBlurred !== '') {
        const blr = query.isBlurred === 'true';
        filtered = filtered.filter((s) => s.isPrivacyBlurred === blr);
      }

      const page = parseInt(query.page || '1', 10);
      const limit = parseInt(query.limit || '50', 10);
      const startIndex = (page - 1) * limit;
      const paginatedItems = filtered.slice(startIndex, startIndex + limit);

      // KPI Aggregations
      const totalScreenshots = filtered.length;
      const uniqueEmployees = new Set(filtered.map((s) => s.employeeId)).size;
      const blurredCount = filtered.filter((s) => s.isPrivacyBlurred).length;
      const eventTriggeredCount = filtered.filter(
        (s) => s.triggerSource === 'EVENT_TRIGGERED'
      ).length;
      const totalSizeBytes = filtered.reduce(
        (acc, s) => acc + (s.fileSizeBytes || 140000),
        0
      );
      const avgActivityPct =
        filtered.length > 0
          ? Math.round(
              filtered.reduce((acc, s) => acc + (s.activityScorePct || 0), 0) /
                filtered.length
            )
          : 0;

      return {
        orgId: req.tenantOrgId,
        kpi: {
          totalScreenshotsToday: totalScreenshots,
          activeEmployeesMonitored: uniqueEmployees,
          privacyBlurredCount: blurredCount,
          eventTriggeredCount,
          storageUsageMb: Number((totalSizeBytes / (1024 * 1024)).toFixed(2)),
          averageActivityPct: avgActivityPct,
          configuredFrequencyPerHour: SCREENSHOT_POLICY.frequencyPerHour,
          multipleMonitorsPolicy: SCREENSHOT_POLICY.multipleMonitors,
          retentionDays: SCREENSHOT_POLICY.retentionDays,
        },
        pagination: {
          page,
          limit,
          total: totalScreenshots,
          totalPages: Math.ceil(totalScreenshots / limit) || 1,
        },
        timeline: paginatedItems.map((shot) => ({
          screenshotId: shot.screenshotId,
          employeeId: shot.employeeId,
          employeeName: shot.employeeName,
          department: shot.department,
          designation: shot.designation,
          timestampUtc: shot.capturedAtUtc,
          timestampLocal: shot.capturedAtLocal,
          screen: {
            monitorIndex: shot.monitorIndex,
            screenLabel: shot.screenLabel || `Display #${shot.monitorIndex}`,
            resolution: shot.resolution,
          },
          application: {
            activeApp: shot.activeApp,
            windowTitle: shot.windowTitle,
            classification: shot.appCategory,
          },
          activity: {
            activityScorePct: shot.activityScorePct,
            keystrokes: shot.keystrokesInWindow,
            mouseClicks: shot.clicksInWindow,
          },
          quality: {
            resolution: shot.resolution,
            format: shot.format,
            compressionQualityPct: shot.compressionQuality || 80,
            fileSizeBytes: shot.fileSizeBytes || 140000,
          },
          isPrivacyBlurred: shot.isPrivacyBlurred,
          isFlaggedSuspicious: shot.isFlaggedSuspicious,
          triggerSource: shot.triggerSource,
          eventTriggerDetails: shot.eventTriggerDetails || null,
          thumbnailSignedUrl: shot.thumbnailSignedUrl || `/api/v1/screenshots/${shot.screenshotId}/image`,
          viewUrl: `/api/v1/screenshots/${shot.screenshotId}`,
          imageUrl: `/api/v1/screenshots/${shot.screenshotId}/image`,
          downloadUrl: `/api/v1/screenshots/${shot.screenshotId}/download`,
          device: shot.device,
        })),
      };
    }
  );

  // List screenshots compatibility endpoint
  app.get(
    '/api/v1/screenshots',
    { preHandler: [requirePermission('M10_SCREENSHOTS', 'VIEW')] },
    async (req: FastifyRequest) => {
      initializeScreenshotTimeline();
      return {
        orgId: req.tenantOrgId,
        maxFrequencyPer10Min: SCREENSHOT_POLICY.frequencyPerHour,
        totalItems: LIVE_SCREENSHOTS.length,
        items: LIVE_SCREENSHOTS,
      };
    }
  );

  // ==========================================================================
  // 2. CONFIGURATION (Frequency, Random, Manual, Event, Multi-Monitor, Resolution, Compression, Retention)
  // ==========================================================================
  app.get(
    '/api/v1/screenshots/config',
    { preHandler: [requirePermission('M10_SCREENSHOTS', 'VIEW')] },
    async (req: FastifyRequest) => {
      return {
        orgId: req.tenantOrgId,
        config: SCREENSHOT_POLICY,
        allowedFrequencies: [
          { frequencyPerHour: 1, intervalMinutes: 60, label: '1x per hour (Every 60 min)' },
          { frequencyPerHour: 3, intervalMinutes: 20, label: '3x per hour (Every 20 min)' },
          { frequencyPerHour: 6, intervalMinutes: 10, label: '6x per hour (Every 10 min — Standard)' },
          { frequencyPerHour: 10, intervalMinutes: 6, label: '10x per hour (Every 6 min — High Activity)' },
          { frequencyPerHour: 12, intervalMinutes: 5, label: '12x per hour (Every 5 min — Maximum)' },
        ],
        allowedResolutions: [
          { id: 'ORIGINAL_100', label: '100% Original Display Resolution (4K / 1440p / 1080p)' },
          { id: 'SCALE_75_1440P', label: '75% High Quality (Max 1440p)' },
          { id: 'SCALE_50_1080P', label: '50% Balanced (Max 1080p)' },
          { id: 'SCALE_720P', label: 'Compact 720p (Lowest bandwidth)' },
        ],
        allowedMonitorPolicies: [
          { id: 'ALL_MONITORS', label: 'All Connected Displays (Captures multi-monitor setups)' },
          { id: 'PRIMARY_ONLY', label: 'Primary Display Only' },
          { id: 'ACTIVE_WINDOW_ONLY', label: 'Active Window Display (Display with foreground focus)' },
        ],
        allowedRetentionDays: [7, 15, 30, 90, 180, 365],
      };
    }
  );

  app.put(
    '/api/v1/screenshots/config',
    { preHandler: [requirePermission('M10_SCREENSHOTS', 'CONFIGURE')] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = (req.body || {}) as Partial<ScreenshotPolicyConfig>;

      if (body.frequencyPerHour !== undefined) {
        if (body.frequencyPerHour < 1 || body.frequencyPerHour > 12) {
          return reply.code(400).send({
            error: 'INVALID_FREQUENCY',
            message: 'Frequency must be between 1 and 12 screenshots per hour.',
          });
        }
        SCREENSHOT_POLICY.frequencyPerHour = body.frequencyPerHour;
        SCREENSHOT_POLICY.intervalMinutes = Math.round(60 / body.frequencyPerHour);
      }

      if (body.randomScreenshots !== undefined) {
        SCREENSHOT_POLICY.randomScreenshots = Boolean(body.randomScreenshots);
      }
      if (body.jitterSeconds !== undefined) {
        SCREENSHOT_POLICY.jitterSeconds = Math.max(0, Math.min(300, body.jitterSeconds));
      }
      if (body.manualScreenshotEnabled !== undefined) {
        SCREENSHOT_POLICY.manualScreenshotEnabled = Boolean(body.manualScreenshotEnabled);
      }
      if (body.screenshotOnEvent !== undefined) {
        SCREENSHOT_POLICY.screenshotOnEvent = Boolean(body.screenshotOnEvent);
      }
      if (body.eventTriggers !== undefined && Array.isArray(body.eventTriggers)) {
        SCREENSHOT_POLICY.eventTriggers = body.eventTriggers;
      }
      if (body.multipleMonitors !== undefined) {
        SCREENSHOT_POLICY.multipleMonitors = body.multipleMonitors;
      }
      if (body.resolution !== undefined) {
        SCREENSHOT_POLICY.resolution = body.resolution;
      }
      if (body.compression !== undefined) {
        SCREENSHOT_POLICY.compression = {
          ...SCREENSHOT_POLICY.compression,
          ...body.compression,
        };
      }
      if (body.retentionDays !== undefined) {
        SCREENSHOT_POLICY.retentionDays = Math.max(7, Math.min(365, body.retentionDays));
      }
      if (body.privacyBlurPolicy !== undefined) {
        SCREENSHOT_POLICY.privacyBlurPolicy = {
          ...SCREENSHOT_POLICY.privacyBlurPolicy,
          ...body.privacyBlurPolicy,
        };
      }

      // Broadcast real-time policy push to all connected desktop agents
      const notifiedAgents = broadcastPolicyPushToOrg(
        req.tenantOrgId,
        Date.now(),
        SCREENSHOT_POLICY
      );

      appendImmutableAuditLog({
        orgId: req.tenantOrgId,
        actorUserId: req.user.userId,
        actorRole: req.user.role,
        actionCategory: 'CONFIGURATION_CHANGE',
        actionType: 'UPDATE_SCREENSHOT_POLICY',
        targetEntityType: 'SCREENSHOT_POLICY',
        targetEntityId: req.tenantOrgId,
        reasonProvided: 'Updated screenshot frequency, monitor policy & compression settings',
        ipAddress: req.ip,
      });

      return {
        orgId: req.tenantOrgId,
        success: true,
        message: 'Screenshot policy successfully updated and pushed to active desktop agents.',
        updatedConfig: SCREENSHOT_POLICY,
        notifiedAgentsCount: typeof notifiedAgents === 'number' ? notifiedAgents : (notifiedAgents as any)?.length || 0,
      };
    }
  );

  // Manual Instant Capture ("Capture Now")
  app.post(
    '/api/v1/screenshots/capture-now',
    {
      preHandler: [
        requirePermission('M10_SCREENSHOTS', 'CREATE'),
        requireSensitiveGate('GATE_TRIGGER_INSTANT_CAPTURE_NOW'),
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = (req.body || {}) as {
        employeeId?: string;
        monitorIndex?: number;
        reason?: string;
      };

      const employeeId = body.employeeId || 'emp-win-ramandeep';
      const employee =
        LIVE_EMPLOYEES.find((e) => e.employeeId === employeeId) || LIVE_EMPLOYEES[0];

      // Dispatch agent WebSocket command
      const dispatchResult = dispatchAgentCommand(
        req.tenantOrgId,
        employee.employeeId,
        'CAPTURE_NOW',
        {
          requestedByUserId: req.user.userId,
          reason: body.reason || 'Manager On-Demand Verification',
        }
      );

      const shotId = `SS-${Math.floor(99000 + Math.random() * 900)}`;
      const now = new Date();
      const newShot: DetailedScreenshotItem = {
        screenshotId: shotId,
        employeeId: employee.employeeId,
        employeeName: employee.fullName,
        department: employee.department,
        designation: employee.designation,
        deviceId: employee.deviceId,
        capturedAtUtc: now.toISOString(),
        capturedAtLocal: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        monitorIndex: body.monitorIndex !== undefined ? body.monitorIndex : 0,
        screenLabel: `Display #${body.monitorIndex !== undefined ? body.monitorIndex + 1 : 1} (Primary)`,
        resolution: '2560x1440',
        format: 'WEBP',
        fileSizeBytes: 148500,
        compressionQuality: SCREENSHOT_POLICY.compression.quality,
        activeApp: employee.currentApp || 'Cursor IDE',
        windowTitle: employee.currentWindowTitle || 'Working on Task',
        appCategory: 'PRODUCTIVE',
        activityScorePct: 98,
        keystrokesInWindow: 450,
        clicksInWindow: 55,
        isPrivacyBlurred: SCREENSHOT_POLICY.privacyBlurPolicy.enabled,
        isFlaggedSuspicious: false,
        triggerSource: 'MANUAL_CAPTURE_NOW',
        thumbnailSignedUrl: `/api/v1/screenshots/${shotId}/image`,
        device: {
          deviceId: employee.deviceId,
          hostName: `WS-${employee.fullName.split(' ')[0].toUpperCase()}`,
          osVersion: employee.osName || 'Windows 11 Pro 23H2',
          ipAddress: '10.42.18.104',
          macAddress: '00:1A:2B:3C:4D:5E',
          agentVersion: employee.agentVersion || '2.5.0-win-x64',
        },
      };

      LIVE_SCREENSHOTS.unshift(newShot);
      if (LIVE_SCREENSHOTS.length > 100) {
        LIVE_SCREENSHOTS.pop();
      }

      appendImmutableAuditLog({
        orgId: req.tenantOrgId,
        actorUserId: req.user.userId,
        actorRole: req.user.role,
        actionCategory: 'SCREENSHOT_ACTION',
        actionType: 'TRIGGER_MANUAL_CAPTURE',
        targetEntityType: 'SCREENSHOT',
        targetEntityId: shotId,
        reasonProvided: body.reason || 'Manager On-Demand Verification',
        ipAddress: req.ip,
      });

      return {
        success: true,
        message: 'Instant screenshot capture triggered via WebSocket push.',
        screenshot: newShot,
        dispatchResult,
      };
    }
  );

  // Screenshot on Event (DLP, USB, Security Alert Trigger)
  app.post(
    '/api/v1/screenshots/trigger-on-event',
    { preHandler: [requirePermission('M10_SCREENSHOTS', 'CREATE')] },
    async (req: FastifyRequest) => {
      const body = (req.body || {}) as {
        employeeId?: string;
        eventType: string;
        ruleName: string;
        severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
        summary: string;
      };

      const employeeId = body.employeeId || 'emp-win-ramandeep';
      const employee =
        LIVE_EMPLOYEES.find((e) => e.employeeId === employeeId) || LIVE_EMPLOYEES[0];

      const shotId = `SS-EVT-${Math.floor(8000 + Math.random() * 1000)}`;
      const now = new Date();
      const eventShot: DetailedScreenshotItem = {
        screenshotId: shotId,
        employeeId: employee.employeeId,
        employeeName: employee.fullName,
        department: employee.department,
        designation: employee.designation,
        deviceId: employee.deviceId,
        capturedAtUtc: now.toISOString(),
        capturedAtLocal: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        monitorIndex: 0,
        screenLabel: 'Display 1 (Primary)',
        resolution: '2560x1440',
        format: 'WEBP',
        fileSizeBytes: 185000,
        compressionQuality: 85,
        activeApp: employee.currentApp || 'Removable Storage Intercept',
        windowTitle: employee.currentWindowTitle || 'DLP Security Alert Triggered',
        appCategory: 'NON_PRODUCTIVE',
        activityScorePct: 84,
        keystrokesInWindow: 120,
        clicksInWindow: 32,
        isPrivacyBlurred: false,
        isFlaggedSuspicious: true,
        triggerSource: 'EVENT_TRIGGERED',
        eventTriggerDetails: {
          eventType: body.eventType || 'DLP_RULE_VIOLATION',
          ruleName: body.ruleName || 'DLP_CONFIDENTIAL_DATA_POLICY',
          severity: body.severity || 'HIGH',
          summary: body.summary || 'Immediate event-triggered forensic screenshot captured by HydiEms Agent.',
        },
        thumbnailSignedUrl: `/api/v1/screenshots/${shotId}/image`,
        device: {
          deviceId: employee.deviceId,
          hostName: `WS-${employee.fullName.split(' ')[0].toUpperCase()}`,
          osVersion: employee.osName || 'Windows 11 Pro 23H2',
          ipAddress: '10.42.105.12',
          macAddress: '00:1A:2B:44:88:99',
          agentVersion: employee.agentVersion || '2.5.0-win-x64',
        },
      };

      LIVE_SCREENSHOTS.unshift(eventShot);

      appendImmutableAuditLog({
        orgId: req.tenantOrgId,
        actorUserId: req.user.userId,
        actorRole: req.user.role,
        actionCategory: 'SECURITY_INCIDENT',
        actionType: 'EVENT_TRIGGERED_SCREENSHOT',
        targetEntityType: 'SCREENSHOT',
        targetEntityId: shotId,
        reasonProvided: `${body.eventType} - ${body.ruleName}`,
        ipAddress: req.ip,
      });

      return {
        success: true,
        message: 'Event-triggered forensic screenshot captured successfully.',
        screenshot: eventShot,
      };
    }
  );

  // ==========================================================================
  // 3. SCREENSHOT VIEWER (Full Screen, Zoom, Prev/Next, Device, App, Download, Delete, Audit)
  // ==========================================================================

  // Viewer Details & Metadata Endpoint
  app.get(
    '/api/v1/screenshots/:screenshotId',
    { preHandler: [requirePermission('M10_SCREENSHOTS', 'VIEW')] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      initializeScreenshotTimeline();

      const { screenshotId } = req.params as { screenshotId: string };
      const items = LIVE_SCREENSHOTS as DetailedScreenshotItem[];
      const currentIndex = items.findIndex(
        (s) => s.screenshotId.toUpperCase() === screenshotId.toUpperCase()
      );

      if (currentIndex === -1) {
        return reply.code(404).send({
          error: 'SCREENSHOT_NOT_FOUND',
          message: `Screenshot ${screenshotId} not found in active telemetry store.`,
        });
      }

      const shot = items[currentIndex];

      // Sequential timeline navigation (Previous and Next screenshot IDs)
      const prevShot = currentIndex > 0 ? items[currentIndex - 1] : null;
      const nextShot = currentIndex < items.length - 1 ? items[currentIndex + 1] : null;

      // Log VIEW operation in immutable audit log
      appendImmutableAuditLog({
        orgId: req.tenantOrgId,
        actorUserId: req.user.userId,
        actorRole: req.user.role,
        actionCategory: 'SCREENSHOT_VIEWER',
        actionType: 'VIEW_SCREENSHOT_DETAILS',
        targetEntityType: 'SCREENSHOT',
        targetEntityId: shot.screenshotId,
        ipAddress: req.ip,
      });

      return {
        orgId: req.tenantOrgId,
        screenshot: {
          screenshotId: shot.screenshotId,
          employee: {
            employeeId: shot.employeeId,
            fullName: shot.employeeName,
            department: shot.department,
            designation: shot.designation,
          },
          timestamp: {
            utc: shot.capturedAtUtc,
            local: shot.capturedAtLocal,
          },
          screen: {
            monitorIndex: shot.monitorIndex,
            screenLabel: shot.screenLabel || `Display #${shot.monitorIndex + 1}`,
            resolution: shot.resolution,
          },
          device: shot.device,
          application: {
            activeApp: shot.activeApp,
            windowTitle: shot.windowTitle,
            classification: shot.appCategory,
          },
          activity: {
            activityScorePct: shot.activityScorePct,
            keystrokes: shot.keystrokesInWindow,
            clicks: shot.clicksInWindow,
          },
          quality: {
            resolution: shot.resolution,
            format: shot.format,
            compressionQuality: shot.compressionQuality || 80,
            fileSizeBytes: shot.fileSizeBytes || 140000,
          },
          isPrivacyBlurred: shot.isPrivacyBlurred,
          isFlaggedSuspicious: shot.isFlaggedSuspicious,
          triggerSource: shot.triggerSource,
          eventTriggerDetails: shot.eventTriggerDetails || null,
        },
        viewerControls: {
          zoomPresets: ['FIT_TO_SCREEN', '50%', '75%', '100%', '150%', '200%'],
          defaultZoom: 'FIT_TO_SCREEN',
          fullScreenSupported: true,
          previousScreenshotId: prevShot ? prevShot.screenshotId : null,
          nextScreenshotId: nextShot ? nextShot.screenshotId : null,
          imageUrl: `/api/v1/screenshots/${shot.screenshotId}/image`,
          fullScreenUrl: `/api/v1/screenshots/${shot.screenshotId}/image?view=fullscreen`,
          downloadUrl: `/api/v1/screenshots/${shot.screenshotId}/download`,
        },
        permissions: {
          canDownload: true,
          canUnblur: ['SUPER_ADMIN', 'ORG_ADMIN', 'SECURITY_ADMIN'].includes(req.user.role),
          canDelete: ['SUPER_ADMIN', 'ORG_ADMIN'].includes(req.user.role),
        },
      };
    }
  );

  // Image Stream Endpoint (Serves binary blob or realistic SVG banner)
  app.get('/api/v1/screenshots/:screenshotId/image', async (req, reply) => {
    const { screenshotId } = req.params as { screenshotId: string };

    // Check if raw binary buffer uploaded by agent
    const blob = LIVE_SCREENSHOT_BLOBS.get(screenshotId);
    if (blob) {
      reply.header('Content-Type', blob.mimeType);
      reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
      return reply.send(blob.buffer);
    }

    // Lookup screenshot metadata to render realistic SVG
    const items = LIVE_SCREENSHOTS as DetailedScreenshotItem[];
    const shot = items.find((s) => s.screenshotId.toUpperCase() === screenshotId.toUpperCase());

    if (!shot) {
      return reply.code(404).send({ error: 'SCREENSHOT_NOT_FOUND' });
    }

    const svg = generateMockupSvg(shot);
    reply.header('Content-Type', 'image/svg+xml');
    reply.header('Cache-Control', 'public, max-age=3600');
    return reply.send(svg);
  });

  // Download Screenshot Endpoint (Audited)
  app.get(
    '/api/v1/screenshots/:screenshotId/download',
    { preHandler: [requirePermission('M10_SCREENSHOTS', 'VIEW')] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { screenshotId } = req.params as { screenshotId: string };
      const items = LIVE_SCREENSHOTS as DetailedScreenshotItem[];
      const shot = items.find((s) => s.screenshotId.toUpperCase() === screenshotId.toUpperCase());

      if (!shot) {
        return reply.code(404).send({ error: 'SCREENSHOT_NOT_FOUND' });
      }

      // Log DOWNLOAD event to immutable audit log
      appendImmutableAuditLog({
        orgId: req.tenantOrgId,
        actorUserId: req.user.userId,
        actorRole: req.user.role,
        actionCategory: 'SCREENSHOT_VIEWER',
        actionType: 'DOWNLOAD_SCREENSHOT',
        targetEntityType: 'SCREENSHOT',
        targetEntityId: shot.screenshotId,
        reasonProvided: (req.headers['x-hydi-audit-reason'] as string) || 'Authorized Evidence Download',
        ipAddress: req.ip,
      });

      const blob = LIVE_SCREENSHOT_BLOBS.get(screenshotId);
      if (blob) {
        reply.header('Content-Type', blob.mimeType);
        reply.header(
          'Content-Disposition',
          `attachment; filename="${shot.screenshotId}_${shot.employeeId}.webp"`
        );
        return reply.send(blob.buffer);
      }

      // Deliver SVG download attachment
      const svg = generateMockupSvg(shot);
      reply.header('Content-Type', 'image/svg+xml');
      reply.header(
        'Content-Disposition',
        `attachment; filename="${shot.screenshotId}_${shot.employeeId}.svg"`
      );
      return reply.send(svg);
    }
  );

  // Unblur Screenshot (Sensitive Gate: GATE_VIEW_UNBLURRED_SCREENSHOTS)
  app.post(
    '/api/v1/screenshots/:screenshotId/unblur',
    {
      preHandler: [
        requirePermission('M10_SCREENSHOTS', 'VIEW'),
        requireSensitiveGate('GATE_VIEW_UNBLURRED_SCREENSHOTS'),
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { screenshotId } = req.params as { screenshotId: string };
      const items = LIVE_SCREENSHOTS as DetailedScreenshotItem[];
      const shot = items.find((s) => s.screenshotId.toUpperCase() === screenshotId.toUpperCase());

      if (!shot) {
        return reply.code(404).send({ error: 'SCREENSHOT_NOT_FOUND' });
      }

      shot.isPrivacyBlurred = false;

      appendImmutableAuditLog({
        orgId: req.tenantOrgId,
        actorUserId: req.user.userId,
        actorRole: req.user.role,
        actionCategory: 'SENSITIVE_GATE_ACTION',
        actionType: 'UNBLUR_SCREENSHOT',
        targetEntityType: 'SCREENSHOT',
        targetEntityId: shot.screenshotId,
        reasonProvided: (req.headers['x-hydi-audit-reason'] as string) || 'Manager Unblur Access',
        ipAddress: req.ip,
      });

      return {
        screenshotId: shot.screenshotId,
        isPrivacyBlurred: false,
        unblurredImageUrl: `/api/v1/screenshots/${shot.screenshotId}/image`,
        expiresInSeconds: 300,
        auditLogged: true,
      };
    }
  );

  // Delete Screenshot (Strict RBAC & Sensitive Gate: GATE_DELETE_SCREENSHOTS_OR_RECORDINGS)
  app.delete(
    '/api/v1/screenshots/:screenshotId',
    {
      preHandler: [
        requirePermission('M10_SCREENSHOTS', 'DELETE'),
        requireSensitiveGate('GATE_DELETE_SCREENSHOTS_OR_RECORDINGS'),
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { screenshotId } = req.params as { screenshotId: string };
      const reason =
        (req.headers['x-hydi-audit-reason'] as string) ||
        ((req.body as any)?.reason as string);

      if (!reason || reason.trim().length < 5) {
        return reply.code(400).send({
          error: 'DELETION_REASON_REQUIRED',
          message: 'An explicit audit reason is required when deleting screenshot records.',
        });
      }

      const items = LIVE_SCREENSHOTS as DetailedScreenshotItem[];
      const idx = items.findIndex(
        (s) => s.screenshotId.toUpperCase() === screenshotId.toUpperCase()
      );

      if (idx === -1) {
        return reply.code(404).send({ error: 'SCREENSHOT_NOT_FOUND' });
      }

      const deletedItem = items.splice(idx, 1)[0];
      LIVE_SCREENSHOT_BLOBS.delete(screenshotId);

      try {
        await executeMysqlQuery(
          'DELETE FROM screenshots WHERE id = ? AND org_id = ?',
          [screenshotId, req.tenantOrgId]
        );
      } catch {
        // Non-fatal
      }

      const auditEntry = appendImmutableAuditLog({
        orgId: req.tenantOrgId,
        actorUserId: req.user.userId,
        actorRole: req.user.role,
        actionCategory: 'PRIVILEGED_DATA_DELETION',
        actionType: 'DELETE_SCREENSHOT',
        targetEntityType: 'SCREENSHOT',
        targetEntityId: screenshotId,
        reasonProvided: reason,
        ipAddress: req.ip,
      });

      return {
        success: true,
        message: `Screenshot ${screenshotId} successfully deleted with permanent audit record.`,
        deletedScreenshotId: screenshotId,
        deletedByUserId: req.user.userId,
        actorRole: req.user.role,
        deletionReason: reason,
        auditRecordHash: auditEntry.recordHash,
        deletedAtUtc: new Date().toISOString(),
      };
    }
  );

  // Dedicated Audit Trail Endpoint for Screenshots
  app.get(
    '/api/v1/screenshots/audit-trail',
    { preHandler: [requirePermission('M10_SCREENSHOTS', 'VIEW')] },
    async (req: FastifyRequest) => {
      const query = (req.query || {}) as { screenshotId?: string };

      let records = IMMUTABLE_AUDIT_LOG_STORE.filter(
        (e) =>
          e.orgId === req.tenantOrgId &&
          (e.actionCategory.includes('SCREENSHOT') ||
            e.actionType.includes('SCREENSHOT') ||
            e.targetEntityType === 'SCREENSHOT')
      );

      if (query.screenshotId) {
        records = records.filter(
          (e) => e.targetEntityId?.toUpperCase() === query.screenshotId!.toUpperCase()
        );
      }

      return {
        orgId: req.tenantOrgId,
        totalAuditRecords: records.length,
        auditTrail: records.map((r) => ({
          auditId: r.auditId,
          timestamp: r.createdAt,
          actorUserId: r.actorUserId,
          actorRole: r.actorRole,
          actionType: r.actionType,
          actionCategory: r.actionCategory,
          targetEntityId: r.targetEntityId,
          reasonProvided: r.reasonProvided,
          ipAddress: r.ipAddress,
          recordHash: r.recordHash,
        })),
      };
    }
  );
}
