import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, RefreshCw, Wand2, Download } from "lucide-react";
import { toast } from "sonner";
import { buildReconciliation, resolveRow, resolveAll } from "@/lib/reconcile";
import { ledger } from "@/lib/store";
import { exportSheets, fmt } from "@/lib/excel";
import { logAudit } from "@/lib/security";
import { RequireOwner } from "@/components/require-owner";

export const Route = createFileRoute("/app/reconcile")({
  component: () => (<RequireOwner><ReconcilePage /></RequireOwner>),
});

function ReconcilePage() {
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  const report = useMemo(() => buildReconciliation(), [tick]);

  const counts = report.rows.reduce(
    (a, r) => { a[r.status] = (a[r.status] ?? 0) + 1; return a; },
    {} as Record<string, number>,
  );
  const totalIssues =
    (counts.missing ?? 0) + (counts.amount_mismatch ?? 0) +
    (counts.date_mismatch ?? 0) + (counts.extra_zero ?? 0) + report.orphans.length;

  function fixOne(caseId: string) {
    const r = report.rows.find((x) => x.caseId === caseId);
    if (!r) return;
    if (resolveRow(r)) { toast.success("Resolved"); refresh(); }
  }
  function removeOrphan(id: string) {
    ledger.remove(id);
    refresh();
    toast.success("Orphan removed");
  }
  function fixAll() {
    const r = resolveAll(report);
    logAudit("reconcile.fix_all", undefined, { fixed: r.fixed, orphansRemoved: r.orphansRemoved });
    toast.success(`Fixed ${r.fixed} · removed ${r.orphansRemoved} orphan(s)`);
    refresh();
  }
  function exportReport() {
    const rows = [
      ["Client", "Theme", "Case payment", "Payment date", "Ledger amount", "Ledger date", "Status", "Detail"],
      ...report.rows.map((r) => [
        r.client, r.theme, fmt.money(r.paymentReceived), r.paymentDate ?? "",
        r.ledgerEntry ? fmt.money(r.ledgerEntry.amount) : "",
        r.ledgerEntry?.date ?? "",
        r.status, r.detail,
      ]),
    ];
    const orphans = [
      ["Ledger ID", "Date", "Description", "Amount", "Case ID"],
      ...report.orphans.map((o) => [o.id, o.date, o.description, fmt.money(o.amount), o.caseId ?? ""]),
    ];
    exportSheets(`reconciliation-${Date.now()}.xlsx`, { Cases: rows, Orphans: orphans });
    logAudit("reconcile.export", undefined, { rows: report.rows.length, orphans: report.orphans.length });
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="heading-display text-3xl text-gold">Reconciliation</h1>
          <p className="text-muted-foreground text-sm">
            Verify every CRM payment is mirrored as a bookkeeping income entry.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refresh}><RefreshCw className="h-4 w-4" /> Refresh</Button>
          <Button variant="outline" onClick={exportReport}><Download className="h-4 w-4" /> Export</Button>
          <Button onClick={fixAll} disabled={totalIssues === 0}><Wand2 className="h-4 w-4" /> Resolve all</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Matched" value={counts.ok ?? 0} good />
        <StatCard label="Missing" value={counts.missing ?? 0} />
        <StatCard label="Amount mismatch" value={counts.amount_mismatch ?? 0} />
        <StatCard label="Date mismatch" value={counts.date_mismatch ?? 0} />
        <StatCard label="Stale / orphan" value={(counts.extra_zero ?? 0) + report.orphans.length} />
      </div>

      <Card className="gold-frame">
        <CardHeader><CardTitle className="text-gold">Cases</CardTitle></CardHeader>
        <CardContent>
          {report.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cases yet.</p>
          ) : (
            <div className="table-scroll -mx-2 max-h-[70vh]" tabIndex={0} role="region" aria-label="Scrollable data table">
              <table className="w-full text-sm min-w-[720px]">
                <caption className="sr-only">CRM cases reconciled to ledger entries</caption>
                <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th scope="col" className="text-left py-2 px-2">Client</th>
                    <th scope="col" className="text-left px-2">Theme</th>
                    <th scope="col" className="text-right px-2 whitespace-nowrap">Case $</th>
                    <th scope="col" className="text-right px-2 whitespace-nowrap">Ledger $</th>
                    <th scope="col" className="text-left px-2">Status</th>
                    <th scope="col" className="text-left px-2">Detail</th>
                    <th scope="col" className="px-2"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((r) => (
                    <tr key={r.caseId} className="border-t border-border/40">
                      <td className="py-2 px-2">{r.client}</td>
                      <td className="px-2">{r.theme}</td>
                      <td className="text-right px-2 whitespace-nowrap">${r.paymentReceived.toLocaleString()}</td>
                      <td className="text-right px-2 whitespace-nowrap">{r.ledgerEntry ? `$${r.ledgerEntry.amount.toLocaleString()}` : "—"}</td>
                      <td className="px-2"><StatusBadge status={r.status} /></td>
                      <td className="text-muted-foreground text-xs px-2">{r.detail}</td>
                      <td className="text-right px-2">
                        {r.status !== "ok" && (
                          <Button size="sm" variant="outline" onClick={() => fixOne(r.caseId)}>Resolve</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {report.orphans.length > 0 && (
        <Card className="gold-frame">
          <CardHeader><CardTitle className="text-gold">Orphan ledger entries</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              CRM-sourced ledger rows whose case no longer exists. Removing them is safe.
            </p>
            {report.orphans.map((o) => (
              <div key={o.id} className="flex justify-between items-center text-sm border-t border-border/40 py-2">
                <div>
                  <div>{o.description}</div>
                  <div className="text-xs text-muted-foreground">{o.date} · ${o.amount.toLocaleString()}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => removeOrphan(o.id)}>Remove</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Need to fix data instead? Open <Link className="text-gold underline" to="/app/crm">CRM</Link> or{" "}
        <Link className="text-gold underline" to="/app/bookkeeping">Bookkeeping</Link>.
      </p>
    </div>
  );
}

function StatCard({ label, value, good }: { label: string; value: number; good?: boolean }) {
  const tone = value === 0 ? "text-muted-foreground" : good ? "text-gold" : "text-destructive";
  return (
    <Card className="gold-frame">
      <CardHeader className="pb-1"><CardTitle className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent className={`text-2xl heading-display ${tone}`}>{value}</CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "ok") return <Badge variant="outline" className="text-gold border-gold/40"><CheckCircle2 className="h-3 w-3 mr-1" />ok</Badge>;
  return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />{status.replace("_", " ")}</Badge>;
}
