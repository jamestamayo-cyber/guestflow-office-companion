import { Check, ShieldAlert, X } from "lucide-react";
import type { ReactNode } from "react";
import { PASSWORD_RULES } from "@/lib/ovms/validation";
import { cn } from "@/lib/utils";

export function AuditNotice({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-warning/30 bg-warning-soft px-3.5 py-3 text-sm text-warning-foreground">
      <ShieldAlert className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function PasswordRulesHint({ password }: { password: string }) {
  return (
    <div className="rounded-xl border bg-muted/60 p-3">
      <p className="mb-2 text-xs font-semibold text-foreground">Password must include:</p>
      <ul className="grid gap-1 sm:grid-cols-2">
        {PASSWORD_RULES.map((r) => {
          const ok = r.test(password);
          return (
            <li key={r.id} className={cn("flex items-center gap-1.5 text-xs", ok ? "text-success" : "text-muted-foreground")}>
              {ok ? <Check className="size-3.5" /> : <X className="size-3.5" />}
              {r.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs font-medium text-destructive">{message}</p>;
}
