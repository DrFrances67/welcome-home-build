// Shared helpers for logging AI usage and computing cost from token counts.
// Used by anthropic-proxy and generate-image edge functions.

// Prices in USD per 1M tokens (input, output). Rough public rates; safe defaults.
const TEXT_PRICING: Record<string, { in: number; out: number }> = {
  "google/gemini-2.5-flash": { in: 0.3, out: 2.5 },
  "google/gemini-2.5-flash-lite": { in: 0.1, out: 0.4 },
  "google/gemini-2.5-pro": { in: 1.25, out: 10.0 },
  "google/gemini-3-flash-preview": { in: 0.3, out: 2.5 },
  "google/gemini-3.1-flash-lite-preview": { in: 0.1, out: 0.4 },
  "google/gemini-3.1-pro-preview": { in: 1.25, out: 10.0 },
  "google/gemini-3.5-flash": { in: 0.3, out: 2.5 },
  "openai/gpt-5": { in: 1.25, out: 10.0 },
  "openai/gpt-5-mini": { in: 0.25, out: 2.0 },
  "openai/gpt-5-nano": { in: 0.05, out: 0.4 },
  "openai/gpt-5.2": { in: 1.25, out: 10.0 },
  "openai/gpt-5.4": { in: 2.5, out: 15.0 },
  "openai/gpt-5.4-mini": { in: 0.3, out: 2.5 },
  "openai/gpt-5.4-nano": { in: 0.05, out: 0.4 },
  "openai/gpt-5.5": { in: 3.0, out: 18.0 },
};

// Image generation: flat per-image USD cost.
const IMAGE_PRICING: Record<string, number> = {
  "google/gemini-2.5-flash-image": 0.039,
  "google/gemini-3-pro-image-preview": 0.12,
  "google/gemini-3.1-flash-image-preview": 0.039,
};

export function computeTextCost(model: string, inputTokens: number, outputTokens: number): number {
  const p = TEXT_PRICING[model];
  if (!p) return 0;
  return (inputTokens / 1_000_000) * p.in + (outputTokens / 1_000_000) * p.out;
}

export function computeImageCost(model: string, count = 1): number {
  return (IMAGE_PRICING[model] ?? 0.04) * count;
}

export async function getUserIdFromAuth(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: SUPABASE_ANON_KEY },
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u?.id ?? null;
  } catch {
    return null;
  }
}

export interface LogUsageInput {
  userId: string;
  sessionId?: string | null;
  toolName?: string | null;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd: number;
  endpoint: string;
  metadata?: Record<string, unknown> | null;
}

export async function logAiUsage(input: LogUsageInput): Promise<void> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/ai_usage_log`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        user_id: input.userId,
        session_id: input.sessionId ?? null,
        tool_name: input.toolName ?? null,
        model: input.model,
        input_tokens: input.inputTokens ?? 0,
        output_tokens: input.outputTokens ?? 0,
        cost_usd: Number(input.costUsd.toFixed(6)),
        endpoint: input.endpoint,
        metadata: input.metadata ?? null,
      }),
    });
  } catch (e) {
    console.error("logAiUsage failed", e);
  }
}
