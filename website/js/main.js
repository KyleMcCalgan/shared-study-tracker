// App bootstrap: config → silent anonymous auth → approval gate → realtime
// listeners → profile → views. Hash router (#today, #schedule/2026-11-16, …)
// so the site works under a GitHub Pages repository subpath.
import {
  state, setState, setSync, subscribe, applyCollection, allLoaded, saveProfile, syncStatus,
} from './store.js';
import { h, clear } from './ui.js';
import { icon } from './icons.js';
import { PROFILES } from './config.js';
import * as actions from './actions.js';
import { isPreviewAllowed, createMemoryBackend } from './memory-backend.js';
import { renderDashboard } from './views/dashboard.js';
import { renderSchedule } from './views/schedule.js';
import { renderTopics } from './views/topics.js';
import { renderDiscussions } from './views/discussions.js';
import { renderSettings, gateScreen } from './views/settings.js';

const ROUTES = {
  today: { label: 'Today', icon: 'today', render: renderDashboard },
  schedule: { label: 'Schedule', icon: 'schedule', render: renderSchedule },
  topics: { label: 'Chapters', icon: 'topics', render: renderTopics },
  discuss: { label: 'Discuss', icon: 'discuss', render: renderDiscussions },
  settings: { label: 'Settings', icon: 'more', render: renderSettings, hidden: true },
};

let backend = null;
let approvalOff = null;
let dataOff = null;

// ------------------------------------------------------------------ boot

async function boot() {
  render();
  window.addEventListener('online', () => setSync({ online: true }));
  window.addEventListener('offline', () => setSync({ online: false }));
  window.addEventListener('hashchange', () => {
    // Navigating (links, back button) closes any open sheet first.
    document.querySelectorAll('dialog[open]').forEach((d) => d.dispatchEvent(new Event('cancel')));
    render({ routeChanged: true });
  });
  subscribe(() => render());

  try {
    if (isPreviewAllowed()) {
      state.preview = true;
      backend = await createMemoryBackend(new URLSearchParams(location.search).get('preview'));
    } else {
      let cfg = null;
      try { cfg = (await import('./firebase-config.js')).firebaseConfig; } catch { cfg = null; }
      let mod;
      try {
        mod = await import('./firebase-client.js');
      } catch (e) {
        setState({ phase: 'auth-error', error: `Could not load the Firebase SDK (${e.message}). Check your connection.` });
        return;
      }
      const useEmulator = ['localhost', '127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).has('emulator');
      if (useEmulator) cfg = mod.EMULATOR_CONFIG;
      if (!mod.isConfigUsable(cfg)) { setState({ phase: 'config-missing' }); return; }
      backend = mod.createFirebaseBackend(cfg, { emulator: useEmulator });
    }
  } catch (e) {
    setState({ phase: 'fatal', error: e.message });
    return;
  }
  actions.setBackend(backend);
  startAuth();
}

function timeout(promise, ms, message) {
  return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error(message)), ms))]);
}

async function startAuth() {
  setState({ phase: 'signing-in', error: null });
  let uid;
  try {
    uid = await timeout(backend.signIn(), 20000, 'Timed out while signing in');
  } catch (e) {
    const code = e.code ? ` (${e.code})` : '';
    setState({ phase: 'auth-error', error: `${e.message}${code}` });
    return;
  }
  setState({ uid });
  watchApproval();
}

function watchApproval() {
  if (approvalOff) approvalOff();
  approvalOff = backend.watchApproval(state.uid, (approved, err) => {
    if (approved) {
      if (!state.approved || !dataOff) {
        setState({ approved: true, phase: 'loading', error: null });
        startData();
      }
    } else {
      stopData();
      const detail = err ? `${err.code || ''} ${err.message || ''}`.trim() : null;
      setState({ approved: false, phase: 'unapproved', error: detail });
    }
  });
}

function startData() {
  stopData();
  state.loaded = {};
  dataOff = backend.subscribeAll({
    onData: (name, docs, meta) => {
      applyCollection(name, docs, meta);
      if (['loading', 'no-workspace', 'ready'].includes(state.phase) && allLoaded()) {
        setState({ phase: state.workspace ? 'ready' : 'no-workspace' });
      }
    },
    onError: (name, err) => {
      console.error(`Listener ${name} failed`, err);
      const msg = err.code === 'permission-denied'
        ? 'Permission denied: this device may no longer be approved.'
        : `${err.code || ''} ${err.message || ''}`.trim();
      setSync({ listenerError: `${name}: ${msg}` });
      if (state.phase === 'loading') setState({ phase: 'fatal', error: `Could not load data. ${msg}` });
    },
  });
}

function stopData() { if (dataOff) { dataOff(); dataOff = null; } }

function resubscribe() {
  setSync({ listenerError: null });
  if (state.approved) startData(); else watchApproval();
}

