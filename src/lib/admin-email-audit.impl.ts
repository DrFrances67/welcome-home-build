import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type EmailAuditRow = Database["public"]["Tables"]["admin_email_action_audit"]["Row"];
export type EmailAuditAction = "verification_retry_requested" | "entry_dismissed";

export async function assertEmailAuditAdmin(client: SupabaseClient<Database>, userId: string) {
  const { data, error } = await client.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Admin access required.");
}

/** An allowlisted payload: no recipient, body, subject, links, or provider errors. */
export async function appendEmailAudit(
  client: SupabaseClient<Database>,
  userId: string,
  action: EmailAuditAction,
  emailLogId: string | null = null,
) {
  const { error } = await client.from("admin_email_action_audit").insert({
    actor_user_id: userId,
    action,
    email_log_id: emailLogId,
  });
  if (error)
    throw new Error("Could not record the admin action. No action was performed. Try again.");
}
