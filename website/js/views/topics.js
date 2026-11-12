// Topics: 12 chapter tiles (both people's status at a glance) → chapter sheet.
import {
  h, emptyState, avatar, statusLabel, openDialog, secHead,
} from '../ui.js';
import { icon } from '../icons.js';
import { state } from '../store.js';
import {
  PROFILES, PROFILE_IDS, PROGRESS_STATUSES, DEPTHS, LIMITS,
} from '../config.js';
import {
  activeTopics, getProgress, isChecked, davidQueueStatus, sortSessions, visibleSessions, jointDoneForTopic,
} from '../model.js';
import { formatShort, formatTimestamp } from '../date-utils.js';
import * as actions from '../actions.js';
import { raiseDiscussionDialog } from './discussions.js';

let query = '';

export function renderTopics(root, param) {
  const topics = activeTopics(state.topics);
  root.append(h('h1', { class: 'page-title' }, 'Chapters'));
  if (!topics.length) {
    root.append(emptyState('No chapters yet', 'The schedule has not been imported into the database.'));
    return;
  }
  const input = h('input', {
    type: 'search', id: 'topic-search', placeholder: 'Search chapters and examples', value: query, 'aria-label': 'Search chapters', dataset: { fk: 'topic-search' },
  });
  const grid = h('div', { class: 'tiles' });
  const renderGrid = () => {
    const q = query.trim().toLowerCase();
    const match = (t) => !q || [`ch ${t.chapter}`, `chapter ${t.chapter}`, t.title, t.group, ...(t.examples || []).map((e) => e.text)]
      .some((s) => String(s || '').toLowerCase().includes(q));
    const shown = topics.filter(match);
    grid.replaceChildren(...(shown.length ? shown.map(tile) : [h('p', { class: 'muted' }, `No chapter matches "${query}".`)]));
  };
  input.addEventListener('input', () => { query = input.value; renderGrid(); });
  renderGrid();
  root.append(h('div', { class: 'search' }, icon('search', { size: 18 }), input), grid);

  const scheduled = new Set(visibleSessions(state.sessions).flatMap((s) => s.topicIds));
  const unscheduled = topics.filter((t) => !scheduled.has(t.id));
  if (unscheduled.length) {
    root.append(h('section', null, secHead('Unscheduled'), h('p', { class: 'muted' }, unscheduled.map((t) => `Ch ${t.chapter} ${t.title}`).join(' · '))));
  }
  if (state.workspace?.excludedChapters?.length) {
    root.append(h('p', { class: 'small muted' }, `Chapter ${state.workspace.excludedChapters.join(', ')} is excluded from the exam, so it isn't listed.`));
  }
  const queue = queuePanel();
  if (queue) root.append(queue);

  if (param === 'queue') {
    setTimeout(() => { const el = document.getElementById('david-queue'); if (el) { el.open = true; el.scrollIntoView({ block: 'start' }); } }, 30);
  } else if (param && topics.some((t) => t.id === param)) {
    setTimeout(() => openChapter(param), 30);
  }
}

function tile(t) {
  return h('button', {
    class: 'tile', id: `tile-${t.id}`, type: 'button', onclick: () => openChapter(t.id),
    'aria-label': `Chapter ${t.chapter}, ${t.title}. ${PROFILE_IDS.map((p) => `${PROFILES[p].name}: ${PROGRESS_STATUSES.find((s) => s.id === getProgress(state.progressById, p, t.id).status).label}`).join('. ')}`,
  },
  h('span', { class: 'tile-num' }, String(t.chapter)),
  h('span', { class: 'tile-title' }, t.title),
  h('span', { class: 'tile-people' }, PROFILE_IDS.map((p) => h('span', { class: ['tile-person', `who-${p}`] },
    avatar(p, 'xs'), statusLabel(getProgress(state.progressById, p, t.id).status, { short: true })))));
}

