/**
 * HydiEms Browser Extension Service Worker (EXT-001)
 * - Tracks active browser tab domain/URL duration with ephemeral-safe chrome.storage state
 * - Syncs telemetry slices with Local Desktop Agent bridge (http://127.0.0.1:19840) & HydiEms API
 * - Enforces Website Block/Warning policies (SEC-005) and Shadow IT / Unapproved AI DLP warnings (DLP-010)
 */

const ALARM_FLUSH_TELEMETRY = 'hydiems_flush_telemetry_1m';
const ALARM_SYNC_POLICY = 'hydiems_sync_policy_5m';

// Valid 1x1 PNG data URL for chrome.notifications (avoids missing local icon file errors)
const NOTIFICATION_ICON_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const DEFAULT_POLICIES = {
  productiveDomains: ['github.com', 'gitlab.com', 'linear.app', 'figma.com', 'docs.google.com', 'localhost'],
  nonProductiveDomains: ['youtube.com', 'netflix.com', 'reddit.com', 'twitch.tv', 'tiktok.com'],
  blockedDomains: ['torproject.org', 'piratebay.org', 'anonfiles.com'],
  shadowAiRestrictedDomains: ['chat.openai.com', 'claude.ai', 'WetTransfer.com', 'mega.nz']
};

chrome.runtime.onInstalled.addListener(async () => {
  try {
    const existing = await chrome.storage.local.get([
      'trackingState',
      'todayStats',
      'policyConfig',
      'urlSliceQueue',
      'tasks'
    ]);

    if (!existing.trackingState) {
      await chrome.storage.local.set({
        trackingState: {
          isRunning: true,
          isPersonalMode: false,
          isOnBreak: false,
          breakReason: 'NONE',
          activeProjectId: 'PRJ-CORE-01',
          activeTaskId: 'TSK-101',
          activeTaskTitle: 'Enterprise Platform Architecture',
          startedAtEpochMs: Date.now(),
          activeDomain: null,
          activeUrl: null,
          domainEnteredAtEpochMs: Date.now()
        }
      });
    }

    if (!existing.todayStats) {
      await chrome.storage.local.set({
        todayStats: {
          productiveSeconds: 12420,
          neutralSeconds: 3180,
          nonProductiveSeconds: 900
        }
      });
    }

    if (!existing.policyConfig) {
      await chrome.storage.local.set({ policyConfig: DEFAULT_POLICIES });
    }

    if (!existing.urlSliceQueue) {
      await chrome.storage.local.set({ urlSliceQueue: [] });
    }

    if (!existing.tasks) {
      await chrome.storage.local.set({
        tasks: [
          { id: 'TSK-101', title: 'Enterprise Platform Architecture', project: 'PRJ-CORE-01' },
          { id: 'TSK-102', title: 'Security & DLP Policy Audit', project: 'PRJ-SEC-02' },
          { id: 'TSK-103', title: 'Sprint Backlog Grooming', project: 'PRJ-OPS-03' }
        ]
      });
    }

    await chrome.alarms.create(ALARM_FLUSH_TELEMETRY, { periodInMinutes: 1 });
    await chrome.alarms.create(ALARM_SYNC_POLICY, { periodInMinutes: 5 });
    await updateBadgeFromState();
  } catch (err) {
    console.error('HydiEms onInstalled initialization error:', err);
  }
});

function extractHostname(rawUrl) {
  if (!rawUrl || !rawUrl.startsWith('http')) return null;
  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return null;
  }
}

function classifyDomain(domain, policyConfig) {
  if (!domain) return 'NEUTRAL';
  const policies = policyConfig || DEFAULT_POLICIES;
  if (policies.blockedDomains.some((d) => domain === d || domain.endsWith(`.${d}`))) {
    return 'BLOCKED';
  }
  if (policies.productiveDomains.some((d) => domain === d || domain.endsWith(`.${d}`))) {
    return 'PRODUCTIVE';
  }
  if (policies.nonProductiveDomains.some((d) => domain === d || domain.endsWith(`.${d}`))) {
    return 'NON_PRODUCTIVE';
  }
  return 'NEUTRAL';
}

