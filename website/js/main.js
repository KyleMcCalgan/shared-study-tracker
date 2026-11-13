// App bootstrap: config → silent anonymous auth → approval gate → realtime
// listeners → profile → views. Hash router (#today, #schedule/2026-11-16, …)
// so the site works under a GitHub Pages repository subpath.
import {
  state, setState, setSync, subscribe, applyCollection, allLoaded, saveProfile, syncStatus,
} from './store.js';
import { h, clear, bp, onLayoutChange } from './ui.js';
import { icon } from './icons.js';
import { PROFILES, PROFILE_IDS } from './config.js';
import * as actions from './actions.js';
import { isPreviewAllowed, createMemoryBackend } from './memory-backend.js';
import { renderDashboard } from './views/dashboard.js';
import { renderSchedule } from './views/schedule.js';
import { renderTopics } from './views/topics.js';
import { renderDiscussions } from './views/discussions.js';
import { renderSettings, gateScreen } from './views/settings.js';

const other = () => PROFILES[PROFILE_IDS.find((p) => p !== state.profile)].name;
const me = () => PROFILES[state.profile].name;

// Page subtitles differ slightly between the desktop and phone designs: [desktop, phone].
const ROUTES = {
  today: {
    label: 'Today', icon: ['d-home', 'home'], render: renderDashboard,
    sub: () => [`${me()}'s plan · shared study with ${other()}`, `${me()}'s plan · COS330 with ${other()}`],
  },
  schedule: {
    label: 'Schedule', icon: ['d-schedule', 'calendar'], render: renderSchedule,
    sub: () => ['Plan individual and shared study time', 'Upcoming study sessions and key dates'],
  },
  topics: {
    label: 'Topics', icon: ['d-topics', 'layers'], render: renderTopics,
    sub: () => [`Your syllabus · ${PROFILES.kyle.name} and ${PROFILES.david.name}`, 'Chapters, progress and study material'],
  },
  discuss: {
    label: 'Discuss', icon: ['d-discuss', 'chat'], render: renderDiscussions,
    sub: () => ['Questions for your next study session', `Shared questions, clarifications and topics for ${PROFILES.kyle.name} and ${PROFILES.david.name}.`],
  },
  settings: {
    label: 'Settings', icon: ['d-settings', 'gear'], render: renderSettings,
    sub: () => ['Profile and connection preferences', 'Manage your profile, connection and application preferences.'],
  },
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
  // Desktop and phone layouts differ in structure for some views: rebuild on crossing.
  onLayoutChange(() => render({ routeChanged: false }));
  // Watchdog: never spin forever. If start-up stalls, offer a reload.
  setTimeout(() => {
    if (['boot', 'signing-in', 'checking-access', 'loading'].includes(state.phase)) setState({ slow: true });
  }, 15000);

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

let authOff = null;

/** Google account → allowlist entry → profile → data. */
function startAuth() {
  setState({ phase: 'signing-in', error: null });
  if (authOff) authOff();
  authOff = backend.watchAuth((user) => {
    if (approvalOff) { approvalOff(); approvalOff = null; }
    stopData();
    if (!user || !user.google) {
      // Signed out (or an old anonymous session from the device-code era).
      setState({ user: null, uid: null, approved: false, phase: 'signed-out' });
      return;
    }
    setState({ user, uid: user.uid, phase: 'checking-access', error: null });
    watchAccess();
  }, (e) => setState({ phase: 'auth-error', error: `${e.message}${e.code ? ` (${e.code})` : ''}` }));
}

function watchAccess() {
  if (approvalOff) approvalOff();
  approvalOff = backend.watchAccess(state.user.email, (entry, err) => {
    if (entry) {
      // The account decides the profile (preview accounts have none → chooser).
      if (entry.profile && entry.profile !== state.profile) saveProfile(entry.profile);
      if (!state.approved || !dataOff) {
        setState({ approved: true, phase: 'loading', error: null });
        startData();
      }
    } else {
      stopData();
      const detail = err ? `${err.code || ''} ${err.message || ''}`.trim() : null;
      setState({ approved: false, phase: 'not-allowed', error: detail });
    }
  });
}

async function signIn() {
  setState({ error: null, signingIn: true });
  try {
    await backend.signIn();
  } catch (e) {
    const code = e.code || '';
    const msg = code.includes('popup-blocked') ? 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.'
      : code.includes('popup-closed') || code.includes('cancelled-popup') ? 'Sign-in was cancelled.'
        : code.includes('unauthorized-domain') ? 'This website address is not authorised in Firebase yet (Authentication → Settings → Authorized domains).'
          : code.includes('operation-not-allowed') ? 'Google sign-in is not enabled in Firebase yet (Authentication → Sign-in method).'
            : `Sign-in failed: ${e.message}`;
    setState({ error: msg });
  } finally {
    setState({ signingIn: false });
  }
}

async function signOut() {
  stopData();
  saveProfile(null);
  await backend.signOut();
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
        ? 'Permission denied: this account may no longer have access.'
        : `${err.code || ''} ${err.message || ''}`.trim();
      setSync({ listenerError: `${name}: ${msg}` });
      if (state.phase === 'loading') setState({ phase: 'fatal', error: `Could not load data. ${msg}` });
    },
  });
}

