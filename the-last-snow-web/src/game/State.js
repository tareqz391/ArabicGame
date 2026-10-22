/** Story flags + local auto-save (offline, localStorage). */
const SAVE_KEY = 'tls.save.v1';
const SETTINGS_KEY = 'tls.settings.v1';

export const Flags = {
  _set: new Set(),
  _listeners: [],
  has(f) { return this._set.has(f); },
  set(f) {
    if (this._set.has(f)) return;
    this._set.add(f);
    for (const l of this._listeners) l(f);
  },
  clear(f) { this._set.delete(f); },
  reset() { this._set.clear(); },
  load(arr) { this._set = new Set(arr || []); },
  all() { return [...this._set]; },
  on(fn) { this._listeners.push(fn); },
};

export const Save = {
  write(checkpoint) {
    const data = { v: 1, checkpoint, flags: Flags.all(), at: new Date().toISOString() };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { console.warn('save failed', e); }
    return data;
  },
  read() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      return d && d.v === 1 ? d : null;
    } catch { return null; }
  },
  exists() { return !!this.read(); },
  wipe() { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } },
};

export const Settings = {
  _d: null,
  get() {
    if (!this._d) {
      let d = {};
      try { d = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch { d = {}; }
      this._d = Object.assign({ lang: 'ar', quality: 'auto', fps60: false, volume: 0.9 }, d);
    }
    return this._d;
  },
  set(k, v) {
    this.get()[k] = v;
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this._d)); } catch { /* ignore */ }
  },
};

/** sessionStorage can throw in sandboxed frames; fall back to window.name (survives reload). */
export const Session = {
  get(k) {
    try { const v = sessionStorage.getItem(k); if (v !== null) return v; } catch { /* sandboxed */ }
    try { return JSON.parse(window.name || '{}')[k] ?? null; } catch { return null; }
  },
  set(k, v) {
    try { sessionStorage.setItem(k, v); } catch { /* sandboxed */ }
    try { const d = JSON.parse(window.name || '{}'); d[k] = v; window.name = JSON.stringify(d); } catch { /* ignore */ }
  },
  remove(k) {
    try { sessionStorage.removeItem(k); } catch { /* sandboxed */ }
    try { const d = JSON.parse(window.name || '{}'); delete d[k]; window.name = JSON.stringify(d); } catch { /* ignore */ }
  },
};
