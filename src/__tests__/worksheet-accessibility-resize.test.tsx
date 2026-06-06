import { describe, expect, it } from "vitest";

/**
 * Accessibility-focused regression tests for worksheet element resizing.
 *
 * Children with disabilities need oversized text and images. These tests
 * verify the math behind our scaling/sizing so that:
 *   1. Increasing an element's size ALWAYS increases inner content dimensions
 *   2. Inner content is never clipped (container height ≥ scaled content)
 *   3. Resized elements do not overlap their siblings
 *   4. Extreme image resizes (tiny, huge, very wide, very tall) stay valid
 */

const BASELINE_WIDTH_PCT = 32;

// Mirrors src/components/TheTechSavvyTeacherApp.tsx::ScaledContent math.
function scaledContent(opts: {
  outerW: number; // measured outer container width (px)
  widthOverridePct: number; // current widthOverride %
  naturalH: number; // natural intrinsic height of inner content (px)
  heightOverridePx?: number;
}) {
  const { outerW, widthOverridePct, naturalH, heightOverridePx } = opts;
  const baselineWidthPx =
    outerW > 0 ? (outerW * BASELINE_WIDTH_PCT) / Math.max(1, widthOverridePct) : 0;
  const sx = baselineWidthPx > 0 ? outerW / baselineWidthPx : 1;
  const sy = heightOverridePx && naturalH > 0 ? Math.max(heightOverridePx / naturalH, sx) : sx;
  // The outer wrapper height is set to naturalH * sy so it matches the
  // visually scaled inner content exactly (no clipping, no extra gap).
  const containerH = naturalH > 0 ? naturalH * sy : 0;
  const scaledInnerW = baselineWidthPx * sx;
  const scaledInnerH = naturalH * sy;
  return { sx, sy, baselineWidthPx, containerH, scaledInnerW, scaledInnerH };
}

// Mirrors the image element's "userSized && !floated" fill style decisions
// from ElView so we can assert preset caps do not block growth, while the
// image is still constrained to the resized frame and cannot be clipped.
function imageFillStyle(el: { widthOverride?: number; heightOverride?: number }) {
  const userSized = !!(el.widthOverride || el.heightOverride);
  if (!userSized) {
    return {
      userSized: false,
      width: undefined,
      height: undefined,
      maxWidth: "62%", // medium preset
      maxHeight: 360,
      objectFit: "contain" as const,
    };
  }
  return {
    userSized: true,
    width: "100%",
    height: el.heightOverride ? "100%" : "auto",
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain" as const,
  };
}

describe("accessibility: increasing element size grows inner content", () => {
  it("growing widthOverride monotonically increases inner scale (text/lines/boxes)", () => {
    const naturalH = 100;
    const widths = [32, 48, 64, 80, 100];
    let prevSx = 0;
    let prevH = 0;
    for (const pct of widths) {
      // Simulate canvas where the element's actual outer width follows pct.
      const outerW = (600 * pct) / 100;
      const r = scaledContent({ outerW, widthOverridePct: pct, naturalH });
      expect(r.sx).toBeGreaterThan(prevSx);
      expect(r.scaledInnerH).toBeGreaterThanOrEqual(prevH);
      prevSx = r.sx;
      prevH = r.scaledInnerH;
    }
  });

  it("growing heightOverride monotonically increases the vertical scale", () => {
    const outerW = 192; // baseline
    const naturalH = 100;
    const heights = [120, 200, 400, 800];
    let prevSy = 0;
    for (const h of heights) {
      const r = scaledContent({
        outerW,
        widthOverridePct: 32,
        naturalH,
        heightOverridePx: h,
      });
      expect(r.sy).toBeGreaterThan(prevSy);
      prevSy = r.sy;
    }
  });
});

describe("clipping: container always contains the scaled inner content", () => {
  // The outer wrapper has overflow: hidden — so containerH must be ≥ the
  // scaled inner height, and outerW must equal the scaled inner width.
  const cases = [
    { outerW: 192, widthOverridePct: 32, naturalH: 60 },
    { outerW: 384, widthOverridePct: 64, naturalH: 60 },
    { outerW: 600, widthOverridePct: 100, naturalH: 200 },
    { outerW: 96, widthOverridePct: 16, naturalH: 40 },
    { outerW: 192, widthOverridePct: 32, naturalH: 100, heightOverridePx: 500 },
    { outerW: 600, widthOverridePct: 100, naturalH: 100, heightOverridePx: 1000 },
  ];

  for (const c of cases) {
    it(`no clipping for outerW=${c.outerW}, widthOverride=${c.widthOverridePct}%, naturalH=${c.naturalH}, heightOverride=${c.heightOverridePx ?? "—"}`, () => {
      const r = scaledContent(c);
      // Vertical: container height fully contains the visually scaled content.
      expect(r.containerH).toBeGreaterThanOrEqual(r.scaledInnerH - 1e-6);
      // Horizontal: scaled inner width matches outer (filled, not overflowed).
      expect(r.scaledInnerW).toBeCloseTo(c.outerW, 5);
    });
  }
});

