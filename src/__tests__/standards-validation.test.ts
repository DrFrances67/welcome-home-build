// Gates build/deploy via `bun run test` (CI). Fails if any state's standards
// dataset breaks schema shape, drops below its baseline count, contains a
// non-normalized code, or contains duplicate standards.
import { describe, it, expect } from "vitest";
import { STATES, STATE_STANDARDS } from "@/data/state-standards";
import {
  validateStateStandards,
  summarizeState,
  EXPECTED_MIN_COUNTS,
  normalizeCode,
  isNormalizedCode,
  dedupeIncomingStandards,
  formatIssues,
} from "@/data/standards-validation";

describe("state standards integrity", () => {
  for (const { code, name } of STATES) {
    it(`${name} (${code}) passes schema, count, normalization, and dedup checks`, () => {
      const issues = validateStateStandards(code, STATE_STANDARDS[code]);
      if (issues.length) {
        // Surface readable details when the assertion fails.
        throw new Error(`\n${formatIssues(issues)}`);
      }
      expect(issues).toEqual([]);
    });

    it(`${name} (${code}) meets its baseline standard count`, () => {
      const summary = summarizeState(code, STATE_STANDARDS[code]);
      expect(summary.total).toBeGreaterThanOrEqual(EXPECTED_MIN_COUNTS[code]);
    });
  }
});

describe("code normalization helpers", () => {
  it("collapses whitespace and trims", () => {
    expect(normalizeCode("  PGD. 2 ")).toBe("PGD. 2");
    expect(normalizeCode("6.1.2.GeoSV.1")).toBe("6.1.2.GeoSV.1");
    expect(normalizeCode("K.CC.A.1\n")).toBe("K.CC.A.1");
  });

  it("flags non-normalized codes", () => {
    expect(isNormalizedCode("K.CC.A.1")).toBe(true);
    expect(isNormalizedCode(" K.CC.A.1")).toBe(false);
    expect(isNormalizedCode("K.CC.A.  1")).toBe(false);
    expect(isNormalizedCode("")).toBe(false);
  });
});

describe("dedupeIncomingStandards (new PDF source integration)", () => {
  const dataset = {
    ELA: {
      Kindergarten: [{ code: "RL.K.1", desc: "Existing one" }],
      "Grade 1": [{ code: "RL.1.1", desc: "Existing two" }],
    },
  };

  it("detects duplicates against the existing dataset (any band)", () => {
    const res = dedupeIncomingStandards(dataset, "ELA", [
      { code: "RL.K.1", desc: "dup" },
      { code: "RL.K.2", desc: "new" },
    ]);
    expect(res.unique.map((s) => s.code)).toEqual(["RL.K.2"]);
    expect(res.duplicatesOfExisting).toHaveLength(1);
    expect(res.duplicatesOfExisting[0].existingBand).toBe("Kindergarten");
  });

  it("detects duplicates within the incoming batch and normalizes codes", () => {
    const res = dedupeIncomingStandards(dataset, "ELA", [
      { code: " RL.K.3 ", desc: "new normalized" },
      { code: "RL.K.3", desc: "repeat in batch" },
    ]);
    expect(res.unique.map((s) => s.code)).toEqual(["RL.K.3"]);
    expect(res.duplicatesInBatch).toHaveLength(1);
    expect(res.normalized).toHaveLength(1);
  });
});
