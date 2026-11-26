import { hash } from "bcryptjs";
import { createSeed } from "@/lib/ovms/seed";
import { authenticate, nextLoginFailure, sessionRemaining, type AuthResult } from "@/lib/ovms/rules";
import { toLocalPhone } from "@/lib/ovms/format";
import { isStrongPassword, isValidUsername, validateVisitor } from "@/lib/ovms/validation";
import type { ActivityLog, AppState, LogAction, Role, StaffUser, Visitor } from "@/lib/ovms/types";

export const STORAGE_KEY = "ovms-office-v2";
const LEGACY_KEY = "ovms-prototype-v1";
const delay = () => new Promise<void>((resolve) => setTimeout(resolve, 350));
let queue: Promise<unknown> = Promise.resolve();
export type VisitorFields = Pick<Visitor, "fullName" | "contact" | "purpose" | "host">;
export type StaffResult = { ok: boolean; error?: string };

function read(): AppState | null {
  const raw = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_KEY);
  if (!raw) return null;
  let state: AppState;
  try { state = JSON.parse(raw) as AppState; } catch { throw new Error("Saved records could not be read. Retry or recover your browser storage; no records have been overwritten."); }
  if (!Array.isArray(state.users) || !Array.isArray(state.visitors) || !Array.isArray(state.logs) || !state.seq) throw new Error("Saved records are incomplete. No records have been overwritten.");
  return state;
}
function write(s: AppState) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }
  catch { throw new Error("Records could not be saved. Allow browser storage or free some space, then retry."); }
}
function validateVisitorFields(input: VisitorFields) {
  const purpose = input.purpose.startsWith("Other:") ? "Other" : input.purpose;
  const errors = validateVisitor({ ...input, purpose, purposeOther: purpose === "Other" ? input.purpose.slice(6).trim() : "" });
  if (Object.keys(errors).length) throw new Error("Please complete all visitor fields with valid details.");
}
function actor(s: AppState, admin = false) {
  const user = s.users.find((u) => u.id === s.session?.userId && u.status === "active");
  if (!user || !s.session || sessionRemaining(s.session.lastActivityAt ?? s.session.startedAt, Date.now()) <= 0) throw new Error("Your session has expired. Please sign in again.");
  if (admin && user.role !== "admin") throw new Error("Only administrators can perform this action.");
  return user;
}
function log(s: AppState, action: LogAction, extra: Partial<ActivityLog> = {}) {
  const user = s.users.find((u) => u.id === s.session?.userId);
  s.seq.log += 1;
  s.logs.unshift({ id: `LOG-${String(s.seq.log).padStart(5, "0")}`, timestamp: new Date().toISOString(), userId: user?.id ?? "system", userName: user?.name ?? "System", action, ...extra });
}
function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const task = queue.then(operation, operation);
  queue = task.catch(() => undefined);
  return task;
}
function transact<T>(mutate: (s: AppState) => T | Promise<T>): Promise<{ state: AppState; result: T }> {
  return enqueue(async () => {
    await delay();
    const state = read();
    if (!state) throw new Error("Saved records are unavailable. Reload and retry.");
    const result = await mutate(state);
    write(state);
    return { state, result };
  });
}

