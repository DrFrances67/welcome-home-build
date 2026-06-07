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
import { WorksheetBuilder } from "./teacher/WorksheetBuilder";
import { LessonPlanGenerator } from "./teacher/LessonPlanGenerator";
import {
  EMAIL_RECIPIENTS,
  EMAIL_TONES,
  EMAIL_SITUATIONS,
  STUDENT_GRADE_LEVELS,
  STUDENT_COMPLEXITY,
  SITUATION_MAX,
} from "@/data/email";
import { validateSituations } from "@/lib/email-utils";
import { DANIELSON_COMPONENTS, DANIELSON_RUBRIC_REFERENCE } from "@/data/danielson";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EMAIL ASSISTANT TOOL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function EmailAssistant() {
  const [recipient, setRecipient] = useState("administrator");
  const [tone, setTone] = useState("warm-professional");
  const [situations, setSituations] = useState(["Responding to a complaint"]);
  const [situationCapNotice, setSituationCapNotice] = useState("");
  const toggleSituation = (s) =>
    setSituations((prev) => {
      if (prev.includes(s)) {
        // Removing — always allowed unless it's the last one
        setSituationCapNotice("");
        return prev.length === 1 ? prev : prev.filter((x) => x !== s);
      }
      // Adding — enforce the maximum
      if (prev.length >= SITUATION_MAX) {
        setSituationCapNotice(
          `You can pick up to ${SITUATION_MAX} situations. Deselect one to add "${s}", or try a focused combo like: ${prev
            .slice(0, SITUATION_MAX - 1)
            .concat(s)
            .join(" + ")}.`,
        );
        return prev;
      }
      setSituationCapNotice("");
      return [...prev, s];
    });
  const situation = situations.join(" + ");
  const [gradeLevel, setGradeLevel] = useState("3-5");
  const [complexity, setComplexity] = useState("medium");
  const [draft, setDraft] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const [concise, setConcise] = useState(null);
  const [concising, setConcising] = useState(false);
  const [conciseCopied, setConciseCopied] = useState(false);
  const [conciseError, setConciseError] = useState(null);

  const polish = async () => {
    if (!draft.trim()) return;
    void trackToolUse("Professional Communication");
    setLoading(true);
    setResult(null);
    setError(null);
    setConcise(null);
    setConciseError(null);

    const rLabel = EMAIL_RECIPIENTS.find((r) => r.id === recipient)?.label;
    const tObj = EMAIL_TONES.find((t) => t.id === tone);
    try {
      const isGrant = recipient === "grant" || /grant/i.test(situation);
      const isStudent = recipient === "student";
      const gObj = STUDENT_GRADE_LEVELS.find((g) => g.id === gradeLevel);
      const showComplexity = gObj?.tier === "secondary";
      const cObj = STUDENT_COMPLEXITY.find((c) => c.id === complexity);
      const readingLabel = showComplexity ? `${gObj?.label} · ${cObj?.label}` : gObj?.label || "";
      const readingDesc = showComplexity
        ? `${gObj?.desc} — complexity: ${cObj?.desc}`
        : gObj?.desc || "";
      const text =
        (await callAiRaw({
          model: "claude-sonnet-4-20250514",
          max_tokens: isGrant ? 2400 : 1200,
          system: `You are an expert writing assistant helping a teacher compose professional communication.
Recipient: ${rLabel}. Tone: ${tObj?.label} — ${tObj?.desc}. Situation(s): ${situations.join(", ")}.
${situations.length > 1 ? `MULTI-SITUATION CONTEXT — The teacher has selected multiple situations: ${situations.map((s) => `"${s}"`).join(", ")}. You MUST address ALL of them in ONE cohesive message. Do not write separate emails. Combine the requirements naturally — for example, if "Request for tutoring" and "Classwork / homework support" are both selected, the message should cover both tutoring availability/scheduling AND specific classwork/homework support in a unified, well-organized email. Use clear paragraph breaks (or a short list) to keep each topic readable, but maintain ONE subject line, ONE greeting, and ONE closing.` : ""}
${
  isGrant
    ? `GRANT CONTEXT — This email is a grant / funding request. The teacher is asking a foundation, donor, business, or funder for resources (supplies, technology, books, materials, field trips, etc.) for their classroom or school. The email MUST:
- Be professional, respectful, and concise.
- Open by briefly introducing the teacher, school, grade level, and student population served.
- Clearly state the specific resources or funding being requested and the approximate amount or quantity if known.
- Explain WHY these items are a necessity — tie them directly to student learning outcomes, equity, engagement, or a specific instructional gap.
- Describe the impact on students (how many students benefit, what they will be able to do).
- Express genuine gratitude and offer to provide updates, photos, or a thank-you from students.
- Include a clear call to action (next steps, contact info placeholder).
- Avoid sounding desperate or generic; sound mission-driven.`
    : ""
}
${
  isStudent
    ? `STUDENT CONTEXT — This message is being written DIRECTLY TO A STUDENT. You MUST:
- Always use student-friendly language that is easy to read and understand.
- TARGET READING LEVEL: ${readingLabel} (${readingDesc}). Calibrate sentence length, vocabulary complexity, and explanations to this level. For K–2, use very short sentences (≤8 words when possible) and only the most common words. For 3–5, keep sentences short and explain any tricky word. For 6–8 and 9–12, follow the chosen complexity tier (Simple = plain & short, Medium = balanced, Advanced = richer vocabulary while still respectful and clear).
- Replace jargon, academic phrasing, and complex words with plain alternatives a student can quickly grasp.
- Keep a warm, encouraging, respectful tone — never condescending.
- Be specific and concrete: tell the student exactly what is happening, what they need to do, and by when.
- Keep the message brief and well-structured (short paragraphs or a short list when helpful).

🛡️ SAFETY RULE — PRESERVE FACTUAL CONTENT EXACTLY (do not paraphrase, translate, simplify, or alter):
  • Names of people (students, teachers, parents, staff, etc.) — keep spelling and form exactly as written.
  • Dates and times (e.g., "Friday, May 3", "3:15 PM", "next Monday") — keep wording, format, and any specific date/time intact.
  • Deadlines and due dates — keep the exact deadline phrasing and any specific date.
  • Action items / things the student must do — keep the actions, quantities, page numbers, assignment names, room numbers, locations, links, and any required materials EXACTLY as in the draft.
  • Numbers, scores, grades, amounts, page numbers, chapter numbers — keep exact.
  • Course names, assignment titles, project names — keep exact.
You may rewrite the SURROUNDING wording, sentence structure, tone, and vocabulary to be student-friendly at the target reading level, but the items above must appear UNCHANGED in the rewritten message. If something is unclear in the draft, keep it as-is rather than guessing.`
    : ""
}
Rules: maintain respect and professionalism; keep the teacher's core intent; add a subject line; clear structure; not overly wordy.
Respond ONLY as valid JSON (no markdown fences): {"subject":"...","email":"..."}`,
          messages: [
            { role: "user", content: `Polish this into a professional email:\n\n${draft}` },
          ],
        })) || "";
      const cleaned = text.replace(/```json|```/g, "").trim();
      let parsed = null;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        const m = cleaned.match(/\{[\s\S]*\}/);
        if (m) {
          try {
            parsed = JSON.parse(m[0]);
          } catch {
            /* ignore */
          }
        }
      }
      if (!parsed || typeof parsed !== "object" || !parsed.email) {
        // Fallback: treat the whole text as the email body
        const subjMatch = cleaned.match(/subject[:\-]\s*(.+)/i);
        parsed = {
          subject: subjMatch
            ? subjMatch[1]
                .split("\n")[0]
                .trim()
                .replace(/^["']|["']$/g, "")
            : "Your email",
          email:
            cleaned.replace(/^subject[:\-].+\n/i, "").trim() ||
            "(No content returned — please try again.)",
        };
      }
      setResult(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  const makeConcise = async () => {
    if (!result?.email) return;
    void trackToolUse("Professional Communication");
    setConcising(true);
    setConcise(null);
    setConciseError(null);
    try {
      const text =
        (await callAiRaw({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1200,
          system: `You are an expert editor. Rewrite the professional message below to be MORE CONCISE.
Rules:
- Remove redundancy, filler, and repetition; tighten wording.
- KEEP every important point, all factual details (names, dates, times, deadlines, action items, numbers, links), the core intent, the tone, and professionalism.
- Do NOT add new information. Keep one subject line, one greeting, one closing.
Respond ONLY as valid JSON (no markdown fences): {"subject":"...","email":"..."}`,
          messages: [
            {
              role: "user",
              content: `Make this more concise:\n\nSubject: ${result.subject}\n\n${result.email}`,
            },
          ],
        })) || "";
      const cleaned = text.replace(/```json|```/g, "").trim();
      let parsed = null;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        const m = cleaned.match(/\{[\s\S]*\}/);
        if (m) {
          try {
            parsed = JSON.parse(m[0]);
          } catch {
            /* ignore */
          }
        }
      }
      if (!parsed || typeof parsed !== "object" || !parsed.email) {
        const subjMatch = cleaned.match(/subject[:\-]\s*(.+)/i);
        parsed = {
          subject: subjMatch
            ? subjMatch[1]
                .split("\n")[0]
                .trim()
                .replace(/^["']|["']$/g, "")
            : result.subject,
          email:
            cleaned.replace(/^subject[:\-].+\n/i, "").trim() ||
            "(No content returned — please try again.)",
        };
      }
      setConcise(parsed);
    } catch (e) {
      setConciseError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    }
    setConcising(false);
  };

  const copyEmail = () => {
    navigator.clipboard.writeText(`Subject: ${result.subject}\n\n${result.email}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyConcise = () => {
    if (!concise) return;
    navigator.clipboard.writeText(`Subject: ${concise.subject}\n\n${concise.email}`);
    setConciseCopied(true);
    setTimeout(() => setConciseCopied(false), 2000);
  };

  // shared style tokens
  const BRAND = "#6D28D9";
  const LIGHT = "#F5F3FF";
  const card = {
    background: "white",
    borderRadius: 10,
    border: "1px solid #E5E7EB",
    overflow: "hidden",
  };
  const cardHead = {
    background: SITE_COLOR,
    padding: "12px 18px",
    display: "flex",
    alignItems: "center",
    gap: 8,
  };
  const cardHeadTxt = {
    fontFamily: "'Playfair Display',serif",
    color: "white",
    fontSize: 15,
    fontWeight: 700,
  };
  const lbl = {
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "#6B7280",
    display: "block",
    marginBottom: 6,
  };
  const inp = {
    width: "100%",
    padding: "9px 11px",
    borderRadius: 7,
    border: "1.5px solid #D1D5DB",
    fontFamily: "'Inter',sans-serif",
    fontSize: 13,
    color: "#111827",
    outline: "none",
    boxSizing: "border-box",
    background: "white",
  };

  return (
    <div
      className="two-col-grid"
      style={{
        padding: "28px 32px",
        maxWidth: 1080,
        margin: "0 auto",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 28,
        alignItems: "start",
      }}
    >
      {/* LEFT: Compose */}
      <div style={card}>
        <div style={cardHead}>
          <span style={cardHeadTxt}>✏️ Compose</span>
        </div>
        <div style={{ padding: "20px 20px 24px" }}>
          <span id="recipient-label" style={lbl}>
            Who are you writing to?
          </span>
          <div
            role="radiogroup"
            aria-labelledby="recipient-label"
            style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 18 }}
          >
            {EMAIL_RECIPIENTS.map((r) => {
              const selected = recipient === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRecipient(r.id)}
                  role="radio"
                  aria-checked={selected}
                  aria-label={`${r.label}. ${r.desc}${selected ? ". Currently selected" : ""}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "11px 14px",
                    borderRadius: 8,
                    border: `1.5px solid ${selected ? BRAND : "#E5E7EB"}`,
                    background: selected ? LIGHT : "white",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.12s",
                  }}
                >
                  <span style={{ fontSize: 20 }} aria-hidden="true">
                    {r.icon}
                  </span>
                  <div>
                    <div
                      style={{
                        fontFamily: "'Inter',sans-serif",
                        fontWeight: 700,
                        fontSize: 13,
                        color: selected ? BRAND : "#111827",
                      }}
                    >
                      {r.label}
                    </div>
                    <div style={{ fontSize: 11, color: "#6B7280", marginTop: 1 }}>{r.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {recipient === "student" &&
            (() => {
              const gObj = STUDENT_GRADE_LEVELS.find((g) => g.id === gradeLevel);
              const showComplexity = gObj?.tier === "secondary";
              return (
                <div
                  role="group"
                  aria-label="Student writing settings"
                  style={{
                    marginBottom: 18,
                    padding: "12px 14px",
                    background: LIGHT,
                    border: `1.5px solid ${BRAND}`,
                    borderRadius: 8,
                  }}
                >
                  <label
                    htmlFor="student-grade-level"
                    style={{ ...lbl, color: BRAND, marginBottom: 8, display: "block" }}
                  >
                    🎒 Grade level
                  </label>
                  <select
                    id="student-grade-level"
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(e.target.value)}
                    aria-label="Student grade level"
                    style={{ ...inp, cursor: "pointer", marginBottom: showComplexity ? 10 : 8 }}
                  >
                    {STUDENT_GRADE_LEVELS.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.label} — {g.desc}
                      </option>
                    ))}
                  </select>
                  {showComplexity && (
                    <>
                      <label
                        htmlFor="student-complexity"
                        style={{ ...lbl, color: BRAND, marginBottom: 6, display: "block" }}
                      >
                        📚 Vocabulary complexity
                      </label>
                      <select
                        id="student-complexity"
                        value={complexity}
                        onChange={(e) => setComplexity(e.target.value)}
                        aria-label="Vocabulary complexity"
                        style={{ ...inp, cursor: "pointer", marginBottom: 8 }}
                      >
                        {STUDENT_COMPLEXITY.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label} — {c.desc}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                  <div style={{ fontSize: 11, color: "#6B7280", lineHeight: 1.5 }}>
                    <strong style={{ color: BRAND }}>🛡️ Safety:</strong> Names, dates, deadlines,
                    page numbers, and action items from your draft will be kept exactly as written.
                    Only the surrounding language is rewritten for the student.
                  </div>
                </div>
              );
            })()}

          <span id="tone-label" style={lbl}>
            Tone
          </span>
          <div
            role="radiogroup"
            aria-labelledby="tone-label"
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 18 }}
          >
            {EMAIL_TONES.map((t) => {
              const selected = tone === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTone(t.id)}
                  role="radio"
                  aria-checked={selected}
                  aria-label={`${t.label} tone. ${t.desc}${selected ? ". Currently selected" : ""}`}
                  style={{
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: `1.5px solid ${selected ? BRAND : "#E5E7EB"}`,
                    background: selected ? LIGHT : "white",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.12s",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'Inter',sans-serif",
                      fontWeight: 700,
                      fontSize: 12,
                      color: selected ? BRAND : "#111827",
                    }}
                  >
                    {t.label}
                  </div>
                  <div style={{ fontSize: 10.5, color: "#9CA3AF", marginTop: 2 }}>{t.desc}</div>
                </button>
              );
            })}
          </div>

          {(() => {
            const atMax = situations.length >= SITUATION_MAX;
            const counterText = `${situations.length} of ${SITUATION_MAX} situations selected${atMax ? ". Maximum reached." : ""}`;
            return (
              <span
                id="situation-label"
                style={{ ...lbl, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}
              >
                <span>
                  Situation{" "}
                  <span
                    style={{
                      textTransform: "none",
                      fontWeight: 500,
                      color: "#9CA3AF",
                      letterSpacing: 0,
                    }}
                  >
                    · tap to select one or more
                  </span>
                </span>
                <span
                  id="situation-counter"
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                  aria-label={counterText}
                  style={{
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: atMax ? "#FEF3C7" : LIGHT,
                    color: atMax ? "#92400E" : BRAND,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 0,
                    textTransform: "none",
                    border: `1px solid ${atMax ? "#FCD34D" : "#E5E7EB"}`,
                  }}
                >
                  <span aria-hidden="true">
                    {situations.length}/{SITUATION_MAX} selected{atMax ? " · max" : ""}
                  </span>
                </span>
              </span>
            );
          })()}
          <div
            role="group"
            aria-labelledby="situation-label"
            aria-describedby="situation-counter situation-help"
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}
          >
            {EMAIL_SITUATIONS.map((s) => {
              const active = situations.includes(s);
              const atMax = situations.length >= SITUATION_MAX;
              const wouldBlock = !active && atMax;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSituation(s)}
                  aria-pressed={active}
                  aria-label={`${s}. ${active ? "Selected. Press to remove." : wouldBlock ? `Not selected. Maximum of ${SITUATION_MAX} reached — deselect another to add this.` : "Not selected. Press to add."}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "9px 11px",
                    borderRadius: 8,
                    border: `1.5px solid ${active ? BRAND : "#E5E7EB"}`,
                    background: active ? LIGHT : "white",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.12s",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 4,
                      border: `1.5px solid ${active ? BRAND : "#D1D5DB"}`,
                      background: active ? BRAND : "white",
                      color: "white",
                      fontSize: 11,
                      lineHeight: "13px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {active ? "✓" : ""}
                  </span>
                  <span
                    style={{
                      fontFamily: "'Inter',sans-serif",
                      fontWeight: 600,
                      fontSize: 12,
                      color: active ? BRAND : "#111827",
                    }}
                  >
                    {s}
                  </span>
                </button>
              );
            })}
          </div>
          <span id="situation-help" className="sr-only">
            Choose up to {SITUATION_MAX} situations. The AI will combine selected situations into a
            single, cohesive message.
          </span>
          {situationCapNotice && (
            <div
              role="alert"
              aria-live="assertive"
              style={{
                marginTop: 8,
                padding: "10px 12px",
                background: "#FFFBEB",
                border: "1.5px solid #FCD34D",
                borderRadius: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span aria-hidden="true" style={{ fontSize: 14, lineHeight: "18px" }}>
                  🛑
                </span>
                <div style={{ flex: 1 }}>
                  <span className="sr-only">Selection limit reached. </span>
                  <div
                    style={{ fontSize: 12, fontWeight: 600, color: "#92400E", lineHeight: 1.45 }}
                  >
                    {situationCapNotice}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSituationCapNotice("")}
                    aria-label="Dismiss selection limit warning"
                    style={{
                      marginTop: 8,
                      padding: "6px 10px",
                      borderRadius: 6,
                      border: "1.5px solid #92400E",
                      background: "white",
                      color: "#92400E",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "'Inter',sans-serif",
                    }}
                  >
                    Got it
                  </button>
                </div>
              </div>
            </div>
          )}
          {(() => {
            const issues = validateSituations(situations);
            const hasError = issues.some((i) => i.level === "error");
            return (
              <>
                <div aria-live="polite" aria-atomic="false">
                  {issues.map((issue, idx) => {
                    const isError = issue.level === "error";
                    const bg = isError ? "#FEF2F2" : "#FFFBEB";
                    const border = isError ? "#FCA5A5" : "#FCD34D";
                    const fg = isError ? "#991B1B" : "#92400E";
                    const role = isError ? "alert" : "status";
                    return (
                      <div
                        key={idx}
                        role={role}
                        style={{
                          marginTop: 8,
                          padding: "10px 12px",
                          background: bg,
                          border: `1.5px solid ${border}`,
                          borderRadius: 8,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                          <span aria-hidden="true" style={{ fontSize: 14, lineHeight: "18px" }}>
                            {isError ? "⚠️" : "💡"}
                          </span>
                          <div style={{ flex: 1 }}>
                            <span className="sr-only">{isError ? "Error: " : "Suggestion: "}</span>
                            <div
                              style={{ fontSize: 12, fontWeight: 600, color: fg, lineHeight: 1.45 }}
                            >
                              {issue.message}
                            </div>
                            {issue.suggestion && issue.suggestion.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setSituations(issue.suggestion)}
                                aria-label={`Apply suggested situation combination: ${issue.suggestion.join(", ")}`}
                                style={{
                                  marginTop: 8,
                                  padding: "6px 10px",
                                  borderRadius: 6,
                                  border: `1.5px solid ${fg}`,
                                  background: "white",
                                  color: fg,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  fontFamily: "'Inter',sans-serif",
                                }}
                              >
                                ✨ Use suggested: {issue.suggestion.join(" + ")}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {situations.length > 1 && !hasError && (
                  <div
                    role="status"
                    aria-live="polite"
                    style={{ fontSize: 11, color: BRAND, marginTop: 8, fontStyle: "italic" }}
                  >
                    ✨ Combining {situations.length} situations into one message.
                  </div>
                )}
                <div style={{ marginBottom: 18 }} />
              </>
            );
          })()}

          <label htmlFor="email-draft" style={lbl}>
            Your rough draft or key points
          </label>
          <SpellTextarea
            id="email-draft"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck
            placeholder="Write your rough draft, key points, or anything you want to say. Don't worry about being polished — that's our job!"
            aria-label="Rough draft or key points for your email"
            style={{
              ...inp,
              minHeight: 160,
              resize: "vertical",
              lineHeight: 1.6,
              background: "#FAFAFA",
            }}
          />

          {error && (
            <div
              role="alert"
              aria-live="assertive"
              style={{
                background: "#FEF2F2",
                border: "1px solid #FCA5A5",
                borderRadius: 7,
                padding: "10px 14px",
                color: "#DC2626",
                fontSize: 13,
                marginTop: 10,
                marginBottom: 4,
              }}
            >
              {error}
            </div>
          )}

          {(() => {
            const hasError = validateSituations(situations).some((i) => i.level === "error");
            const blocked = loading || !draft.trim() || hasError;
            const reason = loading
              ? "Polishing in progress"
              : !draft.trim()
                ? "Enter a draft to enable"
                : hasError
                  ? "Resolve the situation conflict above to continue"
                  : "";
            return (
              <button
                type="button"
                onClick={polish}
                disabled={blocked}
                aria-disabled={blocked}
                aria-label={
                  blocked
                    ? `Polish my communication. Disabled: ${reason}`
                    : "Polish my communication"
                }
                title={hasError ? "Resolve the situation conflict above to continue." : ""}
                style={{
                  width: "100%",
                  marginTop: 14,
                  padding: "12px",
                  borderRadius: 8,
                  border: "none",
                  background: blocked ? "#E5E7EB" : BRAND,
                  color: blocked ? "#9CA3AF" : "white",
                  fontFamily: "'Inter',sans-serif",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: blocked ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  letterSpacing: 0.3,
                }}
              >
                {loading ? (
                  <>
                    <span
                      aria-hidden="true"
                      style={{
                        width: 16,
                        height: 16,
                        border: "2px solid rgba(255,255,255,0.3)",
                        borderTopColor: "white",
                        borderRadius: "50%",
                        display: "inline-block",
                        animation: "spin 0.8s linear infinite",
                      }}
                    />
                    <span>Polishing…</span>
                    <span className="sr-only">, please wait</span>
                  </>
                ) : hasError ? (
                  <span>
                    <span aria-hidden="true">⚠️ </span>Fix situation conflict above
                  </span>
                ) : (
                  <span>
                    <span aria-hidden="true">✦ </span>Polish My Communication
                  </span>
                )}
              </button>
            );
          })()}
        </div>
      </div>

      {/* RIGHT: Result */}
      <div style={{ ...card, minHeight: 500, display: "flex", flexDirection: "column" }}>
        <div style={cardHead}>
          <span style={cardHeadTxt}>📨 Polished Communication</span>
        </div>
        <div style={{ padding: "20px", flex: 1, display: "flex", flexDirection: "column" }}>
          {loading ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 14,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  border: `3px solid #E5E7EB`,
                  borderTopColor: BRAND,
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              <p
                style={{
                  fontFamily: "'Inter',sans-serif",
                  fontSize: 13,
                  color: "#6B7280",
                  fontStyle: "italic",
                }}
              >
                Crafting your professional email…
              </p>
            </div>
          ) : result ? (
            <>
              <div
                style={{
                  background: "#F9FAFB",
                  border: "1px solid #E5E7EB",
                  borderRadius: 7,
                  padding: "10px 14px",
                  marginBottom: 14,
                  display: "flex",
                  gap: 10,
                  alignItems: "baseline",
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    color: "#6B7280",
                    whiteSpace: "nowrap",
                  }}
                >
                  Subject
                </span>
                <span
                  style={{
                    fontFamily: "'Inter',sans-serif",
                    fontWeight: 700,
                    fontSize: 13,
                    color: "#111827",
                  }}
                >
                  {result.subject}
                </span>
              </div>
              <div
                style={{
                  fontFamily: "'Inter',sans-serif",
                  fontSize: 13,
                  lineHeight: 1.8,
                  color: "#1F2937",
                  whiteSpace: "pre-wrap",
                }}
              >
                {result.email}
              </div>
              <button
                onClick={copyEmail}
                style={{
                  marginTop: 18,
                  padding: "10px",
                  borderRadius: 8,
                  border: `1.5px solid ${copied ? "#059669" : BRAND}`,
                  background: copied ? "#D1FAE5" : "white",
                  color: copied ? "#059669" : BRAND,
                  fontFamily: "'Inter',sans-serif",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {copied ? "✓  Copied to Clipboard!" : "Copy Full Email"}
              </button>

              {/* Make it more concise */}
              <button
                onClick={makeConcise}
                disabled={concising}
                style={{
                  marginTop: 10,
                  padding: "10px",
                  borderRadius: 8,
                  border: `1.5px solid ${BRAND}`,
                  background: LIGHT,
                  color: BRAND,
                  fontFamily: "'Inter',sans-serif",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: concising ? "not-allowed" : "pointer",
                  opacity: concising ? 0.7 : 1,
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                {concising ? (
                  <>
                    <span
                      aria-hidden="true"
                      style={{
                        width: 14,
                        height: 14,
                        border: "2px solid rgba(109,40,217,0.3)",
                        borderTopColor: BRAND,
                        borderRadius: "50%",
                        display: "inline-block",
                        animation: "spin 0.8s linear infinite",
                      }}
                    />
                    <span>Making it concise…</span>
                  </>
                ) : (
                  <span>
                    <span aria-hidden="true">✂️ </span>Make It Concise
                  </span>
                )}
              </button>

              {conciseError && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: "#FEF2F2",
                    border: "1px solid #FECACA",
                    color: "#B91C1C",
                    fontFamily: "'Inter',sans-serif",
                    fontSize: 12.5,
                  }}
                >
                  <span aria-hidden="true">⚠️ </span>
                  {conciseError}
                </div>
              )}

              {concise && (
                <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px dashed #D1D5DB" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: 0.8,
                        color: BRAND,
                      }}
                    >
                      ✂️ Concise Version
                    </div>
                    <button
                      onClick={copyConcise}
                      aria-label="Copy concise version"
                      style={{
                        flexShrink: 0,
                        padding: "6px 12px",
                        borderRadius: 7,
                        border: `1.5px solid ${conciseCopied ? "#059669" : BRAND}`,
                        background: conciseCopied ? "#D1FAE5" : "white",
                        color: conciseCopied ? "#059669" : BRAND,
                        fontFamily: "'Inter',sans-serif",
                        fontWeight: 700,
                        fontSize: 11,
                        cursor: "pointer",
                        transition: "all 0.2s",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {conciseCopied ? "✓ Copied!" : "Copy Concise Version"}
                    </button>
                  </div>
                  <div
                    style={{
                      background: "#F9FAFB",
                      border: "1px solid #E5E7EB",
                      borderRadius: 7,
                      padding: "10px 14px",
                      marginBottom: 14,
                      display: "flex",
                      gap: 10,
                      alignItems: "baseline",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: 0.8,
                        color: "#6B7280",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Subject
                    </span>
                    <span
                      style={{
                        fontFamily: "'Inter',sans-serif",
                        fontWeight: 700,
                        fontSize: 13,
                        color: "#111827",
                      }}
                    >
                      {concise.subject}
                    </span>
                  </div>
                  <div
                    style={{
                      fontFamily: "'Inter',sans-serif",
                      fontSize: 13,
                      lineHeight: 1.8,
                      color: "#1F2937",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {concise.email}
                  </div>
                  <button
                    onClick={copyConcise}
                    style={{
                      marginTop: 18,
                      padding: "10px",
                      width: "100%",
                      borderRadius: 8,
                      border: `1.5px solid ${conciseCopied ? "#059669" : BRAND}`,
                      background: conciseCopied ? "#D1FAE5" : "white",
                      color: conciseCopied ? "#059669" : BRAND,
                      fontFamily: "'Inter',sans-serif",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    {conciseCopied ? "✓  Copied to Clipboard!" : "Copy Concise Version"}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                textAlign: "center",
                color: "#9CA3AF",
              }}
            >
              <div style={{ fontSize: 44, opacity: 0.35 }}>📝</div>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, lineHeight: 1.7 }}>
                Fill in your details and rough draft,
                <br />
                then click <strong style={{ color: "#6B7280" }}>Polish My Communication</strong> to
                see
                <br />
                your professional version here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LESSON PLAN GENERATOR TOOL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DANIELSON REVIEW — Score lesson plans against the Danielson rubric
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function DanielsonReview() {
  const BRAND = "#CF27F5";
  const LIGHT = "#FDF4FF";

  const [file, setFile] = useState(null);
  const [extractedText, setExtractedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null); // { scores: [{id,score,evidence,suggestions}], summary }
  const [draggingOver, setDraggingOver] = useState(false);

  const readFileAsText = (f) =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = (e) => res(e.target.result);
      r.onerror = rej;
      r.readAsText(f);
    });

  const extractPdfText = async (f) => {
    const pdfjsMod: any = await import("pdfjs-dist");
    const pdfjs = pdfjsMod.default ?? pdfjsMod;
    const workerMod: any = await import("pdfjs-dist/build/pdf.worker.mjs?url");
    const workerUrl = workerMod.default ?? workerMod;
    if (pdfjs.GlobalWorkerOptions) pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const buf = await f.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buf }).promise;
    const pages = Math.min(doc.numPages, 25);
    let text = "";
    for (let p = 1; p <= pages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const items = Array.isArray(content?.items) ? content.items : [];
      text +=
        items.map((it: any) => (it && typeof it.str === "string" ? it.str : "")).join(" ") + "\n\n";
    }
    return text.trim();
  };

  const extractDocxText = async (f) => {
    const mammothMod: any = await import("mammoth/mammoth.browser.js");
    const mammoth = mammothMod.default ?? mammothMod;
    const buf = await f.arrayBuffer();
    const extractFn = mammoth.extractRawText || mammothMod.extractRawText;
    if (typeof extractFn !== "function") {
      throw new Error("Word document reader failed to load. Please try a PDF or .txt file.");
    }
    const result = await extractFn.call(mammoth, { arrayBuffer: buf });
    return (result?.value || "").trim();
  };

  const handleFile = async (f) => {
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

  const callClaude = (system, userContent, maxTokens = 3000) =>
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
      setError(e.message || "Analysis failed.");
    }
    setAnalyzing(false);
  };

  const reset = () => {
    setFile(null);
    setExtractedText("");
    setResult(null);
    setError("");
  };

  const ratingColor = (s) =>
    s === 4 ? "#16A34A" : s === 3 ? "#2563EB" : s === 2 ? "#D97706" : "#DC2626";
  const ratingLabel = (s) =>
    s === 4 ? "Highly Effective" : s === 3 ? "Effective" : s === 2 ? "Developing" : "Ineffective";

  // Verify if a quote actually appears in the source lesson — tolerant of whitespace/punctuation differences
  const normalize = (str) =>
    (str || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[\u2018\u2019\u201C\u201D]/g, "'")
      .trim();
  const quoteFoundInText = (quote, source) => {
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
                    result.scores.reduce((s, x) => s + (x.score || 0), 0) / result.scores.length
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
                        {s.quotes.map((q, qi) => {
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SITE SHELL — The Tech Savvy Teacher
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const TOOLS = [
  {
    id: "lesson",
    label: "Lesson Plan Generator",
    icon: "📋",
    desc: "Generate complete, differentiated lesson plans instantly",
  },
  {
    id: "danielson",
    label: "Danielson Review",
    icon: "🧭",
    desc: "Score a lesson plan against the Danielson rubric",
  },
  {
    id: "worksheet",
    label: "Worksheet Builder",
    icon: "📄",
    desc: "Build print-ready worksheets aligned to NY Standards",
  },
  {
    id: "email",
    label: "Professional Communication",
    icon: "✉️",
    desc: "Transform rough notes into polished professional communication",
  },
];

const SITE_COLOR = "#CF27F5";
const SITE_DARK = "#8B0AB0";

function TheTechSavvyTeacherAppRoot() {
  const [activeTool, setActiveTool] = useState("lesson");
  const [swipeDir, setSwipeDir] = useState<"left" | "right" | null>(null);
  const [swipeHint, setSwipeHint] = useState<string | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);
  const touchStart = useRef<{ x: number; y: number; t: number; valid: boolean } | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Keep the tracking layer's active tool in sync with the visible tool so AI
  // calls are attributed to the real tool in the admin dashboard.
  useEffect(() => {
    const map = {
      lesson: "Lesson Plan Generator",
      danielson: "Danielson Rubric Builder",
      worksheet: "Worksheet Builder",
      email: "Professional Communication",
    } as const;
    setActiveToolName(map[activeTool] ?? null);
  }, [activeTool]);

  // Track scroll within the worksheet canvas (and the page itself when stacked
  // on mobile) to show a floating "back to top" button after meaningful scroll.
  useEffect(() => {
    const isCoarse =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(pointer: coarse)").matches;

    const compute = () => {
      const canvas = document.getElementById("worksheet-canvas");
      const canvasY = canvas ? canvas.scrollTop : 0;
      const winY = window.scrollY || document.documentElement.scrollTop || 0;
      setShowScrollTop(
        shouldShowScrollTop({
          activeTool,
          isCoarsePointer: !!isCoarse,
          canvasScrollTop: canvasY,
          windowScrollTop: winY,
        }),
      );
    };

    if (!isCoarse || activeTool !== "worksheet") {
      setShowScrollTop(false);
      return;
    }

    let cleanup: (() => void) | null = null;
    const timer = window.setTimeout(() => {
      const targets: (HTMLElement | Window)[] = [window];
      const canvas = document.getElementById("worksheet-canvas");
      if (canvas) targets.push(canvas);
      targets.forEach((t) => t.addEventListener("scroll", compute, { passive: true }));
      compute();
      cleanup = () => targets.forEach((t) => t.removeEventListener("scroll", compute));
    }, 60);
    return () => {
      window.clearTimeout(timer);
      cleanup?.();
    };
  }, [activeTool]);

  const scrollToTop = () => scrollEverythingToTop();

  // ━━ Global keyboard shortcuts ━━
  const shortcuts = [
    {
      key: "?",
      mods: ["shift"] as const,
      description: "Show keyboard shortcuts",
      group: "General",
      run: () => setHelpOpen((o) => !o),
    },
    {
      key: "1",
      description: "Switch to Lesson Plan Generator",
      group: "Navigation",
      run: () => setActiveTool("lesson"),
    },
    {
      key: "2",
      description: "Switch to Danielson Review",
      group: "Navigation",
      run: () => setActiveTool("danielson"),
    },
    {
      key: "3",
      description: "Switch to Worksheet Builder",
      group: "Navigation",
      run: () => setActiveTool("worksheet"),
    },
    {
      key: "4",
      description: "Switch to Professional Communication",
      group: "Navigation",
      run: () => setActiveTool("email"),
    },
    {
      key: "g",
      description: "Go to top of page",
      group: "Navigation",
      run: () => scrollEverythingToTop(),
    },
    {
      key: "Escape",
      description: "Close dialogs / cancel",
      group: "General",
      allowInInput: true,
      run: () => setHelpOpen(false),
    },
  ].map((s) => ({ ...s, mods: s.mods ? [...s.mods] : undefined })) as Parameters<
    typeof useGlobalShortcuts
  >[0];

  useGlobalShortcuts(shortcuts);

  // Online/offline awareness
  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setIsOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  // Change tools by swipe direction. dir="left" means user swiped left → next tool.
  const changeToolByDir = (dir: "left" | "right") => {
    const ids = TOOLS.map((t) => t.id);
    const idx = ids.indexOf(activeTool);
    if (idx === -1) return;
    const nextIdx = dir === "left" ? idx + 1 : idx - 1;
    if (nextIdx < 0 || nextIdx >= ids.length) {
      // Edge — show a brief hint and bail
      setSwipeHint(dir === "left" ? "You're on the last tool" : "You're on the first tool");
      window.setTimeout(() => setSwipeHint(null), 1600);
      return;
    }
    const nextId = ids[nextIdx];
    const label = TOOLS.find((t) => t.id === nextId)?.label || nextId;
    setSwipeDir(dir === "left" ? "right" : "left"); // incoming-from direction
    setActiveTool(nextId);
    setSwipeHint(`→ ${label}`);
    window.setTimeout(() => setSwipeHint(null), 1400);
  };

  // Swipe gesture detection on the main content area.
  // Only active on coarse-pointer devices and ignores swipes starting on
  // form fields, the worksheet canvas (which has its own pan/zoom), or
  // controls that need horizontal interaction.
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const isCoarse =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(pointer: coarse)").matches;
    if (!isCoarse) return;

    const SHOULD_IGNORE = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false;
      // Ignore swipes that start inside form controls or the worksheet canvas
      // (the canvas needs its own pan/scroll). Also ignore inside any element
      // marked with data-no-swipe.
      return !!target.closest(
        'input,textarea,select,button,[role="slider"],[role="tab"],[contenteditable="true"],' +
          "#worksheet-canvas,.canvas-area,.ws-sidebar-left,.ws-sidebar-right,[data-no-swipe]",
      );
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        touchStart.current = null;
        return;
      }
      const t = e.touches[0];
      touchStart.current = {
        x: t.clientX,
        y: t.clientY,
        t: Date.now(),
        valid: !SHOULD_IGNORE(e.target),
      };
    };
    const onEnd = (e: TouchEvent) => {
      const start = touchStart.current;
      touchStart.current = null;
      if (!start || !start.valid) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      const dt = Date.now() - start.t;
      const absX = Math.abs(dx),
        absY = Math.abs(dy);
      // Require: mostly horizontal, decent distance, reasonable speed
      if (absX < 60) return;
      if (absX < absY * 1.6) return; // too vertical → likely a scroll
      if (dt > 700) return;
      changeToolByDir(dx < 0 ? "left" : "right");
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchend", onEnd);
    };
  }, [activeTool]);

  // Clear the slide animation class once it has played
  useEffect(() => {
    if (!swipeDir) return;
    const id = window.setTimeout(() => setSwipeDir(null), 260);
    return () => window.clearTimeout(id);
  }, [swipeDir, activeTool]);

  return (
    <div
      className="site-shell"
      style={{
        display: "flex",
        flexDirection: "column",
        height: activeTool === "email" || activeTool === "worksheet" ? "auto" : "100vh",
        minHeight: activeTool === "email" || activeTool === "worksheet" ? "100vh" : 0,
        overflow: activeTool === "email" || activeTool === "worksheet" ? "visible" : "hidden",
        background: "#F8F9FA",
        fontFamily: "'Inter','Segoe UI',sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; }
        @keyframes spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-9px)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        :focus-visible { outline: 3px solid #CF27F5 !important; outline-offset: 2px !important; border-radius: 4px; box-shadow: 0 0 0 5px rgba(207,39,245,0.18) !important; }
        button:focus-visible, [role="button"]:focus-visible, [role="tab"]:focus-visible, [role="radio"]:focus-visible { outline: 3px solid #CF27F5 !important; outline-offset: 3px !important; }
        input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 3px solid #CF27F5 !important; outline-offset: 1px !important; border-color: #CF27F5 !important; }
        @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration:0.01ms !important; transition-duration:0.01ms !important; } }
        @media print { .site-header { display:none !important; } }
        .skip-nav { position:absolute; top:-100px; left:8px; z-index:9999; background:#CF27F5; color:white; padding:8px 16px; border-radius:6px; font-family:'Inter',sans-serif; font-weight:700; font-size:14px; text-decoration:none; transition:top 0.2s; }
        .skip-nav:focus { top:8px; }
        .sr-only { position:absolute !important; width:1px !important; height:1px !important; padding:0 !important; margin:-1px !important; overflow:hidden !important; clip:rect(0,0,0,0) !important; white-space:nowrap !important; border:0 !important; }
        .worksheet-paper { background:white; }
        .canvas-area { background:#F1F3F5; }
        .ws-element:hover .el-delete-btn { opacity: 1 !important; }
        .el-delete-btn { opacity: 0; transition: opacity 0.15s; }
        .app-shell { background:#F8F9FA; }
        .tool-tab { transition: background 0.15s, border-color 0.15s !important; }
        .tool-tab:hover { background: rgba(255,255,255,0.15) !important; }

        /* ━━ Responsive layout for phones & tablets ━━ */
        .tool-tabs-row { overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: thin; }
        .tool-tabs-row::-webkit-scrollbar { height: 3px; }
        .tool-tabs-row::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.3); border-radius: 3px; }

        /* Tablets (iPad portrait & smaller) */
        @media (max-width: 1024px) {
          .two-col-grid { grid-template-columns: 1fr !important; gap: 18px !important; padding: 18px !important; }
          .lesson-grid { grid-template-columns: 1fr !important; gap: 18px !important; padding: 18px !important; }
          .ws-sidebar-left { width: 170px !important; max-height: 100% !important; overflow-y: auto !important; -webkit-overflow-scrolling: touch !important; }
          .ws-sidebar-right { width: 240px !important; }
          .ws-topbar { flex-wrap: wrap !important; height: auto !important; padding: 8px 12px !important; gap: 8px !important; }
          .ws-topbar > * { flex-shrink: 1 !important; }
          .powered-badge { top: 8px !important; right: 8px !important; padding: 3px 10px 3px 8px !important; font-size: 10px !important; }
        }

        /* Phones */
        @media (max-width: 768px) {
          .site-brand { padding: 16px 14px 0 !important; }
          .site-brand h1 { font-size: 22px !important; }
          .site-brand p { font-size: 9px !important; letter-spacing: 2px !important; }
          .site-brand-emoji { font-size: 28px !important; margin-bottom: 6px !important; }
          .powered-badge { position: static !important; margin: 8px auto 0 !important; align-self: center !important; }
          .powered-badge-wrap { display: flex; justify-content: center; padding: 0 8px; }
          .tool-tabs-row { justify-content: flex-start !important; padding: 0 8px; margin-top: 12px !important; }
          .tool-tab { padding: 10px 14px !important; font-size: 12px !important; }
          .tool-tab span { font-size: 14px !important; }

          /* Worksheet builder: stack the 3-column body */
          .ws-body { flex-direction: column !important; overflow: visible !important; height: auto !important; }
          .site-shell, .app-main { height: auto !important; min-height: 100vh !important; overflow: visible !important; }
          .ws-sidebar-left, .ws-sidebar-right {
            width: 100% !important;
            max-height: none !important;
            height: auto !important;
            overflow: visible !important;
            border-right: none !important;
            border-left: none !important;
            border-bottom: 1px solid #E5E7EB !important;
            flex-shrink: 0 !important;
          }
          /* Make any inner scroll containers in the sidebars expand naturally */
          .ws-sidebar-left > *, .ws-sidebar-right > * { overflow: visible !important; }
          .ws-canvas-wrap { height: auto !important; min-height: 60vh; overflow: visible !important; }
          .app-shell { height: auto !important; min-height: 100vh !important; overflow: visible !important; }
          html, body { overflow-x: hidden; overflow-y: auto; }

          /* Worksheet topbar — compact */
          .ws-topbar { padding: 8px !important; gap: 6px !important; }
          .ws-topbar input { font-size: 13px !important; min-width: 120px !important; flex-basis: 100% !important; order: 99; }
          .ws-topbar fieldset { display: none !important; }

          /* Two-column form grids inside cards collapse */
          .form-2col { grid-template-columns: 1fr !important; }

          /* Modals fit phone screens */
          .modal-card { max-width: 96vw !important; max-height: 92vh !important; }

          /* Larger touch targets */
          button, select, input[type="checkbox"] { touch-action: manipulation; }
        }

        /* Very small phones */
        @media (max-width: 420px) {
          .site-brand h1 { font-size: 19px !important; }
          .tool-tab { padding: 9px 10px !important; font-size: 11px !important; }
          .ws-topbar button { padding: 5px 8px !important; font-size: 11px !important; }
        }

        /* ━━ Touch-device UX: bigger tap targets, swipe spacing ━━ */
        /* Applied to coarse pointers (touch screens) regardless of width
           so iPads in landscape also benefit. Desktop stays compact. */
        @media (hover: none) and (pointer: coarse) {
          /* Prevent iOS auto-zoom on focus by ensuring inputs are >= 16px */
          input, select, textarea { font-size: 16px !important; }

          /* Generous minimum tap target (Apple HIG: 44px, Material: 48px) */
          button, [role="button"], [role="tab"], [role="radio"], [role="checkbox"], select, a.skip-nav, .tool-tab, label > input[type="checkbox"] + *, summary {
            min-height: 44px;
          }
          button, [role="button"], .tool-tab { min-width: 44px; padding-top: 10px; padding-bottom: 10px; }

          /* Larger checkboxes & radios */
          input[type="checkbox"], input[type="radio"] { width: 20px !important; height: 20px !important; }

          /* Swipe-friendly spacing between adjacent controls */
          .tool-tabs-row { gap: 6px !important; padding: 4px 8px !important; }
          .ws-topbar { gap: 10px !important; }

          /* Removes the 300ms tap delay & sticky hover */
          a, button, [role="button"], select, input, textarea, .tool-tab { touch-action: manipulation; -webkit-tap-highlight-color: rgba(207,39,245,0.18); }

          /* Smoother momentum scrolling for any scrollable region */
          .tool-tabs-row, .ws-body, .canvas-area, .app-shell, main, .ws-sidebar-left { -webkit-overflow-scrolling: touch; }

          /* Stronger focus ring on touch devices */
          :focus-visible { outline-width: 4px !important; outline-offset: 3px !important; }
        }

        /* ━━ Swipe-tab transitions & hint toast ━━ */
        @keyframes slideInFromRight { from { opacity:0; transform:translateX(28px); } to { opacity:1; transform:translateX(0); } }
        @keyframes slideInFromLeft  { from { opacity:0; transform:translateX(-28px); } to { opacity:1; transform:translateX(0); } }
        @keyframes swipeHintFade { 0%{opacity:0;transform:translate(-50%,12px)} 12%{opacity:1;transform:translate(-50%,0)} 80%{opacity:1;transform:translate(-50%,0)} 100%{opacity:0;transform:translate(-50%,-6px)} }
        .swipe-anim-right { animation: slideInFromRight 0.22s ease-out; }
        .swipe-anim-left  { animation: slideInFromLeft  0.22s ease-out; }
        .swipe-hint-toast {
          position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%);
          background: rgba(17,17,30,0.92); color: white; font-family:'Inter',sans-serif;
          font-size: 13px; font-weight: 600; padding: 10px 16px; border-radius: 22px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.35); z-index: 9998; pointer-events: none;
          animation: swipeHintFade 1.6s ease-out forwards; display:flex; align-items:center; gap:8px;
        }
        @media (prefers-reduced-motion: reduce) {
          .swipe-anim-right, .swipe-anim-left { animation: none !important; }
          .swipe-hint-toast { animation: none !important; opacity: 1 !important; }
        }

        /* ━━ Floating "back to top" FAB ━━ */
        @keyframes fabPop { from { opacity:0; transform:translateY(10px) scale(0.85);} to { opacity:1; transform:translateY(0) scale(1);} }
        .scroll-top-fab {
          position: fixed; right: 16px; bottom: 20px;
          width: 52px; height: 52px; border-radius: 50%;
          background: #CF27F5; color: white; border: none;
          box-shadow: 0 8px 24px rgba(207,39,245,0.45), 0 2px 6px rgba(0,0,0,0.18);
          font-size: 22px; font-weight: 800; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          z-index: 9997; animation: fabPop 0.2s ease-out;
          touch-action: manipulation;
        }
        .scroll-top-fab:hover { background: #B21FD6; }
        .scroll-top-fab:active { transform: scale(0.92); }
        @media (prefers-reduced-motion: reduce) { .scroll-top-fab { animation: none !important; } }

        /* ━━ Offline banner ━━ */
        .offline-banner {
          position: fixed; left: 50%; top: 12px; transform: translateX(-50%);
          background: #1F2937; color: white; font-family:'Inter',sans-serif;
          font-size: 13px; font-weight: 600; padding: 10px 16px; border-radius: 22px;
          box-shadow: 0 8px 28px rgba(0,0,0,0.35); z-index: 9999;
          display: flex; align-items: center; gap: 10px; max-width: calc(100vw - 24px);
        }

        /* ━━ Readable error & warning text on small screens ━━ */
        @media (max-width: 768px) {
          /* All explicit alert/status panels */
          [role="alert"], [role="status"] {
            font-size: 14px !important;
            line-height: 1.5 !important;
          }
          /* Inline DC2626 error text used throughout the app */
          [style*="color:\"#DC2626\""], [style*="color: \"#DC2626\""],
          [style*="color:\"#B91C1C\""], [style*="color: \"#B91C1C\""] {
            font-size: 14px !important;
          }
          /* Validation suggestion buttons & cap notices remain tappable */
          .scroll-top-fab { right: 14px; bottom: 16px; width: 56px; height: 56px; }
        }

        /* ━━ Bigger dropdown / option hit areas ━━ */
        select { line-height: 1.5; padding-top: 8px; padding-bottom: 8px; }
        select option { padding: 8px 10px; min-height: 36px; }
        select optgroup { font-weight: 800; padding: 6px 0; }
        @media (hover: none) and (pointer: coarse) {
          select { padding-top: 12px !important; padding-bottom: 12px !important; padding-right: 30px !important; min-height: 44px !important; background-position: right 10px center; }
          select option { padding: 12px 12px !important; min-height: 44px !important; font-size: 16px !important; }
          /* Radio / checkbox option rows used as styled "buttons" */
          [role="radio"], [role="checkbox"], [role="option"] { min-height: 44px !important; padding: 10px 12px !important; }
          label { min-height: 36px; }
          /* Add a touch of breathing room between adjacent option chips */
          [role="radiogroup"], [role="group"] { row-gap: 10px; }
        }
      `}</style>

      <a href="#main-content" className="skip-nav">
        Skip to main content
      </a>

      {/* ━━ SITE HEADER ━━ */}
      <header
        className="site-header"
        style={{
          background: `linear-gradient(160deg, ${SITE_DARK} 0%, ${SITE_COLOR} 60%, #E05BFF 100%)`,
          flexShrink: 0,
          boxShadow: "0 3px 18px rgba(207,39,245,0.45)",
          position: "relative",
        }}
      >
        {/* Keyboard help — top left */}
        <div
          style={{
            position: "absolute",
            top: 14,
            left: 20,
            display: "flex",
            alignItems: "center",
            gap: 8,
            zIndex: 2,
          }}
        >
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            aria-label="Show keyboard shortcuts (press ? )"
            title="Keyboard shortcuts (?)"
            style={{
              background: "rgba(255,255,255,0.14)",
              color: "white",
              border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: 20,
              padding: "5px 12px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "'Inter',sans-serif",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <kbd
              style={{
                background: "rgba(0,0,0,0.25)",
                borderRadius: 4,
                padding: "1px 6px",
                fontSize: 11,
              }}
            >
              ?
            </kbd>
            Shortcuts
          </button>
        </div>

        {/* Powered-by badge — top right */}
        <div
          style={{
            position: "absolute",
            top: 14,
            right: 20,
            display: "flex",
            alignItems: "center",
            gap: 8,
            zIndex: 2,
          }}
        >
          <div
            className="powered-badge"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              background: "rgba(255,255,255,0.14)",
              borderRadius: 20,
              padding: "5px 14px 5px 10px",
              backdropFilter: "blur(6px)",
            }}
          >
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#4ADE80",
                boxShadow: "0 0 0 2px rgba(74,222,128,0.35)",
              }}
            />
            <span
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.9)",
                fontWeight: 600,
                fontFamily: "'Inter',sans-serif",
                letterSpacing: 0.3,
              }}
            >
              Powered by Lovable AI
            </span>
          </div>
        </div>

        {/* Centered branding */}
        <div
          className="site-brand"
          style={{
            textAlign: "center",
            padding: "24px 32px 0",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div
            className="site-brand-emoji"
            style={{ fontSize: 38, lineHeight: 1, marginBottom: 10 }}
            aria-hidden="true"
          >
            💽
          </div>
          <h1
            style={{
              fontFamily: "'Playfair Display',serif",
              color: "white",
              fontSize: 30,
              fontWeight: 800,
              margin: "0 0 7px",
              letterSpacing: 0.3,
              lineHeight: 1.1,
            }}
          >
            The Tech Savvy Teacher
          </h1>
          <p
            style={{
              fontFamily: "'Inter',sans-serif",
              fontSize: 10.5,
              fontWeight: 700,
              color: "rgba(255,255,255,0.78)",
              letterSpacing: 3,
              textTransform: "uppercase",
              margin: "0 0 0",
            }}
          >
            TOOLS FOR NEW YORK EDUCATORS
          </p>
        </div>

        {/* Nav tabs — centered row below title */}
        <div
          role="tablist"
          aria-label="Tool navigation"
          onKeyDown={(e) => {
            const ids = TOOLS.map((t) => t.id);
            const idx = ids.indexOf(activeTool);
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
              e.preventDefault();
              const next =
                e.key === "ArrowRight"
                  ? ids[(idx + 1) % ids.length]
                  : ids[(idx - 1 + ids.length) % ids.length];
              setActiveTool(next);
              const btn = document.getElementById(`tool-tab-${next}`);
              btn?.focus();
            } else if (e.key === "Home") {
              e.preventDefault();
              setActiveTool(ids[0]);
              document.getElementById(`tool-tab-${ids[0]}`)?.focus();
            } else if (e.key === "End") {
              e.preventDefault();
              setActiveTool(ids[ids.length - 1]);
              document.getElementById(`tool-tab-${ids[ids.length - 1]}`)?.focus();
            }
          }}
          className="tool-tabs-row"
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 2,
            marginTop: 16,
            background: "rgba(0,0,0,0.18)",
          }}
        >
          {TOOLS.map((t) => {
            const isActive = activeTool === t.id;
            return (
              <button
                key={t.id}
                id={`tool-tab-${t.id}`}
                type="button"
                onClick={() => setActiveTool(t.id)}
                className="tool-tab"
                role="tab"
                aria-selected={isActive}
                aria-controls="main-content"
                tabIndex={isActive ? 0 : -1}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "13px 28px",
                  border: "none",
                  borderBottom: isActive ? "3px solid white" : "3px solid transparent",
                  background: isActive ? "rgba(255,255,255,0.2)" : "transparent",
                  color: "white",
                  fontFamily: "'Inter',sans-serif",
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 14,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  letterSpacing: 0.1,
                }}
              >
                <span style={{ fontSize: 17 }} aria-hidden="true">
                  {t.icon}
                </span>
                {t.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* ━━ MAIN CONTENT ━━ */}
      <main
        id="main-content"
        ref={mainRef}
        role="tabpanel"
        aria-labelledby={`tool-tab-${activeTool}`}
        tabIndex={-1}
        className={`app-main ${swipeDir === "right" ? "swipe-anim-right" : swipeDir === "left" ? "swipe-anim-left" : ""}`}
        style={{
          flex: 1,
          minHeight: 0,
          overflow:
            activeTool === "worksheet" ? "visible" : activeTool === "email" ? "visible" : "auto",
          display: "flex",
          flexDirection: "column",
          outline: "none",
          touchAction: "pan-y",
        }}
      >
        {activeTool === "worksheet" && (
          <div className="ws-canvas-wrap" style={{ display: "flex", flexDirection: "column" }}>
            <WorksheetBuilder />
          </div>
        )}
        {activeTool === "lesson" && (
          <LessonPlanGenerator
            onBuildWorksheets={(payload) => {
              if (typeof window !== "undefined") {
                (window as any).__pendingLessonForWorksheet = payload;
              }
              setActiveTool("worksheet");
            }}
          />
        )}
        {activeTool === "danielson" && <DanielsonReview />}
        {activeTool === "email" && <EmailAssistant />}
      </main>

      {/* Swipe hint toast (mobile) */}
      {swipeHint && (
        <div className="swipe-hint-toast" role="status" aria-live="polite">
          <span aria-hidden="true">👆</span>
          {swipeHint}
        </div>
      )}

      {/* Offline banner — only shown when the device loses connectivity.
          The previously visited app shell is served from the browser HTTP
          cache, so the UI still loads on weak connections. */}
      {isOffline && (
        <div role="status" aria-live="polite" className="offline-banner">
          <span aria-hidden="true">📡</span>
          <span>You're offline — using cached app. Some AI features need a connection.</span>
        </div>
      )}

      {/* Floating "scroll to top" — mobile worksheet view */}
      {showScrollTop && activeTool === "worksheet" && (
        <button
          type="button"
          onClick={scrollToTop}
          aria-label="Scroll to top of worksheet"
          className="scroll-top-fab"
        >
          <span aria-hidden="true">⬆</span>
        </button>
      )}

      {/* Keyboard shortcuts help overlay */}
      <ShortcutsHelpOverlay
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        shortcuts={shortcuts}
      />
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXPORT — wrapped to play nicely with TanStack Start route component
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function TheTechSavvyTeacherApp() {
  return <TheTechSavvyTeacherAppRoot />;
}

export { WorksheetBuilder };