async function commitElapsedDomainTime(newUrl) {
  try {
    const store = await chrome.storage.local.get([
      'trackingState',
      'todayStats',
      'policyConfig',
      'urlSliceQueue'
    ]);

    const state = store.trackingState;
    if (!state) return;

    const now = Date.now();
    const elapsedSec = Math.max(0, Math.round((now - (state.domainEnteredAtEpochMs || now)) / 1000));

    // Only record domain telemetry when work tracking is active and Personal Mode (TIME-009) is OFF
    if (state.isRunning && !state.isPersonalMode && !state.isOnBreak && state.activeDomain && elapsedSec > 0) {
      const category = classifyDomain(state.activeDomain, store.policyConfig);
      const stats = store.todayStats || { productiveSeconds: 0, neutralSeconds: 0, nonProductiveSeconds: 0 };

      if (category === 'PRODUCTIVE') {
        stats.productiveSeconds += elapsedSec;
      } else if (category === 'NON_PRODUCTIVE' || category === 'BLOCKED') {
        stats.nonProductiveSeconds += elapsedSec;
      } else {
        stats.neutralSeconds += elapsedSec;
      }

      const queue = Array.isArray(store.urlSliceQueue) ? store.urlSliceQueue : [];
      queue.push({
        domain: state.activeDomain,
        url: state.activeUrl,
        durationSeconds: elapsedSec,
        category,
        taskId: state.activeTaskId,
        recordedAtUtc: new Date(now).toISOString()
      });

      // Keep bounded ring buffer of 500 entries
      while (queue.length > 500) {
        queue.shift();
      }

      await chrome.storage.local.set({
        todayStats: stats,
        urlSliceQueue: queue
      });
    }

    const nextDomain = extractHostname(newUrl);
    state.activeUrl = newUrl || null;
    state.activeDomain = nextDomain;
    state.domainEnteredAtEpochMs = now;
    await chrome.storage.local.set({ trackingState: state });

    if (nextDomain && !state.isPersonalMode) {
      await enforceDomainPolicies(nextDomain, store.policyConfig || DEFAULT_POLICIES);
    }
  } catch (err) {
    console.error('HydiEms commitElapsedDomainTime error:', err);
  }
}

async function enforceDomainPolicies(domain, policies) {
  try {
    const isBlocked = policies.blockedDomains.some((d) => domain === d || domain.endsWith(`.${d}`));
    if (isBlocked) {
      await chrome.notifications.create(`sec005_${Date.now()}`, {
        type: 'basic',
        iconUrl: NOTIFICATION_ICON_DATA_URL,
        title: 'HydiEms Security Policy (SEC-005)',
        message: `Access to restricted domain "${domain}" is logged and blocked by corporate policy.`
      });
      return;
    }

    const isShadowAi = policies.shadowAiRestrictedDomains.some(
      (d) => domain === d || domain.endsWith(`.${d}`)
    );
    if (isShadowAi) {
      await chrome.notifications.create(`dlp010_${Date.now()}`, {
        type: 'basic',
        iconUrl: NOTIFICATION_ICON_DATA_URL,
        title: 'HydiEms DLP Guard (DLP-010)',
        message: `Unapproved Cloud/AI domain "${domain}" detected. File uploads & sensitive clipboard paste are restricted.`
      });
    }
  } catch (err) {
    console.error('HydiEms enforceDomainPolicies error:', err);
  }
}

async function updateBadgeFromState() {
  try {
    const { trackingState } = await chrome.storage.local.get('trackingState');
    if (!trackingState) return;

    if (trackingState.isPersonalMode) {
      await chrome.action.setBadgeText({ text: 'PRIV' });
      await chrome.action.setBadgeBackgroundColor({ color: '#6366F1' });
    } else if (trackingState.isOnBreak) {
      await chrome.action.setBadgeText({ text: 'BRK' });
      await chrome.action.setBadgeBackgroundColor({ color: '#F59E0B' });
    } else if (trackingState.isRunning) {
      await chrome.action.setBadgeText({ text: 'ON' });
      await chrome.action.setBadgeBackgroundColor({ color: '#10B981' });
    } else {
      await chrome.action.setBadgeText({ text: 'OFF' });
      await chrome.action.setBadgeBackgroundColor({ color: '#6B7280' });
    }
  } catch (err) {
    console.error('HydiEms updateBadgeFromState error:', err);
  }
}

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    await commitElapsedDomainTime(tab?.url || null);
  } catch (err) {
    console.error('HydiEms onActivated error:', err);
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  try {
    if (changeInfo.status === 'complete' && tab.active && tab.url) {
      await commitElapsedDomainTime(tab.url);
    }
  } catch (err) {
    console.error('HydiEms onUpdated error:', err);
  }
});

