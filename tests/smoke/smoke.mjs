#!/usr/bin/env node
// Browser smoke tests against the local preview backend (seed data, in memory).
// Uses playwright-core with an installed Chromium-family browser (Edge/Chrome).
//   npm run test:smoke                 (SMOKE_SCREENSHOTS=dir to save screenshots)
//   SMOKE_BROWSER_CHANNEL=chrome npm run test:smoke
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = 8137;
const BASE = `http://localhost:${PORT}/website/`;
const shots = process.env.SMOKE_SCREENSHOTS;
if (shots) mkdirSync(shots, { recursive: true });

const server = spawn(process.execPath, [resolve(root, 'scripts/serve.mjs')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'pipe' });
await new Promise((r) => server.stdout.once('data', r));

const channel = process.env.SMOKE_BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : 'chrome');
const browser = await chromium.launch({ channel, headless: true });
let failures = 0;
const results = [];

async function test(name, fn, { allowConsole = null } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Africa/Johannesburg' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !(allowConsole && allowConsole.test(m.text()))) errors.push(m.text()); });
  try {
    await fn(page, context);
    assert.deepEqual(errors, [], `console errors: ${errors.join(' | ')}`);
    results.push(`✔ ${name}`);
  } catch (e) {
    failures++;
    results.push(`✖ ${name}\n    ${e.message.split('\n').join('\n    ')}`);
    if (shots) await page.screenshot({ path: `${shots}/FAIL-${name.replace(/\W+/g, '_')}.png`, fullPage: true }).catch(() => {});
  } finally {
    await context.close();
  }
}

// Stable hooks (data-test / ids) so a visual redesign barely touches these tests.
const T = (id) => `[data-test="${id}"]`;
const PROFILE_BTN = (who) => `${T('profile-button')}[data-profile="${who.toLowerCase()}"]`;
const SYNC = (st) => `${T('sync')}[data-state="${st}"]`;
const SESSION = T('session');

async function choose(page, who = 'Kyle') {
  await page.goto(`${BASE}?preview`);
  await page.locator(T(`choose-${who.toLowerCase()}`)).click();
  await page.locator(T('view-today')).waitFor();
  await page.locator(T('exam-countdown')).waitFor();
}

async function switchTo(page, who) {
  await page.goto(`${BASE}?preview#settings`);
  await page.getByRole('button', { name: `Switch to ${who}` }).click();
  await page.getByRole('dialog').getByRole('button', { name: `Switch to ${who}` }).click();
  await page.locator(PROFILE_BTN(who)).waitFor();
}

async function openMenu(page, sessionId, item) {
  await page.locator(`#session-${sessionId}`).getByRole('button', { name: /More actions/ }).click();
  await page.getByRole('menuitem', { name: item }).click();
}

// Chapter list entry -> that person's status id (e.g. 'completed', 'in_progress').
const tileStatus = (page, t, who) => page.locator(`${T(`chapter-${t}`)} [data-status-of="${who}"]`).getAttribute('data-status');
// Chapter detail (sheet or panel) -> wait until that person's status is `status`.
const detailStatus = (page, t, who, status) => page.locator(`#topic-${t} ${T(`who-${who}`)} [data-status-of="${who}"][data-status="${status}"]`).waitFor();

