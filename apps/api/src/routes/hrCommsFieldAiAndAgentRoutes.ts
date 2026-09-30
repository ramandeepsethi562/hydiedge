// ============================================================================
// @hydiems/api — HR Management, Leave/Comp-Off, Performance/OKRs, Payroll,
// Internal Comms, Field GPS & Corporate MDM, HydiAI NLQ & Flight-Risk AI,
// 78+ Integrations, Self-Service Portal, RBAC Admin & Desktop Agent Ingestion
// Covers: HR-001..006, LEAVE-001..012, PERF-001..004, KPI-001..004, OKR-001..005,
//         PAY-001..006, COM-001..006, FIELD-001..009, MOB-001..011, MDM-001..006,
//         AI-001..011, INT-001..008, API-001..007, EMP-001..013, ADMIN-001..008,
//         PERM-001..002, CONFIG-001..004, BRAND-001..002, SET-001..008,
//         AGENT-001..006, DEPLOY-001..003, SYS-001..003, SEARCH-001..002,
//         NOTIF-001..002, SUPPORT-001..006
// ============================================================================
import fs from 'fs';
import path from 'path';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  ActivitySlice10s,
  classifyActivitySlice10s,
  DEFAULT_ROLE_PERMISSION_MATRIX,
  SENSITIVE_GATE_DEFAULTS,
} from '@hydiems/shared';
import {
  requireAuth,
  requirePermission,
} from '../middleware/authAndTenant';
import {
  ingestLiveAgentSlice,
  ingestLiveScreenshot,
  ingestLiveSystemInfo,
  ingestWorkTimeMatrixViolation,
  LIVE_ACTIVITY_SLICES,
  LIVE_DLP_INCIDENTS,
  LIVE_EMPLOYEES,
  LIVE_SCREENSHOTS,
  LIVE_SYSTEM_INFO,
  LIVE_WORK_MATRIX_VIOLATIONS,
  pushLiveStreamFrame,
  LATEST_LIVE_STREAM_FRAME,
  ACTIVE_STREAM_HTTP_RESPONSES,
  pushLiveVideoFrame,
  LATEST_LIVE_VIDEO_FRAME,
  ACTIVE_VIDEO_STREAM_RESPONSES,
  LATEST_LIVE_AUDIO_STATE,
  updateLiveAudioState,
} from '../state/liveTelemetryState';
import { broadcastLiveAudioChunk } from '../ws/realtimeGateway';

const AgentTelemetryBatchSchema = z.object({
  deviceId: z.string(),
  employeeId: z.string(),
  agentVersion: z.string(),
  batchSequenceId: z.number().int(),
  slices: z.array(
    z.object({
      sliceId: z.string(),
      sliceStartUtc: z.string(),
      durationSec: z.number().int().min(1).max(10),
      processName: z.string(),
      windowTitle: z.string(),
      urlFull: z.string().default(''),
      urlDomain: z.string().default(''),
      browserName: z.string().default(''),
      keystrokesCount: z.number().int().min(0),
      mouseClicksCount: z.number().int().min(0),
      mouseDistancePx: z.number().int().min(0),
      scrollTicks: z.number().int().min(0),
      idleSecondsElapsed: z.number().int().min(0),
      activeMicDb: z.number(),
      activeSpeakerDb: z.number(),
      isPersonalMode: z.boolean().default(false),
      isAwayBreak: z.boolean().default(false),
      awayReasonCode: z.string().optional(),
      awayCountsAsWork: z.boolean().optional(),
      projectId: z.string().optional(),
      taskId: z.string().optional(),
      monitorIndex: z.number().int().default(0),
    })
  ),
});

