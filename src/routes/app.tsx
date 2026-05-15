import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AppFooter } from "@/components/app-footer";
import { NotificationBell } from "@/components/notification-bell";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Send unauthenticated visitors back to the public welcome page; from
    // there they can choose to sign in. Avoid dropping them straight onto
    // the login form with no context.
    if (!loading && !session) navigate({ to: "/" });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <div>Loading…</div>
        <Button asChild variant="outline" size="sm">
          <Link to="/"><Home className="h-3 w-3 mr-1" /> Back to welcome</Link>
        </Button>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full lotus-bg">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b border-border/60 bg-background/80 backdrop-blur px-3">
            <SidebarTrigger />
            <div className="ml-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Lotus &amp; Leaf · Internal
            </div>
            <div className="ml-auto flex items-center gap-1">
              <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground hover:text-gold">
                <Link to="/" aria-label="Back to welcome page">
                  <Home className="h-3.5 w-3.5" />
                  <span className="ml-1 hidden sm:inline text-[11px] uppercase tracking-[0.18em]">Welcome</span>
                </Link>
              </Button>
              <NotificationBell />
            </div>
          </header>
          <main className="flex-1">
            <Outlet />
          </main>
          <AppFooter />
        </div>
      </div>
    </SidebarProvider>
  );
}
