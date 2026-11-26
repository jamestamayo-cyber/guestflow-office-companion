import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compareSync } from "bcryptjs";
import { officeService, STORAGE_KEY } from "./ovms";
import { createSeed } from "@/lib/ovms/seed";
import { selectTableRows } from "@/lib/ovms/table-data";
import { createCsv, reportRows } from "./reports";
import { applyVisitorFilters, emptyFilters } from "@/components/ovms/visitor-filters";

beforeEach(() => { window.localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });
const visitor = { fullName: "Camila Rosales", contact: "09171234567", purpose: "Document request", host: "Records Section" };
const signIn = async (admin = false) => {
  await officeService.load();
  const response = await officeService.login(admin ? "rvillanueva" : "msantos", admin ? "Admin@2026" : "Staff@2026");
  expect(response.result.ok).toBe(true);
};

describe("office persistence and auditing", () => {
  it("stores bcrypt hashes, 40 visitors in the last 30 days and matching history", async () => {
    const state = await officeService.load();
    expect(state.visitors).toHaveLength(40);
    expect(state.users.every((u) => u.password.startsWith("$2b$"))).toBe(true);
    expect(compareSync("Staff@2026", state.users[0]?.password ?? "")).toBe(true);
    expect(state.visitors.every((v) => Date.now() - Date.parse(v.timeIn) < 30 * 86400000)).toBe(true);
    expect(state.visitors.every((v) => state.logs.some((l) => l.recordId === v.id && l.action === "Registered visitor"))).toBe(true);
    expect(state.visitors.filter((v) => v.timeOut).every((v) => state.logs.some((l) => l.recordId === v.id && l.action === "Checked-out visitor"))).toBe(true);
  });
  it("preserves old records and migrates plaintext without leaving a legacy copy", async () => {
    const old = createSeed();
    old.visitors = old.visitors.slice(0, 10);
    old.seq.visitor = 10;
    const user = old.users[0];
    if (!user) throw new Error("Missing staff account");
    user.password = "Staff@2026";
    const first = old.visitors[0];
    if (!first) throw new Error("Missing visitor");
    first.fullName = "Marina Alvarez";
    window.localStorage.setItem("ovms-prototype-v1", JSON.stringify(old));
    const state = await officeService.load();
    expect(state.visitors).toHaveLength(40);
    expect(state.visitors[0]?.fullName).toBe("Marina Alvarez");
    expect(state.users[0]?.password).not.toBe("Staff@2026");
    expect(window.localStorage.getItem("ovms-prototype-v1")).toBeNull();
  });
  it("registers, persists after reload, checks out and searches real records", async () => {
    await signIn();
    const created = await officeService.registerVisitor(visitor);
    expect(created.result.timeOut).toBeNull();
    const reload = await officeService.load();
    expect(reload.visitors.find((v) => v.id === created.result.id)?.fullName).toBe("Camila Rosales");
    const checked = await officeService.checkOut(created.result.id);
    const saved = checked.state.visitors.find((v) => v.id === created.result.id);
    expect(saved?.timeOut).not.toBeNull();
    expect(applyVisitorFilters(checked.state.visitors, { ...emptyFilters, q: "Camila", status: "Checked out", purpose: "Document request" }).map((v) => v.id)).toEqual([created.result.id]);
    expect(checked.state.logs.filter((l) => l.recordId === created.result.id).map((l) => l.action)).toEqual(["Checked-out visitor", "Registered visitor"]);
  });
  it("requires an edit reason and saves old/new values with actor and timestamp", async () => {
    await signIn(true);
    await expect(officeService.editVisitor("VIS-0001", visitor, "")).rejects.toThrow("reason");
    const edit = await officeService.editVisitor("VIS-0001", visitor, "Corrected details from visitor ID");
    const entry = edit.state.logs[0];
    expect(entry?.reason).toBe("Corrected details from visitor ID");
    expect(entry?.changes).toContainEqual({ field: "fullName", oldValue: "Lourdes Pascual", newValue: "Camila Rosales" });
    expect(entry?.userName).toBe("Ramon Villanueva");
    expect(Number.isFinite(Date.parse(entry?.timestamp ?? ""))).toBe(true);
  });
  it("archives and restores across screens, never archives someone still inside", async () => {
    await signIn(true);
    await expect(officeService.archiveVisitors(["VIS-0007"])).rejects.toThrow("checked-out");
    const archived = await officeService.archiveVisitors(["VIS-0001"]);
    expect(archived.state.visitors.find((v) => v.id === "VIS-0001")?.archived).toBe(true);
    const restored = await officeService.restoreVisitors(["VIS-0001"]);
    expect(restored.state.visitors.find((v) => v.id === "VIS-0001")?.archived).toBe(false);
    expect(restored.state.logs.slice(0, 2).map((l) => l.action)).toEqual(["Restored record", "Archived record"]);
  });
  it("rejects invalid visitor fields on both registration and edit without changing records", async () => {
    await signIn(true);
    const before = window.localStorage.getItem(STORAGE_KEY);
    await expect(officeService.registerVisitor({ ...visitor, contact: "123" })).rejects.toThrow("valid details");
    await expect(officeService.editVisitor("VIS-0001", { ...visitor, fullName: "" }, "Corrected details from visitor ID")).rejects.toThrow("valid details");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(before);
  });
  it("persists staff changes, hashed resets and logs every account action", async () => {
    await signIn(true);
    const add = await officeService.addStaff({ name: "Carla Domingo", username: "cdomingo", role: "receptionist", password: "Office@2026" });
    expect(add.result.ok).toBe(true);
    const staff = add.state.users.find((u) => u.username === "cdomingo");
    if (!staff) throw new Error("Missing added staff");
    await officeService.updateStaff(staff.id, { name: "Carla Domingo Reyes", username: "cdomingo", role: "receptionist" });
    await officeService.setStaffStatus(staff.id, "inactive");
    await officeService.setStaffStatus(staff.id, "active");
    const reset = await officeService.resetPassword(staff.id);
    expect(compareSync(reset.result, reset.state.users.find((u) => u.id === staff.id)?.password ?? "")).toBe(true);
    expect(reset.state.logs.filter((l) => l.recordId === staff.id).map((l) => l.action)).toEqual(["Reset password", "Activated staff", "Deactivated staff", "Edited staff", "Added staff"]);
    const reloaded = await officeService.load();
    expect(reloaded.users.find((u) => u.id === staff.id)?.name).toBe("Carla Domingo Reyes");
  }, 15000);
  it("logs successful login and logout", async () => {
    await signIn();
    const loggedOut = await officeService.logout();
    expect(loggedOut.state.session).toBeNull();
    expect(loggedOut.state.logs.slice(0, 2).map((l) => l.action)).toEqual(["Logout", "Login"]);
    expect(loggedOut.state.logs[0]?.userName).toBe("Maria Santos");
  });
  it("rejects administrator mutations for receptionists", async () => {
    await signIn();
    await expect(officeService.editVisitor("VIS-0001", visitor, "Corrected visitor details")).rejects.toThrow("administrators");
    await expect(officeService.archiveVisitors(["VIS-0001"])).rejects.toThrow("administrators");
    await expect(officeService.addStaff({ name: "Carla Domingo", username: "cdomingo", role: "admin", password: "Office@2026" })).rejects.toThrow("administrators");
  });
  it("blocks deactivated accounts", async () => {
    await officeService.load();
    const result = await officeService.login("acruz", "Staff@2026");
    expect(result.result).toEqual({ ok: false, error: "This account is deactivated. Contact your administrator." });
  });
  it("locks the fifth failure, persists the lock and unlocks after one minute", async () => {
    await officeService.load();
    for (let i = 0; i < 5; i++) await officeService.login("msantos", "wrong");
    const saved = await officeService.load();
    expect(saved.loginAttempts?.failures).toBe(5);
    expect((await officeService.login("msantos", "Staff@2026")).result.ok).toBe(false);
    vi.spyOn(Date, "now").mockReturnValue((saved.loginAttempts?.lockedUntil ?? 0) + 1);
    expect((await officeService.login("msantos", "Staff@2026")).result.ok).toBe(true);
  }, 15000);
  it("cannot bypass inactivity expiry by refreshing", async () => {
    await signIn();
    const saved = await officeService.load();
    vi.spyOn(Date, "now").mockReturnValue(Date.parse(saved.session?.lastActivityAt ?? "") + 900001);
    const reload = await officeService.load();
    expect(reload.session).toBeNull();
    expect(reload.logs.slice(0, 2).map((l) => l.action)).toEqual(["Logout", "Session expired"]);
  });
  it("keeps saved records unchanged if a write fails", async () => {
    await signIn();
    const before = window.localStorage.getItem(STORAGE_KEY);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Full"); });
    await expect(officeService.registerVisitor(visitor)).rejects.toThrow("could not be saved");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(before);
  });
});

