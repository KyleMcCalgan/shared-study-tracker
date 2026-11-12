// Pure domain logic (no DOM, no Firebase). Unit-tested in tests/model.test.mjs.
import {
  PROFILE_IDS, FIRST_PASS_STATUSES, PROGRESS_STATUS_IDS, NON_STUDY_TYPES, LIMITS,
  SESSION_TYPE_IDS, DISCUSSION_KIND_IDS, PRIORITIES, ITEM_ID_RE,
} from './config.js';
import { isValidISODate, isValidTime, compareDates } from './date-utils.js';

export const progressDocId = (profileId, topicId) => `${profileId}__${topicId}`;
export const checkDocId = (profileId, itemId) => `${profileId}__${itemId}`;
/** Checklist item ID for a session task (queue-linked tasks share the queue item's ID). */
export const taskItemId = (session, task) => task.checkItemId || `${session.id}--${task.id}`;

export function isFirstPassDone(status) { return FIRST_PASS_STATUSES.includes(status); }

export function activeTopics(topics) {
  return topics.filter((t) => !t.archived).sort((a, b) => a.order - b.order);
}

/** Progress record for (profile, topic), defaulting to not_started when missing. */
export function getProgress(progressById, profileId, topicId) {
  const p = progressById[progressDocId(profileId, topicId)];
  return p && PROGRESS_STATUS_IDS.includes(p.status)
    ? p
    : { profileId, topicId, status: 'not_started', depth: 'none', notes: '', startedAt: null, completedAt: null, missing: true };
}

/**
 * Per-profile completion stats. Denominator = all active syllabus topics
 * (spec §5.2: not only assigned topics).
 */
export function computeStats(topics, progressById, profileId) {
  const list = activeTopics(topics);
  const counts = Object.fromEntries(PROGRESS_STATUS_IDS.map((s) => [s, 0]));
  for (const t of list) counts[getProgress(progressById, profileId, t.id).status] += 1;
  const total = list.length;
  const firstPass = FIRST_PASS_STATUSES.reduce((a, s) => a + counts[s], 0);
  return {
    total,
    counts,
    firstPass,
    examReady: counts.exam_ready,
    inProgress: counts.in_progress,
    notStarted: counts.not_started,
    pct: total ? Math.round((firstPass / total) * 100) : 0,
  };
}

export function isChecked(checksById, profileId, itemId) {
  return Boolean(checksById[checkDocId(profileId, itemId)]?.done);
}

export function sortSessions(list) {
  const typeOrder = { exam: 0, rest: 1, other: 2, individual: 3, buffer: 4, joint: 5, practice: 6 };
  return [...list].sort((a, b) => compareDates(a.date, b.date)
    || (a.startTime || '99').localeCompare(b.startTime || '99')
    || (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9)
    || (a.participants.length - b.participants.length)
    || a.participants.join().localeCompare(b.participants.join())
    || a.id.localeCompare(b.id));
}

export function visibleSessions(sessions) { return sessions.filter((s) => !s.archived); }

export function sessionsOn(sessions, date) {
  return sortSessions(visibleSessions(sessions).filter((s) => s.date === date));
}

export function involves(session, profileId) { return session.participants.includes(profileId); }

