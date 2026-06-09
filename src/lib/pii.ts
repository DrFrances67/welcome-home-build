// Lightweight, heuristic PII detector for blocking AI prompts that include
// student names, IDs, or birthdays. False positives are expected — the user
// can edit the prompt and resubmit.

export type PiiHitType = "name" | "id" | "birthday";

export interface PiiHit {
  type: PiiHitType;
  match: string;
}

// Capitalized two-word phrases that look like a name but are common content.
const COMMON_NON_NAMES = new Set([
  "United States",
  "New York",
  "Los Angeles",
  "San Francisco",
  "North America",
  "South America",
  "Central America",
  "Word Bank",
  "Multiple Choice",
  "Short Answer",
  "Fill In",
  "True False",
  "Lesson Plan",
  "Common Core",
  "Pre Kindergarten",
  "Grade One",
  "Grade Two",
  "Grade Three",
  "Grade Four",
  "Grade Five",
  "Grade Six",
  "Grade Seven",
  "Grade Eight",
  "Grade Nine",
  "Grade Ten",
  "Great Britain",
  "United Kingdom",
  "Middle School",
  "High School",
  "Elementary School",
  "Civil War",
  "World War",
  "Solar System",
  "Periodic Table",
  "Industrial Revolution",
  "American Revolution",
  "Black History",
  "New Jersey",
  "New Hampshire",
  "New Mexico",
  "New England",
  "South Korea",
  "North Korea",
  "Saudi Arabia",
  "Costa Rica",
  "Hong Kong",
  "Cape Town",
  "Standard English",
]);

export function detectPII(text: string): PiiHit[] {
  const hits: PiiHit[] = [];
  if (!text || typeof text !== "string") return hits;

  // ── Birthdays / dates of birth ───────────────────────────────────────
  const dateRe = /\b(0?[1-9]|1[0-2])[/-](0?[1-9]|[12]\d|3[01])[/-](\d{2}|\d{4})\b/g;
  let m: RegExpExecArray | null;
  while ((m = dateRe.exec(text))) hits.push({ type: "birthday", match: m[0] });

  const dobKeyword = /\b(birthday|birthdate|date of birth|dob|born on)\b/i;
  if (dobKeyword.test(text)) {
    const captured = text.match(/\b(birthday|birthdate|date of birth|dob|born on)\b[^.\n]{0,40}/i);
    hits.push({ type: "birthday", match: (captured?.[0] || "birthday").trim() });
  }

  // ── Student IDs ──────────────────────────────────────────────────────
  const idLabelRe =
    /\b(?:student\s*id|id\s*number|id\s*#|student\s*number)[:\s#]*([A-Z0-9-]{4,})\b/gi;
  while ((m = idLabelRe.exec(text))) hits.push({ type: "id", match: m[0].trim() });

  // Bare 6+ digit numbers are likely IDs (years like 2024 stay safe at 4 digits).
  const longNumRe = /\b\d{6,}\b/g;
  while ((m = longNumRe.exec(text))) hits.push({ type: "id", match: m[0] });

  // ── Names (First Last, two capitalized tokens) ───────────────────────
  // Skip the very first word of the text/sentence to avoid flagging
  // sentence-start capitalization like "Make Two questions about…".
  const nameRe = /(?<=[a-z.,!?;:'")\s])([A-Z][a-z]{1,15})\s+([A-Z][a-z]{1,15})\b/g;
  while ((m = nameRe.exec(text))) {
    const phrase = `${m[1]} ${m[2]}`;
    if (COMMON_NON_NAMES.has(phrase)) continue;
    hits.push({ type: "name", match: phrase });
  }
  // Explicit "named X" / "student X is" patterns
  const namedRe = /\b(?:named|called|student)\s+([A-Z][a-z]{1,20})\b/g;
  while ((m = namedRe.exec(text))) hits.push({ type: "name", match: m[1] });

  // De-duplicate
  const seen = new Set<string>();
  return hits.filter((h) => {
    const k = `${h.type}:${h.match.toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function hasPII(text: string): boolean {
  return detectPII(text).length > 0;
}

export const PII_BLOCK_MESSAGE = "Remove the PII and then submit.";
