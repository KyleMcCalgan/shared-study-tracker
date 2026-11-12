import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stampJs, stampHtml } from '../../scripts/stamp-version.mjs';

test('stamps relative module imports, leaves external URLs alone', () => {
  const src = [
    "import { a } from './a.js';",
    "import * as b from '../b.js';",
    "const c = await import('./c.js');",
    "import { x } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';",
    "fetch('../data/seed-schedule.json');",
    "import './side-effect.js';",
  ].join('\n');
  const out = stampJs(src, 'v1');
  assert.match(out, /'\.\/a\.js\?v=v1'/);
  assert.match(out, /'\.\.\/b\.js\?v=v1'/);
  assert.match(out, /import\('\.\/c\.js\?v=v1'\)/);
  assert.match(out, /'\.\/side-effect\.js\?v=v1'/);
  assert.match(out, /firebase-app\.js';/); // untouched
  assert.match(out, /seed-schedule\.json'/); // untouched
  assert.equal(stampJs(out, 'v1'), out.replace(/\?v=v1/g, '?v=v1')); // stable shape
});

test('stamps the entry script and stylesheet in HTML only', () => {
  const html = '<link rel="stylesheet" href="styles/main.css"><link href="https://fonts.googleapis.com/x"><script type="module" src="js/main.js"></script><link rel="icon" href="favicon.svg">';
  const out = stampHtml(html, 'v1');
  assert.match(out, /styles\/main\.css\?v=v1/);
  assert.match(out, /js\/main\.js\?v=v1/);
  assert.match(out, /href="https:\/\/fonts\.googleapis\.com\/x"/);
  assert.match(out, /href="favicon\.svg"/);
});
