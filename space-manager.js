// space-manager.js — CRUD operations on Spaces

const SPACES_KEY = 'spaces';
const SETTINGS_KEY = 'settings';

const DEFAULT_SETTINGS = {
  defaultOpenInNewWindow: true,
  showDock: false,
  keyboardShortcut: 'Alt+Shift+S'
};

const SpaceManager = {
  // ── Read ──────────────────────────────────────────────────────────────────

  async getAllSpaces() {
    const spaces = await Storage.get(SPACES_KEY);
    return spaces ?? [];
  },

  async getSpaceById(id) {
    const spaces = await this.getAllSpaces();
    return spaces.find((s) => s.id === id) ?? null;
  },

  async getSettings() {
    const settings = await Storage.get(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...settings };
  },

  // ── Write ─────────────────────────────────────────────────────────────────

  async saveAllSpaces(spaces) {
    await Storage.set(SPACES_KEY, spaces);
  },

  async saveSettings(settings) {
    const current = await this.getSettings();
    await Storage.set(SETTINGS_KEY, { ...current, ...settings });
  },

  // ── Create ────────────────────────────────────────────────────────────────

  async createSpace(data) {
    const spaces = await this.getAllSpaces();
    const newSpace = {
      id: crypto.randomUUID(),
      name: data.name ?? 'New Space',
      icon: data.icon ?? '🌐',
      tabs: data.tabs ?? [],
      settings: {
        openInNewWindow: data.settings?.openInNewWindow ?? true,
        restoreSession: data.settings?.restoreSession ?? false,
        groupTabs: data.settings?.groupTabs ?? true,
        groupName: data.settings?.groupName ?? '',
        groupColor: data.settings?.groupColor ?? 'blue'
      },
      notes: data.notes ?? '',
      lastUsed: null,
      createdAt: new Date().toISOString()
    };
    spaces.push(newSpace);
    await this.saveAllSpaces(spaces);
    return newSpace;
  },

  // ── Update ────────────────────────────────────────────────────────────────

  async updateSpace(id, updates) {
    const spaces = await this.getAllSpaces();
    const idx = spaces.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    spaces[idx] = { ...spaces[idx], ...updates };
    await this.saveAllSpaces(spaces);
    return spaces[idx];
  },

  async touchLastUsed(id) {
    return this.updateSpace(id, { lastUsed: new Date().toISOString() });
  },

  // ── Delete ────────────────────────────────────────────────────────────────

  async deleteSpace(id) {
    const spaces = await this.getAllSpaces();
    const filtered = spaces.filter((s) => s.id !== id);
    await this.saveAllSpaces(filtered);
  },

  // ── Duplicate ─────────────────────────────────────────────────────────────

  async duplicateSpace(id) {
    const space = await this.getSpaceById(id);
    if (!space) return null;
    return this.createSpace({
      ...space,
      name: `${space.name} (copy)`
    });
  },

  // ── Reorder ───────────────────────────────────────────────────────────────

  async reorderSpaces(orderedIds) {
    const spaces = await this.getAllSpaces();
    const map = Object.fromEntries(spaces.map((s) => [s.id, s]));
    const reordered = orderedIds.map((id) => map[id]).filter(Boolean);
    await this.saveAllSpaces(reordered);
  },

  // ── Import / Export ───────────────────────────────────────────────────────

  async exportAll() {
    const spaces = await this.getAllSpaces();
    const settings = await this.getSettings();
    return JSON.stringify({ spaces, settings }, null, 2);
  },

  async importAll(jsonString) {
    const data = JSON.parse(jsonString);
    if (!Array.isArray(data.spaces)) throw new Error('Invalid backup format');
    await Storage.set(SPACES_KEY, data.spaces);
    if (data.settings) await Storage.set(SETTINGS_KEY, data.settings);
  },

  async exportSpace(id) {
    const space = await this.getSpaceById(id);
    if (!space) throw new Error('Space not found');
    return JSON.stringify(space, null, 2);
  },

  async importSpace(jsonString) {
    const data = JSON.parse(jsonString);
    data.id = crypto.randomUUID(); // always assign fresh id on import
    data.createdAt = new Date().toISOString();
    data.lastUsed = null;
    const spaces = await this.getAllSpaces();
    spaces.push(data);
    await this.saveAllSpaces(spaces);
    return data;
  }
};
