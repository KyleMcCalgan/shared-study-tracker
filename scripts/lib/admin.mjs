// Owner-only Firebase Admin SDK initialisation for local scripts.
// Credentials come from GOOGLE_APPLICATION_CREDENTIALS (a service-account JSON
// stored OUTSIDE this repository) or, for tests, FIRESTORE_EMULATOR_HOST.
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
      throw new Error('Refusing to use a service-account key stored inside the repository. Move it outside the project folder (e.g. %USERPROFILE%\\.secrets\\).');
    }
    const keyProject = JSON.parse(readFileSync(credPath, 'utf8')).project_id;
    if (keyProject && keyProject !== projectId) throw new Error(`Service account is for project "${keyProject}" but the target is "${projectId}".`);
  }
  const app = initializeApp(emulator ? { projectId } : { projectId, credential: applicationDefault() });
  const db = getFirestore(app);
  return { app, db, projectId, emulator: Boolean(emulator) };
}
