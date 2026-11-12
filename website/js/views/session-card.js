// Session card + session dialogs (status, reschedule, notes, add/edit/delete).
import {
  h, typeChip, participantsChip, sessionStatusBadge, tierChip, openDialog, confirmDialog, personChip, fieldError,
} from '../ui.js';
import { state } from '../store.js';
import {
  PROFILES, PROFILE_IDS, SESSION_TYPES, LIMITS, NON_STUDY_TYPES,
} from '../config.js';
import {
  taskItemId, isChecked, involves, checkReschedule, bufferSlots, validateSessionInput, activeTopics,
} from '../model.js';
import { formatShort, formatLong, todayISO } from '../date-utils.js';
import * as actions from '../actions.js';

export function topicLink(topicId) {
  const t = state.topics.find((x) => x.id === topicId);
  return h('a', { class: 'topic-link', href: `#topics/${topicId}` }, t ? `Ch ${t.chapter}` : topicId);
}

function timeText(s) {
  const parts = [];
  if (s.startTime && s.endTime) parts.push(`${s.startTime}–${s.endTime}`);
  else if (s.timeLabel) parts.push(s.timeLabel);
  else parts.push('All day / unscheduled time');
  if (s.durationLabel && s.durationLabel !== s.timeLabel) parts.push(s.durationLabel);
  return parts.join(' · ');
}

function taskRow(session, task) {
  const itemId = taskItemId(session, task);
  const me = state.profile;
  const canTick = involves(session, me);
  const others = session.participants.filter((p) => p !== me || !canTick);
  const label = `${session.title}: ${task.code || task.tier} ${task.text.slice(0, 60)}`;
  const inputId = `chk-${me}-${itemId}`;
  const meta = [task.hours ? `${task.hours} h` : null, task.hoursLabel, task.durationLabel, task.condition && `(${task.condition})`]
    .filter(Boolean).join(' · ');
  return h('li', { class: 'task' },
    canTick
      ? h('input', {
        type: 'checkbox',
        id: inputId,
        class: 'task-check',
        checked: isChecked(state.checksById, me, itemId),
        dataset: { fk: inputId },
        onchange: (e) => actions.setCheck(me, itemId, e.target.checked, label),
      })
      : h('span', { class: 'task-check-placeholder', 'aria-hidden': 'true' }),
    h('label', { class: 'task-body', for: canTick ? inputId : null },
      h('span', { class: 'task-head' }, tierChip(task.tier, task.code), meta && h('span', { class: 'muted small' }, meta)),
      h('span', { class: 'task-text' }, task.text)),
    h('span', { class: 'task-others' }, others.map((p) => {
      const done = isChecked(state.checksById, p, itemId);
      return h('span', {
        class: ['mini', `mini-${p}`, done && 'mini-done'],
        title: `${PROFILES[p].name}: ${done ? 'done' : 'not done'}`,
      }, `${PROFILES[p].initial} ${done ? '✓' : '·'}`, h('span', { class: 'sr-only' }, `${PROFILES[p].name} ${done ? 'done' : 'not done'}`));
    })));
}

