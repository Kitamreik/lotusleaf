import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ledger, assets, liabilities, equityStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { exportSheets } from "@/lib/excel";
import { Download, Plus, Trash2 } from "lucide-react";
import { safeText, logAudit } from "@/lib/security";
import { toast } from "sonner";

export const Route = createFileRoute("/app/statements")({
  component: StatementsPage,
});

type LineItem = { id: string; name: string; value: number; date: string };

function MiniList({
  title, items, onAdd, onRemove,
}: {
  title: string; items: LineItem[];
  onAdd: (i: LineItem) => void; onRemove: (id: string) => void;
}) {
  const total = items.reduce((s, i) => s + i.value, 0);
  return (
    <Card className="gold-frame">
      <CardHeader className="pb-2"><CardTitle className="text-gold text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        <form
          className="flex gap-2 mb-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const name = safeText(fd.get("name"), 80);
            const value = Number(fd.get("value") || 0);
            if (!name || !(value > 0)) { toast.error("Invalid entry"); return; }
            onAdd({ id: crypto.randomUUID(), name, value, date: new Date().toISOString().slice(0, 10) });
            (e.currentTarget as HTMLFormElement).reset();
          }}
        >
          <Input name="name" placeholder="Name" maxLength={80} className="flex-1" />
          <Input name="value" type="number" step="0.01" min="0" placeholder="$" className="w-28" />
          <Button size="sm" type="submit"><Plus className="h-3 w-3" /></Button>
        </form>
        <div className="space-y-1">
          {items.map((i) => (
            <div key={i.id} className="flex justify-between items-center text-sm py-1 border-b border-border/30">
              <span>{i.name}</span>
              <div className="flex items-center gap-2">
                <span>${i.value.toLocaleString()}</span>
                <Button size="icon" variant="ghost" aria-label={`Remove ${i.name}`} onClick={() => onRemove(i.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          ))}
          <div className="flex justify-between pt-2 font-medium text-gold">
            <span>Total</span><span>${total.toLocaleString()}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatementsPage() {
  const [a, setA] = useState(() => assets.list());
  const [l, setL] = useState(() => liabilities.list());
  const [eq, setEq] = useState(() => equityStore.list());
  const lg = ledger.list();
  const [period, setPeriod] = useState<"all" | "ytd" | "mtd">("ytd");

  const filteredLedger = useMemo(() => {
    const now = new Date();
    return lg.filter((e) => {
      const d = new Date(e.date);
      if (period === "mtd") return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      if (period === "ytd") return d.getFullYear() === now.getFullYear();
      return true;
    });
  }, [lg, period]);

  const income = filteredLedger.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0);
  const expense = filteredLedger.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0);
  const net = income - expense;

  // Cash flow buckets
  const operating = expense; // simplification
  const investing = a.reduce((s, i) => s + i.value, 0);
  const financing = eq.reduce((s, i) => s + i.value, 0);

  const totalAssets = a.reduce((s, i) => s + i.value, 0);
  const totalLiab = l.reduce((s, i) => s + i.value, 0);
  const totalEq = eq.reduce((s, i) => s + i.value, 0) + net;

  function exportXlsx() {
    const incomeRows = [
      ["Income Statement", `Period: ${period.toUpperCase()}`],
      [],
      ["Category", "Description", "Date", "Amount"],
      ...filteredLedger.filter((e) => e.type === "income").map((e) => [e.category, e.description, e.date, e.amount]),
      ["", "", "Total Income", income],
      [],
      ["Expense Category", "Description", "Date", "Amount"],
      ...filteredLedger.filter((e) => e.type === "expense").map((e) => [e.category, e.description, e.date, e.amount]),
      ["", "", "Total Expenses", expense],
      [],
      ["", "", "Net Income", net],
    ];
    const balanceRows = [
      ["Balance Sheet", new Date().toISOString().slice(0, 10)],
      [],
      ["Assets", "", "Value"],
      ...a.map((i) => [i.name, i.date, i.value]),
      ["Total Assets", "", totalAssets],
      [],
      ["Liabilities", "", "Value"],
      ...l.map((i) => [i.name, i.date, i.value]),
      ["Total Liabilities", "", totalLiab],
      [],
      ["Equity", "", "Value"],
      ...eq.map((i) => [i.name, i.date, i.value]),
      ["Retained earnings (period net)", "", net],
      ["Total Equity", "", totalEq],
      [],
      ["Liabilities + Equity", "", totalLiab + totalEq],
    ];
    const cashRows = [
      ["Cash Flow Statement", `Period: ${period.toUpperCase()}`],
      [],
      ["Operating activities", "", income - expense],
      ["  Cash from operations (net)", "", net],
      [],
      ["Investing activities (assets)", "", -investing],
      [],
      ["Financing activities (equity)", "", financing],
      [],
      ["Net change in cash", "", net - investing + financing],
    ];
    exportSheets(`statements-${Date.now()}.xlsx`, {
      "Income Statement": incomeRows,
      "Balance Sheet": balanceRows,
      "Cash Flow": cashRows,
    });
    logAudit("statements.export", undefined, { period, income, expense, net });
    toast.success("Statements exported");
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="heading-display text-3xl text-gold">Financial Statements</h1>
          <p className="text-muted-foreground text-sm">Balance Sheet · Income Statement · Cash Flow</p>
        </div>
        <div className="flex gap-2 items-end">
          <div>
            <Label className="text-xs">Period</Label>
            <select value={period} onChange={(e) => setPeriod(e.target.value as "all" | "ytd" | "mtd")} className="h-9 rounded-md border bg-input px-2 text-sm">
              <option value="mtd">MTD</option><option value="ytd">YTD</option><option value="all">All</option>
            </select>
          </div>
          <Button onClick={exportXlsx}><Download className="h-4 w-4" /> Export Excel</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="gold-frame">
          <CardHeader><CardTitle className="text-gold">Income Statement</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <div className="flex justify-between"><span>Revenue</span><span>${income.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Expenses</span><span>(${expense.toLocaleString()})</span></div>
            <div className="gold-divider my-2" />
            <div className="flex justify-between font-medium"><span>Net income</span><span className={net >= 0 ? "text-gold" : "text-destructive"}>${net.toLocaleString()}</span></div>
          </CardContent>
        </Card>
        <Card className="gold-frame">
          <CardHeader><CardTitle className="text-gold">Balance Sheet</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <div className="flex justify-between"><span>Total assets</span><span>${totalAssets.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Total liabilities</span><span>${totalLiab.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Total equity</span><span>${totalEq.toLocaleString()}</span></div>
            <div className="gold-divider my-2" />
            <div className="flex justify-between font-medium"><span>L + E</span><span>${(totalLiab + totalEq).toLocaleString()}</span></div>
          </CardContent>
        </Card>
        <Card className="gold-frame">
          <CardHeader><CardTitle className="text-gold">Cash Flow</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <div className="flex justify-between"><span>Operating</span><span>${net.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Investing</span><span>(${investing.toLocaleString()})</span></div>
            <div className="flex justify-between"><span>Financing</span><span>${financing.toLocaleString()}</span></div>
            <div className="gold-divider my-2" />
            <div className="flex justify-between font-medium"><span>Net change</span><span>${(net - investing + financing).toLocaleString()}</span></div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MiniList
          title="Assets"
          items={a}
          onAdd={(i) => { assets.upsert(i); setA(assets.list()); }}
          onRemove={(id) => { assets.remove(id); setA(assets.list()); }}
        />
        <MiniList
          title="Liabilities"
          items={l}
          onAdd={(i) => { liabilities.upsert(i); setL(liabilities.list()); }}
          onRemove={(id) => { liabilities.remove(id); setL(liabilities.list()); }}
        />
        <MiniList
          title="Equity contributions"
          items={eq}
          onAdd={(i) => { equityStore.upsert(i); setEq(equityStore.list()); }}
          onRemove={(id) => { equityStore.remove(id); setEq(equityStore.list()); }}
        />
      </div>
    </div>
  );
}
