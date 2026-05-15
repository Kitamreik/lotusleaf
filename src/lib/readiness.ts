// VC and B-Corp readiness scoring. Each item has a weight and a function
// that computes a 0..1 score based on current store state.
import { ledger, assets, liabilities, equityStore, cases, audits } from "./store";

export type CheckResult = {
  key: string;
  label: string;
  weight: number;
  score: number;       // 0..1
  detail: string;
  passed: boolean;     // score >= 0.6
  category: "vc" | "bcorp";
  group: string;
};

function clamp01(n: number) { return Math.max(0, Math.min(1, n)); }

export function evaluateReadiness(): CheckResult[] {
  const lg = ledger.list();
  const cs = cases.list();
  const as = assets.list();
  const ls = liabilities.list();
  const eq = equityStore.list();
  const au = audits.list();

  const income = lg.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0);
  const expense = lg.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0);
  const months = new Set(lg.map((e) => e.date.slice(0, 7))).size;

  const vc: CheckResult[] = [
    {
      key: "vc-financials-history", group: "Financial maturity", category: "vc",
      label: "12+ months of bookkeeping history", weight: 15,
      score: clamp01(months / 12), detail: `${months} month(s) recorded`,
      passed: months >= 12,
    },
    {
      key: "vc-revenue", group: "Financial maturity", category: "vc",
      label: "Tracked revenue ≥ $25,000", weight: 10,
      score: clamp01(income / 25000), detail: `$${income.toLocaleString()} recorded`,
      passed: income >= 25000,
    },
    {
      key: "vc-expense-discipline", group: "Financial maturity", category: "vc",
      label: "Operating expenses categorized across ≥ 3 categories", weight: 10,
      score: clamp01(new Set(lg.filter((e) => e.type === "expense").map((e) => e.category)).size / 3),
      detail: `${new Set(lg.filter((e) => e.type === "expense").map((e) => e.category)).size} categor(ies)`,
      passed: new Set(lg.filter((e) => e.type === "expense").map((e) => e.category)).size >= 3,
    },
    {
      key: "vc-balance-sheet", group: "Financial maturity", category: "vc",
      label: "Balance sheet populated (assets, liabilities, equity)", weight: 10,
      score: (as.length > 0 ? 0.34 : 0) + (ls.length > 0 ? 0.33 : 0) + (eq.length > 0 ? 0.33 : 0),
      detail: `${as.length}A / ${ls.length}L / ${eq.length}E`,
      passed: as.length > 0 && ls.length > 0 && eq.length > 0,
    },
    {
      key: "vc-margin", group: "Unit economics", category: "vc",
      label: "Positive margin (income > expense)", weight: 15,
      score: income > 0 ? clamp01((income - expense) / income) : 0,
      detail: income > 0 ? `${Math.round(((income - expense) / income) * 100)}% margin` : "no income yet",
      passed: income - expense > 0,
    },
    {
      key: "vc-pipeline", group: "Traction", category: "vc",
      label: "Active pipeline of ≥ 5 cases", weight: 10,
      score: clamp01(cs.filter((c) => !c.archived).length / 5),
      detail: `${cs.filter((c) => !c.archived).length} active case(s)`,
      passed: cs.filter((c) => !c.archived).length >= 5,
    },
    {
      key: "vc-paid-customers", group: "Traction", category: "vc",
      label: "≥ 3 customers with confirmed payment", weight: 10,
      score: clamp01(cs.filter((c) => c.paymentStatus === "Paid").length / 3),
      detail: `${cs.filter((c) => c.paymentStatus === "Paid").length} paid`,
      passed: cs.filter((c) => c.paymentStatus === "Paid").length >= 3,
    },
    {
      key: "vc-audit-cadence", group: "Governance", category: "vc",
      label: "≥ 3 monthly audits logged", weight: 10,
      score: clamp01(au.length / 3),
      detail: `${au.length} audit(s)`,
      passed: au.length >= 3,
    },
    {
      key: "vc-cap-table", group: "Governance", category: "vc",
      label: "Equity contributions documented (cap table starter)", weight: 10,
      score: clamp01(eq.length / 2),
      detail: `${eq.length} equity entr(ies)`,
      passed: eq.length >= 2,
    },
  ];

  const themeCount = (t: string) => cs.filter((c) => c.theme === t).length;
  const archived = cs.filter((c) => c.archived || c.status === "Completed").length;
  const archivalRate = cs.length ? archived / cs.length : 0;

  const bcorp: CheckResult[] = [
    {
      key: "bc-mission", group: "Mission & purpose", category: "bcorp",
      label: "DEI engagements present", weight: 15,
      score: clamp01(themeCount("DEI") / 2),
      detail: `${themeCount("DEI")} DEI case(s)`,
      passed: themeCount("DEI") >= 1,
    },
    {
      key: "bc-edu", group: "Mission & purpose", category: "bcorp",
      label: "Education engagements present", weight: 10,
      score: clamp01(themeCount("Education") / 2),
      detail: `${themeCount("Education")} Education case(s)`,
      passed: themeCount("Education") >= 1,
    },
    {
      key: "bc-community", group: "Community", category: "bcorp",
      label: "Workshops or Facilitation engagements present", weight: 10,
      score: clamp01((themeCount("Workshops") + themeCount("Facilitation")) / 2),
      detail: `${themeCount("Workshops")}W / ${themeCount("Facilitation")}F`,
      passed: themeCount("Workshops") + themeCount("Facilitation") >= 1,
    },
    {
      key: "bc-systems", group: "Governance", category: "bcorp",
      label: "Systems Work engagements present", weight: 5,
      score: clamp01(themeCount("Systems Work") / 1),
      detail: `${themeCount("Systems Work")} case(s)`,
      passed: themeCount("Systems Work") >= 1,
    },
    {
      key: "bc-transparency", group: "Governance", category: "bcorp",
      label: "Audit trail (≥ 2 monthly audits)", weight: 15,
      score: clamp01(au.length / 2),
      detail: `${au.length} audit(s)`,
      passed: au.length >= 2,
    },
    {
      key: "bc-opex", group: "Environment", category: "bcorp",
      label: "Operating expense disclosure across categories", weight: 10,
      score: clamp01(new Set(lg.filter((e) => e.type === "expense").map((e) => e.category)).size / 4),
      detail: `${new Set(lg.filter((e) => e.type === "expense").map((e) => e.category)).size} categor(ies)`,
      passed: new Set(lg.filter((e) => e.type === "expense").map((e) => e.category)).size >= 4,
    },
    {
      key: "bc-financials", group: "Governance", category: "bcorp",
      label: "Financial statements available (BS / IS / CF)", weight: 10,
      score: as.length || ls.length || eq.length ? 1 : 0,
      detail: as.length || ls.length ? "populated" : "empty",
      passed: as.length > 0 || ls.length > 0 || eq.length > 0,
    },
    {
      key: "bc-archival", group: "Customers", category: "bcorp",
      label: "Healthy case lifecycle (archival rate ≥ 30%)", weight: 10,
      score: clamp01(archivalRate / 0.3),
      detail: `${Math.round(archivalRate * 100)}%`,
      passed: archivalRate >= 0.3,
    },
    {
      key: "bc-records", group: "Governance", category: "bcorp",
      label: "Document retention via case file uploads", weight: 5,
      score: clamp01(cs.filter((c) => (c.files ?? []).length > 0).length / 3),
      detail: `${cs.filter((c) => (c.files ?? []).length > 0).length} case(s) with files`,
      passed: cs.some((c) => (c.files ?? []).length > 0),
    },
    {
      key: "bc-paid", group: "Customers", category: "bcorp",
      label: "Customers with full payment recorded", weight: 10,
      score: clamp01(cs.filter((c) => c.paymentStatus === "Paid").length / 3),
      detail: `${cs.filter((c) => c.paymentStatus === "Paid").length} paid`,
      passed: cs.filter((c) => c.paymentStatus === "Paid").length >= 3,
    },
  ];

  return [...vc, ...bcorp];
}

export function scoreFor(category: "vc" | "bcorp", checks: CheckResult[]): number {
  const items = checks.filter((c) => c.category === category);
  const total = items.reduce((s, c) => s + c.weight, 0);
  const earned = items.reduce((s, c) => s + c.weight * c.score, 0);
  return total ? Math.round((earned / total) * 100) : 0;
}
