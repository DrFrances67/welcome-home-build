// Automated integrity validation for the multi-state learning-standards datasets.
//
// This module is the single source of truth for:
//   1. Schema-shape validation (Subject → Grade band → Standard[] of {code, desc}).
//   2. Per-state count guards (regression protection — counts may grow, never silently shrink).
//   3. Code normalization rules (trimmed, no double spaces, no empties).
//   4. Duplicate detection (within a state, and against incoming PDF-sourced batches).
//
// It is exercised by `src/__tests__/standards-validation.test.ts` (runs in `bun run test`,
// which gates CI before build/deploy) and by `scripts/validate-standards.ts` /
// `scripts/check-standards-dedup.ts` for ad-hoc runs while integrating new sources.
import { z } from "zod";
import type { Standard, NyStandards } from "./ny-standards";
import type { StateCode } from "./state-standards";
import { STATES, STATE_STANDARDS } from "./state-standards";

// ── Schema shape ──────────────────────────────────────────────────────────
export const standardSchema = z
  .object({
    code: z.string().min(1, "code must be a non-empty string"),
    desc: z.string().min(1, "desc must be a non-empty string"),
  })
  .strict();

export const stateStandardsSchema = z.record(
  z.string(), // subject
  z.record(
    z.string(), // grade band
    z.array(standardSchema).min(1, "grade band must contain at least one standard"),
  ),
);

// ── Count guards ────────────────────────────────────────────────────────────
// Baseline totals captured from the loaded datasets. Validation requires the
// live count to be >= the baseline so an accidental truncation (bad parse,
// dropped subject) fails the build, while legitimate additions still pass.
export const EXPECTED_MIN_COUNTS: Record<StateCode, number> = {
  CT: 922,
  NJ: 2902,
  NY: 868,
  PA: 2748,
};

// ── Code normalization ──────────────────────────────────────────────────────
/** Canonical form of a standards code: trimmed, internal whitespace collapsed to single spaces. */
export function normalizeCode(code: string): string {
  return code.replace(/\s+/g, " ").trim();
}

/** A code is normalized when it already equals its canonical form and is non-empty. */
export function isNormalizedCode(code: string): boolean {
  return typeof code === "string" && code.length > 0 && normalizeCode(code) === code;
}

/** Stable identity for a standard within a state (same code may exist across subjects). */
export function standardKey(subject: string, code: string): string {
  return `${subject}::${normalizeCode(code)}`;
}

// ── Issue reporting ─────────────────────────────────────────────────────────
export type IssueLevel = "error" | "warning";

export interface ValidationIssue {
  state: string;
  level: IssueLevel;
  message: string;
  subject?: string;
  band?: string;
  code?: string;
}

export interface StateCountSummary {
  state: string;
  subjects: number;
  bands: number;
  total: number;
  expectedMin: number;
}

// ── Per-state validation ────────────────────────────────────────────────────
export function validateStateStandards(state: string, subjects: NyStandards): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // 1. Schema shape.
  const parsed = stateStandardsSchema.safeParse(subjects);
  if (!parsed.success) {
    for (const err of parsed.error.issues) {
      issues.push({
        state,
        level: "error",
        message: `schema: ${err.message} at ${err.path.join(" → ") || "(root)"}`,
      });
    }
  }

  // 2. Count guard.
  const summary = summarizeState(state, subjects);
  if (summary.total < summary.expectedMin) {
    issues.push({
      state,
      level: "error",
      message: `count regression: ${summary.total} standards < expected minimum ${summary.expectedMin}`,
    });
  }

  // 3. Normalization + 4. duplicates.
  const seen = new Map<string, { subject: string; band: string }>();
  for (const [subject, byBand] of Object.entries(subjects)) {
    for (const [band, arr] of Object.entries(byBand)) {
      for (const std of arr) {
        if (!isNormalizedCode(std.code)) {
          issues.push({
            state,
            subject,
            band,
            code: std.code,
            level: "error",
            message: `non-normalized code (expected "${normalizeCode(std.code ?? "")}")`,
          });
        }
        if (typeof std.desc !== "string" || std.desc.trim() === "") {
          issues.push({
            state,
            subject,
            band,
            code: std.code,
            level: "error",
            message: "empty or missing description",
          });
        }
        const key = standardKey(subject, std.code ?? "");
        const prev = seen.get(key);
        if (prev) {
          issues.push({
            state,
            subject,
            band,
            code: std.code,
            level: "error",
            message: `duplicate standard "${std.code}" in subject "${subject}" (also in band "${prev.band}")`,
          });
        } else {
          seen.set(key, { subject, band });
        }
      }
    }
  }

  return issues;
}

