import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { sessionRemaining, type AuthResult } from "@/lib/ovms/rules";
import { toLocalPhone } from "@/lib/ovms/format";
import { isStrongPassword, isValidUsername, validateVisitor } from "@/lib/ovms/validation";
import type { ActivityLog, AppState, LogAction, Role, StaffUser, Visitor } from "@/lib/ovms/types";

type DbClient = SupabaseClient;
type ProfileRow = {
  id: string;
  email: string;
  username: string;
  name: string;
  role: "user" | "admin";
  status: "active" | "inactive";
  created_at: string;
  last_login_at: string | null;
};
type VisitorRow = {
  id: string;
  full_name: string;
  contact: string;
  purpose: string;
  host: string;
  time_in: string;
  time_out: string | null;
  archived: boolean;
  archived_at: string | null;
  registered_by: string | null;
};
type ActivityRow = {
  id: string;
  timestamp: string;
  user_id: string | null;
  user_name: string;
  action: string;
  record_id: string | null;
  details: string | null;
  reason: string | null;
  changes: unknown;
};

const db = supabase as DbClient;
const actions = new Set<LogAction>([
  "Login",
  "Logout",
  "Session expired",
  "Registered visitor",
  "Checked-out visitor",
  "Edited visitor",
  "Archived record",
  "Restored record",
  "Added staff",
  "Edited staff",
  "Deactivated staff",
  "Activated staff",
  "Reset password",
  "Exported report",
]);
const emptyState = (): AppState => ({
  users: [],
  visitors: [],
  logs: [],
  session: null,
  seq: { visitor: 0, log: 0, user: 0 },
});
let lastActivityAt: string | null = null;
let activityUserId: string | null = null;
let queue: Promise<unknown> = Promise.resolve();

export type VisitorFields = Pick<Visitor, "fullName" | "contact" | "purpose" | "host">;
export type StaffResult = { ok: boolean; error?: string };

const QUEUE_KEY = "guestflow_offline_mutations";
const STATE_KEY = "guestflow_cached_state";
const QUEUE_CHANGE_EVENT = "guestflow:offline-queue-change";
type QueueActor = Pick<StaffUser, "id" | "name" | "role">;
type QueueLog = Omit<ActivityRow, "changes"> & { changes: ActivityLog["changes"] | null };
type QueuedMutation =
  | {
      id: string;
      type: "REGISTER_VISITOR";
      timestamp: string;
      clientTempId: string;
      payload: { actor: QueueActor; visitor: VisitorRow; log: QueueLog };
    }
  | {
      id: string;
      type: "TIMEOUT_VISITOR";
      timestamp: string;
      payload: { actor: QueueActor; visitorId: string; timeOut: string; log: QueueLog };
    }
  | {
      id: string;
      type: "EDIT_VISITOR";
      timestamp: string;
      payload: {
        actor: QueueActor;
        visitorId: string;
        patch: ReturnType<typeof makeVisitorPatch>;
        log: QueueLog;
      };
    }
  | {
      id: string;
      type: "ARCHIVE_VISITOR" | "RESTORE_VISITOR";
      timestamp: string;
      payload: {
        actor: QueueActor;
        visitors: VisitorRow[];
        archivedAt: string | null;
        logs: QueueLog[];
      };
    };

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const task = queue.then(operation, operation);
  queue = task.catch(() => undefined);
  return task;
}

function isBrowserOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine;
}

function dispatchQueueChange(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(QUEUE_CHANGE_EVENT));
}

function readOfflineQueue(): QueuedMutation[] {
  if (typeof localStorage === "undefined") return [];
  const stored = localStorage.getItem(QUEUE_KEY);
  if (!stored) return [];
  const parsed: unknown = JSON.parse(stored);
  if (!Array.isArray(parsed)) throw new Error("The offline sync queue is corrupted.");
  return parsed as QueuedMutation[];
}

function writeOfflineQueue(items: QueuedMutation[]): void {
  if (typeof localStorage === "undefined")
    throw new Error("Offline changes cannot be saved in this browser.");
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  dispatchQueueChange();
}

function getPendingSyncCount(): number {
  return readOfflineQueue().length;
}

function readCachedState(): AppState | null {
  if (typeof localStorage === "undefined") return null;
  const stored = localStorage.getItem(STATE_KEY);
  if (!stored) return null;
  return JSON.parse(stored) as AppState;
}

