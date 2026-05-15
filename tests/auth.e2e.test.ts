/**
 * End-to-end test: Firebase email/password sign-in.
 *
 * Two modes:
 *   1. Live (default): hits the real Firebase project from VITE_FIREBASE_* env.
 *   2. Emulator: when FIREBASE_AUTH_EMULATOR_HOST is set (e.g. "127.0.0.1:9099"),
 *      points the Web SDK at the local Auth emulator and auto-creates the
 *      TEST_EMAIL / TEST_PASSWORD user via the emulator's signUp endpoint
 *      before running the sign-in assertions. Run with:
 *
 *        npm run test:e2e:emulator
 *
 * Skips (rather than fails) when required env vars aren't set, so CI stays
 * green when secrets aren't configured.
 */
import { describe, it, expect, beforeAll } from "vitest";
import dotenv from "dotenv";
import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

dotenv.config();

const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const useEmulator = Boolean(emulatorHost);

// In emulator mode the apiKey is unused but must be a non-empty string.
const cfg = useEmulator
  ? {
      apiKey: "fake-api-key",
      authDomain: "localhost",
      projectId:
        process.env.VITE_FIREBASE_PROJECT_ID ||
        process.env.FIREBASE_PROJECT_ID ||
        "demo-lotus",
      storageBucket: "demo-lotus.appspot.com",
      messagingSenderId: "0",
      appId: "1:0:web:0",
    }
  : {
      apiKey: process.env.VITE_FIREBASE_API_KEY,
      authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.VITE_FIREBASE_APP_ID,
    };

const email = process.env.TEST_EMAIL;
const password = process.env.TEST_PASSWORD;

const required = useEmulator
  ? { TEST_EMAIL: email, TEST_PASSWORD: password }
  : { ...cfg, TEST_EMAIL: email, TEST_PASSWORD: password };
const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
const ready = missing.length === 0;
const maybe = ready ? it : it.skip;

function emulatorUrl() {
  return `http://${emulatorHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`;
}

async function seedEmulatorUser() {
  // Idempotent: ignore EMAIL_EXISTS so re-runs work.
  const res = await fetch(emulatorUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: false }),
  });
  if (res.ok) return;
  const body = await res.json().catch(() => ({}));
  const code = body?.error?.message || "";
  if (code.includes("EMAIL_EXISTS")) return;
  throw new Error(`Failed to seed emulator user: ${res.status} ${JSON.stringify(body)}`);
}

describe(`Firebase email/password sign-in (${useEmulator ? "emulator" : "live"})`, () => {
  if (!ready) {
    // eslint-disable-next-line no-console
    console.warn(
      `[e2e] Skipping sign-in test. Missing env: ${missing.join(", ")}.\n` +
        (useEmulator
          ? `Add TEST_EMAIL and TEST_PASSWORD to .env to enable emulator tests.`
          : `Add TEST_EMAIL/TEST_PASSWORD and all VITE_FIREBASE_* to .env, ` +
            `or set FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 for emulator mode.`),
    );
  }

  beforeAll(async () => {
    if (ready && useEmulator) await seedEmulatorUser();
  });

  maybe("signs in with valid credentials and signs back out", async () => {
    const app = initializeApp(cfg as Record<string, string>, `e2e-${Date.now()}`);
    const auth = getAuth(app);
    if (useEmulator) connectAuthEmulator(auth, `http://${emulatorHost}`, { disableWarnings: true });
    try {
      const cred = await signInWithEmailAndPassword(auth, email!, password!);
      expect(cred.user).toBeTruthy();
      expect(cred.user.email?.toLowerCase()).toBe(email!.toLowerCase());
      expect(typeof (await cred.user.getIdToken())).toBe("string");
      await signOut(auth);
      expect(auth.currentUser).toBeNull();
    } finally {
      await deleteApp(app);
    }
  }, 30_000);

  maybe("rejects an obviously wrong password", async () => {
    const app = initializeApp(cfg as Record<string, string>, `e2e-bad-${Date.now()}`);
    const auth = getAuth(app);
    if (useEmulator) connectAuthEmulator(auth, `http://${emulatorHost}`, { disableWarnings: true });
    try {
      await expect(
        signInWithEmailAndPassword(auth, email!, `${password}-definitely-wrong`),
      ).rejects.toThrow();
    } finally {
      await deleteApp(app);
    }
  }, 30_000);
});
