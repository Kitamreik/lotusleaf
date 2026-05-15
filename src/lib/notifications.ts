// Notifications: bi-weekly (1st & 15th) + monthly (last calendar day).
// Deterministic IDs so we never duplicate a given occurrence.
import { notifications, type Notification } from "./store";
import { getSettings, sendReminderEmail } from "./settings";

const EMAIL_SENT_KEY = "lotus.notif.emailed.v1";
function emailedSet(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(EMAIL_SENT_KEY) ?? "[]")); }
  catch { return new Set(); }
}
function markEmailed(id: string) {
  const s = emailedSet(); s.add(id);
  localStorage.setItem(EMAIL_SENT_KEY, JSON.stringify([...s].slice(-500)));
}

const BIWEEKLY_DAYS = [1, 15];

function lastDayOfMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate();
}

function id(prefix: string, y: number, m: number, d: number) {
  return `${prefix}-${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Create occurrences from 60 days back through 30 days ahead. */
export function ensureScheduledNotifications() {
  const now = new Date();
  const start = new Date(now); start.setDate(now.getDate() - 60);
  const end = new Date(now); end.setDate(now.getDate() + 30);

  const existing = new Set(notifications.list().map((n) => n.id));
  const additions: Notification[] = [];

  // iterate months
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();

    for (const day of BIWEEKLY_DAYS) {
      const occ = new Date(y, m, day);
      if (occ < start || occ > end) continue;
      const nid = id("biweekly", y, m, day);
      if (!existing.has(nid)) {
        additions.push({
          id: nid,
          type: "biweekly",
          title: "Bi-weekly bookkeeping check-in",
          body: "Reconcile recent expenses, log new revenue, and confirm CRM payments synced to the ledger.",
          link: "/app/bookkeeping",
          createdAt: Date.now(),
          dueAt: occ.getTime(),
        });
      }
    }

    const lastDay = lastDayOfMonth(y, m);
    const monthEnd = new Date(y, m, lastDay);
    if (monthEnd >= start && monthEnd <= end) {
      const nid = id("monthly", y, m, lastDay);
      if (!existing.has(nid)) {
        additions.push({
          id: nid,
          type: "monthly",
          title: "Monthly financial audit",
          body: "Review the period's Income Statement, Balance Sheet, and Cash Flow. Log an audit note when complete.",
          link: "/app/audits",
          createdAt: Date.now(),
          dueAt: monthEnd.getTime(),
        });
      }
    }

    cursor.setMonth(cursor.getMonth() + 1);
  }

  for (const n of additions) notifications.upsert(n);
  void maybeSendEmails();
}

/** Send an email for any active notification that hasn't been emailed yet. */
async function maybeSendEmails() {
  const s = getSettings();
  if (!s.emailReminders || !s.emailFnUrl || !s.reminderEmail) return;
  const sent = emailedSet();
  const now = Date.now();
  for (const n of notifications.list()) {
    if (n.dismissed) continue;
    if (n.dueAt > now) continue;
    if (sent.has(n.id)) continue;
    if (n.type === "biweekly" && !s.emailRemindersBiweekly) continue;
    if (n.type === "monthly" && !s.emailRemindersMonthly) continue;
    const link = n.link ? `${window.location.origin}${n.link}` : "";
    const r = await sendReminderEmail({
      to: s.reminderEmail,
      subject: `Kit TJ Services, LLC · ${n.title}`,
      body: `${n.body}\n\nOpen: ${link}`,
      type: n.type === "monthly" ? "monthly" : "biweekly",
    });
    if (r.ok) markEmailed(n.id);
  }
}

export function activeNotifications(): Notification[] {
  const now = Date.now();
  return notifications.list()
    .filter((n) => !n.dismissed && n.dueAt <= now)
    .sort((a, b) => b.dueAt - a.dueAt);
}

export function upcomingNotifications(): Notification[] {
  const now = Date.now();
  return notifications.list()
    .filter((n) => !n.dismissed && n.dueAt > now)
    .sort((a, b) => a.dueAt - b.dueAt);
}

export function dismissNotification(nid: string) {
  const n = notifications.get(nid);
  if (n) notifications.upsert({ ...n, dismissed: true, read: true });
}

export function markAllRead() {
  for (const n of notifications.list()) {
    if (!n.read) notifications.upsert({ ...n, read: true });
  }
}
