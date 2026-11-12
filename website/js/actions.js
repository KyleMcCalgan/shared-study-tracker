// All user-initiated writes. Each action is a small atomic batch: the change
// itself plus one lightweight activity entry. Writes are narrowly scoped
// (one progress/check doc, or specific session fields), never whole plans.
import { state, setSync, SERVER_TIME } from './store.js';
import { PROFILES, LIMITS } from './config.js';
import {
  progressDocId, checkDocId, getProgress, isFirstPassDone,
} from './model.js';
import { formatShort } from './date-utils.js';
import { toast } from './ui.js';

let backend = null;
export function setBackend(b) { backend = b; }

function activityOp(type, profileId, text) {
  return {
    op: 'set',
    col: 'activity',
    id: backend.newId('activity'),
    data: {
      type, profileId, text: text.slice(0, LIMITS.activity), createdAt: SERVER_TIME, byUid: state.uid,
    },
  };
}

function friendlyError(err) {
  const code = err?.code || '';
  if (code.includes('permission-denied')) return 'Not saved: the database refused the change (permission denied). This device may no longer be approved, or the data was invalid.';
  if (code.includes('unavailable')) return 'Not saved: the database is unreachable. Check your connection and try again.';
  if (code.includes('not-found')) return 'Not saved: that item no longer exists. It may have been removed on another device.';
  return `Not saved: ${err?.message || 'unknown error'}.`;
}

/**
 * Run a batch with honest status reporting: "Saving…" until the server
 * acknowledges; errors are surfaced and the optimistic local change reverts.
 */
async function run(ops, { success } = {}) {
  if (!backend) throw new Error('No backend');
  setSync({ pending: state.sync.pending + 1, lastWriteError: null });
  try {
    await backend.write(ops);
    if (success) toast(success, 'success');
    return true;
  } catch (err) {
    console.error('Write failed', err);
    setSync({ lastWriteError: friendlyError(err) });
    toast(friendlyError(err), 'error', { timeout: 8000 });
    return false;
  } finally {
    setSync({ pending: Math.max(0, state.sync.pending - 1) });
  }
}

const who = (p) => PROFILES[p]?.name ?? p;
const topicTitle = (id) => {
  const t = state.topics.find((x) => x.id === id);
  return t ? `Ch ${t.chapter} ${t.title}` : id;
};

// ------------------------------------------------------------------ progress

function progressOps(profileId, topicId, patch) {
  const id = progressDocId(profileId, topicId);
  const current = getProgress(state.progressById, profileId, topicId);
  const base = { updatedAt: SERVER_TIME, updatedByUid: state.uid };
  if (current.missing) {
    return [{
      op: 'set',
      col: 'progress',
      id,
      data: {
        profileId, topicId, status: 'not_started', depth: 'none', notes: '', startedAt: null, completedAt: null, ...patch, ...base,
      },
    }];
  }
  return [{ op: 'update', col: 'progress', id, data: { ...patch, ...base } }];
}

export function setProgressStatus(profileId, topicId, status) {
  const current = getProgress(state.progressById, profileId, topicId);
  if (current.status === status) return Promise.resolve(true);
  const patch = { status };
  if (status !== 'not_started' && !current.startedAt) patch.startedAt = SERVER_TIME;
  if (status === 'not_started') patch.startedAt = null;
  if (isFirstPassDone(status) && !isFirstPassDone(current.status)) patch.completedAt = SERVER_TIME;
  if (!isFirstPassDone(status)) patch.completedAt = null; // explicitly reopened
  const label = { not_started: 'reset to Not started', in_progress: 'started', completed: 'completed the first pass of', needs_practice: 'marked Needs more practice on', exam_ready: 'marked Exam ready on' }[status];
  return run([
    ...progressOps(profileId, topicId, patch),
    activityOp('progress', profileId, `${who(profileId)} ${label} ${topicTitle(topicId)}`),
  ]);
}

export function setProgressDepth(profileId, topicId, depth) {
  return run(progressOps(profileId, topicId, { depth }));
}

export function saveProgressNotes(profileId, topicId, notes) {
  return run(progressOps(profileId, topicId, { notes: notes.slice(0, LIMITS.notes) }), { success: 'Notes saved' });
}

// ------------------------------------------------------------------ checklists

export function setCheck(profileId, itemId, done, label) {
  const id = checkDocId(profileId, itemId);
  return run([
    { op: 'set', col: 'checks', id, data: { profileId, itemId, done, updatedAt: SERVER_TIME, updatedByUid: state.uid } },
    activityOp('check', profileId, `${who(profileId)} ${done ? 'ticked' : 'unticked'}: ${label}`),
  ]);
}

