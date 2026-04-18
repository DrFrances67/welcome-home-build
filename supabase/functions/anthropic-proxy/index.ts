// Anthropic-shape proxy → Lovable AI Gateway (OpenAI-compatible)
// Accepts { model, system, messages, max_tokens } in Anthropic format and
// returns { content: [{ type: "text", text }] } so the existing client code
// keeps working unchanged.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Map any incoming model id (incl. Anthropic ids) to a Lovable AI model.
function mapModel(model?: string): string {
  if (!model) return "google/gemini-2.5-flash";
  if (model.startsWith("google/") || model.startsWith("openai/")) return model;
  // Default for any anthropic/claude-* id
  return "google/gemini-2.5-flash";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: { message: "LOVABLE_API_KEY is not configured" } }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const { model, system, messages, max_tokens } = body ?? {};

    const oaiMessages: Array<{ role: string; content: string }> = [];
    if (system && typeof system === "string") {
      oaiMessages.push({ role: "system", content: system });
    }
    if (Array.isArray(messages)) {
      for (const m of messages) {
        const content = typeof m.content === "string"
          ? m.content
          : Array.isArray(m.content)
            ? m.content.map((b: any) => b?.text ?? "").join("")
            : "";
        oaiMessages.push({ role: m.role || "user", content });
      }
    }

    const upstream = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: mapModel(model),
        messages: oaiMessages,
        max_tokens: typeof max_tokens === "number" ? max_tokens : undefined,
      }),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      console.error("Gateway error", upstream.status, text);
      if (upstream.status === 429) {
        return new Response(
          JSON.stringify({ error: { message: "Rate limit exceeded. Please try again shortly." } }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (upstream.status === 402) {
        return new Response(
          JSON.stringify({ error: { message: "AI credits exhausted. Add funds in Lovable Workspace settings." } }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: { message: `AI gateway error (${upstream.status})` } }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await upstream.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";

    // Re-shape to Anthropic response format expected by the client
    return new Response(
      JSON.stringify({
        id: data?.id ?? "msg_proxied",
        type: "message",
        role: "assistant",
        model: mapModel(model),
        content: [{ type: "text", text }],
        stop_reason: "end_turn",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("Proxy error:", e);
    return new Response(
      JSON.stringify({ error: { message: e instanceof Error ? e.message : "Unknown error" } }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
