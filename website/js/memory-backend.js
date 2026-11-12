// Local preview backend (localhost only). Loads the committed seed snapshot
// into memory so the UI can be exercised and smoke-tested without Firebase.
// Nothing is persisted; a banner makes that clear. Never used on GitHub Pages.
import { SERVER_TIME } from './store.js';

export function isPreviewAllowed(loc = window.location) {
  return ['localhost', '127.0.0.1'].includes(loc.hostname) && new URLSearchParams(loc.search).has('preview');
}

export async function createMemoryBackend(mode) {
  if (mode === 'error') {
    return {
      kind: 'memory',
      watchAuth: (cb, onError) => { setTimeout(() => onError(Object.assign(new Error('Simulated network failure'), { code: 'auth/network-request-failed' })), 50); return () => {}; },
    };
  }
  const res = await fetch('../data/seed-schedule.json', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Could not load seed (${res.status})`);
  const seed = await res.json();
  const now = Date.now();
  const db = {
    workspace: mode === 'empty' ? null : { id: seed.workspaceId, ...seed.workspace },
    topics: mode === 'empty' ? [] : seed.topics.map((t) => ({ ...t })),
    sessions: mode === 'empty' ? [] : seed.sessions.map((s) => ({ ...s, updatedAt: now })),
    discussions: mode === 'empty' ? [] : seed.discussions.map((d) => ({ ...d, createdAt: now, updatedAt: now })),
    progress: [], checks: [], activity: [],
  };
  let onData = null;
  let counter = 0;
  const emit = (name) => {
    if (!onData) return;
    if (name === 'workspace') onData('workspace', db.workspace, { fromCache: false });
    else if (name === 'activity') onData('activity', [...db.activity].sort((a, b) => b.createdAt - a.createdAt).slice(0, 30), { fromCache: false });
    else onData(name, db[name].map((d) => ({ ...d })), { fromCache: false });
  };
  const decode = (data) => Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v === SERVER_TIME ? Date.now() : v]));

  // Fake account: profile left null so preview still shows the "who's studying" chooser.
  const fakeUser = { uid: 'preview-uid', email: 'preview@example.com', name: 'Preview', google: true };
  let authCb = null;
  let signedIn = mode !== 'signedout';
  return {
    kind: 'memory',
    watchAuth(cb) { authCb = cb; setTimeout(() => cb(signedIn ? fakeUser : null), 30); return () => { authCb = null; }; },
    async signIn() { signedIn = true; setTimeout(() => authCb?.(fakeUser), 30); },
    async signOut() { signedIn = false; setTimeout(() => authCb?.(null), 30); },
    watchAccess(email, cb) { setTimeout(() => cb(mode === 'notallowed' ? null : { profile: null }, null), 50); return () => {}; },
    subscribeAll(handlers) {
      onData = handlers.onData;
      setTimeout(() => ['workspace', 'topics', 'sessions', 'progress', 'checks', 'discussions', 'activity'].forEach(emit), 120);
      return () => { onData = null; };
    },
    newId: () => `local${Date.now().toString(36)}${(counter++).toString(36)}`,
    // Mirrors Firestore: apply locally at once (optimistic), acknowledge later,
    // and revert the local change if the "server" rejects it.
    async write(ops) {
      const touched = new Set(ops.map((o) => o.col));
      const backup = Object.fromEntries([...touched].map((n) => [n, db[n].map((d) => ({ ...d }))]));
      try {
        for (const o of ops) {
          const list = db[o.col];
          const i = list.findIndex((d) => d.id === o.id);
          if (o.op === 'set') { const v = { id: o.id, ...decode(o.data) }; if (i >= 0) list[i] = v; else list.push(v); }
          if (o.op === 'update') { if (i < 0) throw Object.assign(new Error('No document to update'), { code: 'not-found' }); list[i] = { ...list[i], ...decode(o.data) }; }
          if (o.op === 'delete' && i >= 0) list.splice(i, 1);
        }
        touched.forEach(emit);
        await new Promise((r) => setTimeout(r, 150));
        if (window.__previewFailWrites) throw Object.assign(new Error('Simulated permission denied'), { code: 'permission-denied' });
      } catch (e) {
        Object.assign(db, backup);
        touched.forEach(emit);
        throw e;
      }
    },
  };
}
