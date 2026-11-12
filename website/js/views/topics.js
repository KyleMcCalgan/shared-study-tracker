// Topics / syllabus: two independent statuses per chapter, depth, notes,
// technical-example checklist, David's queue, links to sessions.
import {
  h, emptyState, progressBadge, personChip, tierChip,
} from '../ui.js';
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

export function renderTopics(root, param, rerender) {
  const topics = activeTopics(state.topics);
  root.append(h('div', { class: 'toolbar' }, h('h1', { class: 'view-title' }, 'Topics')));
  if (!topics.length) {
    root.append(emptyState('No topics yet', 'The schedule has not been imported into the database.', '📚'));
    return;
  }
  const search = h('input', {
    type: 'search', id: 'topic-search', class: 'search', placeholder: 'Search chapters, slides, examples…', value: query, 'aria-label': 'Search topics', dataset: { fk: 'topic-search' },
  });
  search.addEventListener('input', () => { query = search.value; renderList(); });
  root.append(h('div', { class: 'search-row' }, search),
    h('p', { class: 'muted small' }, `${state.workspace?.scope || ''} You can only change your own status (${PROFILES[state.profile].name}); switch profile in Settings.`));

  const listEl = h('div', { class: 'topic-groups' });
  root.append(listEl);

  const renderList = () => {
    listEl.replaceChildren();
    const q = query.trim().toLowerCase();
    const match = (t) => !q || [`ch ${t.chapter}`, t.title, t.group, ...(t.examples || []).map((e) => e.text)]
      .some((s) => String(s || '').toLowerCase().includes(q));
    const groups = state.workspace?.groups || [{ name: null, chapters: topics.map((t) => t.chapter) }];
    let shown = 0;
    for (const g of groups) {
      const items = topics.filter((t) => g.chapters.includes(t.chapter) && match(t));
      if (!items.length) continue;
      shown += items.length;
      listEl.append(h('section', { class: 'topic-group' },
        g.name && h('h2', { class: 'group-title' }, g.step ? `Step ${g.step}: ${g.name}` : g.name),
        items.map((t) => topicCard(t))));
    }
    const grouped = new Set(groups.flatMap((g) => g.chapters));
    const ungrouped = topics.filter((t) => !grouped.has(t.chapter) && match(t));
    if (ungrouped.length) listEl.append(h('section', { class: 'topic-group' }, h('h2', { class: 'group-title' }, 'Other topics'), ungrouped.map(topicCard)));
    const scheduled = new Set(visibleSessions(state.sessions).flatMap((s) => s.topicIds));
    const unscheduled = topics.filter((t) => !scheduled.has(t.id));
    if (unscheduled.length && !q) {
      listEl.append(h('section', { class: 'topic-group' }, h('h2', { class: 'group-title' }, 'Unscheduled topics'),
        h('p', { class: 'muted small' }, 'These chapters have no session yet.'), unscheduled.map((t) => h('p', null, `Ch ${t.chapter} ${t.title}`))));
    }
    if (!shown) listEl.append(emptyState('No matches', `Nothing matches "${query}".`));
    if (state.workspace?.excludedChapters?.length && !q) {
      listEl.append(h('p', { class: 'muted small excluded' }, `Not examinable: Chapter ${state.workspace.excludedChapters.join(', ')} (excluded from the exam scope, so it has no entry).`));
    }
  };
  renderList();
  root.append(queuePanel());

  if (param) {
    setTimeout(() => {
      const el = document.getElementById(param === 'queue' ? 'david-queue' : `topic-${param}`);
      if (el) { el.scrollIntoView({ block: 'start' }); el.classList.add('flash'); if (el.tagName === 'DETAILS') el.open = true; }
    }, 30);
  }
}

function statusControl(profileId, topic) {
  const p = getProgress(state.progressById, profileId, topic.id);
  const id = `st-${profileId}-${topic.id}`;
  return h('div', { class: 'field' },
    h('label', { for: id }, 'Status'),
    h('select', {
      id, class: ['status-select', `st-${p.status}`], dataset: { fk: id },
      onchange: (e) => actions.setProgressStatus(profileId, topic.id, e.target.value),
    }, PROGRESS_STATUSES.map((s) => h('option', { value: s.id, selected: s.id === p.status }, s.label))));
}

