// Session card + session dialogs (status, reschedule, notes, add/edit/delete).
import {
  h, typeTag, sessionStatePill, openDialog, confirmDialog, actionSheet, fieldError, bar, whoText, pill,
} from '../ui.js';
import { icon } from '../icons.js';
import { state } from '../store.js';
import {
  PROFILES, PROFILE_IDS, SESSION_TYPES, LIMITS, NON_STUDY_TYPES,
} from '../config.js';
import {
  taskItemId, isChecked, involves, checkReschedule, bufferSlots, validateSessionInput, activeTopics, shortTaskLabel, splitTitle,
} from '../model.js';
import { formatShort, formatLong, todayISO } from '../date-utils.js';
import * as actions from '../actions.js';

export function topicLink(topicId) {
  const t = state.topics.find((x) => x.id === topicId);
  return h('a', { class: 'chip', href: `#topics/${topicId}` }, t ? `Ch ${t.chapter}` : topicId);
}

/** "Ch 1–2", "Ch 3, 5" or "All chapters" for a list of topic ids. */
export function chaptersText(topicIds) {
  const all = activeTopics(state.topics);
  if (!topicIds?.length) return '';
  if (all.length && all.every((t) => topicIds.includes(t.id))) return 'All chapters';
  const nums = topicIds.map((id) => all.find((t) => t.id === id)?.chapter).filter((n) => n != null).sort((a, b) => a - b);
  const parts = [];
  for (let i = 0; i < nums.length; i++) {
    let j = i;
    while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
    parts.push(j > i ? `${nums[i]}–${nums[j]}` : String(nums[i]));
    i = j;
  }
  return parts.length ? `Ch ${parts.join(', ')}` : '';
}

export function timeText(s) {
  if (s.startTime && s.endTime) return `${s.startTime} – ${s.endTime}`;
  return s.timeLabel || 'Any time';
}

/** "With David" / "Individual" / "Kyle" from the viewer's point of view. */
export function withText(s) {
  const me = state.profile;
  if (s.participants.length > 1) {
    const others = s.participants.filter((p) => p !== me);
    return involves(s, me) ? `With ${others.map((p) => PROFILES[p].name).join(' & ')}` : whoText(s.participants);
  }
  return s.participants[0] === me ? 'Individual' : PROFILES[s.participants[0]].name;
}

function taskRow(session, task) {
  const itemId = taskItemId(session, task);
  const me = state.profile;
  const mine = involves(session, me);
  const owner = mine ? me : session.participants[0];
  const done = isChecked(state.checksById, owner, itemId);
  const name = shortTaskLabel(task);
  const inputId = `chk-${me}-${itemId}`;
  const meta = [task.hours ? `${task.hours} h` : task.hoursLabel || task.durationLabel, task.condition].filter(Boolean).join(' · ');
  const others = session.participants.filter((p) => p !== me);
  return h('li', { class: ['task', done && 'is-done'] },
    mine
      ? h('input', {
        type: 'checkbox', id: inputId, class: ['tick', `tick-${me}`], checked: done, dataset: { fk: inputId }, 'data-test': 'task-tick',
        'aria-label': `${name} done`,
        onchange: (e) => actions.setCheck(me, itemId, e.target.checked, `${session.title}: ${name}`),
      })
      : h('span', { class: 'tick-spacer' }),
    h('details', { class: 'task-main', dataset: { keep: `t-${session.id}-${task.id}` } },
      h('summary', null,
        h('span', { class: 'task-name' }, name),
        h('span', { class: 'task-sub' }, ['MUST', 'SHOULD', 'COULD'].includes(task.tier) && h('span', { class: ['tier', `tier-${task.tier.toLowerCase()}`] }, task.tier), meta)),
      h('p', { class: 'task-detail' }, task.text)),
    h('span', { class: 'task-others' }, (mine ? others : session.participants).map((p) => {
      const on = isChecked(state.checksById, p, itemId);
      return h('span', { class: ['who-done', p, on && 'on'], title: `${PROFILES[p].name}: ${on ? 'done' : 'not yet'}` },
        PROFILES[p].initial, h('span', { class: 'sr-only' }, `${PROFILES[p].name} ${on ? 'done' : 'not yet'}`));
    })));
}

