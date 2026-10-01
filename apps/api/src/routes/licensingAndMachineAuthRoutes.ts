// ============================================================================
// @hydiems/api — HydiEdge SaaS Seat-Based Licensing Engine,
// 7-Day Free Trial Provisioning, Machine-Based HWID Anti-Piracy Protection & Pricing
// ============================================================================
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { executeMysqlQuery } from '@hydiems/database';
import { ALL_MODULES } from '@hydiems/shared';

// Secret key used for cryptographic machine binding tokens
const MACHINE_AUTH_SECRET = process.env.MACHINE_AUTH_SECRET || 'hydiedge_anti_piracy_hwid_secret_2026_super_secure';

function generateLicenseKey(planCode: string): string {
  const prefix = `HYDI-${planCode.slice(0, 3).toUpperCase()}`;
  const r1 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const r2 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const r3 = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${prefix}-${r1}-${r2}-${r3}`;
}

function mintMachineToken(orgId: string, licenseId: string, machineFingerprint: string, expiryMs: number): string {
  const payload = `${orgId}:${licenseId}:${machineFingerprint}:${expiryMs}`;
  const signature = crypto.createHmac('sha256', MACHINE_AUTH_SECRET).update(payload).digest('hex');
  return Buffer.from(JSON.stringify({ payload, signature })).toString('base64url');
}

function verifyMachineToken(token: string): { valid: boolean; orgId?: string; licenseId?: string; machineFingerprint?: string } {
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf-8');
    const { payload, signature } = JSON.parse(raw);
    const expected = crypto.createHmac('sha256', MACHINE_AUTH_SECRET).update(payload).digest('hex');
    if (expected !== signature) return { valid: false };

    const [orgId, licenseId, machineFingerprint, expiryMsStr] = payload.split(':');
    const expiryMs = parseInt(expiryMsStr, 10);
    if (Date.now() > expiryMs) return { valid: false };

    return { valid: true, orgId, licenseId, machineFingerprint };
  } catch {
    return { valid: false };
  }
}

export async function registerLicensingAndMachineAuthRoutes(app: FastifyInstance): Promise<void> {

  // ==========================================================================
  // SECTION 1: PUBLIC PRICING & 7-DAY FREE TRIAL SIGNUP
  // ==========================================================================

  // 1.1 Get Public Pricing Plans Catalog
  app.get('/api/v1/public/pricing-plans', async () => {
    try {
      const rows = await executeMysqlQuery<any[]>(
        `SELECT id, plan_code, plan_name, tagline, price_inr_monthly, price_usd_monthly,
                annual_discount_pct, min_seats, is_popular, features_list
         FROM public_pricing_plans
         ORDER BY price_inr_monthly ASC`
      );

      const plans = (rows || []).map((r: any) => ({
        id: r.id,
        code: r.plan_code,
        name: r.plan_name,
        tagline: r.tagline,
        priceMonthlyInr: Number(r.price_inr_monthly),
        priceMonthlyUsd: Number(r.price_usd_monthly),
        annualDiscountPct: Number(r.annual_discount_pct),
        minSeats: Number(r.min_seats),
        isPopular: Boolean(r.is_popular),
        features: typeof r.features_list === 'string' ? JSON.parse(r.features_list) : r.features_list,
      }));

      return {
        currencyRates: { USD_TO_INR: 83.5 },
        plans,
      };
    } catch (err: any) {
      return { error: 'FETCH_PLANS_FAILED', message: err.message };
    }
  });

  // 1.2 Public 7-Day Free Trial Provisioning
  const FreeTrialSchema = z.object({
    companyName: z.string().min(2),
    contactName: z.string().min(2),
    workEmail: z.string().email(),
    phone: z.string().min(8),
    password: z.string().min(6),
    companySize: z.number().int().min(1).max(10000).default(10),
    planCode: z.enum(['STARTER', 'PROFESSIONAL', 'ENTERPRISE', 'ULTIMATE']).default('ENTERPRISE'),
  });

  app.post('/api/v1/public/free-trial', async (req, reply) => {
    const parsed = FreeTrialSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
    }

    const { companyName, contactName, workEmail, phone, password, companySize, planCode } = parsed.data;
    const slug = companyName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 32);
    const orgId = `org-${slug}-${crypto.randomBytes(3).toString('hex')}`;
    const userId = `usr-admin-${crypto.randomBytes(4).toString('hex')}`;
    const licenseId = `lic-trial-${crypto.randomBytes(4).toString('hex')}`;
    const licenseKey = generateLicenseKey(planCode);

    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // Exactly 7 days

    try {
      // 1. Insert Organization
      await executeMysqlQuery(
        `INSERT INTO organizations (id, slug, legal_name, display_name, status, workweek_days)
         VALUES (?, ?, ?, ?, 'TRIAL', ?)`,
        [orgId, `${slug}-${Date.now().toString().slice(-4)}`, companyName, companyName, JSON.stringify([1, 2, 3, 4, 5])]
      );

      // 2. Insert Admin User
      await executeMysqlQuery(
        `INSERT INTO users (id, org_id, email, password_hash, full_name, role, status)
         VALUES (?, ?, ?, ?, ?, 'ORG_ADMIN', 'ACTIVE')`,
        [userId, orgId, workEmail, crypto.createHash('sha256').update(password).digest('hex'), contactName]
      );

      // 3. Insert 7-Day Trial License
      const pricePerUser = planCode === 'STARTER' ? 199 : planCode === 'PROFESSIONAL' ? 399 : planCode === 'ENTERPRISE' ? 699 : 999;
      await executeMysqlQuery(
        `INSERT INTO tenant_licenses (
           id, org_id, license_key, plan_code, seat_limit, active_machines_count,
           price_per_user_monthly, billing_cycle, currency, status, is_trial,
           trial_starts_at, trial_ends_at, activated_at, expires_at, hwid_binding_required, allowed_features
         )
         VALUES (?, ?, ?, ?, ?, 0, ?, 'ANNUAL', 'INR', 'TRIAL', 1, ?, ?, ?, ?, 1, ?)`,
        [
          licenseId,
          orgId,
          licenseKey,
          planCode,
          Math.max(companySize, 10),
          pricePerUser,
          now.toISOString().slice(0, 19).replace('T', ' '),
          trialEndsAt.toISOString().slice(0, 19).replace('T', ' '),
          now.toISOString().slice(0, 19).replace('T', ' '),
          trialEndsAt.toISOString().slice(0, 19).replace('T', ' '),
          JSON.stringify(ALL_MODULES),
        ]
      );

      // 4. Insert Entitlements
      await executeMysqlQuery(
        `INSERT INTO organization_entitlements (id, org_id, plan_code, max_seats, active_seats, enabled_modules, enabled_addons, storage_quota_gb)
         VALUES (?, ?, ?, ?, 0, ?, ?, 250)`,
        [
          `ent-${orgId}`,
          orgId,
          planCode,
          Math.max(companySize, 10),
          JSON.stringify(ALL_MODULES),
          JSON.stringify(['ADDON_SCREENSHOTS_10X', 'ADDON_LIVE_STREAMING_WEBRTC', 'ADDON_11_LAYER_DLP', 'ADDON_PAYROLL_PRECISION', 'ADDON_FIELD_GPS']),
        ]
      );

      // 5. Log Public Signup
      await executeMysqlQuery(
        `INSERT INTO public_trial_signups (id, company_name, contact_name, work_email, phone, company_size, plan_code, provisioned_org_id, provisioned_license_key, ip_address, trial_expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `signup-${Date.now()}`,
          companyName,
          contactName,
          workEmail,
          phone,
          companySize,
          planCode,
          orgId,
          licenseKey,
          req.ip,
          trialEndsAt.toISOString().slice(0, 19).replace('T', ' '),
        ]
      );

      // Mint initial access JWT
      const authToken = app.jwt.sign(
        {
          userId,
          orgId,
          email: workEmail,
          role: 'ORG_ADMIN',
          mfaVerified: true,
        },
        { expiresIn: '7d' }
      );

      return {
        success: true,
        message: 'Your 7-day free trial has been successfully provisioned!',
        trialDays: 7,
        trialEndsAt: trialEndsAt.toISOString(),
        organization: {
          id: orgId,
          name: companyName,
          slug,
        },
        credentials: {
          email: workEmail,
          licenseKey,
          seatLimit: Math.max(companySize, 10),
        },
        authToken,
        desktopAgentDownloadUrl: 'https://hydiedge.com/downloads/HydiEdge.Setup.exe',
      };
    } catch (err: any) {
      req.log.error(err, 'Failed to provision free trial');
      return reply.code(500).send({ error: 'TRIAL_PROVISIONING_FAILED', message: err.message });
    }
  });

  // 1.3 Plan Checkout Intent & Cost Calculation
  app.post('/api/v1/public/checkout-intent', async (req, reply) => {
    const body = (req.body || {}) as {
      planCode: string;
      seats: number;
      billingCycle: 'MONTHLY' | 'ANNUAL';
      currency?: 'INR' | 'USD';
    };

    const seats = Math.max(Number(body.seats) || 10, 5);
    const cycle = body.billingCycle === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY';
    const curr = body.currency === 'USD' ? 'USD' : 'INR';

    const rates: Record<string, { inr: number; usd: number }> = {
      STARTER: { inr: 199, usd: 2.99 },
      PROFESSIONAL: { inr: 399, usd: 5.99 },
      ENTERPRISE: { inr: 699, usd: 9.99 },
      ULTIMATE: { inr: 999, usd: 14.99 },
    };

    const plan = rates[body.planCode?.toUpperCase()] || rates.ENTERPRISE;
    const baseRate = curr === 'USD' ? plan.usd : plan.inr;
    const discountMultiplier = cycle === 'ANNUAL' ? 0.8 : 1.0; // 20% discount on annual
    const effectiveMonthlyPerSeat = Math.round(baseRate * discountMultiplier * 100) / 100;
    const totalAmount = cycle === 'ANNUAL'
      ? Math.round(effectiveMonthlyPerSeat * seats * 12 * 100) / 100
      : Math.round(effectiveMonthlyPerSeat * seats * 100) / 100;

    return {
      planCode: body.planCode || 'ENTERPRISE',
      seats,
      billingCycle: cycle,
      currency: curr,
      standardRatePerUserMonthly: baseRate,
      discountPercent: cycle === 'ANNUAL' ? 20 : 0,
      effectiveRatePerUserMonthly: effectiveMonthlyPerSeat,
      totalAmount,
      savingsAmount: cycle === 'ANNUAL' ? Math.round((baseRate * seats * 12 - totalAmount) * 100) / 100 : 0,
      checkoutSessionId: `cs_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    };
  });

  // ==========================================================================
  // SECTION 2: SUPERADMIN LICENSING CONTROL PLANE
  // ==========================================================================

  // 2.1 Get All Tenant Licenses with Live Seat & Machine Counts
  app.get('/api/v1/super-admin/licenses', async () => {
    try {
      const rows = await executeMysqlQuery<any[]>(
        `SELECT l.id, l.org_id, l.license_key, l.plan_code, l.seat_limit, l.active_machines_count,
                l.price_per_user_monthly, l.billing_cycle, l.currency, l.status, l.is_trial,
                l.trial_starts_at, l.trial_ends_at, l.activated_at, l.expires_at, l.hwid_binding_required,
                o.legal_name as org_name, o.slug as org_slug,
                (SELECT COUNT(*) FROM agent_machine_licenses aml WHERE aml.license_id = l.id AND aml.status = 'ACTIVE') as live_machine_count
         FROM tenant_licenses l
         JOIN organizations o ON o.id = l.org_id
         ORDER BY l.created_at DESC`
      );

      let totalRevenue = 0;
      let totalSeatsSold = 0;
      let totalActiveMachines = 0;
      let activeLicensesCount = 0;
      let trialLicensesCount = 0;

      const licenses = (rows || []).map((r: any) => {
        const liveMachines = Number(r.live_machine_count || r.active_machines_count || 0);
        const seats = Number(r.seat_limit || 0);
        const price = Number(r.price_per_user_monthly || 0);

        if (r.status === 'ACTIVE') {
          activeLicensesCount++;
          totalRevenue += price * seats * (r.billing_cycle === 'ANNUAL' ? 12 : 1);
        } else if (r.status === 'TRIAL') {
          trialLicensesCount++;
        }

        totalSeatsSold += seats;
        totalActiveMachines += liveMachines;

        // Calculate days left
        const now = new Date().getTime();
        const expiry = new Date(r.expires_at).getTime();
        const daysLeft = Math.max(0, Math.ceil((expiry - now) / (1000 * 60 * 60 * 24)));

        return {
          id: r.id,
          orgId: r.org_id,
          orgName: r.org_name,
          orgSlug: r.org_slug,
          licenseKey: r.license_key,
          planCode: r.plan_code,
          seatLimit: seats,
          activeMachines: liveMachines,
          pricePerUserMonthly: price,
          billingCycle: r.billing_cycle,
          currency: r.currency,
          status: r.status,
          isTrial: Boolean(r.is_trial),
          daysLeft,
          expiresAt: r.expires_at,
          trialEndsAt: r.trial_ends_at,
          hwidBindingRequired: Boolean(r.hwid_binding_required),
        };
      });

      return {
        summary: {
          totalLicenses: licenses.length,
          activeLicensesCount,
          trialLicensesCount,
          totalSeatsSold,
          totalActiveMachines,
          seatOccupancyPct: totalSeatsSold > 0 ? Math.round((totalActiveMachines / totalSeatsSold) * 100) : 0,
          totalAnnualizedRevenueInr: totalRevenue,
        },
        licenses,
      };
    } catch (err: any) {
      return { error: 'FETCH_LICENSES_FAILED', message: err.message };
    }
  });

  // 2.2 Create / Sell New Paid License to Tenant
  const CreateLicenseSchema = z.object({
    orgId: z.string().min(2),
    planCode: z.enum(['STARTER', 'PROFESSIONAL', 'ENTERPRISE', 'ULTIMATE']).default('ENTERPRISE'),
    seatLimit: z.number().int().min(1).max(50000).default(25),
    pricePerUserMonthly: z.number().min(0).default(699),
    billingCycle: z.enum(['MONTHLY', 'ANNUAL']).default('ANNUAL'),
    durationMonths: z.number().int().min(1).max(60).default(12),
    hwidBindingRequired: z.boolean().default(true),
    isTrial: z.boolean().default(false),
  });

  app.post('/api/v1/super-admin/licenses', async (req, reply) => {
    const parsed = CreateLicenseSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
    }

    const { orgId, planCode, seatLimit, pricePerUserMonthly, billingCycle, durationMonths, hwidBindingRequired, isTrial } = parsed.data;
    const licenseId = `lic-${crypto.randomBytes(5).toString('hex')}`;
    const licenseKey = generateLicenseKey(planCode);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationMonths * 30 * 24 * 60 * 60 * 1000);

    try {
      await executeMysqlQuery(
        `INSERT INTO tenant_licenses (
           id, org_id, license_key, plan_code, seat_limit, active_machines_count,
           price_per_user_monthly, billing_cycle, currency, status, is_trial,
           activated_at, expires_at, hwid_binding_required, allowed_features
         )
         VALUES (?, ?, ?, ?, 0, ?, ?, 'INR', ?, ?, ?, ?, ?, ?)`,
        [
          licenseId,
          orgId,
          licenseKey,
          planCode,
          seatLimit,
          pricePerUserMonthly,
          billingCycle,
          isTrial ? 'TRIAL' : 'ACTIVE',
          isTrial ? 1 : 0,
          now.toISOString().slice(0, 19).replace('T', ' '),
          expiresAt.toISOString().slice(0, 19).replace('T', ' '),
          hwidBindingRequired ? 1 : 0,
          JSON.stringify(ALL_MODULES),
        ]
      );

      // Update org status to ACTIVE
      await executeMysqlQuery(
        `UPDATE organizations SET status = 'ACTIVE' WHERE id = ?`,
        [orgId]
      );

      return {
        success: true,
        message: 'License successfully generated and assigned to tenant!',
        license: {
          id: licenseId,
          orgId,
          licenseKey,
          planCode,
          seatLimit,
          pricePerUserMonthly,
          billingCycle,
          expiresAt: expiresAt.toISOString(),
          hwidBindingRequired,
        },
      };
    } catch (err: any) {
      return reply.code(500).send({ error: 'LICENSE_CREATION_FAILED', message: err.message });
    }
  });

  // 2.3 Modify License (Add seats, extend expiry, change status)
  app.patch('/api/v1/super-admin/licenses/:licenseId', async (req, reply) => {
    const { licenseId } = req.params as { licenseId: string };
    const body = (req.body || {}) as {
      seatLimit?: number;
      extendDays?: number;
      status?: 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'SUSPENDED';
      planCode?: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE' | 'ULTIMATE';
    };

    try {
      if (body.seatLimit) {
        await executeMysqlQuery(
          `UPDATE tenant_licenses SET seat_limit = ? WHERE id = ?`,
          [body.seatLimit, licenseId]
        );
      }

      if (body.extendDays) {
        await executeMysqlQuery(
          `UPDATE tenant_licenses SET expires_at = DATE_ADD(expires_at, INTERVAL ? DAY) WHERE id = ?`,
          [body.extendDays, licenseId]
        );
      }

      if (body.status) {
        await executeMysqlQuery(
          `UPDATE tenant_licenses SET status = ? WHERE id = ?`,
          [body.status, licenseId]
        );
      }

      if (body.planCode) {
        await executeMysqlQuery(
          `UPDATE tenant_licenses SET plan_code = ? WHERE id = ?`,
          [body.planCode, licenseId]
        );
      }

      return { success: true, message: 'License updated successfully!' };
    } catch (err: any) {
      return reply.code(500).send({ error: 'UPDATE_FAILED', message: err.message });
    }
  });

  // 2.4 List Machines bound to a License (HWID Anti-Piracy Inspector)
  app.get('/api/v1/super-admin/licenses/:licenseId/machines', async (req) => {
    const { licenseId } = req.params as { licenseId: string };
    try {
      const rows = await executeMysqlQuery<any[]>(
        `SELECT aml.id, aml.org_id, aml.machine_fingerprint, aml.hostname, aml.os_platform,
                aml.os_version, aml.cpu_identifier, aml.mac_address, aml.disk_serial,
                aml.status, aml.activated_at, aml.last_heartbeat_at, aml.revoked_at, aml.revocation_reason
         FROM agent_machine_licenses aml
         WHERE aml.license_id = ?
         ORDER BY aml.activated_at DESC`,
        [licenseId]
      );

      return {
        licenseId,
        totalRegisteredMachines: rows.length,
        activeMachines: rows.filter((r: any) => r.status === 'ACTIVE').length,
        machines: rows || [],
      };
    } catch (err: any) {
      return { error: 'FETCH_MACHINES_FAILED', message: err.message };
    }
  });

  // 2.5 Revoke Machine HWID Binding (Frees 1 seat for the organization)
  app.post('/api/v1/super-admin/machines/:machineId/revoke', async (req, reply) => {
    const { machineId } = req.params as { machineId: string };
    const body = (req.body || {}) as { reason?: string };

    try {
      // Find machine
      const [machine] = await executeMysqlQuery<any[]>(
        `SELECT id, license_id, org_id, status FROM agent_machine_licenses WHERE id = ?`,
        [machineId]
      );

      if (!machine) {
        return reply.code(404).send({ error: 'MACHINE_NOT_FOUND' });
      }

      if (machine.status !== 'REVOKED') {
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        await executeMysqlQuery(
          `UPDATE agent_machine_licenses
           SET status = 'REVOKED', revoked_at = ?, revocation_reason = ?
           WHERE id = ?`,
          [now, body.reason || 'Manually revoked by SuperAdmin', machineId]
        );

        // Decrement active machines count
        await executeMysqlQuery(
          `UPDATE tenant_licenses
           SET active_machines_count = GREATEST(0, active_machines_count - 1)
           WHERE id = ?`,
          [machine.license_id]
        );
      }

      return {
        success: true,
        message: 'Machine hardware binding has been revoked. 1 seat has been freed for the tenant.',
      };
    } catch (err: any) {
      return reply.code(500).send({ error: 'REVOKE_FAILED', message: err.message });
    }
  });

  // ==========================================================================
  // SECTION 3: DESKTOP AGENT MACHINE-BASED ACTIVATION & ANTI-PIRACY
  // ==========================================================================

  const ActivateMachineSchema = z.object({
    licenseKey: z.string().min(5),
    machineFingerprint: z.string().min(16),
    hostname: z.string().min(1),
    osPlatform: z.enum(['WINDOWS', 'MACOS', 'LINUX']).default('WINDOWS'),
    osVersion: z.string().default('Windows 11 Pro 64-bit'),
    cpuIdentifier: z.string().optional(),
    biosUuid: z.string().optional(),
    macAddress: z.string().optional(),
    diskSerial: z.string().optional(),
    employeeCode: z.string().optional(),
  });

  // 3.1 Agent Machine Activation (Setup Hook)
  app.post('/api/v1/agent/activate-machine', async (req, reply) => {
    const parsed = ActivateMachineSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
    }

    const {
      licenseKey,
      machineFingerprint,
      hostname,
      osPlatform,
      osVersion,
      cpuIdentifier,
      biosUuid,
      macAddress,
      diskSerial,
      employeeCode,
    } = parsed.data;

    try {
      // 1. Look up License
      const [license] = await executeMysqlQuery<any[]>(
        `SELECT l.id, l.org_id, l.license_key, l.plan_code, l.seat_limit, l.active_machines_count,
                l.status, l.is_trial, l.trial_ends_at, l.expires_at, l.hwid_binding_required, l.allowed_features,
                o.legal_name as org_name
         FROM tenant_licenses l
         JOIN organizations o ON o.id = l.org_id
         WHERE l.license_key = ?`,
        [licenseKey]
      );

      if (!license) {
        return reply.code(404).send({
          error: 'INVALID_LICENSE_KEY',
          message: 'The provided license key was not found. Please verify with your organization administrator.',
        });
      }

      // 2. Check Expiry
      const now = new Date();
      if (license.status === 'SUSPENDED') {
        return reply.code(403).send({
          error: 'LICENSE_SUSPENDED',
          message: 'Your organization license has been suspended. Please contact HydiEdge SuperAdmin.',
        });
      }

      const expiryDate = new Date(license.expires_at);
      if (now > expiryDate || (license.is_trial && license.trial_ends_at && now > new Date(license.trial_ends_at))) {
        return reply.code(403).send({
          error: 'LICENSE_EXPIRED',
          message: license.is_trial
            ? 'Your 7-day free trial period has ended. Please upgrade to a paid seat plan to continue using the desktop agent.'
            : 'Your organization license has expired. Please renew your subscription to continue.',
        });
      }

      // 3. Check Existing Machine Binding
      const [existingMachine] = await executeMysqlQuery<any[]>(
        `SELECT id, status, agent_token_hash FROM agent_machine_licenses
         WHERE org_id = ? AND machine_fingerprint = ?`,
        [license.org_id, machineFingerprint]
      );

      const tokenExpiryMs = now.getTime() + 30 * 24 * 60 * 60 * 1000; // 30-day token
      const machineToken = mintMachineToken(license.org_id, license.id, machineFingerprint, tokenExpiryMs);
      const tokenHash = crypto.createHash('sha256').update(machineToken).digest('hex');

      if (existingMachine) {
        if (existingMachine.status === 'REVOKED') {
          return reply.code(403).send({
            error: 'MACHINE_REVOKED',
            message: 'This hardware has been revoked by your system administrator. Anti-piracy lock engaged.',
          });
        }

        // Update heartbeat & machine info
        await executeMysqlQuery(
          `UPDATE agent_machine_licenses
           SET hostname = ?, os_version = ?, last_heartbeat_at = NOW(), agent_token_hash = ?
           WHERE id = ?`,
          [hostname, osVersion, tokenHash, existingMachine.id]
        );

        return {
          success: true,
          status: 'RECONNECTED',
          message: 'Machine hardware identity verified. Anti-piracy check passed.',
          machineId: existingMachine.id,
          orgId: license.org_id,
          orgName: license.org_name,
          planCode: license.plan_code,
          seatLimit: license.seat_limit,
          activeSeats: license.active_machines_count,
          machineToken,
          tokenExpiresAt: new Date(tokenExpiryMs).toISOString(),
          allowedModules: typeof license.allowed_features === 'string' ? JSON.parse(license.allowed_features) : license.allowed_features,
        };
      }

      // 4. New Machine: Check Seat Limit Quota
      const [countResult] = await executeMysqlQuery<any[]>(
        `SELECT COUNT(*) as active_count FROM agent_machine_licenses
         WHERE license_id = ? AND status = 'ACTIVE'`,
        [license.id]
      );
      const activeCount = Number(countResult?.active_count || 0);

      if (activeCount >= license.seat_limit) {
        return reply.code(403).send({
          error: 'SEAT_LIMIT_EXCEEDED',
          message: `All ${license.seat_limit} licensed seats are currently active on other machines. Please ask your administrator to revoke an inactive machine or purchase additional seats in SuperAdmin.`,
          licensedSeats: license.seat_limit,
          activeSeats: activeCount,
        });
      }

      // 5. Register New Machine Hardware Binding
      const newMachineId = `mach-${crypto.randomBytes(6).toString('hex')}`;
      await executeMysqlQuery(
        `INSERT INTO agent_machine_licenses (
           id, org_id, license_id, machine_fingerprint, hostname, os_platform,
           os_version, cpu_identifier, bios_uuid, mac_address, disk_serial,
           agent_token_hash, status, activated_at, last_heartbeat_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', NOW(), NOW())`,
        [
          newMachineId,
          license.org_id,
          license.id,
          machineFingerprint,
          hostname,
          osPlatform,
          osVersion,
          cpuIdentifier || 'Unknown CPU',
          biosUuid || 'Unknown BIOS',
          macAddress || '00:00:00:00:00:00',
          diskSerial || 'Unknown Disk',
          tokenHash,
        ]
      );

      // Increment active machines count
      await executeMysqlQuery(
        `UPDATE tenant_licenses SET active_machines_count = ? WHERE id = ?`,
        [activeCount + 1, license.id]
      );

      return {
        success: true,
        status: 'ACTIVATED',
        message: 'Machine successfully bound and activated! Anti-piracy certificate granted.',
        machineId: newMachineId,
        orgId: license.org_id,
        orgName: license.org_name,
        planCode: license.plan_code,
        seatNumber: activeCount + 1,
        seatLimit: license.seat_limit,
        activeSeats: activeCount + 1,
        machineToken,
        tokenExpiresAt: new Date(tokenExpiryMs).toISOString(),
        allowedModules: typeof license.allowed_features === 'string' ? JSON.parse(license.allowed_features) : license.allowed_features,
      };
    } catch (err: any) {
      req.log.error(err, 'Failed to activate machine');
      return reply.code(500).send({ error: 'ACTIVATION_FAILED', message: err.message });
    }
  });

  // 3.2 Verify Machine Token (Heartbeat Anti-Piracy Check)
  app.post('/api/v1/agent/verify-machine', async (req, reply) => {
    const body = (req.body || {}) as { machineToken?: string; machineFingerprint?: string };
    if (!body.machineToken) {
      return reply.code(400).send({ error: 'TOKEN_REQUIRED' });
    }

    const verified = verifyMachineToken(body.machineToken);
    if (!verified.valid) {
      return reply.code(401).send({ error: 'INVALID_OR_EXPIRED_TOKEN', message: 'Machine token signature invalid or expired.' });
    }

    if (body.machineFingerprint && verified.machineFingerprint !== body.machineFingerprint) {
      return reply.code(403).send({
        error: 'HWID_MISMATCH_PIRACY_DETECTED',
        message: 'Hardware fingerprint does not match the issued certificate. Cloning or VM spoofing detected.',
      });
    }

    try {
      // Check database if machine is still ACTIVE
      const [machine] = await executeMysqlQuery<any[]>(
        `SELECT aml.id, aml.status, l.status as license_status, l.expires_at, l.is_trial, l.trial_ends_at
         FROM agent_machine_licenses aml
         JOIN tenant_licenses l ON l.id = aml.license_id
         WHERE aml.org_id = ? AND aml.machine_fingerprint = ?`,
        [verified.orgId, verified.machineFingerprint]
      );

      if (!machine || machine.status === 'REVOKED') {
        return reply.code(403).send({
          error: 'MACHINE_REVOKED',
          message: 'Device has been deactivated by SuperAdmin.',
        });
      }

      if (machine.license_status === 'SUSPENDED' || new Date() > new Date(machine.expires_at)) {
        return reply.code(403).send({
          error: 'SUBSCRIPTION_ENDED',
          message: 'Organization subscription has ended.',
        });
      }

      // Update heartbeat
      await executeMysqlQuery(
        `UPDATE agent_machine_licenses SET last_heartbeat_at = NOW() WHERE id = ?`,
        [machine.id]
      );

      return {
        valid: true,
        status: 'AUTHORIZED',
        machineId: machine.id,
        orgId: verified.orgId,
      };
    } catch (err: any) {
      return reply.code(500).send({ error: 'VERIFICATION_FAILED', message: err.message });
    }
  });
}
