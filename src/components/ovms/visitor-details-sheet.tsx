import { Archive, History, Pencil, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { VisitorStatusBadge } from "./badges";
import { useOvms } from "@/lib/ovms/store";
import { fmtDateTime, fmtDuration, formatPhone, initials } from "@/lib/ovms/format";
import type { Visitor } from "@/lib/ovms/types";

export function VisitorDetailsSheet({
  visitor,
  onClose,
  onEdit,
  onArchive,
}: {
  visitor: Visitor | null;
  onClose: () => void;
  onEdit: (v: Visitor) => void;
  onArchive: (v: Visitor) => void;
}) {
  const { state } = useOvms();
  const history = visitor ? state.logs.filter((l) => l.recordId === visitor.id) : [];
  const registrar = visitor ? state.users.find((u) => u.id === visitor.registeredBy) : undefined;

  return (
    <Sheet open={!!visitor} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {visitor && (
          <>
            <SheetHeader className="text-left">
              <div className="mb-2 flex size-12 items-center justify-center rounded-2xl bg-secondary text-sm font-bold text-secondary-foreground">
                {initials(visitor.fullName)}
              </div>
              <SheetTitle className="text-xl">{visitor.fullName}</SheetTitle>
              <SheetDescription className="flex items-center gap-2">
                <span className="font-mono text-xs">{visitor.id}</span>
                <VisitorStatusBadge visitor={visitor} />
              </SheetDescription>
            </SheetHeader>

            <dl className="mt-6 grid grid-cols-2 gap-4 rounded-2xl border p-4 text-sm">
              <Detail label="Contact number" value={<span className="font-mono">{formatPhone(visitor.contact)}</span>} full />
              <Detail label="Purpose" value={visitor.purpose} full />
              <Detail label="Person / department" value={visitor.host} full />
              <Detail label="Time-in" value={fmtDateTime(visitor.timeIn)} />
              <Detail label="Time-out" value={visitor.timeOut ? fmtDateTime(visitor.timeOut) : "Still inside"} />
              <Detail label="Duration" value={fmtDuration(visitor.timeIn, visitor.timeOut)} />
              <Detail label="Registered by" value={registrar?.name ?? "—"} />
            </dl>

            <div className="mt-4 flex gap-2">
              <Button className="flex-1" onClick={() => onEdit(visitor)} disabled={visitor.archived}>
                <Pencil /> Edit
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => onArchive(visitor)} disabled={!visitor.archived && !visitor.timeOut}>
                {visitor.archived ? <><RotateCcw /> Restore</> : <><Archive /> Archive</>}
              </Button>
            </div>

            <h3 className="mb-3 mt-8 flex items-center gap-2 text-sm font-semibold">
              <History className="size-4 text-primary" /> Audit trail
            </h3>
            <ol className="relative space-y-4 border-l pl-5">
              {history.map((l) => (
                <li key={l.id} className="relative">
                  <span className="absolute -left-[25px] top-1 size-2.5 rounded-full border-2 border-card bg-primary" />
                  <p className="text-sm font-semibold">{l.action}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.userName} · {fmtDateTime(l.timestamp)}
                  </p>
                  {l.details && <p className="mt-1 rounded-lg bg-muted px-2.5 py-1.5 text-xs">{l.details}</p>}
                </li>
              ))}
              {history.length === 0 && <li className="text-xs text-muted-foreground">No logged activity for this record.</li>}
            </ol>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Detail({ label, value, full }: { label: string; value: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