export function sessionCard(s, { showDate = false, compact = false } = {}) {
  const today = todayISO();
  const isPast = s.date < today;
  const study = !NON_STUDY_TYPES.includes(s.type);
  const card = h('article', {
    class: ['session', `type-${s.type}`, `status-${s.status}`, isPast && 'is-past'],
    id: `session-${s.id}`,
    'aria-label': `${SESSION_TYPES[s.type]?.label} session: ${s.title}`,
  });

  card.append(
    h('div', { class: 'session-chips' },
      typeChip(s.type),
      participantsChip(s.participants),
      s.optional && h('span', { class: 'chip chip-optional' }, 'Optional'),
      sessionStatusBadge(s.status),
      !s.imported && h('span', { class: 'chip chip-user' }, 'Added by you two')),
    h('h3', { class: 'session-title' }, s.title),
    h('p', { class: 'session-meta' },
      showDate && h('strong', null, `${formatShort(s.date)} · `),
      timeText(s)),
  );
  if (s.rescheduledFrom) {
    card.append(h('p', { class: 'session-flag' }, `↪ Moved from ${formatShort(s.rescheduledFrom)}${s.statusReason ? ` · ${s.statusReason}` : ''}`));
  } else if (s.statusReason) {
    card.append(h('p', { class: 'session-flag' }, `Reason: ${s.statusReason}`));
  }
  if (s.topicIds.length) {
    card.append(h('p', { class: 'session-topics' }, h('span', { class: 'muted' }, 'Topics: '), s.topicIds.map((t) => topicLink(t))));
  }
  if (s.type === 'rest') {
    card.append(h('p', { class: 'rest-note' }, 'No required work. Enjoy the day.'));
  }
  if (s.tasks?.length && !compact) {
    const total = s.tasks.length;
    const mine = involves(s, state.profile) ? s.tasks.filter((t) => isChecked(state.checksById, state.profile, taskItemId(s, t))).length : null;
    card.append(h('details', { class: 'session-tasks', dataset: { keep: `tasks-${s.id}` }, open: !isPast && s.date === today },
      h('summary', null, `Tasks (${total})`, mine !== null && h('span', { class: 'muted small' }, ` · you: ${mine}/${total} done`)),
      h('ul', { class: 'task-list' }, s.tasks.map((t) => taskRow(s, t)))));
  }
  if (s.outcome && !compact) card.append(h('p', { class: 'session-outcome' }, h('strong', null, 'Outcome: '), s.outcome));
  if ((s.notes || s.goal) && !compact) {
    card.append(h('details', { class: 'session-notes', dataset: { keep: `notes-${s.id}` } },
      h('summary', null, 'Notes from the schedule'),
      s.goal && h('p', null, h('strong', null, 'Day goal: '), s.goal),
      (s.notes || '').split('\n').filter(Boolean).map((n) => h('p', null, n)),
      s.type === 'joint' && state.workspace?.jointFormat && jointFormat(state.workspace.jointFormat)));
  }
  if (s.userNotes) card.append(h('p', { class: 'user-note' }, h('span', { class: 'muted' }, 'Your shared note: '), s.userNotes));

  if (!compact && s.type !== 'exam' && s.type !== 'other') card.append(sessionActions(s, study));
  return card;
}

function jointFormat(fmt) {
  return h('div', { class: 'joint-format' },
    h('p', null, h('strong', null, 'Session format (§9.2): '), fmt.intro),
    h('ul', null, fmt.parts.map((p) => h('li', null, `${p.part}: ${p.short} (longer block: ${p.long})`))));
}

function sessionActions(s, study) {
  const bar = h('div', { class: 'session-actions' });
  const btn = (label, onclick, cls = 'btn btn-sm') => h('button', { class: cls, onclick, type: 'button' }, label);
  if (study) {
    if (s.status === 'planned') {
      bar.append(btn('✓ Mark done', () => actions.setSessionStatus(s, 'completed'), 'btn btn-sm btn-primary'));
      bar.append(btn('Missed…', () => missedDialog(s)));
    } else {
      bar.append(btn('↺ Reopen', () => actions.setSessionStatus(s, 'planned')));
    }
  }
  bar.append(btn('Reschedule…', () => rescheduleDialog(s)));
  bar.append(btn('Note…', () => notesDialog(s)));
  if (study && s.status === 'planned') bar.append(btn('Cancel…', () => cancelDialog(s)));
  if (!s.imported) {
    bar.append(btn('Edit…', () => sessionFormDialog(s)));
    bar.append(btn('Delete…', () => deleteDialog(s), 'btn btn-sm btn-danger-ghost'));
  }
  return bar;
}

// ------------------------------------------------------------------ dialogs

function reasonField(id, label, placeholder) {
  return h('div', { class: 'field' },
    h('label', { for: id }, label),
    h('input', { id, type: 'text', maxlength: LIMITS.reason, placeholder }));
}

