// Firestore Security Rules tests. Run via the emulator:
//   npm run test:rules
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  initializeTestEnvironment, assertFails, assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc, setDoc, updateDoc, getDoc, getDocs, deleteDoc, collection, serverTimestamp, writeBatch, Timestamp,
} from 'firebase/firestore';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const WS = 'cos330-2026';
const APPROVED = 'approved-uid-kyle-phone';
const APPROVED2 = 'approved-uid-david-laptop';
const STRANGER = 'random-anonymous-uid';
let env;

const p = (...s) => ['workspaces', WS, ...s].join('/');

before(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8180').split(':');
  env = await initializeTestEnvironment({
    projectId: 'demo-study-tracker',
    firestore: { rules: readFileSync(resolve(root, 'firestore.rules'), 'utf8'), host, port: Number(port) },
  });
});
after(async () => { await env?.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'approvedDevices', APPROVED), { label: 'Kyle phone' });
    await setDoc(doc(db, 'approvedDevices', APPROVED2), { label: 'David laptop' });
    await setDoc(doc(db, 'workspaces', WS), { title: 'x', examDate: '2026-11-21', schemaVersion: 1 });
    await setDoc(doc(db, p('topics', 'ch01')), { title: 'Overview', order: 1 });
    await setDoc(doc(db, p('sessions', 'imp-1')), {
      date: '2026-11-16', sourceDate: '2026-11-16', type: 'individual', title: 'Ch 5', participants: ['kyle'], topicIds: ['ch05'],
      status: 'planned', statusReason: '', userNotes: '', rescheduledFrom: null, imported: true, tasks: [], notes: 'n',
    });
    await setDoc(doc(db, p('sessions', 'imp-rest')), {
      date: '2026-11-14', sourceDate: '2026-11-14', type: 'rest', title: 'Golf', participants: ['kyle'], topicIds: [],
      status: 'planned', statusReason: '', userNotes: '', rescheduledFrom: null, imported: true,
    });
    await setDoc(doc(db, p('sessions', 'imp-exam')), {
      date: '2026-11-21', sourceDate: '2026-11-21', type: 'exam', title: 'Exam', participants: ['kyle', 'david'], topicIds: [],
      status: 'planned', statusReason: '', userNotes: '', rescheduledFrom: null, imported: true,
    });
    await setDoc(doc(db, p('discussions', 'schedule-question-1')), {
      title: 'Imported q', topicIds: ['ch05'], raisedBy: null, kind: 'question', status: 'open', priority: 'normal', notes: '',
      sessionId: null, imported: true, sourceRef: 'x',
    });
  });
});

const dbAs = (uid) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();

const progress = (uid, extra = {}) => ({
  profileId: 'kyle', topicId: 'ch01', status: 'in_progress', depth: 'none', notes: '', startedAt: serverTimestamp(), completedAt: null,
  updatedAt: serverTimestamp(), updatedByUid: uid, ...extra,
});

const userSession = (uid, extra = {}) => ({
  date: '2026-11-17', sourceDate: null, startTime: null, endTime: null, timeLabel: 'Evening', type: 'joint', title: 'Extra',
  participants: ['kyle', 'david'], topicIds: ['ch05'], optional: false, notes: '', status: 'planned', statusReason: '', userNotes: '',
  rescheduledFrom: null, imported: false, archived: false, createdBy: 'kyle', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  updatedByUid: uid, ...extra,
});

const discussion = (uid, extra = {}) => ({
  title: 'Why salt?', topicIds: ['ch03'], raisedBy: 'david', kind: 'discuss', status: 'open', priority: 'normal', notes: '',
  sessionId: null, imported: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedByUid: uid, ...extra,
});

// ------------------------------------------------------------------ F02: unapproved
test('F02 unauthenticated and unapproved users cannot read or write study data', async () => {
  for (const db of [anon(), dbAs(STRANGER)]) {
    await assertFails(getDoc(doc(db, 'workspaces', WS)));
    await assertFails(getDocs(collection(db, p('topics'))));
    await assertFails(getDocs(collection(db, p('sessions'))));
    await assertFails(getDocs(collection(db, p('progress'))));
    await assertFails(getDocs(collection(db, p('discussions'))));
    await assertFails(getDocs(collection(db, p('activity'))));
    await assertFails(setDoc(doc(db, p('progress', 'kyle__ch01')), progress(STRANGER)));
  }
});

