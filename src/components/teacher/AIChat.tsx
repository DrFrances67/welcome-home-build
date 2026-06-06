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

import { BANDS, F } from "./shared";

export function AIChat({ gv, wsTitle, elCount, refDesc, onInsertElements }) {
  const [msgs, setMsgs] = useState([
    {
      role: "assistant",
      content: `Hi! 👋 I'm your worksheet assistant!\n\nI can build a complete worksheet for you, or help with parts. Try:\n• "Make a worksheet about the water cycle"\n• "Create a 2nd grade worksheet on adding within 20"\n• "Write 5 true/false questions about the American Revolution"\n• "Give me a word bank about habitats for ${gv.name}"\n• "Simplify this text for ${gv.name}: [paste text]"`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [piiHits, setPiiHits] = useState<{ type: string; match: string }[]>([]);
  const endRef = useRef();
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  // Detect "create / build / make / generate / design a worksheet …" intent
  const looksLikeWorksheetRequest = (txt) => {
    const t = (txt || "").toLowerCase();
    if (!t) return false;
    const verbs = /\b(make|create|build|generate|design|produce|put together|draft|whip up)\b/;
    const noun =
      /\b(worksheet|activity sheet|practice sheet|handout|packet|assignment|quiz|exit ticket|review sheet)\b/;
    return verbs.test(t) && noun.test(t);
  };

  // Build a full worksheet (returns an array of element objects) ──────────
  const buildWorksheet = async (userPrompt) => {
    const raw =
      (await callAiRaw({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        system: `You are an expert curriculum designer. The teacher will describe a worksheet they want. Respond with VALID JSON ONLY — no markdown fences, no preamble — a single JSON array of 12–20 worksheet element objects spanning AT LEAST 2 PAGES (use a 0-based "page" field on every element: 0, 1, and optionally 2).

MULTI-PAGE REQUIREMENT (MANDATORY): The worksheet MUST span at least 2 pages. Never compress all content onto page 0. Distribute blocks so each page has roughly 6–9 elements. Use page 0 for warm-up / introduction / core practice, page 1 for extension / deeper practice / varied question types, and optionally page 2 for reflection / exit ticket / challenge. Prioritize depth and variety over brevity — include multiple activity types (mix multipleChoice, shortAnswer, fillBlank, matching, truefalse, wordBank, essay, table) rather than repeating one format.

Allowed element shapes (use exactly these keys):
{"type":"instruction","text":"<directions>"}
{"type":"text","text":"<passage or content>"}
{"type":"blank","label":"<prompt>","lines":3}
{"type":"wordBank","title":"📚 Word Bank","words":["w1","w2","w3","w4","w5"]}
{"type":"matching","title":"<title>","left":["a","b","c"],"right":["1","2","3"]}
{"type":"multipleChoice","question":"<q>","note":"Circle the correct answer.","choices":["A. …","B. …","C. …","D. …"]}
{"type":"truefalse","statements":["s1","s2","s3"]}
{"type":"shortAnswer","question":"<q>","lines":4}
{"type":"fillBlank","text":"The ______ is a ______.","note":"Use the word bank."}
{"type":"essay","prompt":"<prompt>","points":10,"lines":14}
{"type":"table","title":"<title>","headers":["A","B","C"],"rows":[["","",""],["","",""]]}
{"type":"image","imagePrompt":"<short visual description for an AI image generator, e.g. 'a friendly cartoon brown dog sitting'>","caption":"<optional short caption>","size":"small","align":"center"}
{"type":"successCriteria","title":"🎯 Success Criteria","intro":"I can…","items":["I can …","I can …","I can …"]}
{"type":"exitTicket","title":"🎟️ Exit Ticket","intro":"Check off everything you completed today:","items":["…","…","…"]}

CRITICAL: Whenever the worksheet would benefit from a picture (e.g. matching pictures to words, label-the-picture, picture-prompt writing, vocabulary with visuals), include {"type":"image", ...} blocks with a clear "imagePrompt". NEVER output text like "(picture of a cat)" or "[image: dog]" — emit a real image block instead so we can generate the picture.

GROUPING RULE (MANDATORY): Always keep related content together in the array. When an image belongs to a question, prompt, or task, place that {"type":"image"} block IMMEDIATELY adjacent to the related element (typically right BEFORE the question/shortAnswer/blank/multipleChoice it illustrates, or right AFTER its instruction). Never separate an image from the content that references it by inserting unrelated elements between them. The same applies to instruction → activity pairs and word banks → fill-in-the-blank passages that use them: keep each pair contiguous.

Calibrate complexity to ${gv.name} (${BANDS[gv.band]?.label}). Always start with one "instruction" element. Mix activity types. Output ONLY the JSON array.`,
        messages: [{ role: "user", content: userPrompt }],
      })) || "[]";
    const clean = raw.replace(/```json|```/g, "").trim();
    const start = clean.indexOf("[");
    const end = clean.lastIndexOf("]");
    const slice = start >= 0 && end > start ? clean.slice(start, end + 1) : clean;
    const parsed = JSON.parse(slice);
    if (!Array.isArray(parsed)) throw new Error("AI did not return an array");
    return parsed;
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const userText = input;
    const hits = detectPII(userText);
    if (hits.length) {
      setPiiHits(hits);
      return;
    }
    setPiiHits([]);
    const userMsg = { role: "user", content: userText };
    const next = [...msgs, userMsg];
    setMsgs(next);
    setInput("");
    setLoading(true);

    // ─── Worksheet-build intent: produce real elements ───
    if (looksLikeWorksheetRequest(userText) && typeof onInsertElements === "function") {
      try {
        const els = await buildWorksheet(userText);
        // Generate real images for any "image" blocks (in parallel, capped)
        const imgEls = els.filter((e: any) => e?.type === "image" && !e.url);
        if (imgEls.length) {
          setMsgs((p) => [
            ...p,
            {
              role: "assistant",
              content: `🎨 Generating ${imgEls.length} image${imgEls.length === 1 ? "" : "s"}…`,
            },
          ]);
          for (const el of imgEls) {
            const prompt = (el.imagePrompt || el.caption || "").toString().trim();
            if (!prompt) continue;
            try {
              const url = await generateImage({ prompt, style: "cartoon" });
              if (url) el.url = url;
            } catch (_) {}
            await new Promise((r) => setTimeout(r, 350));
          }
        }
        onInsertElements(els);
        setMsgs((p) => [
          ...p,
          {
            role: "assistant",
            content: `✨ Done! I added ${els.length} element${els.length === 1 ? "" : "s"} to your worksheet${imgEls.length ? ` (including ${imgEls.length} generated image${imgEls.length === 1 ? "" : "s"})` : ""}. Click any block to edit it.`,
          },
        ]);
      } catch (e) {
        setMsgs((p) => [
          ...p,
          {
            role: "assistant",
            content: `I tried to build that worksheet but ran into an error: ${e?.message || e}. You can try rewording, or ask me for parts (e.g. "give me 5 multiple choice questions about ___").`,
          },
        ]);
      }
      setLoading(false);
      return;
    }

    // ─── Otherwise: normal conversational reply ───
    try {
      const reply = await callAiRaw({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: `You are a warm, expert assistant for educators creating academic worksheets. The current worksheet targets ${gv.name} students (${BANDS[gv.band]?.label}). The worksheet is titled "${wsTitle}" and has ${elCount} elements so far.${refDesc ? `\n\nReference worksheet the teacher uploaded: ${refDesc}` : ""}

Your role:
- Generate ready-to-use worksheet content (questions, activities, word banks, matching pairs, passages)
- Suggest ideas appropriate for ${gv.name} cognitive level
- Help simplify or increase text complexity when requested
- Align suggestions with NY State learning standards when relevant
- Be warm and practical — provide content the teacher can directly copy
- Use bullet points and clear formatting for readability
- IMPORTANT: If the teacher asks you to "make / create / build a worksheet", do NOT respond here — that is handled separately and produces real worksheet blocks.

Grade-level calibration:
- Pre-K/K: single words, pictures, concrete concepts, very simple vocabulary
- Grades 1-2: simple sentences, phonics, basic math, picture support
- Grades 3-5: paragraphs, multi-step problems, content areas emerging
- Grades 6-8: analytical thinking, text evidence, abstract concepts
- Grades 9-12: sophisticated arguments, primary sources, complex analysis`,
        messages: next.map((m) => ({ role: m.role, content: m.content })),
      });
      setMsgs((p) => [
        ...p,
        { role: "assistant", content: reply || "Sorry, couldn't connect. Try again!" },
      ]);
    } catch {
      setMsgs((p) => [
        ...p,
        { role: "assistant", content: "Connection issue — please try again! 🌐" },
      ]);
    }
    setLoading(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "14px 14px 6px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {msgs.map((m, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: m.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                maxWidth: "89%",
                padding: "9px 13px",
                borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                background: m.role === "user" ? gv.color : "#F4F4F4",
                color: m.role === "user" ? "white" : "#1A1A1A",
                fontSize: 13,
                fontFamily: F,
                fontWeight: 500,
                lineHeight: 1.55,
                whiteSpace: "pre-wrap",
                animation: "fadeIn 0.2s ease",
              }}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div
            style={{
              display: "flex",
              gap: 5,
              padding: "9px 13px",
              background: "#F4F4F4",
              borderRadius: "16px 16px 16px 4px",
              width: "fit-content",
            }}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#CCC",
                  animation: `bounce 1.2s ${i * 0.2}s infinite`,
                }}
              />
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div
        style={{
          padding: "10px 12px",
          borderTop: "1px solid #EEE",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {piiHits.length > 0 && (
          <div
            role="alert"
            aria-live="polite"
            style={{
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              color: "#991B1B",
              borderRadius: 8,
              padding: "7px 10px",
              fontSize: 12,
              fontFamily: F,
              lineHeight: 1.45,
            }}
          >
            <strong>{PII_BLOCK_MESSAGE}</strong>
            <div style={{ marginTop: 3, color: "#7F1D1D" }}>
              Detected:{" "}
              {piiHits
                .slice(0, 4)
                .map((h) => `${h.type} "${h.match}"`)
                .join(", ")}
              {piiHits.length > 4 ? "…" : ""}
            </div>
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <SpellInput
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (piiHits.length) setPiiHits([]);
            }}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
            spellCheck
            placeholder="Ask for ideas or 'make a worksheet about…'"
            aria-invalid={piiHits.length > 0}
            style={{
              flex: 1,
              padding: "9px 13px",
              borderRadius: 18,
              border: piiHits.length ? "2px solid #DC2626" : `2px solid ${gv.color}35`,
              fontSize: 13,
              fontFamily: F,
              outline: "none",
              background: piiHits.length ? "#FEF2F2" : "#FAFAFA",
            }}
          />
          <button
            onClick={send}
            disabled={loading}
            style={{
              padding: "9px 14px",
              borderRadius: 18,
              border: "none",
              background: gv.color,
              color: "white",
              fontWeight: 900,
              cursor: "pointer",
              fontSize: 15,
              opacity: loading ? 0.6 : 1,
              fontFamily: F,
            }}
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
