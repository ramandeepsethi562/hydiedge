// ============================================================================
// @hydiems/api — Multi-Tenant Isolation, JWT Auth, RBAC Matrix, 9 Sensitive Gates
// & Audited Super Admin Impersonation Middleware (PERM-001, PERM-002, SUPER-003, SEC-005)
// ============================================================================
import { FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'crypto';
import {
  hasModulePermission,
  hasSensitiveGateAccess,
  ModuleKey,
  PermissionVerb,
  SensitivePermissionGate,
  SystemRole,
} from '@hydiems/shared';

export interface JwtUserPayload {
  userId: string;
  orgId: string;
  email: string;
  role: SystemRole;
  employeeId?: string;
  deptId?: string;
  teamId?: string;
  explicitSensitiveGates?: SensitivePermissionGate[];
  impersonatorAdminId?: string;
  impersonationReason?: string;
  mfaVerified: boolean;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtUserPayload;
    user: JwtUserPayload;
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    tenantOrgId: string;
    impersonationContext?: {
      isImpersonated: boolean;
      superAdminUserId: string;
      reason: string;
    };
  }
}

export interface ImmutableAuditEntry {
  auditId: string;
  orgId: string;
  actorUserId: string;
  actorRole: SystemRole;
  impersonatorId?: string;
  actionCategory: string;
  actionType: string;
  targetEntityType?: string;
  targetEntityId?: string;
  reasonProvided?: string;
  ipAddress: string;
  prevRecordHash: string;
  recordHash: string;
  createdAt: string;
}

// In-memory cryptographic hash chain store (persisted to audit_logs_immutable in PostgreSQL)
const LAST_AUDIT_HASH_BY_ORG = new Map<string, string>();
export const IMMUTABLE_AUDIT_LOG_STORE: ImmutableAuditEntry[] = [];

export function appendImmutableAuditLog(params: {
  orgId: string;
  actorUserId: string;
  actorRole: SystemRole;
  impersonatorId?: string;
  actionCategory: string;
  actionType: string;
  targetEntityType?: string;
  targetEntityId?: string;
  reasonProvided?: string;
  ipAddress: string;
}): ImmutableAuditEntry {
  const prevRecordHash =
    LAST_AUDIT_HASH_BY_ORG.get(params.orgId) || '0'.repeat(64);
  const createdAt = new Date().toISOString();
  const payloadToHash = JSON.stringify({
    orgId: params.orgId,
    actorUserId: params.actorUserId,
    impersonatorId: params.impersonatorId || null,
    actionCategory: params.actionCategory,
    actionType: params.actionType,
    targetEntityId: params.targetEntityId || null,
    reasonProvided: params.reasonProvided || null,
    createdAt,
    prevRecordHash,
  });
  const recordHash = crypto
    .createHash('sha256')
    .update(payloadToHash)
    .digest('hex');

  LAST_AUDIT_HASH_BY_ORG.set(params.orgId, recordHash);

  const entry: ImmutableAuditEntry = {
    auditId: crypto.randomUUID(),
    ...params,
    prevRecordHash,
    recordHash,
    createdAt,
  };
  IMMUTABLE_AUDIT_LOG_STORE.unshift(entry);
  if (IMMUTABLE_AUDIT_LOG_STORE.length > 5000) {
    IMMUTABLE_AUDIT_LOG_STORE.pop();
  }
  return entry;
}

export function verifyOrgAuditHashChain(orgId: string): {
  orgId: string;
  verifiedCount: number;
  chainIntact: boolean;
  headHash: string;
} {
  const orgEntries = IMMUTABLE_AUDIT_LOG_STORE.filter((e) => e.orgId === orgId).reverse();
  let expectedPrev = '0'.repeat(64);
  for (const entry of orgEntries) {
    if (entry.prevRecordHash !== expectedPrev) {
      return {
        orgId,
        verifiedCount: orgEntries.length,
        chainIntact: false,
        headHash: LAST_AUDIT_HASH_BY_ORG.get(orgId) || expectedPrev,
      };
    }
    expectedPrev = entry.recordHash;
  }
  return {
    orgId,
    verifiedCount: orgEntries.length,
    chainIntact: true,
    headHash: LAST_AUDIT_HASH_BY_ORG.get(orgId) || '0'.repeat(64),
  };
}

/**
 * Verifies JWT, enforces Tenant Isolation (req.tenantOrgId), and handles
 * Super Admin Audited Impersonation (SUPER-003).
 */
