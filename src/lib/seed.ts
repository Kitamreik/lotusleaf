// Demo / test data seeding. Triggered manually from Settings.
// Every record is tagged with `seed: true` so wipe is targeted and never
// removes real user data.
import {
  cases, ledger, assets, liabilities, equityStore, audits, notifications,
  syncCaseToLedger, type Case, type LedgerEntry, type AuditNote,
  type Asset, type Liability, type Equity, type Notification,
} from "./store";
import { logAudit } from "./security";

const SEED_TAG = "[SEED]";

function uid(prefix: string) {
  return `seed-${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function isoDaysAgo(d: number) {
  const dt = new Date();
  dt.setDate(dt.getDate() - d);
  return dt.toISOString().slice(0, 10);
}

export function seedDemoData() {
  const now = Date.now();

  const demoCases: Case[] = [
    {
      id: uid("case"),
      client: `${SEED_TAG} Acme Coop`,
      theme: "Consulting",
      status: "Completed",
      amount: 8500,
      paymentReceived: 8500,
      paymentStatus: "Paid",
      paymentDate: isoDaysAgo(20),
      notes: "Org redesign engagement.",
      createdAt: now - 30 * 86400000,
      updatedAt: now - 18 * 86400000,
    },
    {
      id: uid("case"),
      client: `${SEED_TAG} Northwind Schools`,
      theme: "DEI",
      status: "In Progress",
      amount: 12000,
      paymentReceived: 4000,
      paymentStatus: "Partial",
      paymentDate: isoDaysAgo(10),
      notes: "DEI training rollout, cohort 1 of 3.",
      createdAt: now - 45 * 86400000,
      updatedAt: now - 5 * 86400000,
    },
    {
      id: uid("case"),
      client: `${SEED_TAG} Heron Foundation`,
      theme: "Facilitation",
      status: "Lead",
      amount: 3200,
      paymentReceived: 0,
      paymentStatus: "Unpaid",
      notes: "Strategic planning retreat — proposal sent.",
      createdAt: now - 4 * 86400000,
      updatedAt: now - 1 * 86400000,
    },
  ];
  for (const c of demoCases) {
    cases.upsert(c);
    syncCaseToLedger(c);
  }

  const demoLedger: LedgerEntry[] = [
    {
      id: uid("ledger"),
      date: isoDaysAgo(7),
      type: "expense",
      category: "Software and Platforms",
      description: `${SEED_TAG} Notion + Slack subscriptions`,
      amount: 86,
      source: "manual",
      createdAt: now,
    },
    {
      id: uid("ledger"),
      date: isoDaysAgo(14),
      type: "expense",
      category: "Marketing and Advertising",
      description: `${SEED_TAG} LinkedIn promoted post`,
      amount: 240,
      source: "manual",
      createdAt: now,
    },
    {
      id: uid("ledger"),
      date: isoDaysAgo(2),
      type: "expense",
      category: "Domain Hosting and Email",
      description: `${SEED_TAG} Domain renewal`,
      amount: 18,
      source: "manual",
      createdAt: now,
    },
  ];
  for (const e of demoLedger) ledger.upsert(e);

  const demoAssets: Asset[] = [
    { id: uid("asset"), name: `${SEED_TAG} Operating cash`, value: 14200, date: isoDaysAgo(0) },
    { id: uid("asset"), name: `${SEED_TAG} Receivables`, value: 8000, date: isoDaysAgo(0) },
  ];
  for (const a of demoAssets) assets.upsert(a);

  const demoLiabs: Liability[] = [
    { id: uid("liab"), name: `${SEED_TAG} Credit card`, value: 1450, date: isoDaysAgo(0) },
  ];
  for (const l of demoLiabs) liabilities.upsert(l);

  const demoEquity: Equity[] = [
    { id: uid("eq"), name: `${SEED_TAG} Owner contribution`, value: 5000, date: isoDaysAgo(60) },
  ];
  for (const e of demoEquity) equityStore.upsert(e);

  const demoAudits: AuditNote[] = [
    {
      id: uid("audit"),
      date: isoDaysAgo(30),
      note: `${SEED_TAG} Monthly review — books reconciled to bank.`,
      passed: true,
      createdAt: now - 30 * 86400000,
    },
  ];
  for (const a of demoAudits) audits.upsert(a);

  const demoNotifs: Notification[] = [
    {
      id: uid("notif"),
      type: "system",
      title: `${SEED_TAG} Welcome to demo data`,
      body: "Three cases, three expenses, an audit note, and an opening balance sheet were added. Use Settings → Clear demo data to remove them.",
      createdAt: now,
      dueAt: now,
    },
  ];
  for (const n of demoNotifs) notifications.upsert(n);

  logAudit("seed.demo.create", `${demoCases.length} cases + ${demoLedger.length} ledger entries`);
  return {
    cases: demoCases.length,
    ledger: demoLedger.length,
    assets: demoAssets.length,
    liabilities: demoLiabs.length,
    equity: demoEquity.length,
    audits: demoAudits.length,
    notifications: demoNotifs.length,
  };
}

function isSeed(v: { id?: string; client?: string; name?: string; description?: string; note?: string; title?: string }) {
  if (v.id?.startsWith("seed-")) return true;
  const fields = [v.client, v.name, v.description, v.note, v.title];
  return fields.some((f) => typeof f === "string" && f.includes(SEED_TAG));
}

export function clearDemoData() {
  let removed = 0;
  for (const c of cases.list()) if (isSeed(c)) { cases.remove(c.id); removed++; }
  for (const e of ledger.list()) if (isSeed(e)) { ledger.remove(e.id); removed++; }
  for (const a of assets.list()) if (isSeed(a)) { assets.remove(a.id); removed++; }
  for (const l of liabilities.list()) if (isSeed(l)) { liabilities.remove(l.id); removed++; }
  for (const eq of equityStore.list()) if (isSeed(eq)) { equityStore.remove(eq.id); removed++; }
  for (const a of audits.list()) if (isSeed(a)) { audits.remove(a.id); removed++; }
  for (const n of notifications.list()) if (isSeed(n)) { notifications.remove(n.id); removed++; }
  logAudit("seed.demo.clear", `${removed} records`);
  return removed;
}