function myTaskCount(s) {
  const tasks = s.tasks || [];
  const done = involves(s, state.profile) ? tasks.filter((t) => isChecked(state.checksById, state.profile, taskItemId(s, t))).length : 0;
  return { done, total: tasks.length };
}

function taskProgress(s) {
  const { done, total } = myTaskCount(s);
  return h('div', { class: 'sess-progress' }, bar(done, total, `${done} of ${total} tasks done`),
    h('span', { 'data-test': 'task-progress', 'data-done': done, 'data-total': total }, `${done} of ${total}`));
}

export function sessionCard(s, { showDate = false, compact = false } = {}) {
  const study = !NON_STUDY_TYPES.includes(s.type);
  const mine = involves(s, state.profile);
  const tasks = s.tasks || [];
  const title = splitTitle(s.title);
  const card = h('article', {
    class: ['sess', `sess-${s.type}`, `status-${s.status}`, s.status !== 'planned' && 'is-done', compact && 'sess-compact'],
    id: `session-${s.id}`,
    'data-test': 'session',
    'aria-label': `${SESSION_TYPES[s.type]?.label} session: ${s.title}`,
  });

  const parts = [
    h('div', { class: 'sess-top' },
      typeTag(s.type),
      s.optional && pill('Optional', 'sand'),
      sessionStatePill(s.status),
      h('span', { class: 'sess-who' }, icon(s.participants.length > 1 ? 'users' : 'user', { size: 17, stroke: 1.7 }), whoText(s.participants))),
    h('h3', { class: 'sess-title' }, title.main),
    title.sub && h('p', { class: 'sess-subtitle' }, title.sub),
    h('p', { class: 'sess-meta' }, icon('clock', { size: 16, stroke: 1.8 }),
      h('span', null, showDate && `${formatShort(s.date)} · `, timeText(s), s.durationLabel && ` · ${s.durationLabel}`)),
  ];
  card.append(...parts.filter(Boolean)); // native append would print "null"
  if (s.type === 'exam') {
    const venue = (s.notes || '').split('\n').find((n) => n.startsWith('Venue:'));
    if (venue) card.append(h('p', { class: 'small muted' }, venue));
  }
  if (s.rescheduledFrom) card.append(h('p', { class: 'sess-flag', 'data-test': 'session-flag' }, `Moved from ${formatShort(s.rescheduledFrom)}${s.statusReason ? ` · ${s.statusReason}` : ''}`));
  else if (s.statusReason) card.append(h('p', { class: 'sess-flag', 'data-test': 'session-flag' }, s.statusReason));
  if (s.type === 'rest') card.append(h('p', { class: 'sess-rest' }, 'No required work. Enjoy it.'));
  if (s.topicIds.length && s.type !== 'exam' && !compact) {
    const allTopics = activeTopics(state.topics);
    const everything = allTopics.length > 0 && allTopics.every((t) => s.topicIds.includes(t.id));
    card.append(h('div', { class: 'chips' }, everything ? h('a', { class: 'chip', href: '#topics' }, 'All chapters') : s.topicIds.map(topicLink)));
  }

  if (tasks.length && !compact) {
    if (mine) card.append(taskProgress(s));
    card.append(h('ul', { class: 'tasks' }, tasks.map((t) => taskRow(s, t))));
  } else if (tasks.length && compact && mine) {
    const { done, total } = myTaskCount(s);
    card.append(h('p', { class: 'small muted' }, `${done} of ${total} tasks done`));
  }
  if (s.userNotes) card.append(h('p', { class: 'user-note' }, h('b', null, 'Note: '), s.userNotes));

  if (!compact && (s.outcome || s.notes || s.goal)) {
    card.append(h('details', { class: 'sess-notes', dataset: { keep: `notes-${s.id}` } },
      h('summary', null, 'From the schedule'),
      s.outcome && h('p', null, h('b', null, 'Outcome: '), s.outcome),
      (s.notes || '').split('\n').filter(Boolean).map((n) => h('p', null, n)),
      s.type === 'joint' && state.workspace?.jointFormat && h('p', null, h('b', null, 'Format: '),
        state.workspace.jointFormat.parts.map((p) => `${p.part} (${p.short})`).join(' → '))));
  }

  if (!compact && s.type !== 'exam' && s.type !== 'other') card.append(sessionFoot(s, study));
  return card;
}

