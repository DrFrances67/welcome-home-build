import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertEmailAuditAdmin } from "@/lib/admin-email-audit.impl";
import type { Database } from "@/integrations/supabase/types";

export type HistoryObservation =
  Database["public"]["Tables"]["admin_email_history_observations"]["Row"];

export const getEmailHistoryObservations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertEmailAuditAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("admin_email_history_observations")
      .select("id,actor_user_id,state,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error("Could not load blocker observations. Try again.");
    return data ?? [];
  });

export const reportEmailHistoryObservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        state: z.enum(["restriction_present", "restriction_cleared"]),
        confirmed: z.literal(true),
      })
      .strict()
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertEmailAuditAdmin(context.supabase, context.userId);
    const { data: recorded, error } = await context.supabase.rpc(
      "record_email_history_observation",
      {
        _state: data.state,
      },
    );
    if (error) throw new Error("Could not record this observation. No status change was saved.");
    return { recorded: recorded === true };
  });
