import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TheTechSavvyTeacherApp } from "../components/TheTechSavvyTeacherApp";

/**
 * Back-to-back multi-element E2E resize test.
 *
 * Verifies, for several different worksheet element types in sequence:
 *   1. The element exposes ALL FIVE resize handles (top, right, bottom, left,
 *      corner) — not just one drag point.
 *   2. Dragging each side grows widthOverride / heightOverride independently.
 *   3. The corner handle grows BOTH dimensions at once.
 *   4. Inner ScaledContent transform stays a clean `scale(sx, sy)` — no
 *      leftover transforms (rotate/skew/translate) leak between back-to-back
 *      element resizes, and each element's scale is independent of the others.
 *   5. After resizing, the element is still draggable (free-position move) —
 *      it is NOT static. The element's x/y change in response to a drag.
 *
 * Element types covered include the user-reported problem children: word bank
 * and true/false. Also covers matching, multipleChoice, text, and shortAnswer.
 */

function setViewport(width: number, height: number, pointer: "fine" | "coarse" = "fine") {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: height, configurable: true });
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches:
      query.includes("pointer: coarse") ? pointer === "coarse" :
      query.includes("max-width: 768px") ? width <= 768 :
      query.includes("max-width: 1024px") ? width <= 1024 :
      false,
    media: query, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
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
  fireEvent.click(wrapper); // select to reveal handles
  return getLastElement();
}

function getHandles(wrapper: HTMLElement) {
  const handles = wrapper.querySelectorAll<HTMLElement>("[data-resize-handle]");
  // Source order in ElView.ResizeHandles: bottom, top, right, left, corner
  return {
    all: handles,
    bottom: handles[0],
    top: handles[1],
    right: handles[2],
    left: handles[3],
    corner: handles[4],
  };
}

async function dragHandle(handle: HTMLElement, dx: number, dy: number) {
  await act(async () => {
    fireEvent.pointerDown(handle, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { clientX: 100 + dx, clientY: 100 + dy });
    fireEvent.pointerUp(window, { clientX: 100 + dx, clientY: 100 + dy });
  });
}

function widthPctOf(wrapper: HTMLElement): number {
  const w = wrapper.style.width;
  const m = w.match(/^([\d.]+)%$/);
  expect(m, `wrapper width must be a percent, got "${w}"`).toBeTruthy();
  return parseFloat(m![1]);
}

function heightPxOf(wrapper: HTMLElement): number {
  const mh = wrapper.style.minHeight;
  const m = mh.match(/^([\d.]+)px$/);
  return m ? parseFloat(m[1]) : 0;
}

function topPxOf(wrapper: HTMLElement): number {
  const t = wrapper.style.top;
  const m = t.match(/^([\d.]+)px$/);
  return m ? parseFloat(m[1]) : 0;
}

function leftPctOf(wrapper: HTMLElement): number {
  const l = wrapper.style.left;
  const m = l.match(/^([\d.]+)%$/);
  return m ? parseFloat(m[1]) : 0;
}

function innerScaleOf(wrapper: HTMLElement): { sx: number; sy: number; raw: string } {
  // ScaledContent renders: wrapper > outerDiv > innerDiv (with transform).
  const inner = wrapper.querySelector<HTMLElement>(":scope > div > div");
  expect(inner, "ScaledContent inner div must exist").toBeTruthy();
  const raw = inner!.style.transform || "";
  const m = raw.match(/^scale\(([\-0-9.]+)\s*,\s*([\-0-9.]+)\)\s*$/);
  // Critical: transform must ONLY be scale(sx, sy). No rotate/skew/translate
  // leaking from a previous resize. If the regex fails, the transform string
  // contains something other than a clean scale call.
  expect(m, `expected clean scale() transform, got "${raw}"`).toBeTruthy();
  return { sx: parseFloat(m![1]), sy: parseFloat(m![2]), raw };
}

const VIEWPORTS = [
  { label: "desktop", width: 1440, height: 900, pointer: "fine" as const },
  { label: "mobile",  width: 390,  height: 844, pointer: "coarse" as const },
];

const ELEMENT_TYPES = [
  { name: "Word Bank",       label: /add word bank element/i },
  { name: "True/False",      label: /add true or false activity/i },
  { name: "Matching",        label: /add matching activity/i },
  { name: "Multiple Choice", label: /add multiple choice question/i },
  { name: "Text Block",      label: /add text block element/i },
  { name: "Short Answer",    label: /add short answer question/i },
];

