// TEMPLATE. Copy the values from Firebase Console → Project settings → General
// → Your apps → (Web app) → SDK setup and configuration → "Config", into
// website/js/firebase-config.js.
//
// These values are PUBLIC identifiers, not secrets: every visitor's browser
// receives them. Access to data is controlled by firestore.rules (approved
// device allowlist), NOT by hiding this config.
//
// NEVER put a service-account JSON, private key or admin credential here.

export const firebaseConfig = {
  apiKey: 'REPLACE_WITH_API_KEY',
  authDomain: 'REPLACE_WITH_PROJECT_ID.firebaseapp.com',
  projectId: 'REPLACE_WITH_PROJECT_ID',
  storageBucket: 'REPLACE_WITH_PROJECT_ID.firebasestorage.app',
  messagingSenderId: 'REPLACE_WITH_SENDER_ID',
  appId: 'REPLACE_WITH_APP_ID',
};
