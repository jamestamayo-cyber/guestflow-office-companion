import { createFileRoute } from "@tanstack/react-router";
import { EyeOff, FileSearch } from "lucide-react";
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader, Panel } from "@/components/ovms/page-header";
import { VisitorStatusBadge } from "@/components/ovms/badges";
import { VisitorFilters, applyVisitorFilters, emptyFilters } from "@/components/ovms/visitor-filters";
import { useCurrentUser, useOvms } from "@/lib/ovms/store";
import { fmtDate, fmtTime, formatPhone, maskContact } from "@/lib/ovms/format";
import { pageHead } from "@/lib/ovms/head";

export const Route = createFileRoute("/_authenticated/search")({
  head: () => pageHead("Search Visitor Records", "Find past and current visitor records by name or date."),
  component: SearchRecords,
});

function SearchRecords() {
  const user = useCurrentUser();
  const { state } = useOvms();
  const [filters, setFilters] = useState(emptyFilters);
  const masked = user.role !== "admin";
  const results = applyVisitorFilters(state.visitors.filter((v) => !v.archived), filters);

  return (
    <>
      <PageHeader eyebrow="Records" title="Search Visitor Records" description="Search by visitor name or visit date, then narrow with filters." />
      <Panel className="overflow-hidden">
        <VisitorFilters value={filters} onChange={setFilters} statuses={["Inside", "Checked out"]} />
        <div className="flex flex-wrap items-center justify-between gap-2 border-y bg-muted/40 px-5 py-2.5 text-xs text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground">{results.length}</span> record{results.length === 1 ? "" : "s"} found
          </span>
          {masked && (
            <span className="flex items-center gap-1.5">
              <EyeOff className="size-3.5" /> Contact numbers are partially masked for your role
            </span>
          )}
        </div>
        {results.length === 0 ? (
          <EmptyState icon={<FileSearch className="size-6" />} title="No matching records" description="Try a different name or clear the date filter." />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5">Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Host</TableHead>
                  <TableHead>Time-in</TableHead>
                  <TableHead>Time-out</TableHead>
                  <TableHead className="pr-5">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="pl-5">
                      <p className="font-semibold">{v.fullName}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{v.id}</p>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{masked ? maskContact(v.contact) : formatPhone(v.contact)}</TableCell>
                    <TableCell>{v.purpose}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{v.host}</TableCell>
                    <TableCell>
                      <p className="tabular font-medium">{fmtTime(v.timeIn)}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(v.timeIn)}</p>
                    </TableCell>
                    <TableCell className="tabular">{v.timeOut ? fmtTime(v.timeOut) : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="pr-5">
                      <VisitorStatusBadge visitor={v} />
                    </TableCell>
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
