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

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const task = queue.then(operation, operation);
  queue = task.catch(() => undefined);
  return task;
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
  return {
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
}

async function mutate<T>(operation: () => Promise<T>): Promise<{ state: AppState; result: T }> {
  return enqueue(async () => {
    const result = await operation();
    return { state: await loadState(), result };
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

async function fetchVisitor(id: string): Promise<VisitorRow> {
  const { data, error } = await db.from("visitors").select("*").eq("id", id).maybeSingle();
  failOnError(error, "Could not load visitor record");
  if (!data)
    throw new Error("Visitor record not found or you do not have permission to access it.");
  return data as VisitorRow;
}

export const officeService = {
  load: () => enqueue(loadState),

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

  registerVisitor: (input: VisitorFields) =>
    mutate(async () => {
      const user = await getActor();
      validateVisitorFields(input);
      const id = recordId("VIS");
      const visitor = {
        id,
        ...makeVisitorPatch(input),
        registered_by: user.id,
        time_in: new Date().toISOString(),
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
    }),

  checkOut: (id: string) =>
    mutate(async () => {
      const user = await getActor();
      const { data, error } = await db
        .from("visitors")
        .update({ time_out: new Date().toISOString() })
        .eq("id", id)
        .is("time_out", null)
        .eq("archived", false)
        .select("*")
        .maybeSingle();
      failOnError(error, "Could not check out visitor");
      if (!data) throw new Error("This visitor is no longer inside. Refresh the list and retry.");
      const visitor = mapVisitor(data as VisitorRow);
      await writeLog(user, "Checked-out visitor", { recordId: id, details: visitor.fullName });
    }),

  timeOutVisitor: (id: string) => officeService.checkOut(id),

  editVisitor: (id: string, input: VisitorFields, reason: string) =>
    mutate(async () => {
      const user = await getActor(true);
      if (reason.trim().length < 10)
        throw new Error("Give a reason for edit of at least 10 characters.");
      validateVisitorFields(input);
      const before = await fetchVisitor(id);
      if (before.archived)
        throw new Error("This record cannot be edited. Restore archived records first.");
      const normalized = normalizeVisitor(input);
      const changes = (Object.keys(normalized) as (keyof VisitorFields)[])
        .filter(
          (field) =>
            before[
              (
                {
                  fullName: "full_name",
                  contact: "contact",
                  purpose: "purpose",
                  host: "host",
                } as const
              )[field]
            ] !== normalized[field],
        )
        .map((field) => ({
          field,
          oldValue:
            before[
              (
                {
                  fullName: "full_name",
                  contact: "contact",
                  purpose: "purpose",
                  host: "host",
                } as const
              )[field]
            ],
          newValue: normalized[field],
        }));
      const { error } = await db.from("visitors").update(makeVisitorPatch(input)).eq("id", id);
      failOnError(error, "Could not update visitor record");
      const details = `${changes.map((change) => `${change.field}: "${change.oldValue}" → "${change.newValue}"`).join("; ") || "No field changes"}. Reason: ${reason.trim()}`;
      await writeLog(user, "Edited visitor", {
        recordId: id,
        changes,
        reason: reason.trim(),
        details,
      });
    }),

  archiveVisitors: (ids: string[]) =>
    mutate(async () => {
      const user = await getActor(true);
      if (ids.length === 0) return;
      const { data: rows, error: loadError } = await db.from("visitors").select("*").in("id", ids);
      failOnError(loadError, "Could not load records to archive");
      const visitors = (rows ?? []) as VisitorRow[];
      if (visitors.length !== ids.length || visitors.some((row) => !row.time_out || row.archived)) {
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
      const logs = visitors.map((row) => ({
        id: recordId("LOG"),
        timestamp: archivedAt,
        user_id: user.id,
        user_name: user.name,
        action: "Archived record",
        record_id: row.id,
        details: row.full_name,
      }));
      const { error: logError } = await db.from("activity_logs").insert(logs);
      failOnError(logError, "Records were archived, but their activity logs could not be saved");
    }),

  archiveVisitor: (id: string) => officeService.archiveVisitors([id]),

  restoreVisitors: (ids: string[]) =>
    mutate(async () => {
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
      const logs = visitors.map((row) => ({
        id: recordId("LOG"),
        timestamp: restoredAt,
        user_id: user.id,
        user_name: user.name,
        action: "Restored record",
        record_id: row.id,
        details: row.full_name,
      }));
      const { error: logError } = await db.from("activity_logs").insert(logs);
      failOnError(logError, "Records were restored, but their activity logs could not be saved");
    }),

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
