import DOMPurify from "dompurify";

export function sanitize(input: string): string {
  if (typeof window === "undefined") return input;
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

export function safeText(input: unknown, max = 5000): string {
  const s = String(input ?? "").slice(0, max);
  return sanitize(s).trim();
}

export type AuditEvent = {
  id: string;
  ts: number;
  actor: string;
  action: string;
  target?: string;
  meta?: Record<string, unknown>;
};

const AUDIT_KEY = "lotus.audit.v1";
const MAX_AUDIT = 1000;

export function logAudit(action: string, target?: string, meta?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  try {
    const actor = localStorage.getItem("lotus.session.email") ?? "anonymous";
    const evt: AuditEvent = {
      id: crypto.randomUUID(),
      ts: Date.now(),
      actor,
      action: safeText(action, 120),
      target: target ? safeText(target, 200) : undefined,
      meta,
    };
    const raw = localStorage.getItem(AUDIT_KEY);
    const list: AuditEvent[] = raw ? JSON.parse(raw) : [];
    list.unshift(evt);
    localStorage.setItem(AUDIT_KEY, JSON.stringify(list.slice(0, MAX_AUDIT)));
  } catch {
    /* ignore */
  }
}

export function getAuditLog(): AuditEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(AUDIT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearAuditLog() {
  localStorage.removeItem(AUDIT_KEY);
}

// Simple rate limiter for sensitive actions (login)
const RL_KEY = "lotus.rl.v1";
export function rateLimit(bucket: string, maxAttempts = 5, windowMs = 60_000): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(RL_KEY);
    const map: Record<string, number[]> = raw ? JSON.parse(raw) : {};
    const now = Date.now();
    const arr = (map[bucket] ?? []).filter((t) => now - t < windowMs);
    if (arr.length >= maxAttempts) return false;
    arr.push(now);
    map[bucket] = arr;
    localStorage.setItem(RL_KEY, JSON.stringify(map));
    return true;
  } catch {
    return true;
  }
}

// Stricter sliding-window lockout for high-value secrets (e.g. portal magic-link
// tokens). After `maxAttempts` failures within `windowMs`, the bucket is locked
// for `lockoutMs`. Successful attempts should call `clearLockout(bucket)`.
const LOCK_KEY = "lotus.lock.v1";
type LockState = { fails: number[]; until?: number };

function readLocks(): Record<string, LockState> {
  try { return JSON.parse(localStorage.getItem(LOCK_KEY) ?? "{}"); } catch { return {}; }
}
function writeLocks(m: Record<string, LockState>) {
  try { localStorage.setItem(LOCK_KEY, JSON.stringify(m)); } catch { /* ignore */ }
}

export function checkLockout(
  bucket: string,
  opts: { maxAttempts?: number; windowMs?: number; lockoutMs?: number } = {},
): { allowed: boolean; retryAfterMs: number } {
  if (typeof window === "undefined") return { allowed: true, retryAfterMs: 0 };
  const now = Date.now();
  const map = readLocks();
  const s = map[bucket];
  if (s?.until && s.until > now) return { allowed: false, retryAfterMs: s.until - now };
  return { allowed: true, retryAfterMs: 0 };
}

export function recordFailure(
  bucket: string,
  opts: { maxAttempts?: number; windowMs?: number; lockoutMs?: number } = {},
): { allowed: boolean; retryAfterMs: number; remaining: number } {
  const maxAttempts = opts.maxAttempts ?? 5;
  const windowMs = opts.windowMs ?? 15 * 60_000;
  const lockoutMs = opts.lockoutMs ?? 60 * 60_000;
  if (typeof window === "undefined") return { allowed: true, retryAfterMs: 0, remaining: maxAttempts };
  const now = Date.now();
  const map = readLocks();
  const s: LockState = map[bucket] ?? { fails: [] };
  if (s.until && s.until > now) {
    return { allowed: false, retryAfterMs: s.until - now, remaining: 0 };
  }
  s.fails = s.fails.filter((t) => now - t < windowMs);
  s.fails.push(now);
  if (s.fails.length >= maxAttempts) {
    s.until = now + lockoutMs;
    s.fails = [];
  }
  map[bucket] = s;
  writeLocks(map);
  const remaining = Math.max(0, maxAttempts - s.fails.length);
  return s.until && s.until > now
    ? { allowed: false, retryAfterMs: s.until - now, remaining: 0 }
    : { allowed: true, retryAfterMs: 0, remaining };
}

export function clearLockout(bucket: string) {
  if (typeof window === "undefined") return;
  const map = readLocks();
  delete map[bucket];
  writeLocks(map);
}