function writeCachedState(state: AppState): void {
  if (typeof localStorage !== "undefined") localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function cachedActor(admin = false): StaffUser {
  const state = readCachedState();
  if (!state) throw new Error("Load records while online before making offline changes.");
  const user = state.users.find((candidate) => candidate.id === state.session?.userId);
  if (!user || user.status !== "active")
    throw new Error("Sign in while online before making offline changes.");
  const lastActivity = state.session?.lastActivityAt ?? state.session?.startedAt;
  if (!lastActivity || sessionRemaining(lastActivity, Date.now()) <= 0)
    throw new Error("Your session has expired. Please sign in again.");
  if (admin && user.role !== "admin")
    throw new Error("Only administrators can perform this action.");
  const nextActivity = new Date().toISOString();
  if (state.session) state.session.lastActivityAt = nextActivity;
  activityUserId = user.id;
  lastActivityAt = nextActivity;
  writeCachedState(state);
  return user;
}

function isConnectivityError(error: unknown): boolean {
  if (!isBrowserOnline()) return true;
  if (error instanceof TypeError) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /network|fetch|offline|connection|timed?\s*out|failed to reach/i.test(message);
}

function queueLog(
  actor: QueueActor,
  timestamp: string,
  action: LogAction,
  recordIdValue: string,
  details: string,
  extra: Pick<ActivityLog, "changes" | "reason"> = {},
): QueueLog {
  return {
    id: recordId("LOG"),
    timestamp,
    user_id: actor.id,
    user_name: actor.name,
    action,
    record_id: recordIdValue,
    details,
    reason: extra.reason ?? null,
    changes: extra.changes ?? null,
  };
}

function toQueueActor(actor: StaffUser): QueueActor {
  return { id: actor.id, name: actor.name, role: actor.role };
}

function applyQueuedMutation(state: AppState, mutation: QueuedMutation): AppState {
  const visitors = [...state.visitors];
  const logs = [...state.logs];
  const addLog = (row: QueueLog) => {
    const mapped = mapLog(row);
    const index = logs.findIndex((log) => log.id === mapped.id);
    if (index >= 0) logs[index] = mapped;
    else logs.unshift(mapped);
  };

  if (mutation.type === "REGISTER_VISITOR") {
    const mapped = mapVisitor(mutation.payload.visitor);
    if (!visitors.some((visitor) => visitor.id === mapped.id)) visitors.unshift(mapped);
    addLog(mutation.payload.log);
  } else if (mutation.type === "TIMEOUT_VISITOR") {
    const visitor = visitors.find((item) => item.id === mutation.payload.visitorId);
    if (visitor) visitor.timeOut = mutation.payload.timeOut;
    addLog(mutation.payload.log);
  } else if (mutation.type === "EDIT_VISITOR") {
    const visitor = visitors.find((item) => item.id === mutation.payload.visitorId);
    if (visitor) {
      visitor.fullName = mutation.payload.patch.full_name;
      visitor.contact = mutation.payload.patch.contact;
      visitor.purpose = mutation.payload.patch.purpose;
      visitor.host = mutation.payload.patch.host;
    }
    addLog(mutation.payload.log);
  } else {
    const affectedIds = new Set(mutation.payload.visitors.map((visitor) => visitor.id));
    for (const visitor of visitors) {
      if (!affectedIds.has(visitor.id)) continue;
      visitor.archived = mutation.type === "ARCHIVE_VISITOR";
      if (mutation.type === "ARCHIVE_VISITOR" && mutation.payload.archivedAt)
        visitor.archivedAt = mutation.payload.archivedAt;
      else delete visitor.archivedAt;
    }
    mutation.payload.logs.forEach(addLog);
  }
  return { ...state, visitors, logs };
}

function appendOfflineMutation(mutation: QueuedMutation): AppState {
  const items = readOfflineQueue();
  items.push(mutation);
  items.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  writeOfflineQueue(items);
  const state = readCachedState();
  if (!state) throw new Error("Load records while online before making offline changes.");
  const next = applyQueuedMutation(state, mutation);
  writeCachedState(next);
  return next;
}

async function insertQueueLogs(logs: QueueLog[]): Promise<void> {
  if (logs.length) {
    const { error } = await db.from("activity_logs").upsert(logs, { onConflict: "id" });
    failOnError(error, "Could not write activity logs for queued changes");
  }
}

async function replayMutation(mutation: QueuedMutation): Promise<void> {
  if (mutation.type === "REGISTER_VISITOR") {
    const { error } = await db
      .from("visitors")
      .upsert(mutation.payload.visitor, { onConflict: "id" });
    failOnError(error, "Could not sync visitor registration");
    await insertQueueLogs([mutation.payload.log]);
    return;
  }
  if (mutation.type === "TIMEOUT_VISITOR") {
    const { data, error } = await db
      .from("visitors")
      .update({ time_out: mutation.payload.timeOut })
      .eq("id", mutation.payload.visitorId)
      .is("time_out", null)
      .eq("archived", false)
      .select("*")
      .maybeSingle();
    failOnError(error, "Could not sync visitor checkout");
    if (!data) {
      const current = await fetchVisitor(mutation.payload.visitorId);
      if (current.time_out !== mutation.payload.timeOut)
        throw new Error("Visitor checkout changed before the queued change could sync.");
    }
    await insertQueueLogs([mutation.payload.log]);
    return;
  }
  if (mutation.type === "EDIT_VISITOR") {
    const { error } = await db
      .from("visitors")
      .update(mutation.payload.patch)
      .eq("id", mutation.payload.visitorId);
    failOnError(error, "Could not sync visitor edit");
    await insertQueueLogs([mutation.payload.log]);
    return;
  }

  const { error } = await db
    .from("visitors")
    .update({
      archived: mutation.type === "ARCHIVE_VISITOR",
      archived_at: mutation.payload.archivedAt,
    })
    .in(
      "id",
      mutation.payload.visitors.map((visitor) => visitor.id),
    );
  failOnError(
    error,
    `Could not sync visitor ${mutation.type === "ARCHIVE_VISITOR" ? "archive" : "restore"}`,
  );
  await insertQueueLogs(mutation.payload.logs);
}

export async function syncOfflineQueue(): Promise<void> {
  if (!isBrowserOnline()) return;
  await enqueue(async () => {
    const items = readOfflineQueue().sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    while (items.length) {
      const item = items[0];
      if (!item) break;
      try {
        await replayMutation(item);
      } catch (error) {
        console.error("Offline changes could not be synced; they remain queued.", error);
        break;
      }
      items.shift();
      writeOfflineQueue(items);
    }
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    void syncOfflineQueue().catch((error: unknown) => {
      console.error("Offline changes could not be synced; they remain queued.", error);
    });
  });
}

async function mutateVisitorWrite<T>(
  operation: () => Promise<T>,
  makeOfflineMutation: () => { mutation: QueuedMutation; result: T },
): Promise<{ state: AppState; result: T; queued: boolean }> {
  return enqueue(async () => {
    if (!isBrowserOnline()) {
      const { mutation, result } = makeOfflineMutation();
      return { state: appendOfflineMutation(mutation), result, queued: true };
    }

    let result: T;
    try {
      result = await operation();
    } catch (error) {
      if (!isConnectivityError(error)) throw error;
      const offline = makeOfflineMutation();
      return {
        state: appendOfflineMutation(offline.mutation),
        result: offline.result,
        queued: true,
      };
    }

    try {
      const state = await loadState();
      writeCachedState(state);
      return { state, result, queued: false };
    } catch (error) {
      if (!isConnectivityError(error)) throw error;
      const cached = readCachedState();
      if (!cached) throw error;
      const { mutation } = makeOfflineMutation();
      const state = applyQueuedMutation(cached, mutation);
      writeCachedState(state);
      return { state, result, queued: false };
    }
  });
}

function failOnError(error: { message: string } | null, operation: string): void {
  if (error) throw new Error(`${operation}: ${error.message}`);
}

function recordId(prefix: "VIS" | "LOG"): string {
  return `${prefix}-${crypto.randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`;
}

function mapProfile(row: ProfileRow): StaffUser {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    password: "",
    role: row.role === "admin" ? "admin" : "receptionist",
    status: row.status,
    createdAt: row.created_at,
    ...(row.last_login_at ? { lastLoginAt: row.last_login_at } : {}),
  };
}