export function summarizeState(state: string, subjects: NyStandards): StateCountSummary {
  let bands = 0;
  let total = 0;
  for (const byBand of Object.values(subjects)) {
    for (const arr of Object.values(byBand)) {
      bands++;
      total += arr.length;
    }
  }
  return {
    state,
    subjects: Object.keys(subjects).length,
    bands,
    total,
    expectedMin: EXPECTED_MIN_COUNTS[state as StateCode] ?? 0,
  };
}

/** Validate every registered state. Returns a flat list of issues (empty = healthy). */
export function validateAllStandards(): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const { code } of STATES) {
    issues.push(...validateStateStandards(code, STATE_STANDARDS[code]));
  }
  return issues;
}

export function summarizeAllStandards(): StateCountSummary[] {
  return STATES.map(({ code }) => summarizeState(code, STATE_STANDARDS[code]));
}

// ── Deduplication for new PDF-sourced batches ───────────────────────────────
export interface DedupResult {
  /** Standards safe to integrate (normalized, not already present, unique within the batch). */
  unique: Standard[];
  /** Incoming standards whose code already exists for the subject in the current dataset. */
  duplicatesOfExisting: Array<{ standard: Standard; existingBand: string }>;
  /** Incoming standards that repeat an earlier code within the same incoming batch. */
  duplicatesInBatch: Standard[];
  /** Incoming standards whose code was not in canonical form (auto-normalized in `unique`). */
  normalized: Array<{ original: string; normalized: string }>;
}

/**
 * Detect duplicates BEFORE merging a freshly parsed PDF batch into a state's dataset.
 *
 * Compares an incoming `Standard[]` for one subject against the existing standards for
 * that subject across all grade bands, and against itself. Codes are compared in
 * normalized form so whitespace artifacts from PDF extraction never sneak duplicates in.
 */
export function dedupeIncomingStandards(
  subjects: NyStandards,
  subject: string,
  incoming: Standard[],
): DedupResult {
  const existing = new Map<string, string>(); // normalizedCode -> band
  for (const [band, arr] of Object.entries(subjects[subject] ?? {})) {
    for (const std of arr) existing.set(normalizeCode(std.code), band);
  }

  const result: DedupResult = {
    unique: [],
    duplicatesOfExisting: [],
    duplicatesInBatch: [],
    normalized: [],
  };
  const seenInBatch = new Set<string>();

  for (const std of incoming) {
    const canonical = normalizeCode(std.code);
    if (canonical !== std.code) {
      result.normalized.push({ original: std.code, normalized: canonical });
    }
    if (existing.has(canonical)) {
      result.duplicatesOfExisting.push({ standard: std, existingBand: existing.get(canonical)! });
      continue;
    }
    if (seenInBatch.has(canonical)) {
      result.duplicatesInBatch.push(std);
      continue;
    }
    seenInBatch.add(canonical);
    result.unique.push({ code: canonical, desc: std.desc });
  }

  return result;
}

export function formatIssues(issues: ValidationIssue[]): string {
  return issues
    .map((i) => {
      const loc = [i.state, i.subject, i.band, i.code].filter(Boolean).join(" / ");
      return `[${i.level.toUpperCase()}] ${loc}: ${i.message}`;
    })
    .join("\n");
}
