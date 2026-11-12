import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertCircle, Eye, EyeOff, Lock, ShieldCheck, User } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOvms } from "@/lib/ovms/store";
import { homeForRole } from "@/lib/ovms/rules";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — Office Visitor Management System" },
      { name: "description", content: "Secure sign-in for office staff and administrators to manage the digital visitor logbook." },
      { property: "og:title", content: "Sign in — Office Visitor Management System" },
      { property: "og:description", content: "Secure sign-in for office staff and administrators to manage the digital visitor logbook." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { login, hydrated, currentUser } = useOvms();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (hydrated && currentUser) navigate({ to: homeForRole(currentUser.role) });
  }, [hydrated, currentUser, navigate]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!username.trim() || !password) {
      setError("Enter your username and password.");
      return;
    }
    const result = login(username, password);
    if (!result.ok) {
      setError(result.error);
      setPassword("");
      return;
    }
    toast.success(`Welcome back, ${result.user.name.split(" ")[0]}`);
    navigate({ to: homeForRole(result.user.role) });
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-brand-gradient p-12 text-primary-foreground lg:flex lg:flex-col">
        <div className="grid-dots pointer-events-none absolute inset-0" />
        <div className="relative flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-neon text-neon-foreground shadow-neon">
            <ShieldCheck className="size-6" />
          </div>
          <div className="leading-tight">
            <p className="font-bold">OVMS</p>
            <p className="text-xs text-primary-foreground/70">Office Visitor Management System</p>
          </div>
        </div>
        <div className="relative mt-auto max-w-lg">
          <p className="mb-4 inline-flex rounded-full bg-primary-foreground/10 px-3 py-1 text-xs font-medium ring-1 ring-primary-foreground/20">
            Replacing the paper logbook
          </p>
          <h1 className="text-5xl font-extrabold leading-[1.05]">
            Every visitor, <span className="text-neon">accounted for.</span>
          </h1>
          <p className="mt-5 text-base text-primary-foreground/75">
            Register visitors, record time-in and time-out, and keep a tamper-evident audit trail — all from the front
            desk.
          </p>
          <div className="mt-10 grid grid-cols-3 gap-3">
            {[
              ["Role-based", "access"],
              ["Masked", "contact data"],
              ["Logged", "every change"],
            ].map(([a, b]) => (
              <div key={a} className="rounded-xl bg-primary-foreground/8 p-4 ring-1 ring-primary-foreground/15">
                <p className="text-sm font-semibold text-neon">{a}</p>
                <p className="text-xs text-primary-foreground/70">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main className="flex items-center justify-center bg-background px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <ShieldCheck className="size-5" />
            </div>
            <div className="leading-tight">
              <p className="font-bold">OVMS</p>
              <p className="text-xs text-muted-foreground">Office Visitor Management System</p>
            </div>
          </div>

          <h2 className="text-3xl font-bold">Sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">Use the account issued by your office administrator.</p>

          <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
            {error && (
              <div role="alert" className="flex gap-2.5 rounded-xl border border-destructive/30 bg-destructive-soft px-3.5 py-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {error}
              </div>
            )}
            <div>
              <Label htmlFor="username" className="mb-1.5 block">Username</Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError(null);
                  }}
                  placeholder="e.g. msantos"
                  className={cn("h-11 rounded-lg bg-card pl-9", touched && !username.trim() && "border-destructive")}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="password" className="mb-1.5 block">Password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="••••••••"
                  className={cn("h-11 rounded-lg bg-card px-9", touched && !password && "border-destructive")}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={!hydrated}>
              Sign in
            </Button>
          </form>

          <p className="mt-6 flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Lock className="size-3.5" /> Authorized personnel only. All activity is logged.
          </p>

          <div className="mt-8 rounded-xl border border-dashed bg-card p-4 text-xs">
            <p className="mb-2 font-semibold text-foreground">Prototype accounts</p>
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-muted-foreground">
              <span className="font-sans font-medium text-foreground">Receptionist</span>
              <span>msantos / Staff@2026</span>
              <span className="font-sans font-medium text-foreground">Administrator</span>
              <span>rvillanueva / Admin@2026</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
