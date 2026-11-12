// Shared discussion queue. Marking an item discussed never changes progress.
import {
  h, emptyState, avatar, openDialog, fieldError, segmented, actionSheet,
} from '../ui.js';
import { icon } from '../icons.js';
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

let tab = 'open';

export function renderDiscussions(root, _param, rerender) {
  root.append(h('div', { class: 'row' }, h('h1', { class: 'page-title grow' }, 'Discuss'),
    h('button', { class: 'btn btn-sm btn-primary', onclick: () => raiseDiscussionDialog({}) }, icon('plus', { size: 18 }), 'New')));
  const all = sortDiscussions(state.discussions);
  const count = (id) => all.filter((d) => d.status === id).length;
  root.append(segmented({
    label: 'Filter', value: tab, onChange: (id) => { tab = id; rerender(); },
    options: DISCUSSION_STATUSES.map((s) => ({ id: s.id, label: `${s.label} ${count(s.id)}` })),
  }));
  const items = all.filter((d) => d.status === tab);
  if (!items.length) {
    root.append(emptyState(tab === 'open' ? 'Nothing to discuss' : `Nothing ${tab}`,
      tab === 'open' ? 'Add questions or tricky topics you want to go through together.' : null));
  } else {
    root.append(h('div', null, items.map(discussionCard)));
  }
  root.append(h('p', { class: 'small muted' }, 'Marking something discussed never marks a chapter as complete.'));
}

const who = (p) => PROFILES[p]?.name ?? p;

function discussionCard(d) {
  const kind = DISCUSSION_KINDS.find((k) => k.id === d.kind);
  const session = d.sessionId ? state.sessions.find((s) => s.id === d.sessionId) : null;
  const me = PROFILES[state.profile].name;
  const setStatus = (status) => actions.updateDiscussion(d, { status }, `${me} marked "${d.title.slice(0, 80)}" as ${status}`);
  return h('article', { class: ['disc', d.status !== 'open' && 'is-closed'], id: `disc-${d.id}` },
    h('div', { class: 'sess-top' },
      h('span', { class: 'tag tag-individual' }, kind?.label ?? d.kind),
      d.priority === 'high' && h('span', { class: 'pill-state ps-high' }, 'High'),
      d.status !== 'open' && h('span', { class: ['pill-state', d.status === 'discussed' ? 'ps-completed' : 'ps-optional'] }, d.status)),
    h('h3', { class: 'disc-title' }, d.title),
    d.topicIds?.length > 0 && h('div', { class: 'chips' }, d.topicIds.map(topicLink)),
    h('p', { class: 'row small muted' },
      d.raisedBy ? avatar(d.raisedBy, 'xs') : null,
      d.raisedBy ? `${who(d.raisedBy)}` : 'From the schedule',
      d.createdAt ? ` · ${formatTimestamp(d.createdAt)}` : ''),
    session && h('a', { class: 'small', href: `#schedule/${session.date}`, style: 'font-weight:700' }, `For ${formatShort(session.date)} · ${session.title}`),
    d.notes && h('p', { class: 'user-note pre' }, d.notes),
    h('div', { class: 'disc-foot' },
      d.status === 'open'
        ? h('button', { class: 'btn btn-primary', onclick: () => setStatus('discussed') }, icon('check', { size: 18 }), 'Discussed')
        : h('button', { class: 'btn btn-ghost', onclick: () => setStatus('open') }, 'Reopen'),
      h('button', {
        class: 'icon-btn', 'aria-label': `More for ${d.title}`,
        onclick: () => actionSheet(d.title, [
          { label: d.notes ? 'Edit notes / answer…' : 'Add notes / answer…', run: () => editNotesDialog(d) },
          d.status === 'open' && { label: 'Defer for later', run: () => setStatus('deferred') },
          { label: d.priority === 'high' ? 'Normal priority' : 'High priority', run: () => actions.updateDiscussion(d, { priority: d.priority === 'high' ? 'normal' : 'high' }) },
        ]),
      }, icon('more'))));
}

function editNotesDialog(d) {
  return openDialog({
    title: 'Notes / answer',
    build: (close) => {
      const ta = h('textarea', { id: 'disc-notes', rows: 6, maxlength: LIMITS.notes, autofocus: true });
      ta.value = d.notes || '';
      return h('div', { class: 'form' },
        h('p', { style: 'font-weight:700' }, d.title),
        h('div', { class: 'field' }, h('label', { for: 'disc-notes' }, 'Notes'), ta),
        h('div', { class: 'dialog-actions' }, h('button', { class: 'btn btn-primary', onclick: () => close(ta.value) }, 'Save')));
    },
  }).then((v) => typeof v === 'string' && v !== (d.notes || '') && actions.updateDiscussion(d, { notes: v.trim() }));
}

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
