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
let env;

// Identities
const ACCOUNTS = {
  kyle: { uid: 'uid-kyle', email: 'Kyle.Test@Example.com' }, // mixed case on purpose
  david: { uid: 'uid-david', email: 'david@example.com' },
};
const p = (...s) => ['workspaces', WS, ...s].join('/');
const google = (uid, email, verified = true) => env.authenticatedContext(uid, {
  email, email_verified: verified, firebase: { sign_in_provider: 'google.com' },
}).firestore();
const as = (who) => google(ACCOUNTS[who].uid, ACCOUNTS[who].email);
const uidOf = (who) => ACCOUNTS[who].uid;
const stranger = () => google('uid-stranger', 'stranger@example.com');
const anonymous = () => env.authenticatedContext('uid-anon', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
const unverified = () => google('uid-unverified', ACCOUNTS.kyle.email, false);
const signedOut = () => env.unauthenticatedContext().firestore();

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
    await setDoc(doc(db, 'allowedUsers', ACCOUNTS.kyle.email.toLowerCase()), { profile: 'kyle' });
    await setDoc(doc(db, 'allowedUsers', ACCOUNTS.david.email), { profile: 'david' });
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

const progress = (who, extra = {}) => ({
  profileId: who, topicId: 'ch01', status: 'in_progress', depth: 'none', notes: '', startedAt: serverTimestamp(), completedAt: null,
  updatedAt: serverTimestamp(), updatedByUid: uidOf(who), ...extra,
});

const userSession = (who, extra = {}) => ({
  date: '2026-11-17', sourceDate: null, startTime: null, endTime: null, timeLabel: 'Evening', type: 'joint', title: 'Extra',
  participants: ['kyle', 'david'], topicIds: ['ch05'], optional: false, notes: '', status: 'planned', statusReason: '', userNotes: '',
  rescheduledFrom: null, imported: false, archived: false, createdBy: who, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  updatedByUid: uidOf(who), ...extra,
});

const discussion = (who, extra = {}) => ({
  title: 'Why salt?', topicIds: ['ch03'], raisedBy: who, kind: 'discuss', status: 'open', priority: 'normal', notes: '',
  sessionId: null, imported: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedByUid: uidOf(who), ...extra,
});

const stamp = (who) => ({ updatedAt: serverTimestamp(), updatedByUid: uidOf(who) });

// ------------------------------------------------------------------ F02: who is refused
test('F02 signed-out, anonymous, unlisted and unverified accounts cannot read or write', async () => {
  for (const db of [signedOut(), anonymous(), stranger(), unverified()]) {
    await assertFails(getDoc(doc(db, 'workspaces', WS)));
    await assertFails(getDocs(collection(db, p('topics'))));
    await assertFails(getDocs(collection(db, p('sessions'))));
    await assertFails(getDocs(collection(db, p('progress'))));
    await assertFails(getDocs(collection(db, p('discussions'))));
    await assertFails(getDocs(collection(db, p('activity'))));
    await assertFails(setDoc(doc(db, p('progress', 'kyle__ch01')), progress('kyle')));
  }
});

test('Accounts can read only their own allowlist entry; nobody can list or write it', async () => {
  await assertSucceeds(getDoc(doc(as('kyle'), 'allowedUsers', ACCOUNTS.kyle.email.toLowerCase())));
  await assertSucceeds(getDoc(doc(stranger(), 'allowedUsers', 'stranger@example.com'))); // learns "not allowed"
  await assertFails(getDoc(doc(as('kyle'), 'allowedUsers', ACCOUNTS.david.email)));
  await assertFails(getDocs(collection(as('kyle'), 'allowedUsers')));
  await assertFails(setDoc(doc(stranger(), 'allowedUsers', 'stranger@example.com'), { profile: 'kyle' }));
  await assertFails(updateDoc(doc(as('kyle'), 'allowedUsers', ACCOUNTS.kyle.email.toLowerCase()), { profile: 'david' }));
  await assertFails(deleteDoc(doc(as('kyle'), 'allowedUsers', ACCOUNTS.david.email)));
  await assertFails(getDoc(doc(signedOut(), 'allowedUsers', 'x@example.com')));
});

// ------------------------------------------------------------------ F03: allowed
test('F03 both allowed accounts can read everything in the workspace (email case-insensitive)', async () => {
  for (const who of ['kyle', 'david']) {
    const db = as(who);
    await assertSucceeds(getDoc(doc(db, 'workspaces', WS)));
    for (const c of ['topics', 'sessions', 'progress', 'checks', 'discussions', 'activity']) {
      await assertSucceeds(getDocs(collection(db, p(c))));
    }
  }
});

test('Other workspace IDs and unknown collections are denied', async () => {
  const db = as('kyle');
  await assertFails(getDoc(doc(db, 'workspaces', 'other-ws')));
  await assertFails(getDocs(collection(db, 'workspaces/other-ws/progress')));
  await assertFails(setDoc(doc(db, p('secrets', 'x')), { a: 1 }));
  await assertFails(setDoc(doc(db, 'anything', 'x'), { a: 1 }));
});

test('Clients cannot change workspace metadata or topics', async () => {
  const db = as('kyle');
  await assertFails(updateDoc(doc(db, 'workspaces', WS), { examDate: '2026-12-01' }));
  await assertFails(updateDoc(doc(db, 'workspaces', WS), { schemaVersion: 2 }));
  await assertFails(updateDoc(doc(db, p('topics', 'ch01')), { title: 'Hacked' }));
  await assertFails(deleteDoc(doc(db, p('topics', 'ch01'))));
  await assertFails(setDoc(doc(db, p('topics', 'ch99')), { title: 'New' }));
});

// ------------------------------------------------------------------ progress
test('F06/F07 each person creates and updates their own progress', async () => {
  await assertSucceeds(setDoc(doc(as('kyle'), p('progress', 'kyle__ch01')), progress('kyle')));
  await assertSucceeds(updateDoc(doc(as('kyle'), p('progress', 'kyle__ch01')), {
    status: 'completed', completedAt: serverTimestamp(), ...stamp('kyle'),
  }));
  await assertSucceeds(setDoc(doc(as('david'), p('progress', 'david__ch01')), progress('david')));
});

test('Nobody can write the other person\'s progress or ticks', async () => {
  await assertFails(setDoc(doc(as('kyle'), p('progress', 'david__ch01')), progress('david', { updatedByUid: uidOf('kyle') })));
  await assertSucceeds(setDoc(doc(as('kyle'), p('progress', 'kyle__ch01')), progress('kyle')));
  await assertFails(updateDoc(doc(as('david'), p('progress', 'kyle__ch01')), { notes: 'hi', ...stamp('david') }));
  const tick = { profileId: 'kyle', itemId: 'q01', done: true, ...stamp('david') };
  await assertFails(setDoc(doc(as('david'), p('checks', 'kyle__q01')), tick));
});

test('Malformed progress is rejected', async () => {
  const db = as('kyle');
  const ref = (id) => doc(db, p('progress', id));
  await assertFails(setDoc(ref('mallory__ch01'), progress('kyle', { profileId: 'mallory' })));
  await assertFails(setDoc(ref('kyle__ch12'), progress('kyle', { topicId: 'ch12' })));
  await assertFails(setDoc(ref('kyle__ch02'), progress('kyle'))); // id/topic mismatch
  await assertFails(setDoc(ref('kyle__ch01'), progress('kyle', { status: 'done' })));
  await assertFails(setDoc(ref('kyle__ch01'), progress('kyle', { depth: 'deep' })));
  await assertFails(setDoc(ref('kyle__ch01'), progress('kyle', { notes: 'x'.repeat(2001) })));
  await assertFails(setDoc(ref('kyle__ch01'), progress('kyle', { extra: true })));
  await assertFails(setDoc(ref('kyle__ch01'), progress('kyle', { updatedByUid: 'someone-else' })));
  await assertFails(setDoc(ref('kyle__ch01'), progress('kyle', { updatedAt: Timestamp.fromMillis(0) })));
  await assertFails(setDoc(ref('kyle__ch01'), progress('kyle', { completedAt: Timestamp.fromMillis(0) })));
  const { notes, ...missingNotes } = progress('kyle');
  await assertFails(setDoc(ref('kyle__ch01'), missingNotes));
});

test('Progress cannot be re-assigned to another profile or deleted', async () => {
  const db = as('kyle');
  await assertSucceeds(setDoc(doc(db, p('progress', 'kyle__ch01')), progress('kyle')));
  await assertFails(updateDoc(doc(db, p('progress', 'kyle__ch01')), { profileId: 'david', ...stamp('kyle') }));
  await assertFails(deleteDoc(doc(db, p('progress', 'kyle__ch01'))));
});

// ------------------------------------------------------------------ checks
test('Checklist ticks: valid ones succeed, malformed ones fail', async () => {
  const db = as('kyle');
  const base = { profileId: 'kyle', itemId: '2026-11-13-kyle-study--must-1', done: true, ...stamp('kyle') };
  await assertSucceeds(setDoc(doc(db, p('checks', 'kyle__2026-11-13-kyle-study--must-1')), base));
  await assertSucceeds(setDoc(doc(db, p('checks', 'kyle__2026-11-13-kyle-study--must-1')), { ...base, done: false }));
  await assertFails(setDoc(doc(db, p('checks', 'kyle__other')), base)); // id mismatch
  await assertFails(setDoc(doc(db, p('checks', 'kyle__Bad Id')), { ...base, itemId: 'Bad Id' }));
  await assertFails(setDoc(doc(db, p('checks', 'kyle__2026-11-13-kyle-study--must-1')), { ...base, done: 'yes' }));
  await assertFails(deleteDoc(doc(db, p('checks', 'kyle__2026-11-13-kyle-study--must-1'))));
});

// ------------------------------------------------------------------ sessions (shared)
test('F10/F11 imported sessions: either person can reschedule/mark; content immutable', async () => {
  const ref = (who) => doc(as(who), p('sessions', 'imp-1'));
  await assertSucceeds(updateDoc(ref('kyle'), { status: 'missed', statusReason: 'tired', ...stamp('kyle') }));
  await assertSucceeds(updateDoc(ref('david'), { date: '2026-11-19', rescheduledFrom: '2026-11-16', status: 'planned', ...stamp('david') }));
  await assertSucceeds(updateDoc(ref('kyle'), { userNotes: 'bring Fig 5.6', ...stamp('kyle') }));
  await assertFails(updateDoc(ref('kyle'), { title: 'Renamed', ...stamp('kyle') }));
  await assertFails(updateDoc(ref('kyle'), { topicIds: [], ...stamp('kyle') }));
  await assertFails(updateDoc(ref('kyle'), { imported: false, ...stamp('kyle') }));
  await assertFails(updateDoc(ref('kyle'), { date: '2026-02-30', ...stamp('kyle') })); // not a real date
  await assertFails(updateDoc(ref('kyle'), { date: '2026-13-01', ...stamp('kyle') }));
  await assertFails(updateDoc(ref('kyle'), { status: 'done', ...stamp('kyle') }));
  await assertFails(updateDoc(ref('kyle'), { statusReason: 'x'.repeat(301), ...stamp('kyle') }));
  await assertFails(deleteDoc(ref('kyle')));
});

test('Rest and exam entries cannot be marked completed; exam date cannot move', async () => {
  const db = as('kyle');
  await assertFails(updateDoc(doc(db, p('sessions', 'imp-rest')), { status: 'completed', ...stamp('kyle') }));
  await assertSucceeds(updateDoc(doc(db, p('sessions', 'imp-rest')), { date: '2026-11-15', rescheduledFrom: '2026-11-14', ...stamp('kyle') }));
  await assertFails(updateDoc(doc(db, p('sessions', 'imp-exam')), { date: '2026-11-22', ...stamp('kyle') }));
  await assertFails(updateDoc(doc(db, p('sessions', 'imp-exam')), { status: 'missed', ...stamp('kyle') }));
});

test('User sessions: created as yourself, editable by both, validated', async () => {
  const ref = (who) => doc(as(who), p('sessions', 'user-1'));
  await assertFails(setDoc(ref('kyle'), userSession('kyle', { createdBy: 'david' }))); // can't create as David
  await assertSucceeds(setDoc(ref('kyle'), userSession('kyle')));
  await assertSucceeds(updateDoc(ref('david'), { title: 'Renamed', startTime: '18:00', endTime: '19:00', ...stamp('david') }));
  await assertFails(updateDoc(ref('kyle'), { endTime: '17:00', ...stamp('kyle') })); // end < start
  await assertFails(updateDoc(ref('kyle'), { createdBy: 'david', ...stamp('kyle') }));
  await assertSucceeds(deleteDoc(ref('david')));
  const bad = [
    { imported: true }, { type: 'exam' }, { participants: [] }, { participants: ['kyle', 'eve'] }, { type: 'joint', participants: ['kyle'] },
    { title: '' }, { title: 'x'.repeat(161) }, { date: '2026-11-31' }, { startTime: '25:00' }, { topicIds: ['ch12'] },
    { status: 'completed' }, { surprise: 1 },
  ];
  for (const extra of bad) await assertFails(setDoc(doc(as('kyle'), p('sessions', 'user-bad')), userSession('kyle', extra)));
});

// ------------------------------------------------------------------ discussions
test('F12 discussions: raised as yourself, resolvable by both; raisedBy/createdAt immutable', async () => {
  await assertFails(setDoc(doc(as('kyle'), p('discussions', 'd0')), discussion('david', { updatedByUid: uidOf('kyle') })));
  await assertSucceeds(setDoc(doc(as('david'), p('discussions', 'd1')), discussion('david')));
  const ref = doc(as('kyle'), p('discussions', 'd1'));
  await assertSucceeds(updateDoc(ref, { status: 'discussed', notes: 'Salt defeats rainbow tables', ...stamp('kyle') }));
  await assertFails(updateDoc(ref, { raisedBy: 'kyle', ...stamp('kyle') }));
  await assertFails(updateDoc(ref, { createdAt: serverTimestamp(), ...stamp('kyle') }));
  await assertFails(updateDoc(ref, { status: 'closed', ...stamp('kyle') }));
  await assertFails(deleteDoc(ref));
  await assertSucceeds(updateDoc(doc(as('david'), p('discussions', 'schedule-question-1')), { status: 'discussed', ...stamp('david') }));
  for (const extra of [{ raisedBy: null }, { raisedBy: 'eve' }, { status: 'discussed' }, { kind: 'rant' }, { imported: true }, { priority: 'urgent' }, { title: 'x'.repeat(161) }]) {
    await assertFails(setDoc(doc(as('david'), p('discussions', 'bad')), discussion('david', extra)));
  }
});

// ------------------------------------------------------------------ activity
test('Activity log is append-only, validated, and written as yourself', async () => {
  const db = as('kyle');
  const entry = { type: 'progress', profileId: 'kyle', text: 'Kyle started Ch 1', createdAt: serverTimestamp(), byUid: uidOf('kyle') };
  await assertSucceeds(setDoc(doc(db, p('activity', 'a1')), entry));
  await assertFails(updateDoc(doc(db, p('activity', 'a1')), { text: 'edited' }));
  await assertFails(deleteDoc(doc(db, p('activity', 'a1'))));
  await assertFails(setDoc(doc(db, p('activity', 'a2')), { ...entry, byUid: 'other' }));
  await assertFails(setDoc(doc(db, p('activity', 'a3')), { ...entry, text: 'x'.repeat(201) }));
  await assertFails(setDoc(doc(db, p('activity', 'a4')), { ...entry, profileId: 'david' }));
});

test('Atomic batch: progress + activity succeed together; one bad doc fails the whole batch', async () => {
  const db = as('david');
  const bad = writeBatch(db);
  bad.set(doc(db, p('progress', 'david__ch01')), progress('david'));
  bad.set(doc(db, p('activity', 'b2')), { type: 'hack', profileId: 'david', text: 'x', createdAt: serverTimestamp(), byUid: uidOf('david') });
  await assertFails(bad.commit());
  await env.withSecurityRulesDisabled(async (ctx) => {
    assert.equal((await getDoc(doc(ctx.firestore(), p('progress', 'david__ch01')))).exists(), false);
  });
  const good = writeBatch(db);
  good.set(doc(db, p('progress', 'david__ch01')), progress('david'));
  good.set(doc(db, p('activity', 'b3')), { type: 'progress', profileId: 'david', text: 'ok', createdAt: serverTimestamp(), byUid: uidOf('david') });
  await assertSucceeds(good.commit());
  const upd = writeBatch(db);
  upd.update(doc(db, p('progress', 'david__ch01')), { status: 'completed', completedAt: serverTimestamp(), ...stamp('david') });
  upd.set(doc(db, p('activity', 'b4')), { type: 'progress', profileId: 'david', text: 'done', createdAt: serverTimestamp(), byUid: uidOf('david') });
  await assertSucceeds(upd.commit());
});

test('Removing an account from the allowlist revokes access immediately', async () => {
  await assertSucceeds(getDocs(collection(as('david'), p('sessions'))));
  await env.withSecurityRulesDisabled(async (ctx) => { await deleteDoc(doc(ctx.firestore(), 'allowedUsers', ACCOUNTS.david.email)); });
  await assertFails(getDocs(collection(as('david'), p('sessions'))));
});

// ------------------------------------------------------------------ rules ↔ seed consistency
test('Rules topic allowlist matches the seed topics', () => {
  const rules = readFileSync(resolve(root, 'firestore.rules'), 'utf8');
  const seed = JSON.parse(readFileSync(resolve(root, 'data/seed-schedule.json'), 'utf8'));
  const list = /function topicIdList\(\) \{\s*return \[([^\]]+)\]/.exec(rules)[1].match(/'([^']+)'/g).map((s) => s.slice(1, -1));
  assert.deepEqual(list, seed.topics.map((t) => t.id));
  assert.ok(!/approvedDevices/.test(rules), 'old device allowlist must be gone');
});
