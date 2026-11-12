import { Search, X } from "lucide-react";
import { isSameDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { visitorStatus } from "@/lib/ovms/format";
import { PURPOSES, type Visitor } from "@/lib/ovms/types";

export interface VisitorFilterState {
  q: string;
  date: string;
  status: string;
  purpose: string;
}

export const emptyFilters: VisitorFilterState = { q: "", date: "", status: "all", purpose: "all" };

export function applyVisitorFilters(list: Visitor[], f: VisitorFilterState) {
  const q = f.q.trim().toLowerCase();
  return list
    .filter((v) => !q || v.fullName.toLowerCase().includes(q) || v.id.toLowerCase().includes(q))
    .filter((v) => !f.date || isSameDay(new Date(v.timeIn), new Date(`${f.date}T00:00:00`)))
    .filter((v) => f.status === "all" || visitorStatus(v) === f.status)
    .filter((v) =>
      f.purpose === "all" ? true : f.purpose === "Other" ? v.purpose.startsWith("Other") : v.purpose === f.purpose,
    )
    .sort((a, b) => b.timeIn.localeCompare(a.timeIn));
}

export function VisitorFilters({
  value,
  onChange,
  statuses,
}: {
  value: VisitorFilterState;
  onChange: (v: VisitorFilterState) => void;
  statuses: string[];
}) {
  const dirty = value.q || value.date || value.status !== "all" || value.purpose !== "all";
  return (
    <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr_auto]">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value.q}
          onChange={(e) => onChange({ ...value, q: e.target.value })}
          placeholder="Search by visitor name or record ID"
          className="h-10 rounded-lg pl-9"
          aria-label="Search by name"
        />
      </div>
      <Input
        type="date"
        value={value.date}
        onChange={(e) => onChange({ ...value, date: e.target.value })}
        className="h-10 rounded-lg"
        aria-label="Filter by date"
      />
      <Select value={value.status} onValueChange={(s) => onChange({ ...value, status: s })}>
        <SelectTrigger className="h-10 rounded-lg" aria-label="Status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {statuses.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={value.purpose} onValueChange={(p) => onChange({ ...value, purpose: p })}>
        <SelectTrigger className="h-10 rounded-lg" aria-label="Purpose">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All purposes</SelectItem>
          {PURPOSES.map((p) => (
            <SelectItem key={p} value={p}>
              {p}
            </SelectItem>
          ))}
          <SelectItem value="Other">Other</SelectItem>
        </SelectContent>
      </Select>
      <Button variant="ghost" className="h-10" onClick={() => onChange(emptyFilters)} disabled={!dirty}>
        <X /> Clear
      </Button>
    </div>
  );
}
