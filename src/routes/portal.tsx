// Public-facing client portal. Auth via:
//   1. Magic-link token  (?t=<token>)
//   2. Firebase email login matching an invited client's email.
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { z } from "zod";
import { portal, validatePortalFile, type PortalClient } from "@/lib/portal";
import { firebaseEnabled, fbAuth } from "@/lib/firebase";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SignaturePad } from "@/components/signature-pad";
import { toast } from "sonner";
import { logAudit, safeText, rateLimit, checkLockout, recordFailure, clearLockout } from "@/lib/security";
import { LogOut, Upload, Download } from "lucide-react";
import lotus from "@/assets/lotus.png";

export const Route = createFileRoute("/portal")({
  validateSearch: (s) => ({ t: typeof s.t === "string" ? s.t : undefined }),
  component: PortalPage,
});

function readDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function PortalPage() {
  const { t } = useSearch({ from: "/portal" });
  const [client, setClient] = useState<PortalClient | null>(null);
  const [tick, setTick] = useState(0);
  const [tokenError, setTokenError] = useState<string | null>(null);

  // resolve client via token, with strict lockout to prevent guessing
  useEffect(() => {
    if (!t) return;
    const bucket = "portal:token"; // shared per-browser bucket
    const lock = checkLockout(bucket);
    if (!lock.allowed) {
      const mins = Math.ceil(lock.retryAfterMs / 60_000);
      setTokenError(`Too many invalid token attempts. Try again in ~${mins} min.`);
      logAudit("portal.token.locked_out", String(t).slice(0, 6) + "…");
      return;
    }
    const c = portal.byToken(t);
    if (c) {
      clearLockout(bucket);
      setClient(c);
      logAudit("portal.access.token", c.email);
    } else {
      const r = recordFailure(bucket, { maxAttempts: 5, windowMs: 15 * 60_000, lockoutMs: 60 * 60_000 });
      logAudit("portal.token.invalid", `${String(t).slice(0, 6)}… remaining=${r.remaining}`);
      setTokenError(r.allowed
        ? `Invalid link. ${r.remaining} attempt(s) remaining before lockout.`
        : `Too many invalid attempts. Locked for ${Math.ceil(r.retryAfterMs / 60_000)} min.`);
    }
  }, [t]);

  // resolve via firebase auth
  useEffect(() => {
    if (!firebaseEnabled || !fbAuth || client) return;
    const unsub = onAuthStateChanged(fbAuth, (u) => {
      if (u?.email) {
        const c = portal.byEmail(u.email);
        if (c) { setClient(c); logAudit("portal.access.firebase", c.email); }
      }
    });
    return unsub;
  }, [client]);

  // refresh on store change
  useEffect(() => {
    const r = () => { if (client) setClient(portal.get(client.id) ?? null); setTick((x) => x + 1); };
    window.addEventListener("lotus:lotus.portal.clients.v1", r);
    return () => window.removeEventListener("lotus:lotus.portal.clients.v1", r);
  }, [client]);

  if (!client) return <PortalLogin onAuthed={(c) => setClient(c)} tokenError={tokenError} />;
  return <PortalDashboard client={client} key={tick} />;
}

const loginSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(6).max(200),
});

function PortalLogin({ onAuthed, tokenError }: { onAuthed: (c: PortalClient) => void; tokenError?: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr("");
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) { setErr("Enter a valid email and password (min 6)."); return; }
    if (!rateLimit(`portal:${parsed.data.email}`, 5, 60_000)) {
      logAudit("portal.login.rate_limited", parsed.data.email);
      setErr("Too many attempts. Wait a minute."); return;
    }
    if (!(firebaseEnabled && fbAuth)) {
      setErr("Login unavailable: Firebase is not configured. Use your magic-link instead.");
      return;
    }
    setBusy(true);
    try {
      await signInWithEmailAndPassword(fbAuth, parsed.data.email, parsed.data.password);
      const c = portal.byEmail(parsed.data.email);
      if (!c) {
        setErr("Signed in, but this email isn't registered as a portal client.");
        logAudit("portal.login.unknown_email", parsed.data.email);
      } else {
        onAuthed(c);
        logAudit("portal.login.success", c.email);
      }
    } catch {
      logAudit("portal.login.fail", parsed.data.email);
      setErr("Invalid credentials.");
    } finally { setBusy(false); }
  }

  return (
    <main className="lotus-bg min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md gold-frame rounded-lg bg-card/90 backdrop-blur p-8">
        <div className="flex flex-col items-center mb-6">
          <img src={lotus} alt="" width={56} height={56} />
          <h1 className="heading-display text-2xl text-gold mt-3">Client Portal</h1>
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground mt-1">Kit TJ Services</p>
          <div className="gold-divider w-full mt-4" />
        </div>
        {tokenError && (
          <div className="mb-4 rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
            {tokenError}
          </div>
        )}
        <form onSubmit={submit} className="space-y-4" autoComplete="off">
          <div>
            <Label htmlFor="pe">Email</Label>
            <Input id="pe" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} required />
          </div>
          <div>
            <Label htmlFor="pp">Password</Label>
            <Input id="pp" type="password" value={password} onChange={(e) => setPassword(e.target.value)} maxLength={200} required />
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <Button type="submit" disabled={busy} className="w-full">{busy ? "Signing in…" : "Sign in"}</Button>
        </form>
        <p className="mt-4 text-[11px] text-muted-foreground text-center">
          Have a magic link? Open it directly — no password needed.
        </p>
      </div>
    </main>
  );
}

