// ============================================================================
// @hydiems/database — Redis 7.2 Agent Presence TTL (SETEX 45s) & Pub/Sub Bus
// ============================================================================
import Redis from 'ioredis';
import { TimeState8 } from '@hydiems/shared';

export interface AgentPresencePayload {
  orgId: string;
  employeeId: string;
  deviceId: string;
  timeState: TimeState8;
  activeProcess: string;
  activeWindowTitle: string;
  activeUrlDomain?: string;
  lastHeartbeatUtc: string;
  agentVersion: string;
  sqlitePendingRows: number;
}

export const AGENT_HEARTBEAT_INTERVAL_SEC = 20;
export const AGENT_PRESENCE_TTL_SEC = 45;

let redisClient: Redis | null = null;
let redisOffline = false;

// In-memory TTL map fallback when Redis 7.2 is offline in standalone mode
const inMemoryPresenceMap = new Map<
  string,
  { payload: AgentPresencePayload; expiresAtEpochMs: number }
>();

const pubSubListeners = new Map<string, Array<(message: string) => void>>();

export function getRedisClient(): Redis {
  if (!redisClient) {
    const host = process.env.REDIS_HOST || '127.0.0.1';
    const port = Number(process.env.REDIS_PORT || 6379);
    const password = process.env.REDIS_PASSWORD || 'HydiRedis_Strong_Prod_Password_2026!';
    redisClient = new Redis({
      host,
      port,
      password,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });
    redisClient.on('error', () => {
      redisOffline = true;
    });
  }
  return redisClient;
}

export async function checkRedisHealth(): Promise<{
  connected: boolean;
  mode: 'REDIS_7_CLUSTER' | 'IN_MEMORY_TTL_STORE';
}> {
  try {
    const client = getRedisClient();
    const pong = await client.ping();
    redisOffline = pong !== 'PONG';
    return {
      connected: !redisOffline,
      mode: !redisOffline ? 'REDIS_7_CLUSTER' : 'IN_MEMORY_TTL_STORE',
    };
  } catch {
    redisOffline = true;
    return {
      connected: false,
      mode: 'IN_MEMORY_TTL_STORE',
    };
  }
}

/**
 * Records a 20s desktop agent heartbeat using `SETEX presence:{orgId}:{empId} 45 <JSON>`.
 * If the agent misses 2 consecutive heartbeats (>45s), the key expires and the employee
 * automatically transitions to OFFLINE.
 */
export async function recordAgentHeartbeatPresence(
  payload: AgentPresencePayload,
  ttlSeconds: number = AGENT_PRESENCE_TTL_SEC
): Promise<{ key: string; ttlSeconds: number; backend: string }> {
  const key = `presence:${payload.orgId}:${payload.employeeId}`;
  const serialized = JSON.stringify(payload);

  // Always update in-memory presence map for immediate local reads
  inMemoryPresenceMap.set(key, {
    payload,
    expiresAtEpochMs: Date.now() + ttlSeconds * 1000,
  });

  if (!redisOffline) {
    try {
      const client = getRedisClient();
      await client.setex(key, ttlSeconds, serialized);
      return { key, ttlSeconds, backend: 'REDIS_SETEX' };
    } catch {
      redisOffline = true;
    }
  }

  return { key, ttlSeconds, backend: 'IN_MEMORY_TTL' };
}

/**
 * Retrieves live presence for an employee. Returns null (meaning OFFLINE) if the 45s TTL expired.
 */
export async function getEmployeeLivePresence(
  orgId: string,
  employeeId: string
): Promise<AgentPresencePayload | null> {
  const key = `presence:${orgId}:${employeeId}`;

  if (!redisOffline) {
    try {
      const client = getRedisClient();
      const raw = await client.get(key);
      if (raw) {
        return JSON.parse(raw) as AgentPresencePayload;
      }
    } catch {
      redisOffline = true;
    }
  }

  const entry = inMemoryPresenceMap.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAtEpochMs) {
    inMemoryPresenceMap.delete(key);
    return null;
  }
  return entry.payload;
}

/**
 * Lists all non-expired active employee presences for an organization.
 */
export async function listOrgActivePresences(orgId: string): Promise<AgentPresencePayload[]> {
  const prefix = `presence:${orgId}:`;
  const now = Date.now();
  const active: AgentPresencePayload[] = [];

  for (const [k, v] of inMemoryPresenceMap.entries()) {
    if (k.startsWith(prefix)) {
      if (now <= v.expiresAtEpochMs) {
        active.push(v.payload);
      } else {
        inMemoryPresenceMap.delete(k);
      }
    }
  }

  return active;
}

/**
 * Publishes real-time policy/entitlement/command updates to connected WebSocket & Agent nodes.
 */
export async function publishTenantEvent(
  orgId: string,
  eventType: string,
  data: Record<string, unknown>
): Promise<void> {
  const channel = `hydiems:events:${orgId}`;
  const message = JSON.stringify({
    orgId,
    eventType,
    data,
    publishedAtUtc: new Date().toISOString(),
  });

  const localCallbacks = pubSubListeners.get(channel) ?? [];
  for (const cb of localCallbacks) {
    cb(message);
  }

  if (!redisOffline) {
    try {
      const client = getRedisClient();
      await client.publish(channel, message);
    } catch {
      redisOffline = true;
    }
  }
}

export function subscribeTenantEvents(
  orgId: string,
  callback: (message: string) => void
): () => void {
  const channel = `hydiems:events:${orgId}`;
  const list = pubSubListeners.get(channel) ?? [];
  list.push(callback);
  pubSubListeners.set(channel, list);
  return () => {
    const current = pubSubListeners.get(channel) ?? [];
    pubSubListeners.set(
      channel,
      current.filter((item) => item !== callback)
    );
  };
}
