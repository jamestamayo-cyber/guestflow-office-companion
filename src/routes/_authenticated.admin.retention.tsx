import { createFileRoute } from "@tanstack/react-router";
import { Archive, ArchiveRestore, Info, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, PageHeader, Panel } from "@/components/ovms/page-header";
import { ConfirmDialog } from "@/components/ovms/confirm-dialog";
import { useOvms } from "@/lib/ovms/store";
import { fmtDate } from "@/lib/ovms/format";
import { pageHead } from "@/lib/ovms/head";
import { RETENTION_PERIODS, isEligibleForArchive } from "@/lib/ovms/rules";
import { formatDistanceToNowStrict } from "date-fns";

export const Route = createFileRoute("/_authenticated/admin/retention")({
  head: () => pageHead("Records Retention", "Archive visitor records older than the retention period, or restore them."),
  component: Retention,
});

function Retention() {
  const { state, archiveVisitors, restoreVisitors } = useOvms();
  const [tab, setTab] = useState<"eligible" | "archived">("eligible");
  const [period, setPeriod] = useState("180");
  const [selected, setSelected] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<string[] | null>(null);
  const days = RETENTION_PERIODS.find((p) => p.value === period)?.days ?? 180;

  const list =
    tab === "eligible"
      ? state.visitors.filter((v) => isEligibleForArchive(v, days))
      : state.visitors.filter((v) => v.archived);
  const sorted = [...list].sort((a, b) => a.timeIn.localeCompare(b.timeIn));
  const allSelected = sorted.length > 0 && sorted.every((v) => selected.includes(v.id));

  const run = () => {
    if (!confirm) return;
    if (tab === "eligible") {
      archiveVisitors(confirm);
      toast.success(`${confirm.length} record${confirm.length > 1 ? "s" : ""} archived`);
    } else {
      restoreVisitors(confirm);
      toast.success(`${confirm.length} record${confirm.length > 1 ? "s" : ""} restored`);
    }
    setSelected([]);
    setConfirm(null);
  };

  return (
    <>
      <PageHeader eyebrow="Administration" title="Records Retention" description="Archive checked-out records older than the chosen period. Archived records are hidden from daily search but can be restored." />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onValueChange={(t) => { setTab(t as typeof tab); setSelected([]); }}>
          <TabsList className="h-10 rounded-lg">
            <TabsTrigger value="eligible" className="rounded-md px-4">Eligible for archive</TabsTrigger>
            <TabsTrigger value="archived" className="rounded-md px-4">Archived ({state.visitors.filter((v) => v.archived).length})</TabsTrigger>
          </TabsList>
        </Tabs>
        {tab === "eligible" && (
          <Select value={period} onValueChange={(p) => { setPeriod(p); setSelected([]); }}>
            <SelectTrigger className="h-10 w-full rounded-lg bg-card sm:w-56" aria-label="Retention period"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RETENTION_PERIODS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <Panel className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-5 py-2.5">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="size-3.5" />
            {tab === "eligible" ? `${sorted.length} records older than ${RETENTION_PERIODS.find((p) => p.value === period)?.label.replace("Older than ", "")}` : `${sorted.length} archived records`}
          </span>
          <Button size="sm" variant={tab === "eligible" ? "default" : "soft"} disabled={!selected.length} onClick={() => setConfirm(selected)}>
            {tab === "eligible" ? <><Archive /> Archive selected ({selected.length})</> : <><RotateCcw /> Restore selected ({selected.length})</>}
          </Button>
        </div>
        {sorted.length === 0 ? (
          <EmptyState icon={<ArchiveRestore className="size-6" />} title={tab === "eligible" ? "Nothing to archive" : "No archived records"} description={tab === "eligible" ? "No checked-out records are older than this period." : "Archived records will appear here."} />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10 pl-5">
                    <Checkbox checked={allSelected} onCheckedChange={(c) => setSelected(c ? sorted.map((v) => v.id) : [])} aria-label="Select all" />
                  </TableHead>
                  <TableHead>Record</TableHead>
                  <TableHead>Visit date</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>{tab === "eligible" ? "Purpose" : "Archived on"}</TableHead>
                  <TableHead className="pr-5 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((v) => (
                  <TableRow key={v.id} data-state={selected.includes(v.id) ? "selected" : undefined}>
                    <TableCell className="pl-5">
                      <Checkbox
                        checked={selected.includes(v.id)}
                        onCheckedChange={(c) => setSelected((s) => (c ? [...s, v.id] : s.filter((x) => x !== v.id)))}
                        aria-label={`Select ${v.fullName}`}
                      />
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold">{v.fullName}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{v.id}</p>
                    </TableCell>
                    <TableCell className="tabular">{fmtDate(v.timeIn)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDistanceToNowStrict(new Date(v.timeIn))}</TableCell>
                    <TableCell>{tab === "eligible" ? v.purpose : v.archivedAt ? fmtDate(v.archivedAt) : "—"}</TableCell>
                    <TableCell className="pr-5 text-right">
                      {tab === "eligible" ? (
                        <Button size="sm" variant="soft" onClick={() => setConfirm([v.id])}><Archive /> Archive</Button>
                      ) : (
                        <Button size="sm" variant="soft" onClick={() => setConfirm([v.id])}><RotateCcw /> Restore</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={tab === "eligible" ? `Archive ${confirm?.length ?? 0} record(s)?` : `Restore ${confirm?.length ?? 0} record(s)?`}
        description={tab === "eligible" ? "Archived records are hidden from front-desk search but kept for audit. You can restore them at any time. This action is logged." : "Restored records will appear again in search and visitor records. This action is logged."}
        confirmLabel={tab === "eligible" ? "Archive" : "Restore"}
        onConfirm={run}
      />
    </>
  );
}
