import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const endAllActiveSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;

    const { data: isAdmin, error: roleErr } = await supabaseAdmin.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr || !isAdmin) {
      throw new Error("Forbidden");
    }

    const { data, error } = await supabaseAdmin
      .from("user_sessions")
      .update({ ended_at: new Date().toISOString() })
      .is("ended_at", null)
      .select("id");

    if (error) throw new Error(error.message);
    return { ended: data?.length ?? 0 };
  });
