import { describe, expect, it } from "vitest";

/**
 * Regression test for worksheet builder element resizing.
 *
 * The bug: when the user resized an element's outer wrapper, the box grew
 * but the inner contents (text, lines, boxes, images) stayed the same size.
 * This is critical for accessibility — children with disabilities need the
 * ability to scale up images and content together with the box.
 *
 * The fix: ScaledContent computes scale relative to a fixed baseline width
 * (BASELINE_WIDTH_PCT = 32) and the user's widthOverride %. Heights with a
 * heightOverride scale to fill, and otherwise track sx so growth is uniform.
 */

const BASELINE_WIDTH_PCT = 32;

function computeScale(opts: {
  outerW: number;
  widthOverridePct: number;
  naturalH?: number;
  heightOverridePx?: number;
}) {
  const { outerW, widthOverridePct, naturalH = 0, heightOverridePx } = opts;
  const baselineWidthPx =
    outerW > 0 ? (outerW * BASELINE_WIDTH_PCT) / Math.max(1, widthOverridePct) : 0;
  const sx = baselineWidthPx > 0 ? outerW / baselineWidthPx : 1;
  const sy = heightOverridePx && naturalH > 0 ? Math.max(heightOverridePx / naturalH, sx) : sx;
  return { sx, sy, baselineWidthPx };
}

describe("worksheet resize: inner content scales with the box", () => {
  it("keeps scale at 1 when the element is at its default width", () => {
    // Default new element is 32% wide. Container 600px wide → wrapper 192px.
    const { sx, sy } = computeScale({ outerW: 192, widthOverridePct: 32 });
    expect(sx).toBeCloseTo(1, 5);
    expect(sy).toBeCloseTo(1, 5);
  });

  it("scales inner content UP proportionally as the wrapper grows wider", () => {
    // User drags from 32% → 64% (doubles width).
    const { sx, sy } = computeScale({ outerW: 384, widthOverridePct: 64 });
    expect(sx).toBeCloseTo(2, 5);
    expect(sy).toBeCloseTo(2, 5); // uniform growth when no height override
  });

  it("scales inner content DOWN when the wrapper shrinks below baseline", () => {
    // User drags from 32% → 16% (halves width).
    const { sx } = computeScale({ outerW: 96, widthOverridePct: 16 });
    expect(sx).toBeCloseTo(0.5, 5);
  });

  it("scales vertically to fill heightOverride when set", () => {
    // Natural content is 100px tall, user expands box to 250px tall.
    const { sy } = computeScale({
      outerW: 192,
      widthOverridePct: 32,
      naturalH: 100,
      heightOverridePx: 250,
    });
    expect(sy).toBeCloseTo(2.5, 5);
  });

  it("never lets sy drop below sx (so content does not shrink when box widens)", () => {
    // Wide box, modest height override — sy must follow sx, not the smaller ratio.
    const { sx, sy } = computeScale({
      outerW: 384,
      widthOverridePct: 64,
      naturalH: 100,
      heightOverridePx: 120, // would give sy=1.2 alone, but sx=2
    });
    expect(sx).toBeCloseTo(2, 5);
    expect(sy).toBeCloseTo(2, 5);
  });

  it("treats the largest worksheet element (100% width) as ~3.1x growth", () => {
    // Going from 32% baseline to 100% full-width is roughly 3.125x.
    const { sx } = computeScale({ outerW: 600, widthOverridePct: 100 });
    expect(sx).toBeCloseTo(100 / 32, 5);
  });
});
