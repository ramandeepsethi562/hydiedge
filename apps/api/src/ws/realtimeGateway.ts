// ============================================================================
// @hydiems/api — Real-Time WebSocket & WebRTC Signaling Gateway
// Covers:
//  1. Desktop Agent Presence Heartbeat (every 20s)
//  2. Instant Policy Push (< 2s latency to connected Desktop Agents)
//  3. Instant Remote Commands (CAPTURE_NOW, START_RECORDING, STOP_RECORDING,
//     START_WEBRTC_STREAM, STOP_WEBRTC_STREAM, RESTART_AGENT, FORCE_UPDATE, ROLLBACK_AGENT)
//  4. WebRTC Signaling State Machine (OFFER / ANSWER / ICE_CANDIDATE / STOP_STREAM)
//  5. 2-FPS WebP Frame Relay Fallback for Strict Corporate Firewalls (MON-003, MON-005)
// ============================================================================
import { FastifyInstance } from 'fastify';

export interface WebSocket {
  readyState: number;
  send(data: string | Buffer): void;
  on(event: 'message', listener: (data: Buffer) => void): void;
  on(event: 'close', listener: () => void): void;
  on(event: string, listener: (...args: any[]) => void): void;
}

export type AgentRemoteCommandType =
  | 'CAPTURE_NOW'
  | 'START_RECORDING'
  | 'STOP_RECORDING'
  | 'START_WEBRTC_STREAM'
  | 'STOP_WEBRTC_STREAM'
  | 'RESTART_AGENT'
  | 'FORCE_UPDATE'
  | 'ROLLBACK_AGENT';

export interface ConnectedAgentSession {
  deviceId: string;
  employeeId: string;
  orgId: string;
  agentVersion: string;
  osPlatform: string;
  currentTimeState: string;
  currentAppName: string;
  currentWindowTitle: string;
  lastHeartbeatAt: string;
  socket: WebSocket;
}

export interface LiveMonitorViewerSession {
  viewerUserId: string;
  orgId: string;
  watchedEmployeeIds: Set<string>;
  socket: WebSocket;
}

const CONNECTED_AGENTS = new Map<string, ConnectedAgentSession>(); // key: `${orgId}:${employeeId}`
const LIVE_VIEWERS = new Map<string, LiveMonitorViewerSession>();  // key: `${orgId}:${viewerUserId}`
const LIVE_AUDIO_LISTENERS = new Map<string, Set<WebSocket>>();   // key: employeeId

export function getConnectedAgentsForOrg(orgId: string): Array<Omit<ConnectedAgentSession, 'socket'>> {
  const list: Array<Omit<ConnectedAgentSession, 'socket'>> = [];
  for (const session of CONNECTED_AGENTS.values()) {
    if (session.orgId === orgId) {
      const { socket: _s, ...metadata } = session;
      list.push(metadata);
    }
  }
  return list;
}

export function dispatchAgentCommand(
  orgId: string,
  employeeId: string,
  command: AgentRemoteCommandType,
  payload: Record<string, unknown> = {}
): { delivered: boolean; sentAt: string } {
  const key = `${orgId}:${employeeId}`;
  const session = CONNECTED_AGENTS.get(key);
  const sentAt = new Date().toISOString();
  if (!session || session.socket.readyState !== 1) {
    return { delivered: false, sentAt };
  }

  session.socket.send(
    JSON.stringify({
      type: 'REMOTE_COMMAND',
      command,
      payload,
      sentAt,
    })
  );
  return { delivered: true, sentAt };
}

export function dispatchDirectAgentMessage(
  orgId: string,
  employeeId: string,
  message: Record<string, unknown>
): boolean {
  // Check exact key first
  const exactKey = `${orgId}:${employeeId}`;
  let session = CONNECTED_AGENTS.get(exactKey);
  if (!session) {
    // Fallback: search by employeeId regardless of orgId
    for (const s of CONNECTED_AGENTS.values()) {
      if (s.employeeId === employeeId) {
        session = s;
        break;
      }
    }
  }

  if (session && session.socket.readyState === 1) {
    session.socket.send(JSON.stringify(message));
    return true;
  }
  return false;
}

export function broadcastLiveAudioChunk(employeeId: string, audioData: Record<string, unknown>): number {
  const pcm = audioData.pcmBase64 || audioData.audioPcmBase64;
  if (!pcm) return 0;
  const payload = JSON.stringify({
    type: 'AUDIO_PCM_CHUNK',
    employeeId,
    ...audioData,
    pcmBase64: pcm,
    audioPcmBase64: pcm,
  });

  const targets = new Set<WebSocket>();
  const addFrom = (key?: string) => {
    if (!key) return;
    const set = LIVE_AUDIO_LISTENERS.get(key);
    if (set) {
      for (const s of set) targets.add(s);
    }
  };
  addFrom(employeeId);
  addFrom('emp-win-ramandeep');
  addFrom('*');

  let count = 0;
  for (const ws of targets) {
    if (ws.readyState === 1) {
      try {
        ws.send(payload);
        count++;
      } catch {}
    }
  }
  return count;
}

