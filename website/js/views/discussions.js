// Shared discussion queue. Marking an item discussed never changes progress.
// Desktop: list + inline detail panel. Phone: summary, filter pills, cards → sheet.
import {
  h, emptyState, openDialog, fieldError, filterPills, sectionHead, isDesktop, pill,
} from '../ui.js';
import { icon, bubblesArt } from '../icons.js';
import { state } from '../store.js';
import {
  PROFILES, DISCUSSION_STATUSES, DISCUSSION_KINDS, LIMITS,
} from '../config.js';
import {
  sortDiscussions, activeTopics, validateDiscussionInput, sortSessions, visibleSessions,
} from '../model.js';
import { formatShort, formatTimestamp } from '../date-utils.js';
import * as actions from '../actions.js';
import { topicLink, chaptersText } from './session-card.js';

let tab = null; // open | deferred | discussed | all
let selectedId = null;

const STATUS_PILL = { open: ['Open', 'pink'], deferred: ['Deferred', 'grey'], discussed: ['Discussed', 'green'] };
const TAG = { open: ['To discuss', 'pink'], deferred: ['Deferred', 'grey'], discussed: ['Discussed', 'green'] };
const raisedText = (d) => (d.raisedBy ? PROFILES[d.raisedBy]?.name ?? d.raisedBy : 'From the schedule');
const chapterLine = (d) => {
  if (!d.topicIds?.length) return 'General';
  if (d.topicIds.length === 1) {
    const t = state.topics.find((x) => x.id === d.topicIds[0]);
    return t ? `Ch ${t.chapter} – ${t.title}` : d.topicIds[0];
  }
  return chaptersText(d.topicIds);
};

export function renderDiscussions(root, param, rerender) {
  const desktop = isDesktop();
  if (!tab) tab = desktop ? 'open' : 'all';
  const all = sortDiscussions(state.discussions);
  const count = (id) => all.filter((d) => d.status === id).length;
  if (param && all.some((d) => d.id === param)) selectedId = param;
  const items = tab === 'all' ? all : all.filter((d) => d.status === tab);
  if (!items.some((d) => d.id === selectedId)) selectedId = items[0]?.id ?? all[0]?.id ?? null;
  const select = (id) => { selectedId = id; if (desktop) rerender(); else openDiscussion(id); };

  const options = desktop
    ? [{ id: 'open', label: 'To Discuss' }, { id: 'deferred', label: 'Deferred' }, { id: 'discussed', label: 'Discussed' }, { id: 'all', label: 'All' }]
    : [{ id: 'all', label: `All (${all.length})` }, ...DISCUSSION_STATUSES.map((s) => ({ id: s.id, label: `${s.label} (${count(s.id)})` }))];
  const pills = filterPills({ label: 'Filter discussions', options, value: tab, onChange: (id) => { tab = id; rerender(); } });
  const empty = emptyState(tab === 'open' ? 'Nothing to discuss' : tab === 'all' ? 'No discussion items yet' : `Nothing ${tab}`,
    ['open', 'all'].includes(tab) ? 'Add questions or tricky topics you want to go through together.' : null);
  const note = h('p', { class: 'small muted list-note' }, 'Marking something discussed never marks a chapter as complete.');

  if (desktop) {
    root.append(sectionHead('Shared discussion queue', 'Questions to work through together',
      h('button', { class: 'btn btn-primary btn-add', type: 'button', onclick: () => raiseDiscussionDialog({}) }, icon('plus', { size: 20 }), 'Add Topic')));
    const selected = all.find((d) => d.id === selectedId);
    root.append(h('div', { class: 'split split-discuss' },
      h('section', { class: 'card disc-list-card', 'aria-label': 'Discussion queue' },
        pills,
        items.length ? h('ul', { class: 'disc-list' }, items.map((d) => discussionRow(d, select))) : empty,
        h('button', { class: 'add-row', type: 'button', onclick: () => raiseDiscussionDialog({}) },
          h('b', null, '+ Add another question'), h('span', { class: 'muted' }, 'Keep a running list for your next shared session')),
        note),
      h('aside', { class: 'card detail-card', 'aria-label': 'Selected discussion' },
        selected ? discussionDetail(selected, { inline: true }) : emptyState('Nothing selected', 'Pick a question on the left.'))));
  } else {
    const open = count('open');
    root.append(h('section', { class: 'card hero disc-hero', 'aria-labelledby': 'dq-hero-h' },
      h('div', { class: 'hero-text' },
        h('h2', { class: 'hero-label', id: 'dq-hero-h' }, 'Discussion Queue'),
        h('p', { class: 'hero-big' }, `${open} open topic${open === 1 ? '' : 's'}`),
        h('p', { class: 'hero-sub muted' }, `${count('deferred')} deferred · ${count('discussed')} discussed`)),
      bubblesArt('hero-art')));
    root.append(pills);
    root.append(items.length ? h('ul', { class: 'disc-cards' }, items.map((d) => h('li', null, discussionCard(d, select)))) : empty);
    root.append(h('button', { class: 'btn btn-primary btn-block btn-lg', type: 'button', onclick: () => raiseDiscussionDialog({}) },
      icon('plus', { size: 24 }), 'Add Discussion Topic'), note);
  }

  if (param && !desktop && all.some((d) => d.id === param)) setTimeout(() => openDiscussion(param), 30);
}

