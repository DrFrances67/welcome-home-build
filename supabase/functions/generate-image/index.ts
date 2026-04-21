// Image generation via Lovable AI Gateway (Nano Banana / Gemini image models).
// Accepts { prompt, style?, model? } and returns { url } where url is a
// data:image/* base64 URL ready to drop into <img src=...> or store as-is.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const STYLE_GUIDES: Record<string, string> = {
  cartoon:
    "vibrant, colorful cartoon illustration, child-friendly, bright bold colors, clean rounded lines, cheerful, simple composition, classroom worksheet style",
  photo:
    "high-quality realistic educational photograph, clear lighting, sharp focus, professional, plain background suitable for a worksheet",
  lineart:
    "clean black-and-white line drawing, coloring-page style, thin uniform outlines, no fills, white background, simple shapes a child can color in",
  clipart:
    "flat-design clipart, simple vector illustration, solid colors, no gradients, clean white background, educational worksheet clipart style",
  diagram:
    "clear educational labeled diagram, textbook-style illustration, simple geometric shapes with labels and arrows, neutral background",
  minimal:
    "minimalist illustration, 2-3 flat colors, simple geometric shapes, modern clean design on white background",
};

function buildPrompt(prompt: string, style?: string): string {
  const guide = STYLE_GUIDES[style || "cartoon"] || STYLE_GUIDES.cartoon;
  return `Create a single educational image for a printable classroom worksheet.

Subject: ${prompt}

Style requirements: ${guide}

Composition: centered subject, generous white margins, no borders, no watermarks, no text or captions in the image (unless the subject is specifically a labeled diagram). Square or 4:3 framing. Print-friendly.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const { prompt, style, model } = body ?? {};
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return new Response(
        JSON.stringify({ error: "Missing 'prompt' string" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const chosenModel = typeof model === "string" && model.trim()
      ? model
      : "google/gemini-2.5-flash-image";

    const upstream = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: chosenModel,
        messages: [
          { role: "user", content: buildPrompt(prompt, style) },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      console.error("Image gateway error", upstream.status, text);
      if (upstream.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please wait a moment and try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (upstream.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add funds in Lovable Workspace settings." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: `Image gateway error (${upstream.status})` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await upstream.json();
    const url: string | undefined =
      data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!url) {
      console.error("No image in response", JSON.stringify(data).slice(0, 500));
      return new Response(
        JSON.stringify({ error: "No image returned by model" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ url }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-image error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