/**
 * Today's Focus: one of my sessions as a plain checklist (no card chrome),
 * with the same Mark done / ⋯ actions as the full card.
 */
export function focusSession(s, { showTitle = false } = {}) {
  const study = !NON_STUDY_TYPES.includes(s.type);
  const tasks = s.tasks || [];
  const wrap = h('div', { class: ['focus-session', s.status !== 'planned' && 'is-done'], id: `focus-${s.id}`, 'data-test': 'focus-session' });
  if (showTitle) {
    wrap.append(h('div', { class: 'focus-title' },
      h('b', null, splitTitle(s.title).main),
      h('span', { class: 'muted' }, [timeText(s) !== 'Any time' && timeText(s), withText(s)].filter(Boolean).join(' · ')),
      sessionStatePill(s.status)));
  }
  if (s.type === 'rest') wrap.append(h('p', { class: 'focus-empty' }, `${splitTitle(s.title).main}. No required work. Enjoy it.`));
  else if (tasks.length) wrap.append(h('ul', { class: 'tasks tasks-focus' }, tasks.map((t) => taskRow(s, t))));
  else wrap.append(h('p', { class: 'focus-empty' }, s.title));
  if (s.type !== 'exam' && s.type !== 'other') {
    const { done, total } = myTaskCount(s);
    wrap.append(sessionFoot(s, study, total ? `${done} of ${total} done` : null));
  }
  return wrap;
}

function sessionFoot(s, study, note = null) {
  const foot = h('div', { class: 'sess-foot' });
  if (!involves(s, state.profile)) {
    // Someone else's session: no big button; status shown by them, actions in ⋯.
    foot.append(h('span', { class: 'grow small muted' }, `${PROFILES[s.participants[0]].name}'s session`));
  } else {
    foot.append(h('span', { class: 'grow small muted' }, note || ''));
    if (study && s.status === 'planned') {
      foot.append(h('button', { class: 'btn btn-primary', type: 'button', onclick: () => actions.setSessionStatus(s, 'completed') },
        icon('check', { size: 18 }), 'Mark done'));
    } else if (study) {
      foot.append(h('button', { class: 'btn btn-soft', type: 'button', onclick: () => actions.setSessionStatus(s, 'planned') }, 'Reopen'));
    }
  }
  foot.append(h('button', {
    class: 'icon-btn', type: 'button', 'aria-label': `More actions for ${s.title}`, onclick: () => sessionMenu(s, study),
  }, icon('more')));
  return foot;
}

export function sessionMenu(s, study) {
  return actionSheet(s.title, [
    study && s.status === 'planned' && { label: 'Missed it…', sub: 'Records it as missed. Progress is untouched.', run: () => missedDialog(s) },
    { label: 'Move to another day…', sub: s.type === 'rest' ? 'e.g. the weather swap' : 'Shows a preview first', run: () => rescheduleDialog(s) },
    { label: s.userNotes ? 'Edit shared note…' : 'Add a shared note…', run: () => notesDialog(s) },
    study && s.status === 'planned' && { label: 'Cancel session…', run: () => cancelDialog(s) },
    !s.imported && { label: 'Edit session…', run: () => sessionFormDialog(s) },
    !s.imported && { label: 'Delete session…', danger: true, run: () => deleteDialog(s) },
  ]);
}

// ------------------------------------------------------------------ dialogs