describe("tables and real report data", () => {
  it("searches, sorts and paginates the actual rows", () => {
    const rows = createSeed().visitors;
    const sorted = selectTableRows(rows, "", (v) => v.fullName, (a, b) => a.fullName.localeCompare(b.fullName), false, 2, 10);
    expect(sorted.rows).toHaveLength(10);
    expect(sorted.total).toBe(40);
    expect(sorted.pages).toBe(4);
    expect(sorted.rows[0]?.fullName).toBe([...rows].sort((a, b) => a.fullName.localeCompare(b.fullName))[10]?.fullName);
    expect(selectTableRows(rows, "Juan Dela Cruz", (v) => v.fullName, () => 0, false, 1, 10).rows.map((v) => v.id)).toEqual(["VIS-0007"]);
  });
  it("exports all selected real records, escapes CSV and includes local timestamps", () => {
    const rows = createSeed().visitors;
    const csv = createCsv(rows);
    expect(csv.split("\r\n")).toHaveLength(41);
    expect(csv).toContain('"Lourdes Pascual"');
    expect(reportRows(rows)[0]?.[0]).toBe("VIS-0001");
    const first = rows[0];
    if (!first) throw new Error("Missing visitor");
    expect(createCsv([{ ...first, host: '=HYPERLINK("bad")' }])).toContain('"\'=HYPERLINK(""bad"")"');
  });
});
