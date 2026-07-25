import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ToolContext } from "@lovable.dev/mcp-js";

// --- supabase mock ------------------------------------------------------
type QueryResult = { data: unknown; error: { message: string } | null };
const queryResults: QueryResult[] = [];
const calls: Array<{ table: string; ops: Array<[string, unknown[]]> }> = [];

function makeQueryBuilder(table: string) {
  const entry = { table, ops: [] as Array<[string, unknown[]]> };
  calls.push(entry);
  const chain: Record<string, unknown> = {};
  const methods = ["select", "eq", "order", "limit"];
  for (const m of methods) {
    chain[m] = (...args: unknown[]) => {
      entry.ops.push([m, args]);
      return chain;
    };
  }
  const resolve = () =>
    Promise.resolve(queryResults.shift() ?? { data: null, error: null });
  chain.maybeSingle = resolve;
  chain.single = resolve;
  chain.then = (onFulfilled: (v: QueryResult) => unknown) => resolve().then(onFulfilled);
  return chain;
}

const supabaseMock = { from: (table: string) => makeQueryBuilder(table) };

vi.mock("../lib/mcp/supabaseForUser", () => ({
  supabaseForUser: () => supabaseMock,
}));

import whoami from "../lib/mcp/tools/whoami";
import listLessonPlans from "../lib/mcp/tools/list-lesson-plans";
import getLessonPlan from "../lib/mcp/tools/get-lesson-plan";
import listLessonPlanVersions from "../lib/mcp/tools/list-lesson-plan-versions";

function ctx(authed = true): ToolContext {
  return {
    isAuthenticated: () => authed,
    getUserId: () => "user-1",
    getUserEmail: () => "t@example.com",
    getClientId: () => "client-1",
    getClaims: () => ({}),
    getToken: () => "tok",
  } as unknown as ToolContext;
}

beforeEach(() => {
  queryResults.length = 0;
  calls.length = 0;
});

describe("MCP tools: auth guard", () => {
  it("whoami returns error when unauthenticated", async () => {
    const res = await whoami.handler({}, ctx(false));
    expect(res.isError).toBe(true);
  });
  it("list_lesson_plans returns error when unauthenticated", async () => {
    const res = await listLessonPlans.handler({ limit: 25 }, ctx(false));
    expect(res.isError).toBe(true);
  });
  it("get_lesson_plan returns error when unauthenticated", async () => {
    const res = await getLessonPlan.handler({ id: "00000000-0000-0000-0000-000000000000" }, ctx(false));
    expect(res.isError).toBe(true);
  });
  it("list_lesson_plan_versions returns error when unauthenticated", async () => {
    const res = await listLessonPlanVersions.handler(
      { plan_id: "00000000-0000-0000-0000-000000000000" },
      ctx(false),
    );
    expect(res.isError).toBe(true);
  });
});

describe("whoami", () => {
  it("returns user profile fields", async () => {
    const res = await whoami.handler({}, ctx());
    expect(res.isError).toBeFalsy();
    expect(res.structuredContent).toMatchObject({
      user_id: "user-1",
      email: "t@example.com",
      client_id: "client-1",
    });
  });
});

describe("list_lesson_plans", () => {
  it("returns rows and applies status filter", async () => {
    queryResults.push({ data: [{ id: "p1", title: "A", status: "draft" }], error: null });
    const res = await listLessonPlans.handler({ status: "draft", limit: 10 }, ctx());
    expect(res.isError).toBeFalsy();
    expect((res.structuredContent as { count: number }).count).toBe(1);
    const ops = calls[0].ops.map(([m]) => m);
    expect(ops).toContain("eq");
    expect(ops).toContain("limit");
  });

  it("surfaces supabase errors", async () => {
    queryResults.push({ data: null, error: { message: "boom" } });
    const res = await listLessonPlans.handler({ limit: 25 }, ctx());
    expect(res.isError).toBe(true);
  });
});

describe("get_lesson_plan", () => {
  const id = "11111111-1111-4111-8111-111111111111";

  it("returns plan with current version merged in", async () => {
    queryResults.push({
      data: { id, title: "P", current_version_id: "v1" },
      error: null,
    });
    queryResults.push({ data: { id: "v1", version_no: 1, form: {}, result: null }, error: null });
    const res = await getLessonPlan.handler({ id }, ctx());
    expect(res.isError).toBeFalsy();
    const payload = res.structuredContent as { id: string; current: { id: string } | null };
    expect(payload.id).toBe(id);
    expect(payload.current?.id).toBe("v1");
  });

  it("returns not-found when plan missing", async () => {
    queryResults.push({ data: null, error: null });
    const res = await getLessonPlan.handler({ id }, ctx());
    expect(res.isError).toBe(true);
  });

  it("handles plans with no current_version_id", async () => {
    queryResults.push({ data: { id, current_version_id: null }, error: null });
    const res = await getLessonPlan.handler({ id }, ctx());
    expect(res.isError).toBeFalsy();
    expect((res.structuredContent as { current: unknown }).current).toBeNull();
  });
});

describe("list_lesson_plan_versions", () => {
  it("returns rows ordered newest first", async () => {
    queryResults.push({
      data: [
        { id: "v2", version_no: 2 },
        { id: "v1", version_no: 1 },
      ],
      error: null,
    });
    const res = await listLessonPlanVersions.handler(
      { plan_id: "22222222-2222-4222-8222-222222222222" },
      ctx(),
    );
    expect(res.isError).toBeFalsy();
    const sc = res.structuredContent as { count: number; versions: Array<{ id: string }> };
    expect(sc.count).toBe(2);
    expect(sc.versions[0].id).toBe("v2");
  });
});