// ---------------------------------------------------------------- list items

function discussionRow(d, select) {
  const [label, kind] = STATUS_PILL[d.status] || [d.status, 'grey'];
  const sel = d.id === selectedId;
  return h('li', null, h('button', {
    class: ['disc-row', sel && 'is-selected'], type: 'button', id: `disc-${d.id}`, 'data-test': 'discussion', 'aria-pressed': String(sel), onclick: () => select(d.id),
  },
  h('span', { class: 'disc-row-title' }, d.title, d.priority === 'high' && pill('High', 'terra')),
  h('span', { class: 'disc-row-sub' }, h('span', { class: 'muted' }, `${chapterLine(d)} · ${raisedText(d)}`), pill(label, kind, { 'data-test': 'discussion-status' }))));
}

function discussionCard(d, select) {
  const [label, kind] = STATUS_PILL[d.status] || [d.status, 'grey'];
  return h('button', { class: ['disc-card-m', `disc-${d.status}`], type: 'button', id: `disc-${d.id}`, 'data-test': 'discussion', onclick: () => select(d.id) },
    h('span', { class: `disc-icon icon-${kind}`, 'aria-hidden': 'true' }, icon('chat', { size: 26, stroke: 1.8 })),
    h('span', { class: 'disc-body' },
      h('span', { class: 'disc-title' }, d.title),
      h('span', { class: 'disc-chapter muted' }, chapterLine(d)),
      h('span', { class: 'disc-meta' }, pill(label, kind, { 'data-test': 'discussion-status' }), d.priority === 'high' && pill('High', 'terra'),
        h('span', { class: 'disc-who' }, icon(d.raisedBy ? 'user' : 'users', { size: 20, stroke: 1.6 }), raisedText(d)))),
    icon('chevron', { size: 22, cls: 'chev' }));
}

// ---------------------------------------------------------------- detail (panel and sheet)

function openDiscussion(id) {
  const d0 = state.discussions.find((x) => x.id === id);
  if (!d0) return null;
  return openDialog({
    title: 'Discussion',
    wide: true,
    live: true,
    build: () => {
      const d = state.discussions.find((x) => x.id === id);
      return d ? discussionDetail(d, {}) : emptyState('This item was removed', null);
    },
  });
}

function discussionDetail(d, { inline = false } = {}) {
  const kind = DISCUSSION_KINDS.find((k) => k.id === d.kind);
  const session = d.sessionId ? state.sessions.find((s) => s.id === d.sessionId) : null;
  const me = PROFILES[state.profile].name;
  const setStatus = (status) => actions.updateDiscussion(d, { status }, `${me} marked "${d.title.slice(0, 80)}" as ${status}`);
  const [tag, tagKind] = TAG[d.status] || [d.status, 'grey'];

  const notesId = `dn-${d.id}`;
  const ta = h('textarea', { id: notesId, rows: 3, maxlength: LIMITS.notes, dataset: { fk: notesId }, placeholder: 'Add an explanation, useful example or resolution…' });
  ta.value = d.notes || '';
  let lastSaved = d.notes || '';
  const save = h('button', { class: 'btn btn-soft btn-sm', type: 'button', disabled: true }, 'Save notes');
  const doSave = () => {
    if (ta.value.trim() === lastSaved.trim()) return;
    lastSaved = ta.value;
    save.disabled = true;
    actions.updateDiscussion(d, { notes: ta.value.trim() });
  };
  save.addEventListener('click', doSave);
  ta.addEventListener('input', () => { save.disabled = ta.value === lastSaved; });
  ta.addEventListener('blur', doSave);

  return h('div', { class: ['disc-detail', inline && 'is-inline'], id: `disc-detail-${d.id}`, 'data-test': 'discussion-detail' },
    h('div', { class: 'row' }, pill(tag, tagKind, { class: 'pill-lg', 'data-test': 'discussion-tag' }), d.priority === 'high' && pill('High priority', 'terra', { class: 'pill-lg' })),
    h('h2', { class: 'detail-title' }, d.title),
    h('p', { class: 'detail-sub' }, kind?.label ?? d.kind),
    h('dl', { class: 'facts-list' },
      h('div', null, h('dt', null, 'Associated chapter'), h('dd', null, d.topicIds?.length ? h('span', { class: 'chips' }, d.topicIds.map(topicLink)) : 'Not assigned')),
      h('div', null, h('dt', null, 'Raised by'), h('dd', null, `${raisedText(d)}${d.createdAt ? ` · ${formatTimestamp(d.createdAt)}` : ''}${d.sourceDateAdded ? ` · added ${d.sourceDateAdded}` : ''}`)),
      session && h('div', null, h('dt', null, 'Discuss at'), h('dd', null, h('a', { href: `#schedule/${session.date}` }, `${formatShort(session.date)} · ${session.title}`)))),
    h('div', { class: 'field' }, h('label', { for: notesId, class: 'detail-h' }, 'Discussion notes'), ta, h('div', { class: 'field-actions' }, save)),
    h('div', { class: 'detail-actions' },
      d.status !== 'discussed'
        ? h('button', { class: 'btn btn-primary btn-block btn-lg', type: 'button', onclick: () => setStatus('discussed') }, icon('check', { size: 20 }), 'Mark as Discussed')
        : h('button', { class: 'btn btn-soft btn-block btn-lg', type: 'button', onclick: () => setStatus('open') }, 'Reopen'),
      h('div', { class: 'row' },
        d.status === 'open' && h('button', { class: 'btn btn-soft grow', type: 'button', onclick: () => setStatus('deferred') }, 'Defer for later'),
        d.status === 'deferred' && h('button', { class: 'btn btn-soft grow', type: 'button', onclick: () => setStatus('open') }, 'Back to the queue'),
        h('button', { class: 'btn btn-soft grow', type: 'button', onclick: () => actions.updateDiscussion(d, { priority: d.priority === 'high' ? 'normal' : 'high' }) },
          icon('flag', { size: 18 }), d.priority === 'high' ? 'Normal priority' : 'High priority'))));
}