function mapVisitor(row: VisitorRow): Visitor {
  return {
    id: row.id,
    fullName: row.full_name,
    contact: row.contact,
    purpose: row.purpose,
    host: row.host,
    timeIn: row.time_in,
    timeOut: row.time_out,
    archived: row.archived,
    ...(row.archived_at ? { archivedAt: row.archived_at } : {}),
    registeredBy: row.registered_by ?? "system",
  };
}

function mapChanges(value: unknown): ActivityLog["changes"] {
  if (!Array.isArray(value)) return undefined;
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const change = item as Record<string, unknown>;
    if (typeof change["field"] !== "string") return [];
    return [
      {
        field: change["field"],
        oldValue: String(change["oldValue"] ?? ""),
        newValue: String(change["newValue"] ?? ""),
      },
    ];
  });
}

function mapLog(row: ActivityRow): ActivityLog {
  if (!actions.has(row.action as LogAction)) {
    throw new Error(`Activity log ${row.id} has an unsupported action: ${row.action}`);
  }
  const changes = mapChanges(row.changes);
  return {
    id: row.id,
    timestamp: row.timestamp,
    userId: row.user_id ?? "system",
    userName: row.user_name,
    action: row.action as LogAction,
    ...(row.record_id ? { recordId: row.record_id } : {}),
    ...(row.details ? { details: row.details } : {}),
    ...(row.reason ? { reason: row.reason } : {}),
    ...(changes ? { changes } : {}),
  };
}

