import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyVisitorFilters, emptyFilters } from "@/components/ovms/visitor-filters";
import { createSeed } from "@/lib/ovms/seed";
import { selectTableRows } from "@/lib/ovms/table-data";
import type { ActivityLog } from "@/lib/ovms/types";
import { createCsv, reportRows } from "./reports";
import { officeService } from "./ovms";

const mockSupabase = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
  },
  from: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: mockSupabase }));

type Row = {
  id?: string;
  action?: string;
  full_name?: string;
  time_out?: string | null;
  reason?: string;
  [key: string]: unknown;
};
const tables: Record<"profiles" | "visitors" | "activity_logs", Row[]> = {
  profiles: [],
  visitors: [],
  activity_logs: [],
};
let authenticated = true;

function createQuery(tableName: keyof typeof tables) {
  const rows = tables[tableName];
  if (!rows) throw new Error(`Unexpected Supabase table: ${tableName}`);

  let operation: "select" | "update" = "select";
  let updateValues: Row = {};
  const filters: Array<(row: Row) => boolean> = [];

  const matchingRows = () => rows.filter((row) => filters.every((filter) => filter(row)));
  const execute = () => {
    const matches = matchingRows();
    if (operation === "update") {
      matches.forEach((row) => Object.assign(row, updateValues));
    }
    return { data: matches, error: null };
  };
  const query = {
    select: () => query,
    order: async (column: string, options?: { ascending?: boolean }) => {
      const data = [...rows].sort((a, b) => {
        const left = String(a[column] ?? "");
        const right = String(b[column] ?? "");
        return (options?.ascending === false ? -1 : 1) * left.localeCompare(right);
      });
      return { data, error: null };
    },
    eq: (column: string, value: unknown) => {
      filters.push((row) => row[column] === value);
      return query;
    },
    is: (column: string, value: unknown) => {
      filters.push((row) => row[column] === value);
      return query;
    },
    not: (column: string, operator: string, value: unknown) => {
      filters.push((row) => operator === "is" && row[column] !== value);
      return query;
    },
    in: (column: string, values: unknown[]) => {
      filters.push((row) => values.includes(row[column]));
      return query;
    },
    insert: async (input: Row | Row[]) => {
      rows.push(...(Array.isArray(input) ? input : [input]));
      return { error: null };
    },
    upsert: async (input: Row | Row[]) => {
      for (const item of Array.isArray(input) ? input : [input]) {
        const existing = rows.find((row) => row.id === item.id);
        if (existing) Object.assign(existing, item);
        else rows.push(item);
      }
      return { error: null };
    },
    update: (values: Row) => {
      operation = "update";
      updateValues = values;
      return query;
    },
    single: async () => ({ data: matchingRows()[0] ?? null, error: null }),
    maybeSingle: async () => {
      const result = execute();
      return { data: result.data[0] ?? null, error: result.error };
    },
    then: (
      resolve: (value: ReturnType<typeof execute>) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(execute()).then(resolve, reject),
  };
  return query;
}

const now = "2026-11-26T12:00:00.000Z";
const visitorInput = {
  fullName: "Camila Rosales",
  contact: "09171234567",
  purpose: "Document request",
  host: "Records Section",
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  authenticated = true;
  tables.profiles = [
    {
      id: "staff-admin",
      email: "admin@guestflow.local",
      username: "admin",
      name: "Ramon Villanueva",
      role: "admin",
      status: "active",
      created_at: now,
      last_login_at: null,
    },
  ];
  tables.visitors = [
    {
      id: "VIS-0001",
      full_name: "Lourdes Pascual",
      contact: "09224561230",
      purpose: "Payment / Billing",
      host: "Accounting Office",
      time_in: now,
      time_out: "2026-11-26T12:35:00.000Z",
      archived: false,
      archived_at: null,
      registered_by: "staff-admin",
    },
  ];
  tables.activity_logs = [
    {
      id: "LOG-0001",
      timestamp: now,
      user_id: "staff-admin",
      user_name: "Ramon Villanueva",
      action: "Edited visitor",
      record_id: "VIS-0001",
      details: "Corrected visitor name",
      reason: "Verified against visitor ID",
      changes: [{ field: "fullName", oldValue: "Old name", newValue: "Lourdes Pascual" }],
    },
  ];

  mockSupabase.auth.getSession.mockImplementation(async () => ({
    data: { session: authenticated ? { user: { id: "staff-admin", last_sign_in_at: now } } : null },
    error: null,
  }));
  mockSupabase.auth.signInWithPassword.mockImplementation(async () => {
    authenticated = true;
    return { data: { user: { id: "staff-admin" } }, error: null };
  });
  mockSupabase.auth.signOut.mockImplementation(async () => {
    authenticated = false;
    return { error: null };
  });
  mockSupabase.from.mockImplementation((tableName: keyof typeof tables) => createQuery(tableName));
});

