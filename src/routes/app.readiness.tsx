import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { evaluateReadiness, scoreFor, type CheckResult } from "@/lib/readiness";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, MinusCircle, Download, FileDown } from "lucide-react";
import { exportSheets } from "@/lib/excel";
import { downloadPdfReport } from "@/lib/pdf";
import { ledger, cases, assets, liabilities, equityStore } from "@/lib/store";
import { toast } from "sonner";
import { logAudit } from "@/lib/security";

export const Route = createFileRoute("/app/readiness")({ component: ReadinessPage });

function ReadinessPage() {
  const checks = useMemo(() => evaluateReadiness(), []);
  const vcScore = scoreFor("vc", checks);
  const bcScore = scoreFor("bcorp", checks);

  const grouped = (cat: "vc" | "bcorp") => {
    const items = checks.filter((c) => c.category === cat);
    const groups: Record<string, CheckResult[]> = {};
    for (const i of items) (groups[i.group] ||= []).push(i);
    return groups;
  };

  function exportXlsx() {
    const headers = ["Category", "Group", "Check", "Weight", "Score (0-1)", "Weighted", "Detail", "Passed"];
    const rows = checks.map((c) => [
      c.category === "vc" ? "Venture Capital" : "B Corporation",
      c.group, c.label, c.weight, Number(c.score.toFixed(2)),
      Number((c.weight * c.score).toFixed(2)),
      c.detail, c.passed ? "yes" : "no",
    ]);
    const summary = [
      ["Readiness summary", new Date().toISOString().slice(0, 10)],
      [],
      ["Venture Capital score", `${vcScore}%`],
      ["B Corporation score", `${bcScore}%`],
      [],
      headers, ...rows,
    ];
    exportSheets(`readiness-${Date.now()}.xlsx`, { "Readiness": summary });
    logAudit("readiness.export", undefined, { vc: vcScore, bcorp: bcScore });
    toast.success("Readiness exported");
  }

  function exportPdf() {
    // Live snapshot from CRM + bookkeeping so reviewers can see what fed
    // the score, not just the score itself.
    const lg = ledger.list();
    const cs = cases.list().filter((c) => !c.archived);
    const income = lg.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0);
    const expense = lg.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0);
    const months = new Set(lg.map((e) => e.date.slice(0, 7))).size;
    const totalAssets = assets.list().reduce((s, i) => s + i.value, 0);
    const totalLiab = liabilities.list().reduce((s, i) => s + i.value, 0);
    const totalEquity = equityStore.list().reduce((s, i) => s + i.value, 0);
    const ar = cs.reduce((s, c) => s + Math.max(0, c.amount - c.paymentReceived), 0);

    const vcRows = checks.filter((c) => c.category === "vc").map((c) => [
      c.group, c.label, `${c.weight}`, `${Math.round(c.score * 100)}%`,
      (c.weight * c.score).toFixed(1), c.passed ? "Pass" : "Gap", c.detail,
    ]);
    const bcRows = checks.filter((c) => c.category === "bcorp").map((c) => [
      c.group, c.label, `${c.weight}`, `${Math.round(c.score * 100)}%`,
      (c.weight * c.score).toFixed(1), c.passed ? "Pass" : "Gap", c.detail,
    ]);

    downloadPdfReport({
      title: "VC & B Corporation Readiness Report",
      subtitle: "Kit TJ Services, LLC — internal self-assessment",
      meta: [
        ["Generated", new Date().toLocaleString()],
        ["Venture Capital readiness", `${vcScore}%`],
        ["B Corporation alignment", `${bcScore}%`],
      ],
      sections: [
        {
          heading: "Executive summary",
          paragraph:
            `This indicative readiness report is generated from live CRM and bookkeeping ` +
            `data. The Venture Capital score (${vcScore}%) reflects financial maturity, ` +
            `pipeline diversity and governance hygiene; the B Corporation score (${bcScore}%) ` +
            `reflects mission alignment, stakeholder practices and impact tracking. ` +
            `Both are self-assessments — formal certification requires the official B Lab ` +
            `assessment and audited financials.`,
        },
        {
          heading: "Operating snapshot",
          table: {
            head: [["Metric", "Value"]],
            body: [
              ["Active cases", `${cs.length}`],
              ["Months of bookkeeping history", `${months}`],
              ["Tracked revenue", `$${income.toLocaleString()}`],
              ["Tracked expenses", `$${expense.toLocaleString()}`],
              ["Net (income − expenses)", `$${(income - expense).toLocaleString()}`],
              ["Total assets", `$${totalAssets.toLocaleString()}`],
              ["Total liabilities", `$${totalLiab.toLocaleString()}`],
              ["Equity contributions", `$${totalEquity.toLocaleString()}`],
              ["Accounts receivable (open)", `$${ar.toLocaleString()}`],
            ],
          },
        },
        {
          heading: `Venture Capital readiness — ${vcScore}%`,
          table: {
            head: [["Group", "Check", "Wt", "Score", "Earned", "Status", "Detail"]],
            body: vcRows,
          },
        },
        {
          heading: `B Corporation alignment — ${bcScore}%`,
          table: {
            head: [["Group", "Check", "Wt", "Score", "Earned", "Status", "Detail"]],
            body: bcRows,
          },
        },
        {
          heading: "Recommended next steps",
          paragraph:
            "1) Close any 'Gap' rows above by adding the missing CRM cases, " +
            "expense categories, audit notes, or balance-sheet line items. " +
            "2) Maintain at least 12 months of continuous bookkeeping for VC " +
            "diligence. 3) For B Corp certification, complete the official B " +
            "Impact Assessment at bcorporation.net once the alignment score " +
            "exceeds 75%.",
        },
      ],
      footer:
        "Confidential · Kit TJ Services, LLC · Indicative self-assessment, not an audited statement.",
    }, `readiness-${new Date().toISOString().slice(0, 10)}.pdf`);

    logAudit("readiness.export.pdf", undefined, { vc: vcScore, bcorp: bcScore });
    toast.success("Readiness PDF downloaded");
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="heading-display text-3xl text-gold">VC &amp; B Corporation Readiness</h1>
          <p className="text-muted-foreground text-sm max-w-2xl">
            Weighted, indicative scoring derived from your CRM and bookkeeping data. This is a self-assessment;
            formal certification requires the official B Lab assessment and audited financials.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportPdf} variant="outline">
            <FileDown className="h-4 w-4" /> Export PDF
          </Button>
          <Button onClick={exportXlsx}>
            <Download className="h-4 w-4" /> Export Excel
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ScoreCard title="Venture Capital readiness" score={vcScore} groups={grouped("vc")} />
        <ScoreCard title="B Corporation alignment" score={bcScore} groups={grouped("bcorp")} />
      </div>

      <Card className="gold-frame">
        <CardHeader><CardTitle className="text-gold">How to improve</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>· Add cases under under-represented themes via <Link to="/app/crm" className="text-gold underline">CRM</Link>.</p>
          <p>· Categorize at least 3–4 expense types in <Link to="/app/bookkeeping" className="text-gold underline">Bookkeeping</Link>.</p>
          <p>· Log monthly audits regularly in <Link to="/app/audits" className="text-gold underline">Audits &amp; Reminders</Link>.</p>
          <p>· Populate Balance Sheet (assets / liabilities / equity) in <Link to="/app/statements" className="text-gold underline">Statements</Link>.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function ScoreCard({ title, score, groups }: { title: string; score: number; groups: Record<string, CheckResult[]> }) {
  return (
    <Card className="gold-frame">
      <CardHeader>
        <CardTitle className="text-gold flex justify-between items-end">
          <span>{title}</span>
          <span className="heading-display text-3xl">{score}%</span>
        </CardTitle>
        <div className="h-1 bg-muted rounded mt-1">
          <div className="h-full bg-gold rounded transition-all" style={{ width: `${score}%` }} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(groups).map(([group, items]) => (
          <div key={group}>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{group}</div>
            <div className="space-y-1">
              {items.map((c) => (
                <div key={c.key} className="flex items-start gap-2 text-sm py-1">
                  {c.passed ? <CheckCircle2 className="h-4 w-4 text-gold mt-0.5 shrink-0" /> :
                   c.score > 0 ? <MinusCircle className="h-4 w-4 text-gold-soft mt-0.5 shrink-0" /> :
                   <XCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />}
                  <div className="flex-1">
                    <div className="flex justify-between gap-2">
                      <span>{c.label}</span>
                      <span className="text-xs text-muted-foreground">{c.weight} pts</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{c.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
