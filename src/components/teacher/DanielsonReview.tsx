/* eslint-disable */
// Danielson Review tool — extracted from TheTechSavvyTeacherApp.
import { useState, useRef, useEffect, type CSSProperties } from "react";
import { repairAndParse } from "@/lib/repairJson";
import { renderInlineMarkdown, inlineMarkdownToHtml } from "@/lib/inlineMarkdown";
import { detectPII, PII_BLOCK_MESSAGE } from "@/lib/pii";
import { trackToolUse } from "@/lib/tracking";
import { callAiRaw } from "@/lib/aiFetch";
import { SpellTextarea, SpellInput } from "@/components/SpellCheckField";
import { DANIELSON_COMPONENTS, DANIELSON_RUBRIC_REFERENCE } from "@/data/danielson";
import {
  extractPdfPlainText,
  extractDocxText as extractDocxTextFile,
} from "@/lib/document-extract";

export function DanielsonReview() {
  const BRAND = "#CF27F5";
  const LIGHT = "#FDF4FF";

  interface DanielsonScore {
    id: string;
    score: number;
    rating?: string;
    evidence?: string;
    quotes?: string[];
    suggestions?: string;
  }
  interface DanielsonResult {
    summary: string;
    scores: DanielsonScore[];
  }
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<DanielsonResult | null>(null); // { scores: [{id,score,evidence,suggestions}], summary }
  const [draggingOver, setDraggingOver] = useState(false);

  const readFileAsText = (f: File) =>
    new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = (e) => res((e.target?.result as string) ?? "");
      r.onerror = rej;
      r.readAsText(f);
    });

  const extractPdfText = async (f: File) => extractPdfPlainText(f, 25);

  const extractDocxText = async (f: File) => extractDocxTextFile(f);

  const handleFile = async (f: File | null) => {
    if (!f) return;
    setError("");
    setResult(null);
    setExtractedText("");
    setFile(null);
    setLoading(true);
    try {
      const isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
      const isDocx =
        /\.docx$/i.test(f.name) ||
        f.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      const isTxt = /\.(txt|md|rtf)$/i.test(f.name) || f.type === "text/plain";
      let text = "";
      if (isPdf) text = await extractPdfText(f);
      else if (isDocx) text = await extractDocxText(f);
      else if (isTxt) text = await readFileAsText(f);
      else
        throw new Error(
          "Unsupported file type. Please upload a PDF, Word document (.docx), or text file (.txt).",
        );
      if (!text || text.length < 30)
        throw new Error(
          "Could not extract enough text from the file. If it's a scanned PDF, please try a text-based PDF or paste the lesson plan as a .txt file.",
        );
      setExtractedText(text);
      setFile({ name: f.name, size: f.size });
    } catch (e: any) {
      console.error("[DanielsonReview] file extraction failed:", e);
      setError(e?.message ? `Could not read file: ${e.message}` : "Could not read file.");
    }
    setLoading(false);
  };

  const callClaude = (system: string, userContent: string, maxTokens = 3000) =>
    callAiRaw({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userContent }],
    });

  const analyze = async () => {
    if (!extractedText) {
      setError("Please upload a lesson plan first.");
      return;
    }
    void trackToolUse("Danielson Rubric Builder");
    setAnalyzing(true);
    setError("");
    setResult(null);
    try {
      const system = `You are an experienced school administrator (assistant principal or principal) conducting a formal observation review using the Danielson 2014-15 Framework for Teaching. You will score a lesson plan against EXACTLY 8 components (1a, 1e, 2a, 2d, 3b, 3c, 3d, 4e). Use the rubric below as your SOLE authoritative source — do not invent criteria, do not rely on general teaching knowledge, and do not award credit for qualities not explicitly named in the rubric.\n\n${DANIELSON_RUBRIC_REFERENCE}\n\nCRITICAL INSTRUCTIONS:\n- Score each of the 8 components on a 1-4 scale: 1 (Ineffective), 2 (Developing), 3 (Effective), 4 (Highly Effective).\n- STRICT RUBRIC ADHERENCE: A rating of 4 (Highly Effective) may ONLY be awarded when the lesson plan contains explicit, verbatim evidence that satisfies EVERY descriptor listed under "Highly Effective" for that component in the rubric above. Partial fulfillment, implied intent, strong Effective-level evidence, or merely "above average" practice is NOT sufficient — those cases are a 3 at most. When in doubt, score lower. The default ceiling is 3 (Effective); 4 must be earned by clear rubric-criterion match.\n- Before assigning a 4, internally verify: (a) which exact Highly Effective descriptor(s) from the rubric are met, and (b) which exact lesson-plan quote(s) prove each one. If you cannot produce that mapping with verbatim quotes, the score is 3 or lower.\n- For each component, you MUST cite "quotes": an array of 1–3 EXACT verbatim text snippets copied character-for-character from the lesson plan that justify your score. Do not paraphrase, summarize, or add words to these quotes — they must appear in the lesson plan exactly as written so they can be highlighted. Keep each quote between 8 and 200 characters. If the lesson plan provides no relevant text for a component (which itself is evidence of a low score), return an empty quotes array — and in that case the score cannot be 4.\n- For ANY component scored 1, 2, or 3 (anything below Highly Effective), provide concrete, actionable suggestions rooted in the rubric language for how to reach a 4.\n- For ANY component scored 4 (Highly Effective), the "suggestions" field MUST: (1) explicitly acknowledge and celebrate the Highly Effective rating in 1 sentence naming the specific rubric descriptor(s) met, then (2) provide AT LEAST ONE concrete, classroom-ready EXTENSION ACTIVITY that improves the lesson further (describe exactly what students would do — e.g., a specific enrichment task, student-led extension, cross-disciplinary connection, authentic-audience project, or advanced inquiry — not a vague suggestion). Aim for 2–3 extension activities when possible, and also include 1–2 FURTHER SUPPORT scaffolds for students who may still need help (e.g., targeted small-group supports, tiered options, additional modalities, formative checkpoints). Label the extension activities clearly (e.g., "Extension Activity:") so they are easy to find. Frame everything as "ways to extend and further support" rather than corrective feedback. Format clearly using short labeled bullet-style lines separated by line breaks.\n- Return ONLY valid JSON, no preamble.`;

      const user = `Review the following lesson plan and return JSON in this EXACT shape:\n\n{\n  "summary": "2-3 sentence overall observation summary",\n  "scores": [\n    { "id": "1a", "score": 1-4, "rating": "Ineffective|Developing|Effective|Highly Effective", "evidence": "1-2 sentence reasoning that explains why these quotes earn this score", "quotes": ["exact verbatim snippet from the lesson plan", "another exact snippet"], "suggestions": "if score<4: concrete steps to reach Highly Effective. if score=4: first acknowledge the Highly Effective rating and the specific strength, then provide AT LEAST ONE concrete Extension Activity (labeled 'Extension Activity:') that improves the lesson further — ideally 2–3 — plus 1–2 ways to FURTHER SUPPORT students who need scaffolding." },\n    ... (one entry for each of 1a, 1e, 2a, 2d, 3b, 3c, 3d, 4e in this order)\n  ]\n}\n\nLESSON PLAN:\n${extractedText.slice(0, 12000)}`;

      const raw = await callClaude(system, user, 5000);
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("AI response was not valid JSON. Please try again.");
      const parsed = JSON.parse(match[0]);
      if (!Array.isArray(parsed.scores) || parsed.scores.length !== 8) {
        throw new Error("AI did not return all 8 component scores. Please try again.");
      }
      setResult(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
    }
    setAnalyzing(false);
  };

  const reset = () => {
    setFile(null);
    setExtractedText("");
    setResult(null);
    setError("");
  };

  const ratingColor = (s: number) =>
    s === 4 ? "#16A34A" : s === 3 ? "#2563EB" : s === 2 ? "#D97706" : "#DC2626";
  const ratingLabel = (s: number) =>
    s === 4 ? "Highly Effective" : s === 3 ? "Effective" : s === 2 ? "Developing" : "Ineffective";

  // Verify if a quote actually appears in the source lesson — tolerant of whitespace/punctuation differences
  const normalize = (str: string) =>
    (str || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[\u2018\u2019\u201C\u201D]/g, "'")
      .trim();
  const quoteFoundInText = (quote: string, source: string) => {
    if (!quote || !source) return false;
    const nq = normalize(quote);
    const ns = normalize(source);
    if (nq.length < 8) return false;
    if (ns.includes(nq)) return true;
    // Fallback: check if at least 80% of the quote's words (≥4 chars) appear consecutively-ish
    const words = nq.split(" ").filter((w) => w.length >= 4);
    if (words.length < 3) return false;
    const hits = words.filter((w) => ns.includes(w)).length;
    return hits / words.length >= 0.8;
  };

  return (
    <div
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "24px 20px 48px",
        fontFamily: "'Inter',sans-serif",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <h2
          style={{
            fontFamily: "'Playfair Display',serif",
            fontSize: 30,
            fontWeight: 800,
            color: "#1F2937",
            margin: "0 0 6px",
          }}
        >
          🧭 Danielson Review
        </h2>
        <p style={{ color: "#6B7280", fontSize: 14, margin: 0 }}>
          Upload your lesson plan and get a rubric-based score on the 8 key Danielson components.
        </p>
      </div>

      {/* Upload card */}
      {!file && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDraggingOver(true);
          }}
          onDragLeave={() => setDraggingOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDraggingOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
          style={{
            background: draggingOver ? LIGHT : "white",
            border: `2px dashed ${draggingOver ? BRAND : "#D1D5DB"}`,
            borderRadius: 14,
            padding: "44px 24px",
            textAlign: "center",
            transition: "all 0.15s",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 12 }} aria-hidden="true">
            📄
          </div>
          <h3
            style={{
              fontFamily: "'Playfair Display',serif",
              fontSize: 20,
              color: "#1F2937",
              margin: "0 0 6px",
            }}
          >
            Upload your lesson plan
          </h3>
          <p style={{ color: "#6B7280", fontSize: 13, margin: "0 0 18px" }}>
            PDF, Word (.docx), or plain text (.txt) — drag & drop or click below.
          </p>
          <label
            style={{
              display: "inline-block",
              background: BRAND,
              color: "white",
              padding: "11px 24px",
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(207,39,245,0.3)",
            }}
          >
            {loading ? "Reading file…" : "Choose file"}
            <input
              type="file"
              accept=".pdf,.docx,.txt,.md,.rtf,application/pdf,text/plain"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              style={{ display: "none" }}
              disabled={loading}
            />
          </label>
        </div>
      )}

      {/* File loaded — show analyze button */}
      {file && !result && (
        <div
          style={{
            background: "white",
            border: "1px solid #E5E7EB",
            borderRadius: 14,
            padding: 22,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontWeight: 700, color: "#1F2937", fontSize: 15 }}>📎 {file.name}</div>
              <div style={{ color: "#6B7280", fontSize: 12, marginTop: 4 }}>
                {(extractedText.length / 1000).toFixed(1)}k characters extracted • Ready for review
              </div>
            </div>
            <button
              onClick={reset}
              style={{
                background: "none",
                border: "1px solid #D1D5DB",
                color: "#6B7280",
                padding: "6px 14px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Choose different file
            </button>
          </div>

          <button
            onClick={analyze}
            disabled={analyzing}
            style={{
              width: "100%",
              background: analyzing ? "#9CA3AF" : `linear-gradient(135deg, ${BRAND}, #8B0AB0)`,
              color: "white",
              padding: "13px 24px",
              border: "none",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 15,
              cursor: analyzing ? "wait" : "pointer",
              boxShadow: analyzing ? "none" : "0 3px 10px rgba(207,39,245,0.35)",
            }}
          >
            {analyzing ? "🔍 Reviewing against Danielson rubric…" : "🧭 Run Danielson Review"}
          </button>
          {analyzing && (
            <p
              style={{
                textAlign: "center",
                color: "#6B7280",
                fontSize: 12,
                marginTop: 12,
                fontStyle: "italic",
              }}
            >
              The AI is scoring all 8 components. This usually takes 20–40 seconds.
            </p>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          style={{
            marginTop: 14,
            background: "#FEE2E2",
            border: "1px solid #FCA5A5",
            color: "#991B1B",
            padding: 12,
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div style={{ marginTop: 8 }}>
          {/* Summary card */}
          <div
            style={{
              background: `linear-gradient(135deg, ${LIGHT}, white)`,
              border: `1px solid ${BRAND}40`,
              borderRadius: 14,
              padding: 22,
              marginBottom: 18,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexWrap: "wrap",
                gap: 14,
              }}
            >
              <div style={{ flex: 1, minWidth: 220 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: BRAND,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    marginBottom: 6,
                  }}
                >
                  Administrator Summary
                </div>
                <p style={{ margin: 0, color: "#1F2937", fontSize: 14, lineHeight: 1.6 }}>
                  {result.summary}
                </p>
              </div>
              <div
                style={{
                  textAlign: "center",
                  background: "white",
                  padding: "12px 20px",
                  borderRadius: 10,
                  border: "1px solid #E5E7EB",
                  minWidth: 120,
                }}
              >
                <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600, marginBottom: 4 }}>
                  AVERAGE
                </div>
                <div style={{ fontSize: 32, fontWeight: 800, color: BRAND, lineHeight: 1 }}>
                  {(
                    result.scores.reduce((s: number, x) => s + (x.score || 0), 0) /
                    result.scores.length
                  ).toFixed(2)}
                </div>
                <div style={{ fontSize: 10, color: "#6B7280", marginTop: 4 }}>of 4.00</div>
              </div>
            </div>
            <button
              onClick={reset}
              style={{
                marginTop: 14,
                background: "none",
                border: "1px solid #D1D5DB",
                color: "#6B7280",
                padding: "6px 14px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              Review another lesson
            </button>
          </div>

          {/* Score chart */}
          <div
            style={{
              background: "white",
              border: "1px solid #E5E7EB",
              borderRadius: 14,
              overflow: "hidden",
              marginBottom: 18,
            }}
          >
            <div
              style={{
                background: "#F9FAFB",
                padding: "12px 18px",
                borderBottom: "1px solid #E5E7EB",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontFamily: "'Playfair Display',serif",
                  fontSize: 17,
                  color: "#1F2937",
                }}
              >
                📊 Component Scores
              </h3>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{ width: "100%", borderCollapse: "collapse", minWidth: 560, fontSize: 13 }}
              >
                <thead>
                  <tr style={{ background: "#F3F4F6", textAlign: "left" }}>
                    <th style={{ padding: "10px 14px", fontWeight: 700, color: "#374151" }}>
                      Component
                    </th>
                    <th style={{ padding: "10px 14px", fontWeight: 700, color: "#374151" }}>
                      Description
                    </th>
                    <th
                      style={{
                        padding: "10px 14px",
                        fontWeight: 700,
                        color: "#374151",
                        textAlign: "center",
                      }}
                    >
                      Score
                    </th>
                    <th style={{ padding: "10px 14px", fontWeight: 700, color: "#374151" }}>
                      Rating
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.scores.map((s) => {
                    const meta = DANIELSON_COMPONENTS.find((c) => c.id === s.id);
                    const color = ratingColor(s.score);
                    return (
                      <tr key={s.id} style={{ borderTop: "1px solid #E5E7EB" }}>
                        <td style={{ padding: "12px 14px", fontWeight: 700, color: "#1F2937" }}>
                          {s.id}
                        </td>
                        <td style={{ padding: "12px 14px", color: "#4B5563" }}>
                          {meta?.title || ""}
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "center" }}>
                          <span
                            style={{
                              display: "inline-block",
                              minWidth: 30,
                              padding: "4px 10px",
                              background: color,
                              color: "white",
                              borderRadius: 6,
                              fontWeight: 800,
                            }}
                          >
                            {s.score}
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px", color, fontWeight: 700 }}>
                          {s.rating || ratingLabel(s.score)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detailed evidence + suggestions */}
          <div style={{ display: "grid", gap: 14 }}>
            {result.scores.map((s) => {
              const meta = DANIELSON_COMPONENTS.find((c) => c.id === s.id);
              const color = ratingColor(s.score);
              const isHighest = s.score === 4;
              return (
                <div
                  key={s.id}
                  style={{
                    background: "white",
                    border: "1px solid #E5E7EB",
                    borderLeft: `4px solid ${color}`,
                    borderRadius: 10,
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 10,
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600 }}>
                        {meta?.domain}
                      </div>
                      <div style={{ fontWeight: 700, color: "#1F2937", fontSize: 15 }}>
                        {s.id} — {meta?.title}
                      </div>
                    </div>
                    <span
                      style={{
                        background: color,
                        color: "white",
                        padding: "4px 12px",
                        borderRadius: 6,
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      {s.score} • {s.rating || ratingLabel(s.score)}
                    </span>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#6B7280",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        marginBottom: 6,
                      }}
                    >
                      Evidence from lesson
                    </div>
                    <div
                      style={{ fontSize: 13, color: "#374151", lineHeight: 1.55, marginBottom: 8 }}
                    >
                      {s.evidence}
                    </div>
                    {Array.isArray(s.quotes) && s.quotes.length > 0 ? (
                      <div style={{ display: "grid", gap: 6 }}>
                        {s.quotes.map((q: string, qi: number) => {
                          const verified = quoteFoundInText(q, extractedText);
                          return (
                            <div
                              key={qi}
                              title={
                                verified
                                  ? "Verified verbatim from your lesson"
                                  : "Close paraphrase — could not be located verbatim in the lesson"
                              }
                              style={{
                                background: verified ? "#FEF9C3" : "#F3F4F6",
                                borderLeft: `3px solid ${verified ? "#EAB308" : "#9CA3AF"}`,
                                padding: "8px 12px",
                                borderRadius: 4,
                                fontSize: 13,
                                color: "#1F2937",
                                fontStyle: "italic",
                                lineHeight: 1.5,
                              }}
                            >
                              <span
                                style={{
                                  fontStyle: "normal",
                                  fontSize: 10,
                                  color: verified ? "#854D0E" : "#6B7280",
                                  fontWeight: 700,
                                  marginRight: 6,
                                }}
                              >
                                {verified ? "✓ HIGHLIGHTED" : "≈ PARAPHRASED"}
                              </span>
                              "{q}"
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: "#9CA3AF", fontStyle: "italic" }}>
                        No specific quote available — score reflects absence of evidence in this
                        area.
                      </div>
                    )}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: isHighest ? "#16A34A" : BRAND,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        marginBottom: 4,
                      }}
                    >
                      {isHighest
                        ? "✓ Highly Effective — ways to extend & further support students"
                        : "💡 How to reach Highly Effective"}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "#374151",
                        lineHeight: 1.55,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {s.suggestions}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Submit another lesson — same form as before generation */}
          <div style={{ marginTop: 28 }}>
            <div style={{ textAlign: "center", marginBottom: 14 }}>
              <h3
                style={{
                  fontFamily: "'Playfair Display',serif",
                  fontSize: 20,
                  color: "#1F2937",
                  margin: "0 0 4px",
                }}
              >
                Review another lesson plan
              </h3>
              <p style={{ color: "#6B7280", fontSize: 13, margin: 0 }}>
                Upload another lesson plan to score it against the Danielson rubric.
              </p>
            </div>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDraggingOver(true);
              }}
              onDragLeave={() => setDraggingOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDraggingOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
              style={{
                background: draggingOver ? LIGHT : "white",
                border: `2px dashed ${draggingOver ? BRAND : "#D1D5DB"}`,
                borderRadius: 14,
                padding: "32px 24px",
                textAlign: "center",
                transition: "all 0.15s",
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 10 }} aria-hidden="true">
                📄
              </div>
              <p style={{ color: "#6B7280", fontSize: 13, margin: "0 0 14px" }}>
                PDF, Word (.docx), or plain text (.txt) — drag & drop or click below.
              </p>
              <label
                style={{
                  display: "inline-block",
                  background: BRAND,
                  color: "white",
                  padding: "11px 24px",
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(207,39,245,0.3)",
                }}
              >
                {loading ? "Reading file…" : "Choose file"}
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,.md,.rtf,application/pdf,text/plain"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  style={{ display: "none" }}
                  disabled={loading}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Disclaimer — always visible at bottom */}
      <div
        style={{
          marginTop: 28,
          background: "#FEF3C7",
          border: "1px solid #FDE68A",
          borderRadius: 10,
          padding: "14px 18px",
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#92400E",
            marginBottom: 4,
            letterSpacing: 0.4,
            textTransform: "uppercase",
          }}
        >
          ⚠️ Please note
        </div>
        <p style={{ margin: 0, fontSize: 13, color: "#78350F", lineHeight: 1.55 }}>
          Scores are subjective and remain at the discretion of administrative review. This tool
          does <strong>not</strong> guarantee a Highly Effective rating, but supports the user in
          working toward Highly Effective according to the Danielson rubric.
        </p>
      </div>
    </div>
  );
}
