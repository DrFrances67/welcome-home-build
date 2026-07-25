import { describe, it, expect, beforeEach } from "vitest";
import {
  deleteLessonPlanImpl,
  deleteVersionImpl,
  getInputSchema,
  getLessonPlanImpl,
  isLessonPlanConflict,
  LessonPlanConflictError,
  listInputSchema,
  listLessonPlansImpl,
  listVersionsImpl,
  renameLessonPlanImpl,
  renamePlanInputSchema,
  renameVersionImpl,
  renameVersionInputSchema,
  restoreVersionImpl,
  saveInputSchema,
  saveLessonPlanImpl,
} from "../lib/lesson-plans.impl";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../integrations/supabase/types";

// ---------------------------------------------------------------------------
// In-memory Supabase fake — supports the small subset of query builder
// operations the impls use: select/insert/update/delete + eq/order/limit +
// single/maybeSingle. Query results are supplied via a FIFO queue.
// ---------------------------------------------------------------------------
type QRes = { data: unknown; error: { message: string } | null };
type Op = [string, unknown[]];
type Recorded = { table: string; ops: Op[] };

function makeFake() {
  const results: QRes[] = [];
  const calls: Recorded[] = [];

  function builder(table: string) {
    const entry: Recorded = { table, ops: [] };
    calls.push(entry);
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "insert", "update", "delete", "eq", "order", "limit"]) {
      chain[m] = (...args: unknown[]) => {
        entry.ops.push([m, args]);
        return chain;
      };
    }
    const resolve = () => Promise.resolve(results.shift() ?? { data: null, error: null });
    chain.single = resolve;
    chain.maybeSingle = resolve;
    chain.then = (fn: (v: QRes) => unknown) => resolve().then(fn);
    return chain;
  }

  const client = { from: (t: string) => builder(t) } as unknown as SupabaseClient<Database>;
  return { client, results, calls };
}

const UUID_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const UUID_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const UUID_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

