// User settings (single admin). Persisted in localStorage; mirrored to Firestore if enabled.
import { firebaseEnabled, fbDb } from "./firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";

export type Settings = {
  emailReminders: boolean;        // master toggle (on by default)
  emailRemindersBiweekly: boolean;
  emailRemindersMonthly: boolean;
  reminderEmail: string;          // destination
  emailFnUrl: string;             // Firebase HTTPS callable / function endpoint (optional)
  emailFnSecret: string;          // shared secret sent in `x-app-secret` header
};

const KEY = "lotus.settings.v1";

export const DEFAULT_SETTINGS: Settings = {
  emailReminders: true,
  emailRemindersBiweekly: true,
  emailRemindersMonthly: true,
  reminderEmail: "",
  emailFnUrl: (import.meta.env.VITE_FIREBASE_EMAIL_FN_URL as string) ?? "",
  emailFnSecret: "",
};

// SECURITY: emailFnSecret is a shared secret. We deliberately:
//  - never persist it to Firestore (any reader of `settings/admin` could exfiltrate it),
//  - never persist it to localStorage (XSS / shared-device exposure).
// It lives only in memory for the current tab and must be re-entered after reload.
let inMemorySecret = "";

export function getSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY);
    const persisted = raw ? JSON.parse(raw) : {};
    // Defensive: drop any legacy persisted secret.
    if (persisted && typeof persisted === "object" && "emailFnSecret" in persisted) {
      delete (persisted as Record<string, unknown>).emailFnSecret;
      localStorage.setItem(KEY, JSON.stringify(persisted));
    }
    return { ...DEFAULT_SETTINGS, ...persisted, emailFnSecret: inMemorySecret };
  } catch { return { ...DEFAULT_SETTINGS, emailFnSecret: inMemorySecret }; }
}

export function saveSettings(s: Settings) {
  inMemorySecret = s.emailFnSecret ?? "";
  // Strip the secret from anything written to disk or to the cloud.
  const { emailFnSecret: _omit, ...safe } = s;
  void _omit;
  localStorage.setItem(KEY, JSON.stringify(safe));
  window.dispatchEvent(new CustomEvent("lotus:settings"));
  if (firebaseEnabled && fbDb) {
    setDoc(doc(fbDb, "settings", "admin"), safe, { merge: true }).catch(() => {});
  }
}

export async function pullSettingsFromCloud(): Promise<Settings | null> {
  if (!firebaseEnabled || !fbDb) return null;
  try {
    const snap = await getDoc(doc(fbDb, "settings", "admin"));
    if (!snap.exists()) return null;
    const data = snap.data() as Partial<Settings>;
    // Never trust a cloud-stored secret — always overlay the in-memory one.
    delete (data as Record<string, unknown>).emailFnSecret;
    const s: Settings = { ...DEFAULT_SETTINGS, ...data, emailFnSecret: inMemorySecret };
    const { emailFnSecret: _omit, ...safe } = s;
    void _omit;
    localStorage.setItem(KEY, JSON.stringify(safe));
    return s;
  } catch { return null; }
}

export function emailRemindersAvailable(s = getSettings()): boolean {
  return Boolean(s.emailFnUrl && s.reminderEmail);
}

/**
 * Send an email via a user-deployed Firebase HTTPS function.
 * Expected request body: { to, subject, body, type }.
 * The function is responsible for actually sending mail (e.g. via SendGrid / Mailgun /
 * Firebase "Trigger Email" extension by writing to a `mail` collection).
 */
export async function sendReminderEmail(payload: {
  to: string; subject: string; body: string; type: "biweekly" | "monthly" | "test";
}): Promise<{ ok: boolean; error?: string }> {
  const s = getSettings();
  if (!s.emailReminders) return { ok: false, error: "Email reminders disabled" };
  if (!s.emailFnUrl) return { ok: false, error: "No email function configured" };
  try {
    const r = await fetch(s.emailFnUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(s.emailFnSecret ? { "x-app-secret": s.emailFnSecret } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
