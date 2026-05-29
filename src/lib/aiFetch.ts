// Authenticated header helper for AI edge function calls.
// Attaches the current user's Supabase JWT so the edge function can verify
// the caller is a signed-in user before consuming AI credits.
// Also attaches x-tool-name and x-session-id so the admin dashboard can
// attribute every AI call to the real tool and session.
import { supabase } from "@/integrations/supabase/client";
import { getActiveTool, getCurrentSessionId } from "@/lib/tracking";

export async function aiHeaders(
  extra?: Record<string, string>,
): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const tool = getActiveTool();
  const sessionId = getCurrentSessionId();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(tool ? { "x-tool-name": tool } : {}),
    ...(sessionId ? { "x-session-id": sessionId } : {}),
    ...(extra ?? {}),
  };
}
