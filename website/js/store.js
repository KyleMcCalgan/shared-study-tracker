// Tiny in-memory store. Firestore is the source of truth; this only mirrors
// listener results for rendering. localStorage holds UI preferences only.
import { STORAGE_KEYS, PROFILE_IDS } from './config.js';

export const SERVER_TIME = Object.freeze({ __serverTime: true });

const listeners = new Set();

export const state = {
  // boot | config-missing | signing-in | auth-error | unapproved | loading | no-workspace | ready | fatal
  phase: 'boot',
  error: null,
  uid: null,
  approved: false,
  preview: false,
  profile: readProfile(),
  workspace: null,
  topics: [],
  sessions: [],
  progressById: {},
  checksById: {},
  discussions: [],
  activity: [],
  loaded: {},
  sync: {
    pending: 0, // writes not yet acknowledged by the server
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    fromCache: false,
    listenerError: null,
    lastSyncedAt: null,
    lastWriteError: null,
  },
};

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

let scheduled = false;
export function notify() {
  if (scheduled) return;
  scheduled = true;
  const run = () => { scheduled = false; for (const fn of [...listeners]) fn(state); };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run); else setTimeout(run, 0);
}

export function setState(patch) { Object.assign(state, patch); notify(); }
export function setSync(patch) { Object.assign(state.sync, patch); notify(); }

/** 'synced' | 'saving' | 'offline' | 'error' | 'connecting' */
export function syncStatus() {
  const s = state.sync;
  if (s.listenerError) return 'error';
  if (!s.online) return 'offline';
  if (s.pending > 0) return 'saving';
  if (s.fromCache) return 'connecting';
  return 'synced';
}

export function readProfile() {
  try {
    const v = localStorage.getItem(STORAGE_KEYS.profile);
    return PROFILE_IDS.includes(v) ? v : null;
  } catch { return null; }
}

export function saveProfile(profileId) {
  try {
    if (profileId) localStorage.setItem(STORAGE_KEYS.profile, profileId);
    else localStorage.removeItem(STORAGE_KEYS.profile);
  } catch { /* storage blocked: profile lasts for this tab only */ }
  setState({ profile: profileId });
}

export function readPref(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
export function writePref(key, value) {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

/** Apply a collection snapshot from a backend into the store. */
export function applyCollection(name, docs, meta = {}) {
  switch (name) {
    case 'workspace': state.workspace = docs; break;
    case 'topics': state.topics = docs; break;
    case 'sessions': state.sessions = docs; break;
    case 'discussions': state.discussions = docs; break;
    case 'activity': state.activity = docs; break;
    case 'progress': state.progressById = Object.fromEntries(docs.map((d) => [d.id, d])); break;
    case 'checks': state.checksById = Object.fromEntries(docs.map((d) => [d.id, d])); break;
    default: return;
  }
  state.loaded[name] = true;
  if (meta.fromCache === false) state.sync.lastSyncedAt = Date.now();
  if (typeof meta.fromCache === 'boolean') state.sync.fromCache = meta.fromCache;
  state.sync.listenerError = null;
  notify();
}

export const COLLECTIONS = ['workspace', 'topics', 'sessions', 'progress', 'checks', 'discussions', 'activity'];

export function allLoaded() { return COLLECTIONS.every((c) => state.loaded[c]); }