export async function requireAuth(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    await req.jwtVerify();
  } catch {
    reply.code(401).send({
      error: 'UNAUTHORIZED',
      message: 'Valid Bearer JWT token is required.',
    });
    return;
  }

  const user = req.user;
  if (!user || !user.orgId) {
    reply.code(401).send({
      error: 'INVALID_TOKEN_CLAIMS',
      message: 'Token missing tenant organization context.',
    });
    return;
  }

  // Check Super Admin Audited Impersonation header or token claim (SUPER-003)
  const impersonateOrgHeader = req.headers['x-hydi-impersonate-org'] as
    | string
    | undefined;
  const impersonationReasonHeader = req.headers['x-hydi-impersonation-reason'] as
    | string
    | undefined;

  if (impersonateOrgHeader && user.role === 'SUPER_ADMIN') {
    if (!impersonationReasonHeader || impersonationReasonHeader.trim().length < 5) {
      reply.code(403).send({
        error: 'IMPERSONATION_REASON_REQUIRED',
        message:
          'Super Admin tenant impersonation requires an explicit audit reason in X-Hydi-Impersonation-Reason.',
      });
      return;
    }
    req.tenantOrgId = impersonateOrgHeader;
    req.impersonationContext = {
      isImpersonated: true,
      superAdminUserId: user.userId,
      reason: impersonationReasonHeader,
    };
    appendImmutableAuditLog({
      orgId: impersonateOrgHeader,
      actorUserId: user.userId,
      actorRole: 'SUPER_ADMIN',
      impersonatorId: user.userId,
      actionCategory: 'SUPER_ADMIN_IMPERSONATION',
      actionType: `${req.method} ${req.url}`,
      reasonProvided: impersonationReasonHeader,
      ipAddress: req.ip,
    });
  } else {
    req.tenantOrgId = user.orgId;
    if (user.impersonatorAdminId) {
      req.impersonationContext = {
        isImpersonated: true,
        superAdminUserId: user.impersonatorAdminId,
        reason: user.impersonationReason || 'Support Session',
      };
    }
  }
}

/**
 * Enforces TOTP MFA verification for privileged actions (AUTH-003).
 */
export function requireMfaVerified() {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!req.user) {
      await requireAuth(req, reply);
      if (reply.sent) return;
    }
    if (!req.user.mfaVerified) {
      reply.code(403).send({
        error: 'MFA_VERIFICATION_REQUIRED',
        message: 'Multi-factor authentication (TOTP) must be verified for this operation.',
      });
    }
  };
}

/**
 * Factory middleware enforcing the 33-Module x 8-Action x 9-Role Permission Matrix (PERM-001).
 */
export function requirePermission(moduleKey: ModuleKey, verb: PermissionVerb) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!req.user) {
      await requireAuth(req, reply);
      if (reply.sent) return;
    }

    const allowed = hasModulePermission(req.user.role, moduleKey, verb);
    if (!allowed) {
      reply.code(403).send({
        error: 'RBAC_PERMISSION_DENIED',
        moduleKey,
        requiredVerb: verb,
        actorRole: req.user.role,
        message: `Role ${req.user.role} lacks ${verb} permission on module ${moduleKey}.`,
      });
    }
  };
}

/**
 * Factory middleware enforcing the 9 Sensitive Permission Gates (PERM-002).
 * Automatically writes a cryptographic SHA-256 hash-chained audit record.
 */
export function requireSensitiveGate(gate: SensitivePermissionGate) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!req.user) {
      await requireAuth(req, reply);
      if (reply.sent) return;
    }

    const allowed = hasSensitiveGateAccess(
      req.user.role,
      gate,
      req.user.explicitSensitiveGates
    );

    if (!allowed) {
      appendImmutableAuditLog({
        orgId: req.tenantOrgId,
        actorUserId: req.user.userId,
        actorRole: req.user.role,
        actionCategory: 'SENSITIVE_GATE_DENIED',
        actionType: gate,
        ipAddress: req.ip,
      });
      reply.code(403).send({
        error: 'SENSITIVE_GATE_LOCKED',
        gate,
        message: `Access to sensitive gate ${gate} is restricted and has been logged.`,
      });
      return;
    }

    appendImmutableAuditLog({
      orgId: req.tenantOrgId,
      actorUserId: req.user.userId,
      actorRole: req.user.role,
      impersonatorId: req.impersonationContext?.superAdminUserId,
      actionCategory: 'SENSITIVE_GATE_ACCESSED',
      actionType: gate,
      reasonProvided:
        (req.headers['x-hydi-audit-reason'] as string | undefined) ||
        req.impersonationContext?.reason,
      ipAddress: req.ip,
    });
  };
}