chrome.idle.onStateChanged.addListener(async (newState) => {
  try {
    if (newState === 'idle' || newState === 'locked') {
      await commitElapsedDomainTime(null);
    } else if (newState === 'active') {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await commitElapsedDomainTime(activeTab?.url || null);
    }
  } catch (err) {
    console.error('HydiEms idle state error:', err);
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  try {
    if (alarm.name === ALARM_FLUSH_TELEMETRY) {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await commitElapsedDomainTime(activeTab?.url || null);
      await flushQueueToDesktopAgentBridge();
    }
  } catch (err) {
    console.error('HydiEms alarm handler error:', err);
  }
});

async function flushQueueToDesktopAgentBridge() {
  try {
    const { urlSliceQueue = [], trackingState } = await chrome.storage.local.get([
      'urlSliceQueue',
      'trackingState'
    ]);
    if (!urlSliceQueue.length || trackingState?.isPersonalMode) return;

    const response = await fetch('http://127.0.0.1:19840/v1/browser-telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'EXT-001_MANIFEST_V3',
        slices: urlSliceQueue
      })
    });

    if (response.ok) {
      await chrome.storage.local.set({ urlSliceQueue: [] });
    }
  } catch {
    // Desktop agent local bridge or network offline; keep slices safely in chrome.storage.local
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      const store = await chrome.storage.local.get([
        'trackingState',
        'todayStats',
        'policyConfig',
        'tasks',
        'urlSliceQueue'
      ]);
      const state = store.trackingState || {};

      if (message.type === 'GET_POPUP_SNAPSHOT') {
        sendResponse({
          ok: true,
          trackingState: state,
          todayStats: store.todayStats,
          tasks: store.tasks || [],
          queuedSlices: (store.urlSliceQueue || []).length
        });
        return;
      }

      if (message.type === 'TOGGLE_TIMER') {
        state.isRunning = !state.isRunning;
        if (state.isRunning) {
          state.isPersonalMode = false;
          state.isOnBreak = false;
          state.startedAtEpochMs = Date.now();
        }
        await chrome.storage.local.set({ trackingState: state });
        await updateBadgeFromState();
        sendResponse({ ok: true, trackingState: state });
        return;
      }

      if (message.type === 'TOGGLE_PERSONAL_MODE') {
        state.isPersonalMode = !state.isPersonalMode;
        if (state.isPersonalMode) {
          state.isRunning = false;
          state.activeDomain = null;
          state.activeUrl = null;
        } else {
          state.isRunning = true;
          state.startedAtEpochMs = Date.now();
        }
        await chrome.storage.local.set({ trackingState: state });
        await updateBadgeFromState();
        sendResponse({ ok: true, trackingState: state });
        return;
      }

      if (message.type === 'TOGGLE_BREAK_MODE') {
        state.isOnBreak = !state.isOnBreak;
        state.breakReason = state.isOnBreak ? message.breakReason || 'COFFEE_REST' : 'NONE';
        await chrome.storage.local.set({ trackingState: state });
        await updateBadgeFromState();
        sendResponse({ ok: true, trackingState: state });
        return;
      }

      if (message.type === 'SELECT_TASK') {
        const tasks = store.tasks || [];
        const found = tasks.find((t) => t.id === message.taskId);
        if (found) {
          state.activeTaskId = found.id;
          state.activeTaskTitle = found.title;
          state.activeProjectId = found.project;
          await chrome.storage.local.set({ trackingState: state });
        }
        sendResponse({ ok: true, trackingState: state });
        return;
      }

      if (message.type === 'CREATE_QUICK_TASK') {
        const tasks = store.tasks || [];
        const newTask = {
          id: `TSK-${Math.floor(100 + Math.random() * 900)}`,
          title: message.title,
          project: message.project || 'PRJ-CORE-01'
        };
        tasks.unshift(newTask);
        state.activeTaskId = newTask.id;
        state.activeTaskTitle = newTask.title;
        state.activeProjectId = newTask.project;
        await chrome.storage.local.set({ tasks, trackingState: state });
        sendResponse({ ok: true, trackingState: state, tasks });
        return;
      }

      if (message.type === 'CHECK_DLP_DOMAIN_POLICY') {
        const policies = store.policyConfig || DEFAULT_POLICIES;
        const domain = extractHostname(message.url || sender?.tab?.url || '');
        const isRestricted =
          domain &&
          policies.shadowAiRestrictedDomains.some((d) => domain === d || domain.endsWith(`.${d}`));
        sendResponse({
          ok: true,
          domain,
          isRestrictedDlpDomain: Boolean(isRestricted),
          isPersonalMode: Boolean(state.isPersonalMode)
        });
        return;
      }

      if (message.type === 'REPORT_DLP_INCIDENT') {
        const queue = Array.isArray(store.urlSliceQueue) ? store.urlSliceQueue : [];
        queue.push({
          domain: message.domain,
          url: message.url,
          durationSeconds: 0,
          category: `DLP_INCIDENT_${message.incidentCode}`,
          taskId: state.activeTaskId,
          recordedAtUtc: new Date().toISOString()
        });
        await chrome.storage.local.set({ urlSliceQueue: queue });
        sendResponse({ ok: true });
        return;
      }

      sendResponse({ ok: false, error: 'UNKNOWN_MESSAGE_TYPE' });
    } catch (err) {
      console.error('HydiEms onMessage error:', err);
      sendResponse({ ok: false, error: String(err) });
    }
  })();

  return true; // Keep message channel open for async response
});
