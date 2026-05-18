import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { firebaseEnabled } from "@/lib/firebase";
import lotus from "@/assets/lotus.png";
import { z } from "zod";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { maskEmail } from "@/lib/roles";

const schema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(6).max(200),
});

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { login, session, unauthorizedEmail, clearUnauthorized } = useAuth();
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
    clearUnauthorized();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      setErr("Enter a valid email and password (min 6 characters).");
      return;
    }
    setLoading(true);
    try {
      await login(parsed.data.email, parsed.data.password);
      // Redirect happens via the session effect once the allowlist check passes.
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="lotus-bg min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md gold-frame rounded-lg bg-card/90 backdrop-blur p-8">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground hover:text-gold mb-4"
        >
          <ArrowLeft className="h-3 w-3" /> Back to welcome
        </Link>
        <div className="flex flex-col items-center mb-6">
          <img src={lotus} alt="Lotus emblem" width={64} height={64} />
          <h1 className="heading-display text-3xl text-gold mt-3">Lotus &amp; Leaf</h1>
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground mt-1">
            Internal Suite
          </p>
          <div className="gold-divider w-full mt-4" />
        </div>
        {unauthorizedEmail && (
          <div
            role="alert"
            className="mb-4 rounded border border-destructive/60 bg-destructive/10 px-3 py-3 text-sm"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div>
                <div className="font-medium text-destructive">Not authorized</div>
                <p className="mt-1 text-foreground/85">
                  The account <code className="text-foreground">{maskEmail(unauthorizedEmail)}</code>{" "}
                  is not on the internal allowlist for Kit TJ Services, LLC.
                  Please leave this application. If you believe this is an
                  error, contact the workspace owner.
                </p>
              </div>
            </div>
          </div>
        )}
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
          Restricted access. All sign-ins are logged and audited.
        </p>
        {!firebaseEnabled && (
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            Sign-in service is not ready. Contact your administrator.
          </p>
        )}
      </div>
    </main>
  );
}
