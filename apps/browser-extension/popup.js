/**
 * HydiEms Browser Extension Popup Controller (EXT-001)
 * Uses async/await messaging with background service worker and zero inline scripts.
 */

function formatDurationHms(totalSeconds) {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return [hrs, mins, secs].map((v) => String(v).padStart(2, '0')).join(':');
}

function formatDurationShort(totalSeconds) {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

function renderPopupSnapshot(snapshot) {
  if (!snapshot || !snapshot.ok) return;

  const { trackingState, todayStats, tasks, queuedSlices } = snapshot;
  const statusBadge = document.getElementById('statusBadge');
  const toggleTimerBtn = document.getElementById('toggleTimerBtn');
  const toggleBreakBtn = document.getElementById('toggleBreakBtn');
  const togglePersonalModeBtn = document.getElementById('togglePersonalModeBtn');

  if (trackingState.isPersonalMode) {
    statusBadge.textContent = 'PERSONAL SHIELD';
    statusBadge.style.color = '#818cf8';
    togglePersonalModeBtn.textContent = 'Exit Personal';
    toggleTimerBtn.textContent = 'Start Work';
  } else if (trackingState.isOnBreak) {
    statusBadge.textContent = `BREAK (${trackingState.breakReason})`;
    statusBadge.style.color = '#fbbf24';
    toggleBreakBtn.textContent = 'End Break';
    toggleTimerBtn.textContent = 'Resume';
  } else if (trackingState.isRunning) {
    statusBadge.textContent = 'TRACKING';
    statusBadge.style.color = '#10b981';
    toggleTimerBtn.textContent = 'Pause';
    toggleBreakBtn.textContent = 'Take Break';
    togglePersonalModeBtn.textContent = 'Personal Mode';
  } else {
    statusBadge.textContent = 'PAUSED';
    statusBadge.style.color = '#94a3b8';
    toggleTimerBtn.textContent = 'Start';
  }

  const stats = todayStats || { productiveSeconds: 0, neutralSeconds: 0, nonProductiveSeconds: 0 };
  const totalSec = Math.max(
    1,
    stats.productiveSeconds + stats.neutralSeconds + stats.nonProductiveSeconds
  );

  document.getElementById('timerDisplay').textContent = formatDurationHms(totalSec);

  const prodPct = Math.round((stats.productiveSeconds / totalSec) * 100);
  const neutPct = Math.round((stats.neutralSeconds / totalSec) * 100);
  const unprodPct = Math.max(0, 100 - prodPct - neutPct);

  document.getElementById('productivePctLabel').textContent = `${prodPct}% Prod`;
  document.getElementById('barProductive').style.width = `${prodPct}%`;
  document.getElementById('barNeutral').style.width = `${neutPct}%`;
  document.getElementById('barNonProductive').style.width = `${unprodPct}%`;

  document.getElementById('legendProd').textContent = `Prod: ${formatDurationShort(stats.productiveSeconds)}`;
  document.getElementById('legendNeut').textContent = `Neutral: ${formatDurationShort(stats.neutralSeconds)}`;
  document.getElementById('legendUnprod').textContent = `Unprod: ${formatDurationShort(stats.nonProductiveSeconds)}`;

  const taskSelect = document.getElementById('taskSelect');
  taskSelect.replaceChildren();
  for (const t of tasks || []) {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = `[${t.project}] ${t.title}`;
    if (t.id === trackingState.activeTaskId) {
      opt.selected = true;
    }
    taskSelect.appendChild(opt);
  }

  document.getElementById('spoolInfo').textContent = `Spool: ${queuedSlices || 0} slices queued`;
}

async function refreshSnapshot() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_POPUP_SNAPSHOT' });
    renderPopupSnapshot(response);
  } catch (err) {
    console.error('Failed to load popup snapshot:', err);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await refreshSnapshot();

  document.getElementById('toggleTimerBtn').addEventListener('click', async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'TOGGLE_TIMER' });
      await refreshSnapshot();
    } catch (err) {
      console.error('Toggle timer failed:', err);
    }
  });

  document.getElementById('togglePersonalModeBtn').addEventListener('click', async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'TOGGLE_PERSONAL_MODE' });
      await refreshSnapshot();
    } catch (err) {
      console.error('Toggle personal mode failed:', err);
    }
  });

  document.getElementById('toggleBreakBtn').addEventListener('click', async () => {
    try {
      await chrome.runtime.sendMessage({
        type: 'TOGGLE_BREAK_MODE',
        breakReason: 'COFFEE_REST'
      });
      await refreshSnapshot();
    } catch (err) {
      console.error('Toggle break mode failed:', err);
    }
  });

  document.getElementById('taskSelect').addEventListener('change', async (e) => {
    try {
      await chrome.runtime.sendMessage({
        type: 'SELECT_TASK',
        taskId: e.target.value
      });
      await refreshSnapshot();
    } catch (err) {
      console.error('Select task failed:', err);
    }
  });

  document.getElementById('addQuickTaskBtn').addEventListener('click', async () => {
    try {
      const input = document.getElementById('quickTaskInput');
      const title = input.value.trim();
      if (!title) return;
      input.value = '';
      await chrome.runtime.sendMessage({
        type: 'CREATE_QUICK_TASK',
        title,
        project: 'PRJ-QUICK'
      });
      await refreshSnapshot();
    } catch (err) {
      console.error('Create quick task failed:', err);
    }
  });

  document.getElementById('openConsoleBtn').addEventListener('click', async () => {
    try {
      await chrome.tabs.create({ url: 'http://localhost:3000/employee/overview' });
    } catch (err) {
      console.error('Open web console failed:', err);
    }
  });
});