let fake: ReturnType<typeof makeFake>;
beforeEach(() => {
  fake = makeFake();
});

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
describe("input schemas", () => {
  it("saveInputSchema requires form and defaults status to draft", () => {
    const parsed = saveInputSchema.parse({ form: { grade: "3" } });
    expect(parsed.status).toBe("draft");
  });
  it("saveInputSchema rejects empty title", () => {
    expect(() => saveInputSchema.parse({ form: {}, title: "  " })).toThrow();
  });
  it("saveInputSchema rejects invalid uuid", () => {
    expect(() => saveInputSchema.parse({ form: {}, id: "not-a-uuid" })).toThrow();
  });
  it("saveInputSchema rejects unknown status", () => {
    expect(() => saveInputSchema.parse({ form: {}, status: "archived" })).toThrow();
  });
  it("listInputSchema accepts empty and status filter", () => {
    expect(listInputSchema.parse({})).toEqual({});
    expect(listInputSchema.parse({ status: "saved" }).status).toBe("saved");
  });
  it("getInputSchema requires uuid", () => {
    expect(() => getInputSchema.parse({ id: "nope" })).toThrow();
    expect(getInputSchema.parse({ id: UUID_A }).id).toBe(UUID_A);
  });
  it("renamePlanInputSchema requires non-empty trimmed title", () => {
    expect(() => renamePlanInputSchema.parse({ id: UUID_A, title: "   " })).toThrow();
    expect(renamePlanInputSchema.parse({ id: UUID_A, title: "  ok  " }).title).toBe("ok");
  });
  it("renameVersionInputSchema allows null label", () => {
    expect(renameVersionInputSchema.parse({ versionId: UUID_A, label: null }).label).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------
describe("listLessonPlansImpl", () => {
  it("returns rows and applies status filter", async () => {
    fake.results.push({ data: [{ id: UUID_A, title: "P" }], error: null });
    const rows = await listLessonPlansImpl(fake.client, { status: "draft" });
    expect(rows).toHaveLength(1);
    const ops = fake.calls[0].ops.map(([m]) => m);
    expect(ops).toContain("order");
    expect(ops).toContain("eq");
  });
  it("throws when supabase returns error", async () => {
    fake.results.push({ data: null, error: { message: "db down" } });
    await expect(listLessonPlansImpl(fake.client, {})).rejects.toThrow("db down");
  });
});

describe("getLessonPlanImpl", () => {
  it("merges current version when present", async () => {
    fake.results.push({ data: { id: UUID_A, current_version_id: UUID_B }, error: null });
    fake.results.push({ data: { id: UUID_B, version_no: 3 }, error: null });
    const out = await getLessonPlanImpl(fake.client, { id: UUID_A });
    expect(out.current?.id).toBe(UUID_B);
  });
  it("returns null current when no current_version_id", async () => {
    fake.results.push({ data: { id: UUID_A, current_version_id: null }, error: null });
    const out = await getLessonPlanImpl(fake.client, { id: UUID_A });
    expect(out.current).toBeNull();
  });
  it("throws when plan missing", async () => {
    fake.results.push({ data: null, error: null });
    await expect(getLessonPlanImpl(fake.client, { id: UUID_A })).rejects.toThrow();
  });
});

describe("listVersionsImpl", () => {
  it("orders by version_no descending", async () => {
    fake.results.push({ data: [{ id: UUID_A }, { id: UUID_B }], error: null });
    const rows = await listVersionsImpl(fake.client, { planId: UUID_C });
    expect(rows).toHaveLength(2);
    const orderCall = fake.calls[0].ops.find(([m]) => m === "order");
    expect(orderCall?.[1][1]).toEqual({ ascending: false });
  });
});

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------
describe("saveLessonPlanImpl", () => {
  it("creates plan when no id, inserts version_no=1, updates current pointer", async () => {
    // 1. insert plan → returns id
    fake.results.push({ data: { id: UUID_A }, error: null });
    // 2. last version lookup → none yet
    fake.results.push({ data: null, error: null });
    // 3. insert version
    fake.results.push({ data: { id: UUID_B, version_no: 1 }, error: null });
    // 4. update plan
    fake.results.push({ data: { id: UUID_A, current_version_id: UUID_B }, error: null });

    const out = await saveLessonPlanImpl(fake.client, "user-1", {
      form: { grade: "3" },
      status: "draft",
    });
    expect(out.id).toBe(UUID_A);
    expect(out.current?.version_no).toBe(1);
  });

  it("increments version_no when previous versions exist", async () => {
    // existing plan lookup
    fake.results.push({ data: { id: UUID_A }, error: null });
    // last version
    fake.results.push({ data: { version_no: 4 }, error: null });
    // insert version
    fake.results.push({ data: { id: UUID_B, version_no: 5 }, error: null });
    // update plan
    fake.results.push({ data: { id: UUID_A }, error: null });

    const out = await saveLessonPlanImpl(fake.client, "user-1", {
      id: UUID_A,
      form: {},
      status: "saved",
    });
    expect(out.current?.version_no).toBe(5);
  });

  it("throws when id is provided but plan does not exist", async () => {
    fake.results.push({ data: null, error: null }); // existing plan lookup miss
    await expect(
      saveLessonPlanImpl(fake.client, "u", { id: UUID_A, form: {}, status: "draft" }),
    ).rejects.toThrow("Lesson plan not found");
  });
});

describe("restoreVersionImpl", () => {
  it("copies snapshot into a new version and points plan at it", async () => {
    // source version
    fake.results.push({
      data: { id: UUID_B, version_no: 2, form: { a: 1 }, result: null },
      error: null,
    });
    // last version
    fake.results.push({ data: { version_no: 5 }, error: null });
    // insert new version
    fake.results.push({ data: { id: UUID_C, version_no: 6 }, error: null });
    // update plan
    fake.results.push({ data: { id: UUID_A, current_version_id: UUID_C }, error: null });

    const out = await restoreVersionImpl(fake.client, "u", {
      planId: UUID_A,
      versionId: UUID_B,
    });
    expect(out.current?.version_no).toBe(6);
    expect(out.current_version_id).toBe(UUID_C);
  });
});

describe("rename/delete impls", () => {
  it("renameLessonPlanImpl returns updated row", async () => {
    fake.results.push({ data: { id: UUID_A, title: "New" }, error: null });
    const out = await renameLessonPlanImpl(fake.client, { id: UUID_A, title: "New" });
    expect(out.title).toBe("New");
  });

  it("renameVersionImpl supports null label", async () => {
    fake.results.push({ data: { id: UUID_A, label: null }, error: null });
    const out = await renameVersionImpl(fake.client, { versionId: UUID_A, label: null });
    expect(out.label).toBeNull();
  });

  it("deleteLessonPlanImpl returns ok", async () => {
    fake.results.push({ data: null, error: null });
    await expect(deleteLessonPlanImpl(fake.client, { id: UUID_A })).resolves.toEqual({ ok: true });
  });

  it("deleteVersionImpl refuses to delete the current version", async () => {
    // version lookup
    fake.results.push({ data: { id: UUID_B, lesson_plan_id: UUID_A }, error: null });
    // plan lookup — reports UUID_B is current
    fake.results.push({ data: { current_version_id: UUID_B }, error: null });
    await expect(deleteVersionImpl(fake.client, { versionId: UUID_B })).rejects.toThrow(
      /current version/i,
    );
  });

  it("deleteVersionImpl allows deleting non-current versions", async () => {
    fake.results.push({ data: { id: UUID_B, lesson_plan_id: UUID_A }, error: null });
    fake.results.push({ data: { current_version_id: UUID_C }, error: null });
    fake.results.push({ data: null, error: null });
    await expect(deleteVersionImpl(fake.client, { versionId: UUID_B })).resolves.toEqual({
      ok: true,
    });
  });
});
