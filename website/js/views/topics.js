// Topics: every chapter with both people's status. Desktop: table + inline
// detail panel. Phone: progress summary, filter pills, chapter cards → sheet.
import {
  h, emptyState, avatar, statusLabel, statusStep, openDialog, sectionHead, filterPills, isDesktop, pill,
} from '../ui.js';
import { icon, booksArt } from '../icons.js';
import { state } from '../store.js';
import {
  PROFILES, PROFILE_IDS, PROGRESS_STATUSES, DEPTHS, LIMITS,
} from '../config.js';
import {
  activeTopics, getProgress, isChecked, davidQueueStatus, sortSessions, visibleSessions, jointDoneForTopic, computeStats, isFirstPassDone,
} from '../model.js';
import { formatShort, formatTimestamp } from '../date-utils.js';
import * as actions from '../actions.js';
import { raiseDiscussionDialog } from './discussions.js';

let query = '';
let filter = 'all';
let selectedTopic = null;

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'todo', label: 'To Do' },
  { id: 'progress', label: 'In Progress' },
  { id: 'done', label: 'Completed' },
];

const statusOf = (pid, t) => getProgress(state.progressById, pid, t.id).status;
const matchesQuery = (t) => {
  const q = query.trim().toLowerCase();
  return !q || [`ch ${t.chapter}`, `chapter ${t.chapter}`, t.title, t.group, ...(t.examples || []).map((e) => e.text)]
    .some((s) => String(s || '').toLowerCase().includes(q));
};
const matchesFilter = (t) => {
  const st = statusOf(state.profile, t);
  if (filter === 'todo') return st === 'not_started';
  if (filter === 'progress') return st === 'in_progress';
  if (filter === 'done') return isFirstPassDone(st);
  return true;
};

export function renderTopics(root, param, rerender) {
  const topics = activeTopics(state.topics);
  if (!topics.length) {
    root.append(emptyState('No chapters yet', 'The schedule has not been imported into the database.'));
    return;
  }
  const desktop = isDesktop();
  if (param && topics.some((t) => t.id === param)) selectedTopic = param;
  if (!topics.some((t) => t.id === selectedTopic)) selectedTopic = topics[0].id;

  const input = h('input', {
    type: 'search', id: 'topic-search', placeholder: 'Search chapters', value: query, 'aria-label': 'Search chapters and examples', dataset: { fk: 'topic-search' },
  });
  const search = h('div', { class: 'search' }, icon('search', { size: 18 }), input);
  const list = h('div', { class: 'chapter-list' });
  const renderList = () => {
    const shown = topics.filter(matchesQuery).filter((t) => desktop || matchesFilter(t));
    const none = h('p', { class: 'muted empty-row' }, query ? `No chapter matches "${query}".` : 'No chapters in this group.');
    if (desktop) list.replaceChildren(chapterTable(shown, rerender, none));
    else list.replaceChildren(...(shown.length ? shown.map(chapterCard) : [none]));
  };
  input.addEventListener('input', () => { query = input.value; renderList(); });
  renderList();

  const extras = [queuePanel(), unscheduledNote(topics)].filter(Boolean);
  if (desktop) {
    root.append(sectionHead('Chapter overview', `Track ${PROFILES.kyle.name} and ${PROFILES.david.name} independently`, search));
    root.append(h('div', { class: 'split split-topics' },
      h('div', { class: 'split-main' },
        h('section', { class: 'card table-card', 'aria-labelledby': 'all-h' },
          h('div', { class: 'card-head' }, h('div', { class: 'card-head-text' }, h('h2', { class: 'card-title', id: 'all-h' }, 'All chapters')),
            h('span', { class: 'card-meta muted' }, 'Progress updates in real time')),
          list),
        extras),
      h('aside', { class: 'card detail-card', 'aria-label': 'Selected chapter' }, chapterDetail(selectedTopic, { inline: true }))));
  } else {
    root.append(overallCard());
    root.append(filterPills({ label: 'Show chapters', options: FILTERS, value: filter, onChange: (id) => { filter = id; rerender(); } }));
    root.append(search, list, ...extras);
  }

  if (param === 'queue') {
    setTimeout(() => { const el = document.getElementById('david-queue'); if (el) { el.open = true; el.scrollIntoView({ block: 'start' }); } }, 30);
  } else if (param && !desktop && topics.some((t) => t.id === param)) {
    setTimeout(() => openChapter(param), 30);
  }
}

// ---------------------------------------------------------------- phone

