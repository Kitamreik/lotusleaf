import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import lotus from "@/assets/lotus.png";
import { LogIn, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kit TJ Services, LLC — Internal Suite" },
      { name: "description", content: "Private CRM, bookkeeping and statements workspace for Kit TJ Services, LLC." },
    ],
  }),
  component: WelcomePage,
});

function WelcomePage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  // If they're already signed in, jump straight into the app.
  useEffect(() => {
    if (!loading && session) navigate({ to: "/app" });
  }, [loading, session, navigate]);

  return (
    <main className="lotus-bg min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-2xl gold-frame rounded-lg bg-card/90 backdrop-blur p-10 text-center">
        <div className="flex flex-col items-center mb-8">
          <img src={lotus} alt="Lotus emblem" width={88} height={88} className="opacity-95" />
          <h1 className="heading-display text-4xl md:text-5xl text-gold mt-4">
            Lotus &amp; Leaf
          </h1>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground mt-2">
            Kit TJ Services, LLC · Internal Suite
          </p>
          <div className="gold-divider w-2/3 mt-6" />
        </div>

        <p className="text-base md:text-lg text-foreground/85 leading-relaxed max-w-xl mx-auto">
          A private workspace for our CRM, bookkeeping, financial statements,
          audits, readiness tracking and the secure client portal — all in one
          place, for authorized staff only.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {session ? (
            <Button asChild size="lg">
              <Link to="/app">
                Open the suite <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          ) : (
            <Button asChild size="lg">
              <Link to="/login">
                <LogIn className="h-4 w-4 mr-1" /> Sign in
              </Link>
            </Button>
          )}
        </div>

        <div className="mt-8 flex items-center justify-center gap-4 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          <Link to="/privacy" className="hover:text-gold">Privacy</Link>
          <span>·</span>
          <Link to="/terms" className="hover:text-gold">Terms</Link>
          <span>·</span>
          <Link to="/portal" className="hover:text-gold">Client portal</Link>
        </div>

        <p className="mt-6 text-[11px] text-muted-foreground">
          Access is restricted to staff on the internal allowlist. All sign-ins are logged.
        </p>
      </div>
    </main>
  );
}
