import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { z } from "zod";
import JSZip from "jszip";
import {
  cases, syncCaseToLedger, removeCaseLedger, validateFile, caseFileTotal,
  FILE_RULES, type Case, type CaseFile,
} from "@/lib/store";
import { safeText, logAudit } from "@/lib/security";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Download, Archive, ArchiveRestore, Trash2, Upload, FileText, Package, FileUp, FileDown } from "lucide-react";
import { toast } from "sonner";
import { exportSheets, fmt } from "@/lib/excel";
import { downloadTemplate, readFileToRows, parseRows, applyImport } from "@/lib/import";

export const Route = createFileRoute("/app/crm")({ component: CRMPage });

const THEMES = ["Consulting", "DEI", "Education", "Facilitation", "Workshops", "Systems Work"] as const;
const STATUSES = ["Lead", "In Progress", "On Hold", "Completed", "Archived"] as const;
const PAYS = ["Unpaid", "Partial", "Paid"] as const;

const schema = z.object({
  client: z.string().trim().min(1).max(120),
  theme: z.enum(THEMES),
  status: z.enum(STATUSES),
  amount: z.number().nonnegative().max(1e9),
  paymentReceived: z.number().nonnegative().max(1e9),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  paymentStatus: z.enum(PAYS),
  notes: z.string().max(5000).optional(),
});

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(",");
  const mime = meta.match(/data:([^;]+);/)?.[1] ?? "application/octet-stream";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function CRMPage() {
  const [list, setList] = useState<Case[]>(() => cases.list());
  const [filter, setFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Case | null>(null);

  const filtered = useMemo(() => {
    if (filter === "all") return list.filter((c) => !c.archived);
    if (filter === "archived") return list.filter((c) => c.archived);
    return list.filter((c) => !c.archived && c.theme === filter);
  }, [list, filter]);

  const refresh = () => setList(cases.list());

  function startNew() { setEditing(null); setOpen(true); }
  function startEdit(c: Case) { setEditing(c); setOpen(true); }

  function save(form: HTMLFormElement) {
    const fd = new FormData(form);
    const parsed = schema.safeParse({
      client: safeText(fd.get("client"), 120),
      theme: fd.get("theme"),
      status: fd.get("status"),
      amount: Number(fd.get("amount") || 0),
      paymentReceived: Number(fd.get("paymentReceived") || 0),
      paymentDate: String(fd.get("paymentDate") ?? ""),
      paymentStatus: fd.get("paymentStatus"),
      notes: safeText(fd.get("notes"), 5000),
    });
    if (!parsed.success) { toast.error("Please check the form values."); return; }
    const now = Date.now();
    const item: Case = {
      id: editing?.id ?? crypto.randomUUID(),
      client: parsed.data.client,
      theme: parsed.data.theme,
      status: parsed.data.status,
      amount: parsed.data.amount,
      paymentReceived: parsed.data.paymentReceived,
      paymentStatus: parsed.data.paymentStatus,
      paymentDate: parsed.data.paymentDate || undefined,
      notes: parsed.data.notes ?? "",
      createdAt: editing?.createdAt ?? now,
      updatedAt: now,
      archived: editing?.archived ?? false,
      archivedAt: editing?.archivedAt,
      files: editing?.files ?? [],
    };
    cases.upsert(item);
    syncCaseToLedger(item);
    refresh();
    setOpen(false);
    toast.success("Case saved · ledger synced");
  }

  async function uploadFiles(c: Case, files: FileList | null) {
    if (!files) return;
    if (c.archived) { toast.error("Archived cases are read-only"); return; }
    let total = caseFileTotal(c);
    const newFiles: CaseFile[] = [];
    for (const f of Array.from(files)) {
      const err = validateFile(f, total);
      if (err) { toast.error(err); continue; }
      const dataUrl = await readDataUrl(f);
      newFiles.push({
        id: crypto.randomUUID(),
        name: safeText(f.name, 200),
        size: f.size,
        type: f.type,
        dataUrl,
        addedAt: Date.now(),
      });
      total += f.size;
    }
    if (!newFiles.length) return;
    const updated: Case = { ...c, files: [...(c.files ?? []), ...newFiles], updatedAt: Date.now() };
    cases.upsert(updated);
    for (const nf of newFiles) {
      logAudit("crm.file.upload", c.id, { name: nf.name, size: nf.size, type: nf.type });
    }
    refresh();
    toast.success(`${newFiles.length} file(s) uploaded`);
  }

  function deleteFile(c: Case, fileId: string) {
    if (c.archived) { toast.error("Archived cases are read-only"); return; }
    const removed = (c.files ?? []).find((f) => f.id === fileId);
    const updated: Case = { ...c, files: (c.files ?? []).filter((f) => f.id !== fileId), updatedAt: Date.now() };
    cases.upsert(updated);
    logAudit("crm.file.delete", c.id, { name: removed?.name, fileId });
    refresh();
  }

  async function downloadAllZip(c: Case) {
    if (!c.files || c.files.length === 0) return;
    const zip = new JSZip();
    for (const f of c.files) zip.file(f.name, dataUrlToBlob(f.dataUrl));
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${c.client.replace(/[^\w-]/g, "_")}-files.zip`;
    a.click();
    URL.revokeObjectURL(url);
    logAudit("crm.file.download_zip", c.id, { count: c.files.length });
  }

  function toggleArchive(c: Case) {
    const archived = !c.archived;
    cases.upsert({
      ...c,
      archived,
      archivedAt: archived ? Date.now() : undefined,
      status: archived ? "Archived" : c.status === "Archived" ? "In Progress" : c.status,
      updatedAt: Date.now(),
    });
    refresh();
  }

  function remove(c: Case) {
    if (!confirm(`Delete case "${c.client}" permanently? This also removes its ledger entry.`)) return;
    cases.remove(c.id);
    removeCaseLedger(c.id);
    refresh();
    toast.success("Case deleted");
  }

  function exportCases() {
    const all = cases.list();
    const summary = [
      ["Client", "Theme", "Status", "Pay status", "Amount", "Received", "Payment date", "Files", "Archived", "Created", "Updated"],
      ...all.map((c) => [
        c.client, c.theme, c.status, c.paymentStatus,
        fmt.money(c.amount), fmt.money(c.paymentReceived),
        c.paymentDate ?? "",
        (c.files ?? []).length,
        c.archived ? "yes" : "no",
        fmt.date(c.createdAt), fmt.date(c.updatedAt),
      ]),
    ];
    const filesIdx = [
      ["Client", "File", "Size (KB)", "Type", "Added"],
      ...all.flatMap((c) => (c.files ?? []).map((f) => [
        c.client, f.name, Math.round(f.size / 1024), f.type, fmt.date(f.addedAt),
      ])),
    ];
    exportSheets(`crm-export-${Date.now()}.xlsx`, {
      "Cases": summary,
      "File Index": filesIdx,
    });
    logAudit("crm.export", undefined, { cases: all.length });
    toast.success("CRM exported");
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="heading-display text-3xl text-gold">CRM — Cases</h1>
          <p className="text-muted-foreground text-sm">Consulting · DEI · Education · Facilitation · Workshops · Systems Work</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
              {THEMES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={downloadTemplate}><FileDown className="h-4 w-4" /> Template</Button>
          <label>
            <Button variant="outline" asChild>
              <span><FileUp className="h-4 w-4" /> Import</span>
            </Button>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.currentTarget.value = "";
                if (!file) return;
                try {
                  const rows = await readFileToRows(file);
                  const { parsed, errors } = parseRows(rows);
                  if (errors.length) toast.error(`${errors.length} row(s) skipped — see console`, { description: errors.slice(0, 3).map((x) => `r${x.row}: ${x.message}`).join("\n") });
                  if (errors.length) console.warn("Import errors", errors);
                  const r = applyImport(parsed);
                  logAudit("crm.import", file.name, { created: r.created, updated: r.updated, errors: errors.length });
                  toast.success(`Imported · ${r.created} created, ${r.updated} updated`);
                  refresh();
                } catch (err) {
                  logAudit("crm.import.fail", file.name, { message: (err as Error).message });
                  toast.error("Import failed: " + (err as Error).message);
                }
              }}
            />
          </label>
          <Button variant="outline" onClick={exportCases}><Download className="h-4 w-4" /> Export</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={startNew}><Plus className="h-4 w-4" /> New case</Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader><DialogTitle className="text-gold">{editing ? "Edit case" : "New case"}</DialogTitle></DialogHeader>
              <form
                onSubmit={(e) => { e.preventDefault(); save(e.currentTarget); }}
                className="space-y-3"
              >
                <div>
                  <Label>Client</Label>
                  <Input name="client" defaultValue={editing?.client} maxLength={120} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Theme</Label>
                    <select name="theme" defaultValue={editing?.theme ?? "Consulting"} className="w-full h-9 rounded-md border bg-input px-2 text-sm">
                      {THEMES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <select name="status" defaultValue={editing?.status ?? "Lead"} className="w-full h-9 rounded-md border bg-input px-2 text-sm">
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Total ($)</Label>
                    <Input name="amount" type="number" step="0.01" min="0" defaultValue={editing?.amount ?? 0} />
                  </div>
                  <div>
                    <Label>Received ($)</Label>
                    <Input name="paymentReceived" type="number" step="0.01" min="0" defaultValue={editing?.paymentReceived ?? 0} />
                  </div>
                  <div>
                    <Label>Pay status</Label>
                    <select name="paymentStatus" defaultValue={editing?.paymentStatus ?? "Unpaid"} className="w-full h-9 rounded-md border bg-input px-2 text-sm">
                      {PAYS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <Label>Payment date (used for ledger)</Label>
                  <Input name="paymentDate" type="date" defaultValue={editing?.paymentDate ?? new Date().toISOString().slice(0,10)} />
                </div>
                <div>
                  <Label>Supplementary notes</Label>
                  <Textarea name="notes" defaultValue={editing?.notes} rows={4} maxLength={5000} />
                </div>
                <DialogFooter>
                  <Button type="submit">Save</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground mb-4">
        File rules: max 5MB per file, 25MB per case · allowed: {FILE_RULES.allowedExtNote} · archived cases are read-only.
      </p>

      {filtered.length === 0 ? (
        <Card className="gold-frame">
          <CardContent className="py-12 text-center text-muted-foreground">No cases.</CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((c) => {
            const total = caseFileTotal(c);
            return (
              <Card key={c.id} className="gold-frame">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{c.client}</CardTitle>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        <Badge variant="outline" className="text-gold border-gold/40">{c.theme}</Badge>
                        <Badge variant="secondary">{c.status}</Badge>
                        <Badge>{c.paymentStatus}</Badge>
                        {c.archived && <Badge variant="outline">Archived</Badge>}
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="text-gold">${c.amount.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">paid ${c.paymentReceived.toLocaleString()}</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {c.notes && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{c.notes}</p>}
                  {c.files && c.files.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                        <span>Documents</span>
                        <span>{(total / 1024 / 1024).toFixed(2)} / 25 MB</span>
                      </div>
                      {c.files.map((f) => (
                        <div key={f.id} className="flex items-center justify-between text-xs bg-muted/40 rounded px-2 py-1 gap-2">
                          <span className="flex items-center gap-1 truncate min-w-0"><FileText className="h-3 w-3 shrink-0" /><span className="truncate">{f.name}</span></span>
                          <div className="flex items-center gap-2 shrink-0">
                            <a href={f.dataUrl} download={f.name} onClick={() => logAudit("crm.file.download", c.id, { name: f.name, size: f.size })} className="text-gold hover:underline flex items-center gap-1">
                              <Download className="h-3 w-3" />
                            </a>
                            {!c.archived && (
                              <button onClick={() => deleteFile(c, f.id)} className="text-muted-foreground hover:text-destructive">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button size="sm" variant="outline" onClick={() => startEdit(c)}>Edit</Button>
                    {!c.archived && (
                      <label>
                        <Button size="sm" variant="outline" asChild>
                          <span><Upload className="h-3 w-3" /> Upload</span>
                        </Button>
                        <input type="file" multiple accept={FILE_RULES.allowed.join(",")} className="hidden" onChange={(e) => uploadFiles(c, e.target.files)} />
                      </label>
                    )}
                    {c.files && c.files.length > 0 && (
                      <Button size="sm" variant="outline" onClick={() => downloadAllZip(c)}>
                        <Package className="h-3 w-3" /> Zip
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => toggleArchive(c)}>
                      {c.archived ? <ArchiveRestore className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
                      {c.archived ? "Restore" : "Archive"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(c)} className="text-destructive ml-auto">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