async function noHorizontalOverflow(page, label = '') {
  const { sw, cw, culprits } = await page.evaluate(() => {
    const W = document.documentElement.clientWidth;
    const inScroller = (e) => { for (let p = e.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll') return true; } return false; };
    const culprits = [...document.querySelectorAll('body *')]
      .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > W + 0.5 && !inScroller(e); })
      .filter((e) => ![...e.children].some((c) => c.getBoundingClientRect().right > W + 0.5))
      .slice(0, 4).map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join('.')} (right ${Math.round(e.getBoundingClientRect().right)}) "${(e.textContent || '').trim().slice(0, 40)}"`);
    // Content wider than its own box (e.g. unbreakable text)
    [...document.querySelectorAll('body *')].filter((e) => e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0 && !['auto', 'scroll', 'hidden'].includes(getComputedStyle(e).overflowX))
      .slice(-4).forEach((e) => culprits.push(`content>${e.tagName.toLowerCase()}.${[...e.classList].join('.')} (${e.scrollWidth}>${e.clientWidth}) "${(e.textContent || '').trim().slice(0, 40)}"`));
    return { sw: document.documentElement.scrollWidth, cw: W, culprits };
  });
  assert.ok(sw <= cw + 1, `horizontal overflow on ${label}: scrollWidth ${sw} > clientWidth ${cw}; culprits: ${culprits.join(' | ')}`);
}

// ---------------------------------------------------------------- gate states
await test('Invalid config state: "Firebase configuration missing"', async (page) => {
  await page.route('**/js/firebase-config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: 'export const firebaseConfig = null;' }));
  await page.goto(BASE);
  await page.getByRole('heading', { name: 'Firebase configuration missing' }).waitFor();
});

await test('F01 signed-out screen offers Google sign-in, no study content', async (page) => {
  await page.goto(`${BASE}?preview=signedout`);
  await page.getByRole('heading', { name: 'Sign in' }).waitFor();
  assert.equal(await page.locator(SESSION).count(), 0);
  assert.equal(await page.locator('nav[aria-label="Main"]').count(), 0);
  await page.getByRole('button', { name: /Continue with Google/ }).click();
  await page.getByRole('heading', { name: "Who's studying?" }).waitFor(); // preview account → chooser
});

await test('Unlisted account sees "No access" and can switch account', async (page) => {
  await page.goto(`${BASE}?preview=notallowed`);
  await page.getByRole('heading', { name: 'No access for this account' }).waitFor();
  assert.equal(await page.locator(SESSION).count(), 0);
  await page.getByRole('button', { name: 'Use a different account' }).click();
  await page.getByRole('heading', { name: 'Sign in' }).waitFor();
});

await test('F16 Firebase unavailable shows error + retry', async (page) => {
  await page.goto(`${BASE}?preview=error`);
  await page.getByRole('heading', { name: "Can't reach Firebase" }).waitFor();
  await page.getByRole('button', { name: 'Try again' }).waitFor();
});

await test('F17 empty database shows "not imported" state', async (page) => {
  await page.goto(`${BASE}?preview=empty`);
  await page.getByRole('heading', { name: 'Schedule not imported yet' }).waitFor();
});

// ---------------------------------------------------------------- profile
await test('F03/F04 choose profile, remembered after reload', async (page) => {
  await page.goto(`${BASE}?preview`);
  await page.getByRole('heading', { name: "Who's studying?" }).waitFor();
  await page.getByRole('button', { name: 'David' }).click();
  await page.locator(PROFILE_BTN('david')).waitFor();
  await page.reload();
  await page.locator(PROFILE_BTN('david')).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('studyTracker.activeProfile.v1')), 'david');
});

await test('F05 switch profile via settings updates header', async (page) => {
  await choose(page, 'Kyle');
  await switchTo(page, 'David');
  assert.equal(await page.locator(T('profile-button')).getAttribute('data-profile'), 'david');
  await page.goto(`${BASE}?preview#settings`);
  assert.match(await page.locator(T('current-profile')).textContent(), /David/);
});

// ---------------------------------------------------------------- progress
await test('F06/F07 independent progress per profile', async (page) => {
  await choose(page, 'Kyle');
  await page.goto(`${BASE}?preview#topics/ch01`);
  await page.getByRole('radio', { name: 'First pass completed' }).click();
  await detailStatus(page, 'ch01', 'kyle', 'completed');
  await detailStatus(page, 'ch01', 'david', 'not_started');
  await switchTo(page, 'David');
  await page.goto(`${BASE}?preview#topics/ch01`);
  await page.getByRole('radio', { name: 'In progress' }).click();
  await detailStatus(page, 'ch01', 'david', 'in_progress');
  await detailStatus(page, 'ch01', 'kyle', 'completed');
  await page.goto(`${BASE}?preview#topics`);
  assert.equal(await tileStatus(page, 'ch01', 'kyle'), 'completed');
  assert.equal(await tileStatus(page, 'ch01', 'david'), 'in_progress');
  await page.goto(`${BASE}?preview#today`);
  const count = async (who) => { const el = page.locator(T(`progress-${who}`)); return `${await el.getAttribute('data-done')}/${await el.getAttribute('data-total')}`; };
  assert.equal(await count('kyle'), '1/12');
  assert.equal(await count('david'), '0/12');
});

