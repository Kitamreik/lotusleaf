import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Home } from "lucide-react";

/**
 * Client-side guard for owner-only pages. Defense-in-depth on top of the
 * Firestore security rules which already require `isOwner()` for writes.
 * Viewers see a "Not authorized" panel instead of the write UI, preventing
 * any local-only mutation (localStorage is the primary store).
 */
export function RequireOwner({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  if (session?.role !== "owner") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4 border border-border/60 rounded-lg p-8 bg-background/60">
          <ShieldAlert className="h-10 w-10 mx-auto text-gold" />
          <h1 className="heading-display text-xl">Owner access required</h1>
          <p className="text-sm text-muted-foreground">
            This area is restricted to owner-role accounts. Your session is
            authenticated as a viewer and cannot modify CRM, bookkeeping,
            portal, or audit data.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link to="/app"><Home className="h-3.5 w-3.5 mr-1" /> Back to dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}