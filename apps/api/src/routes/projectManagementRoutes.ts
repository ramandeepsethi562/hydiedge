// ============================================================================
// @hydiems/api — MODULE 14: Project Management & 11-Panel Project Studio
// Covers:
//  - Project List: Create, Edit, Archive, Unarchive, Client, Manager,
//    Employees, Budget, Deadline, Status
//  - Project Detail (11 Panels):
//    1. Overview, 2. Members, 3. Tasks, 4. Time, 5. Timesheets,
//    6. Productivity, 7. Budget, 8. Reports, 9. Activity, 10. Files, 11. Audit
// ============================================================================
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import {
  requirePermission,
  appendImmutableAuditLog,
  IMMUTABLE_AUDIT_LOG_STORE,
} from '../middleware/authAndTenant';

export interface ProjectMemberRecord {
  employeeId: string;
  fullName: string;
  role: string;
  allocationPct: number;
  billableHourlyRate: number;
  costPerHour: number;
  activeHoursThisWeek: number;
}

export interface ProjectRecord {
  projectId: string;
  code: string;
  name: string;
  description: string;
  client: {
    clientId: string;
    clientName: string;
    contactPerson: string;
    email: string;
  };
  manager: {
    employeeId: string;
    fullName: string;
    email: string;
    department: string;
  };
  members: ProjectMemberRecord[];
  budget: {
    totalBudgetUsd: number;
    spentBudgetUsd: number;
    remainingBudgetUsd: number;
    currency: string;
    burnRatePct: number;
    budgetHours: number;
    loggedHours: number;
    costVarianceUsd: number;
    projectedCompletionCostUsd: number;
  };
  dates: {
    startDate: string;
    targetDeadline: string;
    daysRemaining: number;
    isOverdue: boolean;
  };
  status: 'PLANNING' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED';
  progressPct: number;
  healthScore: number; // 0 - 100
  cpiIndex: number;    // Cost Performance Index
  spiIndex: number;    // Schedule Performance Index
  activeSprint: string;
  createdAt: string;
  updatedAt: string;
}

// In-Memory Project Store
const PROJECT_STORE = new Map<string, ProjectRecord>();