function validateVisitorFields(input: VisitorFields): void {
  const purpose = input.purpose.startsWith("Other:") ? "Other" : input.purpose;
  const errors = validateVisitor({
    ...input,
    purpose,
    purposeOther: purpose === "Other" ? input.purpose.slice(6).trim() : "",
  });
  if (Object.keys(errors).length)
    throw new Error("Please complete all visitor fields with valid details.");
}

function normalizeVisitor(input: VisitorFields): VisitorFields {
  return {
    ...input,
    fullName: input.fullName.trim(),
    contact: toLocalPhone(input.contact),
    host: input.host.trim(),
  };
}

async function getActor(admin = false): Promise<StaffUser> {
  const { data: sessionData, error: sessionError } = await db.auth.getSession();
  failOnError(sessionError, "Could not verify your session");
  const authUser = sessionData.session?.user;
  if (!authUser) throw new Error("Your session has expired. Please sign in again.");

  const { data, error } = await db.from("profiles").select("*").eq("id", authUser.id).single();
  failOnError(error, "Could not load your staff profile");
  const user = mapProfile(data as ProfileRow);
  if (user.status !== "active")
    throw new Error("This account is deactivated. Contact your administrator.");
  if (activityUserId !== user.id || !lastActivityAt) {
    activityUserId = user.id;
    lastActivityAt = new Date().toISOString();
  }
  if (sessionRemaining(lastActivityAt, Date.now()) <= 0) {
    await db.auth.signOut();
    activityUserId = null;
    lastActivityAt = null;
    throw new Error("Your session has expired. Please sign in again.");
  }
  if (admin && user.role !== "admin")
    throw new Error("Only administrators can perform this action.");
  return user;
}

async function writeLog(
  user: StaffUser,
  action: LogAction,
  extra: Partial<Pick<ActivityLog, "recordId" | "details" | "reason" | "changes">> = {},
): Promise<void> {
  const { error } = await db.from("activity_logs").insert({
    id: recordId("LOG"),
    timestamp: new Date().toISOString(),
    user_id: user.id,
    user_name: user.name,
    action,
    record_id: extra.recordId ?? null,
    details: extra.details ?? null,
    reason: extra.reason ?? null,
    changes: extra.changes ?? null,
  });
  failOnError(error, `Could not write the "${action}" activity log`);
}

async function loadState(): Promise<AppState> {
  const { data: sessionData, error: sessionError } = await db.auth.getSession();
  failOnError(sessionError, "Could not check the Supabase session");
  const authUser = sessionData.session?.user;
  if (!authUser) {
    activityUserId = null;
    lastActivityAt = null;
    if (typeof localStorage !== "undefined") localStorage.removeItem(STATE_KEY);
    return emptyState();
  }

  const [profilesResult, visitorsResult, logsResult] = await Promise.all([
    db.from("profiles").select("*").order("name"),
    db.from("visitors").select("*").order("time_in", { ascending: false }),
    db.from("activity_logs").select("*").order("timestamp", { ascending: false }),
  ]);
  failOnError(profilesResult.error, "Could not load staff profiles");
  failOnError(visitorsResult.error, "Could not load visitor records");
  failOnError(logsResult.error, "Could not load activity logs");

  const users = (profilesResult.data ?? []).map((row) => mapProfile(row as ProfileRow));
  const currentUser = users.find((user) => user.id === authUser.id);
  if (!currentUser || currentUser.status !== "active") {
    await db.auth.signOut();
    activityUserId = null;
    lastActivityAt = null;
    return emptyState();
  }
  if (activityUserId !== currentUser.id || !lastActivityAt) {
    activityUserId = currentUser.id;
    lastActivityAt = new Date().toISOString();
  }
  const state: AppState = {
    users,
    visitors: (visitorsResult.data ?? []).map((row) => mapVisitor(row as VisitorRow)),
    logs: (logsResult.data ?? []).map((row) => mapLog(row as ActivityRow)),
    session: {
      userId: currentUser.id,
      startedAt: sessionData.session?.user.last_sign_in_at ?? new Date().toISOString(),
      lastActivityAt,
    },
    seq: { visitor: 0, log: 0, user: users.length },
  };
  const optimisticState = readOfflineQueue().reduce(applyQueuedMutation, state);
  writeCachedState(optimisticState);
  return optimisticState;
}

