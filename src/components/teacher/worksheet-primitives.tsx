/* eslint-disable */
import { useState, useRef, useEffect, useLayoutEffect } from "react";
import type { CSSProperties, ReactNode } from "react";
import { shouldShowScrollTop, scrollEverythingToTop } from "@/lib/scroll-top";
import { repairAndParse } from "@/lib/repairJson";
import { renderInlineMarkdown, inlineMarkdownToHtml } from "@/lib/inlineMarkdown";
import { useGlobalShortcuts, ShortcutsHelpOverlay } from "@/components/KeyboardShortcuts";
import { detectPII, PII_BLOCK_MESSAGE } from "@/lib/pii";
import { trackToolUse, setActiveTool as setActiveToolName } from "@/lib/tracking";
import { callAiRaw, generateImage } from "@/lib/aiFetch";
import { SpellTextarea, SpellInput } from "@/components/SpellCheckField";

import { BANDS, GRADES, gInfo } from "@/data/grades";
import type { Standard } from "@/data/ny-standards";
import { getActiveStandards, getActiveStateInfo } from "@/data/state-standards";
import {
  IMG_STYLES,
  PALETTE,
  WORKSHEET_FONTS,
  SHAPE_TYPES,
  DOK_LEVEL_DEFS,
  VERSION_LABELS,
} from "@/data/worksheet-options";
import { F, FF, PRINT_CSS } from "@/lib/worksheet-styles";
import type { DokLevel, WorksheetShape, WorksheetElement } from "@/types/worksheet";
import {
  uid,
  COLS,
  COL_GAP_PCT,
  COL_W_PCT,
  ROW_HEIGHT,
  nextSlot,
  mkEl,
  BASELINE_WIDTH_PCT,
  BASELINE_HEIGHT_PX,
  SCALE_MIN,
  SCALE_MAX,
  clampScale,
  resizeScaleFor,
  shuffle,
  isQuestion,
  gradeIdToStdBand,
  elSummary,
} from "@/lib/worksheet-utils";

// Element/global-view records are highly dynamic (many worksheet element

// "types" share one loosely-shaped object). Index signatures keep the file
// behavior-identical while satisfying noImplicitAny.
interface WsElement {
  id: string;
  type: string;
  words?: string[];
  left?: string[];
  right?: string[];
  choices?: string[];
  statements?: string[];
  items?: string[];
  headers?: string[];
  rows?: string[][];
  levels?: DokLevel[];
  shapes?: WorksheetShape[];
  [key: string]: any;
}

interface GlobalView {
  color: string;
  light: string;
  lineH: number;
  fontSize: number;
  [key: string]: any;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SHARED UI
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface BtnProps {
  children?: ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  bg?: string;
  color?: string;
  disabled?: boolean;
  full?: boolean;
  sm?: boolean;
  style?: CSSProperties;
  ariaLabel?: string;
}

function Btn({
  children,
  onClick,
  bg = "#1E3A5F",
  color = "#fff",
  disabled,
  full,
  sm,
  style: xs = {},
  ariaLabel,
}: BtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      style={{
        padding: sm ? "5px 10px" : "8px 16px",
        borderRadius: 7,
        border: "none",
        background: bg,
        color,
        fontFamily: F,
        fontWeight: 600,
        fontSize: sm ? 12 : 13,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "all 0.15s",
        width: full ? "100%" : undefined,
        letterSpacing: 0.1,
        ...xs,
      }}
    >
      {children}
    </button>
  );
}

