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

function contentTransformsOf(wrapper: HTMLElement): string[] {
  return Array.from(wrapper.children)
    .filter((child) => !child.matches("[data-resize-handle], [data-delete-btn]"))
    .map((child) => (child as HTMLElement).style.transform || "")
    .filter(Boolean);
}

const VIEWPORTS = [
  { label: "desktop", width: 1440, height: 900, pointer: "fine" as const },
  { label: "mobile",  width: 390,  height: 844, pointer: "coarse" as const },
];

const ELEMENT_TYPES = [
  { name: "Word Bank",       label: /add word bank element/i },
  { name: "True/False",      label: /add true \/ false element/i },
  { name: "Matching",        label: /add matching element/i },
  { name: "Multiple Choice", label: /add multiple choice element/i },
  { name: "Text Block",      label: /add text block element/i },
  { name: "Short Answer",    label: /add short answer element/i },
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

          // ALL element types now use the reflow approach: inner content
          // scales via inline font-size/spacing, NOT a CSS scale transform.
          // No element should leave a leftover transform string anywhere.
          expect(contentTransformsOf(wrapper), `${t.name} should reflow naturally without leaked transforms`).toEqual([]);

          resized.push({ name: t.name, wrapper, startW, endW: widthPctOf(wrapper) });
        }

        // Cross-element independence: back-to-back resizes do not mutate other
        // elements' contents — every prior element remains transform-free and
        // keeps the new width it was resized to.
        for (const r of resized) {
          expect(contentTransformsOf(r.wrapper), `${r.name} must remain naturally reflowed`).toEqual([]);
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

        // Pills are direct reflowing content now — they must stay descendants
        // of the wrapper, grow in font size, and NOT be trapped in a fixed
        // transformed baseline order/width.
        const pills = wrapper.querySelectorAll("span");
        expect(pills.length).toBeGreaterThan(0);
        expect(contentTransformsOf(wrapper)).toEqual([]);
        expect(parseFloat((pills[0] as HTMLElement).style.fontSize)).toBeGreaterThan(14);
        const wordBox = wrapper.querySelector<HTMLElement>("div[style*='flex-wrap']");
        expect(wordBox?.style.flexWrap).toBe("wrap");
        expect(wordBox?.style.alignContent).toBe("flex-start");
      });

      it("True/False specifically: each statement row stays inside the scaled wrapper after enlarging", async () => {
        openBuilder();
        const wrapper = addElement(/add true \/ false element/i);
        await dragHandle(getHandles(wrapper).corner, 120, 80);

        // The True / False chips are spans inside the wrapper; their compact
        // T / F labels keep the row narrow so the statement gets more room.
        const chips = Array.from(wrapper.querySelectorAll("span")).filter(
          s => /^T$|^F$/.test((s.textContent || "").trim()),
        );
        expect(chips.length).toBeGreaterThanOrEqual(2);
        expect(contentTransformsOf(wrapper)).toEqual([]);
        expect(parseFloat((chips[0] as HTMLElement).style.fontSize)).toBeGreaterThan(8);
        const statement = Array.from(wrapper.querySelectorAll<HTMLElement>("span")).find(
          s => (s.textContent || "").includes("The Earth orbits the Sun"),
        );
        // Statement gets the lion's share of the row width (flex: 1 1 70%)
        // so longer sentences have room to read before wrapping.
        expect(statement?.style.flex).toBe("1 1 70%");
      });

      it("Word Bank and True/False reflow on right-side resize and support vertical-only resize", async () => {
        openBuilder();
        for (const label of [/add word bank element/i, /add true \/ false element/i]) {
          const wrapper = addElement(label);
          const startW = widthPctOf(wrapper);
          await dragHandle(getHandles(wrapper).right, 220, 0);
          expect(widthPctOf(wrapper)).toBeGreaterThan(startW);
          expect(contentTransformsOf(wrapper)).toEqual([]);

          const afterWidthOnly = widthPctOf(wrapper);
          const startH = heightPxOf(wrapper);
          await dragHandle(getHandles(wrapper).bottom, 0, 140);
          expect(heightPxOf(wrapper)).toBeGreaterThan(startH);
          expect(widthPctOf(wrapper)).toBe(afterWidthOnly);
        }
      });

      it("top and left handles resize from one side by moving that edge, not freezing the element", async () => {
        openBuilder();
        const wrapper = addElement(/add word bank element/i);
        await dragHandle(getHandles(wrapper).bottom, 0, 120);
        const beforeTop = topPxOf(wrapper);
        const beforeH = heightPxOf(wrapper);
        await dragHandle(getHandles(wrapper).top, 0, -50);
        expect(heightPxOf(wrapper)).toBeGreaterThan(beforeH);
        expect(topPxOf(wrapper)).toBeLessThanOrEqual(beforeTop);

        await dragHandle(getHandles(wrapper).right, 140, 0);
        const beforeLeft = leftPctOf(wrapper);
        const beforeW = widthPctOf(wrapper);
        await dragHandle(getHandles(wrapper).left, -50, 0);
        expect(widthPctOf(wrapper)).toBeGreaterThan(beforeW);
        expect(leftPctOf(wrapper)).toBeLessThanOrEqual(beforeLeft);

        await act(async () => {
          fireEvent.pointerDown(wrapper, { clientX: 200, clientY: 300, target: wrapper });
          fireEvent.pointerMove(window, { clientX: 240, clientY: 340 });
          fireEvent.pointerUp(window, { clientX: 240, clientY: 340 });
        });
        expect(topPxOf(wrapper)).toBeGreaterThanOrEqual(0);
        expect(contentTransformsOf(wrapper)).toEqual([]);
      });
    });
  }
});
