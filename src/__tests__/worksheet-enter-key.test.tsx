import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TheTechSavvyTeacherApp } from "../components/TheTechSavvyTeacherApp";

function setViewport(width: number, height: number, pointer: "fine" | "coarse" = "fine") {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: height, configurable: true });
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches:
      query.includes("pointer: coarse") ? pointer === "coarse" :
      query.includes("max-width: 768px") ? width <= 768 :
      query.includes("max-width: 1024px") ? width <= 1024 :
      false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function openBuilder() {
  render(<TheTechSavvyTeacherApp />);
  fireEvent.click(screen.getByRole("tab", { name: /worksheet builder/i }));
}

function addElement(label: RegExp) {
  const btn = screen.getByRole("listitem", { name: label });
  fireEvent.click(btn);
}

/**
 * Simulate a user typing existing content, erasing it, and pressing Enter
 * to add a new line. We do this by setting the textarea value through
 * fireEvent.change (mirrors what the browser commits after each keystroke)
 * and then asserting the trailing newline is preserved so the next item
 * can be typed on a fresh row.
 */
function simulateClearAndEnter(textarea: HTMLTextAreaElement) {
  // user erases everything
  fireEvent.change(textarea, { target: { value: "" } });
  expect(textarea.value).toBe("");

  // user types one item
  fireEvent.change(textarea, { target: { value: "first" } });
  expect(textarea.value).toBe("first");

  // user hits Enter — value now ends with a newline
  fireEvent.change(textarea, { target: { value: "first\n" } });
  // CRITICAL: the trailing newline must survive the controlled-input round-trip.
  // Previously, .filter(Boolean).join("\n") stripped the empty trailing line
  // and Enter appeared to "do nothing".
  expect(textarea.value).toBe("first\n");

  // user types the second item on the new line
  fireEvent.change(textarea, { target: { value: "first\nsecond" } });
  expect(textarea.value).toBe("first\nsecond");

  // user hits Enter again to start a third item
  fireEvent.change(textarea, { target: { value: "first\nsecond\n" } });
  expect(textarea.value).toBe("first\nsecond\n");

  fireEvent.change(textarea, { target: { value: "first\nsecond\nthird" } });
  expect(textarea.value.split("\n")).toEqual(["first", "second", "third"]);
}

const cases: Array<{ name: string; addLabel: RegExp; fields: RegExp[] }> = [
  { name: "Matching",        addLabel: /add matching element/i,        fields: [/left column items/i, /right column items/i] },
  { name: "Multiple Choice", addLabel: /add multiple choice element/i, fields: [/answer choices/i] },
  { name: "True / False",    addLabel: /add true \/ false element/i,   fields: [/true\/false statements/i] },
  { name: "Table / Chart",   addLabel: /add table \/ chart element/i,  fields: [/column headers/i] },
];

describe("Enter key adds new lines in worksheet editors (desktop)", () => {
  beforeEach(() => setViewport(1440, 900));
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  for (const c of cases) {
    it(`${c.name}: pressing Enter after clearing creates additional lines`, () => {
      openBuilder();
      addElement(c.addLabel);

      for (const fieldLabel of c.fields) {
        const textarea = screen.getByLabelText(fieldLabel) as HTMLTextAreaElement;
        simulateClearAndEnter(textarea);
      }
    });
  }
});

describe("Enter key adds new lines in worksheet editors (mobile)", () => {
  beforeEach(() => setViewport(390, 844, "coarse"));
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  for (const c of cases) {
    it(`${c.name} (mobile): pressing Enter after clearing creates additional lines`, () => {
      openBuilder();
      addElement(c.addLabel);

      for (const fieldLabel of c.fields) {
        const textarea = screen.getByLabelText(fieldLabel) as HTMLTextAreaElement;
        simulateClearAndEnter(textarea);
      }
    });
  }
});
