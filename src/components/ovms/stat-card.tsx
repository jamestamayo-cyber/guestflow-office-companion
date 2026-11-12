import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon: LucideIcon;
  tone?: "default" | "live" | "dark";
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border p-5 shadow-card",
        tone === "dark" ? "border-transparent bg-brand-gradient text-primary-foreground" : "bg-card",
      )}
    >
      {tone === "dark" && <div className="grid-dots pointer-events-none absolute inset-0" />}
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className={cn("text-sm font-medium", tone === "dark" ? "text-primary-foreground/75" : "text-muted-foreground")}>
            {label}
          </p>
          <p className="tabular mt-2 text-4xl font-extrabold tracking-tight">{value}</p>
          {hint && (
            <p className={cn("mt-1 text-xs", tone === "dark" ? "text-primary-foreground/70" : "text-muted-foreground")}>{hint}</p>
          )}
        </div>
        <div
          className={cn(
            "flex size-11 items-center justify-center rounded-xl",
            tone === "dark" ? "bg-neon text-neon-foreground" : tone === "live" ? "bg-success-soft text-success" : "bg-secondary text-primary",
          )}
        >
          <Icon className="size-5" />
        </div>
      </div>
    </div>
  );
}