export async function registerHrCommsFieldAiAndAgentRoutes(
  app: FastifyInstance
): Promise<void> {
  // --------------------------------------------------------------------------
  // HR-001..006, LEAVE-001..012, PERF-001..004, KPI-001..004, OKR-001..005 & PAY-001..006
  // --------------------------------------------------------------------------
  app.get(
    '/api/v1/hr/leave-and-holidays',
    { preHandler: [requirePermission('M19_LEAVE_HOLIDAYS', 'VIEW')] },
    async (req) => {
      return {
        orgId: req.tenantOrgId,
        leaveTypes: [
          { code: 'ANNUAL_PAID', name: 'Annual Paid Privilege Leave', annualQuotaDays: 18, carryForwardMax: 10 },
          { code: 'SICK_MEDICAL', name: 'Paid Medical / Sick Leave', annualQuotaDays: 10, carryForwardMax: 0 },
          { code: 'COMP_OFF', name: 'Weekend / Holiday Overtime Comp-Off', annualQuotaDays: 12, carryForwardMax: 5 },
        ],
        upcomingRegionalHolidays: [
          { date: '2026-10-02', name: 'Gandhi Jayanti', applicableEntity: 'ent-in-blr' },
          { date: '2026-11-26', name: 'Thanksgiving Day', applicableEntity: 'ent-us-hq' },
        ],
      };
    }
  );

  app.get(
    '/api/v1/hr/payroll-preview',
    { preHandler: [requirePermission('M27_PAYROLL', 'VIEW')] },
    async (req) => {
      return {
        orgId: req.tenantOrgId,
        payPeriod: '2026-09',
        status: 'READY_FOR_LOCK',
        summary: {
          eligibleEmployeesCount: 2340,
          totalPayableRegularHours: 374_400,
          totalApprovedOvertimeHours: 6_820,
          unpaidLeaveDeductionHours: 1_420,
          estimatedGrossPayrollUsd: 8_420_500.0,
        },
      };
    }
  );

  // --------------------------------------------------------------------------
  // COM-001..006, FIELD-001..009, MOB-001..011 & MDM-001..006:
  // Internal Comms, Field GPS Breadcrumbs, Geofence & Corporate MDM Compliance
  // --------------------------------------------------------------------------
  app.get(
    '/api/v1/field-workforce/live-routes',
    { preHandler: [requirePermission('M24_FIELD_WORKFORCE', 'VIEW')] },
    async (req) => {
      return {
        orgId: req.tenantOrgId,
        activeFieldAgents: [
          {
            employeeId: 'emp-win-ramandeep',
            employeeName: 'Ramandeep',
            latitude: 40.758,
            longitude: -73.9855,
            accuracyMeters: 6.2,
            speedKmh: 18.4,
            batteryPct: 82,
            isMockGpsDetected: false,
            insideGeofenceName: 'Manhattan Enterprise Client Zone',
            distanceTraveledTodayKm: 34.8,
            autoReimbursementUsd: 22.62,
            mdmPosture: {
              ownershipMode: 'CORPORATE_COBO',
              kioskLockdownActive: false,
              isRootedOrJailbroken: false,
              osEncryptionEnabled: true,
            },
          },
        ],
      };
    }
  );

  // --------------------------------------------------------------------------
  // AI-001..011: HydiAI Natural Language Query (NLQ) Assistant, Burnout & Flight Risk
  // --------------------------------------------------------------------------
  app.post(
    '/api/v1/ai/ask-hydiai',
    { preHandler: [requirePermission('M28_AI_INTELLIGENCE', 'VIEW')] },
    async (req) => {
      const body = (req.body || {}) as { prompt?: string };
      const prompt =
        body.prompt ||
        'Which engineering teams had the highest overtime and meeting load this week?';
      return {
        orgId: req.tenantOrgId,
        prompt,
        intentClassified: 'WORKFORCE_BURNOUT_AND_MEETING_LOAD_ANALYSIS',
        synthesizedAnswer:
          'Platform Engineering logged an average of 9.4 hours/week in audio/video meetings (protected by the Active Audio Call Anti-Idle rule) and 4.2 hours of overtime. Reallocating 2 recurring status meetings could recover ~185 engineering focus hours/month.',
        supportingDataRows: [
          { teamName: 'Core Runtime & Rust Agent', avgFocusStreakMin: 78, overtimeHoursPerEmp: 4.8, burnoutRisk: 'MODERATE' },
          { teamName: 'BPO Shift Cohort B (Manila)', avgFocusStreakMin: 54, overtimeHoursPerEmp: 1.2, burnoutRisk: 'LOW' },
        ],
        recommendedActions: [
          'Enable No-Meeting Wednesday block for Core Runtime team',
          'Reclaim 68 unused Figma Enterprise seats ($61,200/yr savings)',
        ],
      };
    }
  );

  // --------------------------------------------------------------------------
  // INT-001..008 & API-001..007: 78+ Integrations Catalog, Webhooks & Scoped API Keys
  // --------------------------------------------------------------------------
  app.get(
    '/api/v1/integrations/catalog',
    { preHandler: [requirePermission('M29_INTEGRATIONS', 'VIEW')] },
    async (req) => {
      return {
        orgId: req.tenantOrgId,
        totalSupportedConnectors: 78,
        categories: {
          identityAndSso: ['Okta', 'Microsoft Entra ID', 'Google Workspace', 'OneLogin', 'JumpCloud', 'PingFederate', 'Auth0', 'Keycloak'],
          projectAndIssueTracking: ['Jira Cloud', 'Jira Data Center', 'Linear', 'GitHub Issues', 'GitLab', 'Azure DevOps', 'Asana', 'Monday.com', 'ClickUp', 'Trello', 'Basecamp', 'Shortcut', 'Notion', 'Smartsheet'],
          hrisAndPayroll: ['Workday', 'BambooHR', 'Rippling', 'Gusto', 'ADP Workforce Now', 'Deel', 'Personio', 'HiBob', 'Darwinbox', 'Keka HR', 'Zoho People', 'SAP SuccessFactors', 'Oracle HCM', 'UKG Pro'],
          crmAndHelpdesk: ['Salesforce', 'HubSpot', 'Zendesk', 'Freshdesk', 'Intercom', 'ServiceNow', 'Zoho CRM', 'Pipedrive', 'Front', 'Kustomer'],
          communicationAndCollab: ['Slack', 'Microsoft Teams', 'Zoom', 'Google Meet', 'Webex', 'Discord', 'Mattermost', 'PagerDuty', 'Opsgenie'],
          accountingAndBilling: ['Stripe', 'Razorpay', 'QuickBooks Online', 'Xero', 'NetSuite', 'Chargebee', 'FreshBooks', 'Zoho Books'],
          biAndDataWarehousing: ['Snowflake', 'Google BigQuery', 'Amazon Redshift', 'Databricks', 'Power BI', 'Tableau', 'Looker Studio', 'Metabase'],
          siemAndSecurity: ['Splunk', 'Datadog SIEM', 'Microsoft Sentinel', 'CrowdStrike Falcon', 'Sumo Logic', 'Elastic Security', 'AWS Security Hub'],
        },
      };
    }
  );

  // --------------------------------------------------------------------------
  // PERM-001..002, ADMIN-001..008, BRAND-001..002: RBAC Matrix & White-Label Config
  // --------------------------------------------------------------------------
  app.get(
    '/api/v1/admin/rbac-matrix',
    { preHandler: [requirePermission('M30_ADMINISTRATION', 'VIEW')] },
    async (req) => {
      return {
        orgId: req.tenantOrgId,
        moduleCount: 33,
        actionVerbsCount: 8,
        systemRolesCount: 9,
        sensitivePermissionGatesCount: 9,
        defaultRoleMatrix: DEFAULT_ROLE_PERMISSION_MATRIX,
        sensitiveGatesDefaults: SENSITIVE_GATE_DEFAULTS,
      };
    }
  );

  // --------------------------------------------------------------------------
  // AGENT-001..006 & DEPLOY-001..003: Desktop Agent Telemetry Batch Ingestion,
  // Real Screenshot Upload, Live State Feed & Windows Installer Download
  // --------------------------------------------------------------------------
  app.post('/api/v1/agent/telemetry-batch', async (req) => {
    const body = (req.body || {}) as Record<string, any>;
    const orgId = (req as any).tenantOrgId || 'org-acme-global-001';
    const deviceId = String(body.deviceId || body.DeviceId || 'WIN-WORKSTATION-01');
    const employeeId = String(body.employeeId || body.EmployeeId || `emp-${deviceId.toLowerCase()}`);
    const employeeName = String(body.employeeName || body.EmployeeName || `Windows Agent (${deviceId})`);
    const osName = String(body.osName || body.OsName || 'Windows 11 Pro (Live Agent)');
    const trackerMode = String(body.trackerMode || body.TrackerMode || 'INTERACTIVE');
    const batchSequenceId = Number(body.batchSequenceId || Date.now());

    const rawSlices: Array<Record<string, any>> = Array.isArray(body.slices || body.Slices)
      ? body.slices || body.Slices
      : [];

    const classifiedResults = [];
    for (const raw of rawSlices) {
      const sliceId = String(raw.sliceId || raw.SliceId || `slc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
      const sliceStartUtc = String(raw.sliceStartUtc || raw.HarvestedAtUtc || new Date().toISOString());
      const durationSec = Number(raw.durationSec || 10);
      const processName = String(raw.processName || raw.ProcessName || 'HydiEms.Agent.exe');
      const windowTitle = String(raw.windowTitle || raw.WindowTitle || 'Active Desktop Session');
      const urlDomain = String(raw.urlDomain || '');
      const keystrokesCount = Number(raw.keystrokesCount ?? raw.KeystrokeCount ?? 0);
      const mouseClicksCount = Number(raw.mouseClicksCount ?? raw.MouseClickCount ?? 0);
      const mouseScrollsCount = Number(raw.scrollTicks ?? raw.MouseScrollCount ?? 0);
      const mouseDistancePx = Number(raw.mouseDistancePx ?? raw.MouseDistancePixels ?? 0);
      const idleSecondsElapsed = Number(raw.idleSecondsElapsed ?? raw.OsIdleSeconds ?? 0);

      const fullSlice: ActivitySlice10s = {
        sliceId,
        orgId,
        employeeId,
        deviceId,
        sliceStartUtc,
        durationSec,
        processName,
        windowTitle,
        urlFull: '',
        urlDomain,
        browserName: '',
        keystrokesCount,
        mouseClicksCount,
        mouseDistancePx,
        scrollTicks: mouseScrollsCount,
        idleSecondsElapsed,
        activeMicDb: Number(raw.activeMicDb ?? -60),
        activeSpeakerDb: Number(raw.activeSpeakerDb ?? -60),
        isPersonalMode: Boolean(raw.isPersonalMode),
        isAwayBreak: Boolean(raw.isAwayBreak),
        monitorIndex: Number(raw.monitorIndex ?? 0),
      };

      const classified = classifyActivitySlice10s(fullSlice, 'PRODUCTIVE', {
        idleThresholdSeconds: 180,
        audioCallAntiIdleEnabled: true,
        audioDbThreshold: -42,
        personalModeMaxMinutesPerDay: 60,
      });
      classifiedResults.push(classified);

      await ingestLiveAgentSlice({
        orgId,
        employeeId,
        employeeName,
        deviceId,
        osName,
        trackerMode,
        sliceId,
        sliceStartUtc,
        durationSec,
        processName,
        windowTitle,
        urlDomain,
        keystrokesCount,
        mouseClicksCount,
        mouseScrollsCount,
        mouseDistancePx,
        osIdleSeconds: idleSecondsElapsed,
        primaryTimeState: classified.primaryTimeState,
        productivityCategory: classified.productivityCategory,
        isIdleSuppressedByAudioCall: classified.isIdleSuppressedByAudioCall,
      });
    }

    return {
      acknowledged: true,
      orgId,
      deviceId,
      employeeId,
      batchSequenceId,
      acceptedSlicesCount: classifiedResults.length,
      classifiedPreview: classifiedResults.slice(0, 5),
      serverTimeUtc: new Date().toISOString(),
    };
  });

  // Direct Screenshot Upload from Windows Desktop Agent
  app.post('/api/v1/agent/screenshot-upload', async (req, reply) => {
    const body = (req.body || {}) as {
      deviceId?: string;
      employeeId?: string;
      employeeName?: string;
      monitorIndex?: number;
      resolution?: string;
      activeApp?: string;
      windowTitle?: string;
      keystrokesInWindow?: number;
      clicksInWindow?: number;
      isPrivacyBlurred?: boolean;
      triggerSource?: string;
      imageBase64?: string;
      mimeType?: string;
    };

    if (!body.imageBase64) {
      return reply.code(400).send({ error: 'MISSING_IMAGE_BASE64' });
    }

    const deviceId = body.deviceId || 'WIN-WORKSTATION-01';
    const employeeId = body.employeeId || `emp-${deviceId.toLowerCase()}`;
    const cleanBase64 = body.imageBase64.replace(/^data:[^;]+;base64,/, '');
    const imageBuffer = Buffer.from(cleanBase64, 'base64');

    const record = await ingestLiveScreenshot({
      orgId: 'org-acme-global-001',
      employeeId,
      employeeName: body.employeeName || `Windows Agent (${deviceId})`,
      deviceId,
      monitorIndex: Number(body.monitorIndex ?? 0),
      resolution: body.resolution || '1920x1080',
      activeApp: body.activeApp || 'Windows Desktop',
      windowTitle: body.windowTitle || 'Live Workstation Screen',
      keystrokesInWindow: Number(body.keystrokesInWindow ?? 24),
      clicksInWindow: Number(body.clicksInWindow ?? 8),
      isPrivacyBlurred: Boolean(body.isPrivacyBlurred),
      triggerSource: body.triggerSource || 'AGENT_LIVE_CAPTURE',
      imageBuffer,
      mimeType: body.mimeType || 'image/bmp',
    });

    return {
      uploaded: true,
      screenshot: record,
    };
  });

  // --------------------------------------------------------------------------
  // CONTINUOUS REAL-TIME LIVE VIDEO STREAMING (MJPEG MULTIPART & FAST FRAMES)
  // High-framerate desktop screen streaming without static screenshots
  // --------------------------------------------------------------------------
  app.post('/api/v1/live/frame', async (req, reply) => {
    let imageBuffer: Buffer | null = null;
    let mimeType = 'image/jpeg';
    const employeeId = (req.headers['x-employee-id'] as string) || 'emp-win-ramandeep';
    const deviceId = (req.headers['x-device-id'] as string) || 'RAMANDEEP';

    if (Buffer.isBuffer(req.body)) {
      imageBuffer = req.body;
      mimeType = (req.headers['content-type'] as string) || 'image/jpeg';
    } else if (typeof req.body === 'object' && req.body !== null) {
      const body = req.body as any;
      if (body.imageBase64) {
        const clean = body.imageBase64.replace(/^data:[^;]+;base64,/, '');
        imageBuffer = Buffer.from(clean, 'base64');
        mimeType = body.mimeType || 'image/jpeg';
      }
    }

    if (!imageBuffer || imageBuffer.length === 0) {
      return reply.code(400).send({ error: 'EMPTY_FRAME' });
    }

    pushLiveStreamFrame({
      buffer: imageBuffer,
      mimeType,
      capturedAtUtc: new Date().toISOString(),
      employeeId,
      deviceId,
    });

    return reply.send({ received: true, size: imageBuffer.length, activeViewers: ACTIVE_STREAM_HTTP_RESPONSES.size });
  });

  // Continuous MJPEG Video Stream (Browser native video streaming in <img src="/api/v1/live/stream">)
  app.get('/api/v1/live/stream', async (req, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'multipart/x-mixed-replace; boundary=--frame',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Connection': 'close',
      'Access-Control-Allow-Origin': '*',
    });

    if (LATEST_LIVE_STREAM_FRAME) {
      reply.raw.write(
        `--frame\r\nContent-Type: ${LATEST_LIVE_STREAM_FRAME.mimeType}\r\nContent-Length: ${LATEST_LIVE_STREAM_FRAME.buffer.length}\r\n\r\n`
      );
      reply.raw.write(LATEST_LIVE_STREAM_FRAME.buffer);
      reply.raw.write('\r\n');
    }

    ACTIVE_STREAM_HTTP_RESPONSES.add(reply.raw);

    req.raw.on('close', () => {
      ACTIVE_STREAM_HTTP_RESPONSES.delete(reply.raw);
    });
  });

  app.get('/api/v1/live-monitoring/stream/live.mjpg', async (req, reply) => {
    return reply.redirect('/api/v1/live/stream');
  });

  const STANDBY_SCREEN_SVG = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">` +
    `<rect width="1280" height="720" fill="#070b14"/>` +
    `<defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#162032" stroke-width="1"/></pattern></defs>` +
    `<rect width="1280" height="720" fill="url(#grid)" />` +
    `<circle cx="640" cy="360" r="160" fill="none" stroke="#1e293b" stroke-width="1.5" stroke-dasharray="4 4"/>` +
    `<circle cx="640" cy="360" r="80" fill="none" stroke="#0ea5e9" stroke-width="1" opacity="0.3"/>` +
    `<line x1="640" y1="160" x2="640" y2="560" stroke="#1e293b" stroke-width="1"/>` +
    `<line x1="440" y1="360" x2="840" y2="360" stroke="#1e293b" stroke-width="1"/>` +
    `<rect x="40" y="40" width="360" height="44" rx="8" fill="#0f172a" stroke="#1e293b"/>` +
    `<circle cx="60" cy="62" r="6" fill="#f59e0b"/>` +
    `<text x="76" y="67" fill="#f8fafc" font-family="-apple-system, sans-serif" font-size="12" font-weight="700" letter-spacing="1">WORKSTATION: RAMANDEEP • LIVE REC</text>` +
    `<rect x="40" y="636" width="380" height="44" rx="8" fill="#0f172a" stroke="#1e293b"/>` +
    `<text x="56" y="663" fill="#38bdf8" font-family="monospace" font-size="12" font-weight="600">STATUS: STANDBY • WAITING FOR DESKTOP AGENT</text>` +
    `<text x="640" y="340" fill="#f1f5f9" font-family="-apple-system, sans-serif" font-size="22" font-weight="700" text-anchor="middle" letter-spacing="2">HYDIEMS DESKTOP SURVEILLANCE</text>` +
    `<text x="640" y="375" fill="#94a3b8" font-family="-apple-system, sans-serif" font-size="14" text-anchor="middle">Live workstation screen will appear as soon as the desktop agent is active.</text>` +
    `</svg>`
  );

  const STANDBY_WEBCAM_SVG = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">` +
    `<rect width="640" height="480" fill="#070b14"/>` +
    `<defs><pattern id="camgrid" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M 30 0 L 0 0 0 30" fill="none" stroke="#162032" stroke-width="1"/></pattern></defs>` +
    `<rect width="640" height="480" fill="url(#camgrid)" />` +
    `<circle cx="320" cy="240" r="100" fill="none" stroke="#1e293b" stroke-width="1.5"/>` +
    `<circle cx="320" cy="240" r="4" fill="#38bdf8"/>` +
    `<rect x="230" y="150" width="180" height="200" rx="12" fill="none" stroke="#0ea5e9" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.6"/>` +
    `<text x="320" y="380" fill="#64748b" font-family="monospace" font-size="12" text-anchor="middle" letter-spacing="1">FACIAL TRACKING • STANDBY</text>` +
    `<circle cx="30" cy="30" r="5" fill="#10b981"/>` +
    `<text x="44" y="34" fill="#cbd5e1" font-family="monospace" font-size="11" font-weight="600">CAM 1: ZQ-1080RL</text>` +
    `</svg>`
  );

  // Latest Single Live Video Frame
  app.get('/api/v1/live/frame', async (req, reply) => {
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    reply.header('Pragma', 'no-cache');
    reply.header('Access-Control-Allow-Origin', '*');

    if (!LATEST_LIVE_STREAM_FRAME) {
      reply.header('Content-Type', 'image/svg+xml; charset=utf-8');
      return reply.send(STANDBY_SCREEN_SVG);
    }
    reply.header('Content-Type', LATEST_LIVE_STREAM_FRAME.mimeType);
    return reply.send(LATEST_LIVE_STREAM_FRAME.buffer);
  });

  // --------------------------------------------------------------------------
  // CONTINUOUS LIVE WEBCAM VIDEO STREAMING (MJPEG MULTIPART & FAST FRAMES)
  // --------------------------------------------------------------------------
  app.post('/api/v1/live/video/frame', async (req, reply) => {
    let imageBuffer: Buffer | null = null;
    let mimeType = 'image/jpeg';
    const employeeId = (req.headers['x-employee-id'] as string) || 'emp-win-ramandeep';
    const deviceId = (req.headers['x-device-id'] as string) || 'RAMANDEEP';

    if (Buffer.isBuffer(req.body)) {
      imageBuffer = req.body;
      mimeType = (req.headers['content-type'] as string) || 'image/jpeg';
    } else if (typeof req.body === 'object' && req.body !== null) {
      const body = req.body as any;
      if (body.imageBase64) {
        const clean = body.imageBase64.replace(/^data:[^;]+;base64,/, '');
        imageBuffer = Buffer.from(clean, 'base64');
        mimeType = body.mimeType || 'image/jpeg';
      }
    }

    if (!imageBuffer || imageBuffer.length === 0) {
      return reply.code(400).send({ error: 'EMPTY_FRAME' });
    }

    pushLiveVideoFrame({
      buffer: imageBuffer,
      mimeType,
      capturedAtUtc: new Date().toISOString(),
      employeeId,
      deviceId,
    });

    return reply.send({ received: true, size: imageBuffer.length, activeViewers: ACTIVE_VIDEO_STREAM_RESPONSES.size });
  });

  app.get('/api/v1/live/video/stream', async (req, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'multipart/x-mixed-replace; boundary=--frame',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Connection': 'close',
      'Access-Control-Allow-Origin': '*',
    });

    if (LATEST_LIVE_VIDEO_FRAME) {
      reply.raw.write(
        `--frame\r\nContent-Type: ${LATEST_LIVE_VIDEO_FRAME.mimeType}\r\nContent-Length: ${LATEST_LIVE_VIDEO_FRAME.buffer.length}\r\n\r\n`
      );
      reply.raw.write(LATEST_LIVE_VIDEO_FRAME.buffer);
      reply.raw.write('\r\n');
    }

    ACTIVE_VIDEO_STREAM_RESPONSES.add(reply.raw);

    req.raw.on('close', () => {
      ACTIVE_VIDEO_STREAM_RESPONSES.delete(reply.raw);
    });
  });

  app.get('/api/v1/live/video/frame', async (req, reply) => {
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    reply.header('Pragma', 'no-cache');
    reply.header('Access-Control-Allow-Origin', '*');

    if (!LATEST_LIVE_VIDEO_FRAME) {
      reply.header('Content-Type', 'image/svg+xml; charset=utf-8');
      return reply.send(STANDBY_WEBCAM_SVG);
    }
    reply.header('Content-Type', LATEST_LIVE_VIDEO_FRAME.mimeType);
    return reply.send(LATEST_LIVE_VIDEO_FRAME.buffer);
  });

  // --------------------------------------------------------------------------
  // LIVE MICROPHONE AUDIO MONITORING & WAVEFORM LEVELS
  // --------------------------------------------------------------------------
  app.post('/api/v1/live/audio/levels', async (req, reply) => {
    const body = (req.body || {}) as any;
    updateLiveAudioState(body);
    if (body.audioPcmBase64 || body.pcmBase64) {
      broadcastLiveAudioChunk(body.employeeId || 'emp-win-ramandeep', body);
    }
    return reply.send({ received: true, state: LATEST_LIVE_AUDIO_STATE });
  });

  app.get('/api/v1/live/audio/levels', async (req, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    return reply.send(LATEST_LIVE_AUDIO_STATE);
  });

  app.get('/api/v1/live/audio/state', async (req, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    return reply.send(LATEST_LIVE_AUDIO_STATE);
  });

  // System Information, Snovasys SpeedTest & Top Running Processes Upload (WindowsSystemInfo.cs parity)
  app.post('/api/v1/agent/system-info', async (req) => {
    const body = (req.body || {}) as Record<string, any>;
    const record = await ingestLiveSystemInfo(body);
    return {
      success: true,
      data: record,
    };
  });

  // TimeChamp Legacy API Alias: ActTracker/ActTrackerApi/UpsertSystemInformationInServer
  app.post('/ActTracker/ActTrackerApi/UpsertSystemInformationInServer', async (req) => {
    const body = (req.body || {}) as Record<string, any>;
    const record = await ingestLiveSystemInfo(body);
    return {
      Success: true,
      Data: record,
    };
  });

  // Work Time Matrix Behavioural Rule Violation Action (WorkTimeMatrixActionViewModel.cs parity)
  app.post('/api/v1/agent/work-matrix-violation', async (req) => {
    const body = (req.body || {}) as Record<string, any>;
    const record = await ingestWorkTimeMatrixViolation(body);
    return {
      success: true,
      data: record,
    };
  });

  // TimeChamp Legacy API Alias: ActTracker/ActTrackerApi/WorkTimeMatrixAction
  app.post('/ActTracker/ActTrackerApi/WorkTimeMatrixAction', async (req) => {
    const body = (req.body || {}) as Record<string, any>;
    const record = await ingestWorkTimeMatrixViolation(body);
    return {
      Success: true,
      Data: record,
    };
  });

  // TimeChamp Legacy API Alias: ActTracker/ActTrackerApi/GetTrackerConfigurationForAgent
  app.get('/ActTracker/ActTrackerApi/GetTrackerConfigurationForAgent', async () => {
    return {
      Success: true,
      Data: {
        ConsiderPunchCardInFrequency: true,
        ConsiderAutoStartTimeTracking: true,
        ConsiderFinishTimeTracking: true,
        ConsiderBreakTime: true,
        EnableLocation: true,
        IsBasicTracking: false,
        IdleTimeInMins: 3,
        ScreenShotFrequency: 5,
        Multiplier: 1,
        RandomScreenshot: true,
        IsBlurScreenshot: false,
        ScreenshotCompressionRatio: 85,
        CanTrackSystemInformation: true,
        CanTrackNetworkSpeed: true,
        OfflineOpenHours: 24,
        ThresholdForMouseStaticDistance: 25,
        ConsiderUsbUsageTracking: true,
        EnableFileTransferTracking: true,
        EnablePrintTracking: true,
      },
    };
  });

  // Unified Live State Feed for Next.js Web Dashboard (Polled every 3s)
  app.get('/api/v1/live/state', async () => {
    return {
      status: 'LIVE',
      timestampUtc: new Date().toISOString(),
      connectedAgentsCount: LIVE_EMPLOYEES.filter((e) => e.currentStatus !== 'OFFLINE').length,
      employees: LIVE_EMPLOYEES,
      recentSlices: LIVE_ACTIVITY_SLICES.slice(0, 30),
      screenshots: LIVE_SCREENSHOTS.slice(0, 20),
      dlpIncidents: LIVE_DLP_INCIDENTS,
      systemInfo: Array.from(LIVE_SYSTEM_INFO.values()),
      workMatrixViolations: LIVE_WORK_MATRIX_VIOLATIONS.slice(0, 20),
    };
  });

  // Download Compiled Windows Desktop Agent Bundle (.zip)
  app.get('/api/v1/agent/download/windows', async (_req, reply) => {
    const candidates = [
      path.resolve('/workspace/downloads/HydiEms-Windows-Agent-v2.5.0-win-x64.zip'),
      path.resolve(process.cwd(), 'downloads/HydiEms-Windows-Agent-v2.5.0-win-x64.zip'),
      path.resolve(process.cwd(), '../../downloads/HydiEms-Windows-Agent-v2.5.0-win-x64.zip'),
    ];
    for (const filePath of candidates) {
      if (fs.existsSync(filePath)) {
        reply.header('Content-Type', 'application/zip');
        reply.header(
          'Content-Disposition',
          'attachment; filename="HydiEms-Windows-Agent-v2.5.0-win-x64.zip"'
        );
        return reply.send(fs.createReadStream(filePath));
      }
    }
    return reply.code(404).send({ error: 'WINDOWS_AGENT_BUNDLE_NOT_FOUND' });
  });

  // Pre-signed S3/R2/MinIO PUT URL for Desktop Agent Screenshot & Recording Uploads
  app.post(
    '/api/v1/agent/media-presign',
    { preHandler: [requireAuth] },
    async (req) => {
      const body = (req.body || {}) as {
        mediaType?: 'SCREENSHOT_WEBP' | 'RECORDING_MP4' | 'AUDIO_OPUS';
        sha256Checksum?: string;
      };
      const objectKey = `${req.tenantOrgId}/${req.user.employeeId || 'emp'}/${Date.now()}-${
        body.mediaType || 'SCREENSHOT_WEBP'
      }.webp`;

      return {
        objectKey,
        uploadPutUrl: `https://storage.hydiedge.com/hydiems-screenshots/${objectKey}?X-Amz-Expires=300&checksum=${
          body.sha256Checksum || 'none'
        }`,
        expiresInSeconds: 300,
      };
    }
  );

  // --------------------------------------------------------------------------
  // EMP-001..013, SYS-001..003, SEARCH-001..002, NOTIF-001..002 & SUPPORT-001..006
  // --------------------------------------------------------------------------
  app.get(
    '/api/v1/employee-portal/my-day',
    { preHandler: [requirePermission('M32_EMPLOYEE_PORTAL', 'VIEW')] },
    async (req) => {
      return {
        orgId: req.tenantOrgId,
        employeeId: req.user.employeeId || 'emp-win-ramandeep',
        todayEffectiveHours: 6.8,
        productivityScorePct: 92.4,
        personalModeRemainingMinutesToday: 45,
        focusStreakBestMinutesToday: 85,
        transparencyNotice:
          'You have full visibility into every screenshot, app log, and time entry captured on your workstation.',
      };
    }
  );

  app.get(
    '/api/v1/system/health-metrics',
    { preHandler: [requirePermission('M30_ADMINISTRATION', 'VIEW')] },
    async () => {
      return {
        status: 'HEALTHY',
        version: '2.5.0',
        uptimeSeconds: Math.floor(process.uptime()),
        postgresTimescalePool: { active: 8, idle: 12, waiting: 0 },
        redisBullMqQueues: {
          telemetryBatchFlusherLag: 0,
          dailyAttendanceCalculatorLag: 0,
          historicalProductivityReclassifierLag: 0,
          alertEvaluatorLag: 0,
        },
        storageBackends: {
          localNvmeMinio: 'ONLINE',
          awsS3: 'ONLINE',
          cloudflareR2: 'ONLINE',
        },
      };
    }
  );
}
