import { createFileRoute } from "@tanstack/react-router";
import { Lock, ScrollText, X } from "lucide-react";
import { isSameDay } from "date-fns";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader, Panel } from "@/components/ovms/page-header";
import { ActionBadge } from "@/components/ovms/badges";
import { useOvms } from "@/lib/ovms/store";
import { fmtStamp } from "@/lib/ovms/format";
import { pageHead } from "@/lib/ovms/head";

export const Route = createFileRoute("/_authenticated/admin/logs")({
  head: () => pageHead("Activity Logs", "Read-only audit trail of logins, registrations, edits and check-outs."),
  component: ActivityLogs,
});

function ActivityLogs() {
  const { state } = useOvms();
  const [user, setUser] = useState("all");
  const [action, setAction] = useState("all");
  const [date, setDate] = useState("");
  const actions = Array.from(new Set(state.logs.map((l) => l.action))).sort();
  const rows = state.logs
    .filter((l) => user === "all" || l.userId === user)
    .filter((l) => action === "all" || l.action === action)
    .filter((l) => !date || isSameDay(new Date(l.timestamp), new Date(`${date}T00:00:00`)));
  const dirty = user !== "all" || action !== "all" || date;

  return (
    <>
      <PageHeader eyebrow="Administration" title="Activity Logs" description="A permanent, read-only record of every action taken in the system." />
      <Panel className="overflow-hidden">
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <Select value={user} onValueChange={setUser}>
            <SelectTrigger className="h-10 rounded-lg" aria-label="User"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All users</SelectItem>
              {state.users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="h-10 rounded-lg" aria-label="Action"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {actions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 rounded-lg" aria-label="Date" />
          <Button variant="ghost" className="h-10" disabled={!dirty} onClick={() => { setUser("all"); setAction("all"); setDate(""); }}><X /> Clear</Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-y bg-muted/40 px-5 py-2.5 text-xs text-muted-foreground">
          <span><span className="font-semibold text-foreground">{rows.length}</span> entries</span>
          <span className="flex items-center gap-1.5"><Lock className="size-3.5" /> Logs cannot be edited or deleted</span>
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={<ScrollText className="size-6" />} title="No log entries match" />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5">Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Record ID</TableHead>
                  <TableHead className="pr-5">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="pl-5 font-mono text-xs tabular">{fmtStamp(l.timestamp)}</TableCell>
                    <TableCell className="font-medium">{l.userName}</TableCell>
                    <TableCell><ActionBadge action={l.action} /></TableCell>
                    <TableCell className="font-mono text-xs">{l.recordId ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="max-w-[380px] pr-5 text-sm text-muted-foreground">{l.details ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
    </>
  );
}
