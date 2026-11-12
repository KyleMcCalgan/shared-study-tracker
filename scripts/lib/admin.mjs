// Owner-only Firebase Admin SDK initialisation for local scripts.
// Credentials come from GOOGLE_APPLICATION_CREDENTIALS (a service-account JSON
// stored OUTSIDE this repository) or, for tests, FIRESTORE_EMULATOR_HOST.
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export function argValue(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
export const hasFlag = (name) => process.argv.includes(name);

async function projectIdFromConfig() {
  try {
    const mod = await import(pathToFileURL(resolve(repoRoot, 'website/js/firebase-config.js')).href);
    return mod.firebaseConfig?.projectId;
  } catch { return undefined; }
}

export async function initAdmin() {
  const emulator = process.env.FIRESTORE_EMULATOR_HOST;
  const projectId = argValue('--project') || process.env.FIREBASE_PROJECT_ID || (emulator ? 'demo-study-tracker' : await projectIdFromConfig());
  if (!projectId || /REPLACE/.test(projectId)) {
    throw new Error('No Firebase project ID. Fill in website/js/firebase-config.js or pass --project <id>.');
  }
  if (!emulator) {
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!credPath) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS is not set. Point it at the service-account JSON you downloaded (kept OUTSIDE this repo). See docs/firebase-setup.md.');
    }
    if (!existsSync(credPath)) throw new Error(`GOOGLE_APPLICATION_CREDENTIALS file not found: ${credPath}`);
    const rel = relative(repoRoot, resolve(credPath));
    if (!rel.startsWith('..') && !isAbsolute(rel)) {
      // A key inside the project is allowed only if git is guaranteed to ignore it.
      let ignored = false;
      try { execFileSync('git', ['check-ignore', '-q', rel], { cwd: repoRoot, stdio: 'ignore' }); ignored = true; } catch { ignored = false; }
      let tracked = false;
      try { execFileSync('git', ['ls-files', '--error-unmatch', rel], { cwd: repoRoot, stdio: 'ignore' }); tracked = true; } catch { tracked = false; }
      if (!ignored || tracked) {
        throw new Error(`Refusing to use "${rel}": it is inside the project but ${tracked ? 'tracked by git' : 'NOT git-ignored'}. Add it to .gitignore (or move it outside the project) first.`);
      }
      if (rel.startsWith('website')) throw new Error('Refusing to use a key inside website/ (that folder is published).');
    }
    const keyProject = JSON.parse(readFileSync(credPath, 'utf8')).project_id;
    if (keyProject && keyProject !== projectId) throw new Error(`Service account is for project "${keyProject}" but the target is "${projectId}".`);
  }
  const app = initializeApp(emulator ? { projectId } : { projectId, credential: applicationDefault() });
  const db = getFirestore(app);
  return { app, db, projectId, emulator: Boolean(emulator) };
}
