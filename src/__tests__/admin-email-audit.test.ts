import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { appendEmailAudit, assertEmailAuditAdmin } from "@/lib/admin-email-audit.impl";

function fake(error: { message: string } | null = null, role = true) {
  const insert = vi.fn().mockResolvedValue({ error });
  const rpc = vi.fn().mockResolvedValue({ data: role, error: null });
  return {
    insert,
    rpc,
    client: { from: vi.fn(() => ({ insert })), rpc } as unknown as SupabaseClient<Database>,
  };
}

describe("admin email action audit", () => {
  it("stores only actor, action, and delivery entry reference for dismissals", async () => {
    const db = fake();
    await appendEmailAudit(db.client, "admin-id", "entry_dismissed", "log-id");
    expect(db.insert).toHaveBeenCalledWith({
      actor_user_id: "admin-id",
      action: "entry_dismissed",
      email_log_id: "log-id",
    });
  });
  it("records verification retries without recipient or email contents", async () => {
    const db = fake();
    await appendEmailAudit(db.client, "admin-id", "verification_retry_requested");
    expect(db.insert).toHaveBeenCalledWith({
      actor_user_id: "admin-id",
      action: "verification_retry_requested",
      email_log_id: null,
    });
  });
  it("stops the action when the audit write fails", async () => {
    await expect(
      appendEmailAudit(fake({ message: "denied" }).client, "admin-id", "entry_dismissed", "log-id"),
    ).rejects.toThrow("No action was performed");
  });
  it("rejects non-admins", async () => {
    await expect(assertEmailAuditAdmin(fake(null, false).client, "user-id")).rejects.toThrow(
      "Admin access required",
    );
  });
});
