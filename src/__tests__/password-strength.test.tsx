import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

afterEach(() => cleanup());
import React from "react";
import {
  PasswordStrength,
  PasswordRequirements,
  getPasswordRequirements,
  scorePassword,
  strengthExplanation,
} from "../components/AuthPage";

// Sample passwords engineered to land on each strength level.
const samples: Record<string, string> = {
  "Very weak": "aaaa",                  // 4 chars, one class, repeating triple penalty
  Weak: "abcdefghij",                   // 10 chars, one class
  Fair: "Abcdefghij",                   // 10 chars, two classes -> classes>=3? no, score=1 only
  Good: "Abcdef1!xy",                   // 10 chars, all 4 classes -> len>=10(1)+classes>=3(1)+? len<12 so no 4th, score=2 -> Fair actually
  Strong: "Abcdefghij1!XY",             // 14+, all 4 classes
};

// Verify our test fixtures actually map to the labels we expect; if any drift,
// the test below will surface a clear failure rather than testing the wrong
// thing silently.
describe("scorePassword sample fixtures", () => {
  it("each label has at least one password producing it", () => {
    const cases: Array<[string, string]> = [
      ["Very weak", "aaaa"],
      ["Weak", "abcdefghij"],
      ["Fair", "Abcdef1!xy"],     // score 2
      ["Good", "Abcdef1!xyzQ"],   // 12 chars, all 4 classes -> score 3
      ["Strong", "Abcdefghij1!XY"], // 14+, all 4 classes -> score 4
    ];
    for (const [label, pw] of cases) {
      expect(scorePassword(pw).label, `pw="${pw}"`).toBe(label);
    }
  });
});

describe("PasswordStrength tooltip", () => {
  const cases: Array<[string, string]> = [
    ["Very weak", "aaaa"],
    ["Weak", "abcdefghij"],
    ["Fair", "Abcdef1!xy"],
    ["Good", "Abcdef1!xyzQ"],
    ["Strong", "Abcdefghij1!XY"],
  ];

  it.each(cases)("shows explanation tooltip for %s", (label, pw) => {
    render(<PasswordStrength password={pw} />);
    const tip = screen.getByTestId("pw-strength-tooltip");
    // title attribute = the explanation text used by native tooltips
    expect(tip.getAttribute("title")).toBe(strengthExplanation(label));
    expect(tip.getAttribute("aria-label")).toBe(`What does ${label} mean?`);
    // visible explanation text near the bar
    expect(screen.getByTestId("pw-strength-explanation").textContent).toBe(
      strengthExplanation(label),
    );
    // visible label
    expect(screen.getByText(`Password strength: ${label}`)).toBeTruthy();
  });

  it("tooltip badge is keyboard-accessible (focusable)", () => {
    render(<PasswordStrength password="Abcdef1!xyzQ" />);
    const tip = screen.getByTestId("pw-strength-tooltip");
    // tabIndex 0 means keyboard reachable
    expect(tip.getAttribute("tabindex")).toBe("0");
    (tip as HTMLElement).focus();
    expect(document.activeElement).toBe(tip);
  });
});

describe("PasswordRequirements live checklist", () => {
  it("marks every requirement as unmet for empty input", () => {
    const reqs = getPasswordRequirements("");
    for (const r of reqs) {
      expect(r.met, r.id).toBe(false);
    }
  });

  it("updates met flags as the password gains character classes", () => {
    expect(getPasswordRequirements("abc").find((r) => r.id === "lower")!.met).toBe(true);
    expect(getPasswordRequirements("abc").find((r) => r.id === "upper")!.met).toBe(false);
    const all = getPasswordRequirements("Abcdef1!xyzQ");
    expect(all.find((r) => r.id === "lower")!.met).toBe(true);
    expect(all.find((r) => r.id === "upper")!.met).toBe(true);
    expect(all.find((r) => r.id === "number")!.met).toBe(true);
    expect(all.find((r) => r.id === "symbol")!.met).toBe(true);
    expect(all.find((r) => r.id === "len10")!.met).toBe(true);
    expect(all.find((r) => r.id === "len12")!.met).toBe(true);
  });

  it("highlights neededForGood for unmet items while score < Good", () => {
    const reqs = getPasswordRequirements("abcdefghij"); // Weak
    const lengthItem = reqs.find((r) => r.id === "len12")!;
    const upperItem = reqs.find((r) => r.id === "upper")!;
    expect(lengthItem.met).toBe(false);
    expect(lengthItem.neededForGood).toBe(true);
    expect(upperItem.neededForGood).toBe(true);
  });

  it("clears neededForGood once Good or better is reached", () => {
    const reqs = getPasswordRequirements("Abcdef1!xyzQ"); // Good
    for (const r of reqs) {
      expect(r.neededForGood, r.id).toBe(false);
    }
  });

  it("renders the checklist with met / needed states reflected in the DOM", () => {
    const { rerender } = render(<PasswordRequirements password="abcdefghij" />);
    // unmet + needed for Good
    const upper = screen.getByTestId("pw-req-upper");
    expect(upper.getAttribute("data-met")).toBe("false");
    expect(upper.getAttribute("data-needed")).toBe("true");
    expect(screen.getAllByText(/needed for Good/i).length).toBeGreaterThan(0);

    // After updating to a Good password, the highlights disappear.
    rerender(<PasswordRequirements password="Abcdef1!xyzQ" />);
    expect(screen.getByTestId("pw-req-upper").getAttribute("data-met")).toBe("true");
    expect(screen.getByTestId("pw-req-upper").getAttribute("data-needed")).toBe("false");
    expect(screen.queryAllByText(/needed for Good/i).length).toBe(0);
    expect(screen.getByTestId("pw-requirements").textContent).toMatch(/Good or better/);
  });

  it("has an accessible label and is announced as a live region", () => {
    render(<PasswordRequirements password="abc" />);
    const region = screen.getByTestId("pw-requirements");
    expect(region.getAttribute("aria-label")).toBe("Password requirements");
    expect(region.getAttribute("aria-live")).toBe("polite");
  });
});
