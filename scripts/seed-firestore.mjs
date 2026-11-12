#!/usr/bin/env node
// Owner-only import of data/seed-schedule.json into Cloud Firestore.
//
//   npm run seed                                  dry run: prints the diff, writes nothing
//   npm run seed -- --apply                       creates missing docs + refreshes workspace metadata
//   npm run seed -- --apply --update-changed      also refreshes source fields of changed imported docs
//   npm run seed -- --apply --archive-removed     also hides imported docs no longer in the source
//
// Never deletes anything. Never touches progress, checks, activity, or the
// user-owned fields of sessions (date, status, notes) and discussions.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initAdmin, repoRoot, hasFlag } from './lib/admin.mjs';
import { runSeed } from './lib/seed-run.mjs';
import { validateSeed } from './lib/validate.mjs';

try {
  const seed = JSON.parse(readFileSync(resolve(repoRoot, 'data/seed-schedule.json'), 'utf8'));
  const { errors } = validateSeed(seed);
  if (errors.length) throw new Error(`Seed is invalid:\n  ${errors.join('\n  ')}`);
  const { db, projectId, emulator } = await initAdmin();
  console.log(`Target: project "${projectId}"${emulator ? ' (EMULATOR)' : ''}, workspace "${seed.workspaceId}"\n`);
  await runSeed({
    db, seed, apply: hasFlag('--apply'), updateChanged: hasFlag('--update-changed'), archiveRemoved: hasFlag('--archive-removed'),
  });
  process.exit(0);
} catch (e) {
  console.error(`✖ ${e.message}`);
  process.exit(1);
}
