import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { reviewFailedEmails, type EmailReviewRow } from "@/lib/admin-email-review";

/** Historical delivery outcomes only; no queue operations. */
export const getEmailReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EmailReviewRow[]> => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError || !isAdmin) throw new Response("Forbidden", { status: 403 });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("email_send_log")
      .select("id,message_id,created_at,recipient_email,status,template_name,error_message")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error("Could not load email history. Please try again.");
    return reviewFailedEmails(data ?? []);
  });
