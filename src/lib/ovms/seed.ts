import { setHours, setMinutes, subDays, subMinutes } from "date-fns";
import type { ActivityLog, AppState, StaffUser, Visitor } from "./types";

const at = (daysAgo: number, h: number, m: number, now: Date) =>
  setMinutes(setHours(subDays(now, daysAgo), h), m).toISOString();

export function createSeed(now = new Date()): AppState {
  const users: StaffUser[] = [
    { id: "U-001", name: "Maria Santos", username: "msantos", password: "$2b$10$orJwN1eRfC.Fg5WSLS8T.Oa3KzNGfjdw21tEbhTalL7b/HThuHV4K", role: "receptionist", status: "active", createdAt: at(420, 9, 0, now) },
    { id: "U-002", name: "Jericho Reyes", username: "jreyes", password: "$2b$10$orJwN1eRfC.Fg5WSLS8T.Oa3KzNGfjdw21tEbhTalL7b/HThuHV4K", role: "receptionist", status: "active", createdAt: at(300, 9, 0, now) },
    { id: "U-003", name: "Angela Cruz", username: "acruz", password: "$2b$10$orJwN1eRfC.Fg5WSLS8T.Oa3KzNGfjdw21tEbhTalL7b/HThuHV4K", role: "receptionist", status: "inactive", createdAt: at(250, 9, 0, now) },
    { id: "U-004", name: "Ramon Villanueva", username: "rvillanueva", password: "$2b$10$xDHoMMZ1Ft.I97PvPHmBS.qN1/YB8KvcGAWu8Vrz.YZqTET7z.yCe", role: "admin", status: "active", createdAt: at(500, 9, 0, now) },
    { id: "U-005", name: "Liza Mendoza", username: "lmendoza", password: "$2b$10$xDHoMMZ1Ft.I97PvPHmBS.qN1/YB8KvcGAWu8Vrz.YZqTET7z.yCe", role: "admin", status: "active", createdAt: at(480, 9, 0, now) },
  ];

  const today = (minsAgo: number) => subMinutes(now, minsAgo).toISOString();

  const visitors: Visitor[] = [
    { id: "VIS-0001", fullName: "Lourdes Pascual", contact: "09224561230", purpose: "Payment / Billing", host: "Accounting Office", timeIn: at(29, 10, 5, now), timeOut: at(29, 10, 40, now), archived: false, registeredBy: "U-002" },
    { id: "VIS-0002", fullName: "Ernesto Aquino", contact: "09151239876", purpose: "Other: Building inspection", host: "Administrative Division", timeIn: at(26, 13, 30, now), timeOut: at(26, 15, 10, now), archived: false, registeredBy: "U-001" },
    { id: "VIS-0003", fullName: "Grace Villareal", contact: "09987778899", purpose: "Document request", host: "Records Section", timeIn: at(23, 9, 20, now), timeOut: at(23, 9, 55, now), archived: false, registeredBy: "U-001" },
    { id: "VIS-0004", fullName: "Dominic Tan", contact: "09324445566", purpose: "Meeting / Appointment", host: "IT Support — Engr. Lim", timeIn: at(10, 14, 0, now), timeOut: at(10, 15, 25, now), archived: false, registeredBy: "U-002" },
    { id: "VIS-0005", fullName: "Rhea Mae Castillo", contact: "09062223344", purpose: "Inquiry", host: "Records Section", timeIn: at(3, 11, 20, now), timeOut: at(3, 11, 45, now), archived: false, registeredBy: "U-001" },
    { id: "VIS-0006", fullName: "Paolo Fernandez", contact: "09189990011", purpose: "Payment / Billing", host: "Accounting Office", timeIn: at(1, 14, 5, now), timeOut: at(1, 14, 40, now), archived: false, registeredBy: "U-002" },
    { id: "VIS-0007", fullName: "Juan Dela Cruz", contact: "09171234567", purpose: "Document request", host: "Records Section", timeIn: today(214), timeOut: null, archived: false, registeredBy: "U-001" },
    { id: "VIS-0008", fullName: "Mark Anthony Gonzales", contact: "09453334455", purpose: "Delivery", host: "Procurement Unit", timeIn: today(170), timeOut: today(152), archived: false, registeredBy: "U-001" },
    { id: "VIS-0009", fullName: "Ana Liza Bautista", contact: "09281112233", purpose: "Meeting / Appointment", host: "Office of the Director — Atty. Ramos", timeIn: today(126), timeOut: null, archived: false, registeredBy: "U-001" },
    { id: "VIS-0010", fullName: "Kristine Joy Navarro", contact: "09175556677", purpose: "Job application / Interview", host: "HR Department", timeIn: today(48), timeOut: null, archived: false, registeredBy: "U-002" },
  ];

  const raw: Omit<ActivityLog, "id">[] = [
    { timestamp: at(10, 8, 1, now), userId: "U-002", userName: "Jericho Reyes", action: "Login" },
    { timestamp: at(10, 14, 0, now), userId: "U-002", userName: "Jericho Reyes", action: "Registered visitor", recordId: "VIS-0004", details: "Dominic Tan → IT Support" },
    { timestamp: at(10, 15, 25, now), userId: "U-002", userName: "Jericho Reyes", action: "Checked-out visitor", recordId: "VIS-0004" },
    { timestamp: at(9, 9, 12, now), userId: "U-004", userName: "Ramon Villanueva", action: "Edited visitor", recordId: "VIS-0004", details: "Host: \"IT Support\" → \"IT Support — Engr. Lim\". Reason: Visitor clarified the person visited." },
    { timestamp: at(6, 10, 0, now), userId: "U-004", userName: "Ramon Villanueva", action: "Deactivated staff", recordId: "U-003", details: "Angela Cruz — transferred to another office" },
    { timestamp: at(3, 11, 20, now), userId: "U-001", userName: "Maria Santos", action: "Registered visitor", recordId: "VIS-0005", details: "Rhea Mae Castillo → Records Section" },
    { timestamp: at(3, 11, 45, now), userId: "U-001", userName: "Maria Santos", action: "Checked-out visitor", recordId: "VIS-0005" },
    { timestamp: at(1, 14, 5, now), userId: "U-002", userName: "Jericho Reyes", action: "Registered visitor", recordId: "VIS-0006", details: "Paolo Fernandez → Accounting Office" },
    { timestamp: at(1, 14, 40, now), userId: "U-002", userName: "Jericho Reyes", action: "Checked-out visitor", recordId: "VIS-0006" },
    { timestamp: at(1, 17, 2, now), userId: "U-005", userName: "Liza Mendoza", action: "Exported report", details: "Weekly report (CSV)" },
    { timestamp: today(230), userId: "U-001", userName: "Maria Santos", action: "Login" },
    { timestamp: today(214), userId: "U-001", userName: "Maria Santos", action: "Registered visitor", recordId: "VIS-0007", details: "Juan Dela Cruz → Records Section" },
    { timestamp: today(170), userId: "U-001", userName: "Maria Santos", action: "Registered visitor", recordId: "VIS-0008", details: "Mark Anthony Gonzales → Procurement Unit" },
    { timestamp: today(152), userId: "U-001", userName: "Maria Santos", action: "Checked-out visitor", recordId: "VIS-0008" },
    { timestamp: today(126), userId: "U-001", userName: "Maria Santos", action: "Registered visitor", recordId: "VIS-0009", details: "Ana Liza Bautista → Office of the Director" },
    { timestamp: today(60), userId: "U-002", userName: "Jericho Reyes", action: "Login" },
    { timestamp: today(48), userId: "U-002", userName: "Jericho Reyes", action: "Registered visitor", recordId: "VIS-0010", details: "Kristine Joy Navarro → HR Department" },
  ];

  const names = ["Carmela Domingo", "Roberto Manalo", "Elena Soriano", "Miguel Alonzo", "Patricia Ramos", "Eduardo Salazar", "Teresa Mercado", "Gabriel Bautista", "Maricel Flores", "Adrian Santiago", "Rosario Jimenez", "Dennis Valdez", "Beatriz Santiago", "Ricardo Mendoza", "Isabel Francisco", "Victor Angeles", "Catherine Dizon", "Antonio Rivera", "Mylene Torres", "Joseph Buenaventura", "Diana Garcia", "Fernando Castillo", "Aileen Padilla", "Rafael Del Rosario", "Nina Evangelista", "Carlos Javier", "Melissa Enriquez", "Francis Ocampo", "Leah Macapagal", "Samuel Villanueva"];
  const departments = ["Records Section", "Accounting Office", "HR Department", "Office of the Director", "Procurement Unit", "IT Support", "Administrative Division"];
  const purposes = ["Document request", "Payment / Billing", "Job application / Interview", "Meeting / Appointment", "Delivery", "Inquiry", "Other: Facility maintenance"];
  names.forEach((fullName, i) => {
    const daysAgo = 1 + (i % 29);
    const hour = 8 + (i % 7);
    const minute = (i * 7) % 40;
    const user = users[i % 2];
    const host = departments[i % departments.length];
    const purpose = purposes[i % purposes.length];
    if (!user || !host || !purpose) return;
    const visitor: Visitor = {
      id: `VIS-${String(i + 11).padStart(4, "0")}`, fullName,
      contact: `0917${String(3000100 + i)}`, purpose, host,
      timeIn: at(daysAgo, hour, minute, now), timeOut: at(daysAgo, hour + 1, minute, now),
      archived: false, registeredBy: user.id,
    };
    visitors.push(visitor);
    raw.push({ timestamp: visitor.timeIn, userId: user.id, userName: user.name, action: "Registered visitor", recordId: visitor.id, details: `${fullName} → ${host}` });
    if (visitor.timeOut) raw.push({ timestamp: visitor.timeOut, userId: user.id, userName: user.name, action: "Checked-out visitor", recordId: visitor.id, details: fullName });
  });
  // Complete the history for every earlier record, without duplicating existing events.
  visitors.forEach((v) => {
    const user = users.find((u) => u.id === v.registeredBy);
    if (!user) return;
    if (!raw.some((l) => l.recordId === v.id && l.action === "Registered visitor")) raw.push({ timestamp: v.timeIn, userId: user.id, userName: user.name, action: "Registered visitor", recordId: v.id, details: `${v.fullName} → ${v.host}` });
    if (v.timeOut && !raw.some((l) => l.recordId === v.id && l.action === "Checked-out visitor")) raw.push({ timestamp: v.timeOut, userId: user.id, userName: user.name, action: "Checked-out visitor", recordId: v.id, details: v.fullName });
  });

  const logs: ActivityLog[] = raw
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .map((l, i) => ({ ...l, id: `LOG-${String(i + 1).padStart(5, "0")}` }))
    .reverse();

  return {
    users,
    visitors,
    logs,
    session: null,
    seq: { visitor: visitors.length, log: logs.length, user: users.length },
  };
}
