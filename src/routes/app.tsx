import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AppFooter } from "@/components/app-footer";
import { NotificationBell } from "@/components/notification-bell";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
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
            <div className="ml-auto"><NotificationBell /></div>
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
