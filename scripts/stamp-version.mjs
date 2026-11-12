#!/usr/bin/env node
// Cache-busting for GitHub Pages (which caches every file for 10 minutes).
// Appends ?v=<version> to every relative module import, the main script and the
// stylesheet, so a new deploy can never be mixed with cached old modules.
// Runs in the Pages workflow on the CI checkout only, never committed.
//   node scripts/stamp-version.mjs <dir> <version>
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const [dir = 'website', version = String(Date.now())] = process.argv.slice(2);
const v = encodeURIComponent(version.slice(0, 12));

// './x.js' or '../x.js' as an import/export specifier or dynamic import()
const JS_SPEC = /((?:from\s*|import\s*\(\s*|import\s+)(['"]))(\.{1,2}\/[^'"?]+\.js)\2/g;

export function stampJs(src, ver) {
  return src.replace(JS_SPEC, (_m, pre, q, path) => `${pre}${path}?v=${ver}${q}`);
}
export function stampHtml(src, ver) {
  return src
    .replace(/(src|href)="((?:js|styles)\/[^"?]+\.(?:js|css))"/g, (_m, attr, path) => `${attr}="${path}?v=${ver}"`);
}

function walk(d) {
  return readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

if (import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/').split('/').pop() || '')) {
  let count = 0;
  for (const file of walk(dir)) {
    const ext = extname(file);
    if (ext !== '.js' && ext !== '.html') continue;
    const src = readFileSync(file, 'utf8');
    const out = ext === '.js' ? stampJs(src, v) : stampHtml(src, v);
    if (out !== src) { writeFileSync(file, out); count++; }
  }
  console.log(`Stamped ${count} files in ${dir} with ?v=${v}`);
}