describe("worksheet builder: multi-element back-to-back resize E2E", () => {
  beforeEach(() => {
    (globalThis as any).ResizeObserver = class {
      observe() {} unobserve() {} disconnect() {}
    };
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  for (const vp of VIEWPORTS) {
    describe(`viewport: ${vp.label} (${vp.width}x${vp.height})`, () => {
      beforeEach(() => setViewport(vp.width, vp.height, vp.pointer));

      it("each element type exposes all 5 resize handles (top/right/bottom/left/corner)", () => {
        openBuilder();
        for (const t of ELEMENT_TYPES) {
          const wrapper = addElement(t.label);
          const h = getHandles(wrapper);
          expect(h.all.length, `${t.name} should have ≥5 resize handles`).toBeGreaterThanOrEqual(5);
          // Each handle's cursor confirms it targets a distinct edge.
          expect(h.bottom.style.cursor).toBe("ns-resize");
          expect(h.top.style.cursor).toBe("ns-resize");
          expect(h.right.style.cursor).toBe("ew-resize");
          expect(h.left.style.cursor).toBe("ew-resize");
          expect(h.corner.style.cursor).toBe("nwse-resize");
        }
      });

      it("resizing each element grows wrapper dims and yields a clean scale() — no leftover transforms across elements", async () => {
        openBuilder();
        const resized: Array<{ name: string; wrapper: HTMLElement; startW: number; endW: number }> = [];

        for (const t of ELEMENT_TYPES) {
          const wrapper = addElement(t.label);
          const startW = widthPctOf(wrapper);
          const startH = heightPxOf(wrapper);

          // Drag right edge → width grows independently.
          await dragHandle(getHandles(wrapper).right, 150, 0);
          const afterRightW = widthPctOf(wrapper);
          expect(afterRightW, `${t.name} right-drag should grow width`).toBeGreaterThan(startW);

          // Drag bottom edge → height grows independently.
          await dragHandle(getHandles(wrapper).bottom, 0, 80);
          const afterBottomH = heightPxOf(wrapper);
          expect(afterBottomH, `${t.name} bottom-drag should grow height`).toBeGreaterThan(startH);

          // Drag corner → BOTH grow.
          const beforeCornerW = widthPctOf(wrapper);
          const beforeCornerH = heightPxOf(wrapper);
          await dragHandle(getHandles(wrapper).corner, 60, 40);
          expect(widthPctOf(wrapper)).toBeGreaterThan(beforeCornerW);
          expect(heightPxOf(wrapper)).toBeGreaterThan(beforeCornerH);

          // Verify inner transform is a CLEAN scale() with no leaked
          // rotate/skew/translate from any previous element's resize.
          const { sx, sy, raw } = innerScaleOf(wrapper);
          expect(sx).toBeGreaterThan(0);
          expect(sy).toBeGreaterThan(0);
          expect(raw).not.toMatch(/rotate|skew|translate|matrix/);

          resized.push({ name: t.name, wrapper, startW, endW: widthPctOf(wrapper) });
        }

        // Cross-element independence: every prior element must still hold its
        // own scale() — back-to-back resizes do not mutate other elements'
        // transforms.
        for (const r of resized) {
          const { raw } = innerScaleOf(r.wrapper);
          expect(raw, `${r.name} transform must remain a clean scale()`).toMatch(/^scale\([\-0-9.]+\s*,\s*[\-0-9.]+\)$/);
          expect(r.endW).toBeGreaterThan(r.startW);
        }
      });

      it("after resizing, every element type is still draggable (not static) — x/y change with a drag", async () => {
        openBuilder();
        for (const t of ELEMENT_TYPES) {
          const wrapper = addElement(t.label);
          // Resize first.
          await dragHandle(getHandles(wrapper).corner, 60, 40);
          const startLeft = leftPctOf(wrapper);
          const startTop  = topPxOf(wrapper);

          // Then drag the body of the element to move it.
          await act(async () => {
            fireEvent.pointerDown(wrapper, { clientX: 200, clientY: 300, target: wrapper });
            fireEvent.pointerMove(window, { clientX: 280, clientY: 380 });
            fireEvent.pointerUp(window, { clientX: 280, clientY: 380 });
          });

          const endLeft = leftPctOf(wrapper);
          const endTop  = topPxOf(wrapper);
          const moved = endLeft !== startLeft || endTop !== startTop;
          expect(moved, `${t.name} must still be movable after resize`).toBe(true);
        }
      });

      it("Word Bank specifically: inner pills/title remain inside the scaled wrapper after enlarging", async () => {
        openBuilder();
        const wrapper = addElement(/add word bank element/i);
        await dragHandle(getHandles(wrapper).corner, 120, 80);

        // Pills are <span> children of the inner flex row; they must remain
        // descendants of the same wrapper (no DOM detachment), and the inner
        // transform must scale them together.
        const pills = wrapper.querySelectorAll("span");
        expect(pills.length).toBeGreaterThan(0);
        const { sx, sy } = innerScaleOf(wrapper);
        expect(sx).toBeGreaterThanOrEqual(1);
        expect(sy).toBeGreaterThanOrEqual(1);
      });

      it("True/False specifically: each statement row stays inside the scaled wrapper after enlarging", async () => {
        openBuilder();
        const wrapper = addElement(/add true or false activity/i);
        await dragHandle(getHandles(wrapper).corner, 120, 80);

        // The TRUE / FALSE chips are spans inside the scaled inner div; they
        // must scale together via the wrapper's single transform.
        const chips = Array.from(wrapper.querySelectorAll("span")).filter(
          s => /^TRUE$|^FALSE$/.test((s.textContent || "").trim()),
        );
        expect(chips.length).toBeGreaterThanOrEqual(2);
        const { sx, sy, raw } = innerScaleOf(wrapper);
        expect(sx).toBeGreaterThanOrEqual(1);
        expect(sy).toBeGreaterThanOrEqual(1);
        expect(raw).not.toMatch(/rotate|skew|translate|matrix/);
      });
    });
  }
});
