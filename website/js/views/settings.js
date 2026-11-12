// Settings / diagnostics + full-screen gate states.
import {
  h, confirmDialog, toast, avatar, secHead,
} from '../ui.js';
import { icon } from '../icons.js';
import { state, saveProfile, syncStatus } from '../store.js';
import {
  PROFILES, PROFILE_IDS, REPO_URL, SOURCE_SCHEDULE_URL, WORKSPACE_ID,
} from '../config.js';
import { TIMEZONE, formatTimestamp, todayISO } from '../date-utils.js';

const SYNC_TEXT = {
  synced: 'Connected. Everything is saved.',
  saving: 'Saving… waiting for the server to confirm.',
  offline: 'Offline. Changes reach the other phone once you reconnect.',
  connecting: 'Connecting…',
  error: 'Connection problem. See details below.',
};

export function maskUid(uid) { return uid ? `${uid.slice(0, 4)}…${uid.slice(-4)}` : '–'; }

async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Copied', 'success'); } catch { toast('Couldn\'t copy. Select the text and copy it manually.', 'error'); }
}

export function renderSettings(root, _param, _rerender, { resubscribe, signOut }) {
  const me = state.profile;
  const other = PROFILE_IDS.find((p) => p !== me);

  root.append(h('h1', { class: 'page-title' }, 'Settings'));

  root.append(h('section', { class: 'card stack' },
    h('div', { class: 'row' }, avatar(me, 'md'), h('div', { class: 'grow' },
      h('p', { class: 'eyebrow' }, 'Signed in as'),
      h('p', { style: 'font-family:var(--display);font-weight:800;font-size:1.5rem' }, PROFILES[me].name),
      state.user?.email && h('p', { class: 'small muted' }, state.user.email))),
    // Real accounts are tied to one profile. Only the local preview can switch.
    state.preview && h('button', {
      class: 'btn btn-block',
      onclick: async () => {
        const ok = await confirmDialog({ title: `Switch to ${PROFILES[other].name}?`, message: `Preview only: act as ${PROFILES[other].name}.`, confirmLabel: `Switch to ${PROFILES[other].name}` });
        if (ok) { saveProfile(other); toast(`You're now ${PROFILES[other].name}`, 'success'); location.hash = '#today'; }
      },
    }, `Switch to ${PROFILES[other].name}`),
    h('button', {
      class: 'btn btn-ghost btn-block',
      onclick: async () => {
        const ok = await confirmDialog({ title: 'Sign out?', message: 'You\'ll need to sign in with Google again on this device.', confirmLabel: 'Sign out' });
        if (ok) signOut();
      },
    }, 'Sign out'),
    h('p', { class: 'small muted' }, 'Your Google account decides which profile you are, so you can only change your own progress.')));

  root.append(h('section', null, secHead('Connection'), h('div', { class: 'card stack' },
    h('dl', { class: 'kv' },
      h('dt', null, 'Status'), h('dd', null, SYNC_TEXT[syncStatus()]),
      h('dt', null, 'Last synced'), h('dd', null, state.sync.lastSyncedAt ? formatTimestamp(state.sync.lastSyncedAt) : 'Not yet'),
      state.sync.pending > 0 && h('dt', null, 'Waiting to save'), state.sync.pending > 0 && h('dd', null, String(state.sync.pending)),
      state.sync.lastWriteError && h('dt', null, 'Last error'), state.sync.lastWriteError && h('dd', null, state.sync.lastWriteError),
      state.sync.listenerError && h('dt', null, 'Listener'), state.sync.listenerError && h('dd', null, state.sync.listenerError),
      h('dt', null, 'Time zone'), h('dd', null, `${TIMEZONE} · today is ${todayISO()}`),
      h('dt', null, 'Data'), h('dd', null, state.preview ? 'Local preview (not saved)' : `Cloud Firestore · ${WORKSPACE_ID}`)),
    h('button', { class: 'btn', onclick: () => { resubscribe(); toast('Reconnecting…'); } }, icon('refresh', { size: 18 }), 'Refresh data'))));


  root.append(h('section', null, secHead('Data'), h('div', { class: 'card' }, h('div', { class: 'list-rows' },
    h('a', { class: 'list-row', href: SOURCE_SCHEDULE_URL, target: '_blank', rel: 'noopener' }, h('span', { class: 'grow' }, h('b', null, 'Source schedule'), h('span', { class: 'small muted' }, state.workspace?.sourceScheduleFilename ?? '')), icon('chevron', { size: 18 })),
    h('a', { class: 'list-row', href: `${REPO_URL}/blob/main/docs/import-report.md`, target: '_blank', rel: 'noopener' }, h('b', { class: 'grow' }, 'Import report'), icon('chevron', { size: 18 })),
    h('a', { class: 'list-row', href: REPO_URL, target: '_blank', rel: 'noopener' }, h('b', { class: 'grow' }, 'GitHub repository'), icon('chevron', { size: 18 })),
    h('button', { class: 'list-row', style: 'background:none;border:0;width:100%;text-align:left', onclick: exportJson }, h('b', { class: 'grow' }, 'Download a backup (JSON)'), icon('download', { size: 18 }))))));
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
      class: 'btn btn-primary btn-block',
      onclick: () => { const u = new URL(location.href); u.searchParams.set('r', Date.now().toString(36)); location.replace(u.toString()); },
    }, 'Reload'));
}

