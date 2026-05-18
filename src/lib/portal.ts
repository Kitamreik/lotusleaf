// Client Portal store. localStorage-first with optional Firestore mirror
// (using the existing pattern). Each client can be invited via:
//   - email + password (Firebase Auth account, if configured), OR
//   - magic-link token (?t=<token>) for one-off shares.
// Documents and signatures live alongside the client record.
import { firebaseEnabled, fbDb } from "./firebase";
import { collection, doc, setDoc, deleteDoc, getDocs } from "firebase/firestore";
import { logAudit } from "./security";

export type PortalDoc = {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl: string;
  uploadedAt: number;
  uploadedBy: "admin" | "client";
  // For "report"-style docs published by the admin to the client
  kind: "upload" | "report";
};

export type PortalSignatureRequest = {
  id: string;
  documentName: string;
  body: string;        // statement the client agrees to
  createdAt: number;
  signedAt?: number;
  signatureDataUrl?: string;
  signerName?: string;
  signerIp?: string;   // captured client-side via best-effort fetch
  signerHash?: string; // sha-256 of (signerName + body + signatureDataUrl)
};

export type PortalClient = {
  id: string;
  name: string;
  email: string;
  token: string;          // magic-link token
  createdAt: number;
  documents: PortalDoc[];
  signatures: PortalSignatureRequest[];
  archived?: boolean;
};

const KEY = "lotus.portal.clients.v1";
const COLL = "portal_clients";

function read(): PortalClient[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PortalClient[]) : [];
  } catch { return []; }
}
function write(items: PortalClient[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(`lotus:${KEY}`));
}

async function mirror(c: PortalClient) {
  if (!firebaseEnabled || !fbDb) return;
  try { await setDoc(doc(collection(fbDb, COLL), c.id), c, { merge: true }); }
  catch (e) { console.warn("portal mirror failed", e); }
}
async function mirrorDel(id: string) {
  if (!firebaseEnabled || !fbDb) return;
  try { await deleteDoc(doc(collection(fbDb, COLL), id)); }
  catch (e) { console.warn("portal delete failed", e); }
}

function makeToken() {
  // 32-char base36 token; not Firebase-grade, but acceptable for share links.
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 32);
}

export const portal = {
  list: () => read(),
  get: (id: string) => read().find((c) => c.id === id),
  byToken: (t: string) => read().find((c) => c.token === t && !c.archived),
  byEmail: (e: string) => read().find((c) => c.email.toLowerCase() === e.toLowerCase() && !c.archived),

  invite(name: string, email: string): PortalClient {
    const existing = read().find((c) => c.email.toLowerCase() === email.toLowerCase());
    if (existing) return existing;
    const c: PortalClient = {
      id: `pc-${Math.random().toString(36).slice(2, 10)}`,
      name,
      email: email.toLowerCase(),
      token: makeToken(),
      createdAt: Date.now(),
      documents: [],
      signatures: [],
    };
    const list = read(); list.unshift(c); write(list);
    void mirror(c);
    logAudit("portal.client.invite", c.email);
    return c;
  },

  upsert(c: PortalClient) {
    const list = read();
    const i = list.findIndex((x) => x.id === c.id);
    if (i >= 0) list[i] = c; else list.unshift(c);
    write(list);
    void mirror(c);
  },

  remove(id: string) {
    const next = read().filter((c) => c.id !== id);
    write(next);
    void mirrorDel(id);
    logAudit("portal.client.delete", id);
  },

  rotateToken(id: string) {
    const c = read().find((x) => x.id === id);
    if (!c) return null;
    c.token = makeToken();
    portal.upsert(c);
    logAudit("portal.client.rotate_token", id);
    return c.token;
  },

  addDocument(clientId: string, d: Omit<PortalDoc, "id" | "uploadedAt">) {
    const c = portal.get(clientId);
    if (!c) return;
    const full: PortalDoc = { ...d, id: `doc-${Math.random().toString(36).slice(2, 10)}`, uploadedAt: Date.now() };
    c.documents = [full, ...c.documents];
    portal.upsert(c);
    logAudit(`portal.doc.${d.kind === "report" ? "report.publish" : "upload"}`, `${c.email} :: ${d.name}`);
  },

  removeDocument(clientId: string, docId: string) {
    const c = portal.get(clientId);
    if (!c) return;
    c.documents = c.documents.filter((d) => d.id !== docId);
    portal.upsert(c);
    logAudit("portal.doc.delete", `${clientId} :: ${docId}`);
  },

  requestSignature(clientId: string, documentName: string, body: string) {
    const c = portal.get(clientId);
    if (!c) return;
    const req: PortalSignatureRequest = {
      id: `sig-${Math.random().toString(36).slice(2, 10)}`,
      documentName, body,
      createdAt: Date.now(),
    };
    c.signatures = [req, ...c.signatures];
    portal.upsert(c);
    logAudit("portal.signature.request", `${c.email} :: ${documentName}`);
  },

  async recordSignature(
    clientId: string,
    sigId: string,
    payload: { signerName: string; signatureDataUrl: string },
  ) {
    const c = portal.get(clientId);
    if (!c) return;
    const sig = c.signatures.find((s) => s.id === sigId);
    if (!sig || sig.signedAt) return;
    sig.signedAt = Date.now();
    sig.signerName = payload.signerName;
    sig.signatureDataUrl = payload.signatureDataUrl;
    // IP capture intentionally omitted: third-party lookups (e.g. ipify)
    // leak signer IPs to external services. Signer name + signature image +
    // body hash + timestamp provide a sufficient audit record. If IP is
    // needed, capture it server-side from the request in a future API route.
    try {
      const data = `${payload.signerName}|${sig.body}|${payload.signatureDataUrl}|${sig.signedAt}`;
      const buf = new TextEncoder().encode(data);
      const hash = await crypto.subtle.digest("SHA-256", buf);
      sig.signerHash = Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch { /* ignore */ }
    portal.upsert(c);
    logAudit("portal.signature.signed", `${c.email} :: ${sig.documentName}`);
  },
};

export const PORTAL_FILE_RULES = {
  maxPerFile: 10 * 1024 * 1024, // 10 MB
  allowed: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "text/csv", "text/plain",
    "image/png", "image/jpeg", "image/webp",
  ],
};

export function validatePortalFile(file: File): string | null {
  if (file.size > PORTAL_FILE_RULES.maxPerFile) return `${file.name}: exceeds 10 MB`;
  if (!PORTAL_FILE_RULES.allowed.includes(file.type)) return `${file.name}: type not allowed`;
  return null;
}
