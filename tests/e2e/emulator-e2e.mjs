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

const A = await device(); // Kyle
const B = await device(); // David
const C = await device(); // a Google account that is not on the list
const KYLE = 'kyle.e2e@example.com';
const DAVID = 'david.e2e@example.com';
let uidA;
const T = (id) => `[data-test="${id}"]`;
const PROFILE_BTN = (who) => `${T('profile-button')}[data-profile="${who}"]`;
const SYNCED = `${T('sync')}[data-state="synced"]`;
const status = (t, who, st) => `#topic-${t} ${T(`who-${who}`)} [data-status-of="${who}"][data-status="${st}"]`;
const googleSignIn = (d, email) => d.page.evaluate((e) => window.__emulatorGoogleSignIn(e).then((c) => c.user.uid), email);

await step('F01 first visit shows "Sign in" with Google; no study content', async () => {
  for (const d of [A, B, C]) await d.page.getByRole('heading', { name: 'Sign in' }).waitFor({ timeout: 20000 });
  await A.page.getByRole('button', { name: /Continue with Google/ }).waitFor();
  assert.equal(await A.page.locator(T('session')).count(), 0);
});

await step('Signed-in but unlisted accounts see "No access"', async () => {
  uidA = await googleSignIn(A, KYLE);
  await googleSignIn(B, DAVID);
  await googleSignIn(C, 'stranger@example.com');
  for (const d of [A, B, C]) await d.page.getByRole('heading', { name: 'No access for this account' }).waitFor({ timeout: 15000 });
  await C.page.locator(T('signed-in-email'), { hasText: 'stranger@example.com' }).waitFor();
});

await step('F03 allowing an account unlocks it live, with the profile set by the account (no chooser)', async () => {
  await admin.collection('allowedUsers').doc(KYLE).set({ profile: 'kyle', addedAt: FieldValue.serverTimestamp() });
  await admin.collection('allowedUsers').doc(DAVID).set({ profile: 'david', addedAt: FieldValue.serverTimestamp() });
  await A.page.locator(PROFILE_BTN('kyle')).waitFor({ timeout: 15000 });
  await B.page.locator(PROFILE_BTN('david')).waitFor({ timeout: 15000 });
  assert.equal(await A.page.getByRole('heading', { name: "Who's studying?" }).count(), 0);
});

await step('F02 unlisted account stays gated; direct reads are refused by the rules', async () => {
  await C.page.waitForTimeout(500);
  assert.equal(await C.page.getByRole('heading', { name: 'No access for this account' }).count(), 1);
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
  await A.page.locator(SYNCED).waitFor({ timeout: 10000 });
  await B.page.locator(status('ch03', 'kyle', 'completed')).waitFor({ timeout: 10000 }); // live, sheet still open
  assert.equal(await B.page.locator(status('ch03', 'david', 'not_started')).count(), 1);
});

await step('F08 David\'s change appears on Kyle\'s device; activity feed updates live', async () => {
  await B.page.getByRole('radio', { name: 'In progress' }).click();
  await A.page.locator(status('ch03', 'david', 'in_progress')).waitFor({ timeout: 10000 });
  await A.page.goto(`${URL_}#today`);
  await A.page.locator(`${T('activity')} li`, { hasText: 'David started Ch 3' }).waitFor({ timeout: 10000 });
});

await step('F12 discussion added on one device appears on the other', async () => {
  await B.page.goto(`${URL_}#discuss`);
  await B.page.getByRole('button', { name: 'Add Discussion Topic' }).click();
  await B.page.getByRole('dialog').locator('#nd-title').fill('Explain salting with an example');
  await B.page.getByRole('dialog').getByRole('button', { name: 'Add' }).click();
  await A.page.goto(`${URL_}#discuss`);
  await A.page.locator(T('discussion'), { hasText: 'Explain salting with an example' }).waitFor({ timeout: 10000 });
});

await step('F15 reload keeps saved changes (persisted in Firestore)', async () => {
  await A.page.reload();
  await A.page.goto(`${URL_}#topics/ch03`);
  await A.page.locator(status('ch03', 'kyle', 'completed')).waitFor({ timeout: 15000 });
  const doc = await admin.doc('workspaces/cos330-2026/progress/kyle__ch03').get();
  assert.equal(doc.data().status, 'completed');
  assert.equal(doc.data().updatedByUid, uidA);
});

await step('Session survives a reload (stays signed in)', async () => {
  await B.page.reload();
  await B.page.locator(PROFILE_BTN('david')).waitFor({ timeout: 15000 });
});

await step('Removing an account locks it out live', async () => {
  await admin.collection('allowedUsers').doc(DAVID).delete();
  await B.page.getByRole('heading', { name: 'No access for this account' }).waitFor({ timeout: 15000 });
});

await step('Sign out returns to the sign-in screen', async () => {
  await A.page.goto(`${URL_}#settings`);
  await A.page.getByRole('button', { name: 'Sign out' }).click();
  await A.page.getByRole('dialog').getByRole('button', { name: 'Sign out' }).click();
  await A.page.getByRole('heading', { name: 'Sign in' }).waitFor({ timeout: 15000 });
});

await step('No uncaught page errors', async () => {
  assert.deepEqual([...A.page.errors, ...B.page.errors, ...C.page.errors], []);
});

await browser.close();
server.kill();
console.log(results.join('\n'));
console.log(failed ? `\n${failed} e2e step(s) failed` : `\nAll ${results.length} e2e steps passed`);
process.exit(failed ? 1 : 0);