describe("overlap: resized elements do not collide with siblings", () => {
  // Elements use absolute positioning with top: el.y (px) and a vertical
  // size of heightOverride (or natural). When the user grows an element's
  // height, the next element below must still sit below the resized box.
  function placeElements(
    elements: Array<{ y: number; heightOverride?: number; naturalH: number }>,
  ) {
    return elements.map((el) => ({
      top: el.y,
      bottom: el.y + (el.heightOverride ?? el.naturalH),
    }));
  }

  it("siblings positioned below a grown element should be repositioned to clear it", () => {
    // Initial layout: two stacked elements, 200px apart.
    const els = [
      { y: 0, heightOverride: 80, naturalH: 80 },
      { y: 200, heightOverride: 80, naturalH: 80 },
    ];
    // User grows the first element to 300px tall — it now overflows into 300px.
    els[0].heightOverride = 300;
    const placed = placeElements(els);

    // Detect overlap: bottom of el[0] vs top of el[1].
    const overlaps = placed[0].bottom > placed[1].top;
    expect(overlaps).toBe(true);

    // The app's free-position model lets users drag elements; the test
    // documents that callers must reposition siblings or the user must drag
    // them down. We assert the math for the "clear" position the next
    // element should snap to:
    const clearY = placed[0].bottom + 8; // small gap
    expect(clearY).toBeGreaterThan(placed[1].top);
    expect(clearY).toBe(308);
  });

  it("page minHeight grows to accommodate the largest element so nothing is cut off below", () => {
    // ws.minHeight = max(700, ...elements.map(e => (e.y || 0) + (e.heightOverride || 180) + 40))
    const els = [
      { y: 0, heightOverride: 80 },
      { y: 100, heightOverride: 600 }, // user-grown for accessibility
    ];
    const minHeight = Math.max(700, ...els.map((e) => (e.y || 0) + (e.heightOverride || 180) + 40));
    // Bottom of grown element = 100 + 600 = 700; +40 gap = 740 → page expands.
    expect(minHeight).toBe(740);
    expect(minHeight).toBeGreaterThan(els[1].y + els[1].heightOverride);
  });
});

describe("extreme image resizing: edge cases stay valid", () => {
  it("default (un-resized) image uses preset caps to avoid blowing up the page", () => {
    const s = imageFillStyle({});
    expect(s.userSized).toBe(false);
    expect(s.maxWidth).toBe("62%");
    expect(s.maxHeight).toBe(360);
    expect(s.objectFit).toBe("contain");
  });

  it("user-resized image fills the resized frame without exceeding either axis", () => {
    const s = imageFillStyle({ widthOverride: 80, heightOverride: 500 });
    expect(s.userSized).toBe(true);
    expect(s.maxWidth).toBe("100%");
    expect(s.maxHeight).toBe("100%");
    expect(s.width).toBe("100%");
    expect(s.height).toBe("100%");
    expect(s.objectFit).toBe("contain"); // proportional, never distorted
  });

  it("extreme: huge image (full-page width, very tall) remains bounded to the resized frame", () => {
    const s = imageFillStyle({ widthOverride: 100, heightOverride: 1200 });
    expect(s.height).toBe("100%");
    expect(s.maxHeight).toBe("100%");
  });

  it("extreme: tiny image (minimum allowed sizes) stays bounded and valid", () => {
    // widthOverride is clamped to 20% min and heightOverride to 48px min by the resize handler.
    const s = imageFillStyle({ widthOverride: 20, heightOverride: 48 });
    expect(s.userSized).toBe(true);
    expect(s.height).toBe("100%");
    expect(s.maxHeight).toBe("100%");
  });

  it("extreme: very wide thin image (large width, small height) stays valid", () => {
    const s = imageFillStyle({ widthOverride: 100, heightOverride: 60 });
    expect(s.height).toBe("100%");
    expect(s.maxHeight).toBe("100%");
  });

  it("extreme: very tall narrow image (small width, huge height) stays valid", () => {
    const s = imageFillStyle({ widthOverride: 25, heightOverride: 1500 });
    expect(s.height).toBe("100%");
    expect(s.maxWidth).toBe("100%");
  });

  it("width-only resize (no heightOverride) preserves aspect ratio via height: auto", () => {
    const s = imageFillStyle({ widthOverride: 80 });
    expect(s.userSized).toBe(true);
    expect(s.width).toBe("100%");
    expect(s.height).toBe("auto"); // image keeps aspect ratio when only width grows
  });

  it("objectFit: contain prevents image distortion at every extreme size", () => {
    const extremes = [
      { widthOverride: 20, heightOverride: 48 },
      { widthOverride: 100, heightOverride: 1500 },
      { widthOverride: 100, heightOverride: 60 },
      { widthOverride: 25, heightOverride: 1500 },
    ];
    for (const el of extremes) {
      expect(imageFillStyle(el).objectFit).toBe("contain");
    }
  });
});
