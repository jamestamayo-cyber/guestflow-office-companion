import { differenceInMinutes, format } from "date-fns";
import type { Visitor, VisitorStatus } from "./types";

export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

/** Converts +63 / 63 prefixes to the local 09XXXXXXXXX form. */
export function toLocalPhone(value: string) {
  const d = digitsOnly(value);
  if (d.startsWith("63") && d.length === 12) return `0${d.slice(2)}`;
  return d;
}

export function formatPhone(value: string) {
  const d = toLocalPhone(value);
  if (d.length !== 11) return value;
  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
}

/** Shows only the network prefix and the last 3 digits, e.g. "0917 •••• 567". */
export function maskContact(value: string) {
  const d = toLocalPhone(value);
  if (d.length < 7) return "••••••";
  return `${d.slice(0, 4)} •••• ${d.slice(-3)}`;
}

export function visitorStatus(v: Visitor): VisitorStatus {
  if (v.archived) return "Archived";
  return v.timeOut ? "Checked out" : "Inside";
}

export const fmtTime = (iso: string) => format(new Date(iso), "h:mm a");
export const fmtDate = (iso: string) => format(new Date(iso), "MMM d, yyyy");
export const fmtDateTime = (iso: string) => format(new Date(iso), "MMM d, yyyy · h:mm a");
export const fmtStamp = (iso: string) => format(new Date(iso), "yyyy-MM-dd HH:mm:ss");

export function fmtDuration(fromIso: string, toIso: string | null, now = new Date()) {
  const mins = differenceInMinutes(toIso ? new Date(toIso) : now, new Date(fromIso));
  if (mins < 60) return `${Math.max(mins, 0)}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