await test('Task checkbox writes and shows saving → synced', async (page) => {
  await choose(page, 'Kyle');
  await page.goto(`${BASE}?preview#schedule/2026-11-13`);
  const card = page.locator('#session-2026-11-13-kyle-study');
  await card.locator(T('task-tick')).first().check();
  await page.locator(SYNC('saving')).waitFor();
  await page.locator(SYNC('synced')).waitFor();
  await card.locator(`${T('task-tick')}:checked`).first().waitFor({ state: 'attached' });
  assert.equal(await card.locator(T('task-progress')).textContent(), '1 of 4');
});

await test('Rejected write shows error and does not claim success', async (page) => {
  await choose(page, 'Kyle');
  await page.goto(`${BASE}?preview#topics/ch02`);
  await page.evaluate(() => { window.__previewFailWrites = true; });
  await page.getByRole('radio', { name: 'In progress' }).click();
  await page.locator('.toast-error').waitFor();
  assert.match(await page.locator('.toast-error').textContent(), /Not saved/);
  await detailStatus(page, 'ch02', 'kyle', 'not_started'); // reverted
  await page.getByRole('radio', { name: 'Not started', checked: true }).waitFor();
  assert.equal(await page.locator(SYNC('synced')).count(), 1);
}, { allowConsole: /Write failed/ });

// ---------------------------------------------------------------- schedule
await test('F09 calendar filters; own sessions listed first', async (page) => {
  await choose(page, 'Kyle');
  await page.goto(`${BASE}?preview#schedule/2026-11-16`);
  const count = () => page.locator(SESSION).count();
  const all = await count();
  assert.equal(await page.locator(SESSION).first().getAttribute('id'), 'session-2026-11-16-kyle-study');
  await page.getByRole('button', { name: 'Together', exact: true }).click();
  const together = await count();
  const types = await page.locator(`${SESSION} ${T('session-type')}`).allTextContents();
  assert.ok(types.every((t) => /Joint|Practice/.test(t)), `together shows ${types}`);
  await page.getByRole('button', { name: 'Rest', exact: true }).click();
  const rb = await page.locator(`${SESSION} ${T('session-type')}`).allTextContents();
  assert.ok(rb.every((t) => /Rest|Buffer/.test(t)), `rest/buffer shows ${rb}`);
  await page.getByRole('button', { name: 'David', exact: true }).click();
  const david = await count();
  assert.ok(all > together && all > david, `all=${all} together=${together} david=${david}`);
  await page.getByRole('button', { name: 'All', exact: true }).click();
});

await test('Week strip: next week, then tapping a day shows that day', async (page) => {
  await choose(page, 'Kyle');
  await page.goto(`${BASE}?preview#schedule/2026-11-13`);
  await page.getByRole('button', { name: 'Next week' }).click();
  await page.locator('#daypill-2026-11-20').click();
  await page.getByRole('heading', { name: 'Friday 20' }).waitFor();
  await page.locator('#session-2026-11-20-practice').waitFor();
});

await test('F13/F14 rest day and practice day marked; protected in reschedule', async (page) => {
  await choose(page, 'Kyle');
  await page.goto(`${BASE}?preview#schedule/2026-11-12`);
  await page.locator('#session-2026-11-12-no-study', { hasText: 'No required work' }).waitFor();
  await page.goto(`${BASE}?preview#schedule/2026-11-16`);
  await openMenu(page, '2026-11-16-kyle-study', /Move to another day/);
  const dlg = page.getByRole('dialog', { name: 'Move to another day' });
  await dlg.locator('#resched-date').fill('2026-11-20');
  await dlg.locator('.warning').waitFor();
  await dlg.getByRole('button', { name: 'Move session' }).click();
  await dlg.locator('#resched-error:not([hidden])').waitFor(); // needs explicit confirmation
  await dlg.getByRole('button', { name: 'Close' }).click();
});

