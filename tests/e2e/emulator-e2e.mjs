#!/usr/bin/env node
// End-to-end test with the REAL Firebase Web SDK against the Auth + Firestore
// emulators (with the real firestore.rules). Covers F01, F02, F03, F08, F12, F15.
//   npm run test:e2e
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { runSeed } from '../../scripts/lib/seed-run.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'run via: firebase emulators:exec --only firestore,auth');
const PORT = 8138;
const URL_ = `http://localhost:${PORT}/website/?emulator`;

const seed = JSON.parse(readFileSync(resolve(root, 'data/seed-schedule.json'), 'utf8'));
const admin = getFirestore(initializeApp({ projectId: 'demo-study-tracker' }));
await runSeed({ db: admin, seed, apply: true, log: () => {} });

const server = spawn(process.execPath, [resolve(root, 'scripts/serve.mjs')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'pipe' });
await new Promise((r) => server.stdout.once('data', r));
const browser = await chromium.launch({ channel: process.env.SMOKE_BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : 'chrome'), headless: true });
const results = [];
let failed = 0;
const step = async (name, fn) => {
  try { await fn(); results.push(`✔ ${name}`); } catch (e) { failed++; results.push(`✖ ${name}\n    ${e.message.split('\n')[0]}`); }
};

async function device() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Africa/Johannesburg' });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.goto(URL_);
  return { ctx, page };
}

const A = await device();
const B = await device();
const C = await device(); // never approved
let uidA; let uidB; let uidC;

await step('F01 first visit signs in silently and shows the approval gate (no study content)', async () => {
  for (const d of [A, B, C]) await d.page.getByRole('heading', { name: 'Device approval required' }).waitFor({ timeout: 20000 });
  [uidA, uidB, uidC] = await Promise.all([A, B, C].map((d) => d.page.locator('.uid-big').textContent()));
  assert.ok(uidA && uidB && uidA !== uidB);
  assert.equal(await A.page.locator('.session').count(), 0);
});

await step('F03 approving a device unlocks it live (no refresh) and shows the profile chooser', async () => {
  await admin.collection('approvedDevices').doc(uidA).set({ label: 'A', approvedAt: FieldValue.serverTimestamp() });
  await admin.collection('approvedDevices').doc(uidB).set({ label: 'B', approvedAt: FieldValue.serverTimestamp() });
  await A.page.getByRole('heading', { name: "Who's studying?" }).waitFor({ timeout: 15000 });
  await B.page.getByRole('heading', { name: "Who's studying?" }).waitFor({ timeout: 15000 });
  await A.page.getByRole('button', { name: 'Kyle' }).click();
  await B.page.getByRole('button', { name: 'David' }).click();
  await A.page.locator('.appbar .avatar-kyle').waitFor();
  await B.page.locator('.appbar .avatar-david').waitFor();
});

await step('F02 unapproved device stays gated; direct reads are refused by the rules', async () => {
  await C.page.waitForTimeout(500);
  assert.equal(await C.page.getByRole('heading', { name: 'Device approval required' }).count(), 1);
  const denied = await C.page.evaluate(async () => {
    const { getFirestore, collection, getDocs } = await import('https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js');
    try { await getDocs(collection(getFirestore(), 'workspaces/cos330-2026/progress')); return 'READ OK'; } catch (e) { return e.code; }
  });
  assert.equal(denied, 'permission-denied');
});

await step('F08 Kyle\'s change appears on David\'s device without refresh', async () => {
  await A.page.goto(`${URL_}#topics/ch03`);
  await B.page.goto(`${URL_}#topics/ch03`);
  await A.page.getByRole('radio', { name: 'First pass completed' }).click();
  await A.page.locator('.sync-synced').waitFor({ timeout: 10000 });
  await B.page.locator('#topic-ch03 .who-kyle .status', { hasText: 'First pass completed' }).waitFor({ timeout: 10000 }); // live, sheet still open
  assert.equal(await B.page.locator('#topic-ch03 .who-david .status').textContent(), 'Not started');
});

await step('F08 David\'s change appears on Kyle\'s device; activity feed updates live', async () => {
  await B.page.getByRole('radio', { name: 'In progress' }).click();
  await A.page.locator('#topic-ch03 .who-david .status', { hasText: 'In progress' }).waitFor({ timeout: 10000 });
  await A.page.goto(`${URL_}#today`);
  await A.page.locator('.activity li', { hasText: 'David started Ch 3' }).waitFor({ timeout: 10000 });
});

await step('F12 discussion added on one device appears on the other', async () => {
  await B.page.goto(`${URL_}#discuss`);
  await B.page.getByRole('button', { name: 'New', exact: true }).click();
  await B.page.getByRole('dialog').locator('#nd-title').fill('Explain salting with an example');
  await B.page.getByRole('dialog').getByRole('button', { name: 'Add' }).click();
  await A.page.goto(`${URL_}#discuss`);
  await A.page.locator('.disc', { hasText: 'Explain salting with an example' }).waitFor({ timeout: 10000 });
});

await step('F15 reload keeps saved changes (persisted in Firestore)', async () => {
  await A.page.reload();
  await A.page.goto(`${URL_}#topics/ch03`);
  await A.page.locator('#topic-ch03 .who-kyle .status', { hasText: 'First pass completed' }).waitFor({ timeout: 15000 });
  const doc = await admin.doc('workspaces/cos330-2026/progress/kyle__ch03').get();
  assert.equal(doc.data().status, 'completed');
  assert.equal(doc.data().updatedByUid, uidA);
});

await step('Revoking a device locks it out live', async () => {
  await admin.collection('approvedDevices').doc(uidB).delete();
  await B.page.getByRole('heading', { name: 'Device approval required' }).waitFor({ timeout: 15000 });
});

await step('No uncaught page errors', async () => {
  assert.deepEqual([...A.page.errors, ...B.page.errors, ...C.page.errors], []);
});

await browser.close();
server.kill();
console.log(results.join('\n'));
console.log(failed ? `\n${failed} e2e step(s) failed` : `\nAll ${results.length} e2e steps passed`);
process.exit(failed ? 1 : 0);
