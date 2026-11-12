import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createSeed } from "./seed";
import { authenticate, type AuthResult } from "./rules";
import { toLocalPhone } from "./format";
import type { ActivityLog, AppState, LogAction, Role, StaffUser, Visitor } from "./types";

const STORAGE_KEY = "ovms-prototype-v1";

type VisitorFields = Pick<Visitor, "fullName" | "contact" | "purpose" | "host">;

interface Store {
  hydrated: boolean;
  state: AppState;
  currentUser: StaffUser | null;
  sessionExpired: boolean;
  login: (username: string, password: string) => AuthResult;
  logout: () => void;
  expireSession: () => void;
  clearExpired: () => void;
  registerVisitor: (input: VisitorFields) => Visitor;
  checkOut: (id: string) => void;
  editVisitor: (id: string, changes: VisitorFields, reason: string) => void;
  archiveVisitors: (ids: string[]) => void;
  restoreVisitors: (ids: string[]) => void;
  addStaff: (input: { name: string; username: string; role: Role; password: string }) => { ok: boolean; error?: string };
  updateStaff: (id: string, input: { name: string; username: string; role: Role }) => { ok: boolean; error?: string };
  setStaffStatus: (id: string, status: StaffUser["status"]) => void;
  resetPassword: (id: string) => string;
  logExport: (details: string) => void;
}

const Ctx = createContext<Store | null>(null);

function pushLog(s: AppState, action: LogAction, extra: Partial<ActivityLog> = {}) {
  const user = s.users.find((u) => u.id === s.session?.userId);
  s.seq.log += 1;
  s.logs.unshift({
    id: `LOG-${String(s.seq.log).padStart(5, "0")}`,
    timestamp: new Date().toISOString(),
    userId: user?.id ?? "system",
    userName: user?.name ?? "System",
    action,
    ...extra,
  });
}

function tempPassword() {
  const words = ["Green", "Office", "Visit", "Secure", "Ledger"];
  const w = words[Math.floor(Math.random() * words.length)];
  return `${w}#${Math.floor(1000 + Math.random() * 9000)}`;
}