async function mutate<T>(operation: () => Promise<T>): Promise<{ state: AppState; result: T }> {
  return enqueue(async () => {
    const result = await operation();
    const state = await loadState();
    writeCachedState(state);
    return { state, result };
  });
}

function makeVisitorPatch(input: VisitorFields) {
  const normalized = normalizeVisitor(input);
  return {
    full_name: normalized.fullName,
    contact: normalized.contact,
    purpose: normalized.purpose,
    host: normalized.host,
  };
}

function cachedVisitorRow(id: string): VisitorRow {
  const visitor = readCachedState()?.visitors.find((item) => item.id === id);
  if (!visitor) throw new Error("Load records while online before making offline changes.");
  return {
    id: visitor.id,
    full_name: visitor.fullName,
    contact: visitor.contact,
    purpose: visitor.purpose,
    host: visitor.host,
    time_in: visitor.timeIn,
    time_out: visitor.timeOut,
    archived: visitor.archived,
    archived_at: visitor.archivedAt ?? null,
    registered_by: visitor.registeredBy,
  };
}

function createRegisterMutation(
  actor: StaffUser,
  input: VisitorFields,
  timestamp: string,
  id: string,
): Extract<QueuedMutation, { type: "REGISTER_VISITOR" }> {
  const visitor: VisitorRow = {
    id,
    ...makeVisitorPatch(input),
    registered_by: actor.id,
    time_in: timestamp,
    time_out: null,
    archived: false,
    archived_at: null,
  };
  return {
    id: crypto.randomUUID(),
    type: "REGISTER_VISITOR",
    timestamp,
    clientTempId: id,
    payload: {
      actor: toQueueActor(actor),
      visitor,
      log: queueLog(
        actor,
        timestamp,
        "Registered visitor",
        id,
        `${visitor.full_name} → ${visitor.host}`,
      ),
    },
  };
}

function createTimeoutMutation(
  actor: StaffUser,
  id: string,
  timestamp: string,
): Extract<QueuedMutation, { type: "TIMEOUT_VISITOR" }> {
  return {
    id: crypto.randomUUID(),
    type: "TIMEOUT_VISITOR",
    timestamp,
    payload: {
      actor: toQueueActor(actor),
      visitorId: id,
      timeOut: timestamp,
      log: queueLog(actor, timestamp, "Checked-out visitor", id, cachedVisitorRow(id).full_name),
    },
  };
}

function createEditMutation(
  actor: StaffUser,
  id: string,
  input: VisitorFields,
  reason: string,
  timestamp: string,
  before: VisitorRow,
): Extract<QueuedMutation, { type: "EDIT_VISITOR" }> {
  const normalized = normalizeVisitor(input);
  const columns = {
    fullName: "full_name",
    contact: "contact",
    purpose: "purpose",
    host: "host",
  } as const;
  const changes = (Object.keys(normalized) as (keyof VisitorFields)[])
    .filter((field) => before[columns[field]] !== normalized[field])
    .map((field) => ({
      field,
      oldValue: before[columns[field]],
      newValue: normalized[field],
    }));
  const details = `${changes.map((change) => `${change.field}: "${change.oldValue}" → "${change.newValue}"`).join("; ") || "No field changes"}. Reason: ${reason.trim()}`;
  return {
    id: crypto.randomUUID(),
    type: "EDIT_VISITOR",
    timestamp,
    payload: {
      actor: toQueueActor(actor),
      visitorId: id,
      patch: makeVisitorPatch(input),
      log: queueLog(actor, timestamp, "Edited visitor", id, details, {
        changes,
        reason: reason.trim(),
      }),
    },
  };
}

