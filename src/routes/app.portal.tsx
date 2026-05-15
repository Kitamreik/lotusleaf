// Admin manager for the Client Portal.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { portal, validatePortalFile, type PortalClient } from "@/lib/portal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Copy, Trash2, RefreshCw, Upload, FileSignature, Send } from "lucide-react";
import { safeText } from "@/lib/security";

export const Route = createFileRoute("/app/portal")({ component: AdminPortal });

const inviteSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
});

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function AdminPortal() {
  const [clients, setClients] = useState<PortalClient[]>(() => portal.list());
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setClients(portal.list());
    window.addEventListener("lotus:lotus.portal.clients.v1", refresh);
    return () => window.removeEventListener("lotus:lotus.portal.clients.v1", refresh);
  }, []);

  function invite() {
    const parsed = inviteSchema.safeParse({ name, email });
    if (!parsed.success) { toast.error("Enter a valid name and email."); return; }
    portal.invite(parsed.data.name, parsed.data.email);
    setClients(portal.list());
    setName(""); setEmail("");
    toast.success("Client invited");
  }

  function copyLink(c: PortalClient) {
    const url = `${window.location.origin}/portal?t=${c.token}`;
    navigator.clipboard.writeText(url).then(() => toast.success("Magic link copied"));
  }

  const open = openId ? clients.find((c) => c.id === openId) ?? null : null;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="heading-display text-3xl text-gold">Client Portal</h1>
        <p className="text-muted-foreground text-sm">
          Invite clients, share documents, request e-signatures. Magic links work without a password;
          clients can also sign in at <code>/portal</code> with their email if Firebase Auth is configured.
        </p>
      </div>

      <Card className="gold-frame">
        <CardHeader><CardTitle className="text-gold">Invite a client</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" maxLength={120} />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" maxLength={200} />
          </div>
          <Button onClick={invite}><Send className="w-4 h-4 mr-2" />Create</Button>
        </CardContent>
      </Card>

      <Card className="gold-frame">
        <CardHeader><CardTitle className="text-gold">Clients ({clients.length})</CardTitle></CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <p className="text-sm text-muted-foreground">No clients yet.</p>
          ) : (
            <div className="space-y-2">
              {clients.map((c) => (
                <div key={c.id} className="flex items-center justify-between border border-border/50 rounded p-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{c.email}</div>
                    <div className="text-[10px] text-muted-foreground mt-1 flex gap-2 flex-wrap">
                      <Badge variant="outline">{c.documents.length} docs</Badge>
                      <Badge variant="outline">{c.signatures.length} sig requests</Badge>
                      <Badge variant="outline">
                        {c.signatures.filter((s) => s.signedAt).length} signed
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => copyLink(c)}><Copy className="w-3 h-3 mr-1" />Link</Button>
                    <Button variant="outline" size="sm" onClick={() => { portal.rotateToken(c.id); setClients(portal.list()); toast.success("Token rotated"); }}>
                      <RefreshCw className="w-3 h-3" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setOpenId(c.id)}>Manage</Button>
                    <Button variant="ghost" size="sm" onClick={() => { if (confirm(`Remove ${c.email}?`)) { portal.remove(c.id); setClients(portal.list()); }}}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!open} onOpenChange={(v) => { if (!v) setOpenId(null); }}>
        <DialogContent className="max-w-2xl">
          {open && <ManageClient client={open} onChange={() => setClients(portal.list())} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ManageClient({ client, onChange }: { client: PortalClient; onChange: () => void }) {
  const [docName, setDocName] = useState("");
  const [sigBody, setSigBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function uploadReport(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const err = validatePortalFile(f);
    if (err) { toast.error(err); return; }
    setBusy(true);
    const dataUrl = await readDataUrl(f);
    portal.addDocument(client.id, {
      name: f.name, size: f.size, type: f.type, dataUrl,
      uploadedBy: "admin", kind: "report",
    });
    setBusy(false);
    onChange();
    toast.success("Report published");
    e.target.value = "";
  }

  function requestSig() {
    const name = safeText(docName, 200);
    const body = safeText(sigBody, 5000);
    if (!name || !body) { toast.error("Document name and statement required."); return; }
    portal.requestSignature(client.id, name, body);
    setDocName(""); setSigBody("");
    onChange();
    toast.success("Signature requested");
  }

  return (
    <>
      <DialogHeader><DialogTitle>{client.name} — {client.email}</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div>
          <Label className="text-xs uppercase tracking-wider">Publish a report</Label>
          <input type="file" onChange={uploadReport} disabled={busy} className="mt-1 block w-full text-sm" />
        </div>

        <div className="border-t border-border/50 pt-3">
          <Label className="text-xs uppercase tracking-wider">Request a signature</Label>
          <Input className="mt-1" placeholder="Document name (e.g. Engagement Letter v3)" value={docName} onChange={(e) => setDocName(e.target.value)} maxLength={200} />
          <Textarea className="mt-2" placeholder="Statement the client agrees to…" rows={3} value={sigBody} onChange={(e) => setSigBody(e.target.value)} maxLength={5000} />
          <div className="flex justify-end mt-2"><Button onClick={requestSig} size="sm"><FileSignature className="w-3 h-3 mr-1" />Request</Button></div>
        </div>

        <div className="border-t border-border/50 pt-3">
          <Label className="text-xs uppercase tracking-wider">Documents ({client.documents.length})</Label>
          <div className="mt-1 space-y-1 max-h-48 overflow-auto">
            {client.documents.length === 0 && <p className="text-xs text-muted-foreground">None yet.</p>}
            {client.documents.map((d) => (
              <div key={d.id} className="flex items-center justify-between text-xs border border-border/40 rounded px-2 py-1">
                <div className="truncate">
                  <Badge variant="outline" className="mr-2">{d.kind}</Badge>
                  <Badge variant="outline" className="mr-2">{d.uploadedBy}</Badge>
                  {d.name} <span className="text-muted-foreground">· {(d.size / 1024).toFixed(0)} KB</span>
                </div>
                <div className="flex gap-1">
                  <a href={d.dataUrl} download={d.name} className="underline">download</a>
                  <button className="text-destructive ml-2" onClick={() => { portal.removeDocument(client.id, d.id); onChange(); }}>delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-border/50 pt-3">
          <Label className="text-xs uppercase tracking-wider">Signatures</Label>
          <div className="mt-1 space-y-1 max-h-48 overflow-auto">
            {client.signatures.length === 0 && <p className="text-xs text-muted-foreground">None yet.</p>}
            {client.signatures.map((s) => (
              <div key={s.id} className="text-xs border border-border/40 rounded px-2 py-1">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{s.documentName}</div>
                  <Badge variant={s.signedAt ? "default" : "outline"}>
                    {s.signedAt ? "Signed" : "Pending"}
                  </Badge>
                </div>
                <div className="text-muted-foreground mt-0.5 line-clamp-2">{s.body}</div>
                {s.signedAt && (
                  <div className="text-[10px] text-muted-foreground mt-1">
                    by {s.signerName} · {new Date(s.signedAt).toLocaleString()}
                    {s.signerIp && <> · {s.signerIp}</>}
                    {s.signerHash && <> · hash {s.signerHash.slice(0, 12)}…</>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <DialogFooter className="text-[10px] text-muted-foreground">
        Magic link: <code>/portal?t={client.token.slice(0, 8)}…</code>
      </DialogFooter>
    </>
  );
}