test('Devices can read only their own approval record; nobody can list or write the allowlist', async () => {
  await assertSucceeds(getDoc(doc(dbAs(STRANGER), 'approvedDevices', STRANGER))); // reads "not approved"
  await assertSucceeds(getDoc(doc(dbAs(APPROVED), 'approvedDevices', APPROVED)));
  await assertFails(getDoc(doc(dbAs(STRANGER), 'approvedDevices', APPROVED)));
  await assertFails(getDocs(collection(dbAs(APPROVED), 'approvedDevices')));
  await assertFails(setDoc(doc(dbAs(STRANGER), 'approvedDevices', STRANGER), { label: 'me' }));
  await assertFails(setDoc(doc(dbAs(APPROVED), 'approvedDevices', STRANGER), { label: 'friend' }));
  await assertFails(deleteDoc(doc(dbAs(APPROVED), 'approvedDevices', APPROVED2)));
  await assertFails(getDoc(doc(anon(), 'approvedDevices', STRANGER)));
});

// ------------------------------------------------------------------ F03: approved
test('F03 approved devices can read everything in the workspace', async () => {
  const db = dbAs(APPROVED);
  await assertSucceeds(getDoc(doc(db, 'workspaces', WS)));
  for (const c of ['topics', 'sessions', 'progress', 'checks', 'discussions', 'activity']) {
    await assertSucceeds(getDocs(collection(db, p(c))));
  }
});

test('Other workspace IDs and unknown collections are denied', async () => {
  const db = dbAs(APPROVED);
  await assertFails(getDoc(doc(db, 'workspaces', 'other-ws')));
  await assertFails(getDocs(collection(db, 'workspaces/other-ws/progress')));
  await assertFails(setDoc(doc(db, p('secrets', 'x')), { a: 1 }));
  await assertFails(setDoc(doc(db, 'anything', 'x'), { a: 1 }));
});

test('Clients cannot change workspace metadata or topics', async () => {
  const db = dbAs(APPROVED);
  await assertFails(updateDoc(doc(db, 'workspaces', WS), { examDate: '2026-12-01' }));
  await assertFails(updateDoc(doc(db, 'workspaces', WS), { schemaVersion: 2 }));
  await assertFails(updateDoc(doc(db, p('topics', 'ch01')), { title: 'Hacked' }));
  await assertFails(deleteDoc(doc(db, p('topics', 'ch01'))));
  await assertFails(setDoc(doc(db, p('topics', 'ch99')), { title: 'New' }));
});

// ------------------------------------------------------------------ progress
test('F06/F07 valid progress create and update for either profile', async () => {
  const db = dbAs(APPROVED);
  await assertSucceeds(setDoc(doc(db, p('progress', 'kyle__ch01')), progress(APPROVED)));
  await assertSucceeds(updateDoc(doc(db, p('progress', 'kyle__ch01')), {
    status: 'completed', completedAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedByUid: APPROVED,
  }));
  await assertSucceeds(setDoc(doc(db, p('progress', 'david__ch01')), progress(APPROVED, { profileId: 'david' })));
  await assertSucceeds(updateDoc(doc(dbAs(APPROVED2), p('progress', 'kyle__ch01')), {
    notes: 'from the other device', updatedAt: serverTimestamp(), updatedByUid: APPROVED2,
  }));
});

test('Malformed progress is rejected', async () => {
  const db = dbAs(APPROVED);
  const ref = (id) => doc(db, p('progress', id));
  await assertFails(setDoc(ref('mallory__ch01'), progress(APPROVED, { profileId: 'mallory' })));
  await assertFails(setDoc(ref('kyle__ch12'), progress(APPROVED, { topicId: 'ch12' })));
  await assertFails(setDoc(ref('kyle__ch02'), progress(APPROVED))); // id/topic mismatch
  await assertFails(setDoc(ref('kyle__ch01'), progress(APPROVED, { status: 'done' })));
  await assertFails(setDoc(ref('kyle__ch01'), progress(APPROVED, { depth: 'deep' })));
  await assertFails(setDoc(ref('kyle__ch01'), progress(APPROVED, { notes: 'x'.repeat(2001) })));
  await assertFails(setDoc(ref('kyle__ch01'), progress(APPROVED, { extra: true })));
  await assertFails(setDoc(ref('kyle__ch01'), progress(APPROVED, { updatedByUid: 'someone-else' })));
  await assertFails(setDoc(ref('kyle__ch01'), progress(APPROVED, { updatedAt: Timestamp.fromMillis(0) })));
  await assertFails(setDoc(ref('kyle__ch01'), progress(APPROVED, { completedAt: Timestamp.fromMillis(0) })));
  const { notes, ...missingNotes } = progress(APPROVED);
  await assertFails(setDoc(ref('kyle__ch01'), missingNotes));
});

test('Progress cannot be re-assigned to another profile/topic or deleted', async () => {
  const db = dbAs(APPROVED);
  await assertSucceeds(setDoc(doc(db, p('progress', 'kyle__ch01')), progress(APPROVED)));
  await assertFails(updateDoc(doc(db, p('progress', 'kyle__ch01')), { profileId: 'david', updatedAt: serverTimestamp(), updatedByUid: APPROVED }));
  await assertFails(deleteDoc(doc(db, p('progress', 'kyle__ch01'))));
});

