// Settings / diagnostics + full-screen gate states.
import {
  h, confirmDialog, toast, pill, isDesktop,
} from '../ui.js';
import { icon } from '../icons.js';
import { state, saveProfile, syncStatus } from '../store.js';
import {
  PROFILES, PROFILE_IDS, REPO_URL, SOURCE_SCHEDULE_URL, WORKSPACE_ID,
} from '../config.js';
import { TIMEZONE, formatTimestamp, todayISO } from '../date-utils.js';

const CONN = {
  synced: ['Connected', 'green'],
  saving: ['Saving…', 'sand'],
  offline: ['Offline', 'terra'],
  connecting: ['Connecting…', 'sand'],
  error: ['Problem', 'terra'],
};
const SYNC_TEXT = {
  synced: 'Connected. Everything is saved.',
  saving: 'Saving… waiting for the server to confirm.',
  offline: 'Offline. Changes reach the other phone once you reconnect.',
  connecting: 'Connecting…',
  error: 'Connection problem. See details below.',
};

export function maskUid(uid) { return uid ? `${uid.slice(0, 4)}…${uid.slice(-4)}` : '–'; }

/** Build id: the deploy stamps module URLs with ?v=<commit>. */
function buildVersion() {
  try { return new URL(import.meta.url).searchParams.get('v') || 'Local build'; } catch { return 'Local build'; }
}

const lastSynced = () => (state.sync.lastSyncedAt ? formatTimestamp(state.sync.lastSyncedAt) : 'Not yet');
const dataStore = () => (state.preview ? 'Local preview (not saved)' : 'Cloud Firestore');

