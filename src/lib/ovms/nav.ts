import {
  Archive,
  BarChart3,
  ClipboardList,
  FileSearch,
  LayoutDashboard,
  ScrollText,
  UserPlus,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "./types";

export interface NavItem {
  title: string;
  to:
    | "/dashboard"
    | "/register"
    | "/current-visitors"
    | "/search"
    | "/admin"
    | "/admin/records"
    | "/admin/reports"
    | "/admin/staff"
    | "/admin/logs"
    | "/admin/retention";
  icon: LucideIcon;
}

const RECEPTIONIST_NAV: NavItem[] = [
  { title: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { title: "Register Visitor", to: "/register", icon: UserPlus },
  { title: "Current Visitors", to: "/current-visitors", icon: Users },
  { title: "Search Records", to: "/search", icon: FileSearch },
];

const ADMIN_NAV: NavItem[] = [
  { title: "Dashboard", to: "/admin", icon: LayoutDashboard },
  { title: "Current Visitors", to: "/current-visitors", icon: Users },
  { title: "Visitor Records", to: "/admin/records", icon: ClipboardList },
  { title: "Reports", to: "/admin/reports", icon: BarChart3 },
  { title: "Staff Accounts", to: "/admin/staff", icon: UsersRound },
  { title: "Activity Logs", to: "/admin/logs", icon: ScrollText },
  { title: "Records Retention", to: "/admin/retention", icon: Archive },
];

export function navForRole(role: Role) {
  return role === "admin" ? ADMIN_NAV : RECEPTIONIST_NAV;
}
