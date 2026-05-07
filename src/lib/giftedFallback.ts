// Pure helper that guarantees the lesson plan's Gifted differentiation field
// is populated, even when "Gifted & Advanced" is NOT one of the selected
// differentiation groups. Extracted so it can be regression-tested in
// isolation without rendering the full lesson generator UI.

export interface GiftedFallbackForm {
  topic?: string;
  diff?: string[];
}

export interface GiftedFallbackParsed {
  topic?: string;
  differentiation?: {
    ell?: string;
    iep?: string;
    gifted?: string;
    universal?: string;
    [k: string]: string | undefined;
  };
  [k: string]: unknown;
}

export function buildGiftedFallbackText(topic: string): string {
  return `Enrichment & extension for advanced learners on ${topic}: (1) Curriculum compacting — pre-assess and replace mastered content with an independent study contract or advanced project. (2) Higher-order tasks using ANALYZE ("What patterns/assumptions underlie ${topic}?"), EVALUATE ("Critique competing approaches to ${topic} and defend your choice."), and SYNTHESIZE/CREATE ("Design an original product/model that applies ${topic} to a real-world problem.") prompts at DOK 3–4. (3) Acceleration — above-grade-level texts, problems, or dual-enrollment-style challenges. (4) Choice of product, audience, and process; option to pursue a competition, expert mentor, or community/university partnership. (5) Flexible cluster grouping for deeper intellectual collaboration. (6) Social-emotional supports: normalize productive failure, address perfectionism, and build self-regulation, empathy, and grit; include 2e scaffolds where needed.`;
}

/**
 * Mutates `parsed` so that `parsed.differentiation.gifted` is always a
 * substantive string. Rules:
 *  - If parsed.differentiation is missing/invalid, it is initialized.
 *  - If gifted is empty/whitespace, the fallback text is applied.
 *  - If multiple differentiation groups are selected and gifted is too thin
 *    (<120 chars), the fallback is applied.
 *  - Must NOT throw when form.diff is undefined or Gifted is not selected —
 *    this is the regression we are guarding against.
 */
export function ensureGiftedDifferentiation(
  parsed: GiftedFallbackParsed,
  form: GiftedFallbackForm,
): GiftedFallbackParsed {
  if (!parsed.differentiation || typeof parsed.differentiation !== "object") {
    parsed.differentiation = {};
  }
  const giftedTxt = String(parsed.differentiation.gifted || "").trim();
  const diffList = Array.isArray(form?.diff) ? form.diff : [];
  const multiSelected = diffList.length > 1;
  const giftedTooThin = giftedTxt.length < 120;
  if (!giftedTxt || (multiSelected && giftedTooThin)) {
    const topic = form?.topic || parsed.topic || "the lesson topic";
    parsed.differentiation.gifted = buildGiftedFallbackText(topic);
  }
  return parsed;
}
