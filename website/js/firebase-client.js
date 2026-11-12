// Firebase backend: one app, one auth instance, one Firestore instance.
// Uses the official modular Web SDK as browser ES modules (pinned version).
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import {
  getAuth, signInAnonymously, onAuthStateChanged, connectAuthEmulator,
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import {
  getFirestore, doc, collection, onSnapshot, writeBatch, serverTimestamp, query, orderBy, limit,
  Timestamp, connectFirestoreEmulator,
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';
import { WORKSPACE_ID } from './config.js';
import { SERVER_TIME } from './store.js';

export const SDK_VERSION = '13.1.0';

let app; let auth; let db;

export function isConfigUsable(cfg) {
  return Boolean(cfg && typeof cfg === 'object' && cfg.apiKey && cfg.projectId && cfg.appId
    && !/REPLACE|YOUR_|xxx/i.test(`${cfg.apiKey}${cfg.projectId}${cfg.appId}`));
}

/** Local-only emulator config (used by tests via ?emulator on localhost). */
export const EMULATOR_CONFIG = {
  apiKey: 'demo-api-key', authDomain: 'demo-study-tracker.firebaseapp.com', projectId: 'demo-study-tracker', appId: 'demo-app',
};

export function createFirebaseBackend(config, { emulator = false } = {}) {
  app = initializeApp(config);
  auth = getAuth(app);
  db = getFirestore(app);
  if (emulator) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8180);
  }

  function toPlain(snapDoc) {
    const data = snapDoc.data({ serverTimestamps: 'estimate' }) || {};
    const out = { id: snapDoc.id };
    for (const [k, v] of Object.entries(data)) out[k] = v instanceof Timestamp ? v.toMillis() : v;
    return out;
  }

  function encode(data) {
    const out = {};
    for (const [k, v] of Object.entries(data)) out[k] = v === SERVER_TIME ? serverTimestamp() : v;
    return out;
  }

  const wsRef = () => doc(db, 'workspaces', WORKSPACE_ID);
  const sub = (name) => collection(db, 'workspaces', WORKSPACE_ID, name);

  return {
    kind: 'firebase',

    /** Silent anonymous sign-in; resolves with the UID (restored if this browser has one). */
    signIn() {
      return new Promise((resolve, reject) => {
        const off = onAuthStateChanged(auth, (user) => {
          if (user) { off(); resolve(user.uid); }
        }, (e) => { off(); reject(e); });
        signInAnonymously(auth).catch((e) => { off(); reject(e); });
      });
    },

    /** Live approval status for this device's UID. cb(approved, error) */
    watchApproval(uid, cb) {
      return onSnapshot(doc(db, 'approvedDevices', uid), (snap) => cb(snap.exists(), null), (e) => cb(false, e));
    },

    /** Subscribe to every collection the app needs. Returns an unsubscribe function. */
    subscribeAll({ onData, onError }) {
      const opts = { includeMetadataChanges: true };
      const offs = [];
      offs.push(onSnapshot(wsRef(), opts, (snap) => {
        onData('workspace', snap.exists() ? toPlain(snap) : null, snap.metadata);
      }, (e) => onError('workspace', e)));
      for (const name of ['topics', 'sessions', 'progress', 'checks', 'discussions']) {
        offs.push(onSnapshot(sub(name), opts, (snap) => {
          onData(name, snap.docs.map(toPlain), snap.metadata);
        }, (e) => onError(name, e)));
      }
      offs.push(onSnapshot(query(sub('activity'), orderBy('createdAt', 'desc'), limit(30)), opts, (snap) => {
        onData('activity', snap.docs.map(toPlain), snap.metadata);
      }, (e) => onError('activity', e)));
      return () => offs.forEach((off) => off());
    },

    newId(name) { return doc(sub(name)).id; },

    /** Atomic batch. ops: [{ op: 'set'|'update'|'delete', col: name|null, id, data }] (col null = workspace doc). */
    async write(ops) {
      const batch = writeBatch(db);
      for (const o of ops) {
        const ref = o.col ? doc(db, 'workspaces', WORKSPACE_ID, o.col, o.id) : wsRef();
        if (o.op === 'set') batch.set(ref, encode(o.data));
        else if (o.op === 'update') batch.update(ref, encode(o.data));
        else if (o.op === 'delete') batch.delete(ref);
      }
      await batch.commit();
    },
  };
}
