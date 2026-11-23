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