export const officeService = {
  load: () => enqueue(async () => {
    await delay();
    const old = read();
    const state = old ?? createSeed();
    // Migrate in place. Existing visitors, logs and account changes are never replaced.
    for (const user of state.users) if (!user.password.startsWith("$2")) user.password = await hash(user.password, 10);
    if (old && !window.localStorage.getItem(STORAGE_KEY)) {
      const extra = createSeed();
      for (const v of extra.visitors.slice(10)) {
        state.seq.visitor += 1;
        const id = `VIS-${String(state.seq.visitor).padStart(4, "0")}`;
        state.visitors.push({ ...v, id });
        for (const entry of extra.logs.filter((l) => l.recordId === v.id)) {
          state.seq.log += 1;
          state.logs.push({ ...entry, id: `LOG-${String(state.seq.log).padStart(5, "0")}`, recordId: id });
        }
      }
      state.logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    }
    if (state.session && (sessionRemaining(state.session.lastActivityAt ?? state.session.startedAt, Date.now()) <= 0 || !state.users.some((u) => u.id === state.session?.userId && u.status === "active"))) {
      log(state, "Session expired", { details: "Signed out after inactivity or account deactivation" });
      log(state, "Logout", { details: "Automatic sign-out" });
      state.session = null;
    }
    write(state);
    // Remove legacy plaintext only after the migrated copy is safely saved.
    window.localStorage.removeItem(LEGACY_KEY);
    return state;
  }),
  login: (username: string, password: string) => transact<AuthResult>((s) => {
    const attempts = s.loginAttempts ?? { failures: 0, lockedUntil: 0 };
    if (attempts.lockedUntil > Date.now()) return { ok: false, error: `Too many failed attempts. Try again in ${Math.ceil((attempts.lockedUntil - Date.now()) / 1000)} seconds.` };
    const result = authenticate(s.users, username, password);
    if (!result.ok) {
      s.loginAttempts = nextLoginFailure(attempts, Date.now());
      if (s.loginAttempts.lockedUntil > Date.now()) return { ok: false, error: "Sign-in is locked for 1 minute after 5 failed attempts. Please wait before trying again." };
      return result;
    }
    s.loginAttempts = { failures: 0, lockedUntil: 0 };
    const now = new Date().toISOString();
    s.session = { userId: result.user.id, startedAt: now, lastActivityAt: now };
    result.user.lastLoginAt = now;
    log(s, "Login");
    return result;
  }),
  logout: (expired = false) => transact((s) => {
    if (s.session) {
      if (expired) log(s, "Session expired", { details: "15 minutes of inactivity" });
      log(s, "Logout", expired ? { details: "Automatic sign-out after inactivity" } : {});
    }
    s.session = null;
  }),
  touchSession: () => transact((s) => {
    if (s.session) { actor(s); s.session.lastActivityAt = new Date().toISOString(); }
  }),
  registerVisitor: (input: VisitorFields) => transact((s) => {
    const user = actor(s);
    validateVisitorFields(input);
    s.seq.visitor += 1;
    const v: Visitor = { ...input, fullName: input.fullName.trim(), host: input.host.trim(), contact: toLocalPhone(input.contact), id: `VIS-${String(s.seq.visitor).padStart(4, "0")}`, timeIn: new Date().toISOString(), timeOut: null, archived: false, registeredBy: user.id };
    s.visitors.push(v);
    log(s, "Registered visitor", { recordId: v.id, details: `${v.fullName} → ${v.host}` });
    return v;
  }),
  checkOut: (id: string) => transact((s) => {
    actor(s);
    const v = s.visitors.find((x) => x.id === id);
    if (!v || v.timeOut || v.archived) throw new Error("This visitor is no longer inside. Refresh the list and retry.");
    v.timeOut = new Date().toISOString();
    log(s, "Checked-out visitor", { recordId: id, details: v.fullName });
  }),
  editVisitor: (id: string, input: VisitorFields, reason: string) => transact((s) => {
    actor(s, true);
    if (reason.trim().length < 10) throw new Error("Give a reason for edit of at least 10 characters.");
    validateVisitorFields(input);
    const v = s.visitors.find((x) => x.id === id);
    if (!v || v.archived) throw new Error("This record cannot be edited. Restore archived records first.");
    const normalized = { ...input, fullName: input.fullName.trim(), host: input.host.trim(), contact: toLocalPhone(input.contact) };
    const changes = (Object.keys(normalized) as (keyof VisitorFields)[]).filter((k) => v[k] !== normalized[k]).map((field) => ({ field, oldValue: v[field], newValue: normalized[field] }));
    Object.assign(v, normalized);
    log(s, "Edited visitor", { recordId: id, changes, reason: reason.trim(), details: `${changes.map((c) => `${c.field}: "${c.oldValue}" → "${c.newValue}"`).join("; ") || "No field changes"}. Reason: ${reason.trim()}` });
  }),
  archiveVisitors: (ids: string[]) => transact((s) => {
    actor(s, true);
    const records = s.visitors.filter((v) => ids.includes(v.id));
    if (records.length !== ids.length || records.some((v) => !v.timeOut || v.archived)) throw new Error("Only checked-out active records can be archived.");
    for (const v of records) { v.archived = true; v.archivedAt = new Date().toISOString(); log(s, "Archived record", { recordId: v.id, details: v.fullName }); }
  }),
  restoreVisitors: (ids: string[]) => transact((s) => {
    actor(s, true);
    for (const v of s.visitors.filter((v) => ids.includes(v.id) && v.archived)) { v.archived = false; delete v.archivedAt; log(s, "Restored record", { recordId: v.id, details: v.fullName }); }
  }),
  addStaff: (input: { name: string; username: string; role: Role; password: string }) => transact<StaffResult>(async (s) => {
    actor(s, true);
    const username = input.username.trim().toLowerCase();
    if (s.users.some((u) => u.username === username)) return { ok: false, error: "That username is already taken." };
    if (!input.name.trim() || !isValidUsername(username) || !isStrongPassword(input.password)) return { ok: false, error: "Please enter valid account details and a strong password." };
    s.seq.user += 1;
    const id = `U-${String(s.seq.user).padStart(3, "0")}`;
    s.users.push({ ...input, id, username, name: input.name.trim(), password: await hash(input.password, 10), status: "active", createdAt: new Date().toISOString() });
    log(s, "Added staff", { recordId: id, details: `${input.name} (${input.role})` });
    return { ok: true };
  }),
  updateStaff: (id: string, input: { name: string; username: string; role: Role }) => transact<StaffResult>((s) => {
    actor(s, true);
    const username = input.username.trim().toLowerCase();
    if (s.users.some((u) => u.username === username && u.id !== id)) return { ok: false, error: "That username is already taken." };
    if (!input.name.trim() || !isValidUsername(username)) return { ok: false, error: "Please enter valid account details." };
    const u = s.users.find((x) => x.id === id);
    if (!u) throw new Error("Account not found.");
    const before = `${u.name}, @${u.username}, ${u.role}`;
    Object.assign(u, input, { username, name: input.name.trim() });
    log(s, "Edited staff", { recordId: id, details: `${before} → ${u.name}, @${u.username}, ${u.role}` });
    return { ok: true };
  }),
  setStaffStatus: (id: string, status: StaffUser["status"]) => transact((s) => {
    const me = actor(s, true);
    if (id === me.id && status === "inactive") throw new Error("You cannot deactivate your own account.");
    const u = s.users.find((x) => x.id === id);
    if (!u) throw new Error("Account not found.");
    u.status = status;
    log(s, status === "active" ? "Activated staff" : "Deactivated staff", { recordId: id, details: u.name });
  }),
  resetPassword: (id: string) => transact(async (s) => {
    actor(s, true);
    const u = s.users.find((x) => x.id === id);
    if (!u) throw new Error("Account not found.");
    const bytes = crypto.getRandomValues(new Uint32Array(2));
    const password = `Office#${bytes[0]?.toString(36)}A${bytes[1]?.toString(36)}`;
    u.password = await hash(password, 10);
    log(s, "Reset password", { recordId: id, details: `${u.name} — temporary password issued` });
    return password;
  }),
  logExport: (details: string) => transact((s) => { actor(s, true); log(s, "Exported report", { details }); }),
};