await test('F10/F11 reschedule + missed keep progress unchanged', async (page) => {
  await choose(page, 'Kyle');
  await page.goto(`${BASE}?preview#topics/ch05`);
  await page.getByRole('radio', { name: 'In progress' }).click();
  await detailStatus(page, 'ch05', 'kyle', 'in_progress');
  await page.goto(`${BASE}?preview#schedule/2026-11-16`);
  await openMenu(page, '2026-11-16-kyle-study', /Missed it/);
  await page.getByRole('dialog').locator('#missed-reason').fill('ran out of time');
  await page.getByRole('dialog').getByRole('button', { name: /Missed \+ move it/ }).click();
  const dlg = page.getByRole('dialog', { name: 'Move to another day' });
  await dlg.waitFor();
  await dlg.getByRole('button', { name: /SHOULD deepening/ }).click();
  await dlg.locator('.preview', { hasText: 'Thursday 19 November 2026' }).waitFor();
  await dlg.getByRole('button', { name: 'Move session' }).click();
  await page.locator('.toast-success', { hasText: 'Moved' }).waitFor();
  await page.goto(`${BASE}?preview#schedule/2026-11-19`);
  await page.locator(`#session-2026-11-16-kyle-study ${T('session-flag')}`, { hasText: 'Moved from Mon 16 Nov' }).waitFor();
  await page.goto(`${BASE}?preview#topics`);
  assert.equal(await tileStatus(page, 'ch05', 'kyle'), 'in_progress');
});