function depthControl(profileId, topic) {
  const p = getProgress(state.progressById, profileId, topic.id);
  const id = `dp-${profileId}-${topic.id}`;
  return h('div', { class: 'field' },
    h('label', { for: id }, 'Depth actually reached'),
    h('select', { id, dataset: { fk: id }, onchange: (e) => actions.setProgressDepth(profileId, topic.id, e.target.value) },
      DEPTHS.map((d) => h('option', { value: d.id, selected: d.id === (p.depth || 'none') }, d.label))));
}

function notesControl(profileId, topic) {
  const p = getProgress(state.progressById, profileId, topic.id);
  const id = `nt-${profileId}-${topic.id}`;
  const ta = h('textarea', { id, rows: 3, maxlength: LIMITS.notes, dataset: { fk: id }, placeholder: 'What clicked, what to revisit…' });
  ta.value = p.notes || '';
  let lastSaved = p.notes || '';
  const doSave = () => {
    if (ta.value === lastSaved) return;
    lastSaved = ta.value;
    save.disabled = true;
    actions.saveProgressNotes(profileId, topic.id, ta.value);
  };
  const save = h('button', { class: 'btn btn-sm', type: 'button', disabled: true, onclick: doSave }, 'Save note');
  ta.addEventListener('input', () => { save.disabled = ta.value === lastSaved; });
  // Save on blur or via the button. Never one write per keystroke.
  ta.addEventListener('blur', doSave);
  return h('details', { class: 'notes-box', dataset: { keep: `notes-${profileId}-${topic.id}` }, open: Boolean(p.notes) },
    h('summary', null, p.notes ? 'Your notes' : 'Add a note'),
    h('div', { class: 'field' }, h('label', { for: id, class: 'sr-only' }, 'Notes'), ta), save);
}

function personSummary(profileId, topic) {
  const p = getProgress(state.progressById, profileId, topic.id);
  const depth = DEPTHS.find((d) => d.id === (p.depth || 'none'));
  return h('div', { class: ['who-status', `who-${profileId}`] },
    personChip(profileId, { small: true }),
    progressBadge(p.status),
    p.depth && p.depth !== 'none' && h('span', { class: 'muted small' }, depth.label),
    p.completedAt && h('span', { class: 'muted small' }, `first pass ${formatTimestamp(p.completedAt)}`));
}

function topicCard(t) {
  const me = state.profile;
  const other = PROFILE_IDS.find((p) => p !== me);
  const sessions = sortSessions(visibleSessions(state.sessions).filter((s) => s.topicIds.includes(t.id) && s.type !== 'exam'));
  const otherP = getProgress(state.progressById, other, t.id);
  const jointDone = jointDoneForTopic(t, state.sessions);

  return h('article', { class: 'topic', id: `topic-${t.id}` },
    h('header', { class: 'topic-head' },
      h('h3', { class: 'topic-title' }, h('span', { class: 'topic-ch' }, `Ch ${t.chapter}`), t.title),
      h('p', { class: 'muted small' }, `${t.slides} slides · targets: Kyle ${t.targets.kyle}, David ${t.targets.david} · Kyle's estimate: ${t.hours.must} h MUST / ${t.hours.full} h full depth`)),
    h('div', { class: 'who-row' }, PROFILE_IDS.map((p) => personSummary(p, t))),
    h('div', { class: ['my-progress', `who-${me}`] },
      h('p', { class: 'my-progress-title' }, `Your progress (${PROFILES[me].name})`),
      h('div', { class: 'grid-2' }, statusControl(me, t), depthControl(me, t)),
      notesControl(me, t)),
    otherP.notes && h('details', { class: 'notes-box' }, h('summary', null, `${PROFILES[other].name}'s notes`), h('p', { class: 'pre' }, otherP.notes)),
    (t.examples || []).length > 0 && h('div', { class: 'examples' },
      h('p', { class: 'small' }, h('strong', null, 'Technical examples (revision checklist)')),
      h('ul', { class: 'task-list' }, t.examples.map((ex) => exampleRow(t, ex)))),
    h('p', { class: 'small' },
      h('strong', null, 'Joint discussion: '), `planned ${t.jointPlanned.join(', ') || 'none'} · `,
      jointDone ? h('span', { class: 'ok' }, '✓ a joint session covering it is marked done') : h('span', { class: 'muted' }, 'not yet done')),
    sessions.length > 0 && h('details', { class: 'topic-sessions', dataset: { keep: `ts-${t.id}` } },
      h('summary', null, `Planned sessions (${sessions.length})`),
      h('ul', null, sessions.map((s) => h('li', null,
        h('a', { href: `#schedule/${s.date}` }, formatShort(s.date)), ` · ${s.title} `,
        h('span', { class: 'muted small' }, `(${s.participants.map((p) => PROFILES[p].name).join(' + ')}${s.status !== 'planned' ? `, ${s.status}` : ''})`))))),
    h('div', { class: 'topic-actions' },
      h('button', { class: 'btn btn-sm', onclick: () => raiseDiscussionDialog({ topicIds: [t.id] }) }, '💬 Needs discussion…')));
}

