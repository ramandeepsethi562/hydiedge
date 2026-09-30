// ============================================================================
// @hydiems/database — Production Default & Enterprise Demo Seeder
// Seeds Super Admin, Acme Global Corp, Subsidiaries, Departments, Teams,
// Shifts, 9 System Roles, Away Reasons, Productivity Rules, Sample Workforce,
// Projects, Tasks, Software License Contracts & 11-Layer DLP Policies
// ============================================================================
import {
  ALL_MODULES,
  DEFAULT_ROLE_PERMISSION_MATRIX,
  SystemRole,
  AddOnCode,
} from '@hydiems/shared';
import { executeMysqlQuery, inMemoryRelationalStore } from './mysql';
import { appendImmutableAuditLog, insertActivitySlicesBatch } from './clickhouse';
import { recordAgentHeartbeatPresence } from './redis';
import { setTenantStorageConfig } from './s3';

export const DEMO_ORG_ID = 'org-acme-global-001';
export const SUPER_ADMIN_USER_ID = 'usr-super-admin-001';

export interface SeedResult {
  orgId: string;
  orgName: string;
  seededTablesCount: number;
  seededUsersCount: number;
  seededEmployeesCount: number;
  seededRolesCount: number;
  seededProjectsCount: number;
  seededDlpPoliciesCount: number;
}

const ALL_ADDONS: AddOnCode[] = [
  'ADDON_SCREENSHOTS_10X',
  'ADDON_LIVE_STREAMING_WEBRTC',
  'ADDON_SCREEN_RECORDING',
  'ADDON_AUDIO_TRACKING',
  'ADDON_KEYSTROKE_AUDIT',
  'ADDON_11_LAYER_DLP',
  'ADDON_SUSPICIOUS_ACTIVITY_AI',
  'ADDON_OFFICE_TV_WALLBOARD',
  'ADDON_LICENSE_OPTIMIZATION',
  'ADDON_FIELD_GPS_GEOFENCE',
  'ADDON_CORPORATE_MDM',
  'ADDON_AGILE_PROJECTS_BUGS',
  'ADDON_CUSTOM_TRACKERS',
  'ADDON_CLIENT_INVOICING',
  'ADDON_PAYROLL_ENGINE',
  'ADDON_HYDIAI_ASSISTANT',
  'ADDON_WHITE_LABEL_DOMAIN',
  'ADDON_DEDICATED_S3_SFTP_STORAGE',
];

