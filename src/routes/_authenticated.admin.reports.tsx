import { createFileRoute } from "@tanstack/react-router";
import { CalendarRange, Clock, FileDown, FileText, TrendingUp, Users } from "lucide-react";
import {
  differenceInMinutes,
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, Panel, PanelHeader } from "@/components/ovms/page-header";
import { StatCard } from "@/components/ovms/stat-card";
import { useOvms } from "@/lib/ovms/store";
import { fmtDate, fmtDuration, fmtTime } from "@/lib/ovms/format";
import { pageHead } from "@/lib/ovms/head";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  head: () => pageHead("Reports", "Daily, weekly and monthly visitor reports with CSV and PDF export."),
  component: Reports,
});

type Period = "daily" | "weekly" | "monthly";
const chartConfig = { visits: { label: "Visits", color: "var(--chart-1)" } } satisfies ChartConfig;

function defaultRange(p: Period): DateRange {
  const now = new Date();
  if (p === "daily") return { from: subDays(now, 6), to: now };
  if (p === "weekly") return { from: subWeeks(now, 7), to: now };
  return { from: subMonths(now, 11), to: now };
}

function Reports() {
  const { state, logExport } = useOvms();
  const [period, setPeriod] = useState<Period>("daily");
  const [range, setRange] = useState<DateRange | undefined>(() => defaultRange("daily"));
  const from = startOfDay(range?.from ?? new Date());
  const to = endOfDay(range?.to ?? range?.from ?? new Date());

  const rows = state.visitors
    .filter((v) => {
      const t = new Date(v.timeIn);
      return t >= from && t <= to;
    })
    .sort((a, b) => b.timeIn.localeCompare(a.timeIn));

  const buckets =
    period === "daily"
      ? eachDayOfInterval({ start: from, end: to }).map((d) => ({ label: format(d, "MMM d"), start: startOfDay(d), end: endOfDay(d) }))
      : period === "weekly"
        ? eachWeekOfInterval({ start: from, end: to }).map((d) => ({ label: `Wk of ${format(d, "MMM d")}`, start: startOfWeek(d), end: endOfWeek(d) }))
        : eachMonthOfInterval({ start: from, end: to }).map((d) => ({ label: format(d, "MMM yy"), start: startOfMonth(d), end: endOfMonth(d) }));
  const chart = buckets.map((b) => ({
    label: b.label,
    visits: rows.filter((v) => new Date(v.timeIn) >= b.start && new Date(v.timeIn) <= b.end).length,
  }));

  const done = rows.filter((v) => v.timeOut);
  const avg = done.length
    ? Math.round(done.reduce((s, v) => s + differenceInMinutes(new Date(v.timeOut!), new Date(v.timeIn)), 0) / done.length)
    : 0;
  const purposeCounts = rows.reduce<Record<string, number>>((acc, v) => {
    const k = v.purpose.startsWith("Other") ? "Other" : v.purpose;
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const topPurpose = Object.entries(purposeCounts).sort((a, b) => b[1] - a[1])[0];
  const busiest = [...chart].sort((a, b) => b.visits - a.visits)[0];
  const label = `${period[0].toUpperCase()}${period.slice(1)} report, ${format(from, "MMM d, yyyy")} – ${format(to, "MMM d, yyyy")}`;

  const exportCsv = () => {
    const header = ["Record ID", "Visitor", "Purpose", "Host", "Time-in", "Time-out", "Duration"];
    const lines = rows.map((v) =>
      [v.id, v.fullName, v.purpose, v.host, format(new Date(v.timeIn), "yyyy-MM-dd HH:mm"), v.timeOut ? format(new Date(v.timeOut), "yyyy-MM-dd HH:mm") : "", fmtDuration(v.timeIn, v.timeOut)]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `visitor-report-${period}-${format(from, "yyyyMMdd")}-${format(to, "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    logExport(`${label} (CSV)`);
    toast.success("CSV exported", { description: `${rows.length} records downloaded.` });
  };

  const exportPdf = () => {
    logExport(`${label} (PDF)`);
    toast.success("Preparing PDF", { description: "Choose “Save as PDF” in the print dialog." });
    window.setTimeout(() => window.print(), 300);
  };

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Reports"
        description={label}
        actions={
          <div data-print-hide className="flex gap-2">
            <Button variant="outline" onClick={exportCsv}><FileDown /> Export CSV</Button>
            <Button onClick={exportPdf}><FileText /> Export PDF</Button>
          </div>
        }
      />

      <div data-print-hide className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Tabs
          value={period}
          onValueChange={(p) => {
            setPeriod(p as Period);
            setRange(defaultRange(p as Period));
          }}
        >
          <TabsList className="h-10 rounded-lg">
            <TabsTrigger value="daily" className="rounded-md px-4">Daily</TabsTrigger>
            <TabsTrigger value="weekly" className="rounded-md px-4">Weekly</TabsTrigger>
            <TabsTrigger value="monthly" className="rounded-md px-4">Monthly</TabsTrigger>
          </TabsList>
        </Tabs>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-10 justify-start bg-card font-medium">
              <CalendarRange className="text-primary" />
              {format(from, "MMM d, yyyy")} – {format(to, "MMM d, yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="range" selected={range} onSelect={setRange} numberOfMonths={1} defaultMonth={range?.from} disabled={{ after: new Date() }} />
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total visits" value={rows.length} hint="In selected range" icon={Users} tone="dark" />
        <StatCard label="Avg. visit duration" value={avg ? (avg >= 60 ? `${Math.floor(avg / 60)}h ${avg % 60}m` : `${avg}m`) : "—"} hint="Checked-out visits only" icon={Clock} />
        <StatCard label={period === "daily" ? "Busiest day" : period === "weekly" ? "Busiest week" : "Busiest month"} value={busiest?.visits ? busiest.label : "—"} hint={busiest?.visits ? `${busiest.visits} visits` : "No visits"} icon={TrendingUp} />
        <StatCard label="Top purpose" value={topPurpose ? topPurpose[1] : 0} hint={topPurpose ? topPurpose[0] : "No visits"} icon={FileText} tone="live" />
      </div>

      <Panel className="mt-6">
        <PanelHeader title="Visits over time" description={`Grouped ${period === "daily" ? "by day" : period === "weekly" ? "by week" : "by month"}`} />
        <div className="p-4">
          <ChartContainer config={chartConfig} className="h-[260px] w-full">
            <BarChart data={chart} margin={{ left: -20, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={12} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <ChartTooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltipContent />} />
              <Bar dataKey="visits" fill="var(--color-visits)" radius={[6, 6, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ChartContainer>
        </div>
      </Panel>

      <Panel className="mt-6 overflow-hidden">
        <PanelHeader title="Report preview" description={`${rows.length} records`} />
        <div className="overflow-x-auto">
          <Table className="min-w-[820px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Date</TableHead>
                <TableHead>Visitor</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Host</TableHead>
                <TableHead>Time-in</TableHead>
                <TableHead>Time-out</TableHead>
                <TableHead className="pr-5">Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="pl-5 tabular">{fmtDate(v.timeIn)}</TableCell>
                  <TableCell className="font-semibold">{v.fullName}</TableCell>
                  <TableCell>{v.purpose}</TableCell>
                  <TableCell className="max-w-[180px] truncate">{v.host}</TableCell>
                  <TableCell className="tabular">{fmtTime(v.timeIn)}</TableCell>
                  <TableCell className="tabular">{v.timeOut ? fmtTime(v.timeOut) : "—"}</TableCell>
                  <TableCell className="pr-5 tabular">{fmtDuration(v.timeIn, v.timeOut)}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No visits in this range.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Panel>
    </>
  );
}
