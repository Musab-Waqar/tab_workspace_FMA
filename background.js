// background.js — service worker

importScripts('storage.js', 'space-manager.js');

// ── Keyboard shortcut ────────────────────────────────────────────────────────
chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-launcher') {
    chrome.action.openPopup().catch(() => {
      // openPopup can fail if no user gesture; silently ignore
    });
  }
});

// ── Message router ────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      switch (message.type) {
        case 'LAUNCH_SPACE':
          await launchSpace(message.id, message.options);
          sendResponse({ ok: true });
          break;
        case 'CAPTURE_CURRENT':
          sendResponse({ ok: true, tabs: await captureCurrentWindow() });
          break;
        default:
          sendResponse({ ok: false, error: 'Unknown message type' });
      }
    } catch (err) {
      sendResponse({ ok: false, error: err.message });
    }
  })();
  return true; // keep channel open for async
});

// ── Launch ────────────────────────────────────────────────────────────────────
async function launchSpace(id, overrides = {}) {
  const space = await SpaceManager.getSpaceById(id);
  if (!space) throw new Error(`Space ${id} not found`);

  const settings = { ...space.settings, ...overrides };
  const tabs = space.tabs;
  if (!tabs.length) throw new Error('Space has no tabs');

  let windowId;

  if (settings.openInNewWindow) {
    // Create window with first URL
    const win = await chrome.windows.create({
      url: tabs[0].url,
      focused: true
    });
    windowId = win.id;
    const firstTabId = win.tabs[0].id;

    // Apply pin to first tab
    if (tabs[0].pinned) await chrome.tabs.update(firstTabId, { pinned: true });

    // Open remaining tabs
    const createdTabs = [{ ...win.tabs[0], spaceTab: tabs[0] }];
    for (let i = 1; i < tabs.length; i++) {
      const tab = await chrome.tabs.create({
        windowId,
        url: tabs[i].url,
        pinned: tabs[i].pinned ?? false,
        active: false
      });
      createdTabs.push({ ...tab, spaceTab: tabs[i] });
    }

    // Apply tab groups
    if (settings.groupTabs) await applyTabGroups(createdTabs, settings, windowId);
  } else {
    // Use current window
    const [currentWindow] = await chrome.windows.getAll({ populated: false });
    windowId = currentWindow.id;

    const createdTabs = [];
    for (const tabDef of tabs) {
      const tab = await chrome.tabs.create({
        windowId,
        url: tabDef.url,
        pinned: tabDef.pinned ?? false,
        active: false
      });
      createdTabs.push({ ...tab, spaceTab: tabDef });
    }

    if (settings.groupTabs) await applyTabGroups(createdTabs, settings, windowId);
  }

  await SpaceManager.touchLastUsed(id);
}

// ── Tab Grouping ──────────────────────────────────────────────────────────────
async function applyTabGroups(createdTabs, settings, windowId) {
  // Group tabs that share a "group" label; fall back to space groupName
  const grouped = {};
  for (const tab of createdTabs) {
    const key = tab.spaceTab?.group || settings.groupName || null;
    if (!key) continue;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(tab.id);
  }

  const COLORS = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];
  let colorIdx = COLORS.indexOf(settings.groupColor ?? 'blue');
  if (colorIdx === -1) colorIdx = 0;

  for (const [label, tabIds] of Object.entries(grouped)) {
    const groupId = await chrome.tabs.group({ tabIds, createProperties: { windowId } });
    await chrome.tabGroups.update(groupId, {
      title: label,
      color: COLORS[colorIdx % COLORS.length],
      collapsed: false
    });
    colorIdx++;
  }
}

// ── Capture Current Window ────────────────────────────────────────────────────
async function captureCurrentWindow() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  return tabs.map((t) => ({
    url: t.url,
    pinned: t.pinned,
    group: null
  }));
}
