import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CalendarDays, Clock, Info, Lock, Save } from "lucide-react";
import { format } from "date-fns";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, Panel } from "@/components/ovms/page-header";
import { VisitorFields, emptyVisitorInput, resolvePurpose } from "@/components/ovms/visitor-fields";
import { useOvms } from "@/lib/ovms/store";
import { pageHead } from "@/lib/ovms/head";
import { validateVisitor, type VisitorInput } from "@/lib/ovms/validation";

export const Route = createFileRoute("/_authenticated/register")({
  head: () => pageHead("Register Visitor", "Register a new office visitor and record their time-in."),
  component: RegisterVisitor,
});

function RegisterVisitor() {
  const { registerVisitor } = useOvms();
  const navigate = useNavigate();
  const [values, setValues] = useState<VisitorInput>(emptyVisitorInput);
  const [touched, setTouched] = useState<Partial<Record<keyof VisitorInput, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const allErrors = validateVisitor(values);
  const errors = Object.fromEntries(
    Object.entries(allErrors).filter(([k]) => submitted || touched[k as keyof VisitorInput]),
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(allErrors).length) {
      toast.error("Please fix the highlighted fields.");
      return;
    }
    const v = registerVisitor({ fullName: values.fullName, contact: values.contact, purpose: resolvePurpose(values), host: values.host });
    toast.success(`${v.fullName} timed in at ${format(new Date(v.timeIn), "h:mm a")}`, {
      description: `Record ${v.id} saved.`,
      action: { label: "View list", onClick: () => navigate({ to: "/current-visitors" }) },
    });
    setValues(emptyVisitorInput);
    setTouched({});
    setSubmitted(false);
  };

  return (
    <>
      <PageHeader eyebrow="Front desk" title="Register Visitor" description="Fields marked * are required. Date and time-in are recorded automatically." />
      <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Panel className="p-5 sm:p-6">
          <VisitorFields
            values={values}
            errors={errors}
            onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
            onBlur={(f) => setTouched((t) => ({ ...t, [f]: true }))}
          />
        </Panel>

        <div className="space-y-4">
          <Panel className="p-5">
            <p className="mb-4 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <Lock className="size-3.5" /> Auto-filled
            </p>
            <div className="space-y-4">
              <div>
                <Label htmlFor="date" className="mb-1.5 block">Date</Label>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="date" readOnly value={format(now, "MMMM d, yyyy")} className="h-11 cursor-not-allowed rounded-lg bg-muted pl-9" />
                </div>
              </div>
              <div>
                <Label htmlFor="timein" className="mb-1.5 block">Time-in</Label>
                <div className="relative">
                  <Clock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="timein" readOnly value={format(now, "h:mm:ss a")} className="tabular h-11 cursor-not-allowed rounded-lg bg-muted pl-9 font-mono" />
                </div>
              </div>
            </div>
            <Button type="submit" size="lg" className="mt-6 w-full">
              <Save /> Save &amp; Time-In
            </Button>
          </Panel>
          <div className="flex gap-2.5 rounded-xl bg-secondary px-4 py-3 text-xs text-secondary-foreground">
            <Info className="mt-0.5 size-4 shrink-0" />
            Contact numbers are stored securely and shown masked in search results.
          </div>
        </div>
      </form>
    </>
  );
}