// ------------------------------------------------------------------ checks
test('Checklist ticks: valid ones succeed, malformed ones fail', async () => {
  const db = dbAs(APPROVED);
  const base = { profileId: 'kyle', itemId: '2026-11-13-kyle-study--must-1', done: true, updatedAt: serverTimestamp(), updatedByUid: APPROVED };
  await assertSucceeds(setDoc(doc(db, p('checks', 'kyle__2026-11-13-kyle-study--must-1')), base));
  await assertSucceeds(setDoc(doc(db, p('checks', 'kyle__2026-11-13-kyle-study--must-1')), { ...base, done: false }));
  await assertFails(setDoc(doc(db, p('checks', 'kyle__other')), base)); // id mismatch
  await assertFails(setDoc(doc(db, p('checks', 'kyle__Bad Id')), { ...base, itemId: 'Bad Id' }));
  await assertFails(setDoc(doc(db, p('checks', 'kyle__2026-11-13-kyle-study--must-1')), { ...base, done: 'yes' }));
  await assertFails(deleteDoc(doc(db, p('checks', 'kyle__2026-11-13-kyle-study--must-1'))));
});

// ------------------------------------------------------------------ sessions
test('F10/F11 imported sessions: reschedule, mark missed, notes allowed; content immutable', async () => {
  const db = dbAs(APPROVED);
  const ref = doc(db, p('sessions', 'imp-1'));
  const stamp = { updatedAt: serverTimestamp(), updatedByUid: APPROVED };
  await assertSucceeds(updateDoc(ref, { status: 'missed', statusReason: 'tired', ...stamp }));
  await assertSucceeds(updateDoc(ref, { date: '2026-11-19', rescheduledFrom: '2026-11-16', status: 'planned', ...stamp }));
  await assertSucceeds(updateDoc(ref, { userNotes: 'bring Fig 5.6', ...stamp }));
  await assertFails(updateDoc(ref, { title: 'Renamed', ...stamp }));
  await assertFails(updateDoc(ref, { topicIds: [], ...stamp }));
  await assertFails(updateDoc(ref, { imported: false, ...stamp }));
  await assertFails(updateDoc(ref, { date: '2026-02-30', ...stamp })); // not a real date
  await assertFails(updateDoc(ref, { date: '2026-13-01', ...stamp }));
  await assertFails(updateDoc(ref, { status: 'done', ...stamp }));
  await assertFails(updateDoc(ref, { statusReason: 'x'.repeat(301), ...stamp }));
  await assertFails(deleteDoc(ref));
});

test('Rest and exam entries cannot be marked completed; exam date cannot move', async () => {
  const db = dbAs(APPROVED);
  const stamp = { updatedAt: serverTimestamp(), updatedByUid: APPROVED };
  await assertFails(updateDoc(doc(db, p('sessions', 'imp-rest')), { status: 'completed', ...stamp }));
  await assertSucceeds(updateDoc(doc(db, p('sessions', 'imp-rest')), { date: '2026-11-15', rescheduledFrom: '2026-11-14', ...stamp })); // weather swap
  await assertFails(updateDoc(doc(db, p('sessions', 'imp-exam')), { date: '2026-11-22', ...stamp }));
  await assertFails(updateDoc(doc(db, p('sessions', 'imp-exam')), { status: 'missed', ...stamp }));
});

test('User sessions: create/edit/delete with validation', async () => {
  const db = dbAs(APPROVED);
  const ref = doc(db, p('sessions', 'user-1'));
  await assertSucceeds(setDoc(ref, userSession(APPROVED)));
  await assertSucceeds(updateDoc(ref, { title: 'Renamed', startTime: '18:00', endTime: '19:00', updatedAt: serverTimestamp(), updatedByUid: APPROVED }));
  await assertFails(updateDoc(ref, { endTime: '17:00', updatedAt: serverTimestamp(), updatedByUid: APPROVED })); // end < start
  await assertFails(updateDoc(ref, { createdBy: 'david', updatedAt: serverTimestamp(), updatedByUid: APPROVED }));
  await assertSucceeds(deleteDoc(ref));
  const bad = [
    { imported: true }, { type: 'exam' }, { participants: [] }, { participants: ['kyle', 'eve'] }, { type: 'joint', participants: ['kyle'] },
    { title: '' }, { title: 'x'.repeat(161) }, { date: '2026-11-31' }, { startTime: '25:00' }, { topicIds: ['ch12'] },
    { status: 'completed' }, { createdBy: 'mallory' }, { surprise: 1 },
  ];
  for (const extra of bad) await assertFails(setDoc(doc(db, p('sessions', 'user-bad')), userSession(APPROVED, extra)));
});

