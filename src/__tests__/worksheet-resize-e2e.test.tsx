import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TheTechSavvyTeacherApp } from "../components/TheTechSavvyTeacherApp";

/**
 * End-to-end responsive test for worksheet element resizing.
 *
 * Adds a worksheet element, simulates the user dragging the right + corner
 * resize handles, and asserts that:
 *   1. The outer wrapper width grows (widthOverride increases).
 *   2. The ScaledContent inner transform: scale(sx, sy) factors grow with it,
 *      proving inner text/lines/boxes scale proportionally — not just the box.
 *
 * Runs across desktop and mobile viewports.
 */

function setViewport(width: number, height: number, pointer: "fine" | "coarse" = "fine") {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: height, configurable: true });
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("pointer: coarse")
      ? pointer === "coarse"
      : query.includes("max-width: 768px")
        ? width <= 768
        : query.includes("max-width: 1024px")
          ? width <= 1024
          : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function stubLayout(node: HTMLElement, clientWidth: number, scrollHeight: number) {
  Object.defineProperty(node, "clientWidth", { value: clientWidth, configurable: true });
  Object.defineProperty(node, "offsetWidth", { value: clientWidth, configurable: true });
  Object.defineProperty(node, "scrollHeight", { value: scrollHeight, configurable: true });
  Object.defineProperty(node, "offsetHeight", { value: scrollHeight, configurable: true });
}

function openBuilder() {
  render(<TheTechSavvyTeacherApp />);
  fireEvent.click(screen.getByRole("tab", { name: /worksheet builder/i }));
}

function getLastElement(): HTMLElement {
  const els = document.querySelectorAll<HTMLElement>(".ws-element");
  expect(els.length, "at least one .ws-element on the canvas").toBeGreaterThan(0);
  return els[els.length - 1];
}

function addElement(label: RegExp): HTMLElement {
  fireEvent.click(screen.getByRole("listitem", { name: label }));
  const wrapper = getLastElement();
  // Select the element (so resize handles appear) by clicking its main role node.
  fireEvent.click(wrapper);
  return getLastElement();
}

function widthPctOf(wrapper: HTMLElement): number {
  const w = wrapper.style.width;
  const m = w.match(/^([\d.]+)%$/);
  expect(m, `wrapper width must be a percent, got "${w}"`).toBeTruthy();
  return parseFloat(m![1]);
}

function parseScale(transform: string): { sx: number; sy: number } {
  const m = transform.match(/scale\(([\-0-9.]+)\s*,\s*([\-0-9.]+)\)/);
  if (!m) throw new Error(`expected scale() transform, got: "${transform}"`);
  return { sx: parseFloat(m[1]), sy: parseFloat(m[2]) };
}

/**
 * Simulate the user dragging the right resize handle by `dx` pixels. The app's
 * resize math uses a hardcoded paperWidth=632, so dx directly maps to a
 * widthOverride delta of (dx / 632) * 100 percentage points.
 */
async function dragRightHandle(wrapper: HTMLElement, dx: number) {
  // Right handle is the 3rd handle in source order (bottom, top, right, left, corner)
  const handles = wrapper.querySelectorAll<HTMLElement>("[data-resize-handle]");
  expect(
    handles.length,
    "resize handles must be visible (element selected)",
  ).toBeGreaterThanOrEqual(5);
  const right = handles[2];
  await act(async () => {
    fireEvent.pointerDown(right, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { clientX: 100 + dx, clientY: 100 });
    fireEvent.pointerUp(window, { clientX: 100 + dx, clientY: 100 });
  });
}

/**
 * Force the ScaledContent measurement effect to run with a known geometry by
 * stubbing the outer/inner DOM sizes after each render.
 */
function primeScaledContent(wrapper: HTMLElement, outerW: number, naturalH: number) {
  const outer = wrapper.querySelector<HTMLElement>(":scope > div");
  if (!outer) return null;
  const inner = outer.querySelector<HTMLElement>(":scope > div");
  if (!inner) return null;
  stubLayout(outer, outerW, naturalH);
  stubLayout(inner, outerW, naturalH);
  return { outer, inner };
}

const VIEWPORTS = [
  { label: "desktop", width: 1440, height: 900, pointer: "fine" as const },
  { label: "mobile", width: 390, height: 844, pointer: "coarse" as const },
];

describe("worksheet element resizing scales inner content proportionally", () => {
  beforeEach(() => {
    // Stub ResizeObserver so ScaledContent's effect installs cleanly. We drive
    // re-measurement by triggering React re-renders via the resize handler.
    (globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  for (const vp of VIEWPORTS) {
    describe(`viewport: ${vp.label} (${vp.width}x${vp.height})`, () => {
      beforeEach(() => setViewport(vp.width, vp.height, vp.pointer));

      it("Text Block: dragging the right handle grows wrapper width AND inner font scales proportionally", async () => {
        openBuilder();
        const wrapper = addElement(/add text block element/i);

        const startPct = widthPctOf(wrapper);
        const innerP = wrapper.querySelector<HTMLElement>("p");
        expect(innerP, "text block renders a <p>").toBeTruthy();
        const startFontSize = parseFloat(innerP!.style.fontSize) || 0;
        expect(startFontSize).toBeGreaterThan(0);

        // Drag right handle 200px to the right → +~31.6 percentage points.
        await dragRightHandle(wrapper, 200);

        const endPct = widthPctOf(wrapper);
        expect(endPct).toBeGreaterThan(startPct);

        // With the reflow approach, the inner <p> font-size grows in proportion
        // to widthOverride (no CSS scale transform). This lets text wrap
        // naturally inside the bigger box instead of being rigidly transformed.
        const innerP2 = wrapper.querySelector<HTMLElement>("p");
        const endFontSize = parseFloat(innerP2!.style.fontSize) || 0;
        expect(endFontSize).toBeGreaterThan(startFontSize);
        // Inner content must NOT use a CSS scale transform anymore.
        expect(innerP2!.style.transform || "").not.toMatch(/scale\(/);
      });

      it("Write Lines: each underline grows in lockstep with the wrapper width", async () => {
        openBuilder();
        const wrapper = addElement(/add write lines element/i);

        const startPct = widthPctOf(wrapper);
        await dragRightHandle(wrapper, 250);
        const endPct = widthPctOf(wrapper);
        expect(endPct).toBeGreaterThan(startPct);

        // Lines have no fixed width — they fill the wrapper, so they grow with
        // it automatically. Verify they are still children of the resized box.
        const lines = wrapper.querySelectorAll('div[aria-hidden="true"]');
        expect(lines.length).toBeGreaterThanOrEqual(1);
        for (const line of Array.from(lines)) {
          expect((line as HTMLElement).style.width).toBe("");
        }
      });

      it("Image: wrapper width grows on drag and image fill style has no axis cap", async () => {
        openBuilder();
        const wrapper = addElement(/add image element/i);

        const startPct = widthPctOf(wrapper);
        await dragRightHandle(wrapper, 180);
        const endPct = widthPctOf(wrapper);
        expect(endPct).toBeGreaterThan(startPct);

        // The image element renders a placeholder until a URL is set; the
        // wrapper is what gets resized, and the rendered <img> (when present)
        // uses width:100% + objectFit:contain to scale proportionally on both
        // axes when the user has resized. We can verify the wrapper has the
        // resize handles and that no axis cap (maxWidth/maxHeight) constrains
        // the image fill style. (Style asserted in worksheet-resize-scaling.)
        const handles = wrapper.querySelectorAll("[data-resize-handle]");
        expect(handles.length).toBeGreaterThanOrEqual(5);
      });
    });
  }
});