export function OvmsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => createSeed());
  const [hydrated, setHydrated] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const ref = useRef(state);

  useEffect(() => {
    let next: AppState = createSeed();
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) next = JSON.parse(raw) as AppState;
    } catch {
      /* fall back to seed */
    }
    ref.current = next;
    setState(next);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const commit = useCallback((mut: (s: AppState) => void) => {
    const next = structuredClone(ref.current);
    mut(next);
    ref.current = next;
    setState(next);
  }, []);

  const store = useMemo<Store>(() => {
    const currentUser = state.users.find((u) => u.id === state.session?.userId) ?? null;
    return {
      hydrated,
      state,
      currentUser,
      sessionExpired,
      login: (username, password) => {
        const result = authenticate(ref.current.users, username, password);
        if (result.ok) {
          setSessionExpired(false);
          commit((s) => {
            s.session = { userId: result.user.id, startedAt: new Date().toISOString() };
            const u = s.users.find((x) => x.id === result.user.id);
            if (u) u.lastLoginAt = new Date().toISOString();
            pushLog(s, "Login");
          });
        }
        return result;
      },
      logout: () =>
        commit((s) => {
          pushLog(s, "Logout");
          s.session = null;
        }),
      expireSession: () => {
        setSessionExpired(true);
        commit((s) => {
          pushLog(s, "Session expired", { details: "Auto-logout after inactivity" });
          s.session = null;
        });
      },
      clearExpired: () => setSessionExpired(false),
      registerVisitor: (input) => {
        let created!: Visitor;
        commit((s) => {
          s.seq.visitor += 1;
          created = {
            id: `VIS-${String(s.seq.visitor).padStart(4, "0")}`,
            fullName: input.fullName.trim(),
            contact: toLocalPhone(input.contact),
            purpose: input.purpose,
            host: input.host.trim(),
            timeIn: new Date().toISOString(),
            timeOut: null,
            archived: false,
            registeredBy: s.session?.userId ?? "system",
          };
          s.visitors.push(created);
          pushLog(s, "Registered visitor", { recordId: created.id, details: `${created.fullName} → ${created.host}` });
        });
        return created;
      },
      checkOut: (id) =>
        commit((s) => {
          const v = s.visitors.find((x) => x.id === id);
          if (!v || v.timeOut) return;
          v.timeOut = new Date().toISOString();
          pushLog(s, "Checked-out visitor", { recordId: id, details: v.fullName });
        }),
      editVisitor: (id, changes, reason) =>
        commit((s) => {
          const v = s.visitors.find((x) => x.id === id);
          if (!v) return;
          const labels: Record<keyof VisitorFields, string> = { fullName: "Name", contact: "Contact", purpose: "Purpose", host: "Host" };
          const normalized = { ...changes, contact: toLocalPhone(changes.contact) };
          const diffs = (Object.keys(labels) as (keyof VisitorFields)[])
            .filter((k) => v[k] !== normalized[k])
            .map((k) => `${labels[k]}: "${v[k]}" → "${normalized[k]}"`);
          Object.assign(v, normalized);
          pushLog(s, "Edited visitor", { recordId: id, details: `${diffs.join("; ") || "No field changes"}. Reason: ${reason.trim()}` });
        }),
      archiveVisitors: (ids) =>
        commit((s) => {
          ids.forEach((id) => {
            const v = s.visitors.find((x) => x.id === id);
            if (!v || v.archived) return;
            v.archived = true;
            v.archivedAt = new Date().toISOString();
            pushLog(s, "Archived record", { recordId: id, details: v.fullName });
          });
        }),
      restoreVisitors: (ids) =>
        commit((s) => {
          ids.forEach((id) => {
            const v = s.visitors.find((x) => x.id === id);
            if (!v || !v.archived) return;
            v.archived = false;
            v.archivedAt = undefined;
            pushLog(s, "Restored record", { recordId: id, details: v.fullName });
          });
        }),
      addStaff: (input) => {
        const uname = input.username.trim().toLowerCase();
        if (ref.current.users.some((u) => u.username === uname)) return { ok: false, error: "That username is already taken." };
        commit((s) => {
          s.seq.user += 1;
          const id = `U-${String(s.seq.user).padStart(3, "0")}`;
          s.users.push({ id, name: input.name.trim(), username: uname, password: input.password, role: input.role, status: "active", createdAt: new Date().toISOString() });
          pushLog(s, "Added staff", { recordId: id, details: `${input.name.trim()} (${input.role === "admin" ? "Administrator" : "Receptionist"})` });
        });
        return { ok: true };
      },
      updateStaff: (id, input) => {
        const uname = input.username.trim().toLowerCase();
        if (ref.current.users.some((u) => u.username === uname && u.id !== id)) return { ok: false, error: "That username is already taken." };
        commit((s) => {
          const u = s.users.find((x) => x.id === id);
          if (!u) return;
          u.name = input.name.trim();
          u.username = uname;
          u.role = input.role;
          pushLog(s, "Edited staff", { recordId: id, details: u.name });
        });
        return { ok: true };
      },
      setStaffStatus: (id, status) =>
        commit((s) => {
          const u = s.users.find((x) => x.id === id);
          if (!u) return;
          u.status = status;
          pushLog(s, status === "active" ? "Activated staff" : "Deactivated staff", { recordId: id, details: u.name });
        }),
      resetPassword: (id) => {
        const pwd = tempPassword();
        commit((s) => {
          const u = s.users.find((x) => x.id === id);
          if (!u) return;
          u.password = pwd;
          pushLog(s, "Reset password", { recordId: id, details: `${u.name} — temporary password issued` });
        });
        return pwd;
      },
      logExport: (details) => commit((s) => pushLog(s, "Exported report", { details })),
    };
  }, [state, hydrated, sessionExpired, commit]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useOvms() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useOvms must be used inside OvmsProvider");
  return ctx;
}

export function useCurrentUser() {
  const { currentUser } = useOvms();
  if (!currentUser) throw new Error("No signed-in user");
  return currentUser;
}
