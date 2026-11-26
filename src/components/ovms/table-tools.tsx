import { useState } from "react";
import { ArrowDownUp, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { selectTableRows } from "@/lib/ovms/table-data";

type Field<T> = { label: string; value: (row: T) => string | number };
export function useTableData<T>(rows: T[], fields: Field<T>[], search: (row: T) => string) {
  const [query, setQuery] = useState("");
  const [field, setField] = useState("0");
  const [descending, setDescending] = useState(false);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const accessor = fields[Number(field)]?.value;
  const compare = (a: T, b: T) => {
    const av = accessor?.(a) ?? "", bv = accessor?.(b) ?? "";
    return typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), undefined, { numeric: true });
  };
  const result = selectTableRows(rows, query, search, compare, descending, page, size);
  const controls = (
    <div data-print-hide className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
      <div className="relative min-w-40 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input aria-label="Search table" placeholder="Search records" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} className="h-9 pl-9" />
      </div>
      <Select value={field} onValueChange={(v) => { setField(v); setPage(1); }}>
        <SelectTrigger aria-label="Sort by" className="h-9 w-40"><SelectValue /></SelectTrigger>
        <SelectContent>{fields.map((f, i) => <SelectItem key={f.label} value={String(i)}>Sort: {f.label}</SelectItem>)}</SelectContent>
      </Select>
      <Button variant="outline" size="icon" aria-label={descending ? "Sort ascending" : "Sort descending"} title={descending ? "Sort ascending" : "Sort descending"} onClick={() => { setDescending((d) => !d); setPage(1); }}><ArrowDownUp /></Button>
      <Select value={String(size)} onValueChange={(v) => { setSize(Number(v)); setPage(1); }}>
        <SelectTrigger aria-label="Rows per page" className="h-9 w-24"><SelectValue /></SelectTrigger>
        <SelectContent>{[10, 20, 50].map((n) => <SelectItem key={n} value={String(n)}>{n} rows</SelectItem>)}</SelectContent>
      </Select>
      <span className="whitespace-nowrap text-xs text-muted-foreground" aria-live="polite">{result.total} records · {result.page}/{result.pages}</span>
      <Button variant="ghost" size="icon" aria-label="Previous page" disabled={result.page <= 1} onClick={() => setPage(result.page - 1)}><ChevronLeft /></Button>
      <Button variant="ghost" size="icon" aria-label="Next page" disabled={result.page >= result.pages} onClick={() => setPage(result.page + 1)}><ChevronRight /></Button>
    </div>
  );
  return { ...result, controls };
}