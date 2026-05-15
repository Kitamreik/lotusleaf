import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { firebaseEnabled, missingFirebaseVars, firebaseInitError } from "@/lib/firebase";
import lotus from "@/assets/lotus.png";
import { z } from "zod";

const schema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(6).max(200),
});

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { login, session } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) navigate({ to: "/app" });
  }, [session, navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr("");
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      setErr("Enter a valid email and password (min 6 characters).");
      return;
    }
    setLoading(true);
    try {
      await login(parsed.data.email, parsed.data.password);
      navigate({ to: "/app" });
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="lotus-bg min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md gold-frame rounded-lg bg-card/90 backdrop-blur p-8">
        <div className="flex flex-col items-center mb-6">
          <img src={lotus} alt="Lotus emblem" width={64} height={64} />
          <h1 className="heading-display text-3xl text-gold mt-3">Lotus &amp; Leaf</h1>
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground mt-1">
            Internal Suite
          </p>
          <div className="gold-divider w-full mt-4" />
        </div>
        {/* Firebase config warning is shown below the form as a collapsible
            details/summary so it doesn't dominate the sign-in surface. */}
        <form onSubmit={onSubmit} className="space-y-4" autoComplete="off">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={200}
              required
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              maxLength={200}
              required
            />
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <p className="mt-6 text-[11px] text-muted-foreground text-center leading-relaxed">
          Authenticated against Firebase. All access is logged.
        </p>
        {(missingFirebaseVars.length > 0 || firebaseInitError || !firebaseEnabled) && (
          <details className="mt-3 rounded border border-border/60 bg-muted/30 px-3 py-2 text-[11px]">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
              Backend status {firebaseEnabled ? "· connected" : "· not configured"}
            </summary>
            <div className="mt-2 text-muted-foreground space-y-1.5">
              {missingFirebaseVars.length > 0 && (
                <>
                  <div className="text-destructive font-medium">Missing env var(s):</div>
                  <ul className="list-disc ml-4">
                    {missingFirebaseVars.map((v) => <li key={v}><code>{v}</code></li>)}
                  </ul>
                  <div>
                    Copy <code>.env.example</code> to <code>.env</code>, fill the values, then restart.
                  </div>
                </>
              )}
              {firebaseInitError && (
                <div className="text-destructive break-words">{firebaseInitError}</div>
              )}
              {firebaseEnabled && !firebaseInitError && (
                <div>Firebase Auth, Firestore, and Storage are configured.</div>
              )}
            </div>
          </details>
        )}
      </div>
    </main>
  );
}
