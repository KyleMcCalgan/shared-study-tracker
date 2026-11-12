#!/usr/bin/env node
// Validate data/seed-schedule.json and confirm it matches docs/source-schedule.md.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { validateSeed } from './lib/validate.mjs';
import { sha256 } from './lib/schedule-parser.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const seed = JSON.parse(readFileSync(resolve(root, 'data/seed-schedule.json'), 'utf8'));
const source = readFileSync(resolve(root, 'docs/source-schedule.md'), 'utf8').replace(/\r\n/g, '\n');

let failed = false;
if (sha256(source) !== seed.sourceHash) {
  console.error('✖ data/seed-schedule.json was generated from a different source-schedule.md (hash mismatch). Run "npm run parse".');
  failed = true;
}
const { errors, warnings } = validateSeed(seed);
for (const e of errors) console.error(`✖ ${e}`);
for (const w of warnings) console.warn(`⚠ ${w}`);
if (errors.length) failed = true;

try {
  execFileSync(process.execPath, [resolve(root, 'scripts/parse-schedule.mjs'), '--check'], { stdio: 'inherit' });
} catch { failed = true; }

if (failed) process.exit(1);
console.log(`✔ Seed valid: ${seed.topics.length} topics, ${seed.sessions.length} sessions, ${seed.discussions.length} discussions`);
