import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { cases, ledger, notifications } from "@/lib/store";
import { ensureScheduledNotifications, activeNotifications, upcomingNotifications, dismissNotification } from "@/lib/notifications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Receipt, TrendingUp, ShieldCheck, Bell } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/app/")({ component: Dashboard });

function Dashboard() {
  const [, setTick] = useState(0);
  useEffect(() => {
    ensureScheduledNotifications();
    const i = setInterval(() => setTick((t) => t + 1), 30_000);
    const onChange = () => setTick((t) => t + 1);
    window.addEventListener("lotus:lotus.notif.v1", onChange);
    window.addEventListener("lotus:lotus.cases.v1", onChange);
    window.addEventListener("lotus:lotus.ledger.v1", onChange);
    return () => {
      clearInterval(i);
      window.removeEventListener("lotus:lotus.notif.v1", onChange);
      window.removeEventListener("lotus:lotus.cases.v1", onChange);
      window.removeEventListener("lotus:lotus.ledger.v1", onChange);
    };
  }, []);

  const cs = cases.list();
  const lg = ledger.list();
  const activeCases = cs.filter((c) => !c.archived && c.status !== "Completed").length;
  const revenue = lg.filter((l) => l.type === "income").reduce((s, l) => s + l.amount, 0);
  const expenses = lg.filter((l) => l.type === "expense").reduce((s, l) => s + l.amount, 0);
  const net = revenue - expenses;

  const stats = [
    { label: "Active cases", value: activeCases, icon: Users, to: "/app/crm" },
    { label: "Revenue (all)", value: `$${revenue.toLocaleString()}`, icon: TrendingUp, to: "/app/statements" },
    { label: "Expenses (all)", value: `$${expenses.toLocaleString()}`, icon: Receipt, to: "/app/bookkeeping" },
    { label: "Net position", value: `$${net.toLocaleString()}`, icon: ShieldCheck, to: "/app/statements" },
  ];

  const active = activeNotifications();
  const upcoming = upcomingNotifications().slice(0, 3);
  const crmLinkedCount = notifications.list(); // touch to subscribe

  return (
    <div className="p-6 max-w-6xl mx-auto" data-count={crmLinkedCount.length}>
      <div className="mb-8">
        <h1 className="heading-display text-4xl text-gold">Welcome back</h1>
        <p className="text-muted-foreground mt-1">A unified view of your consulting practice and books.</p>
        <div className="gold-divider mt-4" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Link key={s.label} to={s.to}>
            <Card className="gold-frame hover:border-gold transition">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{s.label}</CardTitle>
                <s.icon className="h-4 w-4 text-gold" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl heading-display text-foreground">{s.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="gold-frame">
          <CardHeader>
            <CardTitle className="text-gold flex items-center gap-2"><Bell className="h-4 w-4" /> Action items</CardTitle>
          </CardHeader>
          <CardContent>
            {active.length === 0 ? (
              <p className="text-sm text-muted-foreground">All caught up.</p>
            ) : (
              <div className="space-y-2">
                {active.slice(0, 5).map((n) => (
                  <div key={n.id} className="flex items-start justify-between gap-2 border-b border-border/30 py-2">
                    <div className="flex-1">
                      <div className="text-sm">{n.title}</div>
                      <div className="text-[11px] text-muted-foreground">Due {format(n.dueAt, "PP")}</div>
                    </div>
                    {n.link && <Button asChild size="sm" variant="outline"><Link to={n.link}>Open</Link></Button>}
                    <Button size="sm" variant="ghost" onClick={() => { dismissNotification(n.id); setTick((t) => t + 1); }}>×</Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="gold-frame">
          <CardHeader><CardTitle className="text-gold">Upcoming</CardTitle></CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">No reminders scheduled.</p>
            ) : (
              <div className="space-y-2">
                {upcoming.map((n) => (
                  <div key={n.id} className="flex justify-between border-b border-border/30 py-2 text-sm">
                    <span>{n.title}</span>
                    <span className="text-gold text-xs">{format(n.dueAt, "PP")}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="gold-frame">
          <CardHeader><CardTitle className="text-gold">CRM Themes</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Consulting · DEI · Education · Facilitation · Workshops · Systems Work
          </CardContent>
        </Card>
        <Card className="gold-frame">
          <CardHeader><CardTitle className="text-gold">Bookkeeping focus</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Operating expenses for online business · monthly audits · bi-weekly reminders ·
            exportable Balance Sheet, Income Statement, Cash Flow.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