/** Chapter detail sheet. Live: updates while open if either person changes something. */
export function openChapter(topicId) {
  const t0 = state.topics.find((x) => x.id === topicId);
  if (!t0) return null;
  return openDialog({
    title: `Ch ${t0.chapter} · ${t0.title}`,
    wide: true,
    live: true,
    build: (close) => {
      const t = state.topics.find((x) => x.id === topicId) || t0;
      const me = state.profile;
      const other = PROFILE_IDS.find((p) => p !== me);
      const mineP = getProgress(state.progressById, me, t.id);
      const otherP = getProgress(state.progressById, other, t.id);
      const sessions = sortSessions(visibleSessions(state.sessions).filter((s) => s.topicIds.includes(t.id) && s.type !== 'exam'));
      const depthLabel = (p) => DEPTHS.find((d) => d.id === (p.depth || 'none')).label;

      return h('div', { class: 'stack', id: `topic-${t.id}`, style: 'gap:1.2rem' },
        // both people
        h('div', { class: 'stack', style: 'gap:.5rem' }, PROFILE_IDS.map((p) => {
          const pr = getProgress(state.progressById, p, t.id);
          return h('div', { class: ['row', `who-${p}`] }, avatar(p, 'sm'),
            h('span', { class: 'grow' }, h('b', null, PROFILES[p].name), ' ', statusLabel(pr.status),
              pr.depth && pr.depth !== 'none' && h('span', { class: 'small muted' }, ` · ${depthLabel(pr)}`)),
            pr.completedAt && h('span', { class: 'small muted' }, formatTimestamp(pr.completedAt)));
        })),

        // my status
        h('div', { class: 'stack', style: 'gap:.5rem' },
          h('p', { class: 'eyebrow' }, `Your progress · ${PROFILES[me].name}`),
          h('div', { class: 'status-pick', role: 'radiogroup', 'aria-label': 'Your status for this chapter' }, PROGRESS_STATUSES.map((s) => h('button', {
            type: 'button', role: 'radio', 'aria-checked': String(s.id === mineP.status), id: `st-${me}-${t.id}-${s.id}`, dataset: { fk: `st-${me}-${t.id}-${s.id}` },
            onclick: () => actions.setProgressStatus(me, t.id, s.id),
          }, statusLabel(s.id))))),
        h('div', { class: 'field' },
          h('label', { for: `dp-${me}-${t.id}` }, 'Depth you actually reached'),
          h('select', { id: `dp-${me}-${t.id}`, dataset: { fk: `dp-${me}-${t.id}` }, onchange: (e) => actions.setProgressDepth(me, t.id, e.target.value) },
            DEPTHS.map((d) => h('option', { value: d.id, selected: d.id === (mineP.depth || 'none') }, d.label)))),
        notesField(me, t, mineP),
        otherP.notes && h('div', { class: 'user-note' }, h('b', null, `${PROFILES[other].name}'s notes: `), h('span', { class: 'pre' }, otherP.notes)),

        // technical examples
        (t.examples || []).length > 0 && h('div', { class: 'stack', style: 'gap:.3rem' },
          h('p', { class: 'eyebrow' }, 'Technical examples'),
          h('ul', { class: 'tasks' }, t.examples.map((ex) => exampleRow(t, ex)))),

        // facts
        h('div', { class: 'card-flat stack', style: 'gap:.4rem' },
          h('p', { class: 'small' }, h('b', null, `${t.slides} slides`), ` · Kyle aims for ${t.targets.kyle}, David for ${t.targets.david}`),
          h('p', { class: 'small' }, `Estimate: ${t.hours.must} h for MUST, ${t.hours.full} h for full depth`),
          h('p', { class: 'small' }, h('b', null, 'Joint: '), `${t.jointPlanned.join(', ') || 'none planned'} · `,
            jointDoneForTopic(t, state.sessions) ? 'discussed together ✓' : 'not discussed yet')),

        // sessions
        sessions.length > 0 && h('div', { class: 'stack', style: 'gap:.3rem' },
          h('p', { class: 'eyebrow' }, 'In the plan'),
          h('div', { class: 'list-rows' }, sessions.map((s) => h('a', { class: 'list-row', href: `#schedule/${s.date}`, onclick: () => close() },
            h('span', { class: 'grow' }, h('b', null, `${formatShort(s.date)} · ${s.title}`),
              h('span', { class: 'small muted' }, `${s.participants.map((p) => PROFILES[p].name).join(' + ')}${s.status !== 'planned' ? ` · ${s.status}` : ''}`)),
            icon('chevron', { size: 18 }))))),

        h('button', { class: 'btn btn-block', type: 'button', onclick: () => { close(); raiseDiscussionDialog({ topicIds: [t.id] }); } }, 'Raise for discussion…'));
    },
  });
}

