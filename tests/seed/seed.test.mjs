// F20: seeding against the Firestore emulator is idempotent and never
// overwrites user progress or user-edited session fields.
//   npm run test:seed
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { runSeed } from '../../scripts/lib/seed-run.mjs';

const seed = JSON.parse(readFileSync(new URL('../../data/seed-schedule.json', import.meta.url), 'utf8'));
let app; let db;
const quiet = () => {};

before(async () => {
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'run via firebase emulators:exec');
  app = initializeApp({ projectId: 'demo-study-tracker' }, 'seed-test');
  db = getFirestore(app);
  const ws = db.collection('workspaces').doc(seed.workspaceId);
  for (const c of ['topics', 'sessions', 'discussions', 'progress']) {
    const snap = await ws.collection(c).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
  await ws.delete();
});
after(async () => { await deleteApp(app); });

test('dry run writes nothing', async () => {
  const { written } = await runSeed({ db, seed, apply: false, log: quiet });
  assert.equal(written, 0);
  assert.equal((await db.collection('workspaces').doc(seed.workspaceId).get()).exists, false);
});

test('apply, then re-apply: no duplicates, user data preserved', async () => {
  const ws = db.collection('workspaces').doc(seed.workspaceId);
  const r1 = await runSeed({ db, seed, apply: true, log: quiet });
  assert.equal(r1.written, 1 + seed.topics.length + seed.sessions.length + seed.discussions.length);
  assert.equal((await ws.collection('sessions').get()).size, seed.sessions.length);

  // users work
  await ws.collection('progress').doc('kyle__ch01').set({ profileId: 'kyle', topicId: 'ch01', status: 'completed' });
  await ws.collection('sessions').doc('2026-11-16-kyle-study').update({ date: '2026-11-19', rescheduledFrom: '2026-11-16', status: 'planned', userNotes: 'moved' });
  await ws.collection('discussions').doc('schedule-question-1').update({ status: 'discussed', notes: 'resolved' });

  const r2 = await runSeed({ db, seed, apply: true, updateChanged: true, log: quiet });
  assert.equal(r2.written, 0, 'second import must not write anything');
  assert.equal((await ws.collection('sessions').get()).size, seed.sessions.length);
  assert.equal((await ws.collection('topics').get()).size, seed.topics.length);
  assert.equal((await ws.collection('discussions').get()).size, seed.discussions.length);
  assert.equal((await ws.collection('progress').doc('kyle__ch01').get()).data().status, 'completed');
  const s = (await ws.collection('sessions').doc('2026-11-16-kyle-study').get()).data();
  assert.equal(s.date, '2026-11-19');
  assert.equal(s.userNotes, 'moved');
  assert.equal((await ws.collection('discussions').doc('schedule-question-1').get()).data().status, 'discussed');
});

test('changed source requires --update-changed and keeps user fields', async () => {
  const ws = db.collection('workspaces').doc(seed.workspaceId);
  const changed = JSON.parse(JSON.stringify(seed));
  changed.sessions.find((x) => x.id === '2026-11-16-kyle-study').title = 'Revised title';
  const r = await runSeed({ db, seed: changed, apply: true, log: quiet });
  assert.equal(r.written, 0);
  assert.equal((await ws.collection('sessions').doc('2026-11-16-kyle-study').get()).data().title, seed.sessions.find((x) => x.id === '2026-11-16-kyle-study').title);
  await runSeed({ db, seed: changed, apply: true, updateChanged: true, log: quiet });
  const s = (await ws.collection('sessions').doc('2026-11-16-kyle-study').get()).data();
  assert.equal(s.title, 'Revised title');
  assert.equal(s.date, '2026-11-19');
  assert.equal(s.userNotes, 'moved');
});