function reasonField(id, label, placeholder, onInput) {
  return h('div', { class: 'field' },
    h('label', { for: id }, label),
    h('input', { id, type: 'text', maxlength: LIMITS.reason, placeholder, oninput: (e) => onInput(e.target.value) }));
}

export function missedDialog(s) {
  let reason = '';
  return openDialog({
    title: 'Missed it',
    build: (close) => {
      const form = h('form', { class: 'form' },
        h('p', null, `"${s.title}" · ${formatLong(s.date)}`),
        h('p', { class: 'muted small' }, 'This only records the session as missed. Nobody\'s chapter progress or ticked tasks change.'),
        reasonField('missed-reason', 'Reason (optional)', 'e.g. ran out of time', (v) => { reason = v; }),
        h('div', { class: 'dialog-actions' },
          h('button', { class: 'btn btn-soft', type: 'submit' }, 'Just mark missed'),
          h('button', { class: 'btn btn-primary', type: 'button', onclick: () => close('reschedule') }, 'Missed + move it…')));
      form.addEventListener('submit', (e) => { e.preventDefault(); close('missed'); });
      return form;
    },
  }).then(async (v) => {
    if (v === 'missed') await actions.setSessionStatus(s, 'missed', reason);
    if (v === 'reschedule') {
      const ok = await actions.setSessionStatus(s, 'missed', reason);
      if (ok) rescheduleDialog({ ...s, status: 'missed', statusReason: reason });
    }
  });
}

export function cancelDialog(s) {
  let reason = '';
  return openDialog({
    title: 'Cancel session',
    build: (close) => h('div', { class: 'form' },
      h('p', null, `Cancel "${s.title}" on ${formatLong(s.date)}? It stays visible as cancelled and can be reopened. Progress is unchanged.`),
      reasonField('cancel-reason', 'Reason (optional)', '', (v) => { reason = v; }),
      h('div', { class: 'dialog-actions' },
        h('button', { class: 'btn btn-soft', type: 'button', onclick: () => close(false) }, 'Keep it'),
        h('button', { class: 'btn btn-danger', onclick: () => close(true) }, 'Cancel session'))),
  }).then((ok) => ok && actions.setSessionStatus(s, 'cancelled', reason));
}

export function notesDialog(s) {
  return openDialog({
    title: 'Shared note',
    build: (close) => {
      const ta = h('textarea', { id: 'session-note', rows: 5, maxlength: LIMITS.notes, autofocus: true });
      ta.value = s.userNotes || '';
      return h('div', { class: 'form' },
        h('div', { class: 'field' }, h('label', { for: 'session-note' }, `On "${s.title}". Both of you can see it.`), ta),
        h('div', { class: 'dialog-actions' }, h('button', { class: 'btn btn-primary', onclick: () => close(ta.value) }, 'Save note')));
    },
  }).then((v) => typeof v === 'string' && v !== (s.userNotes || '') && actions.saveSessionNotes(s, v));
}