const LBL: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: "#6B7280",
  textTransform: "uppercase",
  letterSpacing: 0.8,
  display: "block",
  marginTop: 14,
  marginBottom: 4,
  fontFamily: F,
};
const INP = (): CSSProperties => ({
  width: "100%",
  padding: "8px 11px",
  borderRadius: 7,
  border: "1.5px solid #D1D5DB",
  fontSize: 13,
  fontFamily: F,
  outline: "none",
  boxSizing: "border-box",
  color: "#111827",
  resize: "vertical",
  transition: "border 0.2s",
  background: "white",
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CUSTOM SHAPE RENDERING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Returns SVG <path> or shape element string for a given id, rendered into a W×H viewBox
interface ShapeSVGProps {
  shape: string;
  fill?: string;
  border?: string;
  borderWidth?: number;
  width?: number | string;
  height?: number | string;
  label?: string;
  lines?: number;
  fontSize?: number;
}

function ShapeSVG({
  shape,
  fill,
  border,
  borderWidth,
  width,
  height,
  label,
  lines,
  fontSize,
}: ShapeSVGProps) {
  const sw = borderWidth || 2;
  // Allow width="100%" or "auto" — use a numeric basis for the viewBox math
  // and let CSS scale the SVG to fit its container.
  const fluidW = typeof width === "string";
  const W = fluidW ? 240 : width || 180;
  const H = (typeof height === "number" ? height : parseInt(height as any)) || 120;
  const f = fill || "#FFFFFF";
  const b = border || "#6D28D9";
  const fs = fontSize || 13;
  const lineColor = "#CBD5E1";
  const labelPad = label ? fs + 10 : 0;
  const innerTop = labelPad + 12;
  const innerH = H - innerTop - 8;
  const lineCount = lines || 0;
  const lineSpacing = lineCount > 0 ? Math.max(18, Math.floor(innerH / lineCount)) : 0;

  const shapeEl = () => {
    const p = sw / 2; // inset for stroke
    switch (shape) {
      case "rounded":
        return (
          <rect
            x={p}
            y={p}
            width={W - sw}
            height={H - sw}
            rx={14}
            ry={14}
            fill={f}
            stroke={b}
            strokeWidth={sw}
          />
        );
      case "circle": {
        const cx = W / 2,
          cy = H / 2,
          r = Math.min(W, H) / 2 - p;
        return <circle cx={cx} cy={cy} r={r} fill={f} stroke={b} strokeWidth={sw} />;
      }
      case "oval": {
        const cx = W / 2,
          cy = H / 2,
          rx = W / 2 - p,
          ry = H / 2 - p;
        return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={f} stroke={b} strokeWidth={sw} />;
      }
      case "triangle": {
        const pts = `${W / 2},${p} ${W - p},${H - p} ${p},${H - p}`;
        return <polygon points={pts} fill={f} stroke={b} strokeWidth={sw} />;
      }
      case "diamond": {
        const pts = `${W / 2},${p} ${W - p},${H / 2} ${W / 2},${H - p} ${p},${H / 2}`;
        return <polygon points={pts} fill={f} stroke={b} strokeWidth={sw} />;
      }
      case "hexagon": {
        const cx = W / 2,
          cy = H / 2,
          r = Math.min(W, H) / 2 - p;
        const pts = [0, 60, 120, 180, 240, 300]
          .map((a) => {
            const rad = ((a - 90) * Math.PI) / 180;
            return `${cx + r * Math.cos(rad)},${cy + r * Math.sin(rad)}`;
          })
          .join(" ");
        return <polygon points={pts} fill={f} stroke={b} strokeWidth={sw} />;
      }
      case "star": {
        const cx = W / 2,
          cy = H / 2,
          ro = Math.min(W, H) / 2 - p,
          ri = ro * 0.42;
        const pts = Array.from({ length: 10 }, (_, i) => {
          const rad = ((i * 36 - 90) * Math.PI) / 180;
          const r2 = i % 2 === 0 ? ro : ri;
          return `${cx + r2 * Math.cos(rad)},${cy + r2 * Math.sin(rad)}`;
        }).join(" ");
        return <polygon points={pts} fill={f} stroke={b} strokeWidth={sw} />;
      }
      case "speech": {
        const r = 10,
          tw = 22,
          th = 14;
        const d = `M${r + tw},${p} H${W - r - p} Q${W - p},${p} ${W - p},${r + p} V${H - th - r - p} Q${W - p},${H - th - p} ${W - r - p},${H - th - p} H${W / 2 + 6} L${W / 2 - 4},${H - p} L${W / 2 + 2},${H - th - p} H${r + p} Q${p},${H - th - p} ${p},${H - th - r - p} V${r + p} Q${p},${p} ${r + p},${p} Z`;
        return <path d={d} fill={f} stroke={b} strokeWidth={sw} />;
      }
      case "cloud": {
        const d = `M${W * 0.2},${H * 0.7} Q${W * 0.05},${H * 0.7} ${W * 0.08},${H * 0.52} Q${W * 0.08},${H * 0.35} ${W * 0.22},${H * 0.35} Q${W * 0.24},${H * 0.18} ${W * 0.42},${H * 0.2} Q${W * 0.5},${H * 0.06} ${W * 0.65},${H * 0.18} Q${W * 0.8},${H * 0.12} ${W * 0.88},${H * 0.28} Q${W * 0.98},${H * 0.28} ${W * 0.96},${H * 0.46} Q${W},${H * 0.6} ${W * 0.88},${H * 0.68} Q${W * 0.88},${H * 0.78} ${W * 0.78},${H * 0.78} H${W * 0.22} Q${W * 0.2},${H * 0.78} ${W * 0.2},${H * 0.7} Z`;
        return <path d={d} fill={f} stroke={b} strokeWidth={sw} />;
      }
      case "arrow": {
        const mid = H / 2,
          headX = W - p,
          bodyTop = mid - H * 0.18,
          bodyBot = mid + H * 0.18,
          headTop = p + 4,
          headBot = H - p - 4;
        const d = `M${p},${bodyTop} H${W * 0.62} V${headTop} L${headX},${mid} L${W * 0.62},${headBot} V${bodyBot} H${p} Z`;
        return <path d={d} fill={f} stroke={b} strokeWidth={sw} />;
      }
      case "heart": {
        const cx = W / 2,
          top = H * 0.22;
        const d = `M${cx},${H - p - 4} C${cx - W * 0.02},${H * 0.78} ${p},${H * 0.6} ${p},${H * 0.42} C${p},${top} ${cx * 0.5},${top - 8} ${cx},${top + 10} C${cx * 1.5},${top - 8} ${W - p},${top} ${W - p},${H * 0.42} C${W - p},${H * 0.6} ${cx + W * 0.02},${H * 0.78} ${cx},${H - p - 4} Z`;
        return <path d={d} fill={f} stroke={b} strokeWidth={sw} />;
      }
      default: // rectangle
        return (
          <rect x={p} y={p} width={W - sw} height={H - sw} fill={f} stroke={b} strokeWidth={sw} />
        );
    }
  };

  const svgWidth = fluidW ? "100%" : W;
  const svgHeight = fluidW ? H : H;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={svgWidth}
      height={svgHeight}
      preserveAspectRatio={fluidW ? "xMidYMid meet" : undefined}
      style={{ display: "block", overflow: "visible", maxWidth: "100%" }}
      aria-hidden="true"
    >
      {shapeEl()}
      {label && (
        <text
          x={W / 2}
          y={labelPad}
          textAnchor="middle"
          fontSize={fs}
          fontFamily="Inter,sans-serif"
          fontWeight="600"
          fill="#374151"
          dominantBaseline="middle"
        >
          {label}
        </text>
      )}
      {lineCount > 0 &&
        Array.from({ length: lineCount }).map((_, i) => {
          const y = innerTop + i * lineSpacing + lineSpacing * 0.7;
          if (y > H - 8) return null;
          return (
            <line
              key={i}
              x1={W * 0.08}
              x2={W * 0.92}
              y1={y}
              y2={y}
              stroke={lineColor}
              strokeWidth="1"
            />
          );
        })}
    </svg>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ELEMENT VIEW
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ScaledContent: wraps an element's inner content and scales it (via CSS
// transform) so that boxes, text, lines, and other inner elements grow or
// shrink together when the user resizes the outer wrapper. It measures the
// content's natural size and the available wrapper space, then applies
// transform: scale(sx, sy) with top-left origin. The outer wrapper keeps
// absolute positioning so resize handles stay anchored to its edges.

function ScaledContent({ el, children }: { el: WsElement; children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ outerW: 0, naturalH: 0 });

  // Measure the outer wrapper width (which reflects widthOverride %) and the
  // natural intrinsic height of the inner content at baseline width. We render
  // the inner box at a FIXED baseline pixel width so that growing the outer
  // wrapper truly enlarges (scales up) the content rather than just reflowing
  // it to fill more horizontal space.
  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const measure = () => {
      const outerW = outer.clientWidth || 0;
      const naturalH = inner.scrollHeight || inner.offsetHeight || 0;
      setDims((prev) =>
        prev.outerW === outerW && prev.naturalH === naturalH ? prev : { outerW, naturalH },
      );
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [el.widthOverride, el.heightOverride, el]);

  // Compute scale factors relative to the baseline. The inner box is laid out
  // at a fixed baseline width; the horizontal scale is outerW / baselineW. If
  // the user set a heightOverride, scale vertically so the content fills it;
  // otherwise scale Y to match X (uniform / proportional growth).
  const widthPct = el.widthOverride ?? BASELINE_WIDTH_PCT;
  const baselineWidthPx =
    dims.outerW > 0 ? (dims.outerW * BASELINE_WIDTH_PCT) / Math.max(1, widthPct) : 0;
  const sx = baselineWidthPx > 0 ? dims.outerW / baselineWidthPx : 1;
  const desiredH = el.heightOverride;
  const sy = desiredH && dims.naturalH > 0 ? Math.max(desiredH / dims.naturalH, sx) : sx;
  const containerH = dims.naturalH > 0 ? dims.naturalH * sy : null;

  return (
    <div
      ref={outerRef}
      style={{
        width: "100%",
        height: containerH != null ? containerH + "px" : "auto",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        ref={innerRef}
        style={{
          transform: `scale(${sx}, ${sy})`,
          transformOrigin: "top left",
          width: baselineWidthPx > 0 ? baselineWidthPx + "px" : "100%",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export type { WsElement, GlobalView };
export { Btn, LBL, INP, ShapeSVG, ScaledContent };
