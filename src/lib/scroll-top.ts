// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Scroll-to-top visibility logic
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
// Extracted into its own module so the visibility rules can be unit-tested
// without mounting the entire app component. The rules:
//
//   - Only ever shown on coarse-pointer (touch) devices.
//   - Only shown while the worksheet tool is active.
//   - Becomes visible when EITHER the worksheet canvas OR the page body
//     has been scrolled past `threshold` pixels (default 280).
//   - Hides again as soon as both scroll positions return below threshold.
//
// The functions are pure (no React, no DOM lookups by id) — callers pass
// in the current scroll values and environment flags. This makes them
// trivial to test deterministically.

export const SCROLL_TOP_THRESHOLD = 280;

export interface ScrollTopVisibilityInput {
  /** Active tool id from the app shell. */
  activeTool: string;
  /** True when the user is on a touch device (coarse pointer). */
  isCoarsePointer: boolean;
  /** Current scrollTop of the worksheet canvas, or 0 if not present. */
  canvasScrollTop: number;
  /** Current window.scrollY (or document.documentElement.scrollTop). */
  windowScrollTop: number;
  /** Pixel threshold; defaults to SCROLL_TOP_THRESHOLD. */
  threshold?: number;
}

/**
 * Pure decision: should the floating "scroll to top" FAB be visible?
 */
export function shouldShowScrollTop(input: ScrollTopVisibilityInput): boolean {
  const { activeTool, isCoarsePointer, canvasScrollTop, windowScrollTop } = input;
  const threshold = input.threshold ?? SCROLL_TOP_THRESHOLD;

  if (!isCoarsePointer) return false;
  if (activeTool !== "worksheet") return false;

  const maxScroll = Math.max(canvasScrollTop || 0, windowScrollTop || 0);
  return maxScroll > threshold;
}

/**
 * Smoothly scroll both the worksheet canvas (if any) and the window back
 * to the top. Safe to call when one or both are already at 0.
 */
export function scrollEverythingToTop(opts?: {
  canvas?: { scrollTop: number; scrollTo: (o: ScrollToOptions) => void } | null;
  win?: { scrollY: number; scrollTo: (o: ScrollToOptions) => void };
}): void {
  const canvas =
    opts?.canvas ??
    (typeof document !== "undefined"
      ? (document.getElementById("worksheet-canvas") as unknown as
          | { scrollTop: number; scrollTo: (o: ScrollToOptions) => void }
          | null)
      : null);
  const win =
    opts?.win ??
    (typeof window !== "undefined"
      ? (window as unknown as { scrollY: number; scrollTo: (o: ScrollToOptions) => void })
      : undefined);

  if (canvas && canvas.scrollTop > 0) {
    canvas.scrollTo({ top: 0, behavior: "smooth" });
  }
  if (win && (win.scrollY || 0) > 0) {
    win.scrollTo({ top: 0, behavior: "smooth" });
  }
}
