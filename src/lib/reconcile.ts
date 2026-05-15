import { cases, ledger, ledgerIdForCase, syncCaseToLedger, type Case, type LedgerEntry } from "./store";

export type ReconRow = {
  caseId: string;
  client: string;
  theme: string;
  paymentReceived: number;
  paymentDate?: string;
  ledgerId: string;
  ledgerEntry?: LedgerEntry;
  status: "ok" | "missing" | "amount_mismatch" | "date_mismatch" | "extra_zero";
  detail: string;
};

export type ReconReport = {
  rows: ReconRow[];
  orphans: LedgerEntry[]; // crm-source entries with no matching case
};

export function buildReconciliation(): ReconReport {
  const cs = cases.list();
  const lg = ledger.list();
  const lgById = new Map(lg.map((e) => [e.id, e]));
  const usedIds = new Set<string>();

  const rows: ReconRow[] = cs.map((c) => {
    const lid = ledgerIdForCase(c.id);
    const entry = lgById.get(lid);
    if (entry) usedIds.add(lid);

    if (c.paymentReceived <= 0) {
      if (entry) {
        return mk(c, lid, entry, "extra_zero",
          "Case has $0 received but a ledger entry still exists.");
      }
      return mk(c, lid, undefined, "ok", "No payment yet — nothing to reconcile.");
    }
    if (!entry) {
      return mk(c, lid, undefined, "missing",
        `Missing ledger entry for $${c.paymentReceived.toFixed(2)}.`);
    }
    if (Math.abs(entry.amount - c.paymentReceived) > 0.005) {
      return mk(c, lid, entry, "amount_mismatch",
        `Ledger amount $${entry.amount.toFixed(2)} ≠ case $${c.paymentReceived.toFixed(2)}.`);
    }
    const expectedDate = c.paymentDate ?? new Date(c.updatedAt).toISOString().slice(0, 10);
    if (entry.date !== expectedDate) {
      return mk(c, lid, entry, "date_mismatch",
        `Ledger date ${entry.date} ≠ case ${expectedDate}.`);
    }
    return mk(c, lid, entry, "ok", "Matched.");
  });

  const orphans = lg.filter(
    (e) => e.source === "crm" && !usedIds.has(e.id),
  );

  return { rows, orphans };
}

function mk(c: Case, lid: string, entry: LedgerEntry | undefined, status: ReconRow["status"], detail: string): ReconRow {
  return {
    caseId: c.id, client: c.client, theme: c.theme,
    paymentReceived: c.paymentReceived, paymentDate: c.paymentDate,
    ledgerId: lid, ledgerEntry: entry, status, detail,
  };
}

export function resolveRow(row: ReconRow): boolean {
  const c = cases.get(row.caseId);
  if (!c) return false;
  syncCaseToLedger(c);
  return true;
}

export function resolveAll(report: ReconReport): { fixed: number; orphansRemoved: number } {
  let fixed = 0;
  for (const r of report.rows) {
    if (r.status === "ok") continue;
    if (resolveRow(r)) fixed++;
  }
  let orphansRemoved = 0;
  for (const o of report.orphans) {
    ledger.remove(o.id);
    orphansRemoved++;
  }
  return { fixed, orphansRemoved };
}