function initializeProjectData(): void {
  const initialProjects: ProjectRecord[] = [
    {
      projectId: 'proj-hydi-v25',
      code: 'HYDI-25',
      name: 'HydiEms v2.5 Enterprise Platform Rollout',
      description: 'Distributed workforce surveillance, real-time WebRTC 30-FPS streaming, and 11-layer DLP intelligence platform rollout.',
      client: {
        clientId: 'cli-internal',
        clientName: 'Acme Global Platform Engineering',
        contactPerson: 'Sarah Jenkins',
        email: 's.jenkins@acmeglobal.com',
      },
      manager: {
        employeeId: 'emp-win-ramandeep',
        fullName: 'Ramandeep',
        email: 'ramandeep@hydiedge.com',
        department: 'Platform Engineering',
      },
      members: [
        {
          employeeId: 'emp-win-ramandeep',
          fullName: 'Ramandeep',
          role: 'Lead Distributed Systems Architect',
          allocationPct: 100,
          billableHourlyRate: 150,
          costPerHour: 95,
          activeHoursThisWeek: 38.5,
        },
        {
          employeeId: 'emp-win-ramandeep',
          fullName: 'Ramandeep',
          role: 'Quality Assurance & BPO Lead',
          allocationPct: 80,
          billableHourlyRate: 85,
          costPerHour: 55,
          activeHoursThisWeek: 32.0,
        },
        {
          employeeId: 'emp-win-ramandeep',
          fullName: 'Ramandeep',
          role: 'Cloud Security & DLP Architect',
          allocationPct: 90,
          billableHourlyRate: 120,
          costPerHour: 75,
          activeHoursThisWeek: 34.5,
        },
        {
          employeeId: 'emp-win-ramandeep',
          fullName: 'Ramandeep',
          role: 'Finance & Invoicing Analyst',
          allocationPct: 50,
          billableHourlyRate: 95,
          costPerHour: 60,
          activeHoursThisWeek: 18.0,
        },
      ],
      budget: {
        totalBudgetUsd: 125000,
        spentBudgetUsd: 96875,
        remainingBudgetUsd: 28125,
        currency: 'USD',
        burnRatePct: 77.5,
        budgetHours: 3200,
        loggedHours: 2480,
        costVarianceUsd: -4200, // Under budget
        projectedCompletionCostUsd: 121500,
      },
      dates: {
        startDate: '2026-06-01',
        targetDeadline: '2026-11-30',
        daysRemaining: 63,
        isOverdue: false,
      },
      status: 'IN_PROGRESS',
      progressPct: 78,
      healthScore: 96,
      cpiIndex: 1.04,
      spiIndex: 1.02,
      activeSprint: 'Sprint 42 — WebRTC & 11-Layer DLP',
      createdAt: '2026-06-01T09:00:00Z',
      updatedAt: new Date().toISOString(),
    },
    {
      projectId: 'proj-finserve-soc',
      code: 'FIN-SOC',
      name: 'FinServe UK 24x7 Managed Contact Center & SOC',
      description: 'Zero-trust enterprise monitoring and PCI-DSS compliance surveillance for multinational investment banking operations.',
      client: {
        clientId: 'cli-finserve',
        clientName: 'FinServe Sovereign Holdings UK',
        contactPerson: 'Alistair Sterling',
        email: 'a.sterling@finserve.co.uk',
      },
      manager: {
        employeeId: 'emp-win-ramandeep',
        fullName: 'Ramandeep',
        email: 'ramandeep@hydiedge.com',
        department: 'Security & IT',
      },
      members: [
        {
          employeeId: 'emp-win-ramandeep',
          fullName: 'Ramandeep',
          role: 'Principal Security Officer',
          allocationPct: 100,
          billableHourlyRate: 160,
          costPerHour: 85,
          activeHoursThisWeek: 40.0,
        },
        {
          employeeId: 'emp-win-ramandeep',
          fullName: 'Ramandeep',
          role: 'Contact Center Operations Lead',
          allocationPct: 100,
          billableHourlyRate: 90,
          costPerHour: 55,
          activeHoursThisWeek: 42.0,
        },
      ],
      budget: {
        totalBudgetUsd: 380000,
        spentBudgetUsd: 273600,
        remainingBudgetUsd: 106400,
        currency: 'USD',
        burnRatePct: 72.0,
        budgetHours: 8500,
        loggedHours: 6120,
        costVarianceUsd: -8500,
        projectedCompletionCostUsd: 368000,
      },
      dates: {
        startDate: '2026-01-15',
        targetDeadline: '2026-12-31',
        daysRemaining: 94,
        isOverdue: false,
      },
      status: 'IN_PROGRESS',
      progressPct: 72,
      healthScore: 94,
      cpiIndex: 1.08,
      spiIndex: 1.0,
      activeSprint: 'Q3 Continuous Operations',
      createdAt: '2026-01-15T08:00:00Z',
      updatedAt: new Date().toISOString(),
    },
  ];

  for (const p of initialProjects) {
    PROJECT_STORE.set(p.projectId, p);
  }
}

initializeProjectData();

