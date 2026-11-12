// Shared discussion queue. Marking an item discussed never changes progress.
import {
  h, emptyState, personChip, openDialog, fieldError,
} from '../ui.js';
import { state } from '../store.js';
import {
  PROFILES, DISCUSSION_STATUSES, DISCUSSION_KINDS, LIMITS,
} from '../config.js';
import {
  sortDiscussions, activeTopics, validateDiscussionInput, sortSessions, visibleSessions,
} from '../model.js';
import { formatShort, formatTimestamp } from '../date-utils.js';
import * as actions from '../actions.js';
import { topicLink } from './session-card.js';

export function renderDiscussions(root) {
  root.append(h('div', { class: 'toolbar' },
    h('h1', { class: 'view-title' }, 'Discuss'),
    h('button', { class: 'btn btn-sm btn-primary', onclick: () => raiseDiscussionDialog({}) }, '＋ New item')));
  root.append(h('p', { class: 'muted small' }, 'Questions, tricky topics and things to revisit together. Marking an item discussed does not mark any chapter complete.'));

  const all = sortDiscussions(state.discussions);
  if (!all.length) {
    root.append(emptyState('No discussion items yet', 'Add a question or a topic you want to go through together.', '💬'));
    return;
  }
  for (const st of DISCUSSION_STATUSES) {
    const items = all.filter((d) => d.status === st.id);
    if (!items.length && st.id !== 'open') continue;
    root.append(h('section', { class: 'panel' },
      h('h2', { class: 'panel-title' }, `${st.label} (${items.length})`),
      items.length ? items.map(discussionCard) : h('p', { class: 'muted' }, 'Nothing open. Nice.')));
  }
}

function discussionCard(d) {
  const kind = DISCUSSION_KINDS.find((k) => k.id === d.kind);
  const session = d.sessionId ? state.sessions.find((s) => s.id === d.sessionId) : null;
  const statusId = `ds-${d.id}`;
  return h('article', { class: ['disc', `disc-${d.status}`], id: `disc-${d.id}` },
    h('div', { class: 'session-chips' },
      h('span', { class: 'chip chip-type' }, kind?.label ?? d.kind),
      d.priority === 'high' && h('span', { class: 'badge badge-high' }, 'High priority'),
      d.raisedBy ? personChip(d.raisedBy, { small: true }) : h('span', { class: 'chip chip-sm' }, '📄 From schedule')),
    h('h3', { class: 'disc-title' }, d.title),
    d.topicIds?.length > 0 && h('p', { class: 'session-topics' }, h('span', { class: 'muted' }, 'Topics: '), d.topicIds.map(topicLink)),
    session && h('p', { class: 'small' }, 'For: ', h('a', { href: `#schedule/${session.date}` }, `${formatShort(session.date)} · ${session.title}`)),
    h('p', { class: 'muted small' }, d.createdAt ? `Added ${formatTimestamp(d.createdAt)}` : '', d.updatedAt && d.updatedAt !== d.createdAt ? ` · updated ${formatTimestamp(d.updatedAt)}` : ''),
    d.notes && h('p', { class: 'pre user-note' }, d.notes),
    h('div', { class: 'disc-controls' },
      h('label', { for: statusId, class: 'small' }, 'Status '),
      h('select', {
        id: statusId, dataset: { fk: statusId },
        onchange: (e) => actions.updateDiscussion(d, { status: e.target.value }, `${PROFILES[state.profile].name} marked "${d.title.slice(0, 80)}" as ${e.target.value}`),
      }, DISCUSSION_STATUSES.map((s) => h('option', { value: s.id, selected: s.id === d.status }, s.label))),
      h('button', { class: 'btn btn-sm', onclick: () => editNotesDialog(d) }, d.notes ? 'Edit notes / resolution…' : 'Add notes / resolution…'),
      h('button', { class: 'btn btn-sm', onclick: () => actions.updateDiscussion(d, { priority: d.priority === 'high' ? 'normal' : 'high' }) },
        d.priority === 'high' ? 'Set normal priority' : 'Set high priority')));
}

function editNotesDialog(d) {
  return openDialog({
    title: 'Notes / resolution',
    build: (close) => {
      const ta = h('textarea', { id: 'disc-notes', rows: 6, maxlength: LIMITS.notes });
      ta.value = d.notes || '';
      return h('div', { class: 'form' },
        h('p', null, d.title),
        h('div', { class: 'field' }, h('label', { for: 'disc-notes' }, `Notes (max ${LIMITS.notes} characters)`), ta),
        h('div', { class: 'dialog-actions' },
          h('button', { class: 'btn', onclick: () => close() }, 'Cancel'),
          h('button', { class: 'btn btn-primary', onclick: () => close(ta.value) }, 'Save')));
    },
  }).then((v) => typeof v === 'string' && v !== (d.notes || '') && actions.updateDiscussion(d, { notes: v.trim() }));
}

/** Dialog to add a discussion item; `defaults.topicIds` preselects topics. */
export function raiseDiscussionDialog(defaults) {
  const topics = activeTopics(state.topics);
  const jointSessions = sortSessions(visibleSessions(state.sessions).filter((s) => s.type === 'joint' && s.status === 'planned'));
  return openDialog({
    title: 'New discussion item',
    wide: true,
    build: (close) => {
      const title = h('input', { id: 'nd-title', type: 'text', maxlength: LIMITS.title, required: true, autofocus: true, 'aria-describedby': 'nd-title-err' });
      const titleErr = fieldError('nd-title-err', '');
      const kind = h('select', { id: 'nd-kind' }, DISCUSSION_KINDS.map((k) => h('option', { value: k.id }, k.label)));
      const priority = h('select', { id: 'nd-priority' }, h('option', { value: 'normal' }, 'Normal'), h('option', { value: 'high' }, 'High'));
      const session = h('select', { id: 'nd-session' }, h('option', { value: '' }, 'No specific session'),
        jointSessions.map((s) => h('option', { value: s.id }, `${formatShort(s.date)} · ${s.title.slice(0, 60)}`)));
      const notes = h('textarea', { id: 'nd-notes', rows: 3, maxlength: LIMITS.notes });
      const topicBoxes = h('fieldset', { class: 'fieldset' }, h('legend', null, 'Topics'), h('div', { class: 'chip-row' },
        topics.map((t) => h('label', { class: 'check-pill' },
          h('input', { type: 'checkbox', name: 'nd-topics', value: t.id, checked: (defaults.topicIds || []).includes(t.id) }), `Ch ${t.chapter}`))));
      const form = h('form', { class: 'form', novalidate: true },
        h('p', { class: 'muted small' }, 'Raised by ', personChip(state.profile, { small: true })),
        h('div', { class: 'field' }, h('label', { for: 'nd-title' }, 'Question or topic'), title, titleErr),
        h('div', { class: 'grid-2' },
          h('div', { class: 'field' }, h('label', { for: 'nd-kind' }, 'Type'), kind),
          h('div', { class: 'field' }, h('label', { for: 'nd-priority' }, 'Priority'), priority)),
        topicBoxes,
        h('div', { class: 'field' }, h('label', { for: 'nd-session' }, 'Discuss at (optional)'), session),
        h('div', { class: 'field' }, h('label', { for: 'nd-notes' }, 'Notes (optional)'), notes),
        h('div', { class: 'dialog-actions' },
          h('button', { class: 'btn', type: 'button', onclick: () => close() }, 'Cancel'),
          h('button', { class: 'btn btn-primary', type: 'submit' }, 'Add')));
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