// ------------------------------------------------------------------ sessions

function sessionUpdate(session, patch, activityText) {
  const ops = [{ op: 'update', col: 'sessions', id: session.id, data: { ...patch, updatedAt: SERVER_TIME, updatedByUid: state.uid } }];
  if (activityText) ops.push(activityOp('session', state.profile, activityText));
  return ops;
}

export function setSessionStatus(session, status, reason = '') {
  const verb = { planned: 'reopened', completed: 'marked completed', missed: 'marked missed', cancelled: 'cancelled' }[status];
  return run(sessionUpdate(session, { status, statusReason: reason.slice(0, LIMITS.reason) },
    `${who(state.profile)} ${verb}: ${session.title} (${formatShort(session.date)})`));
}

export function rescheduleSession(session, newDate, reason = '') {
  return run(sessionUpdate(session, {
    date: newDate,
    rescheduledFrom: session.date,
    status: 'planned',
    statusReason: reason.slice(0, LIMITS.reason),
  }, `${who(state.profile)} moved "${session.title}" from ${formatShort(session.date)} to ${formatShort(newDate)}`),
  { success: `Moved to ${formatShort(newDate)}` });
}

export function saveSessionNotes(session, userNotes) {
  return run(sessionUpdate(session, { userNotes: userNotes.slice(0, LIMITS.notes) }), { success: 'Note saved' });
}

export function createSession(input) {
  const id = backend.newId('sessions');
  return run([
    {
      op: 'set',
      col: 'sessions',
      id,
      data: {
        date: input.date,
        sourceDate: null,
        startTime: input.startTime || null,
        endTime: input.endTime || null,
        timeLabel: input.timeLabel || null,
        type: input.type,
        title: input.title.trim(),
        participants: input.participants,
        topicIds: input.topicIds || [],
        optional: Boolean(input.optional),
        notes: (input.notes || '').trim(),
        status: 'planned',
        statusReason: '',
        userNotes: '',
        rescheduledFrom: null,
        imported: false,
        archived: false,
        createdBy: state.profile,
        createdAt: SERVER_TIME,
        updatedAt: SERVER_TIME,
        updatedByUid: state.uid,
      },
    },
    activityOp('session', state.profile, `${who(state.profile)} added a session: ${input.title.trim()} (${formatShort(input.date)})`),
  ], { success: 'Session added' });
}

export function updateUserSession(session, input) {
  return run(sessionUpdate(session, {
    date: input.date,
    startTime: input.startTime || null,
    endTime: input.endTime || null,
    timeLabel: input.timeLabel || null,
    type: input.type,
    title: input.title.trim(),
    participants: input.participants,
    topicIds: input.topicIds || [],
    optional: Boolean(input.optional),
    notes: (input.notes || '').trim(),
  }, `${who(state.profile)} edited: ${input.title.trim()}`), { success: 'Session updated' });
}

export function deleteUserSession(session) {
  if (session.imported) return Promise.resolve(false);
  return run([
    { op: 'delete', col: 'sessions', id: session.id },
    activityOp('session', state.profile, `${who(state.profile)} deleted: ${session.title} (${formatShort(session.date)})`),
  ], { success: 'Session deleted' });
}

// ------------------------------------------------------------------ discussions

export function createDiscussion(input) {
  const id = backend.newId('discussions');
  return run([
    {
      op: 'set',
      col: 'discussions',
      id,
      data: {
        title: input.title.trim(),
        topicIds: input.topicIds,
        raisedBy: input.raisedBy,
        kind: input.kind,
        status: 'open',
        priority: input.priority,
        notes: (input.notes || '').trim(),
        sessionId: input.sessionId || null,
        imported: false,
        createdAt: SERVER_TIME,
        updatedAt: SERVER_TIME,
        updatedByUid: state.uid,
      },
    },
    activityOp('discussion', input.raisedBy, `${who(input.raisedBy)} raised: ${input.title.trim()}`),
  ], { success: 'Added to the discussion queue' });
}

export function updateDiscussion(d, patch, activityText) {
  const ops = [{ op: 'update', col: 'discussions', id: d.id, data: { ...patch, updatedAt: SERVER_TIME, updatedByUid: state.uid } }];
  if (activityText) ops.push(activityOp('discussion', state.profile, activityText));
  return run(ops, patch.notes !== undefined ? { success: 'Saved' } : {});
}
