import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarCheck, DoorOpen, Users } from "lucide-react";
import { eachDayOfInterval, format, formatDistanceToNow, isSameDay, isToday, subDays } from "date-fns";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { PageHeader, Panel, PanelHeader } from "@/components/ovms/page-header";
import { StatCard } from "@/components/ovms/stat-card";
import { ActionBadge } from "@/components/ovms/badges";
import { useOvms } from "@/lib/ovms/store";
import { pageHead } from "@/lib/ovms/head";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => pageHead("Admin Dashboard", "Visitor totals, daily visits and recent activity for administrators."),
  component: AdminDashboard,
});

const chartConfig = { visits: { label: "Visits", color: "var(--chart-1)" } } satisfies ChartConfig;

function AdminDashboard() {
  const { state } = useOvms();
  const now = new Date();
  const total = state.visitors.length;
  const current = state.visitors.filter((v) => !v.archived && !v.timeOut).length;
  const daily = state.visitors.filter((v) => isToday(new Date(v.timeIn))).length;
  const days = eachDayOfInterval({ start: subDays(now, 6), end: now }).map((d) => ({
    day: format(d, "EEE"),
    visits: state.visitors.filter((v) => isSameDay(new Date(v.timeIn), d)).length,
  }));

  return (
    <>
      <PageHeader eyebrow={format(now, "EEEE, MMMM d, yyyy")} title="Admin Dashboard" description="Office-wide visitor overview." />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total visitors" value={total} hint="All records on file" icon={Users} />
        <StatCard label="Current visitors" value={current} hint="Inside the office now" icon={DoorOpen} tone="dark" />
        <StatCard label="Daily visitors" value={daily} hint="Registered today" icon={CalendarCheck} tone="live" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel>
          <PanelHeader title="Daily visits" description="Last 7 days" actions={
            <Button asChild variant="ghost" size="sm"><Link to="/admin/reports">Reports <ArrowRight /></Link></Button>
          } />
          <div className="p-4">
            <ChartContainer config={chartConfig} className="h-[240px] w-full">
              <BarChart data={days} margin={{ left: -20, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <ChartTooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltipContent />} />
                <Bar dataKey="visits" fill="var(--color-visits)" radius={[8, 8, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ChartContainer>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Recent activity" actions={
            <Button asChild variant="ghost" size="sm"><Link to="/admin/logs">All logs <ArrowRight /></Link></Button>
          } />
          <ul className="divide-y">
            {state.logs.slice(0, 7).map((l) => (
              <li key={l.id} className="flex items-start gap-3 px-5 py-3">
                <div className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{l.userName}</span>
                    <ActionBadge action={l.action} />
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {l.recordId && <span className="font-mono">{l.recordId} · </span>}
                    {l.details ?? "—"}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {formatDistanceToNow(new Date(l.timestamp), { addSuffix: true })}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