export async function registerProjectManagementRoutes(app: FastifyInstance): Promise<void> {
  // Note: /api/v1/projects (GET & POST) are canonically registered in
  // projectsTasksTimesheetsAndBillingRoutes.ts with real MySQL 8.0 database persistence.
  // The endpoints below handle single project details, edits, and archiving.
  // --------------------------------------------------------------------------
  // 3. PROJECT LIST: EDIT PROJECT
  // --------------------------------------------------------------------------
  app.put(
    '/api/v1/projects/:projectId',
    {
      preHandler: [
        requirePermission('M12_PROJECTS', 'EDIT'),
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = req.params as { projectId: string };
      const body = (req.body || {}) as Partial<ProjectRecord>;
      const project = PROJECT_STORE.get(projectId);

      if (!project) {
        return reply.code(404).send({
          error: 'NOT_FOUND',
          message: `Project ${projectId} not found.`,
        });
      }

      if (body.name) project.name = body.name;
      if (body.description) project.description = body.description;
      if (body.status) project.status = body.status;
      if (body.progressPct !== undefined) project.progressPct = body.progressPct;
      if (body.client) project.client = { ...project.client, ...body.client };
      if (body.manager) project.manager = { ...project.manager, ...body.manager };
      if (body.budget) project.budget = { ...project.budget, ...body.budget };
      if (body.dates) project.dates = { ...project.dates, ...body.dates };
      if (body.members) project.members = body.members;

      project.updatedAt = new Date().toISOString();

      appendImmutableAuditLog({
        orgId: req.tenantOrgId,
        actorUserId: req.user.userId,
        actorRole: req.user.role,
        actionCategory: 'PROJECT_MANAGEMENT',
        actionType: 'EDIT_PROJECT',
        targetEntityType: 'PROJECT',
        targetEntityId: projectId,
        reasonProvided: 'Project metadata updated by project administrator',
        ipAddress: req.ip,
      });

      return {
        orgId: req.tenantOrgId,
        project,
        message: 'Project updated successfully.',
      };
    }
  );

  // --------------------------------------------------------------------------
  // 4. PROJECT LIST: ARCHIVE PROJECT
  // --------------------------------------------------------------------------
  app.post(
    '/api/v1/projects/:projectId/archive',
    {
      preHandler: [
        requirePermission('M12_PROJECTS', 'DELETE'),
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = req.params as { projectId: string };
      const body = (req.body || {}) as { reason?: string };
      const project = PROJECT_STORE.get(projectId);

      if (!project) {
        return reply.code(404).send({
          error: 'NOT_FOUND',
          message: `Project ${projectId} not found.`,
        });
      }

      project.status = 'ARCHIVED';
      project.updatedAt = new Date().toISOString();

      appendImmutableAuditLog({
        orgId: req.tenantOrgId,
        actorUserId: req.user.userId,
        actorRole: req.user.role,
        actionCategory: 'PROJECT_MANAGEMENT',
        actionType: 'ARCHIVE_PROJECT',
        targetEntityType: 'PROJECT',
        targetEntityId: projectId,
        reasonProvided: body.reason || 'Project completed and moved to legal retention archive',
        ipAddress: req.ip,
      });

      return {
        orgId: req.tenantOrgId,
        projectId,
        status: 'ARCHIVED',
        message: 'Project moved to archive vault.',
      };
    }
  );

  // --------------------------------------------------------------------------
  // 5. PROJECT LIST: UNARCHIVE PROJECT
  // --------------------------------------------------------------------------
  app.post(
    '/api/v1/projects/:projectId/unarchive',
    {
      preHandler: [
        requirePermission('M12_PROJECTS', 'EDIT'),
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = req.params as { projectId: string };
      const project = PROJECT_STORE.get(projectId);

      if (!project) {
        return reply.code(404).send({
          error: 'NOT_FOUND',
          message: `Project ${projectId} not found.`,
        });
      }

      project.status = 'IN_PROGRESS';
      project.updatedAt = new Date().toISOString();

      appendImmutableAuditLog({
        orgId: req.tenantOrgId,
        actorUserId: req.user.userId,
        actorRole: req.user.role,
        actionCategory: 'PROJECT_MANAGEMENT',
        actionType: 'UNARCHIVE_PROJECT',
        targetEntityType: 'PROJECT',
        targetEntityId: projectId,
        reasonProvided: 'Project reactivated from archive vault',
        ipAddress: req.ip,
      });

      return {
        orgId: req.tenantOrgId,
        projectId,
        status: 'IN_PROGRESS',
        message: 'Project reactivated successfully.',
      };
    }
  );

  // --------------------------------------------------------------------------
  // 6. PROJECT DETAIL: COMPLETE 11-PANEL SUITE
  // Panels: Overview, Members, Tasks, Time, Timesheets, Productivity,
  //         Budget, Reports, Activity, Files, Audit
  // --------------------------------------------------------------------------
  app.get(
    '/api/v1/projects/:projectId',
    {
      preHandler: [
        requirePermission('M12_PROJECTS', 'VIEW'),
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = req.params as { projectId: string };
      const project = PROJECT_STORE.get(projectId);

      if (!project) {
        return reply.code(404).send({
          error: 'NOT_FOUND',
          message: `Project ${projectId} not found.`,
        });
      }

      // Panel 1: Overview
      const overview = {
        projectId: project.projectId,
        code: project.code,
        name: project.name,
        description: project.description,
        client: project.client,
        manager: project.manager,
        dates: project.dates,
        status: project.status,
        progressPct: project.progressPct,
        healthScore: project.healthScore,
        cpiIndex: project.cpiIndex,
        spiIndex: project.spiIndex,
        activeSprint: project.activeSprint,
      };

      // Panel 2: Members
      const members = project.members.map((m) => ({
        ...m,
        weeklyCostUsd: m.activeHoursThisWeek * m.costPerHour,
        weeklyRevenueUsd: m.activeHoursThisWeek * m.billableHourlyRate,
      }));

      // Panel 3: Tasks
      const tasks = [
        {
          taskId: 'tsk-801',
          key: `${project.code}-101`,
          title: 'Implement Active Audio Call Anti-Idle Rule in Rust Desktop Agent',
          status: 'IN_PROGRESS',
          priority: 'CRITICAL',
          assignee: 'Ramandeep',
          storyPoints: 8,
          estimatedHours: 16,
          loggedHours: 12.5,
          dueDate: '2026-10-02',
        },
        {
          taskId: 'tsk-802',
          key: `${project.code}-102`,
          title: 'Fix cross-midnight shift split attribution for night shifts',
          status: 'DONE',
          priority: 'HIGH',
          assignee: 'Ramandeep',
          storyPoints: 5,
          estimatedHours: 8,
          loggedHours: 7.2,
          dueDate: '2026-09-27',
        },
        {
          taskId: 'tsk-803',
          key: `${project.code}-103`,
          title: 'Multi-Monitor 144Hz DXGI Screen Duplication Hardware Acceleration',
          status: 'REVIEW',
          priority: 'HIGH',
          assignee: 'Ramandeep',
          storyPoints: 5,
          estimatedHours: 12,
          loggedHours: 11.0,
          dueDate: '2026-09-30',
        },
        {
          taskId: 'tsk-804',
          key: `${project.code}-104`,
          title: 'Automated Retention Policy Pruner and S3 Storage Tiering Worker',
          status: 'TODO',
          priority: 'MEDIUM',
          assignee: 'Ramandeep',
          storyPoints: 3,
          estimatedHours: 6,
          loggedHours: 0,
          dueDate: '2026-10-08',
        },
      ];

      // Panel 4: Time
      const time = {
        totalLoggedHours: project.budget.loggedHours,
        billableHours: Math.round(project.budget.loggedHours * 0.88),
        nonBillableHours: Math.round(project.budget.loggedHours * 0.12),
        todayLoggedHours: 24.5,
        thisWeekLoggedHours: 142.0,
        byMember: project.members.map((m) => ({
          employeeId: m.employeeId,
          name: m.fullName,
          hours: Math.round(project.budget.loggedHours * (m.allocationPct / 320)),
          billablePct: 92,
        })),
      };

      // Panel 5: Timesheets
      const timesheets = [
        {
          timesheetId: `ts-${project.code}-w38`,
          period: '2026-09-14 to 2026-09-20',
          submittedHours: 160.0,
          approvedHours: 160.0,
          status: 'LOCKED',
          approver: project.manager.fullName,
          lockedAt: '2026-09-21T10:00:00Z',
        },
        {
          timesheetId: `ts-${project.code}-w39`,
          period: '2026-09-21 to 2026-09-27',
          submittedHours: 154.5,
          approvedHours: 154.5,
          status: 'APPROVED',
          approver: project.manager.fullName,
          lockedAt: null,
        },
        {
          timesheetId: `ts-${project.code}-w40`,
          period: '2026-09-28 to 2026-10-04',
          submittedHours: 32.0,
          approvedHours: 0,
          status: 'UNDER_REVIEW',
          approver: null,
          lockedAt: null,
        },
      ];

      // Panel 6: Productivity
      const productivity = {
        projectProductivityPct: 92.4,
        activeHours: 2291.6,
        neutralHours: 132.4,
        unproductiveHours: 56.0,
        topApplications: [
          { app: 'Visual Studio Code', durationHours: 1140, pct: 46.0, category: 'PRODUCTIVE' },
          { app: 'Google Chrome (GitHub / Docs)', durationHours: 680, pct: 27.4, category: 'PRODUCTIVE' },
          { app: 'Microsoft Teams (Dev Sync)', durationHours: 320, pct: 12.9, category: 'PRODUCTIVE' },
          { app: 'Zendesk Enterprise', durationHours: 280, pct: 11.3, category: 'PRODUCTIVE' },
        ],
      };

      // Panel 7: Budget
      const budget = {
        ...project.budget,
        projectedVarianceUsd: project.budget.totalBudgetUsd - project.budget.projectedCompletionCostUsd,
        averageHourlyBillingRateUsd: Number((project.budget.spentBudgetUsd / project.budget.loggedHours).toFixed(2)),
      };

      // Panel 8: Reports
      const reports = {
        sprintBurndown: {
          sprintName: project.activeSprint,
          totalStoryPoints: 21,
          completedPoints: 13,
          remainingPoints: 8,
          velocityTrend: 'STABLE (14 pts/week)',
        },
        slaAdherencePct: 98.4,
        milestones: [
          { name: 'Core Engine Specification', status: 'COMPLETED', date: '2026-06-30' },
          { name: 'Alpha Agent Desktop Hooks', status: 'COMPLETED', date: '2026-07-31' },
          { name: 'Beta Multi-Monitor WebRTC Streaming', status: 'COMPLETED', date: '2026-08-31' },
          { name: '11-Layer DLP Security Verification', status: 'IN_PROGRESS', date: '2026-10-15' },
          { name: 'GA Enterprise Production Deployment', status: 'PLANNED', date: '2026-11-30' },
        ],
      };

      // Panel 9: Activity
      const activity = [
        {
          timestamp: '10 mins ago',
          type: 'COMMIT_PUSHED',
          actor: 'Ramandeep',
          description: 'Pushed commit 8a91bc2 to core/webrtc: Hardware-accelerated DXGI frame capture.',
        },
        {
          timestamp: '45 mins ago',
          type: 'TASK_STATUS_CHANGED',
          actor: 'Ramandeep',
          description: 'Moved task HYDI-102 to DONE after automated test suite passed.',
        },
        {
          timestamp: '2 hours ago',
          type: 'TIMER_STARTED',
          actor: 'Ramandeep',
          description: 'Started project timer on HYDI-103: Multi-Monitor 144Hz screen duplication.',
        },
        {
          timestamp: 'Yesterday',
          type: 'BUDGET_RECONCILED',
          actor: 'Ramandeep',
          description: 'Completed weekly budget burn reconciliation: CPI at 1.04 favorable.',
        },
      ];

      // Panel 10: Files
      const files = [
        {
          fileId: 'fil-arch-v25',
          fileName: 'HydiEms_Master_Engineering_Architecture_v2.5.pdf',
          fileSizeBytes: 4890000,
          uploadedBy: 'Ramandeep',
          uploadedAt: '2026-06-05T12:00:00Z',
          s3Key: `s3://hydi-project-vault/${project.projectId}/docs/HydiEms_Architecture_v2.5.pdf`,
          version: '2.5.0',
        },
        {
          fileId: 'fil-sla-contract',
          fileName: 'Enterprise_SLA_Master_Agreement_Signed.pdf',
          fileSizeBytes: 1240000,
          uploadedBy: 'Ramandeep',
          uploadedAt: '2026-06-10T14:30:00Z',
          s3Key: `s3://hydi-project-vault/${project.projectId}/contracts/Enterprise_SLA_Signed.pdf`,
          version: '1.0',
        },
        {
          fileId: 'fil-dlp-spec',
          fileName: '11_Layer_DLP_Security_Policy_Specification.docx',
          fileSizeBytes: 890000,
          uploadedBy: 'Ramandeep',
          uploadedAt: '2026-07-15T09:15:00Z',
          s3Key: `s3://hydi-project-vault/${project.projectId}/specs/DLP_Policy_Spec.docx`,
          version: '1.4',
        },
      ];

      // Panel 11: Audit
      const projectAuditLogs = IMMUTABLE_AUDIT_LOG_STORE.filter(
        (log) => log.targetEntityId === project.projectId || log.actionCategory === 'PROJECT_MANAGEMENT'
      ).slice(0, 20);

      return {
        orgId: req.tenantOrgId,
        projectId: project.projectId,
        panels: {
          overview,
          members,
          tasks,
          time,
          timesheets,
          productivity,
          budget,
          reports,
          activity,
          files,
          audit: projectAuditLogs,
        },
      };
    }
  );
}
