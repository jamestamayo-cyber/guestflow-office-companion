export type Role = "receptionist" | "admin";
export type AccountStatus = "active" | "inactive";

export interface StaffUser {
  id: string;
  name: string;
  username: string;
  /** Salted bcrypt hash; never a plaintext password. */
  password: string;
  role: Role;
  status: AccountStatus;
  createdAt: string;
  lastLoginAt?: string;
}

export interface Visitor {
  id: string;
  fullName: string;
  contact: string;
  purpose: string;
  host: string;
  timeIn: string;
  timeOut: string | null;
  archived: boolean;
  archivedAt?: string;
  registeredBy: string;
}

export type LogAction =
  | "Login"
  | "Logout"
  | "Session expired"
  | "Registered visitor"
  | "Checked-out visitor"
  | "Edited visitor"
  | "Archived record"
  | "Restored record"
  | "Added staff"
  | "Edited staff"
  | "Deactivated staff"
  | "Activated staff"
  | "Reset password"
  | "Exported report";

export interface ActivityLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: LogAction;
  recordId?: string;
  details?: string;
  changes?: { field: string; oldValue: string; newValue: string }[];
  reason?: string;
}

export interface AppState {
  users: StaffUser[];
  visitors: Visitor[];
  logs: ActivityLog[];
  session: { userId: string; startedAt: string; lastActivityAt?: string } | null;
  loginAttempts?: { failures: number; lockedUntil: number };
  seq: { visitor: number; log: number; user: number };
}

export type VisitorStatus = "Inside" | "Checked out" | "Archived";

export const PURPOSES = [
  "Document request",
  "Meeting / Appointment",
  "Payment / Billing",
  "Job application / Interview",
  "Delivery",
  "Inquiry",
] as const;

export const HOSTS = [
  "Records Section",
  "Accounting Office",
  "HR Department",
  "Office of the Director",
  "Procurement Unit",
  "IT Support",
  "Administrative Division",
];
