import { supabase } from "@/integrations/supabase/client";

let currentSessionId: string | null = null;
let lastHeartbeat = 0;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
const featureTimers = new Map<string, number>();
const HEARTBEAT_THROTTLE_MS = 60_000; // at most once a minute

async function pingLastActive() {
  if (!currentSessionId) return;
  const now = Date.now();
  if (now - lastHeartbeat < HEARTBEAT_THROTTLE_MS) return;
  lastHeartbeat = now;
  try {
    await supabase
      .from("user_sessions")
      .update({ last_active: new Date().toISOString() })
      .eq("id", currentSessionId);
  } catch {
    /* ignore */
  }
}

export function bumpLastActive() {
  void pingLastActive();
}

export async function startTrackingSession(userId: string) {
  if (currentSessionId) return currentSessionId;
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("user_sessions")
    .insert({ user_id: userId, user_agent: navigator.userAgent, last_active: nowIso })
    .select("id")
    .single();
  if (error || !data) return null;
  currentSessionId = data.id;
  lastHeartbeat = Date.now();

  const endSession = () => endTrackingSession();
  window.addEventListener("beforeunload", endSession);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") endSession();
    else bumpLastActive();
  });

  // Activity middleware: any user interaction updates last_active (throttled)
  const events = ["click", "keydown", "mousemove", "scroll", "touchstart"] as const;
  events.forEach((e) => window.addEventListener(e, bumpLastActive, { passive: true }));

  // Periodic heartbeat while tab is open
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => {
    if (document.visibilityState === "visible") pingLastActive();
  }, 5 * 60_000);

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

export type ToolName =
  | "Lesson Plan Generator"
  | "Danielson Rubric Builder"
  | "Worksheet Builder"
  | "Professional Communication";

export async function trackToolUse(toolName: ToolName) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("tool_usage").insert({
      user_id: user.id,
      session_id: currentSessionId,
      tool_name: toolName,
    });
  } catch {
    /* ignore */
  }
}