/** Small multi-colour "G" (static, trusted markup). */
function googleMark() {
  const tpl = document.createElement('template');
  tpl.innerHTML = '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C37 38.6 44 33 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
  return tpl.content.firstElementChild;
}

export function gateScreen(kind, {
  onRetry, onChooseProfile, onSignIn, onSignOut,
} = {}) {
  const card = h('div', { class: 'gate-card' }, h('p', { class: 'gate-brand' }, 'cos330'));
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
        h('button', { class: 'btn btn-primary btn-block', onclick: onSignIn, disabled: state.signingIn }, googleMark(), state.signingIn ? 'Opening Google…' : 'Continue with Google'),
        state.error && h('p', { class: 'warning', role: 'alert' }, state.error),
        !state.preview && ['localhost', '127.0.0.1'].includes(location.hostname) && h('p', { class: 'small muted' },
          'Working on the code locally? Add ?preview to the address to use sample data without signing in.'));
      break;
    case 'not-allowed':
      add(title('No access for this account'),
        lead('Only Kyle\'s and David\'s Google accounts can open this tracker.'),
        state.user?.email && h('div', { class: 'uid-box' }, h('p', { class: 'eyebrow' }, 'Signed in as'), h('p', { class: 'uid-big' }, state.user.email)),
        h('p', { class: 'small muted' }, 'If this is your account, ask Kyle to add it. The page unlocks by itself as soon as he does. Otherwise, sign out and choose your other Google account.'),
        state.error && h('p', { class: 'small muted' }, `Detail: ${state.error}`),
        h('button', { class: 'btn btn-primary btn-block', onclick: onSignOut }, 'Use a different account'));
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
        h('button', { class: 'btn btn-primary btn-block', onclick: onRetry }, 'Try again'));
      break;
    case 'no-workspace':
      add(title('Schedule not imported yet'),
        lead('You have access, but the study plan isn\'t in the database yet.'),
        h('p', { class: 'small muted' }, 'Owner: run npm run seed -- --apply (see docs/firebase-setup.md).'),
        h('button', { class: 'btn btn-ghost', onclick: onRetry }, 'Check again'));
      break;
    case 'fatal':
      add(title('Something went wrong'), lead(state.error || 'Unknown error'), h('button', { class: 'btn btn-primary btn-block', onclick: onRetry }, 'Reload'));
      break;
    case 'choose-profile':
      add(title('Who\'s studying?'),
        lead('Pick your name. This device will remember it.'),
        h('div', { class: 'profile-cards' }, PROFILE_IDS.map((p) => h('button', {
          class: ['profile-card', `profile-${p}`], onclick: () => onChooseProfile(p),
        }, h('span', { class: 'profile-initial', 'aria-hidden': 'true' }, PROFILES[p].initial), h('span', { class: 'profile-name' }, PROFILES[p].name)))),
        h('p', { class: 'small muted' }, 'Local preview only. Real accounts are tied to one person.'));
      break;
    default:
      add(title(kind));
  }
  return h('div', { class: 'gate' }, card);
}