export function renderSettings(root, _param, _rerender, { resubscribe, signOut }) {
  const me = state.profile;
  const other = PROFILE_IDS.find((p) => p !== me);
  const s = syncStatus();
  const [connLabel, connKind] = CONN[s];

  const switchProfile = async () => {
    const ok = await confirmDialog({ title: `Switch to ${PROFILES[other].name}?`, message: `Preview only: act as ${PROFILES[other].name}.`, confirmLabel: `Switch to ${PROFILES[other].name}` });
    if (ok) { saveProfile(other); toast(`You're now ${PROFILES[other].name}`, 'success'); location.hash = '#today'; }
  };
  const doSignOut = async () => {
    const ok = await confirmDialog({ title: 'Sign out?', message: 'You\'ll need to sign in with Google again on this device.', confirmLabel: 'Sign out' });
    if (ok) signOut();
  };
  const refresh = () => { resubscribe(); toast('Reconnecting…'); };
  const diagnostics = [
    state.sync.pending > 0 && ['Waiting to save', String(state.sync.pending)],
    state.sync.lastWriteError && ['Last error', state.sync.lastWriteError],
    state.sync.listenerError && ['Listener', state.sync.listenerError],
  ].filter(Boolean);
  const links = [
    { href: SOURCE_SCHEDULE_URL, label: 'Source schedule', sub: state.workspace?.sourceScheduleFilename ?? '' },
    { href: `${REPO_URL}/blob/main/docs/import-report.md`, label: 'Import report' },
    { href: REPO_URL, label: 'GitHub repository' },
  ];
  const linkRows = [
    ...links.map((l) => h('a', { class: 'set-row set-link', href: l.href, target: '_blank', rel: 'noopener' },
      h('span', { class: 'grow' }, h('span', null, l.label), l.sub && h('span', { class: 'small muted' }, l.sub)), icon('external', { size: 18, cls: 'chev' }))),
    h('button', { class: 'set-row set-link', type: 'button', onclick: exportJson }, h('span', { class: 'grow' }, 'Download a backup (JSON)'), icon('download', { size: 18, cls: 'chev' })),
  ];

  if (isDesktop()) {
    const row = (label, value) => h('div', { class: 'set-row' }, h('span', { class: 'grow' }, label), value);
    root.append(h('div', { class: 'settings-col' },
      h('section', { class: 'card set-card', 'aria-labelledby': 'set-profile-h' },
        h('h2', { class: 'card-title', id: 'set-profile-h' }, 'Profile'),
        h('div', { class: 'set-row set-row-first' },
          h('span', { class: 'grow' }, h('b', null, 'Current profile'), h('span', { class: 'muted', 'data-test': 'current-profile' }, `${PROFILES[me].name} · Your individual progress`),
            state.user?.email && h('span', { class: 'small muted' }, `Signed in as ${state.user.email}`)),
          pill('Active', 'green', { class: 'pill-lg' })),
        h('div', { class: 'set-row set-row-last' },
          h('span', { class: 'grow muted' }, state.preview ? 'Preview only: switching changes whose progress you edit.' : 'Your Google account decides whose progress you edit. Sign out to use another account.'),
          state.preview && h('button', { class: 'btn btn-primary', type: 'button', onclick: switchProfile }, `Switch to ${PROFILES[other].name}`),
          h('button', { class: ['btn', state.preview ? 'btn-soft' : 'btn-primary'], type: 'button', onclick: doSignOut }, 'Sign out'))),
      h('section', { class: 'card set-card', 'aria-labelledby': 'set-conn-h' },
        h('h2', { class: 'card-title', id: 'set-conn-h' }, 'Connection & Sync'),
        row('Firebase connection', pill(connLabel, connKind, { class: 'pill-lg', title: SYNC_TEXT[s], 'data-test': 'connection' })),
        row('Last successful sync', h('span', { class: 'muted' }, lastSynced())),
        row('Account access', pill(state.approved ? 'Approved' : 'Not approved', state.approved ? 'green' : 'terra', { class: 'pill-lg' })),
        row('Timezone', h('span', { class: 'muted', title: `Today is ${todayISO()}` }, TIMEZONE)),
        diagnostics.map(([k, v]) => row(k, h('span', { class: 'muted set-value' }, v))),
        h('div', { class: 'set-row set-row-last' }, h('span', { class: 'grow muted' }, `${dataStore()} · ${WORKSPACE_ID}`),
          h('button', { class: 'btn btn-soft', type: 'button', onclick: refresh }, icon('refresh', { size: 18 }), 'Refresh data'))),
      h('section', { class: 'card set-card', 'aria-labelledby': 'set-about-h' },
        h('h2', { class: 'card-title', id: 'set-about-h' }, 'About'),
        row('Version', h('span', { class: 'muted' }, buildVersion())),
        row('Data store', h('span', { class: 'muted' }, dataStore())),
        linkRows)));
    return;
  }

  // ---- phone
  const loaded = (...names) => names.every((n) => state.loaded[n]) && !state.sync.listenerError;
  const checkRow = (ok, text) => h('li', { class: ['sync-check', ok && 'on'] },
    h('span', { class: 'sync-box', 'aria-hidden': 'true' }, ok && icon('check', { size: 18, stroke: 3 })), h('span', null, text),
    h('span', { class: 'sr-only' }, ok ? ' (working)' : ' (not connected)'));
  root.append(
    h('section', { class: 'card hero profile-hero', 'aria-labelledby': 'cp-h' },
      h('span', { class: 'big-icon icon-pink', 'aria-hidden': 'true' }, icon('user', { size: 44, stroke: 1.6 })),
      h('div', null,
        h('h2', { class: 'profile-hero-label', id: 'cp-h' }, 'Current Profile'),
        h('p', { class: 'profile-hero-name', 'data-test': 'current-profile' }, PROFILES[me].name),
        h('p', { class: 'profile-hero-text' }, 'Your study progress, ticks and notes are saved to this profile.'),
        state.user?.email && h('p', { class: 'small muted' }, state.user.email))),
    state.preview && h('button', { class: 'card set-action', type: 'button', onclick: switchProfile },
      h('span', { class: 'big-icon icon-green', 'aria-hidden': 'true' }, icon('swap', { size: 30, stroke: 1.8 })),
      h('span', { class: 'grow' }, h('span', { class: 'set-action-title' }, `Switch to ${PROFILES[other].name}`), h('span', { class: 'muted' }, `Preview only: change between ${PROFILES.kyle.name} and ${PROFILES.david.name}.`)),
      icon('chevron', { size: 24, cls: 'chev' })),
    h('button', { class: 'card set-action', type: 'button', onclick: doSignOut },
      h('span', { class: 'big-icon icon-green', 'aria-hidden': 'true' }, icon('swap', { size: 30, stroke: 1.8 })),
      h('span', { class: 'grow' }, h('span', { class: 'set-action-title' }, 'Sign out'), h('span', { class: 'muted' }, 'Your Google account decides your profile. Sign out to switch account.')),
      icon('chevron', { size: 24, cls: 'chev' })),
    h('section', { class: 'card set-m-card', 'aria-labelledby': 'cs-h' },
      h('div', { class: 'set-m-head' },
        h('span', { class: 'big-icon icon-green', 'aria-hidden': 'true' }, icon('cloud', { size: 30, stroke: 1.8 })),
        h('div', { class: 'grow' }, h('h2', { class: 'card-title', id: 'cs-h' }, 'Connection Status'), h('p', { class: 'muted' }, state.preview ? 'Local preview' : 'Firestore (Cloud)')),
        pill(connLabel, connKind, { class: 'pill-lg pill-icon', title: SYNC_TEXT[s], 'data-test': 'connection' })),
      h('ul', { class: 'sync-checks' },
        checkRow(loaded('progress', 'checks'), 'Syncing study progress'),
        checkRow(loaded('sessions', 'topics', 'workspace'), 'Syncing schedule updates'),
        checkRow(loaded('discussions', 'activity'), 'Syncing discussion activity')),
      h('dl', { class: 'kv' },
        h('dt', null, 'Last synced'), h('dd', null, lastSynced()),
        h('dt', null, 'Time zone'), h('dd', null, `${TIMEZONE} · ${todayISO()}`),
        diagnostics.flatMap(([k, v]) => [h('dt', null, k), h('dd', null, v)])),
      h('button', { class: 'btn btn-soft btn-block', type: 'button', onclick: refresh }, icon('refresh', { size: 18 }), 'Refresh data')),
    h('section', { class: 'card set-m-card', 'aria-labelledby': 'acc-h' },
      h('div', { class: 'set-m-head' },
        h('span', { class: 'big-icon icon-green', 'aria-hidden': 'true' }, icon('laptop', { size: 30, stroke: 1.8 })),
        h('div', { class: 'grow' }, h('h2', { class: 'card-title', id: 'acc-h' }, 'Signed-in Account'), h('p', { class: 'muted' }, 'This account can access the shared data.'))),
      h('div', { class: 'device-box' }, icon('check', { size: 26, stroke: 2.2 }),
        h('div', null, h('b', null, state.user?.email || `${PROFILES[me].name}'s account`), h('span', { class: 'muted' }, `${state.approved ? 'Approved' : 'Not approved'} · Last synced: ${lastSynced()}`)))),
    h('section', { class: 'card set-m-card', 'aria-labelledby': 'app-h' },
      h('div', { class: 'set-m-head' },
        h('span', { class: 'big-icon icon-green', 'aria-hidden': 'true' }, icon('info', { size: 30, stroke: 1.8 })),
        h('div', { class: 'grow' }, h('h2', { class: 'card-title', id: 'app-h' }, 'Application Information'))),
      h('div', { class: 'set-row' }, h('span', { class: 'grow' }, 'Version'), h('span', { class: 'muted' }, buildVersion())),
      h('div', { class: 'set-row' }, h('span', { class: 'grow' }, 'Data Store'), h('span', { class: 'muted' }, dataStore())),
      linkRows),
  );
}

