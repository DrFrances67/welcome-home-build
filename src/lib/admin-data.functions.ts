import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ProfileRow {
  id: string;
  full_name: string;
  username: string;
  email: string;
  created_at: string;
}
export interface SessionRow {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
}
export interface UsageRow {
  id: string;
  user_id: string;
  session_id: string | null;
  feature: string;
  action: string | null;
  duration_ms: number | null;
  created_at: string;
}
export interface ToolUsageRow {
  id: string;
  user_id: string;
  session_id: string | null;
  tool_name: string;
  used_at: string;
}
export interface AiUsageRow {
  id: string;
  user_id: string;
  session_id: string | null;
  tool_name: string | null;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  endpoint: string | null;
  created_at: string;
}

export interface AdminDashboardData {
  users: ProfileRow[];
  sessions: SessionRow[];
  usage: UsageRow[];
  toolUsage: ToolUsageRow[];
  aiUsage: AiUsageRow[];
}

/**
 * Verify the authenticated caller is an admin using the service-role client.
 * Throws a 403 Response when the caller lacks the admin role.
 */
async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: isAdmin, error } = await supabaseAdmin.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error || !isAdmin) {
    throw new Response("Forbidden", { status: 403 });
  }
  return supabaseAdmin;
}

export const getAdminDashboardData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminDashboardData> => {
    const supabaseAdmin = await assertAdmin(context.userId);

    const [u, s, f, t, ai] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").order("created_at", { ascending: false }),
      supabaseAdmin
        .from("user_sessions")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(500),
      supabaseAdmin
        .from("feature_usage")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),
      supabaseAdmin
        .from("tool_usage")
        .select("*")
        .order("used_at", { ascending: false })
        .limit(2000),
      supabaseAdmin
        .from("ai_usage_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(2000),
    ]);

    return {
      users: (u.data as ProfileRow[]) ?? [],
      sessions: (s.data as SessionRow[]) ?? [],
      usage: (f.data as UsageRow[]) ?? [],
      toolUsage: (t.data as ToolUsageRow[]) ?? [],
      aiUsage: (ai.data as AiUsageRow[]) ?? [],
    };
  });

export const getAdminSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SessionRow[]> => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const { data } = await supabaseAdmin
      .from("user_sessions")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(500);
    return (data as SessionRow[]) ?? [];
  });

export const getAdminSessionDetails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ sessionId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<UsageRow[]> => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const { data: rows } = await supabaseAdmin
      .from("feature_usage")
      .select("*")
      .eq("session_id", data.sessionId)
      .order("created_at", { ascending: true });
    return (rows as UsageRow[]) ?? [];
  });
