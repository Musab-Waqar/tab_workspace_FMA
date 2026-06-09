// popup.js

// ── State ──────────────────────────────────────────────────────────────────
let allSpaces = [];
let editingTabs = []; // tabs in the drawer editor

// ── Init ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await render();
  bindGlobalEvents();
});

async function render() {
  allSpaces = await SpaceManager.getAllSpaces();
  renderList(allSpaces);
}

// ── Render Space List ──────────────────────────────────────────────────────
function renderList(spaces) {
  const list = document.getElementById('spaces-list');
  const empty = document.getElementById('empty-state');
  const noResults = document.getElementById('no-results');
  const query = document.getElementById('search-input').value.trim().toLowerCase();

  const filtered = query
    ? spaces.filter((s) => s.name.toLowerCase().includes(query))
    : spaces;

  list.innerHTML = '';

  empty.hidden = !(allSpaces.length === 0 && !query);
  noResults.hidden = !(allSpaces.length > 0 && filtered.length === 0);
  list.hidden = filtered.length === 0;

  for (const space of filtered) {
    list.appendChild(buildSpaceRow(space));
  }
}

function buildSpaceRow(space) {
  const row = document.createElement('div');
  row.className = 'space-row';
  row.dataset.id = space.id;

  const tabCount = space.tabs.length;
  const lastUsedStr = space.lastUsed
    ? relativeTime(new Date(space.lastUsed))
    : 'Never used';

  row.innerHTML = `
    <span class="space-emoji">${esc(space.icon)}</span>
    <div class="space-info">
      <span class="space-name">${esc(space.name)}</span>
      <span class="space-meta">
        ${tabCount} tab${tabCount !== 1 ? 's' : ''}
        <span class="dot"></span>
        ${esc(lastUsedStr)}
      </span>
    </div>
    <div class="space-actions">
      <button class="btn-launch" data-action="launch" data-id="${esc(space.id)}">Launch</button>
      <button class="btn-row-icon" data-action="edit" data-id="${esc(space.id)}" title="Edit">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="btn-row-icon" data-action="duplicate" data-id="${esc(space.id)}" title="Duplicate">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      </button>
      <button class="btn-row-icon danger" data-action="delete" data-id="${esc(space.id)}" title="Delete">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
      </button>
    </div>
  `;

  return row;
}

// ── Global Event Delegation ────────────────────────────────────────────────
function bindGlobalEvents() {
  // Space list actions
  document.getElementById('spaces-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;

    if (action === 'launch')    await handleLaunch(id);
    if (action === 'edit')      await openDrawer(id);
    if (action === 'duplicate') await handleDuplicate(id);
    if (action === 'delete')    await confirmDelete(id);
  });

  // Search
  document.getElementById('search-input').addEventListener('input', () => {
    renderList(allSpaces);
  });

  // New space
  document.getElementById('btn-new-space').addEventListener('click', () => openDrawer(null));

  // Capture window
  document.getElementById('btn-capture').addEventListener('click', handleCapture);

  // Export all
  document.getElementById('btn-export-all').addEventListener('click', handleExportAll);

  // Import
  document.getElementById('btn-import').addEventListener('click', () => {
    document.getElementById('file-import').click();
  });
  document.getElementById('file-import').addEventListener('change', handleImport);

  // Settings
  document.getElementById('btn-settings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Drawer
  document.getElementById('drawer-close').addEventListener('click', closeDrawer);
  document.getElementById('drawer-cancel').addEventListener('click', closeDrawer);
  document.getElementById('drawer-overlay').addEventListener('click', closeDrawer);
  document.getElementById('drawer-save').addEventListener('click', handleSaveSpace);
  document.getElementById('btn-add-tab').addEventListener('click', handleAddTab);
  document.getElementById('new-tab-url').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAddTab();
  });

  // Confirm
  document.getElementById('confirm-cancel').addEventListener('click', () => {
    document.getElementById('confirm-overlay').hidden = true;
  });
}

// ── Launch ─────────────────────────────────────────────────────────────────
async function handleLaunch(id) {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'LAUNCH_SPACE', id });
    if (response.ok) {
      showToast('Space launched', 'success');
      await render();
    } else {
      showToast(response.error ?? 'Launch failed', 'error');
    }
  } catch (err) {
    showToast('Launch failed', 'error');
  }
}

// ── Duplicate ──────────────────────────────────────────────────────────────
async function handleDuplicate(id) {
  await SpaceManager.duplicateSpace(id);
  await render();
  showToast('Space duplicated');
}

// ── Delete ─────────────────────────────────────────────────────────────────
function confirmDelete(id) {
  const overlay = document.getElementById('confirm-overlay');
  const space = allSpaces.find((s) => s.id === id);
  document.getElementById('confirm-msg').textContent =
    `Delete "${space?.name ?? 'this space'}"?`;
  overlay.hidden = false;

  const okBtn = document.getElementById('confirm-ok');
  const newOk = okBtn.cloneNode(true);
  okBtn.replaceWith(newOk);
  newOk.addEventListener('click', async () => {
    overlay.hidden = true;
    await SpaceManager.deleteSpace(id);
    await render();
    showToast('Space deleted');
  });
}