function exportJson() {
  const data = {
    exportedAt: new Date().toISOString(),
    workspace: WORKSPACE_ID,
    progress: Object.values(state.progressById),
    checks: Object.values(state.checksById),
    sessions: state.sessions.map(({ tasks, notes, ...s }) => s),
    discussions: state.discussions,
  };
  // Generated on this device only; nothing is uploaded anywhere.
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: `study-tracker-export-${todayISO()}.json` });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ------------------------------------------------------------------ gate screens

function slowHelp() {
  return h('div', { class: 'stack' },
    h('p', { class: 'warning' }, 'This is taking longer than usual. Check your connection. If the site was just updated, a reload usually fixes it.'),
    h('button', {
      class: 'btn btn-primary btn-block', type: 'button',
      onclick: () => { const u = new URL(location.href); u.searchParams.set('r', Date.now().toString(36)); location.replace(u.toString()); },
    }, 'Reload'));
}

/** Small multi-colour "G" (static, trusted markup). */
function googleMark() {
  const tpl = document.createElement('template');
  tpl.innerHTML = '<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C37 38.6 44 33 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
  return tpl.content.firstElementChild;
}

export function gateScreen(kind, {
  onRetry, onChooseProfile, onSignIn, onSignOut,
} = {}) {
  const card = h('div', { class: 'gate-card', 'data-test': `gate-${kind}` },
    h('div', { class: 'gate-brand' }, icon('cap', { size: 44, stroke: 1.6, cls: 'gate-mark' }),
      h('span', { class: 'brand-text' }, h('span', { class: 'brand-word' }, 'COS330'), h('span', { class: 'brand-sub' }, 'Shared Study Tracker'))));
  const add = (...xs) => card.append(...xs.flat().filter(Boolean)); // native append would print "null"
  const title = (t) => h('h1', { class: 'gate-title' }, t);
  const lead = (t) => h('p', { class: 'gate-lead' }, t);
  switch (kind) {
    case 'boot':
    case 'signing-in':
    case 'checking-access':
      add(h('div', { class: 'spinner', 'aria-hidden': 'true' }), title('Connecting…'),
        h('p', { class: 'muted', role: 'status' }, kind === 'checking-access' ? 'Checking your access.' : 'Starting up.'),
        state.slow && slowHelp());
      break;
    case 'signed-out':
      add(title('Sign in'),
        lead('This tracker is private to Kyle and David. Sign in with your Google account. You\'ll stay signed in on this device.'),
        h('button', { class: 'btn btn-google btn-block btn-lg', type: 'button', onclick: onSignIn, disabled: state.signingIn }, googleMark(), state.signingIn ? 'Opening Google…' : 'Continue with Google'),
        state.error && h('p', { class: 'warning', role: 'alert' }, state.error),
        !state.preview && ['localhost', '127.0.0.1'].includes(location.hostname) && h('p', { class: 'small muted' },
          'Working on the code locally? Add ?preview to the address to use sample data without signing in.'));
      break;
    case 'not-allowed':
      add(title('No access for this account'),
        lead('Only Kyle\'s and David\'s Google accounts can open this tracker.'),
        state.user?.email && h('div', { class: 'gate-box' }, h('p', { class: 'eyebrow' }, 'Signed in as'), h('p', { class: 'gate-email', 'data-test': 'signed-in-email' }, state.user.email)),
        h('p', { class: 'small muted' }, 'If this is your account, ask Kyle to add it. The page unlocks by itself as soon as he does. Otherwise, sign out and choose your other Google account.'),
        state.error && h('p', { class: 'small muted' }, `Detail: ${state.error}`),
        h('button', { class: 'btn btn-primary btn-block btn-lg', type: 'button', onclick: onSignOut }, 'Use a different account'));
      break;
    case 'loading':
      add(h('div', { class: 'spinner', 'aria-hidden': 'true' }), title('Loading your plan…'), h('p', { class: 'muted', role: 'status' }, 'Fetching the schedule and progress.'),
        state.slow && slowHelp());
      break;
    case 'config-missing':
      add(title('Firebase configuration missing'),
        lead('This copy of the site has no Firebase project set up, so it can\'t load or save anything.'),
        h('p', { class: 'small muted' }, 'Owner: fill in website/js/firebase-config.js (see docs/firebase-setup.md).'));
      break;
    case 'auth-error':
      add(title('Can\'t reach Firebase'),
        lead('Couldn\'t connect to sign-in. Nothing has been loaded or saved.'),
        state.error && h('p', { class: 'small muted' }, state.error),
        h('p', { class: 'small muted' }, 'Check your connection and try again.'),
        h('button', { class: 'btn btn-primary btn-block btn-lg', type: 'button', onclick: onRetry }, 'Try again'));
      break;
    case 'no-workspace':
      add(title('Schedule not imported yet'),
        lead('You have access, but the study plan isn\'t in the database yet.'),
        h('p', { class: 'small muted' }, 'Owner: run npm run seed -- --apply (see docs/firebase-setup.md).'),
        h('button', { class: 'btn btn-soft btn-block', type: 'button', onclick: onRetry }, 'Check again'));
      break;
    case 'fatal':
      add(title('Something went wrong'), lead(state.error || 'Unknown error'), h('button', { class: 'btn btn-primary btn-block btn-lg', type: 'button', onclick: onRetry }, 'Reload'));
      break;
    case 'choose-profile':
      add(title('Who\'s studying?'),
        lead('Pick your name. This device will remember it.'),
        h('div', { class: 'profile-cards' }, PROFILE_IDS.map((p) => h('button', {
          class: ['profile-card', `profile-${p}`], type: 'button', 'data-test': `choose-${p}`, onclick: () => onChooseProfile(p),
        }, h('span', { class: 'big-icon icon-pink', 'aria-hidden': 'true' }, icon('user', { size: 34, stroke: 1.6 })), h('span', { class: 'profile-name' }, PROFILES[p].name)))),
        h('p', { class: 'small muted' }, 'Local preview only. Real accounts are tied to one person.'));
      break;
    default:
      add(title(kind));
  }
  return h('div', { class: 'gate' }, card);
}