describe("Supabase OVMS service", () => {
  it("maps database rows and loads archived and active records for a signed-in user", async () => {
    tables.visitors.push({
      id: "VIS-0002",
      full_name: "Archived Visitor",
      contact: "09170000000",
      purpose: "Inquiry",
      host: "Records Section",
      time_in: now,
      time_out: now,
      archived: true,
      archived_at: now,
      registered_by: "staff-admin",
    });

    const state = await officeService.load();

    expect(state.users[0]).toMatchObject({ name: "Ramon Villanueva", role: "admin", password: "" });
    expect(state.visitors).toHaveLength(2);
    expect(state.visitors[0]).toMatchObject({
      id: "VIS-0001",
      fullName: "Lourdes Pascual",
      timeIn: now,
      archived: false,
    });
    expect(state.visitors[1]).toMatchObject({ id: "VIS-0002", archived: true, archivedAt: now });
    expect(state.logs[0]).toMatchObject({
      userId: "staff-admin",
      recordId: "VIS-0001",
      reason: "Verified against visitor ID",
      changes: [{ field: "fullName", oldValue: "Old name", newValue: "Lourdes Pascual" }],
    });
  });

  it("returns an empty state and does not query private tables when signed out", async () => {
    authenticated = false;

    await expect(officeService.load()).resolves.toMatchObject({
      users: [],
      visitors: [],
      logs: [],
      session: null,
    });
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("registers and checks out visitors with activity logs", async () => {
    const registered = await officeService.registerVisitor(visitorInput);
    expect(registered.result).toMatchObject({
      fullName: visitorInput.fullName,
      archived: false,
      timeOut: null,
    });
    expect(tables.visitors).toContainEqual(
      expect.objectContaining({
        full_name: visitorInput.fullName,
        registered_by: "staff-admin",
        archived: false,
      }),
    );
    expect(tables.activity_logs).toContainEqual(
      expect.objectContaining({
        action: "Registered visitor",
        record_id: registered.result.id,
      }),
    );

    await officeService.timeOutVisitor(registered.result.id);
    expect(tables.visitors.find((row) => row.id === registered.result.id)?.time_out).toBeTruthy();
    expect(tables.activity_logs).toContainEqual(
      expect.objectContaining({
        action: "Checked-out visitor",
        record_id: registered.result.id,
      }),
    );
  });

  it("persists edit diffs and reason in the activity log", async () => {
    const updated = { ...visitorInput, fullName: "Lourdes Pascual Reyes" };

    await officeService.editVisitor("VIS-0001", updated, "Corrected against visitor ID");

    expect(tables.visitors[0]?.full_name).toBe("Lourdes Pascual Reyes");
    const log = tables.activity_logs.find(
      (row) => row.action === "Edited visitor" && row.reason === "Corrected against visitor ID",
    );
    expect(log?.["changes"]).toEqual(
      expect.arrayContaining([
        { field: "fullName", oldValue: "Lourdes Pascual", newValue: "Lourdes Pascual Reyes" },
      ]),
    );
  });

  it("archives and restores records while logging each transition", async () => {
    await officeService.archiveVisitor("VIS-0001");
    expect(tables.visitors[0]).toMatchObject({ archived: true, archived_at: expect.any(String) });
    expect(tables.activity_logs).toContainEqual(
      expect.objectContaining({
        action: "Archived record",
        record_id: "VIS-0001",
      }),
    );

    await officeService.restoreVisitor("VIS-0001");
    expect(tables.visitors[0]).toMatchObject({ archived: false, archived_at: null });
    expect(tables.activity_logs).toContainEqual(
      expect.objectContaining({
        action: "Restored record",
        record_id: "VIS-0001",
      }),
    );
  });

  it("rejects a checkout of a visitor who has already checked out", async () => {
    await expect(officeService.timeOutVisitor("VIS-0001")).rejects.toThrow("no longer inside");
  });

  it("queues offline registrations and checkouts, then replays them in order", async () => {
    await officeService.load();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });

    const registered = await officeService.registerVisitor(visitorInput);
    expect(registered.queued).toBe(true);
    expect(registered.result.id).toMatch(/^VIS-/);
    expect(registered.state.visitors).toContainEqual(
      expect.objectContaining({
        id: registered.result.id,
        fullName: visitorInput.fullName,
        timeOut: null,
      }),
    );
    expect(officeService.getPendingSyncCount()).toBe(1);

    const checkedOut = await officeService.timeOutVisitor(registered.result.id);
    expect(checkedOut.queued).toBe(true);
    expect(
      checkedOut.state.visitors.find((visitor) => visitor.id === registered.result.id)?.timeOut,
    ).toBeTruthy();
    expect(officeService.getPendingSyncCount()).toBe(2);
    expect(tables.visitors.some((row) => row.id === registered.result.id)).toBe(false);
    const offlineReload = await officeService.load();
    expect(
      offlineReload.visitors.find((visitor) => visitor.id === registered.result.id)?.timeOut,
    ).toBeTruthy();

    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    await officeService.syncOfflineQueue();

    expect(officeService.getPendingSyncCount()).toBe(0);
    expect(tables.visitors.find((row) => row.id === registered.result.id)?.time_out).toBeTruthy();
    expect(tables.activity_logs).toContainEqual(
      expect.objectContaining({ action: "Registered visitor", record_id: registered.result.id }),
    );
    expect(tables.activity_logs).toContainEqual(
      expect.objectContaining({ action: "Checked-out visitor", record_id: registered.result.id }),
    );
  });

  it("queues and replays edits, archives, and restores in order", async () => {
    await officeService.load();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });

    await officeService.editVisitor(
      "VIS-0001",
      { ...visitorInput, fullName: "Lourdes Pascual Reyes" },
      "Corrected against visitor ID",
    );
    await officeService.archiveVisitor("VIS-0001");
    const restored = await officeService.restoreVisitor("VIS-0001");

    expect(officeService.getPendingSyncCount()).toBe(3);
    expect(restored.state.visitors.find((visitor) => visitor.id === "VIS-0001")).toMatchObject({
      fullName: "Lourdes Pascual Reyes",
      archived: false,
    });

    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    await officeService.syncOfflineQueue();

    expect(officeService.getPendingSyncCount()).toBe(0);
    expect(tables.visitors[0]).toMatchObject({
      full_name: "Lourdes Pascual Reyes",
      archived: false,
      archived_at: null,
    });
    expect(tables.activity_logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "Edited visitor", record_id: "VIS-0001" }),
        expect.objectContaining({ action: "Archived record", record_id: "VIS-0001" }),
        expect.objectContaining({ action: "Restored record", record_id: "VIS-0001" }),
      ]),
    );
  });
});

