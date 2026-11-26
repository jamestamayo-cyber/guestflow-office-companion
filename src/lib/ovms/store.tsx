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
const emptyState: AppState = { users: [], visitors: [], logs: [], session: null, seq: { visitor: 0, log: 0, user: 0 } };
export function OvmsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(emptyState);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const expiryRunning = useRef(false);
  const retry = useCallback(async () => {
    setLoading(true); setError(null);
    try { setState(await officeService.load()); setHydrated(true); }
    catch (e) { const message = e instanceof Error ? e.message : "Records could not be loaded. Please retry."; setError(message); toast.error(message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    void retry();
    const sync = () => { void retry(); };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [retry]);
  const run = useCallback(async <T,>(action: () => Promise<{ state: AppState; result: T }>) => {
    try { const next = await action(); setState(next.state); setError(null); return next.result; }
    catch (e) { const message = e instanceof Error ? e.message : "This change could not be saved. Please retry."; toast.error(message); throw e; }
  }, []);
  const store = useMemo<Store>(() => ({
    hydrated, loading, error, retry, state, sessionExpired,
    currentUser: state.users.find((u) => u.id === state.session?.userId && u.status === "active") ?? null,
    login: async (username, password) => { const result = await run(() => officeService.login(username, password)); if (result.ok) { setSessionExpired(false); expiryRunning.current = false; } return result; },
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
