import { Badge } from "@/components/ui/badge";
import { visitorStatus } from "@/lib/ovms/format";
import type { AccountStatus, LogAction, Role, Visitor } from "@/lib/ovms/types";
import { cn } from "@/lib/utils";

function Dot({ pulse, className }: { pulse?: boolean; className?: string }) {
  return (
    <span className={cn("relative flex size-1.5", className)}>
      {pulse && <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" />}
      <span className="relative inline-flex size-1.5 rounded-full bg-current" />
    </span>
  );
}

export function VisitorStatusBadge({ visitor }: { visitor: Visitor }) {
  const status = visitorStatus(visitor);
  if (status === "Inside")
    return (
      <Badge variant="success">
        <Dot pulse /> Inside
      </Badge>
    );
  if (status === "Archived")
    return (
      <Badge variant="warning">
        <Dot /> Archived
      </Badge>
    );
  return (
    <Badge variant="neutral">
      <Dot /> Checked out
    </Badge>
  );
}

export function RoleBadge({ role, className }: { role: Role; className?: string }) {
  return (
    <Badge variant={role === "admin" ? "neon" : "success"} className={className}>
      {role === "admin" ? "Administrator" : "Receptionist"}
    </Badge>
  );
}

export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  return status === "active" ? (
    <Badge variant="success">
      <Dot /> Active
    </Badge>
  ) : (
    <Badge variant="danger">
      <Dot /> Deactivated
    </Badge>
  );
}

const ACTION_TONE: Record<LogAction, "success" | "warning" | "danger" | "neutral"> = {
  Login: "neutral",
  Logout: "neutral",
  "Session expired": "warning",
  "Registered visitor": "success",
  "Checked-out visitor": "neutral",
  "Edited visitor": "warning",
  "Archived record": "warning",
  "Restored record": "success",
  "Added staff": "success",
  "Edited staff": "warning",
  "Deactivated staff": "danger",
  "Activated staff": "success",
  "Reset password": "danger",
  "Exported report": "neutral",
};

export function ActionBadge({ action }: { action: LogAction }) {
  return <Badge variant={ACTION_TONE[action]}>{action}</Badge>;
}
