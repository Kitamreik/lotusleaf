#!/usr/bin/env node
/**
 * Seed (or reset) the Firebase Auth user used by the /app walkthrough and the
 * e2e tests. Targets either the live Firebase project or the local Auth
 * emulator.
 *
 *   npm run seed:user                 # live project (needs service account)
 *   npm run seed:user:emulator        # local Auth emulator (no creds needed)
 *
 * Live mode requires ONE of:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *   FIREBASE_SERVICE_ACCOUNT='{"project_id":"...","client_email":"...","private_key":"..."}'
 *
 * Emulator mode just needs the emulator running:
 *   npm run emulator:auth
 */
import "dotenv/config";
import admin from "firebase-admin";

const useEmulator =
  process.argv.includes("--emulator") ||
  Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);

const email = process.env.TEST_EMAIL;
const password = process.env.TEST_PASSWORD;
const projectId =
  process.env.VITE_FIREBASE_PROJECT_ID ||
  process.env.FIREBASE_PROJECT_ID ||
  "demo-lotus";

if (!email || !password) {
  console.error("[seed] Missing TEST_EMAIL / TEST_PASSWORD in .env");
  process.exit(1);
}

if (useEmulator) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST =
    process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
  admin.initializeApp({ projectId });
  console.log(
    `[seed] Using Auth emulator at ${process.env.FIREBASE_AUTH_EMULATOR_HOST} (project: ${projectId})`,
  );
} else {
  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    // Common gotcha: escaped newlines in the private_key when stored as env.
    if (typeof parsed.private_key === "string") {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }
    credential = admin.credential.cert(parsed);
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    credential = admin.credential.applicationDefault();
  } else {
    console.error(
      "[seed] No admin credentials. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT,\n" +
        "       or pass --emulator to seed the local Auth emulator.",
    );
    process.exit(1);
  }
  admin.initializeApp({ credential, projectId });
  console.log(`[seed] Using live Firebase project: ${projectId}`);
}

const auth = admin.auth();

try {
  let user;
  try {
    user = await auth.getUserByEmail(email);
    await auth.updateUser(user.uid, { password, emailVerified: true, disabled: false });
    console.log(`[seed] Updated existing user ${email} (uid=${user.uid})`);
  } catch (err) {
    if (err && err.code === "auth/user-not-found") {
      user = await auth.createUser({ email, password, emailVerified: true });
      console.log(`[seed] Created user ${email} (uid=${user.uid})`);
    } else {
      throw err;
    }
  }
  process.exit(0);
} catch (err) {
  console.error("[seed] Failed:", err?.message || err);
  process.exit(1);
}