function exampleRow(topic, ex) {
  const me = state.profile;
  const id = `ex-${me}-${ex.id}`;
  return h('li', { class: 'task' },
    h('input', {
      type: 'checkbox', id, class: 'task-check', dataset: { fk: id }, checked: isChecked(state.checksById, me, ex.id),
      onchange: (e) => actions.setCheck(me, ex.id, e.target.checked, `Ch ${topic.chapter} example: ${ex.text}`),
    }),
    h('label', { class: 'task-body', for: id }, h('span', { class: 'task-text' }, ex.text),
      ex.davidNote && h('span', { class: 'muted small' }, ` David: ${ex.davidNote}`)),
    h('span', { class: 'task-others' }, PROFILE_IDS.filter((p) => p !== me).map((p) => {
      const done = isChecked(state.checksById, p, ex.id);
      return h('span', { class: ['mini', `mini-${p}`, done && 'mini-done'], title: `${PROFILES[p].name}: ${done ? 'done' : 'not done'}` },
        `${PROFILES[p].initial} ${done ? '✓' : '·'}`);
    })));
}

function queuePanel() {
  const q = davidQueueStatus(state.workspace?.davidQueue, state.checksById);
  if (!q.items.length) return null;
  const canTick = state.profile === 'david';
  return h('details', { class: 'panel queue', id: 'david-queue', dataset: { keep: 'david-queue' }, open: state.profile === 'david' },
    h('summary', { class: 'panel-title' }, `David's queue: ${q.doneCount}/${q.items.length} items · ${q.doneHours}/${q.totalHours} h`),
    h('p', { class: 'muted small' }, 'Ordered queue from the schedule (§7.1). Tackle prerequisites first, but move on to newer chapters when time allows. Hours are estimates. E = exposure only, which never counts as a first pass.',
      !canTick && ' Switch to David\'s profile to tick items.'),
    q.lastDone && h('p', { class: 'small' }, `Last completed: ${q.lastDone.code} · Next: ${q.next ? `${q.next.code} ${q.next.item}` : 'queue complete'}`),
    h('ul', { class: 'task-list' }, q.items.map((item) => {
      const id = `q-${item.id}`;
      return h('li', { class: 'task' },
        canTick
          ? h('input', { type: 'checkbox', id, class: 'task-check', dataset: { fk: id }, checked: item.done, onchange: (e) => actions.setCheck('david', item.id, e.target.checked, `${item.code} ${item.item}`) })
          : h('span', { class: ['mini', 'mini-david', item.done && 'mini-done'] }, item.done ? '✓' : '·'),
        h('label', { class: 'task-body', for: canTick ? id : null },
          h('span', { class: 'task-head' }, tierChip('block', item.code), h('span', { class: 'muted small' }, `${item.depth} · ${item.hours} h`)),
          h('span', { class: 'task-text' }, item.item)));
    })));
}
