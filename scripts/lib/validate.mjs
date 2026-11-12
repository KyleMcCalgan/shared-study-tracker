// Structural validation of data/seed-schedule.json (spec §9.1 step 8).
import { isValidISODate, isValidTime } from '../../website/js/date-utils.js';
import {
  PROFILE_IDS, SESSION_TYPE_IDS, SESSION_STATUS_IDS, DISCUSSION_STATUS_IDS, DISCUSSION_KIND_IDS,
  PRIORITIES, LIMITS, ITEM_ID_RE, WORKSPACE_ID, SCHEMA_VERSION,
} from '../../website/js/config.js';

const ID_RE = /^[a-z0-9][a-z0-9-]{0,99}$/;

export function validateSeed(seed) {
  const errors = []; const warnings = [];
  const err = (m) => errors.push(m); const warn = (m) => warnings.push(m);

  if (seed.schemaVersion !== SCHEMA_VERSION) err(`schemaVersion must be ${SCHEMA_VERSION}`);
  if (seed.workspaceId !== WORKSPACE_ID) err(`workspaceId must be ${WORKSPACE_ID}`);
  if (!/^[0-9a-f]{64}$/.test(seed.sourceHash || '')) err('sourceHash missing');
  const ws = seed.workspace || {};
  if (!isValidISODate(ws.examDate)) err('workspace.examDate is not a valid date');
  if (!isValidTime(ws.examStart) || !isValidTime(ws.examEnd) || ws.examEnd < ws.examStart) err('workspace exam times invalid');
  if (ws.timezone !== 'Africa/Johannesburg') err('workspace.timezone must be Africa/Johannesburg');

  // topics
  const topicIds = new Set();
  for (const t of seed.topics || []) {
    if (!ID_RE.test(t.id)) err(`topic id "${t.id}" invalid`);
    if (topicIds.has(t.id)) err(`duplicate topic id ${t.id}`);
    topicIds.add(t.id);
    if (!t.title || t.title.length > LIMITS.title) err(`topic ${t.id} title missing/too long`);
    if (!Number.isInteger(t.order)) err(`topic ${t.id} order missing`);
    const exIds = new Set();
    for (const e of t.examples || []) {
      if (!ITEM_ID_RE.test(e.id)) err(`example id "${e.id}" invalid`);
      if (exIds.has(e.id)) err(`duplicate example id ${e.id}`);
      exIds.add(e.id);
    }
  }
  if (topicIds.size === 0) err('no topics');

  // queue
  const qIds = new Set();
  for (const q of ws.davidQueue || []) {
    if (!ITEM_ID_RE.test(q.id)) err(`queue id "${q.id}" invalid`);
    if (qIds.has(q.id)) err(`duplicate queue id ${q.id}`);
    qIds.add(q.id);
    for (const tid of q.topicIds) if (!topicIds.has(tid)) err(`queue ${q.code} references unknown topic ${tid}`);
  }

  // sessions
  const sIds = new Set();
  const seenSemantic = new Set();
  for (const s of seed.sessions || []) {
    const where = `session ${s.id}`;
    if (!ID_RE.test(s.id)) err(`${where}: invalid id`);
    if (sIds.has(s.id)) err(`duplicate session id ${s.id}`);
    sIds.add(s.id);
    if (!isValidISODate(s.date)) err(`${where}: invalid date ${s.date}`);
    if (s.date !== s.sourceDate) err(`${where}: date and sourceDate differ in seed`);
    if (!SESSION_TYPE_IDS.includes(s.type)) err(`${where}: invalid type ${s.type}`);
    if (!SESSION_STATUS_IDS.includes(s.status)) err(`${where}: invalid status ${s.status}`);
    if (!Array.isArray(s.participants) || !s.participants.length || !s.participants.every((p) => PROFILE_IDS.includes(p))) err(`${where}: invalid participants`);
    if (new Set(s.participants).size !== s.participants.length) err(`${where}: duplicate participants`);
    for (const tid of s.topicIds) if (!topicIds.has(tid)) err(`${where}: unknown topic ${tid}`);
    if (s.startTime !== null && !isValidTime(s.startTime)) err(`${where}: invalid startTime`);
    if (s.endTime !== null && !isValidTime(s.endTime)) err(`${where}: invalid endTime`);
    if (s.startTime && s.endTime && s.endTime < s.startTime) err(`${where}: endTime before startTime`);
    if (!s.title || s.title.length > LIMITS.title) err(`${where}: title missing or longer than ${LIMITS.title}`);
    if (s.notes && s.notes.length > 6000) warn(`${where}: imported notes are long (${s.notes.length} chars)`);
    if (s.type === 'joint' && s.participants.length < 2) err(`${where}: joint session needs both participants`);
    const tIds = new Set();
    for (const t of s.tasks) {
      if (!ITEM_ID_RE.test(t.id)) err(`${where}: invalid task id ${t.id}`);
      if (tIds.has(t.id)) err(`${where}: duplicate task id ${t.id}`);
      tIds.add(t.id);
      if (t.checkItemId && !qIds.has(t.checkItemId)) err(`${where}: task ${t.id} links unknown queue item ${t.checkItemId}`);
      if (!t.text) err(`${where}: task ${t.id} has no text`);
      if (`${s.id}--${t.id}`.length > 119) err(`${where}: task check id too long`);
    }
    const sem = `${s.date}|${s.type}|${s.participants.join(',')}|${s.title}`;
    if (seenSemantic.has(sem)) err(`${where}: duplicate session content (${sem})`);
    seenSemantic.add(sem);
    if (s.date > ws.examDate) err(`${where}: scheduled after the exam`);
  }

  // discussions
  const dIds = new Set();
  for (const d of seed.discussions || []) {
    if (!ID_RE.test(d.id)) err(`discussion id "${d.id}" invalid`);
    if (dIds.has(d.id)) err(`duplicate discussion id ${d.id}`);
    dIds.add(d.id);
    if (!DISCUSSION_STATUS_IDS.includes(d.status)) err(`discussion ${d.id}: invalid status`);
    if (!DISCUSSION_KIND_IDS.includes(d.kind)) err(`discussion ${d.id}: invalid kind`);
    if (!PRIORITIES.includes(d.priority)) err(`discussion ${d.id}: invalid priority`);
    if (d.raisedBy !== null && !PROFILE_IDS.includes(d.raisedBy)) err(`discussion ${d.id}: invalid raisedBy`);
    for (const tid of d.topicIds) if (!topicIds.has(tid)) err(`discussion ${d.id}: unknown topic ${tid}`);
    if (!d.title || d.title.length > LIMITS.title) err(`discussion ${d.id}: title missing/too long`);
  }

  // protected dates
  for (const p of ws.protectedDates || []) if (!isValidISODate(p.date)) err(`protected date ${p.date} invalid`);

  // coverage: every topic should be planned somewhere for Kyle
  for (const tid of topicIds) {
    if (!(seed.sessions || []).some((s) => s.participants.includes('kyle') && s.type === 'individual' && s.topicIds.includes(tid))) {
      warn(`topic ${tid} has no individual Kyle session`);
    }
  }
  return { errors, warnings };
}