// ── Capture Window ─────────────────────────────────────────────────────────
async function handleCapture() {
  const response = await chrome.runtime.sendMessage({ type: 'CAPTURE_CURRENT' });
  if (!response.ok) { showToast('Capture failed', 'error'); return; }
  openDrawer(null, { tabs: response.tabs });
}

// ── Export All ─────────────────────────────────────────────────────────────
async function handleExportAll() {
  const json = await SpaceManager.exportAll();
  downloadFile(json, 'fma-spaces-backup.json');
  showToast('Exported');
}

// ── Import ─────────────────────────────────────────────────────────────────
async function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = '';

  const text = await file.text();
  try {
    await SpaceManager.importAll(text);
    await render();
    showToast('Imported successfully', 'success');
  } catch {
    showToast('Invalid backup file', 'error');
  }
}

// ── Drawer ─────────────────────────────────────────────────────────────────
async function openDrawer(id, prefill = {}) {
  const isNew = id === null;
  document.getElementById('drawer-title').textContent = isNew ? 'New Space' : 'Edit Space';
  document.getElementById('edit-id').value = id ?? '';

  let space = null;
  if (!isNew) {
    space = await SpaceManager.getSpaceById(id);
  }

  // Prefill fields
  document.getElementById('edit-icon').value = prefill.icon ?? space?.icon ?? '';
  document.getElementById('edit-name').value = prefill.name ?? space?.name ?? '';
  document.getElementById('edit-notes').value = prefill.notes ?? space?.notes ?? '';
  document.getElementById('setting-new-window').checked =
    space?.settings?.openInNewWindow ?? true;
  document.getElementById('setting-group-tabs').checked =
    space?.settings?.groupTabs ?? true;
  document.getElementById('setting-restore-session').checked =
    space?.settings?.restoreSession ?? false;
  document.getElementById('setting-group-name').value =
    space?.settings?.groupName ?? '';

  // Tabs
  editingTabs = prefill.tabs ?? (space?.tabs ? JSON.parse(JSON.stringify(space.tabs)) : []);
  renderTabList();

  document.getElementById('drawer').hidden = false;
  document.getElementById('drawer-overlay').hidden = false;
  document.getElementById('edit-name').focus();
}

function closeDrawer() {
  document.getElementById('drawer').hidden = true;
  document.getElementById('drawer-overlay').hidden = true;
  editingTabs = [];
}

function renderTabList() {
  const list = document.getElementById('tab-list');
  list.innerHTML = '';
  editingTabs.forEach((tab, idx) => {
    const entry = document.createElement('div');
    entry.className = 'tab-entry';
    entry.innerHTML = `
      <span class="tab-entry-url" title="${esc(tab.url)}">${esc(tab.url)}</span>
      ${tab.pinned ? '<span class="tab-entry-pin">📌</span>' : ''}
      ${tab.group ? `<span class="tab-entry-group">${esc(tab.group)}</span>` : ''}
      <button class="tab-remove" data-idx="${idx}" title="Remove">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;
    list.appendChild(entry);
  });

  list.querySelectorAll('.tab-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      editingTabs.splice(parseInt(btn.dataset.idx), 1);
      renderTabList();
    });
  });
}

function handleAddTab() {
  const urlInput = document.getElementById('new-tab-url');
  const pinned = document.getElementById('new-tab-pinned').checked;
  const group = document.getElementById('new-tab-group').value.trim();
  let url = urlInput.value.trim();

  if (!url) return;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  editingTabs.push({ url, pinned, group: group || null });
  renderTabList();

  urlInput.value = '';
  document.getElementById('new-tab-pinned').checked = false;
  document.getElementById('new-tab-group').value = '';
  urlInput.focus();
}

async function handleSaveSpace() {
  const id = document.getElementById('edit-id').value || null;
  const name = document.getElementById('edit-name').value.trim();
  const icon = document.getElementById('edit-icon').value.trim() || '🌐';

  if (!name) {
    document.getElementById('edit-name').focus();
    return;
  }

  const data = {
    name,
    icon,
    tabs: editingTabs,
    notes: document.getElementById('edit-notes').value.trim(),
    settings: {
      openInNewWindow: document.getElementById('setting-new-window').checked,
      groupTabs: document.getElementById('setting-group-tabs').checked,
      restoreSession: document.getElementById('setting-restore-session').checked,
      groupName: document.getElementById('setting-group-name').value.trim()
    }
  };

  if (id) {
    await SpaceManager.updateSpace(id, data);
    showToast('Space updated', 'success');
  } else {
    await SpaceManager.createSpace(data);
    showToast('Space created', 'success');
  }

  closeDrawer();
  await render();
}

// ── Helpers ────────────────────────────────────────────────────────────────
function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast show ${type}`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.className = 'toast';
  }, 2200);
}

function downloadFile(content, filename) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function relativeTime(date) {
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return 'Just now';
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
