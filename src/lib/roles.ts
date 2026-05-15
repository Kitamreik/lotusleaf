// Internal-user allowlist + roles. Backed by the Firestore `allowlist`
// collection (doc id = lowercase email). Falls back to a hardcoded seed
// when Firestore is unreachable so the owner can always get in.
import { firebaseEnabled, fbDb } from "./firebase";
import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc,
} from "firebase/firestore";

export type Role = "owner" | "viewer";

export type AllowlistEntry = {
  email: string;        // lowercased
  role: Role;
  addedAt: number;
  note?: string;
};

// Seed — guarantees the owner can sign in even before Firestore is reachable.
export const SEED_ALLOWLIST: AllowlistEntry[] = [
  { email: "kitdamreik@gmail.com", role: "owner", addedAt: 0 },
  { email: "support@convohub.dev", role: "viewer", addedAt: 0 },
];

const COLL = "allowlist";
const LS_CACHE = "lotus.allowlist.cache.v1";

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

function readCache(): AllowlistEntry[] {
  if (typeof window === "undefined") return SEED_ALLOWLIST;
  try {
    const raw = localStorage.getItem(LS_CACHE);
    if (!raw) return SEED_ALLOWLIST;
    const parsed = JSON.parse(raw) as AllowlistEntry[];
    return Array.isArray(parsed) && parsed.length ? parsed : SEED_ALLOWLIST;
  } catch {
    return SEED_ALLOWLIST;
  }
}

function writeCache(items: AllowlistEntry[]) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(LS_CACHE, JSON.stringify(items)); } catch { /* noop */ }
}

/** Mask an email like `k***@gmail.com` for display in shared UIs. */
export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!user || !domain) return "***";
  const head = user.slice(0, 1);
  return `${head}${"*".repeat(Math.max(2, user.length - 1))}@${domain}`;
}

/** Check the in-memory cache only (synchronous). */
export function checkLocal(email: string): AllowlistEntry | null {
  const e = normalize(email);
  return readCache().find((x) => x.email === e) ?? null;
}

/** Pull the live allowlist from Firestore. Falls back to cache + seed. */
export async function fetchAllowlist(): Promise<AllowlistEntry[]> {
  if (!firebaseEnabled || !fbDb) return readCache();
  try {
    const snap = await getDocs(collection(fbDb, COLL));
    if (snap.empty) {
      // First-run seeding so the owner can log in.
      await Promise.all(
        SEED_ALLOWLIST.map((e) =>
          setDoc(doc(collection(fbDb!, COLL), e.email), e, { merge: true }),
        ),
      );
      writeCache(SEED_ALLOWLIST);
      return SEED_ALLOWLIST;
    }
    const items = snap.docs.map((d) => d.data() as AllowlistEntry);
    writeCache(items);
    return items;
  } catch (e) {
    console.warn("[allowlist] fetch failed, using cache:", e);
    return readCache();
  }
}

/** Authoritative check: reads Firestore (if reachable) before answering. */
export async function checkAllowlist(email: string): Promise<AllowlistEntry | null> {
  const e = normalize(email);
  if (firebaseEnabled && fbDb) {
    try {
      const ref = doc(collection(fbDb, COLL), e);
      const snap = await getDoc(ref);
      if (snap.exists()) return snap.data() as AllowlistEntry;
      // Try seeding then re-check (handles fresh project).
      await fetchAllowlist();
    } catch (err) {
      console.warn("[allowlist] check failed, using cache:", err);
    }
  }
  return checkLocal(e);
}

export async function addAllowlistEntry(email: string, role: Role, note?: string) {
  const entry: AllowlistEntry = {
    email: normalize(email),
    role,
    addedAt: Date.now(),
    note,
  };
  if (firebaseEnabled && fbDb) {
    await setDoc(doc(collection(fbDb, COLL), entry.email), entry, { merge: true });
  }
  const next = [...readCache().filter((x) => x.email !== entry.email), entry];
  writeCache(next);
  return entry;
}

export async function removeAllowlistEntry(email: string) {
  const e = normalize(email);
  if (firebaseEnabled && fbDb) {
    await deleteDoc(doc(collection(fbDb, COLL), e));
  }
  writeCache(readCache().filter((x) => x.email !== e));
}