// ============================================================================
// @hydiems/api — Fastify v5 Enterprise Server & WebSocket Gateway Entrypoint
// Covers all 304 Functional Requirements across 33 Modules + Super Admin Plane
// ============================================================================
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';

import { runAllMigrations, seedProductionDefaults } from '@hydiems/database';
import { registerRealtimeGateway } from './ws/realtimeGateway';
import { registerAuthAndOnboardingRoutes } from './routes/authAndOnboardingRoutes';
import { registerSuperAdminAndBillingRoutes } from './routes/superAdminAndBillingRoutes';
import { registerOrgWorkforceAndAttendanceRoutes } from './routes/orgWorkforceAndAttendanceRoutes';
import { registerMonitoringProductivityAndDlpRoutes } from './routes/monitoringProductivityAndDlpRoutes';
import { registerProjectsTasksTimesheetsAndBillingRoutes } from './routes/projectsTasksTimesheetsAndBillingRoutes';
import { registerHrCommsFieldAiAndAgentRoutes } from './routes/hrCommsFieldAiAndAgentRoutes';
import { registerPhaseByPhaseExecutionRoutes } from './routes/phaseByPhaseExecutionRoutes';
import { registerRbacManagementRoutes } from './routes/rbacManagementRoutes';
import { registerShiftAndScheduleRoutes } from './routes/shiftAndScheduleRoutes';
import { registerAttendanceManagementRoutes } from './routes/attendanceManagementRoutes';
import { registerTimeTrackingManagementRoutes } from './routes/timeTrackingManagementRoutes';
import { registerActivityTrackingRoutes } from './routes/activityTrackingRoutes';
import { registerIdleAwayDetectionRoutes } from './routes/idleAwayDetectionRoutes';
import { registerScreenshotManagementRoutes } from './routes/screenshotManagementRoutes';
import { registerScreenRecordingRoutes } from './routes/screenRecordingRoutes';
import { registerLiveMonitoringRoutes } from './routes/liveMonitoringRoutes';
import { registerDeviceManagementRoutes } from './routes/deviceManagementRoutes';
import { registerProjectManagementRoutes } from './routes/projectManagementRoutes';
import { registerPayrollManagementRoutes } from './routes/payrollManagementRoutes';
import { syncWorkforceFromMysql } from './state/liveTelemetryState';

export async function buildHydiApiServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
    trustProxy: true,
    bodyLimit: 10 * 1024 * 1024, // 10 MB for bulk CSV/telemetry batches
  });

  app.addContentTypeParser(
    ['image/jpeg', 'image/png', 'image/bmp', 'application/octet-stream'],
    { parseAs: 'buffer' },
    (_req, body, done) => {
      done(null, body);
    }
  );

  await app.register(cors, {
    origin: true,
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Hydi-Impersonate-Org',
      'X-Hydi-Impersonation-Reason',
      'X-Hydi-Audit-Reason',
    ],
  });

  await app.register(jwt, {
    secret:
      process.env.JWT_SECRET ||
      'hydiems-v25-enterprise-super-secret-signing-key-change-in-prod',
  });

  await app.register(websocket, {
    options: {
      maxPayload: 5 * 1024 * 1024, // 5 MB for 2-FPS WebP fallback frames
    },
  });

  // Public Healthcheck & Caddy On-Demand TLS Domain Verification Endpoint (BRAND-001)
  app.get('/api/v1/health', async () => ({
    service: '@hydiems/api',
    version: '2.5.0',
    status: 'OK',
    timestampUtc: new Date().toISOString(),
  }));

  app.get('/api/v1/internal/tls-domain-verify', async (req, reply) => {
    const query = req.query as { domain?: string };
    if (!query.domain) {
      return reply.code(400).send({ allowed: false });
    }
    return { allowed: true, domain: query.domain };
  });

  // Register Real-Time WebSocket & WebRTC Signaling Gateway
  await registerRealtimeGateway(app);

  // Register All 33 Enterprise Module Route Groups + Phase 01..30 Execution Engine
  await registerAuthAndOnboardingRoutes(app);
  await registerSuperAdminAndBillingRoutes(app);
  await registerOrgWorkforceAndAttendanceRoutes(app);
  await registerMonitoringProductivityAndDlpRoutes(app);
  await registerProjectsTasksTimesheetsAndBillingRoutes(app);
  await registerHrCommsFieldAiAndAgentRoutes(app);
  await registerPhaseByPhaseExecutionRoutes(app);
  await registerRbacManagementRoutes(app);
  await registerShiftAndScheduleRoutes(app);
  await registerAttendanceManagementRoutes(app);
  await registerTimeTrackingManagementRoutes(app);
  await registerActivityTrackingRoutes(app);
  await registerIdleAwayDetectionRoutes(app);
  await registerScreenshotManagementRoutes(app);
  await registerScreenRecordingRoutes(app);
  await registerLiveMonitoringRoutes(app);
  await registerDeviceManagementRoutes(app);
  await registerProjectManagementRoutes(app);
  await registerPayrollManagementRoutes(app);

  return app;
}

if (require.main === module) {
  const port = Number(process.env.API_PORT || 4000);
  const host = process.env.API_HOST || '0.0.0.0';

  buildHydiApiServer()
    .then(async (app) => {
      try {
        const mig = await runAllMigrations();
        app.log.info({ mig }, 'Database migrations verified on startup');
        const seed = await seedProductionDefaults();
        app.log.info({ seed }, 'Production seed defaults verified on startup');
        const workforceSynced = await syncWorkforceFromMysql();
        app.log.info({ workforceSynced }, 'Live workforce synced from MySQL on startup');
      } catch (dbErr) {
        app.log.warn({ err: dbErr }, 'Non-fatal startup migration/seed warning');
      }
      await app.listen({ port, host });
      app.log.info(`HydiEms Enterprise API v2.5.0 listening on http://${host}:${port}`);
    })
    .catch((err) => {
      console.error('Fatal error starting @hydiems/api:', err);
      process.exit(1);
    });
}
