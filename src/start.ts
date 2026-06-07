import { createStart } from "@tanstack/react-start";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

// Register attachSupabaseAuth globally so every serverFn RPC carries the
// signed-in user's bearer token. Without this, server functions guarded by
// requireSupabaseAuth (e.g. the admin dashboard data fetchers) reject with 401.
export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
}));