function overallCard() {
  return h('section', { class: 'card hero overall-card', 'aria-labelledby': 'overall-h' },
    booksArt('overall-art'),
    h('div', { class: 'overall-text' },
      h('h2', { class: 'overall-title', id: 'overall-h' }, 'Overall Progress'),
      PROFILE_IDS.map((p) => {
        const st = computeStats(state.topics, state.progressById, p);
        return h('p', { class: 'overall-line', 'data-test': `overall-${p}` }, `${PROFILES[p].name}: `, h('b', null, String(st.firstPass)), ` / ${st.total} chapters (${st.pct}%)`);
      })));
}

function stateIcon(status) {
  if (isFirstPassDone(status)) return h('span', { class: 'ch-state is-done', 'aria-hidden': 'true' }, icon('check', { size: 26, stroke: 2.4 }));
  if (status === 'in_progress') return h('span', { class: 'ch-state is-prog', 'aria-hidden': 'true' }, icon('progress', { size: 26 }));
  return h('span', { class: 'ch-state', 'aria-hidden': 'true' }, icon('square', { size: 28, stroke: 2 }));
}

function chapterCard(t) {
  return h('button', {
    class: 'ch-card', type: 'button', id: `tile-${t.id}`, 'data-test': `chapter-${t.id}`, onclick: () => openChapter(t.id),
    'aria-label': `Chapter ${t.chapter}, ${t.title}. ${PROFILE_IDS.map((p) => `${PROFILES[p].name}: ${PROGRESS_STATUSES.find((s) => s.id === statusOf(p, t)).label}`).join('. ')}`,
  },
  stateIcon(statusOf(state.profile, t)),
  h('span', { class: 'ch-body' },
    h('span', { class: 'ch-title' }, `Ch ${t.chapter} – ${t.title}`),
    PROFILE_IDS.map((p) => {
      const st = statusOf(p, t);
      return h('span', { class: ['ch-row', `who-${p}`] },
        h('span', { class: 'ch-who' }, PROFILES[p].name),
        h('span', { class: 'bar bar-sm', 'aria-hidden': 'true' }, h('span', { style: `width:${statusStep(st) * 25}%` })),
        statusLabel(st, { short: true, forProfile: p, dot: false }));
    })),
  icon('chevron', { size: 22, cls: 'chev' }));
}

// ---------------------------------------------------------------- desktop

function chapterTable(shown, rerender, none) {
  if (!shown.length) return none;
  return h('table', { class: 'ch-table' },
    h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Chapter'), PROFILE_IDS.map((p) => h('th', { scope: 'col' }, PROFILES[p].name)))),
    h('tbody', null, shown.map((t) => {
      const sel = t.id === selectedTopic;
      const pick = () => { selectedTopic = t.id; rerender(); };
      return h('tr', { class: sel && 'is-selected', id: `tile-${t.id}`, 'data-test': `chapter-${t.id}`, onclick: pick },
        h('th', { scope: 'row' }, h('button', { type: 'button', class: 'ch-pick', 'aria-pressed': String(sel), onclick: (e) => { e.stopPropagation(); pick(); } },
          h('b', null, `Chapter ${t.chapter}`), h('span', { class: 'muted' }, t.title))),
        PROFILE_IDS.map((p) => h('td', { class: `who-${p}` }, statusLabel(statusOf(p, t), { short: true, forProfile: p }))));
    })));
}

// ---------------------------------------------------------------- detail (panel and sheet)

/** Chapter detail sheet. Live: updates while open if either person changes something. */
export function openChapter(topicId) {
  const t0 = state.topics.find((x) => x.id === topicId);
  if (!t0) return null;
  return openDialog({
    title: `Ch ${t0.chapter} · ${t0.title}`,
    wide: true,
    live: true,
    build: (close) => chapterDetail(topicId, { close }),
  });
}

