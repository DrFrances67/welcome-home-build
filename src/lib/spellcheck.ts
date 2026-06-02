// Offline spell + grammar checking.
// Spelling: nspell (Hunspell) with the English dictionary served from /public.
// Grammar: a small set of lightweight, low-false-positive rules.
// No external API calls are made.

export type IssueType = "spelling" | "grammar";

export interface Issue {
  start: number;
  end: number;
  type: IssueType;
  text: string;
  suggestions: string[];
  message: string;
}

type Speller = {
  correct: (word: string) => boolean;
  suggest: (word: string) => string[];
};

let speller: Speller | null = null;
let loadPromise: Promise<Speller | null> | null = null;

/** Lazily load the dictionary + nspell. Resolves to null if unavailable. */
export function ensureSpeller(): Promise<Speller | null> {
  if (speller) return Promise.resolve(speller);
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const [{ default: nspell }, aff, dic] = await Promise.all([
        import("nspell"),
        fetch("/dictionaries/en.aff").then((r) => r.text()),
        fetch("/dictionaries/en.dic").then((r) => r.text()),
      ]);
      speller = nspell(aff, dic) as unknown as Speller;
      return speller;
    } catch (e) {
      console.error("[spellcheck] failed to load dictionary", e);
      return null;
    }
  })();
  return loadPromise;
}

const WORD_RE = /[A-Za-z]+(?:['’][A-Za-z]+)*/g;
const VOWEL_RE = /^[aeiou]/i;
const CONSONANT_RE = /^[bcdfgjklmnpqrstvwxyz]/i;

// Words we never flag as misspellings.
function skipSpelling(word: string): boolean {
  if (word.length < 3) return true;
  if (/\d/.test(word)) return true;
  // ALL CAPS acronyms (NASA, ELA, PDF…)
  if (word === word.toUpperCase()) return true;
  return false;
}

function addNoOverlap(list: Issue[], issue: Issue) {
  for (const ex of list) {
    if (issue.start < ex.end && issue.end > ex.start) return; // overlaps existing
  }
  list.push(issue);
}

/** Lightweight grammar rules. Conservative to avoid interrupting the writer. */
function grammarIssues(text: string): Issue[] {
  const out: Issue[] = [];

  // Repeated words: "the the", "is is"
  const repeat = /\b([A-Za-z]+)(\s+)(\1)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = repeat.exec(text))) {
    const start = m.index + m[1].length + m[2].length;
    out.push({
      start,
      end: start + m[3].length,
      type: "grammar",
      text: m[3],
      suggestions: ["(remove duplicate)"],
      message: `Repeated word “${m[1]}”`,
    });
  }

  // Standalone lowercase "i" → "I"
  const loneI = /(^|[^A-Za-z'’])(i)(?=[^A-Za-z'’]|$)/g;
  while ((m = loneI.exec(text))) {
    const start = m.index + m[1].length;
    out.push({
      start,
      end: start + 1,
      type: "grammar",
      text: "i",
      suggestions: ["I"],
      message: "“I” should be capitalized",
    });
  }

  // a / an agreement (only flag clear mismatches)
  const article = /\b(a|an)(\s+)([A-Za-z]+)/gi;
  while ((m = article.exec(text))) {
    const art = m[1];
    const next = m[3];
    const lowerArt = art.toLowerCase();
    const startsVowel = VOWEL_RE.test(next);
    const startsCons = CONSONANT_RE.test(next);
    let fixed: string | null = null;
    if (lowerArt === "a" && startsVowel) fixed = "an";
    else if (lowerArt === "an" && startsCons) fixed = "a";
    if (fixed) {
      // preserve capitalization of the article
      const cased = art[0] === art[0].toUpperCase()
        ? fixed[0].toUpperCase() + fixed.slice(1)
        : fixed;
      out.push({
        start: m.index,
        end: m.index + art.length,
        type: "grammar",
        text: art,
        suggestions: [cased],
        message: `Use “${cased}” before “${next}”`,
      });
    }
  }

  // Capitalize first letter of a sentence
  const sentence = /(^|[.!?]\s+)([a-z])/g;
  while ((m = sentence.exec(text))) {
    const start = m.index + m[1].length;
    out.push({
      start,
      end: start + 1,
      type: "grammar",
      text: m[2],
      suggestions: [m[2].toUpperCase()],
      message: "Capitalize the start of the sentence",
    });
  }

  return out;
}

/** Check text and return non-overlapping issues sorted by position. */
export async function checkText(text: string): Promise<Issue[]> {
  if (!text || !text.trim()) return [];
  const sp = await ensureSpeller();

  const issues: Issue[] = [];

  // Spelling first (higher priority for overlap resolution).
  if (sp) {
    let m: RegExpExecArray | null;
    WORD_RE.lastIndex = 0;
    while ((m = WORD_RE.exec(text))) {
      const word = m[0];
      if (skipSpelling(word)) continue;
      const normalized = word.replace(/[’]/g, "'");
      if (sp.correct(normalized)) continue;
      const suggestions = sp.suggest(normalized).slice(0, 3);
      issues.push({
        start: m.index,
        end: m.index + word.length,
        type: "spelling",
        text: word,
        suggestions,
        message: suggestions.length ? "Possible spelling mistake" : "Unknown word",
      });
    }
  }

  // Grammar, skipping anything overlapping a spelling issue.
  const merged = [...issues];
  for (const g of grammarIssues(text)) addNoOverlap(merged, g);

  merged.sort((a, b) => a.start - b.start);
  return merged;
}
