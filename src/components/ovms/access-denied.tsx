import { Link } from "@tanstack/react-router";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoleBadge } from "./badges";
import type { StaffUser } from "@/lib/ovms/types";
import { homeForRole } from "@/lib/ovms/rules";

export function AccessDenied({ user }: { user: StaffUser }) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-card">
        <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-destructive-soft text-destructive">
          <ShieldX className="size-8" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-destructive">Error 403</p>
        <h1 className="mt-1 text-2xl font-bold">Access denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This page is restricted to Administrators. You're signed in with a role that doesn't have permission to
          view it.
        </p>
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          <span className="text-muted-foreground">Your role:</span>
          <RoleBadge role={user.role} />
        </div>
        <Button asChild className="mt-6 w-full">
          <Link to={homeForRole(user.role)}>Back to my dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
