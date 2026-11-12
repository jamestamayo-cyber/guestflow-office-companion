import { subDays } from "date-fns";
import type { Role, StaffUser, Visitor } from "./types";

export type AuthResult = { ok: true; user: StaffUser } | { ok: false; error: string };

export function authenticate(users: StaffUser[], username: string, password: string): AuthResult {
  const user = users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase());
  if (!user || user.password !== password) {
    return { ok: false, error: "Invalid username or password. Please try again." };
  }
  if (user.status !== "active") {
    return { ok: false, error: "This account is deactivated. Contact your administrator." };
  }
  return { ok: true, user };
}

export function homeForRole(role: Role): "/admin" | "/dashboard" {
  return role === "admin" ? "/admin" : "/dashboard";
}

export function canAccessAdmin(role: Role) {
  return role === "admin";
}

export const RETENTION_PERIODS = [
  { value: "30", label: "Older than 30 days", days: 30 },
  { value: "90", label: "Older than 90 days", days: 90 },
  { value: "180", label: "Older than 6 months", days: 180 },
  { value: "365", label: "Older than 1 year", days: 365 },
] as const;

/** Only checked-out records can be archived; visitors still inside are never eligible. */
export function isEligibleForArchive(v: Visitor, days: number, now = new Date()) {
  return !v.archived && v.timeOut !== null && new Date(v.timeIn) < subDays(now, days);
}
