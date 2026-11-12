import { createFileRoute } from "@tanstack/react-router";
import { Archive, Eye, FileSearch, Pencil, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader, Panel } from "@/components/ovms/page-header";
import { VisitorStatusBadge } from "@/components/ovms/badges";
import { VisitorFilters, applyVisitorFilters, emptyFilters } from "@/components/ovms/visitor-filters";
import { VisitorDetailsSheet } from "@/components/ovms/visitor-details-sheet";
import { EditVisitorDialog } from "@/components/ovms/edit-visitor-dialog";
import { ConfirmDialog } from "@/components/ovms/confirm-dialog";
import { useOvms } from "@/lib/ovms/store";
import { fmtDate, fmtTime, formatPhone } from "@/lib/ovms/format";
import { pageHead } from "@/lib/ovms/head";
import type { Visitor } from "@/lib/ovms/types";

export const Route = createFileRoute("/_authenticated/admin/records")({
  head: () => pageHead("Visitor Records", "Full visitor records with details, logged edits and archiving."),
  component: AdminRecords,
});

function AdminRecords() {
  const { state, archiveVisitors, restoreVisitors } = useOvms();
  const [filters, setFilters] = useState(emptyFilters);
  const [viewId, setViewId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const find = (id: string | null) => state.visitors.find((v) => v.id === id) ?? null;
  const viewing = find(viewId);
  const editing = find(editId);
  const archiving = find(archiveId);
  const results = applyVisitorFilters(state.visitors, filters);

  const confirmArchive = () => {
    if (!archiving) return;
    if (archiving.archived) {
      restoreVisitors([archiving.id]);
      toast.success(`${archiving.id} restored to active records`);
    } else {
      archiveVisitors([archiving.id]);
      toast.success(`${archiving.id} archived`);
    }
    setArchiveId(null);
  };

  return (
    <>
      <PageHeader eyebrow="Administration" title="Visitor Records" description="Full contact details are visible to administrators only. All edits require a reason and are logged." />
      <Panel className="overflow-hidden">
        <VisitorFilters value={filters} onChange={setFilters} statuses={["Inside", "Checked out", "Archived"]} />
        <div className="border-y bg-muted/40 px-5 py-2.5 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{results.length}</span> of {state.visitors.length} records
        </div>
        {results.length === 0 ? (
          <EmptyState icon={<FileSearch className="size-6" />} title="No matching records" />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[1000px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5">Record</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Host</TableHead>
                  <TableHead>Time-in</TableHead>
                  <TableHead>Time-out</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-5 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((v) => (
                  <TableRow key={v.id} className={v.archived ? "opacity-70" : ""}>
                    <TableCell className="pl-5">
                      <button className="text-left hover:text-primary" onClick={() => setViewId(v.id)}>
                        <p className="font-semibold">{v.fullName}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">{v.id}</p>
                      </button>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{formatPhone(v.contact)}</TableCell>
                    <TableCell className="max-w-[160px] truncate">{v.purpose}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{v.host}</TableCell>
                    <TableCell>
                      <p className="tabular font-medium">{fmtTime(v.timeIn)}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(v.timeIn)}</p>
                    </TableCell>
                    <TableCell className="tabular">{v.timeOut ? fmtTime(v.timeOut) : "—"}</TableCell>
                    <TableCell><VisitorStatusBadge visitor={v} /></TableCell>
                    <TableCell className="pr-5">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" title="View details" aria-label="View details" onClick={() => setViewId(v.id)}><Eye /></Button>
                        <Button size="sm" variant="soft" onClick={() => setEditId(v.id)} disabled={v.archived}><Pencil /> Edit</Button>
                        <ArchiveButton v={v} onClick={() => setArchiveId(v.id)} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      <VisitorDetailsSheet
        visitor={viewing}
        onClose={() => setViewId(null)}
        onEdit={(v) => { setViewId(null); setEditId(v.id); }}
        onArchive={(v) => setArchiveId(v.id)}
      />
      <EditVisitorDialog visitor={editing} onClose={() => setEditId(null)} />
      <ConfirmDialog
        open={!!archiving}
        onOpenChange={(o) => !o && setArchiveId(null)}
        title={archiving?.archived ? "Restore this record?" : "Archive this record?"}
        description={
          archiving?.archived
            ? `${archiving.fullName} (${archiving.id}) will return to active records and search results.`
            : `${archiving?.fullName} (${archiving?.id}) will be moved to the archive under the retention policy. It can be restored later. This action is logged.`
        }
        confirmLabel={archiving?.archived ? "Restore" : "Archive"}
        onConfirm={confirmArchive}
      />
    </>
  );
}

function ArchiveButton({ v, onClick }: { v: Visitor; onClick: () => void }) {
  if (v.archived)
    return <Button size="icon" variant="ghost" title="Restore" aria-label="Restore record" onClick={onClick}><RotateCcw /></Button>;
  return (
    <Button size="icon" variant="ghost" title={v.timeOut ? "Archive" : "Visitor still inside"} aria-label="Archive record" onClick={onClick} disabled={!v.timeOut}>
      <Archive />
    </Button>
  );
}
