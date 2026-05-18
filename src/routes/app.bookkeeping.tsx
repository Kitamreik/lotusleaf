import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { ledger, type LedgerEntry, type ExpenseCategory } from "@/lib/store";
import { safeText, logAudit } from "@/lib/security";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Download, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { exportSheets, fmt } from "@/lib/excel";
import { RequireOwner } from "@/components/require-owner";

export const Route = createFileRoute("/app/bookkeeping")({
  component: () => (<RequireOwner><BookkeepingPage /></RequireOwner>),
});

const EXPENSE_CATS: ExpenseCategory[] = [
  "Permits and Licensing",
  "Equipment and Maintenance",
  "Domain Hosting and Email",
  "Software and Platforms",
  "Marketing and Advertising",
  "Other",
];
const INCOME_CATS = ["Revenue", "Other Income"] as const;

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(["income", "expense"]),
  category: z.string().min(1).max(80),
  description: z.string().min(1).max(300),
  amount: z.number().positive().max(1e9),
});

function BookkeepingPage() {
  const [list, setList] = useState<LedgerEntry[]>(() => ledger.list());
  const [type, setType] = useState<"income" | "expense">("expense");

  function refresh() { setList(ledger.list()); }

  function add(form: HTMLFormElement) {
    const fd = new FormData(form);
    const parsed = schema.safeParse({
      date: String(fd.get("date") ?? ""),
      type,
      category: safeText(fd.get("category"), 80),
      description: safeText(fd.get("description"), 300),
      amount: Number(fd.get("amount") || 0),
    });
    if (!parsed.success) { toast.error("Check the form."); return; }
    ledger.upsert({
      id: crypto.randomUUID(),
      source: "manual",
      createdAt: Date.now(),
      ...parsed.data,
      category: parsed.data.category as LedgerEntry["category"],
    });
    refresh();
    form.reset();
    toast.success("Entry added");
  }

  const totals = list.reduce(
    (acc, e) => {
      if (e.type === "income") acc.income += e.amount;
      else acc.expense += e.amount;
      return acc;
    },
    { income: 0, expense: 0 },
  );

  const byCategory = list
    .filter((e) => e.type === "expense")
    .reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + e.amount;
      return acc;
    }, {});

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="heading-display text-3xl text-gold">Bookkeeping</h1>
          <p className="text-muted-foreground text-sm">
            Operating expenses for online business · auto-synced with CRM revenue.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            const rows = [
              ["Date", "Type", "Category", "Description", "Amount", "Source", "Case ID"],
              ...list.map((e) => [e.date, e.type, e.category, e.description, fmt.money(e.amount), e.source ?? "manual", e.caseId ?? ""]),
            ];
            exportSheets(`ledger-${Date.now()}.xlsx`, { Ledger: rows });
            logAudit("ledger.export", undefined, { entries: list.length });
            toast.success("Ledger exported");
          }}
        >
          <Download className="h-4 w-4" /> Export ledger
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="gold-frame"><CardHeader><CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Income</CardTitle></CardHeader><CardContent className="text-2xl heading-display text-gold">${totals.income.toLocaleString()}</CardContent></Card>
        <Card className="gold-frame"><CardHeader><CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Expenses</CardTitle></CardHeader><CardContent className="text-2xl heading-display">${totals.expense.toLocaleString()}</CardContent></Card>
        <Card className="gold-frame"><CardHeader><CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Net</CardTitle></CardHeader><CardContent className="text-2xl heading-display">${(totals.income - totals.expense).toLocaleString()}</CardContent></Card>
      </div>

      <Card className="gold-frame">
        <CardHeader><CardTitle className="text-gold">Add entry</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Button variant={type === "expense" ? "default" : "outline"} size="sm" onClick={() => setType("expense")}>Expense</Button>
            <Button variant={type === "income" ? "default" : "outline"} size="sm" onClick={() => setType("income")}>Income</Button>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); add(e.currentTarget); }} className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <Label>Date</Label>
              <Input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>
            <div>
              <Label>Category</Label>
              <select name="category" className="w-full h-9 rounded-md border bg-input px-2 text-sm">
                {(type === "expense" ? EXPENSE_CATS : INCOME_CATS).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <Label>Description</Label>
              <Input name="description" maxLength={300} required />
            </div>
            <div>
              <Label>Amount</Label>
              <Input name="amount" type="number" step="0.01" min="0.01" required />
            </div>
            <div className="md:col-span-5 flex justify-end">
              <Button type="submit"><Plus className="h-4 w-4" /> Add</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {Object.keys(byCategory).length > 0 && (
        <Card className="gold-frame">
          <CardHeader><CardTitle className="text-gold">Expenses by category</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                <div key={k}>
                  <div className="flex justify-between text-sm">
                    <span>{k}</span><span className="text-gold">${v.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded">
                    <div className="h-full bg-gold rounded" style={{ width: `${Math.min(100, (v / totals.expense) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="gold-frame">
        <CardHeader><CardTitle className="text-gold">Ledger</CardTitle></CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground">No entries yet.</p>
          ) : (
            <div className="table-scroll -mx-2 max-h-[70vh]" tabIndex={0} role="region" aria-label="Scrollable data table">
              <table className="w-full text-sm min-w-[720px]">
                <caption className="sr-only">Ledger entries</caption>
                <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th scope="col" className="text-left py-2 px-2 whitespace-nowrap">Date</th>
                    <th scope="col" className="text-left px-2">Type</th>
                    <th scope="col" className="text-left px-2">Category</th>
                    <th scope="col" className="text-left px-2">Description</th>
                    <th scope="col" className="text-right px-2 whitespace-nowrap">Amount</th>
                    <th scope="col" className="px-2"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((e) => {
                    const isCrm = e.source === "crm";
                    return (
                      <tr key={e.id} className="border-t border-border/40">
                        <td className="py-2 px-2 whitespace-nowrap">{e.date}</td>
                        <td className={"px-2 " + (e.type === "income" ? "text-gold" : "")}>{e.type}</td>
                        <td className="px-2">{e.category}</td>
                        <td className="px-2 text-muted-foreground">
                          {e.description}
                          {isCrm && e.caseId && (
                            <Link to="/app/crm" className="ml-2 inline-flex items-center gap-1 text-[10px] text-gold hover:underline">
                              <LinkIcon className="h-3 w-3" /> case
                            </Link>
                          )}
                        </td>
                        <td className="text-right px-2 whitespace-nowrap">${e.amount.toLocaleString()}</td>
                        <td className="text-right px-2">
                          {!isCrm && (
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Delete ledger entry from ${e.date}`}
                              onClick={() => { ledger.remove(e.id); refresh(); }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                          {isCrm && (
                            <span className="text-[10px] text-muted-foreground" title="Managed by CRM — edit on the case">CRM</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