function createArchiveMutation(
  actor: StaffUser,
  ids: string[],
  timestamp: string,
  type: "ARCHIVE_VISITOR" | "RESTORE_VISITOR",
): QueuedMutation {
  const cached = readCachedState();
  const visitors = ids
    .map((id) => cached?.visitors.find((visitor) => visitor.id === id))
    .filter((visitor): visitor is Visitor => Boolean(visitor))
    .filter((visitor) => (type === "ARCHIVE_VISITOR" ? !visitor.archived : visitor.archived))
    .map((visitor) => cachedVisitorRow(visitor.id));
  if (
    type === "ARCHIVE_VISITOR" &&
    (visitors.length !== ids.length || visitors.some((v) => !v.time_out))
  )
    throw new Error("Only checked-out active records can be archived.");
  const archivedAt = type === "ARCHIVE_VISITOR" ? timestamp : null;
  return {
    id: crypto.randomUUID(),
    type,
    timestamp,
    payload: {
      actor: toQueueActor(actor),
      visitors,
      archivedAt,
      logs: visitors.map((visitor) =>
        queueLog(
          actor,
          timestamp,
          type === "ARCHIVE_VISITOR" ? "Archived record" : "Restored record",
          visitor.id,
          visitor.full_name,
        ),
      ),
    },
  };
}

async function fetchVisitor(id: string): Promise<VisitorRow> {
  const { data, error } = await db.from("visitors").select("*").eq("id", id).maybeSingle();
  failOnError(error, "Could not load visitor record");
  if (!data)
    throw new Error("Visitor record not found or you do not have permission to access it.");
  return data as VisitorRow;
}

