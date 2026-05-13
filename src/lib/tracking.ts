import { supabase } from "@/integrations/supabase/client";

let currentSessionId: string | null = null;
const featureTimers = new Map<string, number>();

export async function startTrackingSession(userId: string) {
  if (currentSessionId) return currentSessionId;
  const { data, error } = await supabase
    .from("user_sessions")
    .insert({ user_id: userId, user_agent: navigator.userAgent })
    .select("id")
    .single();
  if (error || !data) return null;
  currentSessionId = data.id;

  const endSession = () => endTrackingSession();
  window.addEventListener("beforeunload", endSession);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") endSession();
  });

  return currentSessionId;
}

export async function endTrackingSession() {
  if (!currentSessionId) return;
  const id = currentSessionId;
  currentSessionId = null;
  try {
    await supabase.from("user_sessions").update({ ended_at: new Date().toISOString() }).eq("id", id);
  } catch {
    /* ignore */
  }
}

export async function trackFeature(
  userId: string,
  feature: string,
  action?: string,
  durationMs?: number,
) {
  try {
    await supabase.from("feature_usage").insert({
      user_id: userId,
      session_id: currentSessionId,
      feature,
      action: action ?? null,
      duration_ms: durationMs ?? null,
    });
  } catch {
    /* ignore */
  }
}

export function startFeatureTimer(feature: string) {
  featureTimers.set(feature, Date.now());
}

export async function endFeatureTimer(userId: string, feature: string, action?: string) {
  const start = featureTimers.get(feature);
  if (!start) return;
  featureTimers.delete(feature);
  await trackFeature(userId, feature, action, Date.now() - start);
}
