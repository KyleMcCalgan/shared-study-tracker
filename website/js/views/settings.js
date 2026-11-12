// Settings / diagnostics + full-screen gate states.
import { h, confirmDialog, toast, personChip } from '../ui.js';
import { state, saveProfile, syncStatus } from '../store.js';
import {
  PROFILES, PROFILE_IDS, REPO_URL, SOURCE_SCHEDULE_URL, WORKSPACE_ID,
} from '../config.js';
import { TIMEZONE, formatTimestamp, todayISO, formatLong } from '../date-utils.js';

const SYNC_TEXT = {
  synced: 'Connected. All changes saved.',
  saving: 'Saving… waiting for the server to confirm.',
  offline: 'Offline. Changes will not reach the other device until you reconnect.',
  connecting: 'Connecting… showing cached data.',
  error: 'Connection error. See details below.',
};

export function maskUid(uid) { return uid ? `${uid.slice(0, 4)}…${uid.slice(-4)}` : '–'; }

async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Copied', 'success'); } catch { toast('Could not copy. Select the text and copy it manually.', 'error'); }
}

export function renderSettings(root, _param, rerender, { resubscribe }) {
  let reveal = false;
  const uidText = h('code', { class: 'uid' }, maskUid(state.uid));
  root.append(h('div', { class: 'toolbar' }, h('h1', { class: 'view-title' }, 'Settings')));

  root.append(h('section', { class: 'panel' },
    h('h2', { class: 'panel-title' }, 'Profile'),
    h('p', null, 'Active profile on this device: ', personChip(state.profile)),
    h('p', { class: 'muted small' }, 'Choosing a profile is a convenience, not a login. It decides whose progress you are editing on this device.'),
    h('div', { class: 'chip-row' }, PROFILE_IDS.filter((p) => p !== state.profile).map((p) => h('button', {
      class: 'btn',
      onclick: async () => {
        const ok = await confirmDialog({ title: 'Switch profile', message: `Switch this device to ${PROFILES[p].name}? From now on, progress changes here are recorded for ${PROFILES[p].name}.`, confirmLabel: `Switch to ${PROFILES[p].name}` });
        if (ok) { saveProfile(p); toast(`Active profile: ${PROFILES[p].name}`, 'success'); location.hash = '#today'; }
      },
    }, `Switch to ${PROFILES[p].name}`)))));

  root.append(h('section', { class: 'panel' },
    h('h2', { class: 'panel-title' }, 'Connection'),
    h('dl', { class: 'kv' },
      h('dt', null, 'Status'), h('dd', null, SYNC_TEXT[syncStatus()]),
      h('dt', null, 'Last synced'), h('dd', null, state.sync.lastSyncedAt ? formatTimestamp(state.sync.lastSyncedAt) : 'Not yet'),
      h('dt', null, 'Pending writes'), h('dd', null, String(state.sync.pending)),
      state.sync.lastWriteError && h('dt', null, 'Last error'), state.sync.lastWriteError && h('dd', null, state.sync.lastWriteError),
      state.sync.listenerError && h('dt', null, 'Listener error'), state.sync.listenerError && h('dd', null, state.sync.listenerError),
      h('dt', null, 'Timezone'), h('dd', null, `${TIMEZONE} (today is ${formatLong(todayISO())})`),
      h('dt', null, 'Workspace'), h('dd', null, WORKSPACE_ID),
      h('dt', null, 'Backend'), h('dd', null, state.preview ? 'Local preview (not saved)' : 'Cloud Firestore')),
    h('button', { class: 'btn', onclick: () => { resubscribe(); toast('Reconnecting…'); } }, '↻ Refresh data')));

  root.append(h('section', { class: 'panel' },
    h('h2', { class: 'panel-title' }, 'This device'),
    h('p', null, 'Approval: ', state.approved ? h('strong', { class: 'ok' }, '✓ Approved') : h('strong', null, 'Not approved')),
    h('p', null, 'Device ID: ', uidText, ' ',
      h('button', { class: 'btn btn-sm', onclick: (e) => { reveal = !reveal; uidText.textContent = reveal ? state.uid : maskUid(state.uid); e.target.textContent = reveal ? 'Hide' : 'Show'; } }, 'Show'),
      ' ', h('button', { class: 'btn btn-sm', onclick: () => copy(state.uid) }, 'Copy')),
    h('p', { class: 'muted small' }, 'If you clear this browser\'s site data, use private browsing, or switch browser or device, you get a new device ID that has to be approved again.')));

  root.append(h('section', { class: 'panel' },
    h('h2', { class: 'panel-title' }, 'Data and links'),
    h('ul', { class: 'link-list' },
      h('li', null, h('a', { href: SOURCE_SCHEDULE_URL, target: '_blank', rel: 'noopener' }, 'Source schedule (Markdown)')),
      h('li', null, h('a', { href: REPO_URL, target: '_blank', rel: 'noopener' }, 'GitHub repository')),
      h('li', null, h('a', { href: `${REPO_URL}/blob/main/docs/import-report.md`, target: '_blank', rel: 'noopener' }, 'Import report'))),
    h('button', { class: 'btn', onclick: exportJson }, '⬇ Download export (JSON)'),
    h('p', { class: 'muted small' }, `Schedule: ${state.workspace?.sourceScheduleFilename ?? '–'} (v${state.workspace?.sourceVersion ?? '?'})`)));
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
  const wrap = h('div', { class: 'gate' });
  const card = h('div', { class: 'gate-card' });
  wrap.append(card);
  const title = (t) => h('h1', { class: 'gate-title' }, t);
  switch (kind) {
    case 'boot':
    case 'signing-in':
      card.append(h('div', { class: 'spinner', 'aria-hidden': 'true' }), title('Connecting…'), h('p', { class: 'muted', role: 'status' }, 'Signing this device in.'));
      break;
    case 'loading':
      card.append(h('div', { class: 'spinner', 'aria-hidden': 'true' }), title('Loading your study plan…'), h('p', { class: 'muted', role: 'status' }, 'Fetching the schedule and progress.'));
      break;
    case 'config-missing':
      card.append(title('Firebase configuration missing'),
        h('p', null, 'This copy of the site has no Firebase project configured yet, so it cannot load or save anything.'),
        h('p', { class: 'muted small' }, 'Owner: copy website/js/firebase-config.example.js to website/js/firebase-config.js, fill in the web app config from the Firebase Console, then commit and push. See docs/firebase-setup.md.'));
      break;
    case 'auth-error':
      card.append(title('Can\'t reach Firebase'),
        h('p', null, 'The app could not sign this device in. Nothing has been loaded or saved.'),
        h('p', { class: 'muted small' }, state.error || ''),
        h('p', { class: 'muted small' }, 'Check your internet connection. If it keeps happening, Anonymous sign-in may not be enabled in the Firebase project.'),
        h('button', { class: 'btn btn-primary', onclick: onRetry }, 'Try again'));
      break;
    case 'unapproved': {
      const uidCode = h('code', { class: 'uid uid-big' }, state.uid || '');
      card.append(title('Device approval required'),
        h('p', null, 'This tracker is private to Kyle and David. Each browser has to be approved once. No password is needed.'),
        h('ol', { class: 'steps' },
          h('li', null, 'Copy this device code:'),
        ),
        h('div', { class: 'uid-row' }, uidCode, h('button', { class: 'btn btn-primary', onclick: () => copy(state.uid) }, 'Copy code')),
        h('ol', { class: 'steps', start: 2 },
          h('li', null, 'Send it privately to Kyle (for example on WhatsApp).'),
          h('li', null, 'Keep this page open. It unlocks by itself once the device is approved.')),
        h('p', { class: 'muted small' }, 'Clearing browser data, private windows and new browsers create a new code that needs approving again.'),
        state.error && h('p', { class: 'muted small' }, `Detail: ${state.error}`),
        h('button', { class: 'btn', onclick: onRetry }, 'Check again'));
      break;
    }
    case 'no-workspace':
      card.append(title('Schedule not imported yet'),
        h('p', null, 'This device is approved, but the study plan has not been loaded into the database yet.'),
        h('p', { class: 'muted small' }, 'Owner: run the seed script (npm run seed -- --apply). See docs/firebase-setup.md.'),
        h('button', { class: 'btn', onclick: onRetry }, 'Check again'));
      break;
    case 'fatal':
      card.append(title('Something went wrong'), h('p', null, state.error || 'Unknown error'), h('button', { class: 'btn btn-primary', onclick: onRetry }, 'Reload'));
      break;
    case 'choose-profile':
      card.append(title('Who is using this device?'),
        h('p', { class: 'muted' }, 'Pick your name. This device will remember it, and you can switch later in Settings.'),
        h('div', { class: 'profile-cards' }, PROFILE_IDS.map((p) => h('button', {
          class: ['profile-card', `profile-${p}`], onclick: () => onChooseProfile(p),
        }, h('span', { class: 'profile-initial', 'aria-hidden': 'true' }, PROFILES[p].initial), h('span', { class: 'profile-name' }, PROFILES[p].name)))),
        h('p', { class: 'muted small' }, 'This is not a login. It only decides whose progress this device updates.'));
      break;
    default:
      card.append(title(kind));
  }
  return wrap;
}
