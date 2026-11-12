import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Clock, LogOut, ShieldCheck, TimerReset } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RoleBadge } from "./badges";
import { initials } from "@/lib/ovms/format";
import { navForRole } from "@/lib/ovms/nav";
import { useOvms } from "@/lib/ovms/store";
import type { StaffUser } from "@/lib/ovms/types";
import { cn } from "@/lib/utils";

export const IDLE_LIMIT_MS = 5 * 60 * 1000;
export const IDLE_WARNING_MS = 60 * 1000;

function useIdleTimer(onExpire: () => void) {
  const last = useRef(Date.now());
  const warning = useRef(false);
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;
  const [remaining, setRemaining] = useState(IDLE_LIMIT_MS);

  useEffect(() => {
    const bump = () => {
      if (!warning.current) last.current = Date.now();
    };
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const id = window.setInterval(() => {
      const r = IDLE_LIMIT_MS - (Date.now() - last.current);
      warning.current = r <= IDLE_WARNING_MS;
      setRemaining(r);
      if (r <= 0) expireRef.current();
    }, 1000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      window.clearInterval(id);
    };
  }, []);

  const reset = () => {
    last.current = Date.now();
    warning.current = false;
    setRemaining(IDLE_LIMIT_MS);
  };
  return { remaining, reset };
}

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function AppSidebar({ user, onLogout }: { user: StaffUser; onLogout: () => void }) {
  const { state, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const items = navForRole(user.role);

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="px-3 pt-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-neon">
            <ShieldCheck className="size-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-bold text-sidebar-accent-foreground">OVMS</p>
              <p className="truncate text-[11px] text-sidebar-foreground/70">Office Visitor Management</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-1 pt-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.16em] text-sidebar-foreground/50">
            {user.role === "admin" ? "Administration" : "Front desk"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {items.map((item) => {
                const active = pathname === item.to || pathname === `${item.to}/`;
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                      className={cn(
                        "h-10 rounded-lg font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        "data-[active=true]:bg-sidebar-primary data-[active=true]:font-semibold data-[active=true]:text-sidebar-primary-foreground",
                      )}
                    >
                      <Link to={item.to} onClick={() => setOpenMobile(false)}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        {!collapsed && (
          <div className="mb-2 rounded-xl bg-sidebar-accent p-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-sidebar-foreground/60">Logged in as</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-sidebar-accent-foreground">{user.name}</p>
            <p className="truncate font-mono text-[11px] text-sidebar-foreground/70">@{user.username}</p>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Log out"
              onClick={onLogout}
              className="h-10 rounded-lg text-sidebar-foreground hover:bg-destructive hover:text-destructive-foreground"
            >
              <LogOut />
              <span>Log out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppShell({ user, children }: { user: StaffUser; children: ReactNode }) {
  const { logout, expireSession } = useOvms();
  const navigate = useNavigate();
  const { remaining, reset } = useIdleTimer(expireSession);
  const warningOpen = remaining <= IDLE_WARNING_MS && remaining > 0;

  const handleLogout = () => {
    logout();
    toast.success("You have been logged out.");
    navigate({ to: "/" });
  };

  return (
    <SidebarProvider>
      <AppSidebar user={user} onLogout={handleLogout} />
      <SidebarInset className="min-w-0 bg-background">
        <header data-print-hide className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-card/90 px-3 backdrop-blur sm:px-5">
          <SidebarTrigger className="size-9" />
          <div className="hidden h-6 w-px bg-border sm:block" />
          <div
            className={cn(
              "hidden items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium md:flex",
              warningOpen ? "bg-warning-soft text-warning-foreground" : "bg-muted text-muted-foreground",
            )}
            title="You are logged out automatically after 5 minutes of inactivity"
          >
            <Clock className="size-3.5" />
            Auto-logout in <span className="tabular font-mono">{mmss(remaining)}</span>
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <div className="hidden text-right leading-tight sm:block">
              <p className="text-[11px] text-muted-foreground">Logged in as</p>
              <p className="text-sm font-semibold">{user.name}</p>
            </div>
            <RoleBadge role={user.role} />
            <div className="hidden size-9 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground sm:flex">
              {initials(user.name)}
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Log out" title="Log out">
              <LogOut />
            </Button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </SidebarInset>

      <Dialog open={warningOpen} onOpenChange={(o) => !o && reset()}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <div className="mb-2 flex size-12 items-center justify-center rounded-2xl bg-warning-soft text-warning-foreground">
              <TimerReset className="size-6" />
            </div>
            <DialogTitle>Are you still there?</DialogTitle>
            <DialogDescription>
              For security, you'll be logged out automatically in{" "}
              <span className="tabular font-mono font-semibold text-foreground">{mmss(remaining)}</span> due to
              inactivity.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleLogout}>
              Log out now
            </Button>
            <Button onClick={reset}>Stay signed in</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}

export function SessionExpiredScreen() {
  const { clearExpired } = useOvms();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-brand-gradient">
      <div className="grid-dots min-h-screen">
        <Dialog open>
          <DialogContent className="rounded-2xl sm:max-w-md [&>button]:hidden" onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <div className="mb-2 flex size-12 items-center justify-center rounded-2xl bg-destructive-soft text-destructive">
                <Clock className="size-6" />
              </div>
              <DialogTitle>Session expired</DialogTitle>
              <DialogDescription>
                Your session expired, please log in again. Unsaved changes were not kept.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                className="w-full"
                onClick={() => {
                  clearExpired();
                  navigate({ to: "/" });
                }}
              >
                Log in again
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

export function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