describe("tables and report data", () => {
  it("searches, sorts and paginates actual rows", () => {
    const rows = createSeed().visitors;
    const sorted = selectTableRows(
      rows,
      "",
      (v) => v.fullName,
      (a, b) => a.fullName.localeCompare(b.fullName),
      false,
      2,
      10,
    );
    expect(sorted.rows).toHaveLength(10);
    expect(sorted.total).toBe(40);
    expect(sorted.pages).toBe(4);
    expect(sorted.rows[0]?.fullName).toBe(
      [...rows].sort((a, b) => a.fullName.localeCompare(b.fullName))[10]?.fullName,
    );
    expect(
      selectTableRows(
        rows,
        "Juan Dela Cruz",
        (v) => v.fullName,
        () => 0,
        false,
        1,
        10,
      ).rows.map((v) => v.id),
    ).toEqual(["VIS-0007"]);
  });

  it("exports selected records and escapes CSV formula values", () => {
    const rows = createSeed().visitors;
    const csv = createCsv(rows);
    expect(csv.split("\r\n")).toHaveLength(41);
    expect(csv).toContain('"Lourdes Pascual"');
    expect(reportRows(rows)[0]?.[0]).toBe("VIS-0001");
    const first = rows[0];
    if (!first) throw new Error("Missing visitor");
    expect(createCsv([{ ...first, host: '=HYPERLINK("bad")' }])).toContain(
      '"\'=HYPERLINK(""bad"")"',
    );
  });
});
