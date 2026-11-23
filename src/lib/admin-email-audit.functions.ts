import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { appendEmailAudit, assertEmailAuditAdmin } from "@/lib/admin-email-audit.impl";

export const recordEmailDismissal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ emailLogId: z.string().uuid() }).strict().parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertEmailAuditAdmin(context.supabase, context.userId);
    await appendEmailAudit(context.supabase, context.userId, "entry_dismissed", data.emailLogId);
    return { recorded: true };
  });

export const getEmailActionAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertEmailAuditAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("admin_email_action_audit")
      .select("id,actor_user_id,action,email_log_id,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error("Could not load the admin action log. Try again.");
    return data ?? [];
  });