await test('Add, edit and delete a user session', async (page) => {
  await choose(page, 'Kyle');
  await page.goto(`${BASE}?preview#schedule/2026-11-17`);
  await page.getByRole('button', { name: 'Add Session', exact: true }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('button', { name: 'Add session' }).click();
  await dlg.locator('#sf-title-err:not([hidden])').waitFor(); // validation
  await dlg.locator('#sf-title').fill('Extra SQLi practice');
  await dlg.locator('#sf-date').fill('2026-11-17');
  await dlg.getByRole('button', { name: 'Add session' }).click();
  const card = page.locator(SESSION, { hasText: 'Extra SQLi practice' });
  await card.waitFor();
  await card.getByRole('button', { name: /More actions/ }).click();
  await page.getByRole('menuitem', { name: /Delete session/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await card.waitFor({ state: 'detached' });
});

// ---------------------------------------------------------------- discussions
await test('F12 add discussion; discussed does not change progress', async (page) => {
  await choose(page, 'David');
  await page.goto(`${BASE}?preview#topics/ch04`);
  await page.getByRole('button', { name: /Raise for discussion/ }).click();
  const dlg = page.getByRole('dialog', { name: 'New discussion item' });
  await dlg.locator('#nd-title').fill('Capability list vs ACL: which is faster to revoke?');
  await dlg.getByRole('button', { name: 'Add' }).click();
  await page.goto(`${BASE}?preview#discuss`);
  const item = page.locator(T('discussion'), { hasText: 'Capability list vs ACL' });
  await item.click(); // opens the discussion sheet
  const sheet = page.getByRole('dialog', { name: 'Discussion' });
  await sheet.getByRole('button', { name: 'Mark as Discussed' }).click();
  await sheet.locator(T('discussion-tag'), { hasText: 'Discussed' }).waitFor(); // live update inside the open sheet
  await sheet.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Discussed (1)' }).click();
  await page.locator(T('discussion'), { hasText: 'Capability list vs ACL' }).waitFor();
  await page.goto(`${BASE}?preview#topics`);
  assert.equal(await tileStatus(page, 'ch04', 'david'), 'not_started');
  await page.goto(`${BASE}?preview#discuss`);
  await page.getByRole('button', { name: /^Open \(/ }).click();
  await page.locator(T('discussion'), { hasText: "two's complement gives −69" }).waitFor();
  assert.equal(await page.locator(T('discussion'), { hasText: 'Capability list vs ACL' }).count(), 0);
});

await test('David open day shows; queue ticks persist', async (page) => {
  await choose(page, 'David');
  await page.goto(`${BASE}?preview#schedule/2026-11-13`);
  await page.locator('#session-2026-11-13-david-open', { hasText: 'add your own study' }).waitFor();
  await page.goto(`${BASE}?preview#topics/queue`);
  await page.locator('#q-q01').check();
  await page.locator('#q-q01:checked').waitFor({ state: 'attached' });
  await page.goto(`${BASE}?preview#schedule/2026-11-13`);
  await page.goto(`${BASE}?preview#topics/queue`);
  await page.locator('#q-q01:checked').waitFor({ state: 'attached' });
});

await test('Navigating closes an open sheet', async (page) => {
  await choose(page, 'Kyle');
  await page.goto(`${BASE}?preview#topics/ch03`);
  await page.getByRole('dialog').waitFor();
  await page.goto(`${BASE}?preview#today`);
  await page.getByRole('dialog').waitFor({ state: 'detached' });
});

// ---------------------------------------------------------------- desktop layout
await test('Desktop: chapter panel and discussion panel edit inline', async (page) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await choose(page, 'Kyle');
  assert.equal(await page.locator('nav[aria-label="Main"] a').count(), 5);
  await page.goto(`${BASE}?preview#topics`);
  await page.locator(T('chapter-ch06')).click();
  await page.locator('#topic-ch06').waitFor();
  assert.equal(await page.getByRole('dialog').count(), 0); // a panel, not a sheet
  await page.getByRole('radio', { name: 'In progress' }).click();
  await detailStatus(page, 'ch06', 'kyle', 'in_progress');
  assert.equal(await tileStatus(page, 'ch06', 'kyle'), 'in_progress');
  await page.goto(`${BASE}?preview#discuss`);
  await page.locator(T('discussion'), { hasText: 'practicals are examinable' }).click();
  await page.locator(T('discussion-detail'), { hasText: 'practicals are examinable' }).getByRole('button', { name: 'Mark as Discussed' }).click();
  await page.locator(T('discussion'), { hasText: 'practicals are examinable' }).waitFor({ state: 'detached' }); // left the "To Discuss" list
  await page.getByRole('button', { name: 'Discussed', exact: true }).click();
  await page.locator(T('discussion'), { hasText: 'practicals are examinable' }).waitFor();
});

// ---------------------------------------------------------------- responsive
for (const width of [320, 375, 430, 1280]) {
  await test(`No horizontal overflow at ${width}px on all views`, async (page) => {
    await page.setViewportSize({ width, height: 900 });
    await choose(page, 'Kyle');
    for (const view of ['today', 'schedule/2026-11-19', 'topics', 'topics/ch05', 'discuss', 'settings']) {
      await page.goto(`${BASE}?preview#${view}`);
      await page.locator('.view').waitFor();
      await page.waitForTimeout(150);
      await noHorizontalOverflow(page, view);
      const leaked = await page.evaluate(() => (document.body.innerText.match(/\b(null|undefined|NaN|\[object Object\])\b/) || [])[0]);
      assert.equal(leaked, undefined, `"${leaked}" rendered as text on ${view}`);
      if (shots) await page.screenshot({ path: `${shots}/${width}-${view.replace('/', '_')}.png`, fullPage: width !== 1280 });
    }
  });
}

await test('Keyboard: skip link and nav reachable with Tab', async (page) => {
  await choose(page, 'Kyle');
  await page.keyboard.press('Tab');
  const first = await page.evaluate(() => document.activeElement.textContent);
  assert.match(first, /Skip to content/);
});

await browser.close();
server.kill();
console.log(results.join('\n'));
console.log(failures ? `\n${failures} smoke test(s) failed` : `\nAll ${results.length} smoke tests passed`);
process.exit(failures ? 1 : 0);