export async function seedProductionDefaults(): Promise<SeedResult> {
  // 1. Organization: Acme Global Corp
  const organizations = [
    {
      id: DEMO_ORG_ID,
      slug: 'acme-global',
      legal_name: 'Acme Global Corporation Inc.',
      display_name: 'Acme Global Corp',
      industry: 'Enterprise Cloud & FinTech',
      default_timezone: 'America/New_York',
      default_currency: 'USD',
      workweek_days: [1, 2, 3, 4, 5],
      default_tracker_mode: 'INTERACTIVE',
      idle_threshold_seconds: 300,
      screenshot_interval_minutes: 6,
      status: 'ACTIVE',
    },
  ];
  inMemoryRelationalStore.organizations = organizations;

  // 2. Subsidiaries
  const organization_subsidiaries = [
    {
      id: 'sub-us-east-001',
      org_id: DEMO_ORG_ID,
      code: 'ACME-US',
      name: 'Acme North America HQ (New York)',
      country_code: 'US',
      timezone: 'America/New_York',
      currency: 'USD',
      is_active: 1,
    },
    {
      id: 'sub-eu-uk-002',
      org_id: DEMO_ORG_ID,
      code: 'ACME-EMEA',
      name: 'Acme Europe Ltd. (London)',
      country_code: 'GB',
      timezone: 'Europe/London',
      currency: 'GBP',
      is_active: 1,
    },
    {
      id: 'sub-apac-in-003',
      org_id: DEMO_ORG_ID,
      code: 'ACME-APAC',
      name: 'Acme APAC R&D Pvt. Ltd. (Bengaluru)',
      country_code: 'IN',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      is_active: 1,
    },
  ];
  inMemoryRelationalStore.organization_subsidiaries = organization_subsidiaries;

  // 3. Organization Entitlements (All 33 Modules + All 18 Add-Ons enabled)
  const organization_entitlements = [
    {
      id: 'ent-acme-001',
      org_id: DEMO_ORG_ID,
      plan_code: 'ENTERPRISE',
      max_seats: 1000,
      active_seats: 148,
      enabled_modules: ALL_MODULES,
      enabled_addons: ALL_ADDONS,
      storage_quota_gb: 5000,
      storage_used_bytes: 184_549_376_000,
      billing_cycle: 'ANNUAL',
    },
  ];
  inMemoryRelationalStore.organization_entitlements = organization_entitlements;

  // 4. Multi-Tenant Storage Router Config
  setTenantStorageConfig({
    orgId: DEMO_ORG_ID,
    providerType: 'LOCAL_NVME_MINIO',
    endpointUrl: process.env.S3_ENDPOINT_URL || 'http://127.0.0.1:9000',
    region: 'us-east-1',
    bucketName: 'hydiems-acme-vault',
    forcePathStyle: true,
    retentionDays: 180,
  });

  // 5. Departments & Teams
  const departments = [
    {
      id: 'dept-eng-001',
      org_id: DEMO_ORG_ID,
      subsidiary_id: 'sub-us-east-001',
      code: 'ENG',
      name: 'Platform Engineering & AI',
      cost_center_code: 'CC-1001',
    },
    {
      id: 'dept-sec-002',
      org_id: DEMO_ORG_ID,
      subsidiary_id: 'sub-us-east-001',
      code: 'SEC',
      name: 'Cybersecurity & DLP Operations',
      cost_center_code: 'CC-1002',
    },
    {
      id: 'dept-ops-003',
      org_id: DEMO_ORG_ID,
      subsidiary_id: 'sub-eu-uk-002',
      code: 'OPS',
      name: 'Global Customer Operations & Field Force',
      cost_center_code: 'CC-2001',
    },
    {
      id: 'dept-hrfin-004',
      org_id: DEMO_ORG_ID,
      subsidiary_id: 'sub-us-east-001',
      code: 'PPL-FIN',
      name: 'People, Talent & Corporate Finance',
      cost_center_code: 'CC-3001',
    },
  ];
  inMemoryRelationalStore.departments = departments;

  const teams = [
    {
      id: 'team-core-api-001',
      org_id: DEMO_ORG_ID,
      department_id: 'dept-eng-001',
      code: 'ENG-CORE',
      name: 'Core Telemetry & Distributed Systems',
    },
    {
      id: 'team-soc-dlp-002',
      org_id: DEMO_ORG_ID,
      department_id: 'dept-sec-002',
      code: 'SEC-SOC',
      name: 'Insider Threat & DLP Forensics',
    },
    {
      id: 'team-field-sales-003',
      org_id: DEMO_ORG_ID,
      department_id: 'dept-ops-003',
      code: 'OPS-FIELD',
      name: 'Enterprise Field Solutions',
    },
  ];
  inMemoryRelationalStore.teams = teams;

  // 6. 9 System Roles & 33-Module Permission Matrix
  const roleCodes: SystemRole[] = [
    'SUPER_ADMIN',
    'ORG_ADMIN',
    'EXECUTIVE',
    'DEPT_HEAD',
    'MANAGER',
    'HR_ADMIN',
    'FINANCE_ADMIN',
    'SECURITY_ADMIN',
    'EMPLOYEE',
  ];

  const roles = roleCodes.map((code, idx) => ({
    id: `role-${idx + 1}-${code.toLowerCase()}`,
    org_id: DEMO_ORG_ID,
    code,
    display_name: code.replace(/_/g, ' '),
    description: `System built-in ${code} RBAC role`,
    is_system_default: 1,
  }));
  inMemoryRelationalStore.roles = roles;

  const role_permissions: Record<string, unknown>[] = [];
  for (const r of roles) {
    const matrixForRole = DEFAULT_ROLE_PERMISSION_MATRIX[r.code as SystemRole] ?? {};
    for (const [modKey, verbs] of Object.entries(matrixForRole)) {
      role_permissions.push({
        id: `rp-${r.code}-${modKey}`,
        org_id: DEMO_ORG_ID,
        role_id: r.id,
        module_key: modKey,
        allowed_verbs: verbs,
      });
    }
  }
  inMemoryRelationalStore.role_permissions = role_permissions;

  // 7. Users & Sample Workforce (Super Admin + 8 Role Personas)
  const users = [
    {
      id: SUPER_ADMIN_USER_ID,
      org_id: DEMO_ORG_ID,
      email: 'superadmin@hydiems.io',
      password_hash: '$2b$12$demoHashSuperAdminHydiEms250',
      full_name: 'Hydi Super Admin',
      system_role: 'SUPER_ADMIN',
      mfa_enabled: 1,
      status: 'ACTIVE',
    },
    {
      id: 'usr-org-admin-002',
      org_id: DEMO_ORG_ID,
      email: 'ramandeep@hydiedge.com',
      password_hash: '$2b$12$demoHashOrgAdminHydiEms250',
      full_name: 'Ramandeep',
      system_role: 'ORG_ADMIN',
      mfa_enabled: 1,
      status: 'ACTIVE',
    },
    {
      id: 'usr-sec-admin-003',
      org_id: DEMO_ORG_ID,
      email: 'ramandeep@hydiedge.com',
      password_hash: '$2b$12$demoHashSecAdminHydiEms250',
      full_name: 'Ramandeep',
      system_role: 'SECURITY_ADMIN',
      mfa_enabled: 1,
      status: 'ACTIVE',
    },
    {
      id: 'usr-hr-admin-004',
      org_id: DEMO_ORG_ID,
      email: 'ramandeep@hydiedge.com',
      password_hash: '$2b$12$demoHashHrAdminHydiEms250',
      full_name: 'Ramandeep',
      system_role: 'HR_ADMIN',
      mfa_enabled: 1,
      status: 'ACTIVE',
    },
    {
      id: 'usr-fin-admin-005',
      org_id: DEMO_ORG_ID,
      email: 'ramandeep@hydiedge.com',
      password_hash: '$2b$12$demoHashFinAdminHydiEms250',
      full_name: 'Ramandeep',
      system_role: 'FINANCE_ADMIN',
      mfa_enabled: 1,
      status: 'ACTIVE',
    },
    {
      id: 'usr-eng-lead-006',
      org_id: DEMO_ORG_ID,
      email: 'liam.chen@acmeglobal.com',
      password_hash: '$2b$12$demoHashManagerHydiEms250',
      full_name: 'Ramandeep',
      system_role: 'MANAGER',
      mfa_enabled: 1,
      status: 'ACTIVE',
    },
    {
      id: 'usr-emp-swe-007',
      org_id: DEMO_ORG_ID,
      email: 'sofia.martinez@acmeglobal.com',
      password_hash: '$2b$12$demoHashEmpHydiEms250',
      full_name: 'Sofia Martinez',
      system_role: 'EMPLOYEE',
      mfa_enabled: 1,
      status: 'ACTIVE',
    },
    {
      id: 'usr-emp-field-008',
      org_id: DEMO_ORG_ID,
      email: 'tariq.almansoor@acmeglobal.com',
      password_hash: '$2b$12$demoHashFieldHydiEms250',
      full_name: 'Tariq Al-Mansoor',
      system_role: 'EMPLOYEE',
      mfa_enabled: 0,
      status: 'ACTIVE',
    },
  ];
  inMemoryRelationalStore.users = users;

  const employees = [
    {
      id: 'emp-001',
      org_id: DEMO_ORG_ID,
      user_id: 'usr-org-admin-002',
      subsidiary_id: 'sub-us-east-001',
      department_id: 'dept-eng-001',
      team_id: 'team-core-api-001',
      employee_code: 'ACME-001',
      job_title: 'VP of Global Operations',
      employment_type: 'FULL_TIME',
      work_mode: 'HYBRID',
      tracker_mode: 'INTERACTIVE',
      expected_daily_minutes: 480,
      hourly_cost_rate: 95.0,
      hourly_billable_rate: 210.0,
      hire_date: '2022-01-15',
      status: 'ACTIVE',
    },
    {
      id: 'emp-002',
      org_id: DEMO_ORG_ID,
      user_id: 'usr-sec-admin-003',
      subsidiary_id: 'sub-us-east-001',
      department_id: 'dept-sec-002',
      team_id: 'team-soc-dlp-002',
      manager_employee_id: 'emp-001',
      employee_code: 'ACME-002',
      job_title: 'Principal DLP & Insider Threat Lead',
      employment_type: 'FULL_TIME',
      work_mode: 'OFFICE',
      tracker_mode: 'AUTOMATIC',
      expected_daily_minutes: 480,
      hourly_cost_rate: 82.0,
      hourly_billable_rate: 175.0,
      hire_date: '2022-04-10',
      status: 'ACTIVE',
    },
    {
      id: 'emp-003',
      org_id: DEMO_ORG_ID,
      user_id: 'usr-eng-lead-006',
      subsidiary_id: 'sub-us-east-001',
      department_id: 'dept-eng-001',
      team_id: 'team-core-api-001',
      manager_employee_id: 'emp-001',
      employee_code: 'ACME-003',
      job_title: 'Engineering Manager — Distributed Telemetry',
      employment_type: 'FULL_TIME',
      work_mode: 'HYBRID',
      tracker_mode: 'INTERACTIVE',
      expected_daily_minutes: 480,
      hourly_cost_rate: 78.0,
      hourly_billable_rate: 165.0,
      hire_date: '2022-08-01',
      status: 'ACTIVE',
    },
    {
      id: 'emp-004',
      org_id: DEMO_ORG_ID,
      user_id: 'usr-emp-swe-007',
      subsidiary_id: 'sub-us-east-001',
      department_id: 'dept-eng-001',
      team_id: 'team-core-api-001',
      manager_employee_id: 'emp-003',
      employee_code: 'ACME-004',
      job_title: 'Senior Staff Rust & TypeScript Engineer',
      employment_type: 'FULL_TIME',
      work_mode: 'REMOTE',
      tracker_mode: 'INTERACTIVE',
      expected_daily_minutes: 480,
      hourly_cost_rate: 68.0,
      hourly_billable_rate: 150.0,
      hire_date: '2023-02-20',
      status: 'ACTIVE',
    },
    {
      id: 'emp-005',
      org_id: DEMO_ORG_ID,
      user_id: 'usr-emp-field-008',
      subsidiary_id: 'sub-eu-uk-002',
      department_id: 'dept-ops-003',
      team_id: 'team-field-sales-003',
      manager_employee_id: 'emp-001',
      employee_code: 'ACME-005',
      job_title: 'Senior Enterprise Field Architect',
      employment_type: 'FULL_TIME',
      work_mode: 'FIELD',
      tracker_mode: 'VISIBLE',
      expected_daily_minutes: 480,
      hourly_cost_rate: 62.0,
      hourly_billable_rate: 140.0,
      hire_date: '2023-06-12',
      status: 'ACTIVE',
    },
  ];
  inMemoryRelationalStore.employees = employees;

  // 8. Shifts
  const shifts = [
    {
      id: 'shift-us-day-001',
      org_id: DEMO_ORG_ID,
      code: 'US-EAST-STD',
      name: 'US Eastern Standard Shift (09:00 - 17:30)',
      timezone: 'America/New_York',
      start_time: '09:00:00',
      end_time: '17:30:00',
      crosses_midnight: 0,
      expected_work_minutes: 480,
      paid_break_minutes: 30,
      grace_late_minutes: 10,
      grace_early_leave_minutes: 10,
      half_day_threshold_minutes: 240,
      overtime_after_minutes: 510,
    },
    {
      id: 'shift-uk-day-002',
      org_id: DEMO_ORG_ID,
      code: 'EMEA-LON-STD',
      name: 'EMEA London Standard Shift (08:30 - 17:00)',
      timezone: 'Europe/London',
      start_time: '08:30:00',
      end_time: '17:00:00',
      crosses_midnight: 0,
      expected_work_minutes: 480,
      paid_break_minutes: 30,
      grace_late_minutes: 10,
      grace_early_leave_minutes: 10,
      half_day_threshold_minutes: 240,
      overtime_after_minutes: 510,
    },
  ];
  inMemoryRelationalStore.shifts = shifts;

  // 9. Away Reasons
  const away_reasons = [
    {
      id: 'away-meeting-001',
      org_id: DEMO_ORG_ID,
      code: 'OFFLINE_CLIENT_MEETING',
      label: 'In-Person Client / Boardroom Meeting',
      counts_as_work: 1,
      counts_as_productive: 1,
      max_minutes_per_day: 180,
      requires_approval: 0,
    },
    {
      id: 'away-lunch-002',
      org_id: DEMO_ORG_ID,
      code: 'LUNCH_BREAK',
      label: 'Scheduled Meal / Rest Break',
      counts_as_work: 0,
      counts_as_productive: 0,
      max_minutes_per_day: 60,
      requires_approval: 0,
    },
    {
      id: 'away-training-003',
      org_id: DEMO_ORG_ID,
      code: 'SECURITY_WORKSHOP',
      label: 'Compliance / Engineering Workshop',
      counts_as_work: 1,
      counts_as_productive: 1,
      max_minutes_per_day: 120,
      requires_approval: 1,
    },
  ];
  inMemoryRelationalStore.away_reasons = away_reasons;

  // 10. Productivity Classification Rules
  const productivity_rules = [
    {
      id: 'pr-vscode-001',
      org_id: DEMO_ORG_ID,
      scope_tier: 'ORGANIZATION',
      match_type: 'PROCESS_NAME',
      pattern: 'code.exe',
      category: 'PRODUCTIVE',
      productivity_weight: 1.0,
      priority: 10,
    },
    {
      id: 'pr-github-002',
      org_id: DEMO_ORG_ID,
      scope_tier: 'ORGANIZATION',
      match_type: 'URL_DOMAIN',
      pattern: 'github.com',
      category: 'PRODUCTIVE',
      productivity_weight: 1.0,
      priority: 15,
    },
    {
      id: 'pr-figma-003',
      org_id: DEMO_ORG_ID,
      scope_tier: 'ORGANIZATION',
      match_type: 'URL_DOMAIN',
      pattern: 'figma.com',
      category: 'PRODUCTIVE',
      productivity_weight: 1.0,
      priority: 20,
    },
    {
      id: 'pr-slack-004',
      org_id: DEMO_ORG_ID,
      scope_tier: 'ORGANIZATION',
      match_type: 'PROCESS_NAME',
      pattern: 'slack.exe',
      category: 'NEUTRAL',
      productivity_weight: 0.5,
      priority: 50,
    },
    {
      id: 'pr-youtube-005',
      org_id: DEMO_ORG_ID,
      scope_tier: 'ORGANIZATION',
      match_type: 'URL_DOMAIN',
      pattern: 'youtube.com',
      category: 'NON_PRODUCTIVE',
      productivity_weight: 0.0,
      priority: 80,
    },
  ];
  inMemoryRelationalStore.productivity_rules = productivity_rules;

  // 11. Projects & Tasks
  const projects = [
    {
      id: 'proj-hydi-cloud-001',
      org_id: DEMO_ORG_ID,
      department_id: 'dept-eng-001',
      code: 'PRJ-TELEMETRY-V3',
      name: 'Zero-Latency ClickHouse Telemetry Pipeline',
      billing_model: 'TIME_AND_MATERIALS',
      budget_hours: 2400,
      budget_amount: 360000,
      consumed_hours: 1480,
      consumed_amount: 222000,
      health_status: 'ON_TRACK',
      start_date: '2026-01-10',
      target_end_date: '2026-12-31',
    },
    {
      id: 'proj-dlp-shield-002',
      org_id: DEMO_ORG_ID,
      department_id: 'dept-sec-002',
      code: 'PRJ-DLP-SHIELD',
      name: '11-Layer Endpoint Kernel DLP Enforcement',
      billing_model: 'FIXED_PRICE',
      budget_hours: 1500,
      budget_amount: 240000,
      consumed_hours: 1390,
      consumed_amount: 222400,
      health_status: 'AT_RISK',
      start_date: '2026-03-01',
      target_end_date: '2026-10-30',
    },
  ];
  inMemoryRelationalStore.projects = projects;

  const tasks = [
    {
      id: 'tsk-001',
      org_id: DEMO_ORG_ID,
      project_id: 'proj-hydi-cloud-001',
      task_key: 'TEL-101',
      title: 'Implement 10-second ActivitySlice10s MergeTree batch ingestion',
      status: 'IN_PROGRESS',
      priority: 'URGENT',
      assignee_employee_id: 'emp-004',
      story_points: 8,
      estimated_minutes: 960,
      logged_minutes: 620,
    },
    {
      id: 'tsk-002',
      org_id: DEMO_ORG_ID,
      project_id: 'proj-dlp-shield-002',
      task_key: 'DLP-204',
      title: 'Enforce USB Removable Media VID/PID hardware serial whitelist',
      status: 'IN_REVIEW',
      priority: 'HIGH',
      assignee_employee_id: 'emp-002',
      story_points: 5,
      estimated_minutes: 600,
      logged_minutes: 540,
    },
  ];
  inMemoryRelationalStore.tasks = tasks;

  // 12. Software License Contracts
  const software_license_contracts = [
    {
      id: 'lic-jetbrains-001',
      org_id: DEMO_ORG_ID,
      vendor_name: 'JetBrains s.r.o.',
      product_name: 'IntelliJ IDEA & RustRover Ultimate',
      matched_executable_or_domain: 'rustrover64.exe',
      purchased_seats: 85,
      cost_per_seat_monthly: 59.0,
      currency: 'USD',
      contract_start_date: '2026-01-01',
      contract_end_date: '2026-12-31',
      inactivity_reclaim_days: 30,
      auto_reclaim_enabled: 1,
    },
    {
      id: 'lic-figma-002',
      org_id: DEMO_ORG_ID,
      vendor_name: 'Figma Inc.',
      product_name: 'Figma Enterprise Seat',
      matched_executable_or_domain: 'figma.com',
      purchased_seats: 50,
      cost_per_seat_monthly: 75.0,
      currency: 'USD',
      contract_start_date: '2026-01-01',
      contract_end_date: '2026-12-31',
      inactivity_reclaim_days: 21,
      auto_reclaim_enabled: 1,
    },
  ];
  inMemoryRelationalStore.software_license_contracts = software_license_contracts;

  // 13. 11-Layer DLP Policies
  const dlp_policies = [
    {
      id: 'dlp-pol-usb-001',
      org_id: DEMO_ORG_ID,
      name: 'Block Unapproved USB Mass Storage Exfiltration',
      channel: 'USB_REMOVABLE_MEDIA',
      severity: 'CRITICAL',
      enforcement_action: 'BLOCK_AND_QUARANTINE',
      is_enabled: 1,
    },
    {
      id: 'dlp-pol-web-002',
      org_id: DEMO_ORG_ID,
      name: 'Block Source Code & Customer PII Upload to Personal Cloud / GenAI',
      channel: 'WEB_UPLOAD',
      severity: 'CRITICAL',
      enforcement_action: 'CAPTURE_FORENSIC_VIDEO',
      is_enabled: 1,
    },
    {
      id: 'dlp-pol-clip-003',
      org_id: DEMO_ORG_ID,
      name: 'Detect Bulk API Key / PEM Private Key Clipboard Copy',
      channel: 'CLIPBOARD',
      severity: 'HIGH',
      enforcement_action: 'WARN_USER',
      is_enabled: 1,
    },
  ];
  inMemoryRelationalStore.dlp_policies = dlp_policies;

  // 14. Seed initial Redis 45s TTL live presence & ClickHouse telemetry + Genesis Audit Chain
  for (const emp of employees) {
    await recordAgentHeartbeatPresence({
      orgId: DEMO_ORG_ID,
      employeeId: emp.id,
      deviceId: `dev-${emp.id}`,
      timeState: 'PRODUCTIVE',
      activeProcess: 'code.exe',
      activeWindowTitle: 'hydiEMS — timeClassificationEngine.ts',
      activeUrlDomain: 'github.com',
      lastHeartbeatUtc: new Date().toISOString(),
      agentVersion: '2.5.0',
      sqlitePendingRows: 0,
    });
  }

  await insertActivitySlicesBatch([
    {
      sliceId: 'slice-seed-001',
      orgId: DEMO_ORG_ID,
      employeeId: 'emp-004',
      departmentId: 'dept-eng-001',
      teamId: 'team-core-api-001',
      deviceId: 'dev-emp-004',
      sliceStartUtc: new Date().toISOString(),
      durationSec: 10,
      timeState: 'PRODUCTIVE',
      productivityCategory: 'PRODUCTIVE',
      productivityWeight: 1.0,
      processName: 'code.exe',
      windowTitle: 'hydiEMS — packages/database/src/clickhouse.ts',
      urlFull: 'https://github.com/acme-global/hydiems/pulls',
      urlDomain: 'github.com',
      browserName: 'Chrome',
      keystrokesCount: 42,
      mouseClicksCount: 6,
      mouseDistancePx: 1480,
      scrollTicks: 8,
      idleSecondsElapsed: 0,
      activeMicDb: -48.0,
      activeSpeakerDb: -60.0,
      isPersonalMode: false,
      isAwayBreak: false,
      projectId: 'proj-hydi-cloud-001',
      taskId: 'tsk-001',
      monitorIndex: 0,
    },
  ]);

  await appendImmutableAuditLog({
    orgId: DEMO_ORG_ID,
    actorUserId: SUPER_ADMIN_USER_ID,
    actorRole: 'SUPER_ADMIN',
    actorIp: '127.0.0.1',
    moduleKey: 'M30_ADMINISTRATION',
    actionVerb: 'CONFIGURE',
    targetEntityType: 'ORGANIZATION',
    targetEntityId: DEMO_ORG_ID,
    payload: {
      event: 'GENESIS_TENANT_SEED_COMPLETED',
      planCode: 'ENTERPRISE',
      modulesEnabled: ALL_MODULES.length,
      addOnsEnabled: ALL_ADDONS.length,
    },
  });

  // Also attempt SQL upsert when connected to a live MySQL 8.0 instance
  await executeMysqlQuery(
    `INSERT IGNORE INTO organizations (id, slug, legal_name, display_name, default_timezone, default_currency, workweek_days, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      DEMO_ORG_ID,
      'acme-global',
      'Acme Global Corporation Inc.',
      'Acme Global Corp',
      'America/New_York',
      'USD',
      JSON.stringify([1, 2, 3, 4, 5]),
      'ACTIVE',
    ]
  );

  return {
    orgId: DEMO_ORG_ID,
    orgName: 'Acme Global Corp',
    seededTablesCount: Object.keys(inMemoryRelationalStore).length,
    seededUsersCount: users.length,
    seededEmployeesCount: employees.length,
    seededRolesCount: roles.length,
    seededProjectsCount: projects.length,
    seededDlpPoliciesCount: dlp_policies.length,
  };
}

if (require.main === module) {
  seedProductionDefaults()
    .then((res) => {
      console.log('[HydiEms Seed] Completed successfully:', JSON.stringify(res, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('[HydiEms Seed] Error:', err);
      process.exit(1);
    });
}
