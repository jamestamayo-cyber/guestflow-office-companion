import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarCheck, DoorOpen, LogOut, UserPlus, Users } from "lucide-react";
import { format, isToday } from "date-fns";
import { PageHeader } from "@/components/ovms/page-header";
import { StatCard } from "@/components/ovms/stat-card";
import { useCurrentUser, useOvms } from "@/lib/ovms/store";
import { pageHead } from "@/lib/ovms/head";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => pageHead("Front Desk Dashboard", "Today's visitor count and quick actions for the reception desk."),
  component: ReceptionDashboard,
});

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function ReceptionDashboard() {
  const user = useCurrentUser();
  const { state } = useOvms();
  const active = state.visitors.filter((v) => !v.archived);
  const todayCount = active.filter((v) => isToday(new Date(v.timeIn))).length;
  const inside = active.filter((v) => !v.timeOut).length;

  return (
    <>
      <PageHeader
        eyebrow={format(new Date(), "EEEE, MMMM d")}
        title={`${greeting()}, ${user.name.split(" ")[0]}`}
        description="Here's what's happening at the front desk today."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Today's visitors" value={todayCount} hint="Registered since the office opened" icon={CalendarCheck} />
        <StatCard label="Currently inside the office" value={inside} hint="Not yet timed out" icon={DoorOpen} tone="dark" />
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">Quick actions</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <Link
          to="/register"
          className="group flex items-center gap-4 rounded-2xl border bg-card p-6 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-elevated"
        >
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <UserPlus className="size-7" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold">Register Visitor</p>
            <p className="text-sm text-muted-foreground">Log a new arrival and record time-in.</p>
          </div>
          <ArrowRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
        </Link>
        <Link
          to="/current-visitors"
          className="group flex items-center gap-4 rounded-2xl border bg-card p-6 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-elevated"
        >
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-neon text-neon-foreground">
            <LogOut className="size-7" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold">Check Out Visitor</p>
            <p className="text-sm text-muted-foreground">
              <Users className="mr-1 inline size-3.5" />
              {inside} {inside === 1 ? "visitor is" : "visitors are"} waiting to be timed out.
            </p>
          </div>
          <ArrowRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
        </Link>
      </div>
    </>
  );
}