function notesField(me, t, p) {
  const id = `nt-${me}-${t.id}`;
  const ta = h('textarea', { id, rows: 3, maxlength: LIMITS.notes, dataset: { fk: id }, placeholder: 'What clicked, what to revisit…' });
  ta.value = p.notes || '';
  let lastSaved = p.notes || '';
  const save = h('button', { class: 'btn btn-sm', type: 'button', disabled: true }, 'Save note');
  const doSave = () => {
    if (ta.value === lastSaved) return;
    lastSaved = ta.value;
    save.disabled = true;
    actions.saveProgressNotes(me, t.id, ta.value);
  };
  save.addEventListener('click', doSave);
  ta.addEventListener('input', () => { save.disabled = ta.value === lastSaved; });
  ta.addEventListener('blur', doSave); // saves on blur or button; never per keystroke
  return h('div', { class: 'field' }, h('label', { for: id }, 'Your notes'), ta, h('div', null, save));
}

function exampleRow(topic, ex) {
  const me = state.profile;
  const id = `ex-${me}-${ex.id}`;
  const done = isChecked(state.checksById, me, ex.id);
  const other = PROFILE_IDS.find((p) => p !== me);
  const otherDone = isChecked(state.checksById, other, ex.id);
  return h('li', { class: ['task', done && 'is-done'] },
    h('input', {
      type: 'checkbox', id, class: ['tick', `tick-${me}`], dataset: { fk: id }, checked: done, 'aria-label': `${ex.text} done`,
      onchange: (e) => actions.setCheck(me, ex.id, e.target.checked, `Ch ${topic.chapter} example: ${ex.text}`),
    }),
    h('label', { for: id, class: 'task-main', style: 'padding:.55rem 0;cursor:pointer' },
      h('span', { class: 'task-name', style: 'font-size:.95rem' }, ex.text),
      ex.davidNote && h('span', { class: 'task-sub' }, `David: ${ex.davidNote}`)),
    h('span', { class: 'task-others' }, h('span', { class: ['who-done', other, otherDone && 'on'], title: `${PROFILES[other].name}: ${otherDone ? 'done' : 'not yet'}` }, PROFILES[other].initial)));
}

function queuePanel() {
  const q = davidQueueStatus(state.workspace?.davidQueue, state.checksById);
  if (!q.items.length) return null;
  const canTick = state.profile === 'david';
  return h('details', { class: 'card', id: 'david-queue', dataset: { keep: 'david-queue' }, open: state.profile === 'david' },
    h('summary', { style: 'cursor:pointer;list-style:none' },
      h('div', { class: 'row' }, avatar('david', 'sm'),
        h('div', { class: 'grow' }, h('b', { style: 'font-family:var(--display);font-size:1.15rem' }, 'David\'s queue'),
          h('p', { class: 'small muted' }, `${q.doneCount} of ${q.items.length} · ${q.doneHours} of ${q.totalHours} h${q.next ? ` · next ${q.next.code}` : ' · complete'}`)),
        icon('chevron', { size: 18 }))),
    h('p', { class: 'small muted', style: 'margin:.6rem 0' }, 'Ordered queue from the schedule. Prerequisites first, newer chapters whenever there\'s time. E means exposure only, never counted as a first pass.',
      !canTick && ' Switch to David\'s profile to tick.'),
    h('ul', { class: 'tasks' }, q.items.map((item) => {
      const id = `q-${item.id}`;
      return h('li', { class: ['task', item.done && 'is-done'] },
        canTick
          ? h('input', { type: 'checkbox', id, class: 'tick tick-david', dataset: { fk: id }, checked: item.done, 'aria-label': `${item.code} done`, onchange: (e) => actions.setCheck('david', item.id, e.target.checked, `${item.code} ${item.item}`) })
          : h('span', { class: 'tick-spacer' }),
        h('label', { class: 'task-main', for: canTick ? id : null, style: 'padding:.55rem 0' },
          h('span', { class: 'task-name' }, `${item.code} · ${item.item.split(':')[0]}`),
          h('span', { class: 'task-sub' }, `${item.depth === 'E' ? 'Exposure' : 'MV'} · ${item.hours} h${item.item.includes(':') ? ` · ${item.item.split(':').slice(1).join(':').trim()}` : ''}`)),
        !canTick ? h('span', { class: 'task-others' }, h('span', { class: ['who-done', 'david', item.done && 'on'] }, 'D')) : h('span'));
    })));
}
