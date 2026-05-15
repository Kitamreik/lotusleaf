import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { getAuditLog, clearAuditLog } from "@/lib/security";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/app/security")({
  component: SecurityPage,
});

// Actions considered "noise" — high-volume CRUD/store mirror events that
// would otherwise drown out auth & sensitive actions.
const NOISY_PREFIXES = ["notifications.", "ledger.upsert", "cases.upsert", "audits.upsert", "assets.upsert", "liabilities.upsert", "equity.upsert"];

function isNoisy(action: string) {
  return NOISY_PREFIXES.some((p) => action.startsWith(p));
}

function SecurityPage() {
  const [log, setLog] = useState(() => getAuditLog());
  const [showNoisy, setShowNoisy] = useState(false);

  const visible = useMemo(
    () => (showNoisy ? log : log.filter((e) => !isNoisy(e.action))),
    [log, showNoisy],
  );

  const counts = useMemo(() => {
    const success = log.filter((e) => e.action === "auth.login.success").length;
    const fail = log.filter((e) => e.action === "auth.login.fail" || e.action === "auth.login.rate_limited").length;
    const hidden = log.length - visible.length;
    return { success, fail, hidden };
  }, [log, visible]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="heading-display text-3xl text-gold">Security Log</h1>
          <p className="text-muted-foreground text-sm">All sensitive actions are recorded locally with timestamps.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowNoisy((v) => !v)}>
            {showNoisy ? "Hide notification logs" : `Show notification logs (${counts.hidden})`}
          </Button>
          <Button variant="outline" onClick={() => { clearAuditLog(); setLog([]); }}>Clear log</Button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Badge variant="outline">Logins succeeded: {counts.success}</Badge>
        <Badge variant="outline">Logins failed/limited: {counts.fail}</Badge>
        <Badge variant="outline">Total events: {log.length}</Badge>
      </div>

      <Card className="gold-frame">
        <CardHeader><CardTitle className="text-gold">Events ({visible.length})</CardTitle></CardHeader>
        <CardContent>
          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events.</p>
          ) : (
            <div className="table-scroll -mx-2 max-h-[70vh]" tabIndex={0} role="region" aria-label="Scrollable data table">
              <table className="w-full text-xs min-w-[640px]">
                <caption className="sr-only">Security audit log events</caption>
                <thead className="text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="text-left py-2 px-2 whitespace-nowrap">Time</th>
                    <th scope="col" className="text-left px-2">Actor</th>
                    <th scope="col" className="text-left px-2">Action</th>
                    <th scope="col" className="text-left px-2">Target</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((e) => (
                    <tr key={e.id} className="border-t border-border/30">
                      <td className="py-2 px-2 whitespace-nowrap">{new Date(e.ts).toLocaleString()}</td>
                      <td className="px-2">{e.actor}</td>
                      <td className={"px-2 " + (
                        e.action.startsWith("auth.login.success") ? "text-gold" :
                        e.action.startsWith("auth.login.fail") || e.action === "auth.login.rate_limited" ? "text-destructive" :
                        e.action.startsWith("portal.") ? "text-gold/80" : "text-foreground"
                      )}>{e.action}</td>
                      <td className="px-2 text-muted-foreground truncate max-w-xs">{e.target ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
