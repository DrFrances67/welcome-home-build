import { describe, it, expect } from "vitest";
import {
  ensureGiftedDifferentiation,
  buildGiftedFallbackText,
} from "../lib/giftedFallback";

describe("ensureGiftedDifferentiation — regression guard", () => {
  it("does not throw when Gifted & Advanced is NOT selected and gifted is empty", () => {
    const parsed: any = { differentiation: { ell: "ELL notes" } };
    const form = { topic: "Photosynthesis", diff: ["ELL / Language Learners"] };
    expect(() => ensureGiftedDifferentiation(parsed, form)).not.toThrow();
    expect(parsed.differentiation.gifted).toContain("Photosynthesis");
  });

  it("does not throw when form.diff is undefined", () => {
    const parsed: any = {};
    expect(() =>
      ensureGiftedDifferentiation(parsed, { topic: "Fractions" } as any),
    ).not.toThrow();
    expect(parsed.differentiation.gifted).toContain("Fractions");
  });

  it("does not throw when differentiation object is missing entirely", () => {
    const parsed: any = { topic: "Newton's Laws" };
    expect(() => ensureGiftedDifferentiation(parsed, { diff: [] })).not.toThrow();
    expect(typeof parsed.differentiation.gifted).toBe("string");
    expect(parsed.differentiation.gifted.length).toBeGreaterThan(120);
  });

  it("preserves an existing substantive gifted entry when Gifted is not selected", () => {
    const existing = "x".repeat(200);
    const parsed: any = { differentiation: { gifted: existing } };
    ensureGiftedDifferentiation(parsed, { diff: ["ELL / Language Learners"] });
    expect(parsed.differentiation.gifted).toBe(existing);
  });

  it("replaces a too-thin gifted entry when multiple groups are selected (even without Gifted)", () => {
    const parsed: any = { differentiation: { gifted: "tbd" } };
    ensureGiftedDifferentiation(parsed, {
      topic: "Ecosystems",
      diff: ["ELL / Language Learners", "Students with IEPs"],
    });
    expect(parsed.differentiation.gifted).toContain("Ecosystems");
    expect(parsed.differentiation.gifted.length).toBeGreaterThan(120);
  });

  it("falls back to a generic topic when none is provided", () => {
    const parsed: any = {};
    ensureGiftedDifferentiation(parsed, {});
    expect(parsed.differentiation.gifted).toContain("the lesson topic");
  });

  it("buildGiftedFallbackText always returns a non-empty string", () => {
    expect(buildGiftedFallbackText("Algebra").length).toBeGreaterThan(120);
  });
});
