#!/usr/bin/env node
// Owner-only account allowlist (Admin SDK; browsers can never change it).
//
//   npm run allow -- <google-email> --profile kyle
//   npm run allow -- <google-email> --profile david
//   npm run allow -- --list
//   npm run allow -- --revoke <google-email>
//
// Emails are stored only in Firestore (allowedUsers/{email}), never in this repo.
// Each profile may have one account unless --allow-more is passed.
import { FieldValue } from 'firebase-admin/firestore';
import { initAdmin, argValue, hasFlag } from './lib/admin.mjs';

const EMAIL_RE = /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/;
const PROFILES = ['kyle', 'david'];

try {
  const { db, projectId } = await initAdmin();
  const col = db.collection('allowedUsers');
  console.log(`Project: ${projectId}\n`);

  if (hasFlag('--list')) {
    const snap = await col.get();
    if (snap.empty) console.log('No accounts allowed yet.');
    snap.forEach((d) => console.log(`${d.data().profile.padEnd(6)} ${d.id}`));
    process.exit(0);
  }

  const revoke = argValue('--revoke');
  if (revoke) {
    await col.doc(revoke.trim().toLowerCase()).delete();
    console.log(`✔ Removed ${revoke}. That account loses access immediately.`);
    process.exit(0);
  }

  const email = (process.argv.slice(2).find((a) => EMAIL_RE.test(a)) || '').trim().toLowerCase();
  const profile = argValue('--profile');
  if (!email || !PROFILES.includes(profile)) {
    throw new Error('Usage: npm run allow -- <google-email> --profile kyle|david');
  }
  const existing = await col.where('profile', '==', profile).get();
  const others = existing.docs.filter((d) => d.id !== email);
  if (others.length && !hasFlag('--allow-more')) {
    throw new Error(`${profile} already has ${others.map((d) => d.id).join(', ')}. Revoke it first, or pass --allow-more to give ${profile} a second account.`);
  }
  await col.doc(email).set({ profile, addedAt: FieldValue.serverTimestamp() });
  console.log(`✔ ${email} can now sign in as ${profile}. An open "No access" page unlocks by itself.`);
  process.exit(0);
} catch (e) {
  console.error(`✖ ${e.message}`);
  process.exit(1);
}
