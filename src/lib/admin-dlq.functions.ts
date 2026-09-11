import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface DlqQueueSummary {
  queue_name: string;
  message_count: number;
  oldest_at: string | null;
}

export interface DlqMessage {
  msg_id: number;
  enqueued_at: string;
  read_ct: number;
  message: Record<string, unknown>;
}

const QUEUES = ["auth_emails_dlq", "transactional_emails_dlq"] as const;

/** Verify the caller holds the admin role, then hand back the privileged client. */
async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: isAdmin, error } = await supabaseAdmin.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error || !isAdmin) throw new Response("Forbidden", { status: 403 });
  return supabaseAdmin;
}

/** Counts and oldest entry per dead-letter queue. Admin only. */
export const getDlqOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DlqQueueSummary[]> => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin.rpc("email_dlq_overview");
    if (error) throw new Response(error.message, { status: 500 });
    return (data ?? []) as DlqQueueSummary[];
  });

/** Recent messages parked in one dead-letter queue. Admin only. */
export const getDlqMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        queue: z.enum(QUEUES),
        limit: z.number().int().min(1).max(200).optional().default(50),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<DlqMessage[]> => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const { data: rows, error } = await supabaseAdmin.rpc("email_dlq_messages", {
      _queue: data.queue,
      _limit: data.limit,
    });
    if (error) throw new Response(error.message, { status: 500 });
    return (rows ?? []) as DlqMessage[];
  });

/** Move a parked message back onto its live queue, or drop it. Admin only. */
export const actOnDlqMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        queue: z.enum(QUEUES),
        msgId: z.number().int().positive(),
        action: z.enum(["requeue", "discard"]),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const fn = data.action === "requeue" ? "email_dlq_requeue" : "email_dlq_discard";
    const { data: ok, error } = await supabaseAdmin.rpc(fn, {
      _queue: data.queue,
      _msg_id: data.msgId,
    });
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: !!ok };
  });