function chapterDetail(topicId, { inline = false, close = () => {} } = {}) {
  const t = state.topics.find((x) => x.id === topicId);
  if (!t) return emptyState('Chapter not found', null);
  const me = state.profile;
  const other = PROFILE_IDS.find((p) => p !== me);
  const mineP = getProgress(state.progressById, me, t.id);
  const otherP = getProgress(state.progressById, other, t.id);
  const sessions = sortSessions(visibleSessions(state.sessions).filter((s) => s.topicIds.includes(t.id) && s.type !== 'exam'));
  const depthLabel = (p) => DEPTHS.find((d) => d.id === (p.depth || 'none')).label;

  const person = (p) => {
    const pr = getProgress(state.progressById, p, t.id);
    return h('div', { class: ['detail-block', `who-${p}`], 'data-test': `who-${p}` },
      h('h3', { class: 'detail-h' }, p === me ? `${PROFILES[p].name}'s progress (you)` : `${PROFILES[p].name}'s progress`),
      h('div', { class: 'detail-status' },
        statusLabel(pr.status, { forProfile: p }),
        pr.depth && pr.depth !== 'none' && h('span', { class: 'muted' }, depthLabel(pr)),
        h('span', { class: 'grow' }),
        pr.completedAt && h('span', { class: 'small muted' }, `First pass ${formatTimestamp(pr.completedAt)}`)),
      p === me && h('div', { class: 'status-pick', role: 'radiogroup', 'aria-label': 'Your status for this chapter' }, PROGRESS_STATUSES.map((s) => h('button', {
        type: 'button', role: 'radio', class: 'pick', 'aria-checked': String(s.id === mineP.status), id: `st-${me}-${t.id}-${s.id}`, dataset: { fk: `st-${me}-${t.id}-${s.id}` },
        onclick: () => actions.setProgressStatus(me, t.id, s.id),
      }, statusLabel(s.id)))),
      p !== me && otherP.notes && h('p', { class: 'note-box pre' }, h('b', null, `${PROFILES[other].name}'s notes: `), otherP.notes));
  };

  return h('div', { class: ['chapter-detail', inline && 'is-inline'], id: `topic-${t.id}`, 'data-test': 'chapter-detail' },
    inline && pill('Selected chapter', 'green', { class: 'pill-lg' }),
    inline && h('h2', { class: 'detail-title' }, `Chapter ${t.chapter}`),
    h('p', { class: 'detail-sub' }, inline ? t.title : t.group),
    inline && t.group !== t.title && h('p', { class: 'small muted' }, t.group),
    person(me),
    person(other),

    h('div', { class: 'detail-block' },
      h('h3', { class: 'detail-h', id: `dp-h-${t.id}` }, 'Understanding depth'),
      h('div', { class: 'depth-pick', role: 'radiogroup', 'aria-labelledby': `dp-h-${t.id}` }, DEPTHS.map((d) => h('button', {
        type: 'button', role: 'radio', class: 'pick', 'aria-checked': String(d.id === (mineP.depth || 'none')), id: `dp-${me}-${t.id}-${d.id}`, dataset: { fk: `dp-${me}-${t.id}-${d.id}` },
        onclick: () => actions.setProgressDepth(me, t.id, d.id),
      }, d.label))),
      notesField(me, t, mineP)),

    (t.examples || []).length > 0 && h('div', { class: 'detail-block' },
      h('h3', { class: 'detail-h' }, 'Technical examples'),
      h('ul', { class: 'tasks' }, t.examples.map((ex) => exampleRow(t, ex)))),

    h('div', { class: 'detail-block facts' },
      h('p', null, h('b', null, `${t.slides} slides`), ` · ${PROFILES.kyle.name} aims for ${t.targets.kyle}, ${PROFILES.david.name} for ${t.targets.david}`),
      h('p', null, `Estimate: ${t.hours.must} h for MUST, ${t.hours.full} h for full depth`),
      h('p', null, h('b', null, 'Joint: '), `${t.jointPlanned.join(', ') || 'none planned'} · `,
        jointDoneForTopic(t, state.sessions) ? 'discussed together ✓' : 'not discussed yet')),

    sessions.length > 0 && h('div', { class: 'detail-block' },
      h('h3', { class: 'detail-h' }, 'In the plan'),
      h('ul', { class: 'link-list' }, sessions.map((s) => h('li', null, h('a', { class: 'row-link', href: `#schedule/${s.date}`, onclick: () => close() },
        h('span', { class: 'grow' }, h('b', null, `${formatShort(s.date)} · ${s.title}`),
          h('span', { class: 'small muted' }, `${s.participants.map((p) => PROFILES[p].name).join(' + ')}${s.status !== 'planned' ? ` · ${s.status}` : ''}`)),
        icon('chevron', { size: 18, cls: 'chev' })))))),

    h('button', { class: 'btn btn-primary btn-block', type: 'button', onclick: () => { close(); raiseDiscussionDialog({ topicIds: [t.id] }); } },
      icon('chat', { size: 18 }), 'Raise for discussion…'));
}

