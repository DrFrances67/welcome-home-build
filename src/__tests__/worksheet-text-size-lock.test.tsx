import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TheTechSavvyTeacherApp } from "../components/TheTechSavvyTeacherApp";

/**
 * Per-element font-size lock.
 *
 * When the user picks a Text Size preset (or a custom pt value) in the
 * worksheet builder edit panel, the chosen size becomes the FINAL rendered
 * pt and must NOT be multiplied by the resize scale when the user resizes
 * the box. Box paddings/spacing still scale; only the text stays put.
 *
 * When no preset is chosen ("Auto"), the legacy behavior is preserved:
 * resizing scales text along with the box.
 */

beforeEach(() => {
  (globalThis as any).ResizeObserver = class { observe(){} unobserve(){} disconnect(){} };
  Object.defineProperty(window, "innerWidth",  { value: 1440, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: 900,  configurable: true });
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: false, media: q, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function openBuilder() {
  render(<TheTechSavvyTeacherApp />);
  fireEvent.click(screen.getByRole("tab", { name: /worksheet builder/i }));
}

function lastEl(): HTMLElement {
  const els = document.querySelectorAll<HTMLElement>(".ws-element");
  expect(els.length).toBeGreaterThan(0);
  return els[els.length - 1];
}

function addAndSelect(label: RegExp): HTMLElement {
  fireEvent.click(screen.getByRole("listitem", { name: label }));
  const w = lastEl();
  fireEvent.click(w);
  return lastEl();
}

function getHandles(w: HTMLElement) {
  const h = w.querySelectorAll<HTMLElement>("[data-resize-handle]");
  return { bottom: h[0], top: h[1], right: h[2], left: h[3], corner: h[4] };
}

async function dragHandle(handle: HTMLElement, dx: number, dy: number) {
  await act(async () => {
    fireEvent.pointerDown(handle, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { clientX: 100 + dx, clientY: 100 + dy });
    fireEvent.pointerUp(window, { clientX: 100 + dx, clientY: 100 + dy });
  });
}

// Pick a representative inner text node's fontSize. We look for the most
// content-bearing <p> or <span> inside the wrapper and read its inline
// fontSize style.
function primaryFs(wrapper: HTMLElement): number {
  const candidates = Array.from(wrapper.querySelectorAll<HTMLElement>("p, span, div"))
    .filter(n => n.style && n.style.fontSize)
    .filter(n => !n.matches("[data-resize-handle], [data-delete-btn], [data-reset-btn]"));
  expect(candidates.length, "expected at least one element with inline fontSize").toBeGreaterThan(0);
  // Take the largest font-size on the element — this is the "primary" text
  // (titles/questions); secondary captions/notes use Math.max(fs - n, m).
  const sizes = candidates.map(n => parseFloat(n.style.fontSize)).filter(n => Number.isFinite(n));
  return Math.max(...sizes);
}

function setTextSizePreset(label: string) {
  const btn = screen.getByRole("button", { name: new RegExp(`Set text size ${label}`, "i") });
  fireEvent.click(btn);
}

const TYPES = [
  { name: "Text Block",      label: /add text block element/i, presetPt: 22 },  // L → 18, XL → 22
  { name: "Word Bank",       label: /add word bank element/i,  presetPt: 22 },
  { name: "True/False",      label: /add true \/ false element/i, presetPt: 22 },
  { name: "Multiple Choice", label: /add multiple choice element/i, presetPt: 22 },
  { name: "Short Answer",    label: /add short answer element/i, presetPt: 22 },
];

describe("worksheet builder: per-element text-size lock", () => {
  for (const t of TYPES) {
    it(`${t.name}: resizing the box does NOT change the locked preset font size`, async () => {
      openBuilder();
      const wrapper = addAndSelect(t.label);

      // Lock to XL (22pt) via the preset button in the edit panel.
      setTextSizePreset("XL");

      const fsBefore = primaryFs(wrapper);
      // Should be exactly 22 (no scale multiplier applied).
      expect(fsBefore).toBeCloseTo(22, 2);

      // Resize the box larger horizontally + vertically.
      await dragHandle(getHandles(wrapper).corner, 250, 200);

      const fsAfter = primaryFs(wrapper);
      // Locked → font size stays at 22pt regardless of resize.
      expect(fsAfter, `${t.name}: locked text size must not change after resize`).toBeCloseTo(22, 2);
      expect(fsAfter).toBe(fsBefore);
    });
  }

  it("Auto mode (no preset): resizing DOES scale text — preserves legacy behavior", async () => {
    openBuilder();
    const wrapper = addAndSelect(/add text block element/i);
    // Do not set any preset → fontSizeOverride remains null → tScale = sc.s.
    const fsBefore = primaryFs(wrapper);
    await dragHandle(getHandles(wrapper).corner, 250, 200);
    const fsAfter = primaryFs(wrapper);
    expect(fsAfter, "auto-mode text should grow with the box").toBeGreaterThan(fsBefore);
  });

  it("Switching from a preset back to Auto re-enables resize scaling", async () => {
    openBuilder();
    const wrapper = addAndSelect(/add text block element/i);
    setTextSizePreset("L");
    const lockedFs = primaryFs(wrapper);
    expect(lockedFs).toBeCloseTo(18, 2);

    await dragHandle(getHandles(wrapper).corner, 250, 200);
    expect(primaryFs(wrapper)).toBeCloseTo(18, 2);

    // Click "Auto" to clear the override.
    fireEvent.click(screen.getByRole("button", { name: /Use grade-default text size/i }));
    // Now the same big box should make text bigger than the locked 18pt.
    expect(primaryFs(wrapper)).toBeGreaterThan(18);
  });
});