function PortalDashboard({ client }: { client: PortalClient }) {
  const [busy, setBusy] = useState(false);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const err = validatePortalFile(f);
    if (err) { toast.error(err); return; }
    setBusy(true);
    const dataUrl = await readDataUrl(f);
    portal.addDocument(client.id, {
      name: f.name, size: f.size, type: f.type, dataUrl,
      uploadedBy: "client", kind: "upload",
    });
    setBusy(false);
    toast.success("Uploaded");
    e.target.value = "";
  }

  function logout() {
    if (firebaseEnabled && fbAuth) signOut(fbAuth);
    window.location.href = "/portal";
  }

  const reports = useMemo(() => client.documents.filter((d) => d.kind === "report"), [client]);
  const uploads = useMemo(() => client.documents.filter((d) => d.kind === "upload"), [client]);
  const pending = useMemo(() => client.signatures.filter((s) => !s.signedAt), [client]);
  const signed = useMemo(() => client.signatures.filter((s) => s.signedAt), [client]);

  return (
    <div className="lotus-bg min-h-screen">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center gap-3">
          <img src={lotus} alt="" width={28} height={28} />
          <div className="flex-1">
            <div className="heading-display text-gold">Client Portal</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Welcome, {client.name}</div>
          </div>
          <Button variant="ghost" size="sm" aria-label="Sign out" onClick={logout}><LogOut className="w-4 h-4" /></Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        <Card className="gold-frame">
          <CardHeader><CardTitle className="text-gold">Reports from us ({reports.length})</CardTitle></CardHeader>
          <CardContent>
            {reports.length === 0 ? <p className="text-sm text-muted-foreground">No reports yet.</p> : (
              <div className="space-y-1">
                {reports.map((d) => (
                  <a key={d.id} href={d.dataUrl} download={d.name} className="flex items-center justify-between text-sm border border-border/40 rounded px-3 py-2 hover:bg-accent/40">
                    <span>{d.name}</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-2">
                      {(d.size / 1024).toFixed(0)} KB <Download className="w-3 h-3" />
                    </span>
                  </a>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="gold-frame">
          <CardHeader><CardTitle className="text-gold">Upload documents</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <label className="block">
              <input type="file" disabled={busy} onChange={upload} className="block w-full text-sm" />
            </label>
            <p className="text-[11px] text-muted-foreground">PDF, DOC(X), XLS(X), CSV, TXT, PNG, JPG, WEBP. Max 10 MB per file.</p>
            <div className="space-y-1">
              {uploads.map((d) => (
                <div key={d.id} className="flex items-center justify-between text-xs border border-border/40 rounded px-2 py-1">
                  <span><Upload className="w-3 h-3 inline mr-1" />{d.name} <span className="text-muted-foreground">· {(d.size / 1024).toFixed(0)} KB · {new Date(d.uploadedAt).toLocaleString()}</span></span>
                  <a className="underline" href={d.dataUrl} download={d.name}>download</a>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="gold-frame">
          <CardHeader><CardTitle className="text-gold">Pending signatures ({pending.length})</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {pending.length === 0 && <p className="text-sm text-muted-foreground">Nothing to sign.</p>}
            {pending.map((s) => (
              <SignBlock key={s.id} clientId={client.id} sigId={s.id} documentName={s.documentName} body={s.body} />
            ))}
            {signed.length > 0 && (
              <div className="border-t border-border/50 pt-3">
                <Label className="text-xs uppercase tracking-wider">Completed</Label>
                <div className="mt-1 space-y-1">
                  {signed.map((s) => (
                    <div key={s.id} className="text-xs border border-border/40 rounded px-2 py-1">
                      <div className="flex items-center justify-between">
                        <span>{s.documentName}</span>
                        <Badge>Signed {new Date(s.signedAt!).toLocaleDateString()}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function SignBlock({ clientId, sigId, documentName, body }: { clientId: string; sigId: string; documentName: string; body: string }) {
  const [signerName, setSignerName] = useState("");
  const [sig, setSig] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const name = safeText(signerName, 120);
    if (!name) { toast.error("Type your full legal name."); return; }
    if (!sig) { toast.error("Draw your signature."); return; }
    setBusy(true);
    await portal.recordSignature(clientId, sigId, { signerName: name, signatureDataUrl: sig });
    setBusy(false);
    toast.success("Signed");
  }

  return (
    <div className="border border-border/50 rounded p-3 space-y-2">
      <div className="font-medium">{documentName}</div>
      <p className="text-xs text-muted-foreground whitespace-pre-wrap">{body}</p>
      <div>
        <Label className="text-xs">Full legal name</Label>
        <Input value={signerName} onChange={(e) => setSignerName(e.target.value)} maxLength={120} />
      </div>
      <SignaturePad onChange={setSig} />
      <div className="flex justify-end">
        <Button size="sm" disabled={busy || !sig || !signerName} onClick={submit}>I agree &amp; sign</Button>
      </div>
    </div>
  );
}
