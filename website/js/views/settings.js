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

export function renderSettings(root, _param, _rerender, { resubscribe }) {
  const me = state.profile;
  const other = PROFILE_IDS.find((p) => p !== me);
  let reveal = false;
  const uidText = h('code', { class: 'uid' }, maskUid(state.uid));

  root.append(h('h1', { class: 'page-title' }, 'Settings'));

  root.append(h('section', { class: 'card stack' },
    h('div', { class: 'row' }, avatar(me, 'md'), h('div', { class: 'grow' },
      h('p', { class: 'eyebrow' }, 'Using this device as'),
      h('p', { style: 'font-family:var(--display);font-weight:800;font-size:1.5rem' }, PROFILES[me].name))),
    h('button', {
      class: 'btn btn-block',
      onclick: async () => {
        const ok = await confirmDialog({ title: `Switch to ${PROFILES[other].name}?`, message: `Progress changes on this device will then be recorded for ${PROFILES[other].name}.`, confirmLabel: `Switch to ${PROFILES[other].name}` });
        if (ok) { saveProfile(other); toast(`You're now ${PROFILES[other].name}`, 'success'); location.hash = '#today'; }
      },
    }, `Switch to ${PROFILES[other].name}`),
    h('p', { class: 'small muted' }, 'Picking a name isn\'t a login. It only decides whose progress this device edits.')));

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

  root.append(h('section', null, secHead('This device'), h('div', { class: 'card stack' },
    h('p', null, state.approved ? h('b', { style: 'color:var(--rest)' }, '✓ Approved') : h('b', null, 'Not approved')),
    h('div', { class: 'row wrap' }, h('span', { class: 'small muted' }, 'Device ID'), uidText,
      h('button', { class: 'btn btn-sm', onclick: (e) => { reveal = !reveal; uidText.textContent = reveal ? state.uid : maskUid(state.uid); e.currentTarget.textContent = reveal ? 'Hide' : 'Show'; } }, 'Show'),
      h('button', { class: 'btn btn-sm', onclick: () => copy(state.uid) }, 'Copy')),
    h('p', { class: 'small muted' }, 'Clearing site data, private windows or a new browser give you a new ID, which then needs approving again.'))));

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

export function gateScreen(kind, { onRetry, onChooseProfile } = {}) {
  const card = h('div', { class: 'gate-card' }, h('p', { class: 'gate-brand' }, 'cos330'));
  const add = (...xs) => card.append(...xs.flat().filter(Boolean)); // native append would print "null"
  const title = (t) => h('h1', { class: 'gate-title' }, t);
  const lead = (t) => h('p', { class: 'gate-lead' }, t);
  switch (kind) {
    case 'boot':
    case 'signing-in':
      add(h('div', { class: 'spinner', 'aria-hidden': 'true' }), title('Connecting…'), h('p', { class: 'muted', role: 'status' }, 'Signing this device in.'));
      break;
    case 'loading':
      add(h('div', { class: 'spinner', 'aria-hidden': 'true' }), title('Loading your plan…'), h('p', { class: 'muted', role: 'status' }, 'Fetching the schedule and progress.'));
      break;
    case 'config-missing':
      add(title('Firebase configuration missing'),
        lead('This copy of the site has no Firebase project set up, so it can\'t load or save anything.'),
        h('p', { class: 'small muted' }, 'Owner: fill in website/js/firebase-config.js (see docs/firebase-setup.md).'));
      break;
    case 'auth-error':
      add(title('Can\'t reach Firebase'),
        lead('This device couldn\'t sign in. Nothing has been loaded or saved.'),
        state.error && h('p', { class: 'small muted' }, state.error),
        h('p', { class: 'small muted' }, 'Check your connection. If this keeps happening, Anonymous sign-in may be switched off in Firebase.'),
        h('button', { class: 'btn btn-primary btn-block', onclick: onRetry }, 'Try again'));
      break;
    case 'unapproved':
      add(title('Device approval required'),
        lead('This tracker is private to Kyle and David. Each browser is approved once. No password needed.'),
        h('div', { class: 'uid-box' },
          h('p', { class: 'eyebrow' }, 'Your device code'),
          h('code', { class: 'uid-big' }, state.uid || ''),
          h('button', { class: 'btn btn-primary btn-block', onclick: () => copy(state.uid) }, icon('copy', { size: 18 }), 'Copy code')),
        h('ol', { class: 'steps' },
          h('li', null, 'Send the code to Kyle privately, e.g. on WhatsApp.'),
          h('li', null, 'Keep this page open. It unlocks by itself once approved.')),
        h('p', { class: 'small muted' }, 'Private windows, cleared browser data and new browsers each get a new code.'),
        state.error && h('p', { class: 'small muted' }, `Detail: ${state.error}`),
        h('button', { class: 'btn btn-ghost', onclick: onRetry }, 'Check again'));
      break;
    case 'no-workspace':
      add(title('Schedule not imported yet'),
        lead('This device is approved, but the study plan isn\'t in the database yet.'),
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
        h('p', { class: 'small muted' }, 'Not a login. It only decides whose progress this device edits. You can switch later in Settings.'));
      break;
    default:
      add(title(kind));
  }
  return h('div', { class: 'gate' }, card);
}