// ------------------------------------------------------------------ discussions
test('F12 discussions: create, resolve, edit notes; raisedBy and createdAt immutable', async () => {
  const db = dbAs(APPROVED2);
  const ref = doc(db, p('discussions', 'd1'));
  await assertSucceeds(setDoc(ref, discussion(APPROVED2)));
  await assertSucceeds(updateDoc(ref, { status: 'discussed', notes: 'Salt defeats rainbow tables', updatedAt: serverTimestamp(), updatedByUid: APPROVED2 }));
  await assertFails(updateDoc(ref, { raisedBy: 'kyle', updatedAt: serverTimestamp(), updatedByUid: APPROVED2 }));
  await assertFails(updateDoc(ref, { createdAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedByUid: APPROVED2 }));
  await assertFails(updateDoc(ref, { status: 'closed', updatedAt: serverTimestamp(), updatedByUid: APPROVED2 }));
  await assertFails(deleteDoc(ref));
  // imported schedule question can be resolved
  await assertSucceeds(updateDoc(doc(db, p('discussions', 'schedule-question-1')), { status: 'discussed', updatedAt: serverTimestamp(), updatedByUid: APPROVED2 }));
  for (const extra of [{ raisedBy: null }, { raisedBy: 'eve' }, { status: 'discussed' }, { kind: 'rant' }, { imported: true }, { priority: 'urgent' }, { title: 'x'.repeat(161) }]) {
    await assertFails(setDoc(doc(db, p('discussions', 'bad')), discussion(APPROVED2, extra)));
  }
});

// ------------------------------------------------------------------ activity
test('Activity log is append-only and validated', async () => {
  const db = dbAs(APPROVED);
  const entry = { type: 'progress', profileId: 'kyle', text: 'Kyle started Ch 1', createdAt: serverTimestamp(), byUid: APPROVED };
  await assertSucceeds(setDoc(doc(db, p('activity', 'a1')), entry));
  await assertFails(updateDoc(doc(db, p('activity', 'a1')), { text: 'edited' }));
  await assertFails(deleteDoc(doc(db, p('activity', 'a1'))));
  await assertFails(setDoc(doc(db, p('activity', 'a2')), { ...entry, byUid: 'other' }));
  await assertFails(setDoc(doc(db, p('activity', 'a3')), { ...entry, text: 'x'.repeat(201) }));
});

test('Atomic batch: progress + activity succeeds together; one bad doc fails the whole batch', async () => {
  const db = dbAs(APPROVED);
  const good = writeBatch(db);
  good.set(doc(db, p('progress', 'kyle__ch01')), progress(APPROVED));
  good.set(doc(db, p('activity', 'b1')), { type: 'progress', profileId: 'kyle', text: 'ok', createdAt: serverTimestamp(), byUid: APPROVED });
  await assertSucceeds(good.commit());
  const bad = writeBatch(db);
  bad.set(doc(db, p('progress', 'david__ch01')), progress(APPROVED, { profileId: 'david' }));
  bad.set(doc(db, p('activity', 'b2')), { type: 'hack', profileId: 'kyle', text: 'x', createdAt: serverTimestamp(), byUid: APPROVED });
  await assertFails(bad.commit());
  await env.withSecurityRulesDisabled(async (ctx) => {
    assert.equal((await getDoc(doc(ctx.firestore(), p('progress', 'david__ch01')))).exists(), false);
  });
  const fixed = writeBatch(db);
  fixed.set(doc(db, p('progress', 'david__ch01')), progress(APPROVED, { profileId: 'david' }));
  fixed.set(doc(db, p('activity', 'b3')), { type: 'progress', profileId: 'david', text: 'ok', createdAt: serverTimestamp(), byUid: APPROVED });
  await assertSucceeds(fixed.commit());
  // update of existing doc inside a batch (the app's normal path)
  const upd = writeBatch(db);
  upd.update(doc(db, p('progress', 'david__ch01')), { status: 'completed', completedAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedByUid: APPROVED });
  upd.set(doc(db, p('activity', 'b4')), { type: 'progress', profileId: 'david', text: 'done', createdAt: serverTimestamp(), byUid: APPROVED });
  await assertSucceeds(upd.commit());
});

// ------------------------------------------------------------------ rules ↔ seed consistency
test('Rules topic allowlist matches the seed topics', () => {
  const rules = readFileSync(resolve(root, 'firestore.rules'), 'utf8');
  const seed = JSON.parse(readFileSync(resolve(root, 'data/seed-schedule.json'), 'utf8'));
  const list = /function topicIdList\(\) \{\s*return \[([^\]]+)\]/.exec(rules)[1].match(/'([^']+)'/g).map((s) => s.slice(1, -1));
  assert.deepEqual(list, seed.topics.map((t) => t.id));
});
