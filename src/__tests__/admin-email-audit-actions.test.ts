import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  rpc: vi.fn(),
  fetch: vi.fn(),
  oldLog: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validator = (input: unknown) => input;
    const chain = {
      middleware: () => chain,
      inputValidator: (next: (input: unknown) => unknown) => {
        validator = next;
        return chain;
      },
      handler: (handler: (input: unknown) => unknown) => (input: { data: unknown }) =>
        handler({
          data: validator(input.data),
          context: {
            userId: "admin-id",
            supabase: { rpc: mocks.rpc, from: () => ({ insert: mocks.insert }) },
          },
        }),
    };
    return chain;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc: mocks.oldLog } }));

import { resendVerificationEmails } from "@/lib/admin-users.functions";
import { recordEmailDismissal } from "@/lib/admin-email-audit.functions";
import { reportEmailHistoryObservation } from "@/lib/admin-email-history.functions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.insert.mockResolvedValue({ error: null });
  mocks.oldLog.mockResolvedValue({ error: null });
  mocks.fetch.mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", mocks.fetch);
  vi.stubEnv("SUPABASE_URL", "https://backend.test");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "public-test-key");
});

describe("protected-history observations", () => {
  it("records a confirmed appearance without accepting actor or timestamp from the client", async () => {
    await expect(
      reportEmailHistoryObservation({ data: { state: "restriction_present", confirmed: true } }),
    ).resolves.toEqual({ recorded: true });
    expect(mocks.rpc).toHaveBeenLastCalledWith("record_email_history_observation", {
      _state: "restriction_present",
    });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("records a confirmed clearance as an observation, without invoking email delivery", async () => {
    await reportEmailHistoryObservation({
      data: { state: "restriction_cleared", confirmed: true },
    });
    expect(mocks.rpc).toHaveBeenLastCalledWith("record_email_history_observation", {
      _state: "restriction_cleared",
    });
    expect(mocks.oldLog).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("requires explicit confirmation before recording status", async () => {
    await expect(
      Promise.resolve().then(() =>
        reportEmailHistoryObservation({
          data: { state: "restriction_present", confirmed: false },
        } as unknown as Parameters<typeof reportEmailHistoryObservation>[0]),
      ),
    ).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects status reports from non-admins", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    await expect(
      reportEmailHistoryObservation({ data: { state: "restriction_cleared", confirmed: true } }),
    ).rejects.toThrow("Admin access required");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("does not claim a new event when the database reports a duplicate state", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: false, error: null });
    await expect(
      reportEmailHistoryObservation({ data: { state: "restriction_present", confirmed: true } }),
    ).resolves.toEqual({ recorded: false });
  });
});

describe("admin action auditing at execution", () => {
  it("records each retry before requesting a fresh verification", async () => {
    await resendVerificationEmails({ data: { emails: ["teacher@example.com"] } });
    expect(mocks.insert).toHaveBeenCalledWith({
      actor_user_id: "admin-id",
      action: "verification_retry_requested",
      email_log_id: null,
    });
    expect(mocks.insert.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.fetch.mock.invocationCallOrder[0] ?? 0,
    );
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it("never sends a retry if its audit write fails", async () => {
    mocks.insert.mockResolvedValue({ error: { message: "denied" } });
    await expect(
      resendVerificationEmails({ data: { emails: ["teacher@example.com"] } }),
    ).rejects.toThrow("No action was performed");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("rejects a non-admin dismissal without writing an audit record", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    await expect(
      recordEmailDismissal({ data: { emailLogId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } }),
    ).rejects.toThrow("Admin access required");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("only acknowledges dismissal after the audit write succeeds", async () => {
    mocks.insert.mockResolvedValue({ error: { message: "offline" } });
    await expect(
      recordEmailDismissal({ data: { emailLogId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } }),
    ).rejects.toThrow("No action was performed");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
