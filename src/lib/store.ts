// localStorage-first store with optional Firestore mirror.
import { firebaseEnabled, fbDb } from "./firebase";
import { collection, doc, setDoc, deleteDoc, getDocs } from "firebase/firestore";
import { logAudit } from "./security";

export type CaseFile = {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl: string;
  addedAt: number;
  archivedAt?: number;
};

export type Case = {
  id: string;
  client: string;
  theme: "Consulting" | "DEI" | "Education" | "Facilitation" | "Workshops" | "Systems Work";
  status: "Lead" | "In Progress" | "On Hold" | "Completed" | "Archived";
  amount: number;
  paymentStatus: "Unpaid" | "Partial" | "Paid";
  paymentReceived: number;
  paymentDate?: string; // ISO date
  notes: string;
  createdAt: number;
  updatedAt: number;
  archived?: boolean;
  archivedAt?: number;
  files?: CaseFile[];
};

export type ExpenseCategory =
  | "Permits and Licensing"
  | "Equipment and Maintenance"
  | "Domain Hosting and Email"
  | "Software and Platforms"
  | "Marketing and Advertising"
  | "Other";

export type LedgerEntry = {
  id: string;
  date: string;
  type: "income" | "expense";
  category: ExpenseCategory | "Revenue" | "Other Income";
  description: string;
  amount: number;
  source?: "manual" | "crm";
  caseId?: string; // back-reference to CRM case
  createdAt: number;
  updatedAt?: number;
};

export type Asset = { id: string; name: string; value: number; date: string };
export type Liability = { id: string; name: string; value: number; date: string };
export type Equity = { id: string; name: string; value: number; date: string };
export type AuditNote = { id: string; date: string; note: string; passed: boolean; createdAt: number };

export type Notification = {
  id: string;            // deterministic per occurrence: e.g. "biweekly-2026-05-01"
  type: "biweekly" | "monthly" | "system";
  title: string;
  body: string;
  link?: string;
  createdAt: number;
  dueAt: number;
  dismissed?: boolean;
  read?: boolean;
};

const KEYS = {
  cases: "lotus.cases.v1",
  ledger: "lotus.ledger.v1",
  assets: "lotus.assets.v1",
  liabilities: "lotus.liabilities.v1",
  equity: "lotus.equity.v1",
  audits: "lotus.audits.v1",
  notif: "lotus.notif.v1",
} as const;

function read<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch { return []; }
}
function write<T>(key: string, items: T[]) {
  localStorage.setItem(key, JSON.stringify(items));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(`lotus:${key}`));
  }
}

async function mirrorSet(coll: string, id: string, data: object) {
  if (!firebaseEnabled || !fbDb) return;
  try { await setDoc(doc(collection(fbDb, coll), id), data, { merge: true }); }
  catch (e) { console.warn("Firestore mirror failed", e); }
}
async function mirrorDel(coll: string, id: string) {
  if (!firebaseEnabled || !fbDb) return;
  try { await deleteDoc(doc(collection(fbDb, coll), id)); }
  catch (e) { console.warn("Firestore delete failed", e); }
}

function makeStore<T extends { id: string }>(key: string, coll: string) {
  return {
    list: () => read<T>(key),
    get: (id: string) => read<T>(key).find((i) => i.id === id),
    upsert: (item: T) => {
      const items = read<T>(key);
      const idx = items.findIndex((i) => i.id === item.id);
      if (idx >= 0) items[idx] = item;
      else items.unshift(item);
      write(key, items);
      mirrorSet(coll, item.id, item as unknown as object);
      logAudit(`${coll}.upsert`, item.id);
      return item;
    },
    remove: (id: string) => {
      const items = read<T>(key).filter((i) => i.id !== id);
      write(key, items);
      mirrorDel(coll, id);
      logAudit(`${coll}.delete`, id);
    },
    bulkSet: (items: T[]) => write(key, items),
    pullCloud: async () => {
      if (!firebaseEnabled || !fbDb) return;
      try {
        const snap = await getDocs(collection(fbDb, coll));
        const items = snap.docs.map((d) => d.data() as T);
        if (items.length) write(key, items);
      } catch (e) { console.warn("pullCloud failed", e); }
    },
    storageKey: key,
  };
}

export const cases = makeStore<Case>(KEYS.cases, "cases");
export const ledger = makeStore<LedgerEntry>(KEYS.ledger, "ledger");
export const assets = makeStore<Asset>(KEYS.assets, "assets");
export const liabilities = makeStore<Liability>(KEYS.liabilities, "liabilities");
export const equityStore = makeStore<Equity>(KEYS.equity, "equity");
export const audits = makeStore<AuditNote>(KEYS.audits, "audits");
export const notifications = makeStore<Notification>(KEYS.notif, "notifications");

// === CRM ↔ Ledger mapping ===
// Deterministic id so updates to a case payment update the SAME ledger entry.
export const ledgerIdForCase = (caseId: string) => `crm:${caseId}`;

export function syncCaseToLedger(c: Case) {
  const id = ledgerIdForCase(c.id);
  const existing = ledger.get(id);
  if (c.paymentReceived <= 0) {
    if (existing) ledger.remove(id);
    return;
  }
  const entry: LedgerEntry = {
    id,
    date: c.paymentDate ?? new Date(c.updatedAt).toISOString().slice(0, 10),
    type: "income",
    category: "Revenue",
    description: `[${c.theme}] ${c.client}`,
    amount: c.paymentReceived,
    source: "crm",
    caseId: c.id,
    createdAt: existing?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
  };
  ledger.upsert(entry);
}

export function removeCaseLedger(caseId: string) {
  ledger.remove(ledgerIdForCase(caseId));
}

// File rules
export const FILE_RULES = {
  maxPerFile: 5 * 1024 * 1024, // 5MB
  maxPerCase: 25 * 1024 * 1024, // 25MB total
  allowed: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "text/csv",
    "text/plain",
    "image/png",
    "image/jpeg",
    "image/webp",
  ],
  allowedExtNote: "PDF, DOC(X), XLS(X), CSV, TXT, PNG, JPG, WEBP",
};

export function validateFile(file: File, currentTotal: number): string | null {
  if (file.size > FILE_RULES.maxPerFile) return `${file.name}: exceeds 5MB`;
  if (currentTotal + file.size > FILE_RULES.maxPerCase) return `${file.name}: case exceeds 25MB total`;
  if (!FILE_RULES.allowed.includes(file.type)) return `${file.name}: type not allowed`;
  return null;
}

export function caseFileTotal(c: Case): number {
  return (c.files ?? []).reduce((s, f) => s + f.size, 0);
}
