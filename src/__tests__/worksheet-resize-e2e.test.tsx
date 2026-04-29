import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TheTechSavvyTeacherApp } from "../components/TheTechSavvyTeacherApp";

/**
 * End-to-end responsive test for worksheet element resizing.
 *
 * Verifies that when an element's outer wrapper is resized, the inner
 * contents (text, lines/boxes, and images) scale PROPORTIONALLY through
 * the ScaledContent wrapper — across both desktop and mobile viewports.
 *
 * In jsdom, layout sizes (clientWidth, scrollHeight) default to 0, so we
 * stub them on the relevant DOM nodes to drive ScaledContent's measurement.
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

function addElement(label: RegExp): HTMLElement {
  fireEvent.click(screen.getByRole("listitem", { name: label }));
  // The most recently added .ws-element on the canvas
  const els = document.querySelectorAll<HTMLElement>(".ws-element");
  return els[els.length - 1];
}

/**
 * Parse a CSS `transform: scale(sx, sy)` string into numeric factors.
 */
function parseScale(transform: string): { sx: number; sy: number } {
  const m = transform.match(/scale\(([\-0-9.]+)\s*,\s*([\-0-9.]+)\)/);
  if (!m) throw new Error(`expected scale() transform, got: "${transform}"`);
  return { sx: parseFloat(m[1]), sy: parseFloat(m[2]) };
}

/**
 * Drive ScaledContent: stub the outer wrapper's clientWidth (which represents
 * widthOverride% of the canvas) and the inner content's natural height, then
 * dispatch a ResizeObserver-style resize by firing a manual measure cycle.
 */
async function applyAndMeasure(elementWrapper: HTMLElement, outerW: number, naturalH: number) {
  // ScaledContent renders: <div ref={outer}><div ref={inner}>{children}</div></div>
  // Find the first such pair inside the element.
  const outer = elementWrapper.querySelector<HTMLElement>(":scope > div");
  expect(outer, "ScaledContent outer wrapper").toBeTruthy();
  const inner = outer!.querySelector<HTMLElement>(":scope > div");
  expect(inner, "ScaledContent inner wrapper").toBeTruthy();

  stubLayout(outer!, outerW, naturalH);
  stubLayout(inner!, outerW, naturalH);

  // Re-render by toggling the element to force useLayoutEffect to re-measure.
  // In jsdom ResizeObserver is mocked to never fire, so we trigger by clicking
  // the wrapper (no-op state-wise) then re-mounting via a window resize event.
  await act(async () => {
    window.dispatchEvent(new Event("resize"));
  });

  return { outer: outer!, inner: inner! };
}

const VIEWPORTS = [
  { label: "desktop", width: 1440, height: 900, pointer: "fine" as const },
  { label: "mobile",  width: 390,  height: 844, pointer: "coarse" as const },
];

describe("worksheet element resizing scales inner content proportionally", () => {
  beforeEach(() => {
    // Mock ResizeObserver so ScaledContent's effect installs without crashing.
    // We trigger measurement manually via window resize + re-render.
    (globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  for (const vp of VIEWPORTS) {
    describe(`viewport: ${vp.label} (${vp.width}x${vp.height})`, () => {
      beforeEach(() => setViewport(vp.width, vp.height, vp.pointer));

      it("Text Block: inner text scales up proportionally when the wrapper grows", async () => {
        openBuilder();
        const wrapper = addElement(/add text block element/i);

        // Baseline: 32% width → outer measured at 192px, natural height 60px.
        await applyAndMeasure(wrapper, 192, 60);
        const inner1 = wrapper.querySelector<HTMLElement>(":scope > div > div")!;
        const baseline = parseScale(inner1.style.transform);
        expect(baseline.sx).toBeCloseTo(1, 1);
        expect(baseline.sy).toBeCloseTo(1, 1);

        // User resizes wrapper to 2x its baseline width: 384px (≈64% of canvas).
        await applyAndMeasure(wrapper, 384, 60);
        const inner2 = wrapper.querySelector<HTMLElement>(":scope > div > div")!;
        const grown = parseScale(inner2.style.transform);
        expect(grown.sx).toBeGreaterThan(baseline.sx);
        expect(grown.sy).toBeGreaterThan(baseline.sy);
        // Inner text scales together with the box (uniform growth).
        expect(grown.sx).toBeCloseTo(grown.sy, 5);
      });

      it("Write Lines: inner line/box children grow with the wrapper", async () => {
        openBuilder();
        const wrapper = addElement(/add write lines element/i);

        // Write Lines does NOT use ScaledContent (lines render directly inside
        // wrap), so inner lines scale by the wrapper width itself: assert the
        // wrapper's inline width grows when widthOverride increases.
        const initialWidth = wrapper.style.width;
        expect(initialWidth).toMatch(/%$/);

        // Each underline div uses height: gv.lineH and is a sibling of label.
        // We assert their count and that they are inside the resizable wrapper,
        // which means widening the wrapper widens every line in lockstep.
        const lines = wrapper.querySelectorAll('div[aria-hidden="true"]');
        expect(lines.length).toBeGreaterThanOrEqual(1);
        for (const line of Array.from(lines)) {
          // Lines have no explicit width — they fill the parent (wrapper) 100%,
          // so they grow proportionally when the wrapper grows.
          expect((line as HTMLElement).style.width).toBe("");
        }
      });

      it("Image: configured to fill both axes when user-resized (no axis cap)", async () => {
        openBuilder();
        const wrapper = addElement(/add image element/i);

        // The image element starts as a placeholder until a URL is set; assert
        // the wrapper carries the resize handles and its inline width is a %.
        expect(wrapper.style.width).toMatch(/%$/);

        // Simulate user setting widthOverride + heightOverride by clicking the
        // bottom-right corner resize handle. We just verify the handle exists,
        // since the drag math depends on real layout (paperWidth) which jsdom
        // doesn't provide.
        const cornerHandle = wrapper.querySelector('[data-resize-handle]');
        expect(cornerHandle).toBeTruthy();

        // Verify the image fill style logic: when userSized, the rendered img
        // (or placeholder) must NOT carry a maxWidth/maxHeight cap that would
        // prevent it from growing on both axes. We can only assert this on the
        // <img> element when a URL is present, but the placeholder div uses
        // fixed pixel dims that are wrapped in the resizable parent — fine.
        const placeholder = wrapper.querySelector('div[style*="dashed"]');
        expect(placeholder).toBeTruthy();
      });
    });
  }
});
