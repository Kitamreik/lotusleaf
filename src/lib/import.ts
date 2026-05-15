// CSV / XLSX import for CRM cases. Upserts by (client + theme) key, or by `id` column if present.
import * as XLSX from "xlsx";
import { z } from "zod";
import { cases, syncCaseToLedger, type Case } from "./store";
import { safeText } from "./security";

export const IMPORT_COLUMNS = [
  "id", "client", "theme", "status", "amount",
  "paymentReceived", "paymentStatus", "paymentDate", "notes",
] as const;

const THEMES = ["Consulting", "DEI", "Education", "Facilitation", "Workshops", "Systems Work"] as const;
const STATUSES = ["Lead", "In Progress", "On Hold", "Completed", "Archived"] as const;
const PAYS = ["Unpaid", "Partial", "Paid"] as const;

const rowSchema = z.object({
  id: z.string().optional(),
  client: z.string().min(1).max(120),
  theme: z.enum(THEMES),
  status: z.enum(STATUSES).default("Lead"),
  amount: z.number().nonnegative().max(1e9).default(0),
  paymentReceived: z.number().nonnegative().max(1e9).default(0),
  paymentStatus: z.enum(PAYS).default("Unpaid"),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  notes: z.string().max(5000).optional(),
});

export type ImportResult = {
  created: number;
  updated: number;
  errors: { row: number; message: string }[];
};

function parseDateCell(v: unknown): string | undefined {
  if (v == null || v === "") return undefined;
  if (typeof v === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return undefined;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.y}-${pad(d.m)}-${pad(d.d)}`;
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10);
}

export function parseRows(rows: Record<string, unknown>[]): {
  parsed: { row: number; data: z.infer<typeof rowSchema> }[];
  errors: { row: number; message: string }[];
} {
  const parsed: { row: number; data: z.infer<typeof rowSchema> }[] = [];
  const errors: { row: number; message: string }[] = [];
  rows.forEach((raw, i) => {
    const rowNum = i + 2; // header is row 1
    const candidate = {
      id: raw.id ? safeText(raw.id, 80) : undefined,
      client: safeText(raw.client, 120),
      theme: String(raw.theme ?? "").trim(),
      status: String(raw.status ?? "Lead").trim(),
      amount: Number(raw.amount ?? 0),
      paymentReceived: Number(raw.paymentReceived ?? 0),
      paymentStatus: String(raw.paymentStatus ?? "Unpaid").trim(),
      paymentDate: parseDateCell(raw.paymentDate) ?? "",
      notes: raw.notes ? safeText(raw.notes, 5000) : "",
    };
    const r = rowSchema.safeParse(candidate);
    if (!r.success) {
      errors.push({ row: rowNum, message: r.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ") });
    } else {
      parsed.push({ row: rowNum, data: r.data });
    }
  });
  return { parsed, errors };
}

/** Read a File (csv or xlsx) into row objects. */
export async function readFileToRows(file: File): Promise<Record<string, unknown>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
}

export function applyImport(
  parsed: { row: number; data: z.infer<typeof rowSchema> }[],
): ImportResult {
  const existing = cases.list();
  const byId = new Map(existing.map((c) => [c.id, c]));
  const byKey = new Map(existing.map((c) => [`${c.client.toLowerCase()}::${c.theme}`, c]));
  let created = 0, updated = 0;
  const errors: ImportResult["errors"] = [];

  for (const { row, data } of parsed) {
    try {
      const key = `${data.client.toLowerCase()}::${data.theme}`;
      const match = (data.id && byId.get(data.id)) || byKey.get(key);
      const now = Date.now();
      const item: Case = {
        id: match?.id ?? data.id ?? crypto.randomUUID(),
        client: data.client,
        theme: data.theme,
        status: data.status,
        amount: data.amount,
        paymentReceived: data.paymentReceived,
        paymentStatus: data.paymentStatus,
        paymentDate: data.paymentDate || undefined,
        notes: data.notes ?? "",
        createdAt: match?.createdAt ?? now,
        updatedAt: now,
        archived: match?.archived ?? false,
        archivedAt: match?.archivedAt,
        files: match?.files ?? [],
      };
      cases.upsert(item);
      syncCaseToLedger(item);
      if (match) updated++; else created++;
    } catch (e) {
      errors.push({ row, message: (e as Error).message });
    }
  }
  return { created, updated, errors };
}

export function downloadTemplate() {
  const sample = [
    {
      id: "", client: "Acme Co", theme: "Consulting", status: "In Progress",
      amount: 5000, paymentReceived: 2500, paymentStatus: "Partial",
      paymentDate: new Date().toISOString().slice(0, 10),
      notes: "Initial deposit received.",
    },
    {
      id: "", client: "Beacon School", theme: "Education", status: "Completed",
      amount: 3200, paymentReceived: 3200, paymentStatus: "Paid",
      paymentDate: new Date().toISOString().slice(0, 10),
      notes: "DEI workshop series.",
    },
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sample, { header: [...IMPORT_COLUMNS] });
  ws["!cols"] = IMPORT_COLUMNS.map(() => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(wb, ws, "Cases");
  // Reference sheet
  const ref = [
    ["Field", "Required", "Allowed values / format"],
    ["id", "no", "Leave blank for new rows. If provided, updates that case."],
    ["client", "yes", "Free text up to 120 chars (matched case-insensitively with theme)"],
    ["theme", "yes", THEMES.join(" | ")],
    ["status", "no", STATUSES.join(" | ")],
    ["amount", "no", "Number"],
    ["paymentReceived", "no", "Number — drives the bookkeeping income entry"],
    ["paymentStatus", "no", PAYS.join(" | ")],
    ["paymentDate", "no", "YYYY-MM-DD"],
    ["notes", "no", "Up to 5000 chars"],
  ];
  const refWs = XLSX.utils.aoa_to_sheet(ref);
  refWs["!cols"] = [{ wch: 18 }, { wch: 10 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, refWs, "Reference");
  XLSX.writeFile(wb, "crm-import-template.xlsx");
}
