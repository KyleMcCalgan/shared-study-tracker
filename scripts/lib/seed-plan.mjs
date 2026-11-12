// Pure diff between data/seed-schedule.json and what is already in Firestore.
// Guarantees (spec §3.4, §9.4):
//  - stable IDs → re-running never duplicates documents;
//  - user-owned fields (session date/status/notes, progress, checks, discussion
//    state) are never overwritten;
//  - changes to already-imported docs are only applied with an explicit flag;
//  - docs that disappeared from the source are reported, never deleted.

export const SESSION_SOURCE_FIELDS = [
  'sourceDate', 'startTime', 'endTime', 'timeLabel', 'durationLabel', 'type', 'code', 'title', 'participants', 'topicIds',
  'optional', 'tasks', 'outcome', 'notes', 'goal', 'sourceRef', 'sourceSection', 'imported',
];
export const SESSION_USER_FIELDS = ['date', 'status', 'statusReason', 'userNotes', 'rescheduledFrom', 'archived'];

function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  return JSON.stringify(v ?? null);
}
export const same = (a, b) => stable(a) === stable(b);

function changedFields(target, existing, fields) {
  return fields.filter((f) => !same(target[f], existing[f]));
}

const WORKSPACE_IGNORED = new Set(['id']);

/**
 * @param seed      parsed seed JSON
 * @param existing  { workspace: obj|null, topics: Map, sessions: Map, discussions: Map }
 */
export function planSeed(seed, existing) {
  const plan = {
    workspace: { action: 'same', fields: [] },
    topics: { create: [], update: [], same: [], removed: [] },
    sessions: { create: [], update: [], same: [], removed: [], conflicts: [] },
    discussions: { create: [], same: [], removed: [] },
  };

  // workspace metadata (admin-owned, safe to refresh)
  const wsTarget = seed.workspace;
  if (!existing.workspace) plan.workspace = { action: 'create', fields: Object.keys(wsTarget) };
  else {
    const fields = Object.keys(wsTarget).filter((k) => !WORKSPACE_IGNORED.has(k) && !same(wsTarget[k], existing.workspace[k]));
    plan.workspace = { action: fields.length ? 'update' : 'same', fields };
  }

  // topics (fully admin-owned)
  const topicFields = (t) => Object.keys(t).filter((k) => k !== 'id');
  for (const t of seed.topics) {
    const cur = existing.topics.get(t.id);
    if (!cur) plan.topics.create.push(t);
    else {
      const fields = changedFields(t, cur, topicFields(t));
      if (fields.length) plan.topics.update.push({ id: t.id, fields, data: Object.fromEntries(fields.map((f) => [f, t[f]])) });
      else plan.topics.same.push(t.id);
    }
  }
  const seedTopicIds = new Set(seed.topics.map((t) => t.id));
  for (const [id, cur] of existing.topics) if (!seedTopicIds.has(id) && !cur.archived) plan.topics.removed.push(id);

  // sessions: source fields may be refreshed; user fields are preserved
  for (const s of seed.sessions) {
    const cur = existing.sessions.get(s.id);
    if (!cur) { plan.sessions.create.push(s); continue; }
    const fields = changedFields(s, cur, SESSION_SOURCE_FIELDS);
    if (!fields.length) { plan.sessions.same.push(s.id); continue; }
    const data = Object.fromEntries(fields.map((f) => [f, s[f]]));
    if (fields.includes('sourceDate')) {
      if (cur.date === cur.sourceDate) data.date = s.date; // not rescheduled by users → follow the source
      else plan.sessions.conflicts.push(`${s.id}: source date changed ${cur.sourceDate} → ${s.sourceDate}, but users moved it to ${cur.date}; keeping ${cur.date}`);
    }
    plan.sessions.update.push({ id: s.id, fields, data });
  }
  const seedSessionIds = new Set(seed.sessions.map((s) => s.id));
  for (const [id, cur] of existing.sessions) if (cur.imported && !seedSessionIds.has(id) && !cur.archived) plan.sessions.removed.push(id);

  // discussions: create-only (users own their status/notes afterwards)
  for (const d of seed.discussions) {
    if (existing.discussions.has(d.id)) plan.discussions.same.push(d.id);
    else plan.discussions.create.push(d);
  }
  const seedDiscIds = new Set(seed.discussions.map((d) => d.id));
  for (const [id, cur] of existing.discussions) if (cur.imported && !seedDiscIds.has(id)) plan.discussions.removed.push(id);

  return plan;
}

export function summarize(plan) {
  const L = [];
  L.push(`Workspace: ${plan.workspace.action}${plan.workspace.fields.length && plan.workspace.action === 'update' ? ` (${plan.workspace.fields.join(', ')})` : ''}`);
  for (const k of ['topics', 'sessions']) {
    const p = plan[k];
    L.push(`${k[0].toUpperCase() + k.slice(1)}: ${p.create.length} new, ${p.update.length} changed, ${p.same.length} unchanged, ${p.removed.length} no longer in source`);
    p.create.forEach((x) => L.push(`  + ${x.id}`));
    p.update.forEach((x) => L.push(`  ~ ${x.id}: ${x.fields.join(', ')}`));
    p.removed.forEach((x) => L.push(`  - ${x} (kept; use --archive-removed to hide)`));
  }
  plan.sessions.conflicts.forEach((c) => L.push(`  ! ${c}`));
  const d = plan.discussions;
  L.push(`Discussions: ${d.create.length} new, ${d.same.length} already present (never overwritten), ${d.removed.length} no longer in source (kept)`);
  d.create.forEach((x) => L.push(`  + ${x.id}`));
  return L.join('\n');
}

export function isNoop(plan) {
  return plan.workspace.action === 'same'
    && !plan.topics.create.length && !plan.topics.update.length
    && !plan.sessions.create.length && !plan.sessions.update.length
    && !plan.discussions.create.length;
}