export function broadcastPolicyPushToOrg(
  orgId: string,
  policyVersion: number,
  updatedRules: unknown
): number {
  let notifiedCount = 0;
  for (const session of CONNECTED_AGENTS.values()) {
    if (session.orgId === orgId && session.socket.readyState === 1) {
      session.socket.send(
        JSON.stringify({
          type: 'POLICY_PUSH',
          policyVersion,
          updatedRules,
          pushedAt: new Date().toISOString(),
        })
      );
      notifiedCount++;
    }
  }
  return notifiedCount;
}

export async function registerRealtimeGateway(app: FastifyInstance): Promise<void> {
  // --------------------------------------------------------------------------
  // 1. Desktop Agent WebSocket Endpoint (/ws/agent)
  // --------------------------------------------------------------------------
  app.get('/ws/agent', { websocket: true }, (socket: WebSocket, req) => {
    const query = req.query as Record<string, string>;
    const orgId = query.orgId || 'org-default';
    const employeeId = query.employeeId || 'emp-unknown';
    const deviceId = query.deviceId || 'dev-unknown';
    const agentKey = `${orgId}:${employeeId}`;

    CONNECTED_AGENTS.set(agentKey, {
      deviceId,
      employeeId,
      orgId,
      agentVersion: query.version || '2.5.0',
      osPlatform: query.os || 'windows-x64',
      currentTimeState: 'WORKING',
      currentAppName: 'Desktop',
      currentWindowTitle: '',
      lastHeartbeatAt: new Date().toISOString(),
      socket,
    });

    socket.on('message', (rawBuffer: Buffer) => {
      try {
        const msg = JSON.parse(rawBuffer.toString());

        // A. 20-Second Agent Presence Heartbeat (AGENT-002, MON-001)
        if (msg.type === 'AGENT_HEARTBEAT') {
          const existing = CONNECTED_AGENTS.get(agentKey);
          if (existing) {
            existing.currentTimeState = msg.timeState || existing.currentTimeState;
            existing.currentAppName = msg.processName || existing.currentAppName;
            existing.currentWindowTitle = msg.windowTitle || existing.currentWindowTitle;
            existing.lastHeartbeatAt = new Date().toISOString();
          }

          // Broadcast live status update to all Live Monitor / Office TV viewers in this org
          for (const viewer of LIVE_VIEWERS.values()) {
            if (viewer.orgId === orgId && viewer.socket.readyState === 1) {
              viewer.socket.send(
                JSON.stringify({
                  type: 'LIVE_PRESENCE_DELTA',
                  employeeId,
                  deviceId,
                  timeState: msg.timeState,
                  processName: msg.processName,
                  windowTitle: msg.windowTitle,
                  activeMonitorCount: msg.activeMonitorCount || 1,
                  timestamp: new Date().toISOString(),
                })
              );
            }
          }

          socket.send(
            JSON.stringify({
              type: 'HEARTBEAT_ACK',
              serverTimeUtc: new Date().toISOString(),
            })
          );
        }

        // B. WebRTC Signaling Answer or ICE Candidate from Agent -> Viewer (MON-003)
        if (
          msg.type === 'WEBRTC_SIGNAL' &&
          (msg.signalType === 'ANSWER' || msg.signalType === 'ICE_CANDIDATE')
        ) {
          const targetViewerKey = `${orgId}:${msg.targetViewerUserId}`;
          const viewer = LIVE_VIEWERS.get(targetViewerKey);
          if (viewer && viewer.socket.readyState === 1) {
            viewer.socket.send(
              JSON.stringify({
                type: 'WEBRTC_SIGNAL',
                fromEmployeeId: employeeId,
                signalType: msg.signalType,
                sdpOrCandidate: msg.sdpOrCandidate,
              })
            );
          }
        }

        // C. 2-FPS WebP Frame Relay Fallback for Strict Corporate Firewalls (MON-003, MON-005)
        if (msg.type === 'WEBP_FALLBACK_FRAME') {
          for (const viewer of LIVE_VIEWERS.values()) {
            if (
              viewer.orgId === orgId &&
              viewer.watchedEmployeeIds.has(employeeId) &&
              viewer.socket.readyState === 1
            ) {
              viewer.socket.send(
                JSON.stringify({
                  type: 'WEBP_FALLBACK_FRAME',
                  employeeId,
                  monitorIndex: msg.monitorIndex ?? 0,
                  frameBase64Webp: msg.frameBase64Webp,
                  capturedAt: msg.capturedAt || new Date().toISOString(),
                })
              );
            }
          }
        }

        // D. Ultra-Low Latency Real-Time Audio Chunk from Agent -> Web Listeners
        if (msg.type === 'AUDIO_PCM_CHUNK' || msg.type === 'AUDIO_CHUNK') {
          broadcastLiveAudioChunk(employeeId, msg);
        }
      } catch {
        // Ignore malformed frame
      }
    });

    socket.on('close', () => {
      CONNECTED_AGENTS.delete(agentKey);
      for (const viewer of LIVE_VIEWERS.values()) {
        if (viewer.orgId === orgId && viewer.socket.readyState === 1) {
          viewer.socket.send(
            JSON.stringify({
              type: 'LIVE_PRESENCE_DELTA',
              employeeId,
              deviceId,
              timeState: 'OFFLINE',
              timestamp: new Date().toISOString(),
            })
          );
        }
      }
    });
  });

  // --------------------------------------------------------------------------
  // 2. Admin / Manager Live Monitor & Office TV Wallboard WebSocket (/ws/live-monitor)
  // --------------------------------------------------------------------------
  app.get('/ws/live-monitor', { websocket: true }, (socket: WebSocket, req) => {
    const query = req.query as Record<string, string>;
    const orgId = query.orgId || 'org-default';
    const viewerUserId = query.viewerUserId || 'admin-viewer';
    const viewerKey = `${orgId}:${viewerUserId}`;

    const session: LiveMonitorViewerSession = {
      viewerUserId,
      orgId,
      watchedEmployeeIds: new Set<string>(),
      socket,
    };
    LIVE_VIEWERS.set(viewerKey, session);

    // Send initial snapshot of all connected agents in this organization
    socket.send(
      JSON.stringify({
        type: 'INITIAL_AGENT_SNAPSHOT',
        agents: getConnectedAgentsForOrg(orgId),
      })
    );

    socket.on('message', (rawBuffer: Buffer) => {
      try {
        const msg = JSON.parse(rawBuffer.toString());

        // Subscribe to specific employee streams (up to 16 concurrent feeds in MON-003)
        if (msg.type === 'WATCH_EMPLOYEES' && Array.isArray(msg.employeeIds)) {
          session.watchedEmployeeIds = new Set(msg.employeeIds.slice(0, 16));
        }

        // WebRTC Signaling Offer / ICE / Stop from Viewer -> Desktop Agent
        if (msg.type === 'WEBRTC_SIGNAL' && msg.targetEmployeeId) {
          const agentSession = CONNECTED_AGENTS.get(
            `${orgId}:${msg.targetEmployeeId}`
          );
          if (agentSession && agentSession.socket.readyState === 1) {
            agentSession.socket.send(
              JSON.stringify({
                type: 'WEBRTC_SIGNAL',
                fromViewerUserId: viewerUserId,
                signalType: msg.signalType, // OFFER | ICE_CANDIDATE | STOP_STREAM
                sdpOrCandidate: msg.sdpOrCandidate,
                preferredTransport: msg.preferredTransport || 'WEBRTC_OR_WEBP_FALLBACK',
              })
            );
          }
        }

        // Remote Control Synthetic Input Forwarding (Admin -> Workstation)
        if (msg.type === 'REMOTE_INPUT_EVENT' && msg.targetEmployeeId) {
          dispatchDirectAgentMessage(orgId, msg.targetEmployeeId, {
            type: 'REMOTE_INPUT_EVENT',
            event: msg.event,
            sentAt: new Date().toISOString(),
          });
        }
      } catch {
        // Ignore malformed message
      }
    });

    socket.on('close', () => {
      LIVE_VIEWERS.delete(viewerKey);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Ultra-Low Latency HD Audio Real-Time WebSocket (/ws/live-audio)
  // --------------------------------------------------------------------------
  app.get('/ws/live-audio', { websocket: true }, (socket: WebSocket, req) => {
    const query = req.query as Record<string, string>;
    const employeeId = query.employeeId || 'emp-win-ramandeep';
    let set = LIVE_AUDIO_LISTENERS.get(employeeId);
    if (!set) {
      set = new Set<WebSocket>();
      LIVE_AUDIO_LISTENERS.set(employeeId, set);
    }
    set.add(socket);

    socket.on('close', () => {
      set?.delete(socket);
    });
  });
}