function stopData() { if (dataOff) { dataOff(); dataOff = null; } }

function resubscribe() {
  setSync({ listenerError: null });
  if (state.approved) startData(); else if (state.user) watchAccess(); else startAuth();
}

function retry() {
  if (!backend) { location.reload(); return; }
  if (!state.user) startAuth();
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
      onSignIn: signIn,
      onSignOut: signOut,
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

  const [subDesk, subMob] = route.sub();
  const next = h('div', { class: `view view-${name}`, 'data-test': `view-${name}` },
    h('div', { class: 'page-head' },
      h('h1', { class: 'page-title' }, route.label),
      h('p', { class: 'page-sub' }, bp(subDesk, subMob))));
  route.render(next, routeChanged ? param : null, () => render(), { resubscribe, signOut });
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
  const syncPill = h('span', { class: 'sync', role: 'status', 'aria-live': 'polite', 'data-test': 'sync' },
    icon('check', { size: 16, cls: 'sync-icon' }), h('span', { class: 'sync-text' }));
  const profileBtn = h('a', { class: 'profile-btn', href: '#settings', 'data-test': 'profile-button' },
    icon('pawn', { size: 30, stroke: 1.4, cls: 'only-desk' }), icon('user', { size: 30, stroke: 1.6, cls: 'only-mob' }));
  const nav = h('nav', { class: 'nav', 'aria-label': 'Main' },
    Object.entries(ROUTES).map(([id, r]) => h('a', { href: `#${id}`, class: 'nav-link', dataset: { route: id } },
      h('span', { class: 'nav-icon', 'aria-hidden': 'true' },
        icon(r.icon[0], { size: 26, stroke: 1.5, cls: 'only-desk' }), icon(r.icon[1], { size: 26, stroke: 1.7, cls: 'only-mob' })),
      h('span', { class: 'nav-label' }, r.label))));
  const header = h('header', { class: 'topbar' },
    h('a', { class: 'brand', href: '#today', 'aria-label': 'COS330 Shared Study Tracker, today' },
      h('span', { class: 'brand-mark', 'aria-hidden': 'true' },
        icon('clover', { size: 44, stroke: 1.1, cls: 'only-desk' }), icon('cap', { size: 44, stroke: 1.6, cls: 'only-mob' })),
      h('span', { class: 'brand-text' }, h('span', { class: 'brand-word' }, 'COS330'), h('span', { class: 'brand-sub' }, 'Shared Study Tracker'))),
    h('div', { class: 'topbar-right' }, syncPill, profileBtn));
  const banner = state.preview ? h('div', { class: 'preview-banner', role: 'note' }, 'Local preview: data comes from the committed seed and changes are NOT saved anywhere.') : null;
  const view = h('main', { id: 'view', class: 'main', tabindex: '-1' });
  const root = h('div', { class: 'shell' },
    h('a', { class: 'skip', href: '#view', onclick: (e) => { e.preventDefault(); view.focus(); } }, 'Skip to content'),
    header, nav, h('div', { class: 'main-wrap' }, banner, view));
  return { root, view, nav, syncPill, profileBtn };
}

const SYNC_LABEL = { synced: 'Synced', saving: 'Saving…', offline: 'Offline', connecting: 'Connecting…', error: 'Sync error' };

function updateHeader() {
  const s = syncStatus();
  shell.syncPill.className = `sync sync-${s}`;
  shell.syncPill.dataset.state = s;
  shell.syncPill.lastChild.textContent = SYNC_LABEL[s];
  shell.syncPill.title = s === 'offline' ? 'You are offline. Changes will not reach the other device until you reconnect.' : SYNC_LABEL[s];
  const p = PROFILES[state.profile];
  shell.profileBtn.dataset.profile = p.id;
  shell.profileBtn.setAttribute('aria-label', `${p.name} (active profile). Open settings`);
  shell.profileBtn.title = p.name;
}

boot();
