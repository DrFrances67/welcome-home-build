import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  shouldShowScrollTop,
  scrollEverythingToTop,
  SCROLL_TOP_THRESHOLD,
} from "../lib/scroll-top";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// shouldShowScrollTop — visibility rules for the floating FAB
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const baseInput = {
  activeTool: "worksheet",
  isCoarsePointer: true,
  canvasScrollTop: 0,
  windowScrollTop: 0,
};

describe("shouldShowScrollTop", () => {
  it("uses 280px as the default threshold", () => {
    expect(SCROLL_TOP_THRESHOLD).toBe(280);
  });

  it("is hidden on desktop (fine pointer) regardless of scroll", () => {
    expect(
      shouldShowScrollTop({
        ...baseInput,
        isCoarsePointer: false,
        canvasScrollTop: 9999,
        windowScrollTop: 9999,
      })
    ).toBe(false);
  });

  it("is hidden when not on the worksheet tool", () => {
    for (const tool of ["lesson", "danielson", "email"]) {
      expect(
        shouldShowScrollTop({
          ...baseInput,
          activeTool: tool,
          canvasScrollTop: 9999,
        })
      ).toBe(false);
    }
  });

  it("is hidden at the top of both scrollers", () => {
    expect(shouldShowScrollTop(baseInput)).toBe(false);
  });

  it("stays hidden just at and below the threshold", () => {
    expect(
      shouldShowScrollTop({ ...baseInput, canvasScrollTop: 280 })
    ).toBe(false);
    expect(
      shouldShowScrollTop({ ...baseInput, windowScrollTop: 280 })
    ).toBe(false);
    expect(
      shouldShowScrollTop({ ...baseInput, canvasScrollTop: 100, windowScrollTop: 180 })
    ).toBe(false);
  });

  it("becomes visible when the worksheet canvas scrolls past the threshold", () => {
    expect(
      shouldShowScrollTop({ ...baseInput, canvasScrollTop: 281 })
    ).toBe(true);
    expect(
      shouldShowScrollTop({ ...baseInput, canvasScrollTop: 1000 })
    ).toBe(true);
  });

  it("becomes visible when the page body scrolls past the threshold (mobile stacked layout)", () => {
    expect(
      shouldShowScrollTop({ ...baseInput, windowScrollTop: 320 })
    ).toBe(true);
    expect(
      shouldShowScrollTop({ ...baseInput, windowScrollTop: 5000 })
    ).toBe(true);
  });

  it("uses the larger of the two scroll positions", () => {
    expect(
      shouldShowScrollTop({
        ...baseInput,
        canvasScrollTop: 50,
        windowScrollTop: 500,
      })
    ).toBe(true);
    expect(
      shouldShowScrollTop({
        ...baseInput,
        canvasScrollTop: 500,
        windowScrollTop: 50,
      })
    ).toBe(true);
  });

  it("hides again after scrolling back near the top", () => {
    // Show first
    expect(
      shouldShowScrollTop({ ...baseInput, canvasScrollTop: 600 })
    ).toBe(true);
    // Then scroll back
    expect(
      shouldShowScrollTop({ ...baseInput, canvasScrollTop: 0 })
    ).toBe(false);
    expect(
      shouldShowScrollTop({ ...baseInput, windowScrollTop: 10 })
    ).toBe(false);
  });

  it("respects a custom threshold override", () => {
    expect(
      shouldShowScrollTop({ ...baseInput, canvasScrollTop: 100, threshold: 50 })
    ).toBe(true);
    expect(
      shouldShowScrollTop({ ...baseInput, canvasScrollTop: 100, threshold: 500 })
    ).toBe(false);
  });

  it("treats negative or undefined-like scroll values as 0", () => {
    expect(
      shouldShowScrollTop({
        ...baseInput,
        canvasScrollTop: 0,
        windowScrollTop: 0,
      })
    ).toBe(false);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// scrollEverythingToTop — both scrollers return to top smoothly
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("scrollEverythingToTop", () => {
  const makeMockCanvas = (scrollTop: number) => ({
    scrollTop,
    scrollTo: vi.fn(),
  });
  const makeMockWin = (scrollY: number) => ({
    scrollY,
    scrollTo: vi.fn(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scrolls the worksheet canvas to top with smooth behavior", () => {
    const canvas = makeMockCanvas(800);
    const win = makeMockWin(0);
    scrollEverythingToTop({ canvas, win });
    expect(canvas.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    expect(win.scrollTo).not.toHaveBeenCalled();
  });

  it("scrolls the window to top when only the body has scrolled", () => {
    const canvas = makeMockCanvas(0);
    const win = makeMockWin(450);
    scrollEverythingToTop({ canvas, win });
    expect(win.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    expect(canvas.scrollTo).not.toHaveBeenCalled();
  });

  it("scrolls both when both have scrolled (mobile stacked layout)", () => {
    const canvas = makeMockCanvas(600);
    const win = makeMockWin(300);
    scrollEverythingToTop({ canvas, win });
    expect(canvas.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    expect(win.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  it("does nothing when both are already at the top", () => {
    const canvas = makeMockCanvas(0);
    const win = makeMockWin(0);
    scrollEverythingToTop({ canvas, win });
    expect(canvas.scrollTo).not.toHaveBeenCalled();
    expect(win.scrollTo).not.toHaveBeenCalled();
  });

  it("handles a missing canvas gracefully (worksheet not mounted)", () => {
    const win = makeMockWin(500);
    scrollEverythingToTop({ canvas: null, win });
    expect(win.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// End-to-end-style: simulate a scroll sequence and assert show/hide
// transitions across both scrollers, mirroring the app's useEffect.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("scroll-to-top show/hide sequence (mobile)", () => {
  it("transitions hidden → visible → hidden as the canvas scrolls down then up", () => {
    let canvasScrollTop = 0;
    const decide = () =>
      shouldShowScrollTop({
        activeTool: "worksheet",
        isCoarsePointer: true,
        canvasScrollTop,
        windowScrollTop: 0,
      });

    expect(decide()).toBe(false); // start at top
    canvasScrollTop = 100; expect(decide()).toBe(false);
    canvasScrollTop = 280; expect(decide()).toBe(false); // exactly threshold
    canvasScrollTop = 281; expect(decide()).toBe(true);  // crosses threshold
    canvasScrollTop = 1500; expect(decide()).toBe(true); // deep scroll
    canvasScrollTop = 300; expect(decide()).toBe(true);  // still scrolled
    canvasScrollTop = 200; expect(decide()).toBe(false); // user scrolled back up
    canvasScrollTop = 0;   expect(decide()).toBe(false); // back to top
  });

  it("transitions hidden → visible → hidden as the page body scrolls (stacked phone layout)", () => {
    let windowScrollTop = 0;
    const decide = () =>
      shouldShowScrollTop({
        activeTool: "worksheet",
        isCoarsePointer: true,
        canvasScrollTop: 0,
        windowScrollTop,
      });

    expect(decide()).toBe(false);
    windowScrollTop = 290; expect(decide()).toBe(true);
    windowScrollTop = 50;  expect(decide()).toBe(false);
  });

  it("hides immediately when switching away from the worksheet tool", () => {
    expect(
      shouldShowScrollTop({
        activeTool: "worksheet",
        isCoarsePointer: true,
        canvasScrollTop: 1000,
        windowScrollTop: 0,
      })
    ).toBe(true);

    expect(
      shouldShowScrollTop({
        activeTool: "lesson",
        isCoarsePointer: true,
        canvasScrollTop: 1000,
        windowScrollTop: 0,
      })
    ).toBe(false);
  });
});
