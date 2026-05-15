// Firebase is optional. The app works fully offline via localStorage.
// Configure via .env (see .env.example) — for production, mirror keys into
// Workspace Settings → Build Secrets. Firebase web config keys are publishable.
//
// NOTE on "SQL Connect": Firebase Data Connect / Cloud SQL is a server-side
// product that requires a deployed connector + generated SDK; it cannot be
// wired purely from the browser. We expose `dataConnectConfigured` so the UI
// can surface status, but no client SDK is auto-bound.

import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getDatabase, type Database } from "firebase/database";

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string | undefined,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL as string | undefined,
};

// === Startup validation ===
// We treat these six as required for ANY Firebase service. If even one is
// missing, we keep the app running on localStorage and surface a clear error
// so the operator can fix the env without staring at cryptic SDK stack traces.
const REQUIRED = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
] as const;
const required: Record<string, string | undefined> = {
  VITE_FIREBASE_API_KEY: cfg.apiKey,
  VITE_FIREBASE_AUTH_DOMAIN: cfg.authDomain,
  VITE_FIREBASE_PROJECT_ID: cfg.projectId,
  VITE_FIREBASE_STORAGE_BUCKET: cfg.storageBucket,
  VITE_FIREBASE_MESSAGING_SENDER_ID: cfg.messagingSenderId,
  VITE_FIREBASE_APP_ID: cfg.appId,
};
export const missingFirebaseVars: string[] = REQUIRED.filter(
  (k) => !required[k] || String(required[k]).trim() === "",
);
export const firebaseConfigValid = missingFirebaseVars.length === 0;

if (typeof window !== "undefined" && missingFirebaseVars.length > 0 && missingFirebaseVars.length < REQUIRED.length) {
  // Partial config is almost certainly a misconfiguration — warn loudly.
  console.warn(
    `[firebase] Skipping init — missing env var(s): ${missingFirebaseVars.join(", ")}.\n` +
    `Copy .env.example to .env, fill in the values, then restart the dev server. ` +
    `For production, add the same keys in Workspace Settings → Build Secrets.`,
  );
}

export const firebaseEnabled = firebaseConfigValid;
export const rtdbEnabled = Boolean(firebaseEnabled && cfg.databaseURL);
export const storageEnabled = Boolean(firebaseEnabled && cfg.storageBucket);
export const dataConnectConfigured = Boolean(
  import.meta.env.VITE_FIREBASE_DATA_CONNECT_SERVICE,
);

let app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _storage: FirebaseStorage | null = null;
let _rtdb: Database | null = null;
let _initError: string | null = null;

if (firebaseEnabled) {
  try {
    app = initializeApp(cfg as Record<string, string>);
    _auth = getAuth(app);
    _db = getFirestore(app);
    if (storageEnabled) _storage = getStorage(app);
    if (rtdbEnabled) _rtdb = getDatabase(app);
  } catch (e) {
    _initError = (e as Error).message ?? String(e);
    console.warn("[firebase] init failed; falling back to localStorage:", _initError);
    app = null; _auth = null; _db = null; _storage = null; _rtdb = null;
  }
}

export const fbApp = app;
export const fbAuth = _auth;
export const fbDb = _db;
export const fbStorage = _storage;
export const fbRtdb = _rtdb;
export const firebaseInitError = _initError;

export function firebaseStatus() {
  return {
    configValid: firebaseConfigValid,
    missingVars: missingFirebaseVars,
    initError: _initError,
    auth: Boolean(_auth),
    firestore: Boolean(_db),
    storage: Boolean(_storage),
    realtimeDb: Boolean(_rtdb),
    dataConnect: dataConnectConfigured,
  };
}
