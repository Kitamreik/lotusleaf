import { useEffect, useState, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  ensureScheduledNotifications, activeNotifications, upcomingNotifications,
  dismissNotification, markAllRead,
} from "@/lib/notifications";
import type { Notification } from "@/lib/store";
import { format } from "date-fns";

export function NotificationBell() {
  const [active, setActive] = useState<Notification[]>([]);
  const [upcoming, setUpcoming] = useState<Notification[]>([]);

  const refresh = useCallback(() => {
    ensureScheduledNotifications();
    setActive(activeNotifications());
    setUpcoming(upcomingNotifications().slice(0, 3));
  }, []);

  useEffect(() => {
    refresh();
    const i = setInterval(refresh, 60_000);
    const onStorage = () => refresh();
    window.addEventListener("lotus:lotus.notif.v1", onStorage);
    return () => { clearInterval(i); window.removeEventListener("lotus:lotus.notif.v1", onStorage); };
  }, [refresh]);

  const unread = active.filter((n) => !n.read).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"} onClick={() => setTimeout(markAllRead, 500)}>
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 inline-flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-gold text-[10px] font-medium text-primary-foreground">
              {unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
          <span className="heading-display text-gold">Notifications</span>
          <span className="text-xs text-muted-foreground">{active.length} active</span>
        </div>
        <div className="max-h-96 overflow-y-auto divide-y divide-border/40">
          {active.length === 0 && upcoming.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground text-center">No notifications.</div>
          )}
          {active.map((n) => (
            <div key={n.id} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs uppercase tracking-wider text-gold">{n.type}</div>
                  <div className="text-sm font-medium">{n.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{n.body}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">Due {format(n.dueAt, "PP")}</div>
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                {n.link && (
                  <Button asChild size="sm" variant="outline">
                    <Link to={n.link}>Open</Link>
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => { dismissNotification(n.id); refresh(); }}>
                  Dismiss
                </Button>
              </div>
            </div>
          ))}
          {upcoming.length > 0 && (
            <div className="px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/30">
              Upcoming
            </div>
          )}
          {upcoming.map((n) => (
            <div key={n.id} className="p-3 opacity-70">
              <div className="text-sm">{n.title}</div>
              <div className="text-[10px] text-muted-foreground">{format(n.dueAt, "PP")}</div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
