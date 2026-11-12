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

async function choose(page, who = 'Kyle') {
  await page.goto(`${BASE}?preview`);
  await page.getByRole('button', { name: who }).click();
  await page.locator('.hero-title').waitFor();
}

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

await test('F01 approval gate shows device code, no study content', async (page) => {
  await page.goto(`${BASE}?preview=unapproved`);
  await page.getByRole('heading', { name: 'Device approval required' }).waitFor();
  assert.equal(await page.locator('.uid-big').textContent(), 'preview-device-uid');
  assert.equal(await page.locator('.session').count(), 0);
  assert.equal(await page.locator('.nav').count(), 0);
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
  await page.getByRole('heading', { name: 'Who is using this device?' }).waitFor();
  await page.getByRole('button', { name: 'David' }).click();
  await page.getByRole('heading', { name: 'Hi David' }).waitFor();
  await page.reload();
  await page.getByRole('heading', { name: 'Hi David' }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('studyTracker.activeProfile.v1')), 'david');
});

await test('F05 switch profile via settings updates header', async (page) => {
  await choose(page, 'Kyle');
  await page.goto(`${BASE}?preview#settings`);
  await page.getByRole('button', { name: 'Switch to David' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Switch to David' }).click();
  await page.getByRole('heading', { name: 'Hi David' }).waitFor();
  assert.match(await page.locator('.profile-pill').textContent(), /David/);
});

// ---------------------------------------------------------------- progress
await test('F06/F07 independent progress per profile', async (page) => {
  await choose(page, 'Kyle');
  await page.goto(`${BASE}?preview#topics/ch01`);
  await page.locator('#st-kyle-ch01').selectOption('completed');
  await page.locator('#topic-ch01 .who-kyle .badge', { hasText: 'First pass completed' }).waitFor();
  assert.equal(await page.locator('#topic-ch01 .who-david .badge').textContent(), 'Not started');
  // David changes his own status on the same chapter
  await page.evaluate(() => localStorage.setItem('studyTracker.activeProfile.v1', 'david'));
  // in-memory preview resets on reload, so switch in-app instead
  await page.goto(`${BASE}?preview#settings`);
  await page.getByRole('button', { name: 'Switch to David' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Switch to David' }).click();
  await page.goto(`${BASE}?preview#topics/ch01`);
  await page.locator('#st-david-ch01').selectOption('in_progress');
  await page.locator('#topic-ch01 .who-david .badge', { hasText: 'In progress' }).waitFor();
  assert.equal(await page.locator('#topic-ch01 .who-kyle .badge').textContent(), 'First pass completed');
  await page.goto(`${BASE}?preview#today`);
  assert.match(await page.locator('.col-kyle .kpi-num').textContent(), /^1\/12$/);
  assert.match(await page.locator('.col-david .kpi-num').textContent(), /^0\/12$/);
});

await test('Task checkbox writes and shows saving → synced', async (page) => {
  await choose(page, 'Kyle');
  await page.goto(`${BASE}?preview#schedule/2026-11-13`);
  const card = page.locator('#session-2026-11-13-kyle-study');
  await card.locator('details.session-tasks').evaluate((d) => { d.open = true; });
  await card.locator('input.task-check').first().check();
  await page.locator('.sync-saving').waitFor();
  await page.locator('.sync-synced').waitFor();
  await card.locator('input.task-check:checked').first().waitFor({ state: 'attached' });
  assert.match(await card.locator('summary', { hasText: 'Tasks' }).textContent(), /you: 1\/4 done/);
});

await test('Rejected write shows error and does not claim success', async (page) => {
  await choose(page, 'Kyle');
  await page.goto(`${BASE}?preview#topics/ch02`);
  await page.evaluate(() => { window.__previewFailWrites = true; });
  await page.locator('#st-kyle-ch02').selectOption('in_progress');
  await page.locator('.toast-error').waitFor();
  assert.match(await page.locator('.toast-error').textContent(), /Not saved/);
  await page.locator('#topic-ch02 .who-kyle .badge', { hasText: 'Not started' }).waitFor(); // optimistic change reverted
  assert.equal(await page.locator('.sync-synced').count(), 1);
}, { allowConsole: /Write failed/ });

// ---------------------------------------------------------------- schedule
await test('F09 calendar filters', async (page) => {
  await choose(page, 'Kyle');
  await page.goto(`${BASE}?preview#schedule/2026-11-16`);
  const count = () => page.locator('.session').count();
  const all = await count();
  await page.getByRole('button', { name: 'Together' }).click();
  const together = await count();
  const types = await page.locator('.session .chip-type').allTextContents();
  assert.ok(types.every((t) => /Joint|Practice/.test(t)), `together shows ${types}`);
  await page.getByRole('button', { name: 'Rest & buffers' }).click();
  const rb = await page.locator('.session .chip-type').allTextContents();
  assert.ok(rb.every((t) => /Rest|Buffer/.test(t)), `rest/buffer shows ${rb}`);
  await page.getByRole('button', { name: 'David', exact: true }).click();
  const david = await page.locator('.session').count();
  assert.ok(all > together && all > david, `all=${all} together=${together} david=${david}`);
  await page.getByRole('button', { name: 'All', exact: true }).click();
});

await test('F13/F14 rest day and practice day marked; protected in reschedule', async (page) => {
  await choose(page, 'Kyle');
  await page.goto(`${BASE}?preview#schedule/2026-11-14`);
  await page.locator('#session-2026-11-14-kyle-golf-rest .rest-note').waitFor();
  await page.goto(`${BASE}?preview#schedule/2026-11-16`);
  await page.locator('#session-2026-11-16-kyle-study').getByRole('button', { name: 'Reschedule…' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.locator('#resched-date').fill('2026-11-20');
  await dlg.locator('.warning').waitFor();
  await dlg.getByRole('button', { name: 'Move session' }).click();
  await dlg.locator('#resched-error:not([hidden])').waitFor(); // needs explicit confirmation
  await dlg.getByRole('button', { name: 'Close' }).click();
});

await test('F10/F11 reschedule + missed keep progress unchanged', async (page) => {
  await choose(page, 'Kyle');
  await page.goto(`${BASE}?preview#topics/ch05`);
  await page.locator('#st-kyle-ch05').selectOption('in_progress');
  await page.locator('#topic-ch05 .who-kyle .badge', { hasText: 'In progress' }).waitFor();
  await page.goto(`${BASE}?preview#schedule/2026-11-16`);
  const card = page.locator('#session-2026-11-16-kyle-study');
  await card.getByRole('button', { name: 'Missed…' }).click();
  await page.getByRole('dialog').locator('#missed-reason').fill('ran out of time');
  await page.getByRole('dialog').getByRole('button', { name: 'Mark missed and reschedule…' }).click();
  const dlg = page.getByRole('dialog', { name: 'Reschedule session' });
  await dlg.waitFor();
  await dlg.getByRole('button', { name: /SHOULD deepening/ }).click(); // explicit buffer slot
  await dlg.locator('.preview', { hasText: 'Thursday 19 November 2026' }).waitFor();
  await dlg.getByRole('button', { name: 'Move session' }).click();
  await page.locator('.toast-success', { hasText: 'Moved' }).waitFor();
  await page.goto(`${BASE}?preview#schedule/2026-11-19`);
  await page.locator('#session-2026-11-16-kyle-study .session-flag', { hasText: 'Moved from Mon 16 Nov' }).waitFor();
  await page.goto(`${BASE}?preview#topics/ch05`);
  assert.equal(await page.locator('#topic-ch05 .who-kyle .badge').textContent(), 'In progress');
});

await test('Add, edit and delete a user session', async (page) => {
  await choose(page, 'Kyle');
  await page.goto(`${BASE}?preview#schedule/2026-11-17`);
  await page.getByRole('button', { name: '＋ Add session' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('button', { name: 'Add session' }).click();
  await dlg.locator('#sf-title-err:not([hidden])').waitFor(); // validation
  await dlg.locator('#sf-title').fill('Extra SQLi practice');
  await dlg.locator('#sf-date').fill('2026-11-17');
  await dlg.getByRole('button', { name: 'Add session' }).click();
  const card = page.locator('.session', { hasText: 'Extra SQLi practice' });
  await card.waitFor();
  await card.getByRole('button', { name: 'Delete…' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await card.waitFor({ state: 'detached' });
});

// ---------------------------------------------------------------- discussions
await test('F12 add discussion; discussed does not change progress', async (page) => {
  await choose(page, 'David');
  await page.goto(`${BASE}?preview#topics/ch04`);
  await page.locator('#topic-ch04').getByRole('button', { name: /Needs discussion/ }).click();
  const dlg = page.getByRole('dialog');
  await dlg.locator('#nd-title').fill('Capability list vs ACL: which is faster to revoke?');
  await dlg.getByRole('button', { name: 'Add' }).click();
  await page.goto(`${BASE}?preview#discuss`);
  const item = page.locator('.disc', { hasText: 'Capability list vs ACL' });
  await item.waitFor();
  await item.locator('select').selectOption('discussed');
  await page.locator('.panel', { hasText: 'Discussed (1)' }).waitFor();
  await page.goto(`${BASE}?preview#topics/ch04`);
  assert.equal(await page.locator('#topic-ch04 .who-david .badge').textContent(), 'Not started');
  // seeded schedule questions are present
  await page.goto(`${BASE}?preview#discuss`);
  await page.locator('.disc', { hasText: 'two\'s complement gives −69' }).waitFor();
});

await test('David queue ticks sync with session task', async (page) => {
  await choose(page, 'David');
  await page.goto(`${BASE}?preview#topics/queue`);
  await page.locator('#q-q01').check();
  await page.locator('#q-q01:checked').waitFor({ state: 'attached' });
  await page.goto(`${BASE}?preview#schedule/2026-11-13`);
  const card = page.locator('#session-2026-11-13-david-study');
  await card.locator('#chk-david-q01:checked').waitFor({ state: 'attached' });
});

// ---------------------------------------------------------------- responsive
for (const width of [320, 375, 430, 1280]) {
  await test(`No horizontal overflow at ${width}px on all views`, async (page) => {
    await page.setViewportSize({ width, height: 900 });
    await choose(page, 'Kyle');
    for (const view of ['today', 'schedule/2026-11-19', 'topics', 'discuss', 'settings']) {
      await page.goto(`${BASE}?preview#${view}`);
      await page.locator('.view').waitFor();
      await page.waitForTimeout(150);
      await noHorizontalOverflow(page, view);
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
