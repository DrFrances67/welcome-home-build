// Authenticated header helper for AI edge function calls.
// Attaches the current user's Supabase JWT so the edge function can verify
// the caller is a signed-in user before consuming AI credits.
import { supabase } from "@/integrations/supabase/client";

export async function aiHeaders(
  extra?: Record<string, string>,
): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(extra ?? {}),
  };
}