export function rescheduleDialog(s) {
  const today = todayISO();
  const ws = state.workspace;
  const buffers = bufferSlots(state.sessions, s.date < today ? today : s.date, s.participants)
    .filter((b) => b.id !== s.id && b.date >= today);
  return openDialog({
    title: 'Move to another day',
    wide: true,
    build: (close) => {
      const dateInput = h('input', { id: 'resched-date', type: 'date', min: today, max: ws?.examDate || null, required: true });
      const reasonInput = h('input', { id: 'resched-reason', type: 'text', maxlength: LIMITS.reason, placeholder: 'e.g. missed on Monday' });
      const preview = h('div', { class: 'preview', 'aria-live': 'polite' });
      const confirmBox = h('input', { type: 'checkbox', id: 'resched-override' });
      const confirmRow = h('div', { class: 'field-inline', hidden: true }, confirmBox,
        h('label', { for: 'resched-override' }, 'Move it onto this protected day anyway'));
      const errorEl = fieldError('resched-error', '');
      const submit = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Move session');

      const render = () => {
        const newDate = dateInput.value;
        preview.replaceChildren();
        errorEl.hidden = true;
        if (!newDate) { preview.append(h('p', { class: 'muted' }, 'Pick a day to see the change.')); confirmRow.hidden = true; return; }
        const r = checkReschedule({ session: s, newDate, today, workspace: ws });
        const topicNames = s.topicIds.map((id) => state.topics.find((t) => t.id === id)).filter(Boolean).map((t) => `Ch ${t.chapter}`);
        preview.append(
          h('p', null, h('b', null, formatShort(s.date)), ' → ', h('b', null, formatLong(newDate))),
          h('p', { class: 'small' }, `${s.participants.map((p) => PROFILES[p].name).join(' + ')} · ${topicNames.join(', ') || 'no linked chapters'}`),
          h('p', { class: 'small muted' }, 'Chapter progress and ticked tasks stay exactly as they are.'),
        );
        r.errors.forEach((e) => preview.append(h('p', { class: 'field-error' }, e)));
        r.warnings.forEach((w) => preview.append(h('p', { class: 'warning' }, `Protected day: ${w}`)));
        confirmRow.hidden = r.warnings.length === 0;
        submit.disabled = !r.ok;
      };
      dateInput.addEventListener('input', render);
      const form = h('form', { class: 'form' },
        buffers.length > 0 && h('div', { class: 'field' },
          h('p', { class: 'small', style: 'font-weight:750' }, 'Catch-up slot from the schedule'),
          h('div', { class: 'chips' }, buffers.map((b) => h('button', {
            type: 'button', class: 'btn btn-soft btn-sm', onclick: () => { dateInput.value = b.date; render(); },
          }, `${formatShort(b.date)}: ${b.title}`)))),
        h('div', { class: 'field' }, h('label', { for: 'resched-date' }, 'New day'), dateInput),
        preview, confirmRow,
        h('div', { class: 'field' }, h('label', { for: 'resched-reason' }, 'Reason (optional)'), reasonInput),
        h('details', { class: 'more-toggle' }, h('summary', null, 'Recovery rules (§11.1)'),
          h('ul', { class: 'small stack', style: 'padding-top:.3rem' }, (ws?.recoveryRules || []).map((r) => h('li', null, `• ${r}`)))),
        errorEl,
        h('div', { class: 'dialog-actions' }, submit));
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const r = checkReschedule({ session: s, newDate: dateInput.value, today, workspace: ws });
        if (!r.ok) { errorEl.textContent = r.errors[0]; errorEl.hidden = false; return; }
        if (r.warnings.length && !confirmBox.checked) {
          errorEl.textContent = 'That\'s a protected day. Tick the box above to move it there anyway.';
          errorEl.hidden = false;
          return;
        }
        close({ date: dateInput.value, reason: reasonInput.value });
      });
      render();
      return form;
    },
  }).then((v) => v && actions.rescheduleSession(s, v.date, v.reason));
}

export function deleteDialog(s) {
  return confirmDialog({
    title: 'Delete session',
    message: `Delete "${s.title}" on ${formatLong(s.date)} for both of you? Ticked tasks and chapter progress are not affected.`,
    confirmLabel: 'Delete',
    danger: true,
  }).then((ok) => ok && actions.deleteUserSession(s));
}