/** Stable re-order for display: my own sessions, then shared ones, then the other person's. */
export function mineFirst(list, profileId) {
  const rank = (s) => (!involves(s, profileId) ? 2 : s.participants.length === 1 ? 0 : 1);
  return list.map((s, i) => [s, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(([s]) => s);
}

/** Split "J1: Ch 1–2 (long detail…)" into a short title and a subtitle for display. */
export function splitTitle(title) {
  const m = /^(.{6,}?)\s*\(([^()]{12,})\)\s*$/.exec(title || '');
  return m && title.length > 40 ? { main: m[1], sub: m[2] } : { main: title, sub: null };
}

/** Filter values: all | kyle | david | together | restbuffer */
export function matchesFilter(session, filter) {
  switch (filter) {
    case 'kyle':
    case 'david':
      return involves(session, filter);
    case 'together':
      return session.participants.length > 1 && ['joint', 'practice'].includes(session.type);
    case 'restbuffer':
      return ['rest', 'buffer'].includes(session.type);
    default:
      return true;
  }
}

export function isStudySession(session) { return !NON_STUDY_TYPES.includes(session.type); }

/** Past planned study sessions for this profile that nobody has marked yet. */
export function overdueSessions(sessions, today, profileId) {
  return sortSessions(visibleSessions(sessions).filter((s) => s.date < today && s.status === 'planned'
    && isStudySession(s) && involves(s, profileId)));
}

export function nextSharedSession(sessions, today) {
  return sortSessions(visibleSessions(sessions).filter((s) => s.date >= today && s.type === 'joint'
    && s.status === 'planned'))[0] || null;
}

export function upcomingSpecialDays(sessions, today) {
  return sortSessions(visibleSessions(sessions).filter((s) => s.date >= today
    && ['rest', 'buffer', 'practice', 'exam'].includes(s.type) && s.status !== 'cancelled'));
}

/** Sessions ahead (today or later, planned, study-type) for a profile. */
export function sessionsAhead(sessions, today, profileId) {
  return visibleSessions(sessions).filter((s) => s.date >= today && s.status === 'planned'
    && isStudySession(s) && involves(s, profileId)).length;
}

/** Protected-date reasons that apply to moving these participants' work onto `date`. */
export function protectedReasons(workspace, date, participants) {
  return (workspace?.protectedDates || [])
    .filter((p) => p.date === date && p.appliesTo.some((who) => participants.includes(who)))
    .map((p) => p.reason);
}

/** Buffer sessions after `fromDate` that a participant could use for catch-up. */
export function bufferSlots(sessions, fromDate, participants) {
  return sortSessions(visibleSessions(sessions).filter((s) => s.type === 'buffer' && s.date > fromDate
    && s.status === 'planned' && s.participants.some((p) => participants.includes(p))));
}

/**
 * Validate a reschedule. Returns { ok, errors[], warnings[] }.
 * Protected days are warnings that require explicit confirmation, never silent.
 */
export function checkReschedule({ session, newDate, today, workspace }) {
  const errors = []; const warnings = [];
  if (!isValidISODate(newDate)) errors.push('Choose a valid date.');
  else {
    if (newDate === session.date) errors.push('The new date is the same as the current date.');
    if (newDate < today) errors.push('You cannot move a session into the past.');
    if (workspace?.examDate && newDate > workspace.examDate) errors.push('That date is after the exam.');
    if (session.type === 'exam') errors.push('The exam date comes from the official announcement and cannot be moved here.');
    warnings.push(...protectedReasons(workspace, newDate, session.participants));
  }
  return { ok: errors.length === 0, errors, warnings };
}

export function davidQueueStatus(queue, checksById) {
  const items = (queue || []).map((q) => ({ ...q, done: isChecked(checksById, 'david', q.id) }));
  const doneHours = items.filter((q) => q.done).reduce((a, q) => a + q.hours, 0);
  const totalHours = items.reduce((a, q) => a + q.hours, 0);
  const next = items.find((q) => !q.done) || null;
  let lastDone = null;
  for (const q of items) if (q.done) lastDone = q;
  return { items, doneCount: items.filter((q) => q.done).length, doneHours, totalHours, next, lastDone };
}

export function exampleStats(topics, checksById, profileId) {
  const all = activeTopics(topics).flatMap((t) => t.examples || []);
  return { total: all.length, done: all.filter((e) => isChecked(checksById, profileId, e.id)).length };
}

export function sortDiscussions(list) {
  const rank = { open: 0, deferred: 1, discussed: 2 };
  return [...list].sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9)
    || (a.status === 'open' ? (b.priority === 'high') - (a.priority === 'high') : 0)
    || (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function jointDoneForTopic(topic, sessions) {
  // A chapter's "joint discussion done" = any completed joint session that covers it.
  return visibleSessions(sessions).some((s) => s.type === 'joint' && s.status === 'completed' && s.topicIds.includes(topic.id));
}

// ------------------------------------------------------------ input validation

function textOk(v, max, required) {
  if (typeof v !== 'string') return false;
  if (required && !v.trim()) return false;
  return v.length <= max;
}

export function validateSessionInput(input) {
  const errors = {};
  if (!textOk(input.title, LIMITS.title, true)) errors.title = `Enter a title (max ${LIMITS.title} characters).`;
  if (!isValidISODate(input.date)) errors.date = 'Choose a valid date.';
  if (!SESSION_TYPE_IDS.includes(input.type) || input.type === 'exam') errors.type = 'Choose a session type.';
  if (!Array.isArray(input.participants) || !input.participants.length || !input.participants.every((p) => PROFILE_IDS.includes(p))) {
    errors.participants = 'Choose at least one participant.';
  }
  if (input.type === 'joint' && input.participants?.length < 2) errors.participants = 'A joint session needs both Kyle and David.';
  if (input.startTime && !isValidTime(input.startTime)) errors.startTime = 'Use HH:MM.';
  if (input.endTime && !isValidTime(input.endTime)) errors.endTime = 'Use HH:MM.';
  if (input.startTime && input.endTime && input.endTime < input.startTime) errors.endTime = 'End time must be after the start time.';
  if (input.timeLabel && !textOk(input.timeLabel, LIMITS.timeLabel)) errors.timeLabel = `Max ${LIMITS.timeLabel} characters.`;
  if (input.notes && !textOk(input.notes, LIMITS.notes)) errors.notes = `Max ${LIMITS.notes} characters.`;
  return errors;
}

export function validateDiscussionInput(input, topicIds) {
  const errors = {};
  if (!textOk(input.title, LIMITS.title, true)) errors.title = `Enter the question or topic (max ${LIMITS.title} characters).`;
  if (input.notes && !textOk(input.notes, LIMITS.notes)) errors.notes = `Max ${LIMITS.notes} characters.`;
  if (!DISCUSSION_KIND_IDS.includes(input.kind)) errors.kind = 'Choose a type.';
  if (!PRIORITIES.includes(input.priority)) errors.priority = 'Choose a priority.';
  if (!PROFILE_IDS.includes(input.raisedBy)) errors.raisedBy = 'Unknown profile.';
  if (!Array.isArray(input.topicIds) || input.topicIds.some((t) => !topicIds.includes(t))) errors.topicIds = 'Unknown topic.';
  return errors;
}

export function isValidItemId(id) { return ITEM_ID_RE.test(id); }

// ------------------------------------------------------------ display helpers

const TIER_WORD = { MUST: 'core', SHOULD: 'extras', COULD: 'stretch' };
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
function clip(s, n = 44) {
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > n * 0.5 ? cut.slice(0, sp) : cut).replace(/[\s,;:+–-]+$/, '')}…`;
}

/**
 * Short, scannable name for a schedule task; the full source text stays
 * available as the task's detail.
 *   "Ch 1: S4–7 (definition…" MUST      → "Ch 1 core"
 *   "Q3 Ch 2 part B, including…"        → "Q3 · Ch 2 part B"
 *   "P1 Active-recall warm-up (…): …"   → "P1 · Active-recall warm-up"
 */
export function shortTaskLabel(task) {
  const text = String(task.text || '').trim();
  const firstClause = (s) => s.split(/\s*[:(;—,]\s*|\.\s/)[0].trim();
  if (task.code && /^[TP]\d+$/.test(task.code)) return clip(`${task.code} · ${cap(firstClause(text))}`);
  const q = /^(Q\d+)\s+(.*)$/.exec(text);
  if (q) return clip(`${q[1]} · ${firstClause(q[2])}`);
  const ch = /^(Ch \d+(?: part [AB])?)\b/.exec(text);
  if (ch && TIER_WORD[task.tier]) return `${ch[1]} ${TIER_WORD[task.tier]}`;
  const lead = /^([A-Z][\w-]{1,12}):\s*(.+)$/.exec(text); // e.g. "Recall: explain Ch 3–4 aloud"
  if (lead) return clip(`${lead[1]} · ${firstClause(lead[2])}`);
  return clip(cap(firstClause(text)));
}

/** Hours of a session's tasks (sum of numeric estimates), or null. */
export function taskHours(session) {
  const hrs = (session.tasks || []).map((t) => t.hours).filter((x) => typeof x === 'number');
  return hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) * 100) / 100 : null;
}
