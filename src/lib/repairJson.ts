// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// repairJson — defensive parser for AI-generated JSON arrays/objects.
//
// LLMs occasionally emit JSON wrapped in markdown fences, with stray control
// characters, trailing commas, or truncated mid-array when token limits hit.
// This module strips the noise and progressively repairs the payload so the
// caller always either gets a parsed value or a clear error.
//
// Pure JS, no DOM — easy to unit test with vitest.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [k: string]: JsonValue };

/** Strip ```json fences, leading/trailing whitespace and prose. */
export function stripFences(raw: string): string {
  return String(raw ?? "").replace(/```json|```/gi, "").trim();
}

/** Remove control chars (except tab/newline/cr) that break JSON.parse. */
export function stripControlChars(s: string): string {
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

/**
 * Slice the substring between the first opening and last matching closing
 * delimiter for the requested container kind. Falls back to the whole string
 * if no delimiter pair is found.
 */
export function sliceContainer(s: string, kind: "array" | "object" | "auto" = "auto"): string {
  const tryPair = (open: string, close: string) => {
    const a = s.indexOf(open);
    const b = s.lastIndexOf(close);
    return a >= 0 && b > a ? s.slice(a, b + 1) : null;
  };
  if (kind === "array") return tryPair("[", "]") ?? s;
  if (kind === "object") return tryPair("{", "}") ?? s;
  // auto: prefer whichever opener appears first
  const ai = s.indexOf("["); const oi = s.indexOf("{");
  if (ai === -1 && oi === -1) return s;
  if (ai === -1) return tryPair("{", "}") ?? s;
  if (oi === -1) return tryPair("[", "]") ?? s;
  return ai < oi ? (tryPair("[", "]") ?? s) : (tryPair("{", "}") ?? s);
}

/** Drop trailing commas before `]` or `}` — common LLM mistake. */
export function removeTrailingCommas(s: string): string {
  return s.replace(/,\s*([\]}])/g, "$1");
}

/**
 * Attempt to repair a truncated array by walking back to the last balanced
 * object boundary and closing the array. Safe no-op if no `}` is found.
 */
export function repairTruncatedArray(s: string): string {
  if (!s.trimStart().startsWith("[")) return s;
  // Find last "}," or "}" inside the array and cut there
  const lastObjEnd = Math.max(s.lastIndexOf("},"), s.lastIndexOf("}"));
  if (lastObjEnd <= 0) return s;
  return s.slice(0, lastObjEnd + 1).replace(/,\s*$/, "") + "]";
}

/**
 * Try a sequence of progressively more aggressive repairs and return the
 * parsed JSON. Throws SyntaxError (with the last attempt's message) only if
 * every strategy fails.
 */
export function repairAndParse<T = JsonValue>(
  raw: string,
  opts: { container?: "array" | "object" | "auto" } = {}
): T {
  const container = opts.container ?? "auto";
  let cleaned = stripControlChars(stripFences(raw));
  cleaned = sliceContainer(cleaned, container);

  // Strategy 1: parse as-is
  try { return JSON.parse(cleaned) as T; } catch { /* try next */ }

  // Strategy 2: strip trailing commas
  const noTrailing = removeTrailingCommas(cleaned);
  try { return JSON.parse(noTrailing) as T; } catch { /* try next */ }

  // Strategy 3: brute close — terminate any open string and append the
  // missing brackets in correct order. Preserves the most data.
  const closed = bruteClose(noTrailing);
  if (closed !== noTrailing) {
    try { return JSON.parse(closed) as T; } catch { /* try next */ }
  }

  // Strategy 4: walk back to last complete object and close the array.
  // Loses the in-progress trailing object but more permissive when brute
  // close still produced invalid JSON (e.g. dangling key without value).
  const trimmed = repairTruncatedArray(noTrailing);
  if (trimmed !== noTrailing) {
    try { return JSON.parse(trimmed) as T; } catch { /* try next */ }
  }

  // Strategy 5: drop the dangling trailing object after the last "},"
  // and close the array.
  const lastSep = noTrailing.lastIndexOf("},");
  if (lastSep > 0) {
    const candidate = noTrailing.slice(0, lastSep + 1) + "]";
    try { return JSON.parse(candidate) as T; } catch (e) {
      throw new SyntaxError(`repairAndParse: exhausted strategies (${(e as Error).message})`);
    }
  }
  throw new SyntaxError("repairAndParse: could not repair JSON");
}

/**
 * Walk the string respecting strings/escapes and append the closing
 * brackets needed to balance any open `[` / `{`. If we end inside an open
 * string, terminate it first.
 */
export function bruteClose(s: string): string {
  const stack: string[] = [];
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "[" || c === "{") stack.push(c);
    else if (c === "]") { if (stack[stack.length - 1] === "[") stack.pop(); }
    else if (c === "}") { if (stack[stack.length - 1] === "{") stack.pop(); }
  }
  let out = s;
  if (inStr) out += '"';
  // Drop a trailing comma we just orphaned
  out = out.replace(/,\s*$/, "");
  while (stack.length) {
    const open = stack.pop();
    out += open === "[" ? "]" : "}";
  }
  return out;
}