// ---------------------------------------------------------------- new item

/** Dialog to add a discussion item; `defaults.topicIds` preselects chapters. */
export function raiseDiscussionDialog(defaults) {
  const topics = activeTopics(state.topics);
  const jointSessions = sortSessions(visibleSessions(state.sessions).filter((s) => s.type === 'joint' && s.status === 'planned'));
  return openDialog({
    title: 'New discussion item',
    wide: true,
    build: (close) => {
      const title = h('input', { id: 'nd-title', type: 'text', maxlength: LIMITS.title, required: true, 'aria-describedby': 'nd-title-err', placeholder: 'e.g. Why does salting stop rainbow tables?' });
      const titleErr = fieldError('nd-title-err', '');
      const kind = h('select', { id: 'nd-kind' }, DISCUSSION_KINDS.map((k) => h('option', { value: k.id }, k.label)));
      const priority = h('select', { id: 'nd-priority' }, h('option', { value: 'normal' }, 'Normal'), h('option', { value: 'high' }, 'High'));
      const session = h('select', { id: 'nd-session' }, h('option', { value: '' }, 'Whenever we next meet'),
        jointSessions.map((s) => h('option', { value: s.id }, `${formatShort(s.date)} · ${s.title.slice(0, 50)}`)));
      const notes = h('textarea', { id: 'nd-notes', rows: 3, maxlength: LIMITS.notes });
      const topicBoxes = h('fieldset', { class: 'fieldset' }, h('legend', null, 'Chapters'), h('div', { class: 'chips' },
        topics.map((t) => h('label', { class: 'check-pill' },
          h('input', { type: 'checkbox', name: 'nd-topics', value: t.id, checked: (defaults.topicIds || []).includes(t.id) }), `Ch ${t.chapter}`))));
      const form = h('form', { class: 'form', novalidate: true },
        h('div', { class: 'field' }, h('label', { for: 'nd-title' }, 'Question or topic'), title, titleErr),
        topicBoxes,
        h('div', { class: 'grid-2' },
          h('div', { class: 'field' }, h('label', { for: 'nd-kind' }, 'Type'), kind),
          h('div', { class: 'field' }, h('label', { for: 'nd-priority' }, 'Priority'), priority)),
        h('div', { class: 'field' }, h('label', { for: 'nd-session' }, 'Discuss at'), session),
        h('div', { class: 'field' }, h('label', { for: 'nd-notes' }, 'Notes (optional)'), notes),
        h('p', { class: 'small muted' }, `Raised by ${PROFILES[state.profile].name}`),
        h('div', { class: 'dialog-actions' }, h('button', { class: 'btn btn-primary', type: 'submit' }, 'Add')));
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = {
          title: title.value.trim(),
          kind: kind.value,
          priority: priority.value,
          topicIds: [...form.querySelectorAll('input[name=nd-topics]:checked')].map((x) => x.value),
          sessionId: session.value || null,
          notes: notes.value,
          raisedBy: state.profile,
        };
        const errors = validateDiscussionInput(input, topics.map((t) => t.id));
        titleErr.hidden = !errors.title;
        titleErr.textContent = errors.title || '';
        if (Object.keys(errors).length) { if (errors.title) title.focus(); return; }
        close(input);
      });
      return form;
    },
  }).then((input) => input && actions.createDiscussion(input));
}
