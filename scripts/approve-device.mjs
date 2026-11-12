#!/usr/bin/env node
// Owner-only device allowlist management (Admin SDK; browsers can never do this).
//
//   npm run approve -- <uid> --label "Kyle phone"
//   npm run approve -- --list
//   npm run approve -- --revoke <uid>
//
// By default at most two devices may be approved (spec §10). Pass --allow-more
// to deliberately approve an extra device (e.g. Kyle's laptop as well as phone).
import { FieldValue } from 'firebase-admin/firestore';
import { initAdmin, argValue, hasFlag } from './lib/admin.mjs';

const UID_RE = /^[A-Za-z0-9]{20,128}$/;

try {
  const { db, projectId } = await initAdmin();
  const col = db.collection('approvedDevices');
  console.log(`Project: ${projectId}\n`);

  if (hasFlag('--list')) {
    const snap = await col.get();
    if (snap.empty) console.log('No approved devices.');
    snap.forEach((d) => console.log(`${d.id}  ${d.data().label || ''}  (approved ${d.data().approvedAt?.toDate?.().toISOString() ?? '?'})`));
    process.exit(0);
  }

  const revoke = argValue('--revoke');
  if (revoke) {
    if (!UID_RE.test(revoke)) throw new Error('That does not look like a device ID.');
    await col.doc(revoke).delete();
    console.log(`✔ Revoked ${revoke}. That browser loses access immediately.`);
    process.exit(0);
  }

  const uid = process.argv.slice(2).find((a) => !a.startsWith('--') && a !== argValue('--label') && a !== argValue('--project'));
  if (!uid || !UID_RE.test(uid)) throw new Error('Usage: npm run approve -- <device-id> --label "Kyle phone"   (device ID is shown on the site\'s approval screen)');
  const label = (argValue('--label') || '').slice(0, 60);
  const existing = await col.get();
  if (existing.docs.some((d) => d.id === uid)) { console.log(`Already approved: ${uid}`); process.exit(0); }
  if (existing.size >= 2 && !hasFlag('--allow-more')) {
    throw new Error(`${existing.size} devices are already approved:\n${existing.docs.map((d) => `  ${d.id} ${d.data().label || ''}`).join('\n')}\nRevoke an old one (--revoke <id>) or pass --allow-more to approve an extra device deliberately.`);
  }
  await col.doc(uid).set({ label, approvedAt: FieldValue.serverTimestamp() });
  console.log(`✔ Approved ${uid}${label ? ` (${label})` : ''}. The device unlocks automatically within a few seconds.`);
  process.exit(0);
} catch (e) {
  console.error(`✖ ${e.message}`);
  process.exit(1);
}