export const officeService = {
  load: async () => {
    if (!isBrowserOnline()) {
      return enqueue(async () => {
        const cached = readCachedState();
        if (!cached) throw new Error("Load records while online before using offline mode.");
        const state = readOfflineQueue().reduce(applyQueuedMutation, cached);
        writeCachedState(state);
        return state;
      });
    }
    if (isBrowserOnline() && getPendingSyncCount() > 0) await syncOfflineQueue();
    return enqueue(loadState);
  },
  getPendingSyncCount,
  syncOfflineQueue,

  login: (username: string, password: string): Promise<{ state: AppState; result: AuthResult }> =>
    enqueue(async () => {
      const identifier = username.trim();
      const email = identifier.includes("@")
        ? identifier
        : `${identifier.toLowerCase()}@guestflow.local`;
      const { data, error } = await db.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.status !== 400 && error.status !== 401) {
          throw new Error(`Could not sign in: ${error.message}`);
        }
        return {
          state: await loadState(),
          result: { ok: false, error: "Invalid username or password. Please try again." },
        };
      }
      if (!data.user) {
        return {
          state: await loadState(),
          result: { ok: false, error: "Invalid username or password. Please try again." } as const,
        };
      }

      try {
        const { data: profile, error: profileError } = await db
          .from("profiles")
          .select("*")
          .eq("id", data.user.id)
          .single();
        failOnError(profileError, "Could not load your staff profile");
        const user = mapProfile(profile as ProfileRow);
        if (user.status !== "active") {
          await db.auth.signOut();
          return {
            state: emptyState(),
            result: {
              ok: false,
              error: "This account is deactivated. Contact your administrator.",
            } as const,
          };
        }
        activityUserId = user.id;
        lastActivityAt = new Date().toISOString();
        await writeLog(user, "Login");
        return { state: await loadState(), result: { ok: true, user } as const };
      } catch (error) {
        await db.auth.signOut();
        throw error;
      }
    }),

  logout: (expired = false) =>
    mutate(async () => {
      const { data } = await db.auth.getSession();
      if (data.session) {
        const user = await getActor();
        if (expired)
          await writeLog(user, "Session expired", { details: "15 minutes of inactivity" });
        await writeLog(
          user,
          "Logout",
          expired ? { details: "Automatic sign-out after inactivity" } : {},
        );
      }
      const { error } = await db.auth.signOut();
      failOnError(error, "Could not sign out");
      activityUserId = null;
      lastActivityAt = null;
    }),

  touchSession: () =>
    mutate(async () => {
      const user = await getActor();
      lastActivityAt = new Date().toISOString();
      activityUserId = user.id;
    }),

  registerVisitor: (input: VisitorFields) => {
    const timestamp = new Date().toISOString();
    const id = recordId("VIS");
    return mutateVisitorWrite(
      async () => {
        const user = await getActor();
        validateVisitorFields(input);
        const visitor = {
          id,
          ...makeVisitorPatch(input),
          registered_by: user.id,
          time_in: timestamp,
          time_out: null,
          archived: false,
          archived_at: null,
        };
        const { error } = await db.from("visitors").insert(visitor);
        failOnError(error, "Could not register visitor");
        await writeLog(user, "Registered visitor", {
          recordId: id,
          details: `${visitor.full_name} → ${visitor.host}`,
        });
        return mapVisitor(visitor);
      },
      () => {
        const user = cachedActor();
        validateVisitorFields(input);
        const mutation = createRegisterMutation(user, input, timestamp, id);
        return { mutation, result: mapVisitor(mutation.payload.visitor) };
      },
    );
  },

  checkOut: (id: string) => {
    const timestamp = new Date().toISOString();
    return mutateVisitorWrite(
      async () => {
        const user = await getActor();
        const { data, error } = await db
          .from("visitors")
          .update({ time_out: timestamp })
          .eq("id", id)
          .is("time_out", null)
          .eq("archived", false)
          .select("*")
          .maybeSingle();
        failOnError(error, "Could not check out visitor");
        if (!data) throw new Error("This visitor is no longer inside. Refresh the list and retry.");
        const visitor = mapVisitor(data as VisitorRow);
        await writeLog(user, "Checked-out visitor", { recordId: id, details: visitor.fullName });
      },
      () => {
        const user = cachedActor();
        const visitor = cachedVisitorRow(id);
        if (visitor.time_out || visitor.archived)
          throw new Error("This visitor is no longer inside. Refresh the list and retry.");
        return { mutation: createTimeoutMutation(user, id, timestamp), result: undefined };
      },
    );
  },

  timeOutVisitor: (id: string) => officeService.checkOut(id),

  editVisitor: (id: string, input: VisitorFields, reason: string) => {
    const timestamp = new Date().toISOString();
    return mutateVisitorWrite(
      async () => {
        const user = await getActor(true);
        if (reason.trim().length < 10)
          throw new Error("Give a reason for edit of at least 10 characters.");
        validateVisitorFields(input);
        const before = await fetchVisitor(id);
        if (before.archived)
          throw new Error("This record cannot be edited. Restore archived records first.");
        const mutation = createEditMutation(user, id, input, reason, timestamp, before);
        const { error } = await db.from("visitors").update(makeVisitorPatch(input)).eq("id", id);
        failOnError(error, "Could not update visitor record");
        await insertQueueLogs([mutation.payload.log]);
      },
      () => {
        const user = cachedActor(true);
        if (reason.trim().length < 10)
          throw new Error("Give a reason for edit of at least 10 characters.");
        validateVisitorFields(input);
        const before = cachedVisitorRow(id);
        if (before.archived)
          throw new Error("This record cannot be edited. Restore archived records first.");
        return {
          mutation: createEditMutation(user, id, input, reason, timestamp, before),
          result: undefined,
        };
      },
    );
  },

  archiveVisitors: (ids: string[]) => {
    const timestamp = new Date().toISOString();
    return mutateVisitorWrite(
      async () => {
        const user = await getActor(true);
        if (ids.length === 0) return;
        const { data: rows, error: loadError } = await db
          .from("visitors")
          .select("*")
          .in("id", ids);
        failOnError(loadError, "Could not load records to archive");
        const visitors = (rows ?? []) as VisitorRow[];
        if (
          visitors.length !== ids.length ||
          visitors.some((row) => !row.time_out || row.archived)
        ) {
          throw new Error("Only checked-out active records can be archived.");
        }
        const archivedAt = new Date().toISOString();
        const { data: updated, error } = await db
          .from("visitors")
          .update({ archived: true, archived_at: archivedAt })
          .in("id", ids)
          .eq("archived", false)
          .not("time_out", "is", null)
          .select("*");
        failOnError(error, "Could not archive visitor records");
        if ((updated ?? []).length !== ids.length)
          throw new Error("Some records changed before they could be archived. Refresh and retry.");
        const logs = visitors.map((row) =>
          queueLog(user, archivedAt, "Archived record", row.id, row.full_name),
        );
        await insertQueueLogs(logs);
      },
      () => {
        const user = cachedActor(true);
        return {
          mutation: createArchiveMutation(user, ids, timestamp, "ARCHIVE_VISITOR"),
          result: undefined,
        };
      },
    );
  },

  archiveVisitor: (id: string) => officeService.archiveVisitors([id]),

  restoreVisitors: (ids: string[]) => {
    const timestamp = new Date().toISOString();
    return mutateVisitorWrite(
      async () => {
        const user = await getActor(true);
        if (ids.length === 0) return;
        const { data: rows, error: loadError } = await db
          .from("visitors")
          .select("*")
          .in("id", ids)
          .eq("archived", true);
        failOnError(loadError, "Could not load records to restore");
        const visitors = (rows ?? []) as VisitorRow[];
        if (!visitors.length) return;
        const restoredAt = new Date().toISOString();
        const { data: updated, error } = await db
          .from("visitors")
          .update({ archived: false, archived_at: null })
          .in(
            "id",
            visitors.map((row) => row.id),
          )
          .eq("archived", true)
          .select("id");
        failOnError(error, "Could not restore visitor records");
        if ((updated ?? []).length !== visitors.length)
          throw new Error("Some records changed before they could be restored. Refresh and retry.");
        const logs = visitors.map((row) =>
          queueLog(user, restoredAt, "Restored record", row.id, row.full_name),
        );
        await insertQueueLogs(logs);
      },
      () => {
        const user = cachedActor(true);
        return {
          mutation: createArchiveMutation(user, ids, timestamp, "RESTORE_VISITOR"),
          result: undefined,
        };
      },
    );
  },

  restoreVisitor: (id: string) => officeService.restoreVisitors([id]),

  addStaff: (input: { name: string; username: string; role: Role; password: string }) =>
    mutate(async () => {
      await getActor(true);
      const username = input.username.trim().toLowerCase();
      if (!input.name.trim() || !isValidUsername(username) || !isStrongPassword(input.password)) {
        return { ok: false, error: "Please enter valid account details and a strong password." };
      }
      return {
        ok: false,
        error:
          "Staff accounts must be created through a trusted Supabase Auth invitation flow; browser-side account provisioning is disabled.",
      };
    }),

  updateStaff: (id: string, input: { name: string; username: string; role: Role }) =>
    mutate(async () => {
      const admin = await getActor(true);
      const username = input.username.trim().toLowerCase();
      if (!input.name.trim() || !isValidUsername(username))
        return { ok: false, error: "Please enter valid account details." };
      const { data: existing, error: duplicateError } = await db
        .from("profiles")
        .select("id")
        .eq("username", username)
        .maybeSingle();
      failOnError(duplicateError, "Could not check username availability");
      if (existing && existing.id !== id)
        return { ok: false, error: "That username is already taken." };
      const { data: before, error: loadError } = await db
        .from("profiles")
        .select("*")
        .eq("id", id)
        .single();
      failOnError(loadError, "Could not load staff account");
      const profile = before as ProfileRow;
      const { error } = await db
        .from("profiles")
        .update({
          name: input.name.trim(),
          username,
          role: input.role === "admin" ? "admin" : "user",
        })
        .eq("id", id);
      failOnError(error, "Could not update staff account");
      await writeLog(admin, "Edited staff", {
        recordId: id,
        details: `${profile.name}, @${profile.username}, ${profile.role} → ${input.name.trim()}, @${username}, ${input.role}`,
      });
      return { ok: true };
    }),

  setStaffStatus: (id: string, status: StaffUser["status"]) =>
    mutate(async () => {
      const admin = await getActor(true);
      if (id === admin.id && status === "inactive")
        throw new Error("You cannot deactivate your own account.");
      const { data, error: loadError } = await db
        .from("profiles")
        .select("*")
        .eq("id", id)
        .single();
      failOnError(loadError, "Could not load staff account");
      const user = mapProfile(data as ProfileRow);
      const { error } = await db.from("profiles").update({ status }).eq("id", id);
      failOnError(error, "Could not update staff status");
      await writeLog(admin, status === "active" ? "Activated staff" : "Deactivated staff", {
        recordId: id,
        details: user.name,
      });
    }),

  resetPassword: async (_id: string) => {
    await getActor(true);
    throw new Error(
      "Supabase Auth does not allow browser-side password resets for other users. Use a trusted password-reset or invitation flow.",
    );
  },

  logExport: (details: string) =>
    mutate(async () => {
      await writeLog(await getActor(true), "Exported report", { details });
    }),
};