function retry() {
  if (!backend) { location.reload(); return; }
  if (!state.uid) startAuth();
  else resubscribe();
}

// ------------------------------------------------------------------ rendering

function currentRoute() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [name, ...rest] = raw.split('/');
  return { name: ROUTES[name] ? name : 'today', param: rest.join('/') || null };
}

let shell = null;
let deferred = false;

function render({ routeChanged = false } = {}) {
  const app = document.getElementById('app');
  const gate = state.phase !== 'ready' ? state.phase : (!state.profile ? 'choose-profile' : null);
  if (gate) {
    shell = null;
    clear(app).append(gateScreen(gate, {
      onRetry: retry,
      onChooseProfile: (p) => { saveProfile(p); location.hash = '#today'; },
    }));
    document.title = 'COS330 Study Tracker';
    return;
  }
  if (!shell) { shell = buildShell(); clear(app).append(shell.root); routeChanged = true; }
  updateHeader();

  // Don't rebuild the view under someone typing: wait for blur.
  const active = document.activeElement;
  const typing = active && shell.view.contains(active) && (active.tagName === 'TEXTAREA' || (active.tagName === 'INPUT' && ['text', 'search', 'date', 'time'].includes(active.type)));
  if (typing && !routeChanged) {
    if (!deferred) {
      deferred = true;
      active.addEventListener('blur', () => { deferred = false; setTimeout(() => render(), 0); }, { once: true });
    }
    return;
  }
  renderView(routeChanged);
}

function renderView(routeChanged) {
  const { name, param } = currentRoute();
  const route = ROUTES[name];
  const view = shell.view;
  // Preserve open <details>, focus and scroll across live re-renders.
  const openState = {};
  view.querySelectorAll('details[data-keep]').forEach((d) => { openState[d.dataset.keep] = d.open; });
  const focusKey = document.activeElement?.dataset?.fk;
  const scrollY = window.scrollY;

  const next = h('div', { class: `view view-${name}` });
  route.render(next, routeChanged ? param : null, () => render(), { resubscribe });
  view.replaceChildren(next);

  if (!routeChanged) {
    next.querySelectorAll('details[data-keep]').forEach((d) => { if (d.dataset.keep in openState) d.open = openState[d.dataset.keep]; });
    if (focusKey) next.querySelector(`[data-fk="${CSS.escape(focusKey)}"]`)?.focus({ preventScroll: true });
    window.scrollTo(0, scrollY);
  } else if (!param) {
    window.scrollTo(0, 0);
  }
  shell.nav.querySelectorAll('a').forEach((a) => {
    const on = a.dataset.route === name;
    a.classList.toggle('is-active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  document.title = `${route.label} · COS330 Study Tracker`;
}

function buildShell() {
  const syncPill = h('span', { class: 'sync', role: 'status', 'aria-live': 'polite' }, h('span', { class: 'sync-text' }));
  const profileBtn = h('a', { class: 'avatar', href: '#settings' });
  const nav = h('nav', { class: 'nav', 'aria-label': 'Main' },
    Object.entries(ROUTES).filter(([, r]) => !r.hidden).map(([id, r]) => h('a', { href: `#${id}`, class: 'nav-link', dataset: { route: id } },
      icon(r.icon, { size: 22 }), h('span', { class: 'nav-label' }, r.label))));
  const header = h('header', { class: 'appbar' },
    h('a', { class: 'brand', href: '#today', 'aria-label': 'COS330 study tracker, today' },
      h('span', { class: 'brand-word' }, 'cos330'), h('span', { class: 'brand-sub' }, 'study tracker')),
    nav,
    h('div', { class: 'appbar-right' }, syncPill, profileBtn));
  const banner = state.preview ? h('div', { class: 'preview-banner', role: 'note' }, 'Local preview: data comes from the committed seed and changes are NOT saved anywhere.') : null;
  const view = h('main', { id: 'view', class: 'main', tabindex: '-1' });
  const root = h('div', { class: 'shell' }, h('a', { class: 'skip', href: '#view', onclick: (e) => { e.preventDefault(); view.focus(); } }, 'Skip to content'), header, banner, view);
  return { root, view, nav, syncPill, profileBtn };
}

const SYNC_LABEL = { synced: 'Synced', saving: 'Saving…', offline: 'Offline', connecting: 'Connecting…', error: 'Sync error' };

function updateHeader() {
  const s = syncStatus();
  shell.syncPill.className = `sync sync-${s}`;
  shell.syncPill.firstChild.textContent = SYNC_LABEL[s];
  shell.syncPill.title = s === 'offline' ? 'You are offline. Changes will not reach the other device until you reconnect.' : SYNC_LABEL[s];
  const p = PROFILES[state.profile];
  shell.profileBtn.className = `avatar avatar-${p.id}`;
  shell.profileBtn.textContent = p.initial;
  shell.profileBtn.setAttribute('aria-label', `${p.name} (active profile). Open settings`);
}

boot();
