// @ts-nocheck
/* eslint-disable */
import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { shouldShowScrollTop, scrollEverythingToTop } from "@/lib/scroll-top";
import { repairAndParse } from "@/lib/repairJson";
import { renderInlineMarkdown, inlineMarkdownToHtml } from "@/lib/inlineMarkdown";
import { useGlobalShortcuts, ShortcutsHelpOverlay } from "@/components/KeyboardShortcuts";
import { detectPII, PII_BLOCK_MESSAGE } from "@/lib/pii";
import { trackToolUse, setActiveTool as setActiveToolName } from "@/lib/tracking";
import { callAiRaw, generateImage } from "@/lib/aiFetch";
import { SpellTextarea, SpellInput } from "@/components/SpellCheckField";

import { F, FF, LBL } from "./shared";

export function AIImageGen({ gv, onAddImage }) {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("cartoon");
  // 2 slots: null | { url, loading, error, errMsg }
  const [slots, setSlots] = useState([null, null]);
  const [selected, setSelected] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSugg, setLoadingSugg] = useState(false);
  const suggTimerRef = useRef(null);

  const anyLoading = slots.some((s) => s?.loading);
  const hasResults = slots.some((s) => s?.url || s?.error);
  const selSlot = selected !== null ? slots[selected] : null;

  // ── Fetch one image from Lovable AI Gateway (Nano Banana) ──────────
  const fetchImage = async (promptText, styleKey, variationIdx) => {
    // Add a tiny variation hint so the two slots differ
    const variationHints = [
      "centered front-facing composition",
      "slightly different angle or perspective for variety",
    ];
    const hint = variationHints[variationIdx] || variationHints[0];
    const fullPrompt = `${promptText}. ${hint}.`;

    return await generateImage({ prompt: fullPrompt, style: styleKey });
  };

  // ── Generate one slot (marks loading, calls API, updates slot) ───────
  const runSlot = async (slotIdx, promptText, styleKey) => {
    setSlots((prev) => {
      const next = [...prev];
      next[slotIdx] = { url: null, loading: true, error: false, errMsg: "" };
      return next;
    });
    try {
      const url = await fetchImage(promptText, styleKey, slotIdx);
      setSlots((prev) => {
        const next = [...prev];
        next[slotIdx] = { url, loading: false, error: false, errMsg: "" };
        return next;
      });
    } catch (e) {
      setSlots((prev) => {
        const next = [...prev];
        next[slotIdx] = {
          url: null,
          loading: false,
          error: true,
          errMsg: e.message || "Unknown error",
        };
        return next;
      });
    }
  };

  // ── Generate both sequentially (avoids rate-limit collisions) ────────
  const generateBoth = async () => {
    if (!prompt.trim() || anyLoading) return;
    setSelected(null);
    setSlots([null, null]);
    const p = prompt.trim();
    const s = style;
    runSlot(0, p, s);
    await new Promise((r) => setTimeout(r, 1200));
    runSlot(1, p, s);
  };

  // ── Regenerate one slot independently ────────────────────────────────
  const regenSlot = (i) => {
    if (anyLoading) return;
    if (selected === i) setSelected(null);
    runSlot(i, prompt.trim(), style);
  };

  // ── Debounced AI suggestions ─────────────────────────────────────────
  useEffect(() => {
    if (suggTimerRef.current) clearTimeout(suggTimerRef.current);
    const trimmed = prompt.trim();
    if (trimmed.length < 3) {
      setSuggestions([]);
      return;
    }
    suggTimerRef.current = setTimeout(async () => {
      setLoadingSugg(true);
      try {
        const raw =
          (await callAiRaw({
            model: "claude-sonnet-4-20250514",
            max_tokens: 200,
            system:
              "You suggest specific educational image descriptions for classroom worksheet illustrations. Respond with ONLY a JSON array of 5 short strings, each under 10 words. No markdown, no explanation, no preamble.",
            messages: [
              {
                role: "user",
                content: `Teacher is typing: "${trimmed}"\nSuggest 5 specific educational image descriptions that complete or expand on this. JSON array only.`,
              },
            ],
          })) || "[]";
        const clean = raw
          .replace(/```[\w]*\n?/g, "")
          .replace(/```/g, "")
          .trim();
        const parsed = JSON.parse(clean);
        if (Array.isArray(parsed)) setSuggestions(parsed.slice(0, 5));
      } catch {
        setSuggestions([]);
      }
      setLoadingSugg(false);
    }, 750);
    return () => clearTimeout(suggTimerRef.current);
  }, [prompt]);

  return (
    <div
      style={{
        padding: "14px 16px",
        overflowY: "auto",
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {/* Header */}
      <div
        style={{
          background: `linear-gradient(135deg, ${gv.color}18, ${gv.light})`,
          borderRadius: 12,
          padding: "12px 14px",
          border: `2px solid ${gv.color}25`,
        }}
      >
        <p style={{ fontFamily: FF, color: gv.color, fontSize: 15, margin: "0 0 3px 0" }}>
          🎨 AI Image Generator
        </p>
        <p style={{ fontFamily: F, fontSize: 11.5, color: "#777", margin: 0, lineHeight: 1.5 }}>
          Describe an image — AI creates 2 photo-quality variations. Pick one to add to your
          worksheet.
        </p>
      </div>

      {/* Style picker */}
      <div>
        <label style={LBL}>Style</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 5 }}>
          {[
            ["cartoon", "🎨 Cartoon"],
            ["photo", "📷 Photo"],
            ["lineart", "✏️ Line Art"],
            ["clipart", "🎭 Clipart"],
            ["diagram", "📐 Diagram"],
            ["minimal", "◻️ Minimal"],
          ].map(([id, lbl]) => (
            <button
              key={id}
              onClick={() => setStyle(id)}
              style={{
                padding: "4px 10px",
                borderRadius: 16,
                border: `2px solid ${style === id ? gv.color : "#E8E8E8"}`,
                background: style === id ? gv.light : "white",
                color: style === id ? gv.color : "#777",
                fontFamily: F,
                fontWeight: 800,
                fontSize: 11,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Prompt + suggestions */}
      <div>
        <label style={LBL}>Describe Your Image</label>
        <SpellTextarea
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            setSelected(null);
          }}
          spellCheck
          placeholder="e.g., a friendly cartoon sun with a smiling face"
          style={{
            width: "100%",
            padding: "9px 11px",
            borderRadius: 10,
            border: `2px solid ${gv.color}40`,
            fontSize: 13,
            fontFamily: F,
            minHeight: 60,
            resize: "vertical",
            outline: "none",
            boxSizing: "border-box",
            lineHeight: 1.5,
          }}
        />
        {/* Live suggestions */}
        {(suggestions.length > 0 || loadingSugg) && (
          <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
            {loadingSugg && suggestions.length === 0 && (
              <div style={{ fontFamily: F, fontSize: 11, color: "#CCC", padding: "2px 4px" }}>
                💡 Suggesting ideas…
              </div>
            )}
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => {
                  setPrompt(s);
                  setSuggestions([]);
                }}
                style={{
                  textAlign: "left",
                  padding: "6px 11px",
                  borderRadius: 9,
                  border: `1.5px solid ${gv.color}30`,
                  background: gv.light,
                  color: "#444",
                  fontFamily: F,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.12s",
                  lineHeight: 1.4,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = gv.color;
                  e.currentTarget.style.color = "white";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = gv.light;
                  e.currentTarget.style.color = "#444";
                }}
              >
                💡 {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Generate button */}
      <button
        onClick={generateBoth}
        disabled={!prompt.trim() || anyLoading}
        style={{
          padding: "10px",
          borderRadius: 11,
          border: "none",
          background: !prompt.trim() || anyLoading ? "#CCC" : gv.color,
          color: "white",
          fontFamily: FF,
          fontSize: 14,
          cursor: !prompt.trim() || anyLoading ? "not-allowed" : "pointer",
          transition: "background 0.2s",
        }}
      >
        {anyLoading
          ? "✨  Generating…"
          : hasResults
            ? "🔄  Generate 2 New Images"
            : "✨  Generate 2 Images"}
      </button>

      {/* 2 slots side-by-side */}
      {(hasResults || anyLoading) && (
        <div>
          <label style={{ ...LBL, marginTop: 2 }}>
            {anyLoading ? "Generating…" : "Pick Your Favourite"}
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 6 }}>
            {slots.map((slot, i) => {
              const isSel = selected === i;
              return (
                <div key={i}>
                  <div
                    onClick={() => slot?.url && !anyLoading && setSelected(isSel ? null : i)}
                    style={{
                      borderRadius: 10,
                      border: `3px solid ${isSel ? gv.color : slot?.url ? "#D0D0D0" : "#EBEBEB"}`,
                      background: "#F8F8F8",
                      overflow: "hidden",
                      cursor: slot?.url && !anyLoading ? "pointer" : "default",
                      position: "relative",
                      aspectRatio: "1/1",
                      transition: "all 0.15s",
                      transform: isSel ? "scale(1.02)" : "none",
                      boxShadow: isSel ? `0 4px 18px ${gv.color}55` : "none",
                    }}
                  >
                    {slot?.loading && (
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                        }}
                      >
                        <div style={{ fontSize: 22, animation: "spin 1.6s linear infinite" }}>
                          ✨
                        </div>
                        <span
                          style={{ fontFamily: F, fontSize: 10, color: "#BBB", fontWeight: 700 }}
                        >
                          Generating…
                        </span>
                      </div>
                    )}
                    {!slot && (
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <span style={{ fontSize: 22, opacity: 0.15 }}>🖼️</span>
                      </div>
                    )}
                    {slot?.error && (
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 5,
                          padding: 8,
                        }}
                      >
                        <span style={{ fontSize: 20 }}>⚠️</span>
                        <span
                          style={{
                            fontFamily: F,
                            fontSize: 10,
                            color: "#BB4444",
                            fontWeight: 700,
                            textAlign: "center",
                            lineHeight: 1.3,
                          }}
                        >
                          Failed
                        </span>
                        {slot.errMsg && (
                          <span
                            style={{
                              fontFamily: F,
                              fontSize: 9,
                              color: "#CCC",
                              textAlign: "center",
                              lineHeight: 1.3,
                            }}
                          >
                            {slot.errMsg.slice(0, 80)}
                          </span>
                        )}
                      </div>
                    )}
                    {slot?.url && (
                      <img
                        src={slot.url}
                        alt={`Generated variation ${i + 1}`}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    )}

                    <div
                      style={{
                        position: "absolute",
                        top: 5,
                        left: 5,
                        background: "rgba(255,255,255,0.9)",
                        borderRadius: 5,
                        padding: "1px 6px",
                        fontFamily: F,
                        fontSize: 10,
                        fontWeight: 900,
                        color: "#888",
                        zIndex: 2,
                      }}
                    >
                      {i + 1}
                    </div>

                    {isSel && (
                      <div
                        style={{
                          position: "absolute",
                          top: 5,
                          right: 5,
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          background: gv.color,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          zIndex: 3,
                        }}
                      >
                        <span style={{ color: "white", fontSize: 11, fontWeight: 900 }}>✓</span>
                      </div>
                    )}

                    {(slot?.url || slot?.error) && !anyLoading && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          regenSlot(i);
                        }}
                        title="Generate a new version"
                        style={{
                          position: "absolute",
                          bottom: 6,
                          right: 6,
                          width: 26,
                          height: 26,
                          borderRadius: "50%",
                          border: "none",
                          background: "rgba(255,255,255,0.92)",
                          color: "#666",
                          fontSize: 13,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 1px 5px rgba(0,0,0,0.18)",
                          zIndex: 3,
                          transition: "transform 0.15s",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.transform = "rotate(30deg) scale(1.15)")
                        }
                        onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}
                      >
                        🔄
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Full preview for selected */}
      {selSlot?.url && (
        <div style={{ animation: "fadeIn 0.2s ease" }}>
          <label style={{ ...LBL, marginTop: 2 }}>Preview — Image {selected + 1}</label>
          <div
            style={{
              borderRadius: 12,
              overflow: "hidden",
              border: `3px solid ${gv.color}`,
              background: "white",
              marginTop: 5,
              marginBottom: 8,
            }}
          >
            <img
              src={selSlot.url}
              alt={`Selected variation ${selected + 1}`}
              style={{ width: "100%", height: "auto", display: "block" }}
            />
          </div>
          <button
            onClick={() => {
              onAddImage(selSlot.url);
              setSelected(null);
            }}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: 11,
              border: "none",
              background: "#0FAB8C",
              color: "white",
              fontFamily: FF,
              fontSize: 14,
              cursor: "pointer",
              boxShadow: "0 3px 10px #0FAB8C44",
            }}
          >
            ➕ Add Image {selected + 1} to Worksheet
          </button>
        </div>
      )}

      <p
        style={{
          fontFamily: F,
          fontSize: 10,
          color: "#CCC",
          textAlign: "center",
          margin: "0 0 2px",
        }}
      >
        Powered by Lovable AI · Nano Banana · print-ready
      </p>
    </div>
  );
}
