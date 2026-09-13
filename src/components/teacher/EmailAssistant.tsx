/* eslint-disable */
// Professional Communication (email) tool — extracted from TheTechSavvyTeacherApp.
import { useState, useRef, useEffect, type CSSProperties } from "react";
import { renderInlineMarkdown, inlineMarkdownToHtml } from "@/lib/inlineMarkdown";
import { detectPII, PII_BLOCK_MESSAGE } from "@/lib/pii";
import { trackToolUse } from "@/lib/tracking";
import { callAiRaw } from "@/lib/aiFetch";
import { SpellTextarea, SpellInput } from "@/components/SpellCheckField";
import {
  EMAIL_RECIPIENTS,
  EMAIL_TONES,
  EMAIL_SITUATIONS,
  STUDENT_GRADE_LEVELS,
  STUDENT_COMPLEXITY,
  SITUATION_MAX,
} from "@/data/email";
import { validateSituations } from "@/lib/email-utils";

export function EmailAssistant() {
  const [recipient, setRecipient] = useState("administrator");
  const [tone, setTone] = useState("warm-professional");
  const [situations, setSituations] = useState(["Responding to a complaint"]);
  const [situationCapNotice, setSituationCapNotice] = useState("");
  const toggleSituation = (s: string) =>
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
  const [result, setResult] = useState<{ subject: string; email: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [concise, setConcise] = useState<{ subject: string; email: string } | null>(null);
  const [concising, setConcising] = useState(false);
  const [conciseCopied, setConciseCopied] = useState(false);
  const [conciseError, setConciseError] = useState<string | null>(null);

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
    if (!result) return;
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
  const card: CSSProperties = {
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
  const lbl: CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "#6B7280",
    display: "block",
    marginBottom: 6,
  };
  const inp: CSSProperties = {
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
