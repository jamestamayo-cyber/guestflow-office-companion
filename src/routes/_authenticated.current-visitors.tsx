import { createFileRoute, Link } from "@tanstack/react-router";
import { DoorOpen, LogOut, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader, Panel } from "@/components/ovms/page-header";
import { VisitorStatusBadge } from "@/components/ovms/badges";
import { ConfirmDialog } from "@/components/ovms/confirm-dialog";
import { useOvms } from "@/lib/ovms/store";
import { fmtDuration, fmtTime, initials } from "@/lib/ovms/format";
import { pageHead } from "@/lib/ovms/head";
import type { Visitor } from "@/lib/ovms/types";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/current-visitors")({
  head: () => pageHead("Current Visitors", "Visitors currently inside the office, with time-out recording."),
  component: CurrentVisitors,
});

function CurrentVisitors() {
  const { state, checkOut } = useOvms();
  const [target, setTarget] = useState<Visitor | null>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 30000);
    return () => window.clearInterval(id);
  }, []);

  const inside = state.visitors
    .filter((v) => !v.archived && !v.timeOut)
    .sort((a, b) => a.timeIn.localeCompare(b.timeIn));

  const confirm = () => {
    if (!target) return;
    checkOut(target.id);
    toast.success(`${target.fullName} timed out at ${format(new Date(), "h:mm a")}`);
    setTarget(null);
  };

  return (
    <>
      <PageHeader
        eyebrow="Live"
        title="Current Visitors"
        description={`${inside.length} ${inside.length === 1 ? "visitor is" : "visitors are"} inside the office right now.`}
        actions={
          <Button asChild>
            <Link to="/register">
              <UserPlus /> Register Visitor
            </Link>
          </Button>
        }
      />
      <Panel className="overflow-hidden">
        {inside.length === 0 ? (
          <EmptyState icon={<DoorOpen className="size-6" />} title="No one is inside" description="Visitors appear here as soon as they're registered." />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="pl-5">Visitor</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Host / department</TableHead>
                  <TableHead>Time-in</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-5 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inside.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="pl-5">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
                          {initials(v.fullName)}
                        </div>
                        <div>
                          <p className="font-semibold">{v.fullName}</p>
                          <p className="font-mono text-[11px] text-muted-foreground">{v.id}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{v.purpose}</TableCell>
                    <TableCell>{v.host}</TableCell>
                    <TableCell>
                      <p className="tabular font-medium">{fmtTime(v.timeIn)}</p>
                      <p className="text-xs text-muted-foreground">{fmtDuration(v.timeIn, null)} inside</p>
                    </TableCell>
                    <TableCell>
                      <VisitorStatusBadge visitor={v} />
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      <Button size="sm" variant="neon" onClick={() => setTarget(v)}>
                        <LogOut /> Record Time-Out
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      <ConfirmDialog
        open={!!target}
        onOpenChange={(o) => !o && setTarget(null)}
        title="Record time-out?"
        confirmLabel="Confirm Time-Out"
        onConfirm={confirm}
        description={
          target && (
            <div className="space-y-3">
              <p>This marks the visitor as having left the office. This action is logged.</p>
              <dl className="grid grid-cols-2 gap-3 rounded-xl bg-muted p-3 text-sm text-foreground">
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">Visitor</dt>
                  <dd className="font-semibold">{target.fullName}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Time-in</dt>
                  <dd className="tabular font-medium">{fmtTime(target.timeIn)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Time-out</dt>
                  <dd className="tabular font-medium">{format(new Date(), "h:mm a")} (now)</dd>
                </div>
              </dl>
            </div>
          )
        }
      />
    </>
  );
}
