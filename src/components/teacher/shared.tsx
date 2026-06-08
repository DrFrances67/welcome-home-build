/* eslint-disable */
// @ts-nocheck
import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { shouldShowScrollTop, scrollEverythingToTop } from "@/lib/scroll-top";
import { repairAndParse } from "@/lib/repairJson";
import { renderInlineMarkdown, inlineMarkdownToHtml } from "@/lib/inlineMarkdown";
import { useGlobalShortcuts, ShortcutsHelpOverlay } from "@/components/KeyboardShortcuts";
import { detectPII, PII_BLOCK_MESSAGE } from "@/lib/pii";
import { trackToolUse, setActiveTool as setActiveToolName } from "@/lib/tracking";
import { callAiRaw, generateImage } from "@/lib/aiFetch";
import { SpellTextarea, SpellInput } from "@/components/SpellCheckField";

import { BANDS, GRADES, gInfo } from "@/data/grades";
import { NY_STANDARDS } from "@/data/ny-standards";
import {
  IMG_STYLES,
  PALETTE,
  WORKSHEET_FONTS,
  SHAPE_TYPES,
  DOK_LEVEL_DEFS,
  VERSION_LABELS,
} from "@/data/worksheet-options";
import { F, FF, PRINT_CSS } from "@/lib/worksheet-styles";
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SHARED UI
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
}) {
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

const LBL = {
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
const INP = () => ({
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
function ShapeSVG({ shape, fill, border, borderWidth, width, height, label, lines, fontSize }) {
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

function ScaledContent({ el, children }) {
  const outerRef = useRef(null);
  const innerRef = useRef(null);
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

function ElView({
  el,
  gv,
  selected,
  onClick,
  onResize,
  onDelete,
  onDragStart,
  onReset,
  oneLineOnly = true,
}) {
  // Per-element typography overrides
  const fs = el.fontSizeOverride || gv.fontSize;
  const elFamily =
    el.fontFamily && el.fontFamily !== "default" ? el.fontFamily : "'Nunito', sans-serif";
  const elWeight = el.bold ? 800 : undefined;
  const elStyle = el.italic ? "italic" : undefined;
  const elDecor = el.underline ? "underline" : undefined;
  const elAlign = el.textAlign || undefined;

  // Font-size lock: when the user picks a specific text-size preset (or
  // custom pt) we treat that pt value as the FINAL rendered size and do NOT
  // multiply it by the resize scale. Box paddings/spacing still scale with
  // the box so the layout breathes; only the text stays exactly at the
  // chosen size. When no override is set, text scales with the box like
  // before (auto mode).
  const fsLocked = !!el.fontSizeOverride;
  const tScale = (sc) => (fsLocked ? 1 : sc.s);

  // Helper: per-item single-line vs wrap styling. Used by list-style elements
  // (Success Criteria, Exit Ticket, DOK Questions). When oneLineOnly is on,
  // each item stays on a single line and clips with ellipsis — encouraging
  // the user to widen the box. When off, items wrap naturally.
  const lineStyle = oneLineOnly
    ? { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }
    : { whiteSpace: "normal", overflow: "visible", wordBreak: "break-word" };

  // The Table element is special: cells must be allowed to wrap so the whole
  // table (headers, rows, cells) actually fits inside the resizable box.
  const isTable = el.type === "table";

  const wrap = {
    position: "absolute",
    left: `${el.x ?? 0}%`,
    top: el.y ?? 0,
    width: `${el.widthOverride ?? 32}%`,
    cursor: "move",
    outline: selected ? `2px solid ${gv.color}` : "2px solid transparent",
    outlineOffset: 2,
    borderRadius: 8,
    padding: "6px 6px 14px 6px",
    background: "white",
    transition: "outline 0.1s",
    minHeight: el.heightOverride || undefined,
    height: el.heightOverride || undefined,
    boxSizing: "border-box",
    // Clip ALL inner content to the resizable bounds so nothing renders
    // outside the box on any worksheet element. Tables stay scrollable so
    // every row remains reachable. Resize handles are repositioned to sit
    // flush with the edges (see ResizeHandles below) so clipping does not
    // hide them.
    overflow: isTable ? "auto" : "hidden",
    touchAction: "none", // allow pointer-drag on touch devices (iPad/phone)
  };

  const handleMouseDown = (e) => {
    onDragStart && onDragStart(e, el.id);
  };

  // ── Delete button — top-right, visible on hover or when selected ──
  const DeleteBtn = () => (
    <button
      data-delete-btn
      className="el-delete-btn"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onDelete && onDelete(el.id);
      }}
      aria-label="Delete element"
      title="Delete element"
      style={{
        position: "absolute",
        top: 4,
        right: 4,
        width: 22,
        height: 22,
        borderRadius: "50%",
        border: "none",
        background: "#DC2626",
        color: "white",
        fontSize: 11,
        fontWeight: 900,
        lineHeight: 1,
        cursor: "pointer",
        zIndex: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
        opacity: selected ? 1 : 0,
      }}
    >
      ✕
    </button>
  );

  // ── Reset/refresh button — top-LEFT corner. Clears any resize overrides
  // (width, height, axis) so the element snaps back to its default size and
  // proportional content. Useful if a resize ever leaves an element looking
  // off. Visible whenever the element is selected.
  const ResetBtn = () => (
    <button
      data-reset-btn
      className="el-reset-btn"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        if (onReset) onReset(el.id);
      }}
      aria-label="Reset element size"
      title="Reset element size"
      style={{
        position: "absolute",
        top: 4,
        left: 4,
        width: 22,
        height: 22,
        borderRadius: "50%",
        border: "none",
        background: gv.color,
        color: "white",
        fontSize: 13,
        fontWeight: 900,
        lineHeight: 1,
        cursor: "pointer",
        zIndex: 20,
        display: selected ? "flex" : "none",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
      }}
    >
      ↻
    </button>
  );
  const ResizeHandles = () =>
    !selected ? null : (
      <>
        {/* Bottom — vertical resize */}
        <div
          data-resize-handle
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onResize && onResize(e, el.id, "bottom");
          }}
          title="Drag to resize height"
          style={{
            position: "absolute",
            bottom: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: 56,
            height: 14,
            cursor: "ns-resize",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            touchAction: "none",
          }}
        >
          <div
            style={{
              width: 44,
              height: 6,
              borderRadius: 3,
              background: gv.color,
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }}
          />
        </div>
        {/* Top — vertical resize */}
        <div
          data-resize-handle
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onResize && onResize(e, el.id, "top");
          }}
          title="Drag to resize height"
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: 56,
            height: 14,
            cursor: "ns-resize",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            touchAction: "none",
          }}
        >
          <div
            style={{
              width: 44,
              height: 6,
              borderRadius: 3,
              background: gv.color,
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }}
          />
        </div>
        {/* Right — horizontal resize (drag this edge to make the box WIDER) */}
        <div
          data-resize-handle
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onResize && onResize(e, el.id, "right");
          }}
          title="Drag to resize width"
          style={{
            position: "absolute",
            right: 0,
            top: "50%",
            transform: "translateY(-50%)",
            width: 14,
            height: 56,
            cursor: "ew-resize",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            touchAction: "none",
          }}
        >
          <div
            style={{
              width: 6,
              height: 44,
              borderRadius: 3,
              background: gv.color,
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }}
          />
        </div>
        {/* Left — horizontal resize (drag this edge to make the box WIDER) */}
        <div
          data-resize-handle
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onResize && onResize(e, el.id, "left");
          }}
          title="Drag to resize width"
          style={{
            position: "absolute",
            left: 0,
            top: "50%",
            transform: "translateY(-50%)",
            width: 14,
            height: 56,
            cursor: "ew-resize",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            touchAction: "none",
          }}
        >
          <div
            style={{
              width: 6,
              height: 44,
              borderRadius: 3,
              background: gv.color,
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }}
          />
        </div>
        {/* Bottom-right corner */}
        <div
          data-resize-handle
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onResize && onResize(e, el.id, "corner");
          }}
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: 22,
            height: 22,
            cursor: "nwse-resize",
            zIndex: 11,
            touchAction: "none",
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            style={{ position: "absolute", bottom: 5, right: 5 }}
          >
            <path
              d="M2,10 L10,2 M6,10 L10,6 M10,10 L10,10"
              stroke={gv.color}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </>
    );

  if (el.type === "instruction") {
    const sc = resizeScaleFor(el);
    return (
      <div
        className="ws-element"
        style={wrap}
        onPointerDown={handleMouseDown}
        onClick={onClick}
        role="button"
        tabIndex={0}
        aria-label="Instructions element — click to edit"
        onKeyDown={(e) => e.key === "Enter" && onClick()}
      >
        <div
          style={{
            fontSize: Math.max(fs - 6, 12) * tScale(sc),
            fontWeight: elWeight || 600,
            color: "#1F2937",
            background: "#FEFCE8",
            padding: `${10 * sc.s}px ${16 * sc.s}px`,
            borderRadius: 8,
            borderLeft: `${5 * sc.s}px solid ${gv.color}`,
            fontFamily: elFamily,
            lineHeight: 1.6,
            fontStyle: elStyle,
            textDecoration: elDecor,
            textAlign: elAlign,
          }}
        >
          {renderInlineMarkdown(el.text)}
        </div>
        <DeleteBtn />
        <ResetBtn />
        <ResizeHandles />
      </div>
    );
  }

  if (el.type === "text") {
    const sc = resizeScaleFor(el);
    return (
      <div
        className="ws-element"
        style={wrap}
        onPointerDown={handleMouseDown}
        onClick={onClick}
        role="button"
        tabIndex={0}
        aria-label="Text block — click to edit"
        onKeyDown={(e) => e.key === "Enter" && onClick()}
      >
        <p
          style={{
            fontSize: fs * tScale(sc),
            fontWeight: elWeight || 500,
            color: "#111827",
            margin: 0,
            fontFamily: elFamily,
            lineHeight: 1.75,
            fontStyle: elStyle,
            textDecoration: elDecor,
            textAlign: elAlign,
          }}
        >
          {renderInlineMarkdown(el.text)}
        </p>
        <DeleteBtn />
        <ResetBtn />
        <ResizeHandles />
      </div>
    );
  }

  if (el.type === "image") {
    const isSmall = el.size === "small";
    const isLarge = el.size === "large";
    const floated = isSmall && (el.align === "left" || el.align === "right");
    // If user has manually resized the wrapper, let the image fill it on BOTH
    // axes (fixes "image only resizes from one plane"). Otherwise fall back to
    // the size-preset caps.
    const userSized = !!(el.widthOverride || el.heightOverride);
    const imgMaxW = isSmall ? "32%" : isLarge ? "94%" : "62%";
    const floatStyle = floated
      ? {
          float: el.align,
          marginRight: el.align === "left" ? 18 : 0,
          marginLeft: el.align === "right" ? 18 : 0,
          marginBottom: 10,
          width: "32%",
        }
      : {};
    const resizedInlineImage = userSized && !floated;
    const containerStyle = floated
      ? { ...wrap, overflow: "hidden" }
      : {
          ...wrap,
          textAlign: el.align || "center",
          ...(resizedInlineImage
            ? { display: "flex", flexDirection: "column", alignItems: "stretch" }
            : {}),
        };
    const imageFrameStyle = resizedInlineImage
      ? {
          width: "100%",
          flex: el.heightOverride ? "1 1 auto" : "0 0 auto",
          minHeight: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }
      : undefined;
    // When the user resizes the wrapper, the image must scale proportionally
    // with the box on BOTH axes and never get cut off. width:100% + height:100%
    // (when a heightOverride exists) + object-fit:contain guarantees the image
    // always fits inside the resized box, preserves aspect ratio, and shrinks
    // when the box shrinks — no clipping, no letterbox-pinned pixel height.
    const fillImgStyle = resizedInlineImage
      ? {
          width: "100%",
          height: el.heightOverride ? "100%" : "auto",
          maxWidth: "100%",
          maxHeight: "100%",
          objectFit: "contain",
          display: "block",
          boxSizing: "border-box",
          borderRadius: 8,
          border: "1.5px solid #E5E7EB",
        }
      : {
          ...floatStyle,
          ...(!floated ? { maxWidth: imgMaxW } : {}),
          borderRadius: 8,
          border: "1.5px solid #E5E7EB",
          maxHeight: floated ? 200 : 360,
          objectFit: "contain",
          display: floated ? "block" : "inline-block",
        };
    return (
      <div
        className="ws-element"
        style={containerStyle}
        onPointerDown={handleMouseDown}
        onClick={onClick}
        role="button"
        tabIndex={0}
        aria-label="Image element — click to edit"
        onKeyDown={(e) => e.key === "Enter" && onClick()}
      >
        {el.url && resizedInlineImage ? (
          <div style={imageFrameStyle}>
            <img src={el.url} alt={el.caption || "Worksheet illustration"} style={fillImgStyle} />
          </div>
        ) : el.url ? (
          <img src={el.url} alt={el.caption || "Worksheet illustration"} style={fillImgStyle} />
        ) : (
          <div
            style={{
              display: "inline-flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              width: isSmall ? 150 : isLarge ? 400 : 260,
              height: isSmall ? 110 : isLarge ? 290 : 190,
              border: `2px dashed ${gv.color}50`,
              borderRadius: 10,
              background: gv.light,
              gap: 8,
              ...floatStyle,
            }}
          >
            <span style={{ fontSize: 34 }} aria-hidden="true">
              🖼️
            </span>
            <span style={{ fontSize: 11, color: "#9CA3AF", fontFamily: F, fontWeight: 600 }}>
              Click to add image
            </span>
          </div>
        )}
        {floated && (
          <div
            style={{
              fontSize: fs,
              fontFamily: elFamily,
              lineHeight: gv.lineH + "px",
              minHeight: 110,
            }}
          >
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                style={{ borderBottom: "1.5px dashed #D1D5DB", height: gv.lineH, marginBottom: 4 }}
              />
            ))}
          </div>
        )}
        {!floated && el.caption && (
          <p
            style={{
              fontSize: Math.max(fs - 10, 11),
              color: "#6B7280",
              textAlign: "center",
              margin: "6px 0 0",
              fontFamily: F,
              fontWeight: 600,
              flex: resizedInlineImage ? "0 0 auto" : undefined,
              maxWidth: resizedInlineImage ? "100%" : undefined,
            }}
          >
            {el.caption}
          </p>
        )}
        {floated && <div style={{ clear: "both" }} />}
        <DeleteBtn />
        <ResetBtn />
        <ResizeHandles />
      </div>
    );
  }

  if (el.type === "blank")
    return (
      <div
        className="ws-element"
        style={wrap}
        onPointerDown={handleMouseDown}
        onClick={onClick}
        role="button"
        tabIndex={0}
        aria-label="Write lines element — click to edit"
        onKeyDown={(e) => e.key === "Enter" && onClick()}
      >
        {el.label && (
          <p
            style={{
              fontSize: Math.max(fs - 3, 12),
              fontWeight: elWeight || 700,
              color: "#111827",
              margin: "0 0 10px 0",
              fontFamily: elFamily,
              fontStyle: elStyle,
              textDecoration: elDecor,
              textAlign: elAlign,
            }}
          >
            {el.label}
          </p>
        )}
        {Array.from({ length: el.lines || 3 }).map((_, i) => (
          <div
            key={i}
            aria-hidden="true"
            style={{ height: gv.lineH, borderBottom: "2px solid #D1D5DB", marginBottom: 6 }}
          />
        ))}
        <DeleteBtn />
        <ResetBtn />
        <ResizeHandles />
      </div>
    );

  if (el.type === "wordBank") {
    const scale = resizeScaleFor(el);
    return (
      <div
        className="ws-element"
        style={wrap}
        onPointerDown={handleMouseDown}
        onClick={onClick}
        role="button"
        tabIndex={0}
        aria-label="Word bank element — click to edit"
        onKeyDown={(e) => e.key === "Enter" && onClick()}
      >
        <p
          style={{
            fontSize: Math.max(fs - 4, 12) * tScale(scale),
            fontWeight: 700,
            color: gv.color,
            margin: "0 0 10px 0",
            fontFamily: FF,
            letterSpacing: 0.3,
          }}
        >
          {el.title}
        </p>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignContent: "flex-start",
            gap: 8 * scale.s,
            padding: `${10 * scale.s}px ${14 * scale.s}px`,
            background: gv.light,
            borderRadius: 8,
            border: `1.5px solid ${gv.color}25`,
            minHeight: el.heightOverride ? Math.max(24, el.heightOverride - 46) : undefined,
            boxSizing: "border-box",
          }}
        >
          {(el.words || []).map((w, i) => (
            <span
              key={i}
              style={{
                fontSize: fs * tScale(scale),
                fontWeight: 600,
                fontFamily: elFamily,
                padding: `${4 * scale.s}px ${14 * scale.s}px`,
                border: `1.5px solid ${gv.color}`,
                borderRadius: 40,
                background: "white",
                color: "#111827",
                lineHeight: 1.35,
              }}
            >
              {w}
            </span>
          ))}
        </div>
        <DeleteBtn />
        <ResetBtn />
        <ResizeHandles />
      </div>
    );
  }

  if (el.type === "matching") {
    const sc = resizeScaleFor(el);
    return (
      <div
        className="ws-element"
        style={wrap}
        onPointerDown={handleMouseDown}
        onClick={onClick}
        role="button"
        tabIndex={0}
        aria-label="Matching activity — click to edit"
        onKeyDown={(e) => e.key === "Enter" && onClick()}
      >
        {el.title && (
          <p
            style={{
              fontSize: Math.max(fs - 3, 12) * tScale(sc),
              fontWeight: elWeight || 700,
              color: "#111827",
              margin: `0 0 ${12 * sc.s}px 0`,
              fontFamily: elFamily,
            }}
          >
            {el.title}
          </p>
        )}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `1fr ${40 * sc.s}px 1fr`,
            gap: 6 * sc.s,
            alignItems: "center",
          }}
        >
          {(el.left || []).map((item, i) => (
            <span key={i} style={{ display: "contents" }}>
              <div
                style={{
                  fontSize: fs * tScale(sc),
                  fontWeight: 600,
                  fontFamily: elFamily,
                  padding: `${6 * sc.s}px ${10 * sc.s}px`,
                  border: `1.5px solid ${gv.color}`,
                  borderRadius: 8,
                  background: gv.light,
                  textAlign: "center",
                }}
              >
                {renderInlineMarkdown(item)}
              </div>
              <div
                aria-hidden="true"
                style={{ borderBottom: "1.5px dashed #9CA3AF", margin: `0 ${4 * sc.s}px` }}
              />
              <div
                style={{
                  fontSize: fs * tScale(sc),
                  fontWeight: 600,
                  fontFamily: elFamily,
                  padding: `${6 * sc.s}px ${10 * sc.s}px`,
                  border: `1.5px solid ${gv.color}`,
                  borderRadius: 8,
                  background: gv.light,
                  textAlign: "center",
                }}
              >
                {renderInlineMarkdown((el.right || [])[i] || "")}
              </div>
            </span>
          ))}
        </div>
        <DeleteBtn />
        <ResetBtn />
        <ResizeHandles />
      </div>
    );
  }

  if (el.type === "multipleChoice") {
    const sc = resizeScaleFor(el);
    return (
      <div
        className="ws-element"
        style={wrap}
        onPointerDown={handleMouseDown}
        onClick={onClick}
        role="button"
        tabIndex={0}
        aria-label="Multiple choice question — click to edit"
        onKeyDown={(e) => e.key === "Enter" && onClick()}
      >
        <p
          style={{
            fontSize: fs * tScale(sc),
            fontWeight: elWeight || 700,
            color: "#111827",
            margin: `0 0 ${5 * sc.s}px 0`,
            fontFamily: elFamily,
            lineHeight: 1.45,
            fontStyle: elStyle,
            textDecoration: elDecor,
            textAlign: elAlign,
          }}
        >
          {renderInlineMarkdown(el.question)}
        </p>
        {el.note && (
          <p
            style={{
              fontSize: Math.max(fs - 7, 11) * tScale(sc),
              fontWeight: 500,
              color: "#6B7280",
              margin: `0 0 ${12 * sc.s}px 0`,
              fontFamily: F,
            }}
          >
            {el.note}
          </p>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 * sc.s }}>
          {(el.choices || []).map((c, i) => (
            <label key={i} style={{ display: "flex", alignItems: "center", gap: 8 * sc.s }}>
              <div
                aria-hidden="true"
                style={{
                  width: Math.min(22, fs) * sc.s,
                  height: Math.min(22, fs) * sc.s,
                  borderRadius: "50%",
                  border: `2px solid ${gv.color}`,
                  flexShrink: 0,
                  background: "white",
                }}
              />
              <span style={{ fontSize: fs * tScale(sc), fontWeight: 500, fontFamily: elFamily }}>
                {renderInlineMarkdown(c)}
              </span>
            </label>
          ))}
        </div>
        <DeleteBtn />
        <ResetBtn />
        <ResizeHandles />
      </div>
    );
  }

  if (el.type === "truefalse") {
    const scale = resizeScaleFor(el);
    return (
      <div
        className="ws-element"
        style={wrap}
        onPointerDown={handleMouseDown}
        onClick={onClick}
        role="button"
        tabIndex={0}
        aria-label="True or false activity — click to edit"
        onKeyDown={(e) => e.key === "Enter" && onClick()}
      >
        <p
          style={{
            fontSize: Math.max(fs - 4, 12) * tScale(scale),
            fontWeight: 700,
            color: gv.color,
            margin: "0 0 10px 0",
            fontFamily: FF,
          }}
        >
          True or False? Circle your answer.
        </p>
        {(el.statements || []).map((stmt, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              columnGap: 10 * scale.s,
              rowGap: 6 * scale.s,
              marginBottom: 10 * scale.s,
              padding: `${8 * scale.s}px ${12 * scale.s}px`,
              background: gv.light,
              borderRadius: 8,
              minHeight: el.heightOverride
                ? Math.max(34, (el.heightOverride - 42) / Math.max(1, (el.statements || []).length))
                : undefined,
              boxSizing: "border-box",
            }}
          >
            <span
              style={{
                fontSize: fs * tScale(scale),
                fontWeight: 500,
                fontFamily: elFamily,
                flex: "1 1 70%",
                minWidth: 0,
                lineHeight: 1.45,
                wordBreak: "break-word",
              }}
            >
              {renderInlineMarkdown(stmt)}
            </span>
            <div style={{ display: "flex", gap: 6 * scale.s, flexShrink: 0, marginLeft: "auto" }}>
              {["TRUE", "FALSE"].map((t) => (
                <span
                  key={t}
                  style={{
                    fontSize: Math.max(fs - 6, 10) * tScale(scale),
                    fontWeight: 700,
                    padding: `${3 * scale.s}px ${10 * scale.s}px`,
                    border: `1.5px solid ${gv.color}`,
                    borderRadius: 40,
                    fontFamily: F,
                    color: gv.color,
                    textAlign: "center",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        ))}
        <DeleteBtn />
        <ResetBtn />
        <ResizeHandles />
      </div>
    );
  }

  if (el.type === "shortAnswer") {
    const sc = resizeScaleFor(el);
    // Grow the answer-line count to fill the wrapper height when the user
    // resizes vertically, so the box never has empty space below the lines.
    const lineUnit = gv.lineH * 0.9 * sc.s + 5;
    const reserved = 48 * sc.s;
    const fitLines = el.heightOverride
      ? Math.max(el.lines || 4, Math.floor((el.heightOverride - reserved) / Math.max(8, lineUnit)))
      : el.lines || 4;
    return (
      <div
        className="ws-element"
        style={wrap}
        onPointerDown={handleMouseDown}
        onClick={onClick}
        role="button"
        tabIndex={0}
        aria-label="Short answer question — click to edit"
        onKeyDown={(e) => e.key === "Enter" && onClick()}
      >
        <p
          style={{
            fontSize: fs * tScale(sc),
            fontWeight: elWeight || 700,
            color: "#111827",
            margin: `0 0 ${12 * sc.s}px 0`,
            fontFamily: elFamily,
            lineHeight: 1.45,
            fontStyle: elStyle,
            textDecoration: elDecor,
            textAlign: elAlign,
            ...lineStyle,
          }}
        >
          {renderInlineMarkdown(el.question)}
        </p>
        {Array.from({ length: fitLines }).map((_, i) => (
          <div
            key={i}
            aria-hidden="true"
            style={{
              height: gv.lineH * 0.9 * sc.s,
              borderBottom: "1.5px solid #D1D5DB",
              marginBottom: 5 * sc.s,
            }}
          />
        ))}
        <DeleteBtn />
        <ResetBtn />
        <ResizeHandles />
      </div>
    );
  }

  if (el.type === "fillBlank") {
    const sc = resizeScaleFor(el);
    return (
      <div
        className="ws-element"
        style={wrap}
        onPointerDown={handleMouseDown}
        onClick={onClick}
        role="button"
        tabIndex={0}
        aria-label="Fill in the blank activity — click to edit"
        onKeyDown={(e) => e.key === "Enter" && onClick()}
      >
        {el.note && (
          <p
            style={{
              fontSize: Math.max(fs - 7, 11) * tScale(sc),
              fontWeight: 500,
              color: "#6B7280",
              margin: `0 0 ${8 * sc.s}px 0`,
              fontFamily: F,
            }}
          >
            {el.note}
          </p>
        )}
        <p
          style={{
            fontSize: fs * tScale(sc),
            fontWeight: elWeight || 500,
            color: "#111827",
            margin: 0,
            fontFamily: elFamily,
            lineHeight: 1.9,
            fontStyle: elStyle,
            textAlign: elAlign,
            wordBreak: "break-word",
            overflowWrap: "anywhere",
            maxWidth: "100%",
          }}
        >
          {(el.text || "").split("______").map((part, i, arr) => (
            <span key={i}>
              {renderInlineMarkdown(part)}
              {i < arr.length - 1 && (
                <span
                  aria-label="blank"
                  style={{
                    display: "inline-block",
                    width: Math.min(85, 60) * sc.s,
                    borderBottom: `2px solid ${gv.color}`,
                    verticalAlign: "bottom",
                    margin: `0 ${3 * sc.s}px`,
                  }}
                />
              )}
            </span>
          ))}
        </p>
        <DeleteBtn />
        <ResetBtn />
        <ResizeHandles />
      </div>
    );
  }

  if (el.type === "essay") {
    const sc = resizeScaleFor(el);
    // When the user resizes the box vertically, grow the writing-line count to
    // fill the new height. Each ruled line is roughly gv.lineH * 0.75 px tall
    // (matches the renderer below) plus a 3px gap. We reserve ~64px for the
    // prompt + points header so the lines actually sit underneath it.
    const lineUnit = gv.lineH * 0.75 * sc.s + 3;
    const reserved = 64 * sc.s;
    const fitLines = el.heightOverride
      ? Math.max(el.lines || 14, Math.floor((el.heightOverride - reserved) / Math.max(8, lineUnit)))
      : el.lines || 14;
    return (
      <div
        className="ws-element"
        style={wrap}
        onPointerDown={handleMouseDown}
        onClick={onClick}
        role="button"
        tabIndex={0}
        aria-label="Essay prompt — click to edit"
        onKeyDown={(e) => e.key === "Enter" && onClick()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 12 * sc.s,
          }}
        >
          <p
            style={{
              fontSize: fs * tScale(sc),
              fontWeight: elWeight || 700,
              color: "#111827",
              margin: 0,
              fontFamily: elFamily,
              lineHeight: 1.45,
              flex: 1,
              minWidth: 0,
              fontStyle: elStyle,
              textDecoration: elDecor,
              textAlign: elAlign,
              ...lineStyle,
            }}
          >
            {renderInlineMarkdown(el.prompt)}
          </p>
          {el.points && (
            <span
              style={{
                fontSize: Math.max(fs - 6, 10) * tScale(sc),
                fontWeight: 700,
                color: gv.color,
                whiteSpace: "nowrap",
                marginLeft: 12 * sc.s,
                fontFamily: F,
                padding: `${3 * sc.s}px ${9 * sc.s}px`,
                border: `1.5px solid ${gv.color}`,
                borderRadius: 40,
              }}
            >
              {el.points} pts
            </span>
          )}
        </div>
        {Array.from({ length: fitLines }).map((_, i) => (
          <div
            key={i}
            aria-hidden="true"
            style={{
              height: gv.lineH * 0.75 * sc.s,
              borderBottom: "1px solid #E5E7EB",
              marginBottom: 3 * sc.s,
            }}
          />
        ))}
        <DeleteBtn />
        <ResetBtn />
        <ResizeHandles />
      </div>
    );
  }

  if (el.type === "successCriteria" || el.type === "exitTicket") {
    const accent = el.type === "successCriteria" ? gv.color : "#0369A1";
    const bg = el.type === "successCriteria" ? gv.light : "#EFF6FF";
    const sc = resizeScaleFor(el);
    // Line spacing must stay tight and CONSTANT regardless of box size —
    // neither vertical nor horizontal resizing should add gaps between items.
    // Items pack from the top with a fixed gap; we only allow it to shrink
    // (cap the scale at 1) so widening the box never spreads items apart.
    const itemGap = 8 * Math.min(1, sc.s);
    return (
      <div
        className="ws-element"
        style={wrap}
        onPointerDown={handleMouseDown}
        onClick={onClick}
        role="group"
        tabIndex={0}
        aria-label={`${el.type === "successCriteria" ? "Success criteria" : "Exit ticket"} — click to edit`}
        onKeyDown={(e) => e.key === "Enter" && onClick()}
      >
        <div
          style={{
            background: bg,
            border: `2px solid ${accent}45`,
            borderLeft: `${6 * sc.s}px solid ${accent}`,
            borderRadius: 10,
            padding: `${12 * sc.s}px ${16 * sc.s}px`,
            height: el.heightOverride ? "100%" : undefined,
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {el.title && (
            <p
              style={{
                fontSize: Math.max(fs - 2, 13) * tScale(sc),
                fontWeight: 800,
                color: accent,
                margin: `0 0 ${6 * sc.s}px 0`,
                fontFamily: FF,
                letterSpacing: 0.2,
              }}
            >
              {el.title}
            </p>
          )}
          {el.intro && (
            <p
              style={{
                fontSize: Math.max(fs - 4, 11) * tScale(sc),
                fontWeight: 600,
                color: "#374151",
                margin: `0 0 ${10 * sc.s}px 0`,
                fontFamily: F,
                lineHeight: 1.5,
              }}
            >
              {renderInlineMarkdown(el.intro)}
            </p>
          )}
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: itemGap,
              justifyContent: "flex-start",
            }}
          >
            {(el.items || []).map((item, i) => (
              <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 * sc.s }}>
                <span
                  aria-hidden="true"
                  style={{
                    flexShrink: 0,
                    width: 18 * sc.s,
                    height: 18 * sc.s,
                    marginTop: 2 * sc.s,
                    border: `2px solid ${accent}`,
                    borderRadius: 4,
                    background: "white",
                  }}
                />
                <span
                  style={{
                    fontSize: fs * tScale(sc),
                    fontWeight: elWeight || 600,
                    color: "#111827",
                    fontFamily: elFamily,
                    lineHeight: 1.45,
                    fontStyle: elStyle,
                    textDecoration: elDecor,
                    textAlign: elAlign,
                    flex: 1,
                    minWidth: 0,
                    ...lineStyle,
                  }}
                >
                  {renderInlineMarkdown(item)}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <DeleteBtn />
        <ResetBtn />
        <ResizeHandles />
      </div>
    );
  }

  if (el.type === "dokQuestions") {
    const LEVEL_COLORS = ["#10B981", "#0EA5E9", "#8B5CF6", "#F59E0B"];
    const sc = resizeScaleFor(el);
    // DOK cards contain multiple nested text boxes. Tie their internal scale to
    // width only and cap it so vertical resizing does not balloon type/gaps and
    // push most questions out of view.
    const dokS = Math.max(SCALE_MIN, Math.min(1.35, sc.sx));
    const dokTextScale = fsLocked ? 1 : dokS;
    const levelGap = 10;
    const itemGap = 6;
    const dokLineStyle = { whiteSpace: "normal", overflow: "visible", wordBreak: "break-word" };
    return (
      <div
        className="ws-element"
        style={wrap}
        onPointerDown={handleMouseDown}
        onClick={onClick}
        role="group"
        tabIndex={0}
        aria-label="DOK Questions — click to edit"
        onKeyDown={(e) => e.key === "Enter" && onClick()}
      >
        <div
          style={{
            background: "#FFFFFF",
            border: `2px solid ${gv.color}45`,
            borderLeft: `${6 * dokS}px solid ${gv.color}`,
            borderRadius: 10,
            padding: `${12 * dokS}px ${16 * dokS}px`,
            height: el.heightOverride ? "100%" : undefined,
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            overflowY: el.heightOverride ? "auto" : "visible",
            minHeight: 0,
          }}
        >
          {el.title && (
            <p
              style={{
                fontSize: Math.max(fs - 2, 13) * dokTextScale,
                fontWeight: 800,
                color: gv.color,
                margin: `0 0 ${6 * dokS}px 0`,
                fontFamily: FF,
                letterSpacing: 0.2,
              }}
            >
              {el.title}
            </p>
          )}
          {el.intro && (
            <p
              style={{
                fontSize: Math.max(fs - 4, 11) * dokTextScale,
                fontWeight: 600,
                color: "#374151",
                margin: `0 0 ${10 * dokS}px 0`,
                fontFamily: F,
                lineHeight: 1.45,
                ...dokLineStyle,
              }}
            >
              {renderInlineMarkdown(el.intro)}
            </p>
          )}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: levelGap,
              flex: 1,
              justifyContent: "flex-start",
              minHeight: 0,
            }}
          >
            {(el.levels || []).map((lv, li) => {
              const c = LEVEL_COLORS[(lv.level || li + 1) - 1] || gv.color;
              return (
                <div
                  key={li}
                  style={{
                    background: c + "10",
                    border: `1.5px solid ${c}55`,
                    borderRadius: 8,
                    padding: `${8 * dokS}px ${10 * dokS}px`,
                  }}
                >
                  <p
                    style={{
                      fontSize: Math.max(fs - 4, 11) * dokTextScale,
                      fontWeight: 800,
                      color: c,
                      margin: `0 0 ${6 * dokS}px 0`,
                      fontFamily: FF,
                    }}
                  >
                    DOK {lv.level} · {lv.label}
                  </p>
                  <ul
                    style={{
                      listStyle: "none",
                      padding: 0,
                      margin: 0,
                      display: "flex",
                      flexDirection: "column",
                      gap: itemGap,
                    }}
                  >
                    {(lv.items || []).map((q, qi) => (
                      <li
                        key={qi}
                        style={{ display: "flex", alignItems: "flex-start", gap: 8 * dokS }}
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            flexShrink: 0,
                            width: 16 * dokS,
                            height: 16 * dokS,
                            marginTop: 2 * dokS,
                            border: `2px solid ${c}`,
                            borderRadius: 3,
                            background: "white",
                          }}
                        />
                        <span
                          style={{
                            fontSize: Math.max(fs - 1, 12) * dokTextScale,
                            fontWeight: elWeight || 600,
                            color: "#111827",
                            fontFamily: elFamily,
                            lineHeight: 1.45,
                            flex: 1,
                            minWidth: 0,
                            fontStyle: elStyle,
                            textDecoration: elDecor,
                            textAlign: elAlign,
                            ...dokLineStyle,
                          }}
                        >
                          {renderInlineMarkdown(q)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
        <DeleteBtn />
        <ResetBtn />
        <ResizeHandles />
      </div>
    );
  }

  if (el.type === "table") {
    const sc = resizeScaleFor(el);
    return (
      <div
        className="ws-element"
        style={wrap}
        onPointerDown={handleMouseDown}
        onClick={onClick}
        role="button"
        tabIndex={0}
        aria-label="Table element — click to edit"
        onKeyDown={(e) => e.key === "Enter" && onClick()}
      >
        {el.title && (
          <p
            style={{
              fontSize: Math.max(fs - 3, 12) * tScale(sc),
              fontWeight: elWeight || 700,
              color: "#111827",
              margin: `0 0 ${8 * sc.s}px 0`,
              fontFamily: elFamily,
            }}
          >
            {el.title}
          </p>
        )}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: Math.max(fs - 4, 11) * tScale(sc),
            fontFamily: elFamily,
          }}
          role="table"
        >
          <thead>
            <tr>
              {(el.headers || []).map((h, i) => (
                <th
                  key={i}
                  scope="col"
                  style={{
                    padding: `${7 * sc.s}px ${10 * sc.s}px`,
                    border: `1.5px solid ${gv.color}`,
                    background: gv.color,
                    color: "white",
                    fontWeight: 700,
                    textAlign: "center",
                    fontFamily: F,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(el.rows || []).map((row, ri) => (
              <tr key={ri}>
                {(row || []).map((cell, ci) => (
                  <td
                    key={ci}
                    style={{
                      padding: `${5 * sc.s}px ${9 * sc.s}px`,
                      border: "1px solid #D1D5DB",
                      height: gv.lineH * sc.s,
                      verticalAlign: "top",
                    }}
                  >
                    {cell || " "}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <DeleteBtn />
        <ResetBtn />
        <ResizeHandles />
      </div>
    );
  }

  if (el.type === "divider")
    return (
      <div
        className="ws-element"
        style={wrap}
        onPointerDown={handleMouseDown}
        onClick={onClick}
        role="separator"
        tabIndex={0}
        aria-label="Section divider"
        onKeyDown={(e) => e.key === "Enter" && onClick()}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0" }}>
          <div
            style={{
              flex: 1,
              height: 1,
              background: `linear-gradient(to right, transparent, ${gv.color}35)`,
            }}
          />
          <span aria-hidden="true" style={{ fontSize: 14, color: gv.color + "80" }}>
            ✦
          </span>
          <div
            style={{
              flex: 1,
              height: 1,
              background: `linear-gradient(to left, transparent, ${gv.color}35)`,
            }}
          />
        </div>
      </div>
    );

  if (el.type === "customShape") {
    const shapes = el.shapes || [];
    const colMap = { "1-col": 1, "2-col": 2, "3-col": 3, "4-col": 4, "2x2": 2 };
    const requestedCols = colMap[el.layout] || 2;
    const orientation = el.orientation || "horizontal"; // "horizontal" | "vertical"
    // Vertical = stack in a single column (one shape per row).
    const cols = orientation === "vertical" ? 1 : requestedCols;
    const fs = el.fontSizeOverride || gv.fontSize;
    // When the user resizes the customShape wrapper, scale shapes proportionally
    // to fill the new width and height (fixes "shapes don't resize").
    const userSized = !!(el.widthOverride || el.heightOverride);
    return (
      <div
        className="ws-element"
        style={wrap}
        onPointerDown={handleMouseDown}
        onClick={onClick}
        role="button"
        tabIndex={0}
        aria-label="Custom shapes element — click to edit"
        onKeyDown={(e) => e.key === "Enter" && onClick()}
      >
        {el.title && (
          <p
            style={{
              fontSize: Math.max(fs - 1, 12),
              fontWeight: 700,
              color: "#111827",
              margin: "0 0 12px 0",
              fontFamily:
                el.fontFamily && el.fontFamily !== "default" ? el.fontFamily : "'Inter',sans-serif",
            }}
          >
            {el.title}
          </p>
        )}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: 16,
            alignItems: "start",
          }}
        >
          {shapes.map((s, i) => {
            // If user-sized, ignore fixed s.width and let the SVG scale to its
            // grid cell. Height scales proportionally based on cell count.
            const shapeW = userSized ? "100%" : s.width;
            const baseRowH = el.heightOverride
              ? Math.max(
                  80,
                  (el.heightOverride - 60) / Math.max(1, Math.ceil(shapes.length / cols)),
                )
              : null;
            const shapeH = userSized && baseRowH ? Math.round(baseRowH) : s.height;
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  width: "100%",
                }}
              >
                <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
                  <ShapeSVG
                    shape={s.shape}
                    fill={s.fill}
                    border={s.border}
                    borderWidth={s.borderWidth}
                    width={shapeW}
                    height={shapeH}
                    label={s.label}
                    lines={s.lines}
                    fontSize={fs}
                  />
                </div>
                {s.caption && (
                  <span
                    style={{
                      fontSize: Math.max(fs - 3, 10),
                      color: "#6B7280",
                      fontFamily: F,
                      fontWeight: 600,
                      textAlign: "center",
                    }}
                  >
                    {s.caption}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <DeleteBtn />
        <ResetBtn />
        <ResizeHandles />
      </div>
    );
  }

  return null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ELEMENT EDITOR
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ElEditor({ el, gv, onChange, onDelete, onMoveUp, onMoveDown, onDuplicate }) {
  const inp = { ...INP(), marginTop: 4 };
  if (!el)
    return (
      <div
        style={{ padding: 32, textAlign: "center", fontFamily: F, animation: "fadeIn 0.3s ease" }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 12,
            background: "#F3F4F6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 14px",
            fontSize: 24,
          }}
        >
          ✏️
        </div>
        <p style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.6, color: "#9CA3AF", margin: 0 }}>
          Select any element on the worksheet to edit its content and appearance here.
        </p>
      </div>
    );

  const paletteItem = PALETTE.find((p) => p.type === el.type);

  // Preset text-size buttons. These map to absolute pt values that work well
  // across all worksheet element types and stay readable when boxes are
  // resized. Selecting a preset writes el.fontSizeOverride; the numeric input
  // below remains available for fine-tuning. "Default" clears the override
  // and falls back to the grade-band default (gv.fontSize).
  const SIZE_PRESETS = [
    { key: "xs", label: "XS", pt: 10 },
    { key: "s", label: "S", pt: 12 },
    { key: "m", label: "M", pt: 14 },
    { key: "l", label: "L", pt: 18 },
    { key: "xl", label: "XL", pt: 22 },
    { key: "xxl", label: "XXL", pt: 28 },
  ];
  const activeSizePt = el.fontSizeOverride || null;

  // ── Typography section (shared by ALL worksheet element types) ──
  // Lock vs Auto toggle:
  //   • Lock  → fontSizeOverride is set (current preset, custom value, or
  //             the grade-default snapshot). Resizing the box will NOT change
  //             the rendered text size.
  //   • Auto  → fontSizeOverride is null. Text scales with the box.
  const isLocked = activeSizePt !== null;
  const TypographySection = () => (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #F3F4F6" }}>
      <p
        style={{
          fontFamily: F,
          fontSize: 10,
          fontWeight: 700,
          color: "#6B7280",
          textTransform: "uppercase",
          letterSpacing: 0.8,
          margin: "0 0 10px 0",
        }}
      >
        Typography
      </p>

      <label style={LBL}>Font Size Scaling</label>
      <div
        role="group"
        aria-label="Font size scaling mode"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 6,
          marginTop: 4,
          marginBottom: 10,
        }}
      >
        <button
          onClick={() => onChange({ fontSizeOverride: null })}
          aria-label="Auto — text scales when the box is resized"
          aria-pressed={!isLocked}
          title="Auto — text scales when the box is resized"
          style={{
            padding: "8px 0",
            borderRadius: 7,
            border: `1.5px solid ${!isLocked ? gv.color : "#E5E7EB"}`,
            background: !isLocked ? gv.light : "white",
            fontFamily: F,
            fontSize: 12,
            fontWeight: 800,
            cursor: "pointer",
            color: !isLocked ? gv.color : "#374151",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <span aria-hidden="true">↔</span> Auto-scale
        </button>
        <button
          onClick={() => onChange({ fontSizeOverride: el.fontSizeOverride || gv.fontSize })}
          aria-label="Lock — keep text size fixed when the box is resized"
          aria-pressed={isLocked}
          title="Lock — text stays the same size when the box is resized"
          style={{
            padding: "8px 0",
            borderRadius: 7,
            border: `1.5px solid ${isLocked ? gv.color : "#E5E7EB"}`,
            background: isLocked ? gv.light : "white",
            fontFamily: F,
            fontSize: 12,
            fontWeight: 800,
            cursor: "pointer",
            color: isLocked ? gv.color : "#374151",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <span aria-hidden="true">🔒</span> Lock size{isLocked ? ` (${activeSizePt}pt)` : ""}
        </button>
      </div>

      <label style={LBL}>Text Size</label>
      <div
        role="group"
        aria-label="Text size preset"
        style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginTop: 4 }}
      >
        <button
          key="default"
          onClick={() => onChange({ fontSizeOverride: null })}
          aria-label="Use grade-default text size"
          aria-pressed={activeSizePt === null}
          title={`Default (${gv.fontSize}pt)`}
          style={{
            padding: "6px 0",
            borderRadius: 6,
            border: `1.5px solid ${activeSizePt === null ? gv.color : "#E5E7EB"}`,
            background: activeSizePt === null ? gv.light : "white",
            fontFamily: F,
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            color: activeSizePt === null ? gv.color : "#374151",
          }}
        >
          Auto
        </button>
        {SIZE_PRESETS.map((p) => {
          const sel = activeSizePt === p.pt;
          return (
            <button
              key={p.key}
              onClick={() => onChange({ fontSizeOverride: p.pt })}
              aria-label={`Set text size ${p.label} (${p.pt}pt)`}
              aria-pressed={sel}
              title={`${p.label} — ${p.pt}pt`}
              style={{
                padding: "6px 0",
                borderRadius: 6,
                border: `1.5px solid ${sel ? gv.color : "#E5E7EB"}`,
                background: sel ? gv.light : "white",
                fontFamily: F,
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                color: sel ? gv.color : "#374151",
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
        <div>
          <label style={LBL}>Custom (pt)</label>
          <input
            type="number"
            min={8}
            max={72}
            value={el.fontSizeOverride || ""}
            placeholder={`${gv.fontSize}`}
            onChange={(e) =>
              onChange({ fontSizeOverride: e.target.value ? parseInt(e.target.value) : null })
            }
            style={{ ...inp, marginTop: 4 }}
            aria-label="Custom font size in points"
          />
        </div>
        <div>
          <label style={LBL}>Text Align</label>
          <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
            {[
              ["left", "←"],
              ["center", "≡"],
              ["right", "→"],
            ].map(([a, lbl]) => (
              <button
                key={a}
                onClick={() => onChange({ textAlign: a })}
                aria-label={`Align ${a}`}
                aria-pressed={(el.textAlign || "left") === a}
                style={{
                  flex: 1,
                  padding: "6px 0",
                  borderRadius: 6,
                  border: `1.5px solid ${(el.textAlign || "left") === a ? gv.color : "#E5E7EB"}`,
                  background: (el.textAlign || "left") === a ? gv.light : "white",
                  fontSize: 14,
                  cursor: "pointer",
                  color: (el.textAlign || "left") === a ? gv.color : "#6B7280",
                }}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>
      </div>

      <label style={LBL}>Font Family</label>
      <select
        value={el.fontFamily || "default"}
        onChange={(e) => onChange({ fontFamily: e.target.value })}
        style={inp}
        aria-label="Font family"
      >
        {WORKSHEET_FONTS.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      <label style={LBL}>Style</label>
      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        {[
          ["bold", "B", "Bold"],
          ["italic", "I", "Italic"],
          ["underline", "U", "Underline"],
        ].map(([k, lbl, aria]) => (
          <button
            key={k}
            onClick={() => onChange({ [k]: !el[k] })}
            aria-label={aria}
            aria-pressed={!!el[k]}
            style={{
              flex: 1,
              padding: "5px 0",
              borderRadius: 6,
              border: `1.5px solid ${el[k] ? gv.color : "#E5E7EB"}`,
              background: el[k] ? gv.light : "white",
              fontFamily: k === "italic" ? "Georgia, serif" : F,
              fontWeight: k === "bold" ? 800 : 600,
              fontStyle: k === "italic" ? "italic" : "normal",
              textDecoration: k === "underline" ? "underline" : "none",
              fontSize: 13,
              cursor: "pointer",
              color: el[k] ? gv.color : "#374151",
            }}
          >
            {lbl}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ padding: "14px 16px", overflowY: "auto", flex: 1 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <span style={{ fontFamily: F, fontWeight: 700, color: gv.color, fontSize: 13 }}>
          {paletteItem?.emoji} {paletteItem?.label || "Element"}
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={onMoveUp}
            aria-label="Move element up"
            style={{
              padding: "4px 9px",
              borderRadius: 6,
              border: "1.5px solid #E5E7EB",
              background: "white",
              cursor: "pointer",
              fontFamily: F,
              fontSize: 13,
              color: "#374151",
            }}
          >
            ↑
          </button>
          <button
            onClick={onMoveDown}
            aria-label="Move element down"
            style={{
              padding: "4px 9px",
              borderRadius: 6,
              border: "1.5px solid #E5E7EB",
              background: "white",
              cursor: "pointer",
              fontFamily: F,
              fontSize: 13,
              color: "#374151",
            }}
          >
            ↓
          </button>
          <button
            onClick={onDuplicate}
            aria-label="Duplicate element"
            title="Duplicate (Ctrl/Cmd+D)"
            style={{
              padding: "4px 9px",
              borderRadius: 6,
              border: "1.5px solid #BFDBFE",
              background: "#EFF6FF",
              cursor: "pointer",
              fontFamily: F,
              fontSize: 13,
              color: "#1D4ED8",
            }}
          >
            ⧉ Duplicate
          </button>
          <button
            onClick={onDelete}
            aria-label="Delete element"
            style={{
              padding: "4px 9px",
              borderRadius: 6,
              border: "1.5px solid #FCA5A5",
              background: "#FEF2F2",
              cursor: "pointer",
              fontFamily: F,
              fontSize: 13,
              color: "#DC2626",
            }}
          >
            Delete
          </button>
        </div>
      </div>

      {(el.type === "instruction" || el.type === "text") && (
        <>
          <label style={LBL}>Content</label>
          <SpellTextarea
            value={el.text}
            spellCheck
            onChange={(e) => onChange({ text: e.target.value })}
            style={{ ...inp, minHeight: 90, marginTop: 4 }}
            aria-label="Text content"
          />
          <TypographySection />
        </>
      )}

      {el.type === "image" && (
        <>
          <label style={LBL}>Image URL</label>
          <input
            type="url"
            value={el.url || ""}
            onChange={(e) => onChange({ url: e.target.value })}
            placeholder="https://…"
            style={{ ...inp, marginTop: 4 }}
            aria-label="Image URL"
          />
          <label style={LBL}>Upload from Device</label>
          <input
            type="file"
            accept="image/*"
            aria-label="Upload image file"
            onChange={(e) => {
              const f = e.target.files[0];
              if (f) {
                const r = new FileReader();
                r.onload = (ev) => onChange({ url: ev.target.result });
                r.readAsDataURL(f);
              }
            }}
            style={{ ...inp, padding: 6, cursor: "pointer", marginTop: 4 }}
          />
          <label style={LBL}>Caption</label>
          <SpellInput
            type="text"
            value={el.caption || ""}
            spellCheck
            onChange={(e) => onChange({ caption: e.target.value })}
            placeholder="Optional caption…"
            style={{ ...inp, marginTop: 4 }}
            aria-label="Image caption"
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 4 }}>
            <div>
              <label style={LBL}>Size</label>
              <select
                value={el.size || "medium"}
                onChange={(e) => onChange({ size: e.target.value })}
                style={{ ...inp, marginTop: 4 }}
                aria-label="Image size"
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </div>
            <div>
              <label style={LBL}>Alignment</label>
              <select
                value={el.align || "center"}
                onChange={(e) => onChange({ align: e.target.value })}
                style={{ ...inp, marginTop: 4 }}
                aria-label="Image alignment"
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>
          </div>
          <TypographySection />
        </>
      )}

      {el.type === "blank" && (
        <>
          <label style={LBL}>Label / Question</label>
          <SpellInput
            type="text"
            value={el.label || ""}
            spellCheck
            onChange={(e) => onChange({ label: e.target.value })}
            style={{ ...inp, marginTop: 4 }}
            aria-label="Write lines label"
          />
          <label style={LBL}>Number of Lines</label>
          <input
            type="number"
            min={1}
            max={20}
            value={el.lines || 3}
            onChange={(e) => onChange({ lines: Math.max(1, parseInt(e.target.value) || 1) })}
            style={{ ...inp, marginTop: 4 }}
            aria-label="Number of lines"
          />
          <TypographySection />
        </>
      )}

      {el.type === "wordBank" && (
        <>
          <label style={LBL}>Title</label>
          <SpellInput
            type="text"
            value={el.title || ""}
            spellCheck
            onChange={(e) => onChange({ title: e.target.value })}
            style={{ ...inp, marginTop: 4 }}
            aria-label="Word bank title"
          />
          <label style={LBL}>Words (one per line — press Enter for a new word)</label>
          {/* Preserve raw text (including trailing empty lines) so Enter creates a new line.
            Only trim/filter when rendering the worksheet preview. */}
          <SpellTextarea
            value={el._wordsRaw !== undefined ? el._wordsRaw : (el.words || []).join("\n")}
            spellCheck
            onChange={(e) => {
              const raw = e.target.value;
              const words = raw
                .split("\n")
                .map((w) => w.trim())
                .filter(Boolean);
              onChange({ _wordsRaw: raw, words });
            }}
            style={{ ...inp, minHeight: 110, marginTop: 4 }}
            aria-label="Word bank words"
            placeholder={"cat\ndog\nfish"}
          />
          <TypographySection />
        </>
      )}

      {el.type === "matching" && (
        <>
          <label style={LBL}>Title</label>
          <SpellInput
            type="text"
            value={el.title || ""}
            spellCheck
            onChange={(e) => onChange({ title: e.target.value })}
            style={{ ...inp, marginTop: 4 }}
            aria-label="Matching title"
          />
          <label style={LBL}>Left Column (one per line — press Enter for a new item)</label>
          <SpellTextarea
            value={el._leftRaw !== undefined ? el._leftRaw : (el.left || []).join("\n")}
            spellCheck
            onChange={(e) => {
              const raw = e.target.value;
              onChange({
                _leftRaw: raw,
                left: raw
                  .split("\n")
                  .map((x) => x.trim())
                  .filter(Boolean),
              });
            }}
            style={{ ...inp, minHeight: 80, marginTop: 4 }}
            aria-label="Left column items"
          />
          <label style={LBL}>Right Column (one per line — press Enter for a new item)</label>
          <SpellTextarea
            value={el._rightRaw !== undefined ? el._rightRaw : (el.right || []).join("\n")}
            spellCheck
            onChange={(e) => {
              const raw = e.target.value;
              onChange({
                _rightRaw: raw,
                right: raw
                  .split("\n")
                  .map((x) => x.trim())
                  .filter(Boolean),
              });
            }}
            style={{ ...inp, minHeight: 80, marginTop: 4 }}
            aria-label="Right column items"
          />
          <TypographySection />
        </>
      )}

      {el.type === "multipleChoice" && (
        <>
          <label style={LBL}>Question</label>
          <SpellInput
            type="text"
            value={el.question || ""}
            spellCheck
            onChange={(e) => onChange({ question: e.target.value })}
            style={{ ...inp, marginTop: 4 }}
            aria-label="Question text"
          />
          <label style={LBL}>Instruction</label>
          <SpellInput
            type="text"
            value={el.note || ""}
            spellCheck
            onChange={(e) => onChange({ note: e.target.value })}
            style={{ ...inp, marginTop: 4 }}
            aria-label="Instruction note"
          />
          <label style={LBL}>Answer Choices (one per line — press Enter for a new choice)</label>
          <SpellTextarea
            value={el._choicesRaw !== undefined ? el._choicesRaw : (el.choices || []).join("\n")}
            spellCheck
            onChange={(e) => {
              const raw = e.target.value;
              onChange({
                _choicesRaw: raw,
                choices: raw
                  .split("\n")
                  .map((c) => c.trim())
                  .filter(Boolean),
              });
            }}
            style={{ ...inp, minHeight: 90, marginTop: 4 }}
            aria-label="Answer choices"
          />
          <TypographySection />
        </>
      )}

      {el.type === "truefalse" && (
        <>
          <label style={LBL}>Statements (one per line — press Enter for a new statement)</label>
          <SpellTextarea
            value={
              el._statementsRaw !== undefined ? el._statementsRaw : (el.statements || []).join("\n")
            }
            spellCheck
            onChange={(e) => {
              const raw = e.target.value;
              onChange({
                _statementsRaw: raw,
                statements: raw
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
              });
            }}
            style={{ ...inp, minHeight: 120, marginTop: 4 }}
            aria-label="True/false statements"
          />
          <TypographySection />
        </>
      )}

      {el.type === "shortAnswer" && (
        <>
          <label style={LBL}>Question</label>
          <SpellTextarea
            value={el.question || ""}
            spellCheck
            onChange={(e) => onChange({ question: e.target.value })}
            style={{ ...inp, minHeight: 70, marginTop: 4 }}
            aria-label="Short answer question"
          />
          <label style={LBL}>Number of Lines</label>
          <input
            type="number"
            min={1}
            max={20}
            value={el.lines || 4}
            onChange={(e) => onChange({ lines: Math.max(1, parseInt(e.target.value) || 1) })}
            style={{ ...inp, marginTop: 4 }}
            aria-label="Number of answer lines"
          />
          <TypographySection />
        </>
      )}

      {el.type === "fillBlank" && (
        <>
          <label style={LBL}>
            Text (use{" "}
            <code style={{ background: "#F3F4F6", padding: "1px 4px", borderRadius: 3 }}>
              ______
            </code>{" "}
            for blanks)
          </label>
          <SpellTextarea
            value={el.text || ""}
            spellCheck
            onChange={(e) => onChange({ text: e.target.value })}
            style={{ ...inp, minHeight: 80, marginTop: 4 }}
            placeholder="The ___ is blue."
            aria-label="Fill in the blank text"
          />
          <label style={LBL}>Hint / Note</label>
          <SpellInput
            type="text"
            value={el.note || ""}
            spellCheck
            onChange={(e) => onChange({ note: e.target.value })}
            style={{ ...inp, marginTop: 4 }}
            aria-label="Hint note"
          />
          <TypographySection />
        </>
      )}

      {el.type === "essay" && (
        <>
          <label style={LBL}>Essay Prompt</label>
          <SpellTextarea
            value={el.prompt || ""}
            spellCheck
            onChange={(e) => onChange({ prompt: e.target.value })}
            style={{ ...inp, minHeight: 90, marginTop: 4 }}
            aria-label="Essay prompt"
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 4 }}>
            <div>
              <label style={LBL}>Point Value</label>
              <input
                type="number"
                min={1}
                max={100}
                value={el.points || 10}
                onChange={(e) => onChange({ points: parseInt(e.target.value) || 10 })}
                style={{ ...inp, marginTop: 4 }}
                aria-label="Point value"
              />
            </div>
            <div>
              <label style={LBL}>Lines</label>
              <input
                type="number"
                min={4}
                max={40}
                value={el.lines || 14}
                onChange={(e) => onChange({ lines: parseInt(e.target.value) || 14 })}
                style={{ ...inp, marginTop: 4 }}
                aria-label="Number of essay lines"
              />
            </div>
          </div>
          <TypographySection />
        </>
      )}

      {el.type === "table" && (
        <>
          <label style={LBL}>Title</label>
          <SpellInput
            type="text"
            value={el.title || ""}
            spellCheck
            onChange={(e) => onChange({ title: e.target.value })}
            style={{ ...inp, marginTop: 4 }}
            aria-label="Table title"
          />
          <label style={LBL}>Column Headers (one per line — press Enter for a new column)</label>
          <SpellTextarea
            value={el._headersRaw !== undefined ? el._headersRaw : (el.headers || []).join("\n")}
            spellCheck
            onChange={(e) => {
              const raw = e.target.value;
              onChange({
                _headersRaw: raw,
                headers: raw
                  .split("\n")
                  .map((h) => h.trim())
                  .filter(Boolean),
              });
            }}
            style={{ ...inp, minHeight: 60, marginTop: 4 }}
            aria-label="Column headers"
          />
          <label style={LBL}>Number of Rows</label>
          <input
            type="number"
            min={1}
            max={20}
            value={(el.rows || []).length || 3}
            onChange={(e) => {
              const n = Math.max(1, parseInt(e.target.value) || 1);
              const cols = (el.headers || []).length || 3;
              onChange({
                rows: Array.from({ length: n }, (_, i) => el.rows?.[i] || Array(cols).fill("")),
              });
            }}
            style={{ ...inp, marginTop: 4 }}
            aria-label="Number of rows"
          />
          <TypographySection />
        </>
      )}

      {el.type === "customShape" && (
        <>
          <CustomShapeEditor el={el} onChange={onChange} gv={gv} inp={inp} />
          <TypographySection />
        </>
      )}

      {(el.type === "successCriteria" || el.type === "exitTicket") && (
        <>
          <ChecklistEditor el={el} onChange={onChange} gv={gv} inp={inp} />
          <TypographySection />
        </>
      )}

      {el.type === "dokQuestions" && (
        <>
          <DokEditor el={el} onChange={onChange} gv={gv} inp={inp} />
          <TypographySection />
        </>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DOK QUESTIONS EDITOR
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function DokEditor({ el, onChange, gv, inp }) {
  const mode = el.mode || "manual";
  const [topic, setTopic] = useState(el.topic || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // Levels the AI couldn't generate — triggers a follow-up prompt to the user.
  const [missingLevels, setMissingLevels] = useState<number[]>([]);
  const [clarification, setClarification] = useState("");
  const [aiNotice, setAiNotice] = useState("");

  // Call the AI gateway with a DOK-shaped prompt. `onlyLevels` lets us re-ask
  // for just the levels that came back empty on a prior attempt.
  const callAI = async (promptTopic: string, onlyLevels?: number[], extraContext?: string) => {
    const levelsBlock =
      onlyLevels && onlyLevels.length
        ? `Generate 2–3 student-facing questions for ONLY these DOK levels: ${onlyLevels.join(", ")}. Return objects only for those levels.`
        : `Generate 2–3 student-facing questions for EACH of the 4 DOK levels. EVERY level (1, 2, 3, and 4) MUST have at least 2 non-empty items — do not skip any level.`;
    const sys = `You design Depth of Knowledge (DOK) question sets for K–12 lessons based on Norman Webb's framework. DOK measures the depth of cognitive complexity, NOT difficulty.
- Level 1 (Recall & Reproduction): recall facts, terms, simple routine procedures (identify, name, point to, tell).
- Level 2 (Skills & Concepts): apply skills/concepts in specific contexts (describe, show, sort, match, basic inferences).
- Level 3 (Strategic Thinking): reasoning, planning, using evidence to support conclusions in non-routine problems (explain, why, predict, justify).
- Level 4 (Extended Thinking): complex reasoning, integrating multiple sources, sustained effort, project-based / creative (create, design, compare, act out, tell your own story).
${levelsBlock}
Calibrate vocabulary and complexity to ${gv.name} (${BANDS[gv.band]?.label}). Use student-friendly language.
Return ONLY a JSON array of objects in level order, with this shape:
[{"level":1,"label":"Recall & Reproduction","items":["...","..."]}, ...]
No markdown, no preamble, no commentary.`;
    const userMsg = extraContext
      ? `Topic / standard / text: ${promptTopic}\n\nAdditional context from the teacher: ${extraContext}`
      : `Topic / standard / text: ${promptTopic}`;
    const raw =
      (await callAiRaw({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        system: sys,
        messages: [{ role: "user", content: userMsg }],
      })) || "[]";
    return repairAndParse(raw, { container: "array" }) as any[];
  };

  // Merge AI results into the existing levels, returning the new array and the
  // list of level numbers that are still missing usable content.
  const mergeLevels = (existing: any[], incoming: any[]) => {
    const merged = DOK_LEVEL_DEFS.map((def) => {
      const prior = existing.find((p) => Number(p?.level) === def.level);
      const found = incoming.find((p) => Number(p?.level) === def.level);
      const newItems = Array.isArray(found?.items)
        ? found.items.map((x: any) => String(x).trim()).filter(Boolean)
        : [];
      const priorItems = Array.isArray(prior?.items)
        ? prior.items
            .map((x: any) => String(x).trim())
            .filter((s: string) => s && s !== "(add a question)")
        : [];
      const items = newItems.length ? newItems : priorItems;
      return { level: def.level, label: def.label, items };
    });
    const missing = merged.filter((lv) => lv.items.length === 0).map((lv) => lv.level);
    return { merged, missing };
  };

  const generate = async (clarif?: string, onlyLevels?: number[]) => {
    if (!topic.trim() || busy) return;
    setBusy(true);
    setErr("");
    setAiNotice("");
    try {
      const parsed = await callAI(topic, onlyLevels, clarif);
      if (!Array.isArray(parsed) || parsed.length === 0)
        throw new Error("AI did not return DOK levels");
      const baseLevels = onlyLevels ? el.levels || [] : [];
      let { merged, missing } = mergeLevels(baseLevels, parsed);

      // One automatic retry targeting just the missing levels with a stronger ask.
      if (missing.length && !onlyLevels) {
        try {
          const retry = await callAI(topic, missing, clarif);
          ({ merged, missing } = mergeLevels(merged, retry));
        } catch {
          /* fall through to follow-up prompt */
        }
      }

      // Persist what we have so the teacher can edit it directly.
      const finalLevels = merged.map((lv) => ({
        ...lv,
        items: lv.items.length ? lv.items : ["(add a question)"],
      }));
      onChange({ levels: finalLevels, mode: "ai", topic });

      if (missing.length) {
        setMissingLevels(missing);
        setAiNotice(
          `AI couldn't generate enough material for DOK ${missing.join(", ")}. Add a quick clarification below and we'll fill those in.`,
        );
      } else {
        setMissingLevels([]);
        setClarification("");
        setAiNotice("✅ All 4 DOK levels generated. Edit any question below to fine-tune.");
      }
    } catch (e: any) {
      setErr(e?.message || "Could not generate. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const updateLevelItems = (li, text) => {
    const next = (el.levels || []).map((lv, i) =>
      i === li
        ? {
            ...lv,
            items: text
              .split("\n")
              .map((s) => s.trimStart())
              .filter((s) => s.trim().length),
          }
        : lv,
    );
    onChange({ levels: next });
  };

  const LBL = {
    display: "block",
    fontSize: 11,
    fontWeight: 700,
    color: "#374151",
    marginTop: 10,
    fontFamily: F,
  };
  const LEVEL_COLORS = ["#10B981", "#0EA5E9", "#8B5CF6", "#F59E0B"];

  return (
    <div style={{ marginTop: 4 }}>
      <label style={LBL}>Title</label>
      <SpellInput
        type="text"
        value={el.title || ""}
        spellCheck
        onChange={(e) => onChange({ title: e.target.value })}
        style={{ ...inp, marginTop: 4 }}
        aria-label="Title"
      />

      <label style={LBL}>Intro / Directions</label>
      <SpellInput
        type="text"
        value={el.intro || ""}
        spellCheck
        onChange={(e) => onChange({ intro: e.target.value })}
        style={{ ...inp, marginTop: 4 }}
        aria-label="Intro line"
      />

      <label style={LBL}>How to fill this in</label>
      <select
        value={mode}
        onChange={(e) => onChange({ mode: e.target.value })}
        style={{ ...inp, marginTop: 4, minHeight: 40 }}
        aria-label="Generation mode"
      >
        <option value="manual">✍️ Build your own</option>
        <option value="ai">✨ AI generation</option>
      </select>

      {mode === "ai" && (
        <div
          style={{
            marginTop: 10,
            padding: 10,
            borderRadius: 8,
            background: "#FAFAFA",
            border: "1px solid #E5E7EB",
          }}
        >
          <label style={{ ...LBL, marginTop: 0 }}>Topic, standard, or text excerpt</label>
          <SpellTextarea
            value={topic}
            spellCheck
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Identify the main character in a short story about friendship"
            style={{ ...inp, minHeight: 70, marginTop: 4 }}
            aria-label="AI prompt"
          />
          <button
            type="button"
            onClick={() => generate()}
            disabled={busy || !topic.trim()}
            style={{
              marginTop: 8,
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: `1.5px solid ${gv.color}`,
              background: busy ? "#F3F4F6" : gv.color,
              color: busy ? "#6B7280" : "white",
              fontFamily: F,
              fontWeight: 800,
              fontSize: 13,
              cursor: busy ? "wait" : "pointer",
              minHeight: 44,
            }}
          >
            {busy ? "Generating…" : "✨ Generate DOK Questions"}
          </button>
          {err && (
            <p
              role="alert"
              style={{
                fontSize: 14,
                color: "#B91C1C",
                margin: "8px 0 0",
                fontFamily: F,
                lineHeight: 1.5,
              }}
            >
              {err}
            </p>
          )}
          {aiNotice && !err && (
            <p
              role="status"
              style={{
                fontSize: 12,
                color: missingLevels.length ? "#B45309" : "#047857",
                margin: "8px 0 0",
                fontFamily: F,
                lineHeight: 1.5,
                fontWeight: 700,
              }}
            >
              {aiNotice}
            </p>
          )}
          {missingLevels.length > 0 && (
            <div
              style={{
                marginTop: 10,
                padding: 10,
                borderRadius: 8,
                background: "#FEF3C7",
                border: "1.5px solid #F59E0B",
              }}
            >
              <label style={{ ...LBL, marginTop: 0, color: "#92400E" }}>
                Follow-up: tell the AI more about DOK {missingLevels.join(", ")}
              </label>
              <SpellTextarea
                value={clarification}
                spellCheck
                onChange={(e) => setClarification(e.target.value)}
                placeholder="e.g. Focus on a specific text, add a real-world scenario, or describe what students should create."
                style={{ ...inp, minHeight: 60, marginTop: 4 }}
                aria-label="Clarification prompt for missing DOK levels"
              />
              <button
                type="button"
                onClick={() => generate(clarification, missingLevels)}
                disabled={busy || !clarification.trim()}
                style={{
                  marginTop: 8,
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1.5px solid #B45309",
                  background: busy ? "#F3F4F6" : "#B45309",
                  color: busy ? "#6B7280" : "white",
                  fontFamily: F,
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: busy ? "wait" : "pointer",
                  minHeight: 44,
                }}
              >
                {busy ? "Retrying…" : `↻ Fill in DOK ${missingLevels.join(", ")}`}
              </button>
            </div>
          )}
        </div>
      )}

      <p
        style={{
          fontSize: 11,
          color: "#6B7280",
          margin: "12px 0 0",
          fontFamily: F,
          lineHeight: 1.5,
        }}
      >
        ✏️ All questions below are editable — tweak the AI's wording, add your own, or remove ones
        you don't need. One question per line.
      </p>

      {DOK_LEVEL_DEFS.map((def, li) => {
        const lv = (el.levels || [])[li] || { level: def.level, label: def.label, items: [] };
        const c = LEVEL_COLORS[li];
        return (
          <div
            key={def.level}
            style={{
              marginTop: 10,
              padding: 10,
              borderRadius: 8,
              background: c + "10",
              border: `1.5px solid ${c}55`,
            }}
          >
            <p style={{ fontSize: 12, fontWeight: 800, color: c, margin: 0, fontFamily: F }}>
              DOK {def.level} · {def.label}
            </p>
            <p
              style={{
                fontSize: 10,
                color: "#6B7280",
                margin: "2px 0 6px",
                fontFamily: F,
                fontStyle: "italic",
              }}
            >
              {def.desc}
            </p>
            <SpellTextarea
              value={(lv.items || []).join("\n")}
              spellCheck
              onChange={(e) => updateLevelItems(li, e.target.value)}
              style={{ ...inp, minHeight: 80, marginTop: 4 }}
              placeholder="One question per line"
              aria-label={`DOK Level ${def.level} questions`}
            />
          </div>
        );
      })}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CHECKLIST EDITOR (Success Criteria & Exit Ticket)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ChecklistEditor({ el, onChange, gv, inp }) {
  const isSuccess = el.type === "successCriteria";
  const accent = isSuccess ? gv.color : "#0369A1";
  const mode = el.mode || "manual";
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const generate = async () => {
    if (!topic.trim() || busy) return;
    setBusy(true);
    setErr("");
    const sysSuccess = `You design student-friendly success criteria for K–12 lessons. Success criteria are specific, measurable, standards-aligned skills written as "I can …" statements. They tell students exactly what to demonstrate to meet a learning objective. Calibrate vocabulary and complexity to ${gv.name} (${BANDS[gv.band]?.label}). Return ONLY a JSON array of 3–6 short "I can …" strings — no markdown, no preamble. Example: ["I can look at the picture.","I can read the text.","I can identify the character in the story."]`;
    const sysExit = `You design quick formative exit tickets for K–12 lessons. Exit tickets are brief (1–5 minute) end-of-lesson self-checks. Items should be checkable statements students can mark off, e.g. participation, completion, or demonstration of one specific concept. Calibrate vocabulary to ${gv.name} (${BANDS[gv.band]?.label}). Return ONLY a JSON array of 3–6 short statements — no markdown, no preamble. Example: ["I participated in class.","I completed the reading assignment.","I participated in at least two center activities."]`;
    try {
      const raw =
        (await callAiRaw({
          model: "claude-sonnet-4-20250514",
          max_tokens: 500,
          system: isSuccess ? sysSuccess : sysExit,
          messages: [{ role: "user", content: `Topic / lesson objective: ${topic}` }],
        })) || "[]";
      const clean = raw.replace(/```json|```/g, "").trim();
      const s = clean.indexOf("[");
      const e = clean.lastIndexOf("]");
      const slice = s >= 0 && e > s ? clean.slice(s, e + 1) : clean;
      const parsed = JSON.parse(slice);
      if (!Array.isArray(parsed) || !parsed.length) throw new Error("AI did not return a list");
      onChange({ items: parsed.map((x) => String(x).trim()).filter(Boolean), mode: "ai" });
    } catch (e) {
      setErr(e?.message || "Could not generate. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const LBL = {
    display: "block",
    fontSize: 11,
    fontWeight: 700,
    color: "#374151",
    marginTop: 10,
    fontFamily: F,
  };

  return (
    <div style={{ marginTop: 4 }}>
      <label style={LBL}>Title</label>
      <SpellInput
        type="text"
        value={el.title || ""}
        spellCheck
        onChange={(e) => onChange({ title: e.target.value })}
        style={{ ...inp, marginTop: 4 }}
        aria-label="Title"
      />

      <label style={LBL}>Intro / Directions</label>
      <SpellInput
        type="text"
        value={el.intro || ""}
        spellCheck
        onChange={(e) => onChange({ intro: e.target.value })}
        style={{ ...inp, marginTop: 4 }}
        aria-label="Intro line"
      />

      <label style={LBL}>How to fill this in</label>
      <select
        value={mode}
        onChange={(e) => onChange({ mode: e.target.value })}
        style={{ ...inp, marginTop: 4, minHeight: 40 }}
        aria-label="Generation mode"
      >
        <option value="manual">✍️ Build your own</option>
        <option value="ai">✨ AI generation</option>
      </select>

      {mode === "ai" && (
        <div
          style={{
            marginTop: 10,
            padding: 10,
            borderRadius: 8,
            background: "#FAFAFA",
            border: "1px solid #E5E7EB",
          }}
        >
          <label style={{ ...LBL, marginTop: 0 }}>
            {isSuccess ? "Learning objective / standard" : "Lesson topic or focus"}
          </label>
          <SpellTextarea
            value={topic}
            spellCheck
            onChange={(e) => setTopic(e.target.value)}
            placeholder={
              isSuccess
                ? "e.g. Identify the main character in a short story"
                : "e.g. End of ELA lesson on character traits"
            }
            style={{ ...inp, minHeight: 60, marginTop: 4 }}
            aria-label="AI prompt"
          />
          <button
            type="button"
            onClick={generate}
            disabled={busy || !topic.trim()}
            style={{
              marginTop: 8,
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: `1.5px solid ${accent}`,
              background: busy ? "#F3F4F6" : accent,
              color: busy ? "#6B7280" : "white",
              fontFamily: F,
              fontWeight: 800,
              fontSize: 13,
              cursor: busy ? "wait" : "pointer",
              minHeight: 44,
            }}
          >
            {busy ? "Generating…" : `✨ Generate ${isSuccess ? "Success Criteria" : "Exit Ticket"}`}
          </button>
          {err && (
            <p
              role="alert"
              style={{
                fontSize: 12,
                color: "#B91C1C",
                margin: "8px 0 0",
                fontFamily: F,
                lineHeight: 1.5,
              }}
            >
              {err}
            </p>
          )}
        </div>
      )}

      <label style={LBL}>
        Items {mode === "ai" ? "(generated — edit freely; one per line)" : "(one per line)"}
      </label>
      <SpellTextarea
        value={(el.items || []).join("\n")}
        spellCheck
        onChange={(e) =>
          onChange({
            items: e.target.value
              .split("\n")
              .map((s) => s.trimStart())
              .filter((s) => s.trim().length),
          })
        }
        style={{ ...inp, minHeight: 110, marginTop: 4 }}
        placeholder={
          isSuccess
            ? "I can look at the picture.\nI can read the text.\nI can identify the character in the story."
            : "I participated in class.\nI completed the reading assignment.\nI participated in at least two center activities."
        }
        aria-label="Checklist items"
      />
      <p
        style={{
          fontSize: 11,
          color: "#6B7280",
          margin: "6px 0 0",
          fontFamily: F,
          lineHeight: 1.5,
        }}
      >
        Each item appears on the worksheet with a check-off box.
      </p>
    </div>
  );
}

function CustomShapeEditor({ el, onChange, gv, inp }) {
  const shapes = el.shapes || [];
  const [activeIdx, setActiveIdx] = useState(0);
  const [editorTab, setEditorTab] = useState("presets"); // "presets" | "custom"
  const active = shapes[activeIdx] || shapes[0];

  // ── BUILD PRESETS ──────────────────────────────────────────────────
  const BUILD_PRESETS = [
    {
      id: "vocab",
      label: "Vocabulary Cards",
      icon: "🔤",
      desc: "4-card grid — word, definition, picture box, sentence",
      layout: "2-col",
      title: "Vocabulary",
      shapes: [
        {
          shape: "rounded",
          label: "Word",
          fill: "#EFF6FF",
          border: "#0369A1",
          borderWidth: 2,
          width: 180,
          height: 60,
          lines: 0,
          caption: "",
        },
        {
          shape: "rounded",
          label: "Picture",
          fill: "#F9FAFB",
          border: "#9CA3AF",
          borderWidth: 1.5,
          width: 180,
          height: 100,
          lines: 0,
          caption: "Draw or paste image here",
        },
        {
          shape: "rectangle",
          label: "Definition",
          fill: "#FFFFFF",
          border: "#0369A1",
          borderWidth: 1.5,
          width: 180,
          height: 90,
          lines: 3,
          caption: "",
        },
        {
          shape: "rectangle",
          label: "Use it in a sentence",
          fill: "#FFFFFF",
          border: "#0369A1",
          borderWidth: 1.5,
          width: 180,
          height: 80,
          lines: 2,
          caption: "",
        },
      ],
    },
    {
      id: "kwl",
      label: "KWL Chart",
      icon: "📊",
      desc: "3 columns: Know / Want to Know / Learned",
      layout: "3-col",
      title: "KWL Chart",
      shapes: [
        {
          shape: "rectangle",
          label: "K — What I KNOW",
          fill: "#FFF7ED",
          border: "#B45309",
          borderWidth: 2,
          width: 180,
          height: 220,
          lines: 6,
          caption: "",
        },
        {
          shape: "rectangle",
          label: "W — What I WANT to Know",
          fill: "#F0F9FF",
          border: "#0369A1",
          borderWidth: 2,
          width: 180,
          height: 220,
          lines: 6,
          caption: "",
        },
        {
          shape: "rectangle",
          label: "L — What I LEARNED",
          fill: "#F0FDF4",
          border: "#166534",
          borderWidth: 2,
          width: 180,
          height: 220,
          lines: 6,
          caption: "",
        },
      ],
    },
    {
      id: "venn",
      label: "Venn Diagram",
      icon: "⭕",
      desc: "Two overlapping circles with a shared middle",
      layout: "3-col",
      title: "Compare and Contrast",
      shapes: [
        {
          shape: "circle",
          label: "Topic A",
          fill: "#EFF6FF",
          border: "#0369A1",
          borderWidth: 2,
          width: 160,
          height: 160,
          lines: 3,
          caption: "Only Topic A",
        },
        {
          shape: "rounded",
          label: "Both",
          fill: "#F5F3FF",
          border: "#6D28D9",
          borderWidth: 2,
          width: 130,
          height: 160,
          lines: 4,
          caption: "Similarities",
        },
        {
          shape: "circle",
          label: "Topic B",
          fill: "#FFF7ED",
          border: "#B45309",
          borderWidth: 2,
          width: 160,
          height: 160,
          lines: 3,
          caption: "Only Topic B",
        },
      ],
    },
    {
      id: "causeeffect",
      label: "Cause & Effect",
      icon: "➡️",
      desc: "Cause box → arrow → effect box",
      layout: "3-col",
      title: "Cause and Effect",
      shapes: [
        {
          shape: "rounded",
          label: "CAUSE",
          fill: "#FEF2F2",
          border: "#DC2626",
          borderWidth: 2,
          width: 180,
          height: 130,
          lines: 3,
          caption: "What happened?",
        },
        {
          shape: "arrow",
          label: "leads to",
          fill: "#F3F4F6",
          border: "#6B7280",
          borderWidth: 1.5,
          width: 120,
          height: 60,
          lines: 0,
          caption: "",
        },
        {
          shape: "rounded",
          label: "EFFECT",
          fill: "#F0FDF4",
          border: "#166534",
          borderWidth: 2,
          width: 180,
          height: 130,
          lines: 3,
          caption: "What was the result?",
        },
      ],
    },
    {
      id: "storymap",
      label: "Story Map",
      icon: "📖",
      desc: "Setting, Characters, Problem, Solution, Theme",
      layout: "2-col",
      title: "Story Map",
      shapes: [
        {
          shape: "rounded",
          label: "Setting",
          fill: "#FFF7ED",
          border: "#B45309",
          borderWidth: 2,
          width: 190,
          height: 90,
          lines: 2,
          caption: "When and where?",
        },
        {
          shape: "rounded",
          label: "Characters",
          fill: "#EFF6FF",
          border: "#0369A1",
          borderWidth: 2,
          width: 190,
          height: 90,
          lines: 2,
          caption: "Who is in the story?",
        },
        {
          shape: "rounded",
          label: "Problem",
          fill: "#FEF2F2",
          border: "#DC2626",
          borderWidth: 2,
          width: 190,
          height: 100,
          lines: 3,
          caption: "What is the conflict?",
        },
        {
          shape: "rounded",
          label: "Solution",
          fill: "#F0FDF4",
          border: "#166534",
          borderWidth: 2,
          width: 190,
          height: 100,
          lines: 3,
          caption: "How is it solved?",
        },
        {
          shape: "rectangle",
          label: "Theme / Lesson",
          fill: "#F5F3FF",
          border: "#6D28D9",
          borderWidth: 2,
          width: 190,
          height: 80,
          lines: 2,
          caption: "What did we learn?",
        },
      ],
    },
    {
      id: "wh",
      label: "Wh- Questions",
      icon: "❓",
      desc: "Who / What / When / Where / Why / How",
      layout: "2-col",
      title: "Answer the Questions",
      shapes: [
        {
          shape: "rounded",
          label: "Who?",
          fill: "#EFF6FF",
          border: "#0369A1",
          borderWidth: 2,
          width: 190,
          height: 90,
          lines: 2,
          caption: "",
        },
        {
          shape: "rounded",
          label: "What?",
          fill: "#FFF7ED",
          border: "#B45309",
          borderWidth: 2,
          width: 190,
          height: 90,
          lines: 2,
          caption: "",
        },
        {
          shape: "rounded",
          label: "When?",
          fill: "#F0FDF4",
          border: "#166534",
          borderWidth: 2,
          width: 190,
          height: 90,
          lines: 2,
          caption: "",
        },
        {
          shape: "rounded",
          label: "Where?",
          fill: "#FEF2F2",
          border: "#DC2626",
          borderWidth: 2,
          width: 190,
          height: 90,
          lines: 2,
          caption: "",
        },
        {
          shape: "rounded",
          label: "Why?",
          fill: "#F5F3FF",
          border: "#6D28D9",
          borderWidth: 2,
          width: 190,
          height: 90,
          lines: 2,
          caption: "",
        },
        {
          shape: "rounded",
          label: "How?",
          fill: "#FEFCE8",
          border: "#854D0E",
          borderWidth: 2,
          width: 190,
          height: 90,
          lines: 2,
          caption: "",
        },
      ],
    },
  ];

  const applyPreset = (preset) => {
    onChange({ title: preset.title, layout: preset.layout, shapes: preset.shapes });
    setActiveIdx(0);
    setEditorTab("custom");
  };

  const updShape = (idx, updates) => {
    const next = shapes.map((s, i) => (i === idx ? { ...s, ...updates } : s));
    onChange({ shapes: next });
  };

  const addShape = () => {
    const newShape = {
      shape: "rectangle",
      label: "",
      fill: "#FFFFFF",
      border: gv.color,
      borderWidth: 2,
      width: 180,
      height: 120,
      lines: 0,
      caption: "",
    };
    onChange({ shapes: [...shapes, newShape] });
    setActiveIdx(shapes.length);
  };

  const removeShape = (idx) => {
    const next = shapes.filter((_, i) => i !== idx);
    onChange({ shapes: next });
    setActiveIdx(Math.min(activeIdx, next.length - 1));
  };

  const duplicateShape = (idx) => {
    const copy = { ...shapes[idx] };
    const next = [...shapes.slice(0, idx + 1), copy, ...shapes.slice(idx + 1)];
    onChange({ shapes: next });
    setActiveIdx(idx + 1);
  };

  const rowStyle = { display: "flex", gap: 8, marginTop: 4 };
  const half = { ...inp, flex: 1 };

  return (
    <div>
      {/* ── Editor Tab switcher ── */}
      <div
        style={{
          display: "flex",
          gap: 0,
          marginBottom: 12,
          border: "1.5px solid #E5E7EB",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        {[
          ["presets", "🗂️ Build Presets"],
          ["custom", "⚙️ Customize"],
        ].map(([id, lbl]) => (
          <button
            key={id}
            onClick={() => setEditorTab(id)}
            aria-pressed={editorTab === id}
            style={{
              flex: 1,
              padding: "9px 6px",
              border: "none",
              borderRight: id === "presets" ? "1px solid #E5E7EB" : "none",
              background: editorTab === id ? gv.color : "white",
              color: editorTab === id ? "white" : "#374151",
              fontFamily: F,
              fontWeight: 700,
              fontSize: 12,
              cursor: "pointer",
              transition: "all 0.12s",
            }}
          >
            {lbl}
          </button>
        ))}
      </div>

      {/* ── BUILD PRESETS TAB ── */}
      {editorTab === "presets" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p
            style={{
              fontFamily: F,
              fontSize: 11.5,
              color: "#9CA3AF",
              margin: "0 0 6px",
              lineHeight: 1.5,
            }}
          >
            Click a preset to instantly build a complete graphic organizer. You can customize it
            after.
          </p>
          {BUILD_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset)}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "11px 13px",
                borderRadius: 9,
                border: `1.5px solid #E5E7EB`,
                background: "white",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.12s",
                width: "100%",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = gv.color;
                e.currentTarget.style.background = gv.light;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#E5E7EB";
                e.currentTarget.style.background = "white";
              }}
            >
              <span style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>{preset.icon}</span>
              <div>
                <div
                  style={{
                    fontFamily: F,
                    fontWeight: 700,
                    fontSize: 13,
                    color: "#111827",
                    marginBottom: 2,
                  }}
                >
                  {preset.label}
                </div>
                <div style={{ fontFamily: F, fontSize: 11.5, color: "#9CA3AF", lineHeight: 1.4 }}>
                  {preset.desc} · {preset.shapes.length} sections
                </div>
              </div>
            </button>
          ))}
          {el.shapes?.length > 0 && (
            <p
              style={{
                fontFamily: F,
                fontSize: 11,
                color: gv.color,
                margin: "4px 0 0",
                textAlign: "center",
              }}
            >
              ✓ Preset applied — switch to <strong>Customize</strong> to edit individual shapes
            </p>
          )}
        </div>
      )}

      {/* ── CUSTOMIZE TAB ── */}
      {editorTab === "custom" && (
        <>
          {/* Layout & title */}
          <label style={LBL}>Prompt / Title</label>
          <SpellInput
            type="text"
            value={el.title || ""}
            spellCheck
            onChange={(e) => onChange({ title: e.target.value })}
            style={{ ...inp, marginTop: 4 }}
            aria-label="Shape group title"
            placeholder="Label each shape:"
          />

          <label style={LBL}>Layout</label>
          <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
            {[
              ["1-col", "1"],
              ["2-col", "2"],
              ["3-col", "3"],
              ["4-col", "4"],
            ].map(([v, lbl]) => (
              <button
                key={v}
                onClick={() => {
                  // Auto-add empty shapes so the new column count is actually filled.
                  const targetCols = parseInt(lbl, 10);
                  const current = el.shapes || [];
                  const updates: any = { layout: v };
                  if (current.length < targetCols) {
                    const blank = {
                      shape: "rectangle",
                      label: "",
                      fill: "#FFFFFF",
                      border: gv.color,
                      borderWidth: 2,
                      width: 180,
                      height: 120,
                      lines: 0,
                      caption: "",
                    };
                    const extras = Array.from({ length: targetCols - current.length }, () => ({
                      ...blank,
                    }));
                    updates.shapes = [...current, ...extras];
                  }
                  onChange(updates);
                }}
                aria-pressed={el.layout === v}
                style={{
                  padding: "5px 12px",
                  borderRadius: 6,
                  border: `1.5px solid ${el.layout === v ? gv.color : "#E5E7EB"}`,
                  background: el.layout === v ? gv.light : "white",
                  color: el.layout === v ? gv.color : "#6B7280",
                  fontFamily: F,
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                {lbl} col
              </button>
            ))}
          </div>

          <label style={LBL}>Orientation</label>
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            {[
              ["horizontal", "↔ Horizontal", "Arrange shapes across in columns"],
              ["vertical", "↕ Vertical", "Stack shapes top-to-bottom in one column"],
            ].map(([v, lbl, desc]) => {
              const active = (el.orientation || "horizontal") === v;
              return (
                <button
                  key={v}
                  onClick={() => onChange({ orientation: v })}
                  aria-pressed={active}
                  title={desc}
                  style={{
                    flex: 1,
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: `1.5px solid ${active ? gv.color : "#E5E7EB"}`,
                    background: active ? gv.light : "white",
                    color: active ? gv.color : "#6B7280",
                    fontFamily: F,
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {lbl}
                </button>
              );
            })}
          </div>
          <p style={{ fontFamily: F, fontSize: 10.5, color: "#9CA3AF", margin: "4px 0 0" }}>
            {(el.orientation || "horizontal") === "vertical"
              ? "Shapes stack in a single column (top to bottom)."
              : "Shapes spread across the selected number of columns."}
          </p>

          {/* Shape tabs */}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #F3F4F6" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontFamily: F,
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#6B7280",
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                }}
              >
                Shapes ({shapes.length})
              </span>
              <button
                onClick={addShape}
                style={{
                  padding: "3px 10px",
                  borderRadius: 6,
                  border: `1.5px solid ${gv.color}`,
                  background: gv.light,
                  color: gv.color,
                  fontFamily: F,
                  fontWeight: 700,
                  fontSize: 11,
                  cursor: "pointer",
                }}
                aria-label="Add another shape"
              >
                + Add
              </button>
            </div>

            {/* Shape selector tabs */}
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
              {shapes.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIdx(i)}
                  aria-pressed={activeIdx === i}
                  style={{
                    padding: "3px 10px",
                    borderRadius: 6,
                    border: `1.5px solid ${activeIdx === i ? gv.color : "#E5E7EB"}`,
                    background: activeIdx === i ? gv.color : "white",
                    color: activeIdx === i ? "white" : "#6B7280",
                    fontFamily: F,
                    fontWeight: 700,
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  #{i + 1}
                </button>
              ))}
            </div>

            {/* Active shape editor */}
            {active && (
              <div
                style={{
                  background: "#F9FAFB",
                  borderRadius: 8,
                  padding: "12px 12px 14px",
                  border: "1px solid #E5E7EB",
                }}
              >
                <label style={LBL}>Shape Type</label>
                <div
                  style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginTop: 4 }}
                >
                  {SHAPE_TYPES.map((st) => (
                    <button
                      key={st.id}
                      onClick={() => updShape(activeIdx, { shape: st.id })}
                      aria-pressed={active.shape === st.id}
                      style={{
                        padding: "5px 6px",
                        borderRadius: 6,
                        border: `1.5px solid ${active.shape === st.id ? gv.color : "#E5E7EB"}`,
                        background: active.shape === st.id ? gv.light : "white",
                        color: active.shape === st.id ? gv.color : "#374151",
                        fontFamily: F,
                        fontWeight: 600,
                        fontSize: 11,
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                <label style={LBL}>Label inside shape</label>
                <SpellInput
                  type="text"
                  value={active.label || ""}
                  spellCheck
                  onChange={(e) => updShape(activeIdx, { label: e.target.value })}
                  style={{ ...inp, marginTop: 4 }}
                  aria-label="Shape label"
                  placeholder="e.g. Part A"
                />

                <label style={LBL}>Caption below shape</label>
                <SpellInput
                  type="text"
                  value={active.caption || ""}
                  spellCheck
                  onChange={(e) => updShape(activeIdx, { caption: e.target.value })}
                  style={{ ...inp, marginTop: 4 }}
                  aria-label="Caption below shape"
                  placeholder="Optional description"
                />

                <label style={LBL}>Write lines inside</label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={active.lines || 0}
                  onChange={(e) => updShape(activeIdx, { lines: parseInt(e.target.value) || 0 })}
                  style={{ ...inp, marginTop: 4 }}
                  aria-label="Lines inside shape"
                />

                <div style={rowStyle}>
                  <div style={{ flex: 1 }}>
                    <label style={LBL}>Width (px)</label>
                    <input
                      type="number"
                      min={60}
                      max={400}
                      step={10}
                      value={active.width || 180}
                      onChange={(e) =>
                        updShape(activeIdx, { width: parseInt(e.target.value) || 180 })
                      }
                      style={{ ...half, marginTop: 4 }}
                      aria-label="Shape width"
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={LBL}>Height (px)</label>
                    <input
                      type="number"
                      min={40}
                      max={400}
                      step={10}
                      value={active.height || 120}
                      onChange={(e) =>
                        updShape(activeIdx, { height: parseInt(e.target.value) || 120 })
                      }
                      style={{ ...half, marginTop: 4 }}
                      aria-label="Shape height"
                    />
                  </div>
                </div>

                <div style={rowStyle}>
                  <div style={{ flex: 1 }}>
                    <label style={LBL}>Fill Color</label>
                    <div style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center" }}>
                      <input
                        type="color"
                        value={active.fill || "#FFFFFF"}
                        onChange={(e) => updShape(activeIdx, { fill: e.target.value })}
                        style={{
                          width: 34,
                          height: 30,
                          borderRadius: 5,
                          border: "1.5px solid #E5E7EB",
                          cursor: "pointer",
                          padding: 2,
                        }}
                        aria-label="Shape fill color"
                      />
                      <input
                        type="text"
                        value={active.fill || "#FFFFFF"}
                        onChange={(e) => updShape(activeIdx, { fill: e.target.value })}
                        style={{ ...half, fontSize: 12 }}
                        aria-label="Fill color hex"
                      />
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={LBL}>Border Color</label>
                    <div style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center" }}>
                      <input
                        type="color"
                        value={active.border || gv.color}
                        onChange={(e) => updShape(activeIdx, { border: e.target.value })}
                        style={{
                          width: 34,
                          height: 30,
                          borderRadius: 5,
                          border: "1.5px solid #E5E7EB",
                          cursor: "pointer",
                          padding: 2,
                        }}
                        aria-label="Shape border color"
                      />
                      <input
                        type="text"
                        value={active.border || gv.color}
                        onChange={(e) => updShape(activeIdx, { border: e.target.value })}
                        style={{ ...half, fontSize: 12 }}
                        aria-label="Border color hex"
                      />
                    </div>
                  </div>
                </div>

                <label style={LBL}>Border Thickness (px)</label>
                <input
                  type="number"
                  min={0}
                  max={12}
                  value={active.borderWidth || 2}
                  onChange={(e) =>
                    updShape(activeIdx, { borderWidth: parseInt(e.target.value) || 2 })
                  }
                  style={{ ...inp, marginTop: 4 }}
                  aria-label="Border width"
                />

                {/* Shape quick-presets */}
                <label style={{ ...LBL, marginTop: 14 }}>Quick Presets</label>
                <div style={{ display: "flex", gap: 5, marginTop: 4, flexWrap: "wrap" }}>
                  {[
                    {
                      label: "Answer Box",
                      props: {
                        shape: "rectangle",
                        fill: "#FFFFFF",
                        border: "#374151",
                        borderWidth: 1.5,
                        lines: 3,
                        height: 100,
                      },
                    },
                    {
                      label: "Blank Circle",
                      props: {
                        shape: "circle",
                        fill: "#FFFFFF",
                        border: "#6D28D9",
                        borderWidth: 2,
                        lines: 0,
                        width: 130,
                        height: 130,
                      },
                    },
                    {
                      label: "Label Tag",
                      props: {
                        shape: "rounded",
                        fill: "#F5F3FF",
                        border: "#6D28D9",
                        borderWidth: 2,
                        lines: 0,
                        height: 60,
                      },
                    },
                    {
                      label: "Note Cloud",
                      props: {
                        shape: "cloud",
                        fill: "#FEFCE8",
                        border: "#B45309",
                        borderWidth: 2,
                        lines: 2,
                        height: 110,
                      },
                    },
                    {
                      label: "Speech",
                      props: {
                        shape: "speech",
                        fill: "#F0F9FF",
                        border: "#0369A1",
                        borderWidth: 2,
                        lines: 2,
                        height: 110,
                      },
                    },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => updShape(activeIdx, preset.props)}
                      style={{
                        padding: "4px 9px",
                        borderRadius: 6,
                        border: "1.5px solid #E5E7EB",
                        background: "white",
                        color: "#374151",
                        fontFamily: F,
                        fontWeight: 600,
                        fontSize: 10.5,
                        cursor: "pointer",
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Duplicate / Remove */}
                <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
                  <button
                    onClick={() => duplicateShape(activeIdx)}
                    style={{
                      flex: 1,
                      padding: "6px 0",
                      borderRadius: 7,
                      border: `1.5px solid ${gv.color}`,
                      background: gv.light,
                      color: gv.color,
                      fontFamily: F,
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                    aria-label="Duplicate this shape"
                  >
                    Duplicate
                  </button>
                  {shapes.length > 1 && (
                    <button
                      onClick={() => removeShape(activeIdx)}
                      style={{
                        flex: 1,
                        padding: "6px 0",
                        borderRadius: 7,
                        border: "1.5px solid #FCA5A5",
                        background: "#FEF2F2",
                        color: "#DC2626",
                        fontFamily: F,
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                      aria-label="Remove this shape"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StandardsModal({ gv, onClose, onInsert, onGenerate, gradeId }) {
  const subjects = Object.keys(NY_STANDARDS);
  const [subj, setSubj] = useState("ELA");
  const [band, setBand] = useState(() =>
    gradeId ? gradeIdToStdBand(gradeId, "ELA") || "Kindergarten" : "Kindergarten",
  );
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState(null);
  const [showHeader, setShowHeader] = useState(true);
  const [matchGrade, setMatchGrade] = useState(!!gradeId);

  const bands = Object.keys(NY_STANDARDS[subj] || {});
  const stds = NY_STANDARDS[subj]?.[band] || [];
  const filtered = search.trim()
    ? stds.filter(
        (s) =>
          s.code.toLowerCase().includes(search.toLowerCase()) ||
          s.desc.toLowerCase().includes(search.toLowerCase()),
      )
    : stds;

  const handlePick = (s) => {
    setPicked(s);
  };

  // Auto-update band when subject changes if matchGrade is on
  const onSubjChange = (s) => {
    setSubj(s);
    if (matchGrade && gradeId) setBand(gradeIdToStdBand(gradeId, s));
    else setBand(s === "ELA" ? "Kindergarten" : Object.keys(NY_STANDARDS[s] || {})[0] || "");
    setPicked(null);
  };

  const toggleMatchGrade = () => {
    setMatchGrade((m) => {
      const next = !m;
      if (next && gradeId) setBand(gradeIdToStdBand(gradeId, subj));
      return next;
    });
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white",
          borderRadius: 18,
          maxWidth: 680,
          width: "100%",
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          animation: "fadeIn 0.25s ease",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px 14px",
            borderBottom: "2px solid #F0F0F0",
            background: gv.light,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0, fontFamily: FF, color: gv.color, fontSize: 22 }}>
              🗽 New York State Standards
            </h2>
            <button
              onClick={onClose}
              style={{
                background: "white",
                border: "none",
                borderRadius: "50%",
                width: 34,
                height: 34,
                cursor: "pointer",
                fontSize: 16,
                color: "#888",
                fontWeight: 800,
              }}
            >
              ✕
            </button>
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "#999", fontFamily: F }}>
            Select a standard to insert it on your worksheet or let AI design the entire worksheet
            from it.
          </p>
        </div>

        {/* Filters */}
        <div
          style={{
            padding: "14px 24px",
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            background: "#FAFAFA",
            borderBottom: "1px solid #EEE",
          }}
        >
          <div style={{ flex: 1, minWidth: 130 }}>
            <label style={{ ...LBL, marginTop: 0 }}>Subject</label>
            <select
              value={subj}
              onChange={(e) => onSubjChange(e.target.value)}
              style={{
                width: "100%",
                padding: "7px 10px",
                borderRadius: 8,
                border: "2px solid #EEE",
                fontFamily: F,
                fontSize: 13,
                outline: "none",
              }}
            >
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 130 }}>
            <label style={{ ...LBL, marginTop: 0 }}>Grade Band</label>
            <select
              value={band}
              onChange={(e) => {
                setBand(e.target.value);
                setMatchGrade(false);
                setPicked(null);
              }}
              style={{
                width: "100%",
                padding: "7px 10px",
                borderRadius: 8,
                border: "2px solid #EEE",
                fontFamily: F,
                fontSize: 13,
                outline: "none",
              }}
            >
              {bands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 2, minWidth: 180 }}>
            <label style={{ ...LBL, marginTop: 0 }}>Search Standards</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by code or keyword…"
              style={{
                width: "100%",
                padding: "7px 10px",
                borderRadius: 8,
                border: "2px solid #EEE",
                fontFamily: F,
                fontSize: 13,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
          {gradeId && (
            <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={toggleMatchGrade}
                title={`Match ${GRADES.find((g) => g.id === gradeId)?.name || gradeId}`}
                style={{
                  padding: "3px 8px",
                  borderRadius: 10,
                  border: `1px solid ${matchGrade ? gv.color : "#DDD"}`,
                  background: matchGrade ? gv.light : "white",
                  color: matchGrade ? gv.color : "#666",
                  fontFamily: F,
                  fontWeight: 700,
                  fontSize: 10,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {matchGrade ? "✓ " : ""}🎯 Match grade
              </button>
              <span style={{ fontSize: 10, color: "#999", fontFamily: F }}>
                {filtered.length} standard{filtered.length === 1 ? "" : "s"}
              </span>
            </div>
          )}
        </div>

        {/* Standard list */}
        <div style={{ overflowY: "auto", padding: "14px 24px 8px", flex: 1 }}>
          {filtered.length === 0 && (
            <p style={{ fontFamily: F, color: "#CCC", textAlign: "center", marginTop: 24 }}>
              No standards match your search.
            </p>
          )}
          {filtered.map((s, i) => {
            const isSelected = picked?.code === s.code;
            return (
              <div
                key={i}
                onClick={() => handlePick(s)}
                style={{
                  padding: "12px 16px",
                  borderRadius: 12,
                  border: `2px solid ${isSelected ? gv.color : "#EEE"}`,
                  marginBottom: 8,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  background: isSelected ? gv.light : "white",
                  transform: isSelected ? "translateX(3px)" : "none",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = gv.color + "80";
                    e.currentTarget.style.background = gv.light + "88";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = "#EEE";
                    e.currentTarget.style.background = "white";
                  }
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontFamily: F,
                        fontSize: 11,
                        fontWeight: 900,
                        color: gv.color,
                        marginBottom: 4,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      {s.code}
                    </div>
                    <div style={{ fontFamily: F, fontSize: 13, color: "#444", lineHeight: 1.45 }}>
                      {s.desc}
                    </div>
                  </div>
                  {isSelected && (
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        background: gv.color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      <span style={{ color: "white", fontSize: 12, fontWeight: 900 }}>✓</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action panel — shown when a standard is selected */}
        {picked && (
          <div
            style={{
              borderTop: `3px solid ${gv.color}30`,
              background: gv.light,
              padding: "16px 24px",
              animation: "fadeIn 0.2s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <span
                  style={{
                    fontFamily: F,
                    fontSize: 10,
                    fontWeight: 900,
                    color: gv.color,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Selected: {picked.code}
                </span>
                <p
                  style={{
                    fontFamily: F,
                    fontSize: 12.5,
                    color: "#555",
                    margin: "3px 0 0",
                    lineHeight: 1.4,
                  }}
                >
                  {picked.desc}
                </p>
              </div>
              <button
                onClick={() => setPicked(null)}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: "#BBB",
                  fontSize: 16,
                  padding: 2,
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>

            {/* Options row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              {/* Toggle: show standard as header */}
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                <div
                  onClick={() => setShowHeader((h) => !h)}
                  style={{
                    width: 36,
                    height: 20,
                    borderRadius: 10,
                    background: showHeader ? gv.color : "#CCC",
                    position: "relative",
                    transition: "background 0.2s",
                    flexShrink: 0,
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 3,
                      left: showHeader ? 18 : 3,
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      background: "white",
                      transition: "left 0.2s",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                    }}
                  />
                </div>
                <span
                  style={{
                    fontFamily: F,
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: showHeader ? "#333" : "#AAA",
                  }}
                >
                  Show standard as header on worksheet
                </span>
              </label>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => {
                    onInsert(picked, showHeader);
                    onClose();
                  }}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 9,
                    border: `2px solid ${gv.color}`,
                    background: "white",
                    color: gv.color,
                    fontFamily: F,
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = gv.light;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "white";
                  }}
                >
                  ✏️ Insert Standard
                </button>
                <button
                  onClick={() => {
                    onGenerate(picked, showHeader);
                    onClose();
                  }}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 9,
                    border: "none",
                    background: gv.color,
                    color: "white",
                    fontFamily: FF,
                    fontSize: 14,
                    cursor: "pointer",
                    boxShadow: `0 3px 12px ${gv.color}55`,
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-1px)";
                    e.currentTarget.style.boxShadow = `0 6px 18px ${gv.color}66`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.boxShadow = `0 3px 12px ${gv.color}55`;
                  }}
                >
                  ✨ Generate Full Worksheet
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// QUIZ VERSIONS MODAL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function VersionsModal({ gv, ws, onClose }) {
  const [numVersions, setNumVersions] = useState(2);
  const [randomize, setRandomize] = useState(true);
  const [keepFixed, setKeepFixed] = useState(true); // keep non-question elements (instructions, passages) in place
  const [previewVer, setPreviewVer] = useState(null); // null = config, 0-3 = preview index

  // Build a version's element order
  const buildVersion = (label) => {
    const fixed = keepFixed ? ws.elements.filter((el) => !isQuestion(el)) : [];
    const questions = ws.elements.filter((el) => isQuestion(el));
    const orderedQs = randomize ? shuffle(questions) : questions;
    if (!keepFixed) return randomize ? shuffle([...ws.elements]) : [...ws.elements];
    // Re-interleave: put questions back in their (shuffled) positions
    let qi = 0;
    return ws.elements.map((el) => (isQuestion(el) ? orderedQs[qi++] : el));
  };

  const versions = VERSION_LABELS.slice(0, numVersions).map(buildVersion);

  const printVersions = () => {
    const gv2 = gInfo(ws.gradeId);
    const renderEl = (el) => {
      if (!el) return "";
      const fs = gv2.fontSize;
      const mb = (s) => inlineMarkdownToHtml(s || "");
      if (el.type === "instruction")
        return `<div style="background:#FFFACD;padding:10px 16px;border-radius:10px;border-left:6px solid ${gv2.color};margin-bottom:16px;font-size:${Math.max(fs - 7, 13)}px;font-weight:700;line-height:1.55">${mb(el.text)}</div>`;
      if (el.type === "text")
        return `<p style="font-size:${fs}px;font-weight:600;margin:0 0 16px;line-height:1.7">${mb(el.text)}</p>`;
      if (el.type === "multipleChoice")
        return `<div style="margin-bottom:18px"><p style="font-size:${fs}px;font-weight:800;margin:0 0 10px">${mb(el.question)}</p>${(el.choices || []).map((c) => `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><div style="width:20px;height:20px;border-radius:50%;border:2.5px solid ${gv2.color};flex-shrink:0"></div><span style="font-size:${fs}px">${mb(c)}</span></div>`).join("")}</div>`;
      if (el.type === "truefalse")
        return `<div style="margin-bottom:18px"><p style="font-size:${Math.max(fs - 5, 13)}px;font-weight:900;color:${gv2.color};margin:0 0 10px">True or False? Circle your answer.</p>${(el.statements || []).map((s) => `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding:8px 12px;background:${gv2.light};border-radius:8px"><span style="font-size:${fs}px">${mb(s)}</span><span style="font-size:12px;font-weight:900;color:${gv2.color};margin-left:20px;white-space:nowrap">TRUE &nbsp;&nbsp; FALSE</span></div>`).join("")}</div>`;
      if (el.type === "shortAnswer")
        return `<div style="margin-bottom:18px"><p style="font-size:${fs}px;font-weight:800;margin:0 0 12px">${mb(el.question)}</p>${Array.from(
          { length: el.lines || 4 },
        )
          .map(
            () =>
              `<div style="height:${gv2.lineH * 0.9}px;border-bottom:2px solid #CCC;margin-bottom:6px"></div>`,
          )
          .join("")}</div>`;
      if (el.type === "fillBlank")
        return `<div style="margin-bottom:18px">${el.note ? `<p style="font-size:12px;color:#999;margin:0 0 6px">${mb(el.note)}</p>` : ""}<p style="font-size:${fs}px;line-height:1.9;margin:0">${(
          el.text || ""
        )
          .split("______")
          .map((p, i, a) =>
            i < a.length - 1
              ? `${mb(p)}<span style="display:inline-block;width:90px;border-bottom:2.5px solid ${gv2.color};vertical-align:bottom;margin:0 3px"></span>`
              : mb(p),
          )
          .join("")}</p></div>`;
      if (el.type === "blank")
        return `<div style="margin-bottom:18px">${el.label ? `<p style="font-size:${fs}px;font-weight:800;margin:0 0 12px">${mb(el.label)}</p>` : ""} ${Array.from(
          { length: el.lines || 3 },
        )
          .map(
            () =>
              `<div style="height:${gv2.lineH}px;border-bottom:2.5px solid #CCC;margin-bottom:8px"></div>`,
          )
          .join("")}</div>`;
      if (el.type === "matching")
        return `<div style="margin-bottom:18px">${el.title ? `<p style="font-size:${Math.max(fs - 4, 13)}px;font-weight:800;margin:0 0 12px">${mb(el.title)}</p>` : ""}<table style="width:100%"><tbody>${(el.left || []).map((item, i) => `<tr><td style="padding:6px 10px;border:2px solid ${gv2.color};border-radius:8px;width:40%;text-align:center;font-size:${fs}px">${mb(item)}</td><td style="text-align:center;padding:0 8px">—</td><td style="padding:6px 10px;border:2px solid ${gv2.color};border-radius:8px;width:40%;text-align:center;font-size:${fs}px">${mb((el.right || [])[i] || "")}</td></tr>`).join("")}</tbody></table></div>`;
      if (el.type === "wordBank")
        return `<div style="margin-bottom:18px"><p style="font-size:${Math.max(fs - 4, 13)}px;font-weight:900;color:${gv2.color};margin:0 0 10px">${el.title || "Word Bank"}</p><div style="display:flex;flex-wrap:wrap;gap:8px;padding:10px 14px;background:${gv2.light};border-radius:10px">${(el.words || []).map((w) => `<span style="font-size:${fs}px;padding:4px 12px;border:2px solid ${gv2.color};border-radius:50px;background:white">${mb(w)}</span>`).join("")}</div></div>`;
      if (el.type === "essay")
        return `<div style="margin-bottom:18px"><p style="font-size:${fs}px;font-weight:800;margin:0 0 12px">${mb(el.prompt)}</p>${Array.from(
          { length: el.lines || 14 },
        )
          .map(
            () =>
              `<div style="height:${gv2.lineH * 0.75}px;border-bottom:1.5px solid #DDD;margin-bottom:4px"></div>`,
          )
          .join("")}</div>`;
      if (el.type === "divider")
        return `<div style="margin:8px 0;text-align:center;color:${gv2.color};font-size:16px">✦</div>`;
      if (el.type === "successCriteria" || el.type === "exitTicket") {
        const a = el.type === "successCriteria" ? gv2.color : "#0369A1";
        const bg2 = el.type === "successCriteria" ? gv2.light : "#EFF6FF";
        return `<div style="margin-bottom:18px;background:${bg2};border:2px solid ${a}45;border-left:6px solid ${a};border-radius:10px;padding:12px 16px">${el.title ? `<p style="font-size:${Math.max(fs - 2, 13)}px;font-weight:900;color:${a};margin:0 0 6px">${el.title}</p>` : ""}${el.intro ? `<p style="font-size:${Math.max(fs - 4, 11)}px;font-weight:600;color:#374151;margin:0 0 10px;line-height:1.5">${mb(el.intro)}</p>` : ""}<ul style="list-style:none;padding:0;margin:0">${(el.items || []).map((item) => `<li style="display:flex;align-items:flex-start;gap:10px;margin-bottom:8px"><span style="flex-shrink:0;display:inline-block;width:18px;height:18px;margin-top:2px;border:2px solid ${a};border-radius:4px;background:white"></span><span style="font-size:${fs}px;font-weight:600;color:#111827;line-height:1.45">${mb(item)}</span></li>`).join("")}</ul></div>`;
      }
      if (el.type === "dokQuestions") {
        const LC = ["#10B981", "#0EA5E9", "#8B5CF6", "#F59E0B"];
        return `<div style="margin-bottom:18px;background:#FFFFFF;border:2px solid ${gv2.color}45;border-left:6px solid ${gv2.color};border-radius:10px;padding:12px 16px">${el.title ? `<p style="font-size:${Math.max(fs - 2, 13)}px;font-weight:900;color:${gv2.color};margin:0 0 6px">${el.title}</p>` : ""}${el.intro ? `<p style="font-size:${Math.max(fs - 4, 11)}px;font-weight:600;color:#374151;margin:0 0 10px;line-height:1.5">${mb(el.intro)}</p>` : ""}${(
          el.levels || []
        )
          .map((lv, li) => {
            const c = LC[(lv.level || li + 1) - 1] || gv2.color;
            return `<div style="background:${c}10;border:1.5px solid ${c}55;border-radius:8px;padding:8px 10px;margin-bottom:8px"><p style="font-size:${Math.max(fs - 4, 11)}px;font-weight:900;color:${c};margin:0 0 6px">DOK ${lv.level} · ${lv.label}</p><ul style="list-style:none;padding:0;margin:0">${(lv.items || []).map((q) => `<li style="display:flex;align-items:flex-start;gap:8px;margin-bottom:6px"><span style="flex-shrink:0;display:inline-block;width:16px;height:16px;margin-top:2px;border:2px solid ${c};border-radius:3px;background:white"></span><span style="font-size:${Math.max(fs - 1, 12)}px;font-weight:600;color:#111827;line-height:1.45">${mb(q)}</span></li>`).join("")}</ul></div>`;
          })
          .join("")}</div>`;
      }
      return "";
    };

    const pages = versions
      .map((els, vi) => {
        const vLabel = VERSION_LABELS[vi];
        return `
      <div class="page" style="page-break-after:always;padding:52px 64px;min-height:900px;font-family:'Nunito',sans-serif;position:relative">
        ${ws.showGrade ? `<div style="position:absolute;top:14px;right:18px;background:${gv2.light};border:2px solid ${gv2.color}40;border-radius:20px;padding:3px 13px;font-size:11px;font-weight:900;color:${gv2.color}">Version ${vLabel} · ${gv2.emoji} ${gv2.name}</div>` : `<div style="position:absolute;top:14px;right:18px;background:${gv2.light};border:2px solid ${gv2.color}40;border-radius:20px;padding:3px 13px;font-size:11px;font-weight:900;color:${gv2.color}">Version ${vLabel}</div>`}
        <div style="border-bottom:3px solid ${gv2.color}25;padding-bottom:8px;margin-bottom:16px">
          <h1 style="font-family:'Fredoka One',cursive;color:${gv2.color};font-size:${gv2.fontSize + 6}px;margin:0 0 14px;padding-right:120px">${ws.title} — Version ${vLabel}</h1>
          <div style="display:flex;gap:44px">${ws.showName ? `<div style="display:flex;align-items:center;gap:8px;flex:1"><span style="font-weight:700;font-size:${Math.max(gv2.fontSize - 10, 12)}px">Name:</span><div style="flex:1;border-bottom:2px solid #CCC;height:22px"></div></div>` : ""} ${ws.showDate ? `<div style="display:flex;align-items:center;gap:8px;flex:1"><span style="font-weight:700;font-size:${Math.max(gv2.fontSize - 10, 12)}px">Date:</span><div style="flex:1;border-bottom:2px solid #CCC;height:22px"></div></div>` : ""}</div>
        </div>
        ${els.map(renderEl).join("")}
      </div>`;
      })
      .join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${ws.title} — Quiz Versions</title><link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Fredoka+One&display=swap" rel="stylesheet"><style>*{box-sizing:border-box}body{margin:0;font-family:'Nunito',sans-serif}@media print{.page{page-break-after:always}}</style></head><body>${pages}</body></html>`;
    const w = window.open("", "_blank");
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 600);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white",
          borderRadius: 18,
          maxWidth: 620,
          width: "100%",
          maxHeight: "88vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          animation: "fadeIn 0.25s ease",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "20px 24px 14px",
            borderBottom: "2px solid #F0F0F0",
            background: gv.light,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontFamily: FF, color: gv.color, fontSize: 22 }}>
              🔀 Quiz Versions
            </h2>
            <p style={{ margin: "5px 0 0", fontSize: 12, color: "#999", fontFamily: F }}>
              Create multiple randomized versions of this worksheet to prevent copying.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "white",
              border: "none",
              borderRadius: "50%",
              width: 34,
              height: 34,
              cursor: "pointer",
              fontSize: 16,
              color: "#888",
              fontWeight: 800,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ overflowY: "auto", padding: "20px 24px", flex: 1 }}>
          {/* Config */}
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}
          >
            <div>
              <label style={{ ...LBL, marginTop: 0 }}>Number of Versions</label>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    onClick={() => setNumVersions(n)}
                    style={{
                      flex: 1,
                      padding: "8px 0",
                      borderRadius: 9,
                      border: `2px solid ${numVersions === n ? gv.color : "#EEE"}`,
                      background: numVersions === n ? gv.light : "white",
                      color: numVersions === n ? gv.color : "#888",
                      fontFamily: FF,
                      fontSize: 15,
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {VERSION_LABELS[n - 1]}
                  </button>
                ))}
              </div>
              <p style={{ fontFamily: F, fontSize: 11, color: "#AAA", margin: "6px 0 0" }}>
                Versions are labeled A, B, C, D
              </p>
            </div>
            <div>
              <label style={{ ...LBL, marginTop: 0 }}>Options</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
                {[
                  [randomize, setRandomize, "Randomize question order"],
                  [keepFixed, setKeepFixed, "Keep instructions & passages fixed"],
                ].map(([val, set, lbl], i) => (
                  <label
                    key={i}
                    style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}
                  >
                    <div
                      onClick={() => set((v) => !v)}
                      style={{
                        width: 36,
                        height: 20,
                        borderRadius: 10,
                        background: val ? gv.color : "#CCC",
                        position: "relative",
                        transition: "background 0.2s",
                        flexShrink: 0,
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: 3,
                          left: val ? 18 : 3,
                          width: 14,
                          height: 14,
                          borderRadius: "50%",
                          background: "white",
                          transition: "left 0.2s",
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontFamily: F,
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: val ? "#333" : "#AAA",
                      }}
                    >
                      {lbl}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div
            style={{
              background: gv.light,
              borderRadius: 12,
              padding: "12px 16px",
              marginBottom: 20,
              display: "flex",
              gap: 24,
            }}
          >
            {[
              ["Total elements", ws.elements.length],
              ["Questions (randomized)", ws.elements.filter(isQuestion).length],
              ["Fixed elements", ws.elements.filter((e) => !isQuestion(e)).length],
            ].map(([lbl, val]) => (
              <div key={lbl} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: FF, fontSize: 22, color: gv.color }}>{val}</div>
                <div style={{ fontFamily: F, fontSize: 11, color: "#999", fontWeight: 700 }}>
                  {lbl}
                </div>
              </div>
            ))}
          </div>

          {/* Version previews */}
          <label style={{ ...LBL, marginTop: 0 }}>Version Previews</label>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            {versions.map((els, vi) => (
              <button
                key={vi}
                onClick={() => setPreviewVer(previewVer === vi ? null : vi)}
                style={{
                  padding: "7px 14px",
                  borderRadius: 9,
                  border: `2px solid ${previewVer === vi ? gv.color : "#EEE"}`,
                  background: previewVer === vi ? gv.light : "white",
                  color: previewVer === vi ? gv.color : "#666",
                  fontFamily: F,
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                Version {VERSION_LABELS[vi]} {previewVer === vi ? "▲" : "▼"}
              </button>
            ))}
          </div>

          {previewVer !== null && (
            <div
              style={{
                marginTop: 12,
                background: "#FAFAFA",
                borderRadius: 12,
                padding: "12px 16px",
                border: "2px solid #EEE",
                animation: "fadeIn 0.2s ease",
              }}
            >
              <p
                style={{
                  fontFamily: F,
                  fontSize: 11,
                  fontWeight: 900,
                  color: gv.color,
                  textTransform: "uppercase",
                  margin: "0 0 8px",
                }}
              >
                Version {VERSION_LABELS[previewVer]} — Question Order
              </p>
              {versions[previewVer].filter(isQuestion).map((el, i) => (
                <div
                  key={el.id}
                  style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 7 }}
                >
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: gv.color,
                      color: "white",
                      fontFamily: F,
                      fontWeight: 900,
                      fontSize: 11,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </span>
                  <span
                    style={{
                      fontFamily: F,
                      fontSize: 12.5,
                      color: "#555",
                      lineHeight: 1.4,
                      paddingTop: 2,
                    }}
                  >
                    {el.type === "multipleChoice"
                      ? el.question
                      : el.type === "truefalse"
                        ? `True/False: ${(el.statements || [])[0]}…`
                        : el.type === "shortAnswer"
                          ? el.question
                          : el.type === "fillBlank"
                            ? el.text?.slice(0, 60) + "…"
                            : el.type === "blank"
                              ? el.label
                              : el.type === "matching"
                                ? el.title || "Matching activity"
                                : el.type}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            padding: "14px 24px",
            borderTop: "2px solid #F0F0F0",
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
          }}
        >
          <Btn onClick={onClose} bg="#F2F2F2" xs={{ color: "#666" }}>
            Cancel
          </Btn>
          <button
            onClick={printVersions}
            style={{
              padding: "10px 22px",
              borderRadius: 10,
              border: "none",
              background: gv.color,
              color: "white",
              fontFamily: FF,
              fontSize: 15,
              cursor: "pointer",
              boxShadow: `0 3px 12px ${gv.color}55`,
            }}
          >
            🖨️ Print All {numVersions} Version{numVersions > 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXPORT MODAL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ExportModal({ gv, ws, onClose }) {
  const [copied, setCopied] = useState(false);

  // Build plain-text export
  const toText = () => {
    const totalPages = Math.max(1, ws.pageCount || 1);
    const lines = [`${ws.title}`, "=".repeat(ws.title.length), ""];
    if (ws.showName) lines.push("Name: _______________________________   ");
    if (ws.showDate) lines.push("Date: _______________________________");
    lines.push("");
    const renderEl = (el, i) => {
      if (el.type === "instruction") {
        lines.push(`[Instructions]`);
        lines.push(el.text || "");
        lines.push("");
      } else if (el.type === "text") {
        lines.push(el.text || "");
        lines.push("");
      } else if (el.type === "multipleChoice") {
        lines.push(`${i + 1}. ${el.question}`);
        (el.choices || []).forEach((c) => lines.push(`   ○ ${c}`));
        lines.push("");
      } else if (el.type === "truefalse") {
        lines.push("True or False? Circle your answer.");
        (el.statements || []).forEach((s, j) => lines.push(`${j + 1}. ${s}    TRUE / FALSE`));
        lines.push("");
      } else if (el.type === "shortAnswer") {
        lines.push(el.question || "");
        lines.push("_".repeat(60));
        lines.push("");
      } else if (el.type === "fillBlank") {
        lines.push(el.text || "");
        lines.push("");
      } else if (el.type === "blank") {
        lines.push(el.label || "");
        lines.push("_".repeat(60));
        lines.push("");
      } else if (el.type === "essay") {
        lines.push(el.prompt || "");
        lines.push("_".repeat(60) + "\n".repeat(6));
        lines.push("");
      } else if (el.type === "wordBank") {
        lines.push(`[${el.title || "Word Bank"}]`);
        lines.push((el.words || []).join("   "));
        lines.push("");
      } else if (el.type === "matching") {
        lines.push(el.title || "Match the following:");
        (el.left || []).forEach((item, j) =>
          lines.push(`${item}  ──  ${(el.right || [])[j] || "______"}`),
        );
        lines.push("");
      } else if (el.type === "successCriteria" || el.type === "exitTicket") {
        if (el.title) lines.push(el.title);
        if (el.intro) lines.push(el.intro);
        (el.items || []).forEach((item) => lines.push(`[ ] ${item}`));
        lines.push("");
      } else if (el.type === "dokQuestions") {
        if (el.title) lines.push(el.title);
        if (el.intro) lines.push(el.intro);
        (el.levels || []).forEach((lv) => {
          lines.push(`-- DOK ${lv.level} · ${lv.label} --`);
          (lv.items || []).forEach((q) => lines.push(`[ ] ${q}`));
        });
        lines.push("");
      } else if (el.type === "divider") {
        lines.push("─".repeat(40));
        lines.push("");
      }
    };
    for (let p = 0; p < totalPages; p++) {
      if (totalPages > 1) {
        lines.push(`──── Page ${p + 1} ────`);
        lines.push("");
      }
      const pageEls = ws.elements.filter((e) => Math.min(totalPages - 1, e.page || 0) === p);
      pageEls.forEach((el, i) => renderEl(el, i));
      if (p < totalPages - 1) {
        lines.push("\f");
        lines.push("");
      }
    }
    // Standards Citations section
    const stds = ws.standards || [];
    if (stds.length > 0) {
      lines.push("");
      lines.push("═══════════════════════════════════════");
      lines.push("STANDARDS CITATIONS");
      lines.push("═══════════════════════════════════════");
      lines.push("Aligned to the New York State Next Generation Learning Standards.");
      lines.push("");
      stds.forEach((s) => {
        lines.push(`• ${s.code}: ${s.desc}`);
        // Show items aligned to this standard
        const aligned = (ws.elements || [])
          .map((el, i) => ({ el, i }))
          .filter(({ el }) => (el.stdCodes || []).includes(s.code));
        if (aligned.length) {
          aligned.forEach(({ el, i }) => lines.push(`     ↳ Item ${i + 1} (${el.type})`));
        }
        lines.push("");
      });
    }
    return lines.join("\n");
  };

  // Build full HTML export
  const toHTML = () => {
    const gv2 = gInfo(ws.gradeId);
    const renderEl = (el) => {
      const fs = gv2.fontSize;
      const mb = (s) => inlineMarkdownToHtml(s || "");
      if (el.type === "instruction")
        return `<div style="background:#FFFACD;padding:10px 16px;border-radius:10px;border-left:6px solid ${gv2.color};margin-bottom:16px;font-size:${Math.max(fs - 7, 13)}px;font-weight:700;line-height:1.55">${mb(el.text)}</div>`;
      if (el.type === "text")
        return `<p style="font-size:${fs}px;font-weight:600;margin:0 0 16px;line-height:1.7">${mb(el.text)}</p>`;
      if (el.type === "image" && el.url)
        return `<div style="text-align:${el.align || "center"};margin-bottom:16px"><img src="${el.url}" style="max-width:${el.size === "small" ? "35%" : el.size === "large" ? "95%" : "65%"};border-radius:10px;border:2px solid #EEE">${el.caption ? `<p style="font-size:12px;color:#777;text-align:center;margin:6px 0 0">${el.caption}</p>` : ""}</div>`;
      if (el.type === "multipleChoice")
        return `<div style="margin-bottom:18px"><p style="font-size:${fs}px;font-weight:800;margin:0 0 10px">${mb(el.question)}</p>${(el.choices || []).map((c) => `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><div style="width:20px;height:20px;border-radius:50%;border:2.5px solid ${gv2.color};flex-shrink:0"></div><span style="font-size:${fs}px">${mb(c)}</span></div>`).join("")}</div>`;
      if (el.type === "truefalse")
        return `<div style="margin-bottom:18px"><p style="font-size:${Math.max(fs - 5, 13)}px;font-weight:900;color:${gv2.color};margin:0 0 10px">True or False? Circle your answer.</p>${(el.statements || []).map((s) => `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding:8px 12px;background:${gv2.light};border-radius:8px"><span style="font-size:${fs}px">${mb(s)}</span><span style="font-size:12px;font-weight:900;color:${gv2.color};margin-left:20px;white-space:nowrap">TRUE &nbsp;&nbsp; FALSE</span></div>`).join("")}</div>`;
      if (el.type === "shortAnswer")
        return `<div style="margin-bottom:18px"><p style="font-size:${fs}px;font-weight:800;margin:0 0 12px">${mb(el.question)}</p>${Array.from(
          { length: el.lines || 4 },
        )
          .map(
            () =>
              `<div style="height:${gv2.lineH * 0.9}px;border-bottom:2px solid #CCC;margin-bottom:6px"></div>`,
          )
          .join("")}</div>`;
      if (el.type === "fillBlank")
        return `<div style="margin-bottom:18px">${el.note ? `<p style="font-size:12px;color:#999;margin:0 0 6px">${mb(el.note)}</p>` : ""}<p style="font-size:${fs}px;line-height:1.9;margin:0">${(
          el.text || ""
        )
          .split("______")
          .map((p, i, a) =>
            i < a.length - 1
              ? `${mb(p)}<span style="display:inline-block;width:90px;border-bottom:2.5px solid ${gv2.color};vertical-align:bottom;margin:0 3px"></span>`
              : mb(p),
          )
          .join("")}</p></div>`;
      if (el.type === "blank")
        return `<div style="margin-bottom:18px">${el.label ? `<p style="font-size:${fs}px;font-weight:800;margin:0 0 12px">${mb(el.label)}</p>` : ""} ${Array.from(
          { length: el.lines || 3 },
        )
          .map(
            () =>
              `<div style="height:${gv2.lineH}px;border-bottom:2.5px solid #CCC;margin-bottom:8px"></div>`,
          )
          .join("")}</div>`;
      if (el.type === "wordBank")
        return `<div style="margin-bottom:18px"><p style="font-size:${Math.max(fs - 4, 13)}px;font-weight:900;color:${gv2.color};margin:0 0 10px">${el.title || "Word Bank"}</p><div style="display:flex;flex-wrap:wrap;gap:8px;padding:10px 14px;background:${gv2.light};border-radius:10px">${(el.words || []).map((w) => `<span style="font-size:${fs}px;padding:4px 12px;border:2px solid ${gv2.color};border-radius:50px;background:white">${mb(w)}</span>`).join("")}</div></div>`;
      if (el.type === "matching")
        return `<div style="margin-bottom:18px">${el.title ? `<p style="font-size:${Math.max(fs - 4, 13)}px;font-weight:800;margin:0 0 12px">${mb(el.title)}</p>` : ""}<table style="width:100%;border-collapse:collapse"><tbody>${(el.left || []).map((item, i) => `<tr><td style="padding:6px 10px;border:2px solid ${gv2.color};border-radius:8px;width:40%;text-align:center;font-size:${fs}px">${mb(item)}</td><td style="text-align:center;padding:0 8px">—</td><td style="padding:6px 10px;border:2px solid ${gv2.color};border-radius:8px;width:40%;text-align:center;font-size:${fs}px">${mb((el.right || [])[i] || "")}</td></tr>`).join("")}</tbody></table></div>`;
      if (el.type === "essay")
        return `<div style="margin-bottom:18px"><p style="font-size:${fs}px;font-weight:800;margin:0 0 12px">${mb(el.prompt)}</p>${Array.from(
          { length: el.lines || 14 },
        )
          .map(
            () =>
              `<div style="height:${gv2.lineH * 0.75}px;border-bottom:1.5px solid #DDD;margin-bottom:4px"></div>`,
          )
          .join("")}</div>`;
      if (el.type === "divider")
        return `<div style="margin:8px 0;text-align:center;color:${gv2.color};font-size:16px">✦</div>`;
      if (el.type === "table")
        return `<div style="margin-bottom:18px">${el.title ? `<p style="font-size:${Math.max(fs - 4, 13)}px;font-weight:800;margin:0 0 10px">${mb(el.title)}</p>` : ""}<table style="width:100%;border-collapse:collapse;font-size:${Math.max(fs - 4, 12)}px"><thead><tr>${(el.headers || []).map((h) => `<th style="padding:8px 12px;border:2px solid ${gv2.color};background:${gv2.color};color:white;font-weight:900;text-align:center">${mb(h)}</th>`).join("")}</tr></thead><tbody>${(el.rows || []).map((row) => `<tr>${(row || []).map((cell) => `<td style="padding:6px 10px;border:1.5px solid #DDD;height:${gv2.lineH}px;vertical-align:top">${mb(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
      if (el.type === "successCriteria" || el.type === "exitTicket") {
        const a = el.type === "successCriteria" ? gv2.color : "#0369A1";
        const bg2 = el.type === "successCriteria" ? gv2.light : "#EFF6FF";
        return `<div style="margin-bottom:18px;background:${bg2};border:2px solid ${a}45;border-left:6px solid ${a};border-radius:10px;padding:12px 16px">${el.title ? `<p style="font-size:${Math.max(fs - 2, 13)}px;font-weight:900;color:${a};margin:0 0 6px">${el.title}</p>` : ""}${el.intro ? `<p style="font-size:${Math.max(fs - 4, 11)}px;font-weight:600;color:#374151;margin:0 0 10px;line-height:1.5">${mb(el.intro)}</p>` : ""}<ul style="list-style:none;padding:0;margin:0">${(el.items || []).map((item) => `<li style="display:flex;align-items:flex-start;gap:10px;margin-bottom:8px"><span style="flex-shrink:0;display:inline-block;width:18px;height:18px;margin-top:2px;border:2px solid ${a};border-radius:4px;background:white"></span><span style="font-size:${fs}px;font-weight:600;color:#111827;line-height:1.45">${mb(item)}</span></li>`).join("")}</ul></div>`;
      }
      if (el.type === "dokQuestions") {
        const LC = ["#10B981", "#0EA5E9", "#8B5CF6", "#F59E0B"];
        return `<div style="margin-bottom:18px;background:#FFFFFF;border:2px solid ${gv2.color}45;border-left:6px solid ${gv2.color};border-radius:10px;padding:12px 16px">${el.title ? `<p style="font-size:${Math.max(fs - 2, 13)}px;font-weight:900;color:${gv2.color};margin:0 0 6px">${el.title}</p>` : ""}${el.intro ? `<p style="font-size:${Math.max(fs - 4, 11)}px;font-weight:600;color:#374151;margin:0 0 10px;line-height:1.5">${mb(el.intro)}</p>` : ""}${(
          el.levels || []
        )
          .map((lv, li) => {
            const c = LC[(lv.level || li + 1) - 1] || gv2.color;
            return `<div style="background:${c}10;border:1.5px solid ${c}55;border-radius:8px;padding:8px 10px;margin-bottom:8px"><p style="font-size:${Math.max(fs - 4, 11)}px;font-weight:900;color:${c};margin:0 0 6px">DOK ${lv.level} · ${lv.label}</p><ul style="list-style:none;padding:0;margin:0">${(lv.items || []).map((q) => `<li style="display:flex;align-items:flex-start;gap:8px;margin-bottom:6px"><span style="flex-shrink:0;display:inline-block;width:16px;height:16px;margin-top:2px;border:2px solid ${c};border-radius:3px;background:white"></span><span style="font-size:${Math.max(fs - 1, 12)}px;font-weight:600;color:#111827;line-height:1.45">${mb(q)}</span></li>`).join("")}</ul></div>`;
          })
          .join("")}</div>`;
      }
      return "";
    };
    const totalPages = Math.max(1, ws.pageCount || 1);
    const hidden = new Set(ws.pageHeadersHidden || []);
    const pagesHtml = Array.from({ length: totalPages })
      .map((_, pIdx) => {
        const pageEls = ws.elements.filter((e) => Math.min(totalPages - 1, e.page || 0) === pIdx);
        const isLast = pIdx === totalPages - 1;
        const hideHeader = hidden.has(pIdx);
        const headerHtml = hideHeader
          ? ""
          : `<div style="border-bottom:3px solid ${gv2.color}25;padding-bottom:8px;margin-bottom:16px"><h1 style="font-family:'Fredoka One',cursive;color:${gv2.color};font-size:${gv2.fontSize + 6}px;margin:0 0 14px;padding-right:120px">${ws.title}${totalPages > 1 ? ` <span style="font-family:'Nunito',sans-serif;font-size:${Math.max(gv2.fontSize - 4, 12)}px;font-weight:700;color:#9CA3AF">— Page ${pIdx + 1}</span>` : ""}</h1><div style="display:flex;gap:44px">${ws.showName ? `<div style="display:flex;align-items:center;gap:8px;flex:1"><span style="font-weight:700;font-size:${Math.max(gv2.fontSize - 10, 12)}px">Name:</span><div style="flex:1;border-bottom:2px solid #CCC;height:22px"></div></div>` : ""} ${ws.showDate ? `<div style="display:flex;align-items:center;gap:8px;flex:1"><span style="font-weight:700;font-size:${Math.max(gv2.fontSize - 10, 12)}px">Date:</span><div style="flex:1;border-bottom:2px solid #CCC;height:22px"></div></div>` : ""}</div></div>`;
        return `<div class="ws-page" style="max-width:760px;margin:0 auto;padding:52px 64px;font-family:'Nunito',sans-serif;position:relative;${isLast ? "" : "page-break-after:always;"}">${ws.showGrade ? `<div style="position:absolute;top:14px;right:18px;background:${gv2.light};border:2px solid ${gv2.color}40;border-radius:20px;padding:3px 13px;font-size:11px;font-weight:900;color:${gv2.color}">${gv2.emoji} ${gv2.name}</div>` : ""}${headerHtml}${pageEls.map(renderEl).join("")}</div>`;
      })
      .join("");

    // Standards Citations page
    const safe = (s) =>
      String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    const stds = ws.standards || [];
    let citationsHtml = "";
    if (stds.length > 0) {
      const items = stds
        .map((s) => {
          const aligned = (ws.elements || [])
            .map((el, i) => ({ el, i }))
            .filter(({ el }) => (el.stdCodes || []).includes(s.code));
          const alignedHtml = aligned.length
            ? `<div style="margin-top:6px;padding-left:14px;font-size:12px;color:#555">Aligned items: ${aligned.map(({ i }) => `#${i + 1}`).join(", ")}</div>`
            : "";
          return `<li style="margin-bottom:14px;line-height:1.55"><strong style="color:${gv2.color}">${safe(s.code)}</strong> — ${safe(s.desc)}${alignedHtml}</li>`;
        })
        .join("");
      citationsHtml = `<div class="ws-page" style="max-width:760px;margin:0 auto;padding:52px 64px;font-family:'Nunito',sans-serif">
        <h2 style="font-family:'Fredoka One',cursive;color:${gv2.color};font-size:${gv2.fontSize + 4}px;margin:0 0 6px;border-bottom:3px solid ${gv2.color}25;padding-bottom:8px">📚 Standards Citations</h2>
        <p style="font-size:12.5px;color:#666;margin:0 0 16px">Aligned to the New York State Next Generation Learning Standards.</p>
        <ul style="padding-left:18px;margin:0;font-size:13.5px;color:#222">${items}</ul>
      </div>`;
    }

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${ws.title}</title><link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Fredoka+One&display=swap" rel="stylesheet"><style>*{box-sizing:border-box}body{margin:0;font-family:'Nunito',sans-serif}@media print{body{margin:0}.ws-page{page-break-after:always}.ws-page:last-child{page-break-after:auto}}</style></head><body>${pagesHtml}${citationsHtml}</body></html>`;
  };

  const downloadHTML = () => {
    const html = toHTML();
    const blob = new Blob([html], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${ws.title.replace(/\s+/g, "_") || "worksheet"}.html`;
    a.click();
  };

  const downloadTXT = () => {
    const txt = toText();
    const blob = new Blob([txt], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${ws.title.replace(/\s+/g, "_") || "worksheet"}.txt`;
    a.click();
  };

  const copyText = () => {
    navigator.clipboard.writeText(toText()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const openPrintPreview = () => {
    const w = window.open("", "_blank");
    w.document.write(toHTML());
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  const exports = [
    {
      icon: "🖨️",
      label: "Print / Save as PDF",
      desc: "Opens a clean print-ready preview. Choose 'Save as PDF' in your print dialog.",
      action: openPrintPreview,
      color: gv.color,
      primary: true,
    },
    {
      icon: "🌐",
      label: "Download as HTML",
      desc: "A self-contained webpage you can open in any browser or share online.",
      action: downloadHTML,
      color: "#3B6FE8",
    },
    {
      icon: "📄",
      label: "Download as .TXT",
      desc: "Plain text format — easy to paste into Google Docs, Word, or any editor.",
      action: downloadTXT,
      color: "#0FAB8C",
    },
    {
      icon: "📋",
      label: "Copy as Text",
      desc: copied
        ? "✅ Copied to clipboard!"
        : "Copies the full worksheet as plain text to your clipboard.",
      action: copyText,
      color: "#888",
    },
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white",
          borderRadius: 18,
          maxWidth: 520,
          width: "100%",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          animation: "fadeIn 0.25s ease",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "20px 24px 14px",
            borderBottom: "2px solid #F0F0F0",
            background: gv.light,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontFamily: FF, color: gv.color, fontSize: 22 }}>
              📤 Export Worksheet
            </h2>
            <p style={{ margin: "5px 0 0", fontSize: 12, color: "#999", fontFamily: F }}>
              Choose how you'd like to save or share this worksheet.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "white",
              border: "none",
              borderRadius: "50%",
              width: 34,
              height: 34,
              cursor: "pointer",
              fontSize: 16,
              color: "#888",
              fontWeight: 800,
            }}
          >
            ✕
          </button>
        </div>
        <div
          style={{ padding: "18px 24px 24px", display: "flex", flexDirection: "column", gap: 10 }}
        >
          {exports.map((ex) => (
            <button
              key={ex.label}
              onClick={ex.action}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 18px",
                borderRadius: 12,
                border: `2px solid ${ex.primary ? ex.color : "#EEE"}`,
                background: ex.primary ? ex.color : "white",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                if (!ex.primary) {
                  e.currentTarget.style.borderColor = ex.color;
                  e.currentTarget.style.background = "#F8F8FF";
                }
              }}
              onMouseLeave={(e) => {
                if (!ex.primary) {
                  e.currentTarget.style.borderColor = "#EEE";
                  e.currentTarget.style.background = "white";
                }
              }}
            >
              <span style={{ fontSize: 26, flexShrink: 0 }}>{ex.icon}</span>
              <div>
                <div
                  style={{
                    fontFamily: F,
                    fontWeight: 900,
                    fontSize: 14,
                    color: ex.primary ? "white" : "#222",
                    marginBottom: 3,
                  }}
                >
                  {ex.label}
                </div>
                <div
                  style={{
                    fontFamily: F,
                    fontSize: 12,
                    color: ex.primary ? "rgba(255,255,255,0.8)" : "#999",
                    lineHeight: 1.4,
                  }}
                >
                  {ex.desc}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELP MODAL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function HelpModal({ onClose, gv }) {
  const secs = [
    {
      icon: "🎯",
      title: "Getting Started",
      body: "1. Select the grade level from the dropdown in the top bar — Pre-K through Grade 12.\n2. Type your worksheet title.\n3. Add elements from the LEFT panel (click the + buttons).\n4. Click any element on the worksheet to edit it in the right panel.\n5. Use the tabs on the right for Editing, AI Images, and AI Help.\n6. Click PRINT to print or save as PDF.",
    },
    {
      icon: "📊",
      title: "Grade Levels",
      body: "Font size and spacing scale automatically by grade:\n🌱 Pre-K: 38pt  •  K: 32pt  •  Gr 1: 28pt  •  Gr 2: 24pt\n⭐ Gr 3: 22pt  •  Gr 4: 20pt  •  Gr 5: 18pt\n🏫 Gr 6: 17pt  •  Gr 7: 16pt  •  Gr 8: 15pt\n🎓 Grades 9–12: 14pt (standard print size)\nColor themes change by grade band automatically.",
    },
    {
      icon: "🗽",
      title: "NY Standards Picker",
      body: "Click '🗽 NY Standards' in the left panel to browse New York State standards. Filter by Subject (ELA, Math, Science, Social Studies, Health, Arts, Technology) and Grade Band. Search by keyword. Click any standard to add it as a header at the top of your worksheet.",
    },
    {
      icon: "🎨",
      title: "AI Image Generator",
      body: "Click the '🎨 Image' tab on the right. Type a description of the image you need — for example: 'a cartoon frog sitting on a lily pad' or 'a diagram of the water cycle'. Choose a style: Cartoon, Photograph, Line Art, Clipart, or Diagram. Click Generate. When your image appears, click '➕ Add to Worksheet'.\n\nNote: Generation takes 10–20 seconds. Click Regenerate for a new variation.",
    },
    {
      icon: "📎",
      title: "Reference Upload",
      body: "In the left panel under 'Reference Worksheet', click the upload area and select a photo or screenshot of a worksheet you want to recreate or draw inspiration from. The AI will analyze it automatically. Then go to the AI Help tab and ask: 'Help me build a worksheet similar to my reference' — and it will use that context!",
    },
    {
      icon: "🖨️",
      title: "Printing & Saving as PDF",
      body: "Click the PRINT button in the top bar. In the print dialog, choose 'Save as PDF' to create a PDF file. All panels and editing UI disappear when printing — only your clean worksheet appears. The grade level badge is printed on the worksheet.",
    },
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white",
          borderRadius: 18,
          maxWidth: 660,
          width: "100%",
          maxHeight: "88vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          animation: "fadeIn 0.25s ease",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "20px 24px 14px",
            borderBottom: "2px solid #F0F0F0",
            background: gv.light,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 style={{ margin: 0, fontFamily: FF, color: gv.color, fontSize: 22 }}>
            📖 How to Use WorksheetBuilder
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "white",
              border: "none",
              borderRadius: "50%",
              width: 34,
              height: 34,
              cursor: "pointer",
              fontSize: 16,
              color: "#888",
              fontWeight: 800,
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ overflowY: "auto", padding: "18px 24px 28px" }}>
          {secs.map((s, i) => (
            <div
              key={i}
              style={{
                marginBottom: 22,
                paddingBottom: 22,
                borderBottom: i < secs.length - 1 ? "1px solid #F0F0F0" : "none",
              }}
            >
              <h3 style={{ fontFamily: FF, color: gv.color, margin: "0 0 8px 0", fontSize: 16 }}>
                {s.icon} {s.title}
              </h3>
              <p
                style={{
                  fontFamily: F,
                  fontSize: 13.5,
                  color: "#444",
                  lineHeight: 1.65,
                  margin: 0,
                  whiteSpace: "pre-wrap",
                }}
              >
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ALIGNMENT MODAL — shows which standard each question/activity maps to
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function AlignmentModal({ gv, ws, onClose, onSetMapping }) {
  const standards = ws.standards || [];
  const items = (ws.elements || []).filter((e) => !["divider"].includes(e.type));

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white",
          borderRadius: 18,
          maxWidth: 760,
          width: "100%",
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "20px 24px 14px",
            borderBottom: "2px solid #F0F0F0",
            background: gv.light,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontFamily: FF, color: gv.color, fontSize: 22 }}>
              🎯 Standards Alignment
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#666", fontFamily: F }}>
              See which NYS standard each worksheet item maps to. Click a standard chip to assign or
              remove it.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "white",
              border: "none",
              borderRadius: "50%",
              width: 34,
              height: 34,
              cursor: "pointer",
              fontSize: 16,
              color: "#888",
              fontWeight: 800,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ overflowY: "auto", padding: "16px 24px 22px" }}>
          {standards.length === 0 && (
            <div
              style={{
                padding: 16,
                background: "#FFF7ED",
                border: "1.5px dashed #FDBA74",
                borderRadius: 10,
                fontFamily: F,
                fontSize: 13,
                color: "#9A3412",
                marginBottom: 14,
              }}
            >
              No standards have been added yet. Use the <strong>🗽 NY Standards</strong> button in
              the left panel to add one or more standards. Items will then map to those standards
              here.
            </div>
          )}

          {standards.length > 0 && (
            <>
              <div style={{ marginBottom: 16 }}>
                <p style={{ ...LBL, marginTop: 0 }}>Cited Standards ({standards.length})</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {standards.map((s) => (
                    <span
                      key={s.code}
                      title={s.desc}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 14,
                        background: gv.light,
                        border: `1.5px solid ${gv.color}`,
                        color: gv.color,
                        fontFamily: F,
                        fontSize: 11.5,
                        fontWeight: 800,
                      }}
                    >
                      {s.code}
                    </span>
                  ))}
                </div>
              </div>

              <p style={{ ...LBL, marginTop: 0 }}>Item-by-Item Mapping</p>
              {items.map((el, i) => {
                const mapped = el.stdCodes || [];
                return (
                  <div
                    key={el.id}
                    style={{
                      padding: "10px 12px",
                      border: "1.5px solid #EEE",
                      borderRadius: 10,
                      marginBottom: 8,
                      background: mapped.length ? "white" : "#FAFAFA",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: F,
                        fontSize: 12.5,
                        color: "#374151",
                        marginBottom: 6,
                        lineHeight: 1.4,
                      }}
                    >
                      {elSummary(el, i)}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {standards.map((s) => {
                        const on = mapped.includes(s.code);
                        return (
                          <button
                            key={s.code}
                            onClick={() => {
                              const next = on
                                ? mapped.filter((c) => c !== s.code)
                                : [...mapped, s.code];
                              onSetMapping(el.id, next);
                            }}
                            style={{
                              padding: "3px 9px",
                              borderRadius: 12,
                              border: `1.5px solid ${on ? gv.color : "#DDD"}`,
                              background: on ? gv.color : "white",
                              color: on ? "white" : "#666",
                              fontFamily: F,
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            {on ? "✓ " : ""}
                            {s.code}
                          </button>
                        );
                      })}
                      {mapped.length === 0 && (
                        <span
                          style={{
                            fontFamily: F,
                            fontSize: 11,
                            color: "#9CA3AF",
                            padding: "3px 4px",
                          }}
                        >
                          Unaligned
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {items.length === 0 && (
                <p
                  style={{
                    fontFamily: F,
                    color: "#9CA3AF",
                    fontSize: 13,
                    textAlign: "center",
                    padding: 20,
                  }}
                >
                  No items on the worksheet yet.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export {
  BANDS,
  GRADES,
  gInfo,
  NY_STANDARDS,
  IMG_STYLES,
  PALETTE,
  uid,
  COLS,
  COL_GAP_PCT,
  COL_W_PCT,
  ROW_HEIGHT,
  nextSlot,
  mkEl,
  PRINT_CSS,
  F,
  FF,
  WORKSHEET_FONTS,
  Btn,
  LBL,
  INP,
  SHAPE_TYPES,
  ShapeSVG,
  BASELINE_WIDTH_PCT,
  BASELINE_HEIGHT_PX,
  SCALE_MIN,
  SCALE_MAX,
  clampScale,
  resizeScaleFor,
  ScaledContent,
  ElView,
  ElEditor,
  DOK_LEVEL_DEFS,
  DokEditor,
  ChecklistEditor,
  CustomShapeEditor,
  gradeIdToStdBand,
  StandardsModal,
  VERSION_LABELS,
  shuffle,
  isQuestion,
  VersionsModal,
  ExportModal,
  HelpModal,
  elSummary,
  AlignmentModal,
};
