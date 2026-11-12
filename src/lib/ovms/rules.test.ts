import { describe, expect, it } from "vitest";
import { subDays } from "date-fns";
import { createSeed } from "./seed";
import { authenticate, canAccessAdmin, homeForRole, isEligibleForArchive } from "./rules";
import { navForRole } from "./nav";
import { maskContact } from "./format";
import { isStrongPassword, isValidPhone, validateVisitor } from "./validation";

const users = createSeed().users;

describe("sign-in", () => {
  it("rejects a wrong password", () => {
    expect(authenticate(users, "msantos", "wrong").ok).toBe(false);
  });
  it("rejects deactivated accounts even with the right password", () => {
    const r = authenticate(users, "acruz", "Staff@2026");
    expect(r.ok).toBe(false);
  });
  it("routes receptionists to the front desk and admins to the admin dashboard", () => {
    expect(homeForRole("receptionist")).toBe("/dashboard");
    expect(homeForRole("admin")).toBe("/admin");
  });
});

describe("role-based access", () => {
  it("receptionist sidebar has 4 items, admin has 7", () => {
    expect(navForRole("receptionist")).toHaveLength(4);
    expect(navForRole("admin")).toHaveLength(7);
  });
  it("only administrators can open admin pages", () => {
    expect(canAccessAdmin("receptionist")).toBe(false);
    expect(canAccessAdmin("admin")).toBe(true);
  });
});

describe("seed data", () => {
  it("has 10 visitors, 3 receptionists and 2 admins", () => {
    const s = createSeed();
    expect(s.visitors).toHaveLength(10);
    expect(s.users.filter((u) => u.role === "receptionist")).toHaveLength(3);
    expect(s.users.filter((u) => u.role === "admin")).toHaveLength(2);
  });
});

describe("visitor validation", () => {
  it("accepts PH mobile formats and rejects others", () => {
    expect(isValidPhone("09171234567")).toBe(true);
    expect(isValidPhone("+63 917 123 4567")).toBe(true);
    expect(isValidPhone("0817 123 4567")).toBe(false);
    expect(isValidPhone("12345")).toBe(false);
  });
  it("requires all fields and a specified purpose when Other is chosen", () => {
    const e = validateVisitor({ fullName: "", contact: "", purpose: "Other", purposeOther: "", host: "" });
    expect(Object.keys(e).sort()).toEqual(["contact", "fullName", "host", "purposeOther"]);
  });
  it("masks contact numbers to prefix and last 3 digits", () => {
    expect(maskContact("09171234567")).toBe("0917 •••• 567");
  });
});

describe("staff passwords", () => {
  it("requires 8+ chars with upper, lower, number and symbol", () => {
    expect(isStrongPassword("Staff@2026")).toBe(true);
    expect(isStrongPassword("staff2026")).toBe(false);
    expect(isStrongPassword("Sh@1")).toBe(false);
  });
});

describe("retention", () => {
  const now = new Date();
  const base = { id: "X", fullName: "A", contact: "09171234567", purpose: "Inquiry", host: "HR", archived: false, registeredBy: "U-001" };
  it("only archives checked-out records older than the period", () => {
    const old = { ...base, timeIn: subDays(now, 200).toISOString(), timeOut: subDays(now, 200).toISOString() };
    const recent = { ...old, timeIn: subDays(now, 10).toISOString() };
    const inside = { ...old, timeOut: null };
    expect(isEligibleForArchive(old, 180, now)).toBe(true);
    expect(isEligibleForArchive(recent, 180, now)).toBe(false);
    expect(isEligibleForArchive(inside, 180, now)).toBe(false);
  });
});
