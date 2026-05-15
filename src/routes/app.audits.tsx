import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { audits, type AuditNote } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle2, AlertCircle, Calendar } from "lucide-react";
import { safeText } from "@/lib/security";
import { toast } from "sonner";

export const Route = createFileRoute("/app/audits")({
  component: AuditsPage,
});

function AuditsPage() {
  const [list, setList] = useState<AuditNote[]>(() => audits.list());
  const [note, setNote] = useState("");
  const [passed, setPassed] = useState(true);

  function add() {
    const n = safeText(note, 2000);
    if (!n) { toast.error("Add a note"); return; }
    audits.upsert({
      id: crypto.randomUUID(),
      date: new Date().toISOString().slice(0, 10),
      note: n,
      passed,
      createdAt: Date.now(),
    });
    setList(audits.list());
    setNote("");
    toast.success("Audit logged");
  }

  const upcoming = useMemo(() => {
    const now = new Date();
    const reminders: { label: string; date: Date }[] = [];
    // Bi-weekly reminders for current month
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    for (let d = 1; d <= 28; d += 14) {
      const dt = new Date(first.getFullYear(), first.getMonth(), d);
      if (dt >= now) reminders.push({ label: "Bi-weekly bookkeeping check-in", date: dt });
    }
    // Monthly audit on last day of month
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    if (monthEnd >= now) reminders.push({ label: "Monthly financial audit", date: monthEnd });
    return reminders.sort((x, y) => x.date.getTime() - y.date.getTime());
  }, []);

  const lastMonthly = list.find((a) => a.note.toLowerCase().includes("monthly"));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="heading-display text-3xl text-gold">Audits &amp; Reminders</h1>
        <p className="text-muted-foreground text-sm">Monthly financial audit · bi-weekly bookkeeping check-ins</p>
      </div>

      <Card className="gold-frame">
        <CardHeader><CardTitle className="text-gold flex items-center gap-2"><Calendar className="h-4 w-4" /> Upcoming</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">No further reminders this month.</p>
          ) : upcoming.map((r, i) => (
            <div key={i} className="flex justify-between text-sm border-b border-border/30 py-2">
              <span>{r.label}</span>
              <span className="text-gold">{r.date.toDateString()}</span>
            </div>
          ))}
          {!lastMonthly && (
            <p className="text-xs text-muted-foreground pt-2">
              <AlertCircle className="inline h-3 w-3 text-gold" /> No monthly audit logged yet.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="gold-frame">
        <CardHeader><CardTitle className="text-gold">Log audit</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Notes</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} rows={3} placeholder="Monthly audit — reconciled bank, reviewed expense categories…" />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm flex items-center gap-2">
              <input type="checkbox" checked={passed} onChange={(e) => setPassed(e.target.checked)} /> Passed checks
            </label>
            <Button onClick={add}>Log audit</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="gold-frame">
        <CardHeader><CardTitle className="text-gold">History</CardTitle></CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground">No audits logged yet.</p>
          ) : (
            <div className="space-y-2">
              {list.map((a) => (
                <div key={a.id} className="border-b border-border/30 py-2 flex items-start gap-3">
                  {a.passed ? <CheckCircle2 className="h-4 w-4 text-gold mt-0.5" /> : <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />}
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">{a.date}</div>
                    <div className="text-sm whitespace-pre-wrap">{a.note}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
