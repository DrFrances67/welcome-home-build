// Authenticated wrapper for the AI edge functions.
// Attaches the current user's Supabase JWT so the edge function can verify
// the caller is a signed-in user before consuming AI credits.
import { supabase } from "@/integrations/supabase/client";

const BASE = "https://iaklmdnlwjgguhkixvio.supabase.co/functions/v1";

export async function aiFetch(
  path: "anthropic-proxy" | "generate-image",
  body: unknown,
): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return fetch(`${BASE}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}
