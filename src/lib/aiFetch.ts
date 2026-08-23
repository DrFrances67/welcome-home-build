// Centralized AI client for all Claude (text) and image-generation calls.
//
// Why this exists:
// - The Supabase Edge Function base URL used to be hardcoded ~18 times across
//   the app. It now lives in ONE place, derived from the project env.
// - Request boilerplate (auth headers, timeout, transient-retry, error
//   extraction, content joining) was duplicated at every call site. It is now
//   shared here so every AI call gets the same resilient behavior.
//
// Auth: every call attaches the current user's Supabase JWT (so the edge
// function can verify a signed-in user before consuming AI credits) plus
// x-tool-name / x-session-id so the admin dashboard can attribute usage.
import { supabase } from "@/integrations/supabase/client";
import { getActiveTool, getCurrentSessionId } from "@/lib/tracking";

const AI_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

/** Build authenticated headers for an AI edge-function call. */
export async function aiHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
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

const TRANSIENT_RE = /Failed to fetch|NetworkError|aborted|timeout|ECONN|fetch failed/i;

export interface CallAiOptions {
  /** Timeout for a single attempt, in ms. Defaults to 2 minutes. */
  timeoutMs?: number;
  /** Retry once on transient network errors. Defaults to true. */
  retry?: boolean;
}

/**
 * Call the anthropic-proxy edge function with a raw request body
 * (`{ model, max_tokens, system, messages }`) and return the joined text
 * from the response content blocks.
 *
 * The body is passed through verbatim so callers keep full control over the
 * prompt/messages shape (including multimodal content arrays). This handles
 * the URL, auth headers, timeout, one transient retry, and error extraction.
 */
export async function callAiRaw(
  body: Record<string, unknown>,
  opts: CallAiOptions = {},
): Promise<string> {
  const { timeoutMs = 120000, retry = true } = opts;
  const payload = JSON.stringify(body);

  const doFetch = async (): Promise<string> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(`${AI_BASE}/anthropic-proxy`, {
        method: "POST",
        headers: await aiHeaders({ Accept: "application/json" }),
        body: payload,
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.error?.message || e?.error || `API error ${res.status}`);
      }
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || data.error || "AI error");
      return (data.content?.map((b: { text?: string }) => b.text || "").join("") as string) || "";
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    return await doFetch();
  } catch (e) {
    const msg = String((e as { message?: string })?.message || e);
    if (!retry || !TRANSIENT_RE.test(msg)) throw e;
    await new Promise((r) => setTimeout(r, 800));
    try {
      return await doFetch();
    } catch (e2) {
      throw new Error(
        "Network request to the AI service failed. Please check your internet connection and try again. " +
          `(${String((e2 as { message?: string })?.message || e2)})`,
      );
    }
  }
}

export interface CallAiStreamOptions extends CallAiOptions {
  /** Called with each new text delta as it arrives. */
  onDelta?: (delta: string, full: string) => void;
  signal?: AbortSignal;
}

/**
 * Streaming variant of {@link callAiRaw}. Sends `stream: true` to the proxy,
 * reads the OpenAI-style SSE frames, and invokes `onDelta` as tokens arrive.
 * Resolves with the full accumulated text. Falls back to a non-streaming call
 * if the server does not return an event stream.
 */
export async function callAiStream(
  body: Record<string, unknown>,
  opts: CallAiStreamOptions = {},
): Promise<string> {
  const { onDelta, signal, timeoutMs = 120000 } = opts;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener("abort", onAbort);

  try {
    const res = await fetch(`${AI_BASE}/anthropic-proxy`, {
      method: "POST",
      headers: await aiHeaders({ Accept: "text/event-stream" }),
      body: JSON.stringify({ ...body, stream: true }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e?.error?.message || e?.error || `API error ${res.status}`);
    }
    const isStream = (res.headers.get("content-type") || "").includes("text/event-stream");
    if (!isStream || !res.body) {
      const data = await res.json().catch(() => null);
      const text =
        (data?.content?.map((b: { text?: string }) => b.text || "").join("") as string) || "";
      if (text) onDelta?.(text, text);
      return text;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const json = JSON.parse(payload);
          const delta: string =
            json?.choices?.[0]?.delta?.content ?? json?.choices?.[0]?.message?.content ?? "";
          if (delta) {
            full += delta;
            onDelta?.(delta, full);
          }
        } catch {
          /* ignore malformed frame */
        }
      }
    }
    return full;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}


export interface GenerateImageOptions {
  prompt: string;
  style?: string;
  /** Extra retries on HTTP 429 (rate limit), with backoff. Defaults to 0. */
  retries?: number;
  signal?: AbortSignal;
}

/**
 * Call the generate-image edge function and return the resulting image URL
 * (a `data:image/...;base64,...` string). Throws on failure / missing URL.
 * Optionally retries on rate-limit (429) responses with linear backoff.
 */
export async function generateImage(opts: GenerateImageOptions): Promise<string> {
  const { prompt, style, retries = 0, signal } = opts;
  let attempt = 0;
  for (;;) {
    const res = await fetch(`${AI_BASE}/generate-image`, {
      method: "POST",
      headers: await aiHeaders(),
      body: JSON.stringify({ prompt, style }),
      signal,
    });
    if (res.status === 429 && attempt < retries) {
      attempt++;
      await new Promise((r) => setTimeout(r, 2500 * attempt));
      continue;
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || `API error ${res.status}`);
    }
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    if (!data.url) throw new Error("No image URL returned");
    return data.url as string;
  }
}
