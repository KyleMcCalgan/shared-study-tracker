#!/usr/bin/env node
// Deploy firestore.rules with the Admin SDK (same credentials as seeding).
// Alternative: paste firestore.rules into Firebase Console → Firestore → Rules → Publish,
// or `npx firebase deploy --only firestore:rules` after `npx firebase login`.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getSecurityRules } from 'firebase-admin/security-rules';
import { initAdmin, repoRoot } from './lib/admin.mjs';

try {
  const { app, projectId, emulator } = await initAdmin();
  if (emulator) throw new Error('Unset FIRESTORE_EMULATOR_HOST to deploy to the real project.');
  const source = readFileSync(resolve(repoRoot, 'firestore.rules'), 'utf8');
  if (/allow\s+read\s*,\s*write\s*:\s*if\s+true/.test(source)) throw new Error('Refusing to deploy rules containing "allow read, write: if true".');
  const ruleset = await getSecurityRules(app).releaseFirestoreRulesetFromSource(source);
  console.log(`✔ Deployed Firestore rules to ${projectId} (ruleset ${ruleset.name}).`);
  process.exit(0);
} catch (e) {
  console.error(`✖ ${e.message}`);
  process.exit(1);
}