export function missedDialog(s) {
  let reason = '';
  return openDialog({
    title: 'Mark session as missed',
    build: (close) => {
      const field = reasonField('missed-reason', 'Reason (optional)', 'e.g. ran out of time');
      field.querySelector('input').addEventListener('input', (e) => { reason = e.target.value; });
      const form = h('form', { class: 'form' },
        h('p', null, `"${s.title}" on ${formatLong(s.date)}.`),
        h('p', { class: 'muted' }, 'This only records the session as missed. Nobody\'s chapter progress or ticked tasks change.'),
        field,
        h('div', { class: 'dialog-actions' },
          h('button', { class: 'btn', type: 'button', onclick: () => close() }, 'Cancel'),
          h('button', { class: 'btn', type: 'submit' }, 'Mark missed'),
          h('button', { class: 'btn btn-primary', type: 'button', onclick: () => close('reschedule') }, 'Mark missed and reschedule…')));
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
    build: (close) => {
      const input = h('input', { id: 'cancel-reason', type: 'text', maxlength: LIMITS.reason, oninput: (e) => { reason = e.target.value; } });
      return h('div', null,
        h('p', null, `Cancel "${s.title}" on ${formatLong(s.date)}? It stays visible as cancelled and can be reopened. Progress is unchanged.`),
        h('div', { class: 'field' }, h('label', { for: 'cancel-reason' }, 'Reason (optional)'), input),
        h('div', { class: 'dialog-actions' },
          h('button', { class: 'btn', onclick: () => close(false) }, 'Keep it'),
          h('button', { class: 'btn btn-danger', onclick: () => close(true) }, 'Cancel session')));
    },
  }).then((ok) => ok && actions.setSessionStatus(s, 'cancelled', reason));
}

export function notesDialog(s) {
  return openDialog({
    title: 'Shared note on this session',
    build: (close) => {
      const ta = h('textarea', { id: 'session-note', rows: 5, maxlength: LIMITS.notes }, s.userNotes || '');
      ta.value = s.userNotes || '';
      return h('div', { class: 'form' },
        h('p', { class: 'muted' }, `Visible to both Kyle and David. Max ${LIMITS.notes} characters.`),
        h('div', { class: 'field' }, h('label', { for: 'session-note' }, `Note for "${s.title}"`), ta),
        h('div', { class: 'dialog-actions' },
          h('button', { class: 'btn', onclick: () => close() }, 'Cancel'),
          h('button', { class: 'btn btn-primary', onclick: () => close(ta.value) }, 'Save note')));
    },
  }).then((v) => typeof v === 'string' && v !== (s.userNotes || '') && actions.saveSessionNotes(s, v));
}

export function rescheduleDialog(s) {
  const today = todayISO();
  const ws = state.workspace;
  const buffers = bufferSlots(state.sessions, s.date < today ? today : s.date, s.participants)
    .filter((b) => b.id !== s.id && b.date >= today);
  return openDialog({
    title: 'Reschedule session',
    wide: true,
    build: (close) => {
      const dateInput = h('input', {
        id: 'resched-date', type: 'date', min: today, max: ws?.examDate || null, required: true,
      });
      const reasonInput = h('input', { id: 'resched-reason', type: 'text', maxlength: LIMITS.reason, placeholder: 'e.g. missed on Monday' });
      const preview = h('div', { class: 'preview', 'aria-live': 'polite' });
      const confirmBox = h('input', { type: 'checkbox', id: 'resched-override' });
      const confirmRow = h('div', { class: 'field-inline', hidden: true }, confirmBox,
        h('label', { for: 'resched-override' }, 'I understand. Move it onto this protected day anyway (for example the Section 8 weather swap).'));
      const errorEl = fieldError('resched-error', '');
      const submit = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Move session');

      const render = () => {
        const newDate = dateInput.value;
        preview.replaceChildren();
        errorEl.hidden = true;
        if (!newDate) { preview.append(h('p', { class: 'muted' }, 'Pick a date to preview the change.')); confirmRow.hidden = true; return; }
        const r = checkReschedule({ session: s, newDate, today, workspace: ws });
        const topicNames = s.topicIds.map((id) => state.topics.find((t) => t.id === id)).filter(Boolean).map((t) => `Ch ${t.chapter} ${t.title}`);
        preview.append(
          h('p', null, h('strong', null, 'Preview')),
          h('ul', null,
            h('li', null, `Session: ${s.title}`),
            h('li', null, `From ${formatLong(s.date)} → to ${formatLong(newDate)}`),
            h('li', null, 'Who: ', s.participants.map((p) => personChip(p, { small: true }))),
            h('li', null, `Topics: ${topicNames.join(', ') || 'none linked'}`),
            h('li', null, 'Chapter progress and ticked tasks: unchanged. The status returns to Planned.')),
        );
        r.errors.forEach((e) => preview.append(h('p', { class: 'field-error' }, e)));
        r.warnings.forEach((w) => preview.append(h('p', { class: 'warning' }, `⚠ Protected day: ${w}`)));
        confirmRow.hidden = r.warnings.length === 0;
        submit.disabled = !r.ok;
      };
      dateInput.addEventListener('input', render);
      const form = h('form', { class: 'form' },
        h('p', { class: 'muted' }, 'The schedule\'s recovery rules (Section 11.1):'),
        h('ul', { class: 'small' }, (ws?.recoveryRules || []).map((r) => h('li', null, r))),
        buffers.length > 0 && h('div', { class: 'field' },
          h('p', { class: 'small' }, h('strong', null, 'Explicit buffer slots: ')),
          h('div', { class: 'chip-row' }, buffers.map((b) => h('button', {
            type: 'button', class: 'btn btn-sm', onclick: () => { dateInput.value = b.date; render(); },
          }, `${formatShort(b.date)}: ${b.title}`)))),
        h('div', { class: 'field' }, h('label', { for: 'resched-date' }, 'New date'), dateInput),
        h('div', { class: 'field' }, h('label', { for: 'resched-reason' }, 'Reason (optional)'), reasonInput),
        preview, confirmRow, errorEl,
        h('div', { class: 'dialog-actions' },
          h('button', { class: 'btn', type: 'button', onclick: () => close() }, 'Cancel'),
          submit));
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const r = checkReschedule({ session: s, newDate: dateInput.value, today, workspace: ws });
        if (!r.ok) { errorEl.textContent = r.errors[0]; errorEl.hidden = false; return; }
        if (r.warnings.length && !confirmBox.checked) {
          errorEl.textContent = 'This is a protected day. Tick the confirmation box to move the session there anyway.';
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
    message: `Permanently delete "${s.title}" on ${formatLong(s.date)}? This removes the session for both of you. Ticked tasks and chapter progress are not affected.`,
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
    title: editing ? 'Edit session' : 'Add a session',
    wide: true,
    build: (close) => {
      const errs = {};
      const field = (id, label, input, hint) => {
        errs[id] = fieldError(`${id}-err`, '');
        input.setAttribute('aria-describedby', `${id}-err`);
        return h('div', { class: 'field' }, h('label', { for: id }, label), hint && h('p', { class: 'muted small' }, hint), input, errs[id]);
      };
      const title = h('input', { id: 'sf-title', type: 'text', maxlength: LIMITS.title, value: v.title, required: true, autofocus: true });
      const date = h('input', { id: 'sf-date', type: 'date', value: v.date, max: state.workspace?.examDate || null, required: true });
      const type = h('select', { id: 'sf-type' }, Object.entries(SESSION_TYPES).filter(([k]) => k !== 'exam')
        .map(([k, t]) => h('option', { value: k, selected: v.type === k }, t.label)));
      const people = h('fieldset', { class: 'fieldset' }, h('legend', null, 'Who'), PROFILE_IDS.map((p) => h('label', { class: 'check-pill' },
        h('input', { type: 'checkbox', name: 'sf-people', value: p, checked: v.participants.includes(p) }), PROFILES[p].name)));
      const timeLabel = h('input', { id: 'sf-timelabel', type: 'text', maxlength: LIMITS.timeLabel, value: v.timeLabel || '', placeholder: 'e.g. Evening' });
      const start = h('input', { id: 'sf-start', type: 'time', value: v.startTime || '' });
      const end = h('input', { id: 'sf-end', type: 'time', value: v.endTime || '' });
      const topics = h('fieldset', { class: 'fieldset' }, h('legend', null, 'Topics (optional)'), h('div', { class: 'chip-row' },
        activeTopics(state.topics).map((t) => h('label', { class: 'check-pill' },
          h('input', { type: 'checkbox', name: 'sf-topics', value: t.id, checked: v.topicIds.includes(t.id) }), `Ch ${t.chapter}`))));
      const notes = h('textarea', { id: 'sf-notes', rows: 3, maxlength: LIMITS.notes });
      notes.value = v.notes || '';
      const optional = h('input', { type: 'checkbox', id: 'sf-optional', checked: v.optional });
      const peopleErr = fieldError('sf-people-err', '');
      const form = h('form', { class: 'form', novalidate: true },
        field('sf-title', 'Title', title),
        h('div', { class: 'grid-2' }, field('sf-date', 'Date', date), field('sf-type', 'Type', type)),
        people, peopleErr,
        h('div', { class: 'grid-3' }, field('sf-timelabel', 'Time label', timeLabel), field('sf-start', 'Start (optional)', start), field('sf-end', 'End (optional)', end)),
        topics,
        field('sf-notes', 'Notes', notes),
        h('div', { class: 'field-inline' }, optional, h('label', { for: 'sf-optional' }, 'Optional session')),
        h('div', { class: 'dialog-actions' },
          h('button', { class: 'btn', type: 'button', onclick: () => close() }, 'Cancel'),
          h('button', { class: 'btn btn-primary', type: 'submit' }, editing ? 'Save changes' : 'Add session')));
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
        for (const [k, el] of Object.entries(errs)) { el.hidden = true; el.textContent = ''; }
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
