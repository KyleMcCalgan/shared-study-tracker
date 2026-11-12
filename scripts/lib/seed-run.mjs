// Seed runner shared by scripts/seed-firestore.mjs and tests/seed.
import { FieldValue } from 'firebase-admin/firestore';
import { planSeed, summarize, isNoop } from './seed-plan.mjs';

export async function runSeed({ db, seed, apply, updateChanged, archiveRemoved, log = console.log }) {
  const wsRef = db.collection('workspaces').doc(seed.workspaceId);
  const [wsSnap, topicsSnap, sessionsSnap, discSnap] = await Promise.all([
    wsRef.get(), wsRef.collection('topics').get(), wsRef.collection('sessions').get(), wsRef.collection('discussions').get(),
  ]);
  const toMap = (snap) => new Map(snap.docs.map((d) => [d.id, d.data()]));
  const existing = {
    workspace: wsSnap.exists ? wsSnap.data() : null,
    topics: toMap(topicsSnap),
    sessions: toMap(sessionsSnap),
    discussions: toMap(discSnap),
  };
  const plan = planSeed(seed, existing);
  log(summarize(plan));
  if (!apply) {
    log(isNoop(plan) ? '\nDry run: Firestore already matches the seed.' : '\nDry run only. Re-run with --apply to write.');
    return { plan, written: 0 };
  }

  const ops = [];
  const now = FieldValue.serverTimestamp();
  if (plan.workspace.action !== 'same') ops.push([wsRef, { ...seed.workspace, seededAt: now }, { merge: true }]);
  for (const t of plan.topics.create) ops.push([wsRef.collection('topics').doc(t.id), { ...t, seededAt: now }]);
  for (const s of plan.sessions.create) ops.push([wsRef.collection('sessions').doc(s.id), { ...s, seededAt: now }]);
  for (const d of plan.discussions.create) ops.push([wsRef.collection('discussions').doc(d.id), { ...d, createdAt: now, updatedAt: now }]);
  if (updateChanged) {
    for (const u of plan.topics.update) ops.push([wsRef.collection('topics').doc(u.id), { ...u.data, seededAt: now }, { merge: true }]);
    for (const u of plan.sessions.update) ops.push([wsRef.collection('sessions').doc(u.id), { ...u.data, seededAt: now }, { merge: true }]);
  } else if (plan.topics.update.length || plan.sessions.update.length) {
    log('\nChanged imported docs were NOT updated. Review the diff above, then add --update-changed to apply them.');
  }
  if (archiveRemoved) {
    for (const id of plan.topics.removed) ops.push([wsRef.collection('topics').doc(id), { archived: true }, { merge: true }]);
    for (const id of plan.sessions.removed) ops.push([wsRef.collection('sessions').doc(id), { archived: true }, { merge: true }]);
  }

  // Firestore batches hold at most 500 writes.
  for (let i = 0; i < ops.length; i += 400) {
    const batch = db.batch();
    for (const [ref, data, opts] of ops.slice(i, i + 400)) {
      if (opts) batch.set(ref, data, opts); else batch.create(ref, data);
    }
    await batch.commit();
  }
  log(`\n✔ Applied ${ops.length} write(s).`);
  return { plan, written: ops.length };
}
