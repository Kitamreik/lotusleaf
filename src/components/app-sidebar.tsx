import { Link, useRouterState } from "@tanstack/react-router";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { LayoutDashboard, Users, Receipt, FileBarChart, ShieldCheck, ScrollText, Award, LogOut, Scale, Settings as SettingsIcon, FolderLock } from "lucide-react";
import lotus from "@/assets/lotus.png";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { maskEmail } from "@/lib/roles";

// `ownerOnly` items are hidden for viewer-role sessions so the nav reflects
// what the user can actually do. The RequireOwner guard still enforces
// access at the route level for defense-in-depth.
const items = [
  { title: "Dashboard", url: "/app", icon: LayoutDashboard, ownerOnly: false },
  { title: "CRM — Cases", url: "/app/crm", icon: Users, ownerOnly: true },
  { title: "Bookkeeping", url: "/app/bookkeeping", icon: Receipt, ownerOnly: true },
  { title: "Reconciliation", url: "/app/reconcile", icon: Scale, ownerOnly: true },
  { title: "Statements", url: "/app/statements", icon: FileBarChart, ownerOnly: false },
  { title: "Audits & Reminders", url: "/app/audits", icon: ShieldCheck, ownerOnly: true },
  { title: "VC / B-Corp", url: "/app/readiness", icon: Award, ownerOnly: false },
  { title: "Client Portal", url: "/app/portal", icon: FolderLock, ownerOnly: true },
  { title: "Security Log", url: "/app/security", icon: ScrollText, ownerOnly: false },
  { title: "Settings", url: "/app/settings", icon: SettingsIcon, ownerOnly: false },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { logout, session } = useAuth();
  const isOwner = session?.role === "owner";
  const visibleItems = items.filter((it) => !it.ownerOnly || isOwner);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/app" className="flex items-center gap-2 px-2 py-3">
          <img src={lotus} alt="Lotus" width={28} height={28} className="opacity-90" />
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="heading-display text-base text-gold">Kit TJ Services, CRM</span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Internal Suite</span>
            </div>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((it) => {
                const active = path === it.url || (it.url !== "/app" && path.startsWith(it.url));
                return (
                  <SidebarMenuItem key={it.url}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link to={it.url} className="flex items-center gap-2">
                        <it.icon className="h-4 w-4" />
                        {!collapsed && <span>{it.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        {!collapsed && session && (
          <div className="px-2 py-1 text-xs text-muted-foreground truncate">
            <span className="block truncate">{maskEmail(session.email)}</span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-gold/80">
              {session.role}
            </span>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className="justify-start text-muted-foreground hover:text-gold"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Sign out</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
