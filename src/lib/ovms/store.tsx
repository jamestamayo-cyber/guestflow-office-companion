import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { officeService, type StaffResult, type VisitorFields } from "@/services/ovms";
import type { AuthResult } from "./rules";
import type { AppState, Role, StaffUser, Visitor } from "./types";

interface Store {
  hydrated: boolean;
  loading: boolean;
  error: string | null;
  retry: () => Promise<void>;
  state: AppState;
  currentUser: StaffUser | null;
  sessionExpired: boolean;
  login: (username: string, password: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  expireSession: () => Promise<void>;
  touchSession: () => Promise<void>;
  clearExpired: () => void;
  registerVisitor: (input: VisitorFields) => Promise<Visitor>;
  checkOut: (id: string) => Promise<void>;
  editVisitor: (id: string, changes: VisitorFields, reason: string) => Promise<void>;
  archiveVisitors: (ids: string[]) => Promise<void>;
  restoreVisitors: (ids: string[]) => Promise<void>;
  addStaff: (input: { name: string; username: string; role: Role; password: string }) => Promise<StaffResult>;
  updateStaff: (id: string, input: { name: string; username: string; role: Role }) => Promise<StaffResult>;
  setStaffStatus: (id: string, status: StaffUser["status"]) => Promise<void>;
  resetPassword: (id: string) => Promise<string>;
  logExport: (details: string) => Promise<void>;
}
const Ctx = createContext<Store | null>(null);
export function OvmsProvider({ children }: { children: ReactNode }) {
  const [initialCache] = useState(() => officeService.getInitialCache());
  const [state, setState] = useState<AppState>(initialCache.state);
  const [hydrated, setHydrated] = useState(initialCache.cached);
  const [loading, setLoading] = useState(!initialCache.cached);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const expiryRunning = useRef(false);
  const retry = useCallback(async () => {
    if (!initialCache.cached) setLoading(true);
    setError(null);
    try { setState(await officeService.load()); setHydrated(true); }
    catch (e) {
      const message = e instanceof Error ? e.message : "Records could not be loaded. Please retry.";
      setError(message);
      setHydrated(true);
      toast.error(message);
    }
    finally { setLoading(false); }
  }, [initialCache.cached]);
  useEffect(() => {
    void retry();
    const refresh = () => { void retry(); };
    const timer = window.setInterval(() => {
      if (navigator.onLine) void retry();
    }, 30_000);
    window.addEventListener("online", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [retry]);
  const run = useCallback(async <T,>(action: () => Promise<{ state: AppState; result: T }>) => {
    try {
      const next = await action();
      setState(next.state);
      setError(null);
      if ("queued" in next && next.queued) toast.info("Saved on this device and queued for sync.");
      return next.result;
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "This change could not be saved. Please retry.";
      toast.error(message);
      throw e;
    }
  }, []);
  const store = useMemo<Store>(() => ({
    hydrated, loading, error, retry, state, sessionExpired,
    currentUser: state.users.find((u) => u.id === state.session?.userId && u.status === "active") ?? null,
    login: async (username, password) => {
      const result = await run(() => officeService.login(username, password));
      if (result.ok) {
        setSessionExpired(false);
        expiryRunning.current = false;
        if (
          typeof navigator !== "undefined" &&
          navigator.onLine &&
          officeService.getPendingSyncCount() > 0
        ) {
          void officeService
            .syncOfflineQueue()
            .then(async () => setState(await officeService.load()))
            .catch((error: unknown) => {
              console.error("Queued offline changes could not be synced after sign-in.", error);
            });
        }
      }
      return result;
    },
    logout: () => run(() => officeService.logout()),
    expireSession: async () => { if (expiryRunning.current) return; expiryRunning.current = true; try { await run(() => officeService.logout(true)); setSessionExpired(true); } catch { expiryRunning.current = false; } },
    touchSession: () => run(() => officeService.touchSession()),
    clearExpired: () => setSessionExpired(false),
    registerVisitor: (input) => run(() => officeService.registerVisitor(input)),
    checkOut: (id) => run(() => officeService.checkOut(id)),
    editVisitor: (id, changes, reason) => run(() => officeService.editVisitor(id, changes, reason)),
    archiveVisitors: (ids) => run(() => officeService.archiveVisitors(ids)),
    restoreVisitors: (ids) => run(() => officeService.restoreVisitors(ids)),
    addStaff: (input) => run(() => officeService.addStaff(input)),
    updateStaff: (id, input) => run(() => officeService.updateStaff(id, input)),
    setStaffStatus: (id, status) => run(() => officeService.setStaffStatus(id, status)),
    resetPassword: (id) => run(() => officeService.resetPassword(id)),
    logExport: (details) => run(() => officeService.logExport(details)),
  }), [state, hydrated, loading, error, retry, sessionExpired, run]);
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
export function useOvms() { const ctx = useContext(Ctx); if (!ctx) throw new Error("useOvms must be used inside OvmsProvider"); return ctx; }
export function useCurrentUser() { const { currentUser } = useOvms(); if (!currentUser) throw new Error("No signed-in user"); return currentUser; }