/** Add (session undefined) or edit a user-created session. */
export function sessionFormDialog(session, defaults = {}) {
  const editing = Boolean(session);
  const v = session || {
    title: '', date: defaults.date || todayISO(), type: 'joint', participants: [...PROFILE_IDS], topicIds: [], timeLabel: '', startTime: '', endTime: '', notes: '', optional: false,
  };
  return openDialog({
    title: editing ? 'Edit session' : 'New session',
    wide: true,
    build: (close) => {
      const errs = {};
      const field = (id, label, input) => {
        errs[id] = fieldError(`${id}-err`, '');
        input.setAttribute('aria-describedby', `${id}-err`);
        return h('div', { class: 'field' }, h('label', { for: id }, label), input, errs[id]);
      };
      const title = h('input', { id: 'sf-title', type: 'text', maxlength: LIMITS.title, value: v.title, required: true, placeholder: 'e.g. Extra SQLi practice' });
      const date = h('input', { id: 'sf-date', type: 'date', value: v.date, max: state.workspace?.examDate || null, required: true });
      const type = h('select', { id: 'sf-type' }, Object.entries(SESSION_TYPES).filter(([k]) => k !== 'exam')
        .map(([k, t]) => h('option', { value: k, selected: v.type === k }, t.label)));
      const people = h('fieldset', { class: 'fieldset' }, h('legend', null, 'Who'), h('div', { class: 'chips' }, PROFILE_IDS.map((p) => h('label', { class: 'check-pill' },
        h('input', { type: 'checkbox', name: 'sf-people', value: p, checked: v.participants.includes(p) }), PROFILES[p].name))));
      const timeLabel = h('input', { id: 'sf-timelabel', type: 'text', maxlength: LIMITS.timeLabel, value: v.timeLabel || '', placeholder: 'e.g. Evening' });
      const start = h('input', { id: 'sf-start', type: 'time', value: v.startTime || '' });
      const end = h('input', { id: 'sf-end', type: 'time', value: v.endTime || '' });
      const topics = h('fieldset', { class: 'fieldset' }, h('legend', null, 'Chapters'), h('div', { class: 'chips' },
        activeTopics(state.topics).map((t) => h('label', { class: 'check-pill' },
          h('input', { type: 'checkbox', name: 'sf-topics', value: t.id, checked: v.topicIds.includes(t.id) }), `Ch ${t.chapter}`))));
      const notes = h('textarea', { id: 'sf-notes', rows: 3, maxlength: LIMITS.notes });
      notes.value = v.notes || '';
      const optional = h('input', { type: 'checkbox', id: 'sf-optional', checked: v.optional });
      const peopleErr = fieldError('sf-people-err', '');
      const form = h('form', { class: 'form', novalidate: true },
        field('sf-title', 'Title', title),
        h('div', { class: 'grid-2' }, field('sf-date', 'Day', date), field('sf-type', 'Type', type)),
        people, peopleErr,
        h('div', { class: 'grid-3' }, field('sf-timelabel', 'When', timeLabel), field('sf-start', 'Start (optional)', start), field('sf-end', 'End (optional)', end)),
        topics,
        field('sf-notes', 'Notes', notes),
        h('div', { class: 'field-inline' }, optional, h('label', { for: 'sf-optional' }, 'Optional session')),
        h('div', { class: 'dialog-actions' }, h('button', { class: 'btn btn-primary', type: 'submit' }, editing ? 'Save changes' : 'Add session')));
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = {
          title: title.value,
          date: date.value,
          type: type.value,
          participants: [...form.querySelectorAll('input[name=sf-people]:checked')].map((x) => x.value),
          topicIds: [...form.querySelectorAll('input[name=sf-topics]:checked')].map((x) => x.value),
          timeLabel: timeLabel.value.trim(),
          startTime: start.value,
          endTime: end.value,
          notes: notes.value,
          optional: optional.checked,
        };
        const errors = validateSessionInput(input);
        for (const el of Object.values(errs)) { el.hidden = true; el.textContent = ''; }
        peopleErr.hidden = true;
        const map = { title: 'sf-title', date: 'sf-date', type: 'sf-type', timeLabel: 'sf-timelabel', startTime: 'sf-start', endTime: 'sf-end', notes: 'sf-notes' };
        for (const [k, msg] of Object.entries(errors)) {
          const el = k === 'participants' ? peopleErr : errs[map[k]];
          if (el) { el.textContent = msg; el.hidden = false; }
        }
        if (Object.keys(errors).length) return;
        close(input);
      });
      return form;
    },
  }).then((input) => {
    if (!input) return;
    if (editing) actions.updateUserSession(session, input);
    else actions.createSession(input);
  });
}