function notesField(me, t, p) {
  const id = `nt-${me}-${t.id}`;
  const ta = h('textarea', { id, rows: 3, maxlength: LIMITS.notes, dataset: { fk: id }, placeholder: 'What clicked, what to revisit…' });
  ta.value = p.notes || '';
  let lastSaved = p.notes || '';
  const save = h('button', { class: 'btn btn-soft btn-sm', type: 'button', disabled: true }, 'Save note');
  const doSave = () => {
    if (ta.value === lastSaved) return;
    lastSaved = ta.value;
    save.disabled = true;
    actions.saveProgressNotes(me, t.id, ta.value);
  };
  save.addEventListener('click', doSave);
  ta.addEventListener('input', () => { save.disabled = ta.value === lastSaved; });
  ta.addEventListener('blur', doSave); // saves on blur or button; never per keystroke
  return h('div', { class: 'field' }, h('label', { for: id }, 'Your notes'), ta, h('div', { class: 'field-actions' }, save));
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
    h('label', { for: id, class: 'task-main task-label' },
      h('span', { class: 'task-name' }, ex.text),
      ex.davidNote && h('span', { class: 'task-sub' }, `David: ${ex.davidNote}`)),
    h('span', { class: 'task-others' }, h('span', { class: ['who-done', other, otherDone && 'on'], title: `${PROFILES[other].name}: ${otherDone ? 'done' : 'not yet'}` },
      PROFILES[other].initial, h('span', { class: 'sr-only' }, `${PROFILES[other].name} ${otherDone ? 'done' : 'not yet'}`))));
}

// ---------------------------------------------------------------- extras

function unscheduledNote(topics) {
  const scheduled = new Set(visibleSessions(state.sessions).flatMap((s) => s.topicIds));
  const unscheduled = topics.filter((t) => !scheduled.has(t.id));
  const excluded = state.workspace?.excludedChapters || [];
  if (!unscheduled.length && !excluded.length) return null;
  return h('div', { class: 'notes-foot' },
    unscheduled.length > 0 && h('p', null, h('b', null, 'Unscheduled topics: '), unscheduled.map((t) => `Ch ${t.chapter} ${t.title}`).join(' · ')),
    excluded.length > 0 && h('p', { class: 'small muted' }, `Chapter ${excluded.join(', ')} is excluded from the exam, so it isn't listed.`));
}

function queuePanel() {
  const q = davidQueueStatus(state.workspace?.davidQueue, state.checksById);
  if (!q.items.length) return null;
  const canTick = state.profile === 'david';
  return h('details', { class: 'card queue-card', id: 'david-queue', dataset: { keep: 'david-queue' }, open: state.profile === 'david' },
    h('summary', { class: 'queue-summary' },
      avatar('david', 'sm'),
      h('span', { class: 'grow' }, h('span', { class: 'card-title' }, `${PROFILES.david.name}'s queue`),
        h('span', { class: 'small muted' }, `${q.doneCount} of ${q.items.length} · ${q.doneHours} of ${q.totalHours} h${q.next ? ` · next ${q.next.code}` : ' · complete'}`)),
      icon('chevron', { size: 20, cls: 'chev' })),
    h('p', { class: 'small muted queue-intro' }, 'Checklist from the schedule, in order: prerequisites first, newer chapters whenever there\'s time. Add your own sessions on the Schedule tab for open days, and tick items here as you finish them. E means exposure only, never counted as a first pass.',
      !canTick && ` Only ${PROFILES.david.name} can tick these.`),
    h('ul', { class: 'tasks' }, q.items.map((item) => {
      const id = `q-${item.id}`;
      return h('li', { class: ['task', item.done && 'is-done'] },
        canTick
          ? h('input', { type: 'checkbox', id, class: 'tick tick-david', dataset: { fk: id }, checked: item.done, 'aria-label': `${item.code} done`, onchange: (e) => actions.setCheck('david', item.id, e.target.checked, `${item.code} ${item.item}`) })
          : h('span', { class: 'tick-spacer' }),
        h('label', { class: 'task-main task-label', for: canTick ? id : null },
          h('span', { class: 'task-name' }, `${item.code} · ${item.item.split(':')[0]}`),
          h('span', { class: 'task-sub' }, `${item.depth === 'E' ? 'Exposure' : 'MV'} · ${item.hours} h${item.item.includes(':') ? ` · ${item.item.split(':').slice(1).join(':').trim()}` : ''}`)),
        !canTick ? h('span', { class: 'task-others' }, h('span', { class: ['who-done', 'david', item.done && 'on'], title: `${PROFILES.david.name}: ${item.done ? 'done' : 'not yet'}` }, 'D')) : h('span'));
    })));
}

