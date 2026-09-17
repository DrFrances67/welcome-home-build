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

import {
  Btn,
  LBL,
  INP,
  ShapeSVG,
  ScaledContent,
} from "./worksheet-primitives";
import type { WsElement, GlobalView } from "./worksheet-primitives";
import {
  ElView,
  ElEditor,
  DokEditor,
  ChecklistEditor,
  CustomShapeEditor,
} from "./worksheet-elements";

function StandardsModal({
  gv,
  onClose,
  onInsert,
  onGenerate,
  gradeId,
}: {
  gv: GlobalView;
  onClose: (...a: any[]) => void;
  onInsert?: (...a: any[]) => void;
  onGenerate?: (...a: any[]) => void;
  gradeId?: any;
}) {
  const STD = getActiveStandards();
  const stateInfo = getActiveStateInfo();
  const subjects = Object.keys(STD);
  const [subj, setSubj] = useState(subjects[0] || "ELA");
  const [band, setBand] = useState(() =>
    gradeId ? gradeIdToStdBand(gradeId, subjects[0] || "ELA") || "Kindergarten" : "Kindergarten",
  );
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Standard | null>(null);
  const [showHeader, setShowHeader] = useState(true);
  const [matchGrade, setMatchGrade] = useState(!!gradeId);

  const bands = Object.keys(STD[subj] || {});
  const stds = STD[subj]?.[band] || [];
  const filtered = search.trim()
    ? stds.filter(
        (s: Standard) =>
          s.code.toLowerCase().includes(search.toLowerCase()) ||
          s.desc.toLowerCase().includes(search.toLowerCase()),
      )
    : stds;

  const handlePick = (s: Standard) => {
    setPicked(s);
  };

  // Auto-update band when subject changes if matchGrade is on
  const onSubjChange = (s: string) => {
    setSubj(s);
    if (matchGrade && gradeId) setBand(gradeIdToStdBand(gradeId, s));
    else setBand(s === "ELA" ? "Kindergarten" : Object.keys(STD[s] || {})[0] || "");
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
              {stateInfo.flag} {stateInfo.name} Standards
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
          {filtered.map((s: Standard, i: number) => {
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
                    onInsert?.(picked, showHeader);
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
                    onGenerate?.(picked, showHeader);
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

function VersionsModal({
  gv,
  ws,
  onClose,
}: {
  gv: GlobalView;
  ws: any;
  onClose: (...a: any[]) => void;
}) {
  const [numVersions, setNumVersions] = useState(2);
  const [randomize, setRandomize] = useState(true);
  const [keepFixed, setKeepFixed] = useState(true); // keep non-question elements (instructions, passages) in place
  const [previewVer, setPreviewVer] = useState<number | null>(null); // null = config, 0-3 = preview index

  // Build a version's element order
  const buildVersion = (label: string) => {
    const fixed = keepFixed ? ws.elements.filter((el: WorksheetElement) => !isQuestion(el)) : [];
    const questions = ws.elements.filter((el: WorksheetElement) => isQuestion(el));
    const orderedQs = randomize ? shuffle(questions) : questions;
    if (!keepFixed) return randomize ? shuffle([...ws.elements]) : [...ws.elements];
    // Re-interleave: put questions back in their (shuffled) positions
    let qi = 0;
    return ws.elements.map((el: WorksheetElement) => (isQuestion(el) ? orderedQs[qi++] : el));
  };

  const versions = VERSION_LABELS.slice(0, numVersions).map(buildVersion);

  const printVersions = () => {
    const gv2 = gInfo(ws.gradeId);
    const renderEl = (el: WorksheetElement) => {
      if (!el) return "";
      const fs = gv2.fontSize;
      const mb = (s?: string) => inlineMarkdownToHtml(s || "");
      if (el.type === "instruction")
        return `<div style="background:#FFFACD;padding:10px 16px;border-radius:10px;border-left:6px solid ${gv2.color};margin-bottom:16px;font-size:${Math.max(fs - 7, 13)}px;font-weight:700;line-height:1.55">${mb(el.text)}</div>`;
      if (el.type === "text")
        return `<p style="font-size:${fs}px;font-weight:600;margin:0 0 16px;line-height:1.7">${mb(el.text)}</p>`;
      if (el.type === "multipleChoice")
        return `<div style="margin-bottom:18px"><p style="font-size:${fs}px;font-weight:800;margin:0 0 10px">${mb(el.question)}</p>${(el.choices || []).map((c: string) => `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><div style="width:20px;height:20px;border-radius:50%;border:2.5px solid ${gv2.color};flex-shrink:0"></div><span style="font-size:${fs}px">${mb(c)}</span></div>`).join("")}</div>`;
      if (el.type === "truefalse")
        return `<div style="margin-bottom:18px"><p style="font-size:${Math.max(fs - 5, 13)}px;font-weight:900;color:${gv2.color};margin:0 0 10px">True or False? Circle your answer.</p>${(el.statements || []).map((s: string) => `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding:8px 12px;background:${gv2.light};border-radius:8px"><span style="font-size:${fs}px">${mb(s)}</span><span style="font-size:12px;font-weight:900;color:${gv2.color};margin-left:20px;white-space:nowrap">TRUE &nbsp;&nbsp; FALSE</span></div>`).join("")}</div>`;
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
          .map((p: string, i: number, a: string[]) =>
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
        return `<div style="margin-bottom:18px">${el.title ? `<p style="font-size:${Math.max(fs - 4, 13)}px;font-weight:800;margin:0 0 12px">${mb(el.title)}</p>` : ""}<table style="width:100%"><tbody>${(el.left || []).map((item: string, i: number) => `<tr><td style="padding:6px 10px;border:2px solid ${gv2.color};border-radius:8px;width:40%;text-align:center;font-size:${fs}px">${mb(item)}</td><td style="text-align:center;padding:0 8px">—</td><td style="padding:6px 10px;border:2px solid ${gv2.color};border-radius:8px;width:40%;text-align:center;font-size:${fs}px">${mb((el.right || [])[i] || "")}</td></tr>`).join("")}</tbody></table></div>`;
      if (el.type === "wordBank")
        return `<div style="margin-bottom:18px"><p style="font-size:${Math.max(fs - 4, 13)}px;font-weight:900;color:${gv2.color};margin:0 0 10px">${el.title || "Word Bank"}</p><div style="display:flex;flex-wrap:wrap;gap:8px;padding:10px 14px;background:${gv2.light};border-radius:10px">${(el.words || []).map((w: string) => `<span style="font-size:${fs}px;padding:4px 12px;border:2px solid ${gv2.color};border-radius:50px;background:white">${mb(w)}</span>`).join("")}</div></div>`;
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
        return `<div style="margin-bottom:18px;background:${bg2};border:2px solid ${a}45;border-left:6px solid ${a};border-radius:10px;padding:12px 16px">${el.title ? `<p style="font-size:${Math.max(fs - 2, 13)}px;font-weight:900;color:${a};margin:0 0 6px">${el.title}</p>` : ""}${el.intro ? `<p style="font-size:${Math.max(fs - 4, 11)}px;font-weight:600;color:#374151;margin:0 0 10px;line-height:1.5">${mb(el.intro)}</p>` : ""}<ul style="list-style:none;padding:0;margin:0">${(el.items || []).map((item: string) => `<li style="display:flex;align-items:flex-start;gap:10px;margin-bottom:8px"><span style="flex-shrink:0;display:inline-block;width:18px;height:18px;margin-top:2px;border:2px solid ${a};border-radius:4px;background:white"></span><span style="font-size:${fs}px;font-weight:600;color:#111827;line-height:1.45">${mb(item)}</span></li>`).join("")}</ul></div>`;
      }
      if (el.type === "dokQuestions") {
        const LC = ["#10B981", "#0EA5E9", "#8B5CF6", "#F59E0B"];
        return `<div style="margin-bottom:18px;background:#FFFFFF;border:2px solid ${gv2.color}45;border-left:6px solid ${gv2.color};border-radius:10px;padding:12px 16px">${el.title ? `<p style="font-size:${Math.max(fs - 2, 13)}px;font-weight:900;color:${gv2.color};margin:0 0 6px">${el.title}</p>` : ""}${el.intro ? `<p style="font-size:${Math.max(fs - 4, 11)}px;font-weight:600;color:#374151;margin:0 0 10px;line-height:1.5">${mb(el.intro)}</p>` : ""}${(
          el.levels || []
        )
          .map((lv: DokLevel, li: number) => {
            const c = LC[(lv.level || li + 1) - 1] || gv2.color;
            return `<div style="background:${c}10;border:1.5px solid ${c}55;border-radius:8px;padding:8px 10px;margin-bottom:8px"><p style="font-size:${Math.max(fs - 4, 11)}px;font-weight:900;color:${c};margin:0 0 6px">DOK ${lv.level} · ${lv.label}</p><ul style="list-style:none;padding:0;margin:0">${(lv.items || []).map((q: string) => `<li style="display:flex;align-items:flex-start;gap:8px;margin-bottom:6px"><span style="flex-shrink:0;display:inline-block;width:16px;height:16px;margin-top:2px;border:2px solid ${c};border-radius:3px;background:white"></span><span style="font-size:${Math.max(fs - 1, 12)}px;font-weight:600;color:#111827;line-height:1.45">${mb(q)}</span></li>`).join("")}</ul></div>`;
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
    if (!w) return;
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
                {(
                  [
                    [randomize, setRandomize, "Randomize question order"],
                    [keepFixed, setKeepFixed, "Keep instructions & passages fixed"],
                  ] as [boolean, React.Dispatch<React.SetStateAction<boolean>>, string][]
                ).map(([val, set, lbl], i) => (
                  <label
                    key={i}
                    style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}
                  >
                    <div
                      onClick={() => set((v: boolean) => !v)}
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
            {(
              [
                ["Total elements", ws.elements.length],
                ["Questions (randomized)", ws.elements.filter(isQuestion).length],
                [
                  "Fixed elements",
                  ws.elements.filter((e: WorksheetElement) => !isQuestion(e)).length,
                ],
              ] as [string, number][]
            ).map(([lbl, val]) => (
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
              {versions[previewVer].filter(isQuestion).map((el: WorksheetElement, i: number) => (
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
          <Btn onClick={onClose} bg="#F2F2F2" style={{ color: "#666" }}>
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

function ExportModal({
  gv,
  ws,
  onClose,
}: {
  gv: GlobalView;
  ws: any;
  onClose: (...a: any[]) => void;
}) {
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Close on Escape and move focus into the dialog when it opens.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Build plain-text export
  const toText = () => {
    const totalPages = Math.max(1, ws.pageCount || 1);
    const lines = [`${ws.title}`, "=".repeat(ws.title.length), ""];
    if (ws.showName) lines.push("Name: _______________________________   ");
    if (ws.showDate) lines.push("Date: _______________________________");
    lines.push("");
    const renderEl = (el: WorksheetElement, i: number) => {
      if (el.type === "instruction") {
        lines.push(`[Instructions]`);
        lines.push(el.text || "");
        lines.push("");
      } else if (el.type === "text") {
        lines.push(el.text || "");
        lines.push("");
      } else if (el.type === "multipleChoice") {
        lines.push(`${i + 1}. ${el.question}`);
        (el.choices || []).forEach((c: string) => lines.push(`   ○ ${c}`));
        lines.push("");
      } else if (el.type === "truefalse") {
        lines.push("True or False? Circle your answer.");
        (el.statements || []).forEach((s: string, j: number) =>
          lines.push(`${j + 1}. ${s}    TRUE / FALSE`),
        );
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
        (el.left || []).forEach((item: string, j: number) =>
          lines.push(`${item}  ──  ${(el.right || [])[j] || "______"}`),
        );
        lines.push("");
      } else if (el.type === "successCriteria" || el.type === "exitTicket") {
        if (el.title) lines.push(el.title);
        if (el.intro) lines.push(el.intro);
        (el.items || []).forEach((item: string) => lines.push(`[ ] ${item}`));
        lines.push("");
      } else if (el.type === "dokQuestions") {
        if (el.title) lines.push(el.title);
        if (el.intro) lines.push(el.intro);
        (el.levels || []).forEach((lv: DokLevel) => {
          lines.push(`-- DOK ${lv.level} · ${lv.label} --`);
          (lv.items || []).forEach((q: string) => lines.push(`[ ] ${q}`));
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
      const pageEls = ws.elements.filter(
        (e: WorksheetElement) => Math.min(totalPages - 1, e.page || 0) === p,
      );
      pageEls.forEach((el: WorksheetElement, i: number) => renderEl(el, i));
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
      lines.push(`Aligned to the ${getActiveStateInfo().standardsName}.`);
      lines.push("");
      stds.forEach((s: { code: string; desc: string }) => {
        lines.push(`• ${s.code}: ${s.desc}`);
        // Show items aligned to this standard
        const aligned = (ws.elements || [])
          .map((el: WorksheetElement, i: number) => ({ el, i }))
          .filter(({ el }: { el: WorksheetElement }) =>
            ((el.stdCodes as string[]) || []).includes(s.code),
          );
        if (aligned.length) {
          aligned.forEach(({ el, i }: { el: WorksheetElement; i: number }) =>
            lines.push(`     ↳ Item ${i + 1} (${el.type})`),
          );
        }
        lines.push("");
      });
    }
    return lines.join("\n");
  };

  // Build full HTML export
  const toHTML = () => {
    const gv2 = gInfo(ws.gradeId);
    const renderEl = (el: WorksheetElement) => {
      const fs = gv2.fontSize;
      const mb = (s?: string) => inlineMarkdownToHtml(s || "");
      if (el.type === "instruction")
        return `<div style="background:#FFFACD;padding:10px 16px;border-radius:10px;border-left:6px solid ${gv2.color};margin-bottom:16px;font-size:${Math.max(fs - 7, 13)}px;font-weight:700;line-height:1.55">${mb(el.text)}</div>`;
      if (el.type === "text")
        return `<p style="font-size:${fs}px;font-weight:600;margin:0 0 16px;line-height:1.7">${mb(el.text)}</p>`;
      if (el.type === "image" && el.url)
        return `<div style="text-align:${el.align || "center"};margin-bottom:16px"><img src="${el.url}" style="max-width:${el.size === "small" ? "35%" : el.size === "large" ? "95%" : "65%"};border-radius:10px;border:2px solid #EEE">${el.caption ? `<p style="font-size:12px;color:#777;text-align:center;margin:6px 0 0">${el.caption}</p>` : ""}</div>`;
      if (el.type === "multipleChoice")
        return `<div style="margin-bottom:18px"><p style="font-size:${fs}px;font-weight:800;margin:0 0 10px">${mb(el.question)}</p>${(el.choices || []).map((c: string) => `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><div style="width:20px;height:20px;border-radius:50%;border:2.5px solid ${gv2.color};flex-shrink:0"></div><span style="font-size:${fs}px">${mb(c)}</span></div>`).join("")}</div>`;
      if (el.type === "truefalse")
        return `<div style="margin-bottom:18px"><p style="font-size:${Math.max(fs - 5, 13)}px;font-weight:900;color:${gv2.color};margin:0 0 10px">True or False? Circle your answer.</p>${(el.statements || []).map((s: string) => `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding:8px 12px;background:${gv2.light};border-radius:8px"><span style="font-size:${fs}px">${mb(s)}</span><span style="font-size:12px;font-weight:900;color:${gv2.color};margin-left:20px;white-space:nowrap">TRUE &nbsp;&nbsp; FALSE</span></div>`).join("")}</div>`;
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
          .map((p: string, i: number, a: string[]) =>
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
        return `<div style="margin-bottom:18px"><p style="font-size:${Math.max(fs - 4, 13)}px;font-weight:900;color:${gv2.color};margin:0 0 10px">${el.title || "Word Bank"}</p><div style="display:flex;flex-wrap:wrap;gap:8px;padding:10px 14px;background:${gv2.light};border-radius:10px">${(el.words || []).map((w: string) => `<span style="font-size:${fs}px;padding:4px 12px;border:2px solid ${gv2.color};border-radius:50px;background:white">${mb(w)}</span>`).join("")}</div></div>`;
      if (el.type === "matching")
        return `<div style="margin-bottom:18px">${el.title ? `<p style="font-size:${Math.max(fs - 4, 13)}px;font-weight:800;margin:0 0 12px">${mb(el.title)}</p>` : ""}<table style="width:100%;border-collapse:collapse"><tbody>${(el.left || []).map((item: string, i: number) => `<tr><td style="padding:6px 10px;border:2px solid ${gv2.color};border-radius:8px;width:40%;text-align:center;font-size:${fs}px">${mb(item)}</td><td style="text-align:center;padding:0 8px">—</td><td style="padding:6px 10px;border:2px solid ${gv2.color};border-radius:8px;width:40%;text-align:center;font-size:${fs}px">${mb((el.right || [])[i] || "")}</td></tr>`).join("")}</tbody></table></div>`;
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
        return `<div style="margin-bottom:18px">${el.title ? `<p style="font-size:${Math.max(fs - 4, 13)}px;font-weight:800;margin:0 0 10px">${mb(el.title)}</p>` : ""}<table style="width:100%;border-collapse:collapse;font-size:${Math.max(fs - 4, 12)}px"><thead><tr>${(el.headers || []).map((h: string) => `<th style="padding:8px 12px;border:2px solid ${gv2.color};background:${gv2.color};color:white;font-weight:900;text-align:center">${mb(h)}</th>`).join("")}</tr></thead><tbody>${(el.rows || []).map((row: string[]) => `<tr>${(row || []).map((cell: string) => `<td style="padding:6px 10px;border:1.5px solid #DDD;height:${gv2.lineH}px;vertical-align:top">${mb(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
      if (el.type === "successCriteria" || el.type === "exitTicket") {
        const a = el.type === "successCriteria" ? gv2.color : "#0369A1";
        const bg2 = el.type === "successCriteria" ? gv2.light : "#EFF6FF";
        return `<div style="margin-bottom:18px;background:${bg2};border:2px solid ${a}45;border-left:6px solid ${a};border-radius:10px;padding:12px 16px">${el.title ? `<p style="font-size:${Math.max(fs - 2, 13)}px;font-weight:900;color:${a};margin:0 0 6px">${el.title}</p>` : ""}${el.intro ? `<p style="font-size:${Math.max(fs - 4, 11)}px;font-weight:600;color:#374151;margin:0 0 10px;line-height:1.5">${mb(el.intro)}</p>` : ""}<ul style="list-style:none;padding:0;margin:0">${(el.items || []).map((item: string) => `<li style="display:flex;align-items:flex-start;gap:10px;margin-bottom:8px"><span style="flex-shrink:0;display:inline-block;width:18px;height:18px;margin-top:2px;border:2px solid ${a};border-radius:4px;background:white"></span><span style="font-size:${fs}px;font-weight:600;color:#111827;line-height:1.45">${mb(item)}</span></li>`).join("")}</ul></div>`;
      }
      if (el.type === "dokQuestions") {
        const LC = ["#10B981", "#0EA5E9", "#8B5CF6", "#F59E0B"];
        return `<div style="margin-bottom:18px;background:#FFFFFF;border:2px solid ${gv2.color}45;border-left:6px solid ${gv2.color};border-radius:10px;padding:12px 16px">${el.title ? `<p style="font-size:${Math.max(fs - 2, 13)}px;font-weight:900;color:${gv2.color};margin:0 0 6px">${el.title}</p>` : ""}${el.intro ? `<p style="font-size:${Math.max(fs - 4, 11)}px;font-weight:600;color:#374151;margin:0 0 10px;line-height:1.5">${mb(el.intro)}</p>` : ""}${(
          el.levels || []
        )
          .map((lv: DokLevel, li: number) => {
            const c = LC[(lv.level || li + 1) - 1] || gv2.color;
            return `<div style="background:${c}10;border:1.5px solid ${c}55;border-radius:8px;padding:8px 10px;margin-bottom:8px"><p style="font-size:${Math.max(fs - 4, 11)}px;font-weight:900;color:${c};margin:0 0 6px">DOK ${lv.level} · ${lv.label}</p><ul style="list-style:none;padding:0;margin:0">${(lv.items || []).map((q: string) => `<li style="display:flex;align-items:flex-start;gap:8px;margin-bottom:6px"><span style="flex-shrink:0;display:inline-block;width:16px;height:16px;margin-top:2px;border:2px solid ${c};border-radius:3px;background:white"></span><span style="font-size:${Math.max(fs - 1, 12)}px;font-weight:600;color:#111827;line-height:1.45">${mb(q)}</span></li>`).join("")}</ul></div>`;
          })
          .join("")}</div>`;
      }
      return "";
    };
    const totalPages = Math.max(1, ws.pageCount || 1);
    const hidden = new Set(ws.pageHeadersHidden || []);
    const pagesHtml = Array.from({ length: totalPages })
      .map((_, pIdx) => {
        const pageEls = ws.elements.filter(
          (e: WorksheetElement) => Math.min(totalPages - 1, e.page || 0) === pIdx,
        );
        const isLast = pIdx === totalPages - 1;
        const hideHeader = hidden.has(pIdx);
        const headerHtml = hideHeader
          ? ""
          : `<div style="border-bottom:3px solid ${gv2.color}25;padding-bottom:8px;margin-bottom:16px"><h1 style="font-family:'Fredoka One',cursive;color:${gv2.color};font-size:${gv2.fontSize + 6}px;margin:0 0 14px;padding-right:120px">${ws.title}${totalPages > 1 ? ` <span style="font-family:'Nunito',sans-serif;font-size:${Math.max(gv2.fontSize - 4, 12)}px;font-weight:700;color:#9CA3AF">— Page ${pIdx + 1}</span>` : ""}</h1><div style="display:flex;gap:44px">${ws.showName ? `<div style="display:flex;align-items:center;gap:8px;flex:1"><span style="font-weight:700;font-size:${Math.max(gv2.fontSize - 10, 12)}px">Name:</span><div style="flex:1;border-bottom:2px solid #CCC;height:22px"></div></div>` : ""} ${ws.showDate ? `<div style="display:flex;align-items:center;gap:8px;flex:1"><span style="font-weight:700;font-size:${Math.max(gv2.fontSize - 10, 12)}px">Date:</span><div style="flex:1;border-bottom:2px solid #CCC;height:22px"></div></div>` : ""}</div></div>`;
        return `<div class="ws-page" style="max-width:760px;margin:0 auto;padding:52px 64px;font-family:'Nunito',sans-serif;position:relative;${isLast ? "" : "page-break-after:always;"}">${ws.showGrade ? `<div style="position:absolute;top:14px;right:18px;background:${gv2.light};border:2px solid ${gv2.color}40;border-radius:20px;padding:3px 13px;font-size:11px;font-weight:900;color:${gv2.color}">${gv2.emoji} ${gv2.name}</div>` : ""}${headerHtml}${pageEls.map(renderEl).join("")}</div>`;
      })
      .join("");

    // Standards Citations page
    const safe = (s?: string) =>
      String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    const stds = ws.standards || [];
    let citationsHtml = "";
    if (stds.length > 0) {
      const items = stds
        .map((s: { code: string; desc: string }) => {
          const aligned = (ws.elements || [])
            .map((el: WorksheetElement, i: number) => ({ el, i }))
            .filter(({ el }: { el: WorksheetElement }) =>
              ((el.stdCodes as string[]) || []).includes(s.code),
            );
          const alignedHtml = aligned.length
            ? `<div style="margin-top:6px;padding-left:14px;font-size:12px;color:#555">Aligned items: ${aligned.map(({ i }: { i: number }) => `#${i + 1}`).join(", ")}</div>`
            : "";
          return `<li style="margin-bottom:14px;line-height:1.55"><strong style="color:${gv2.color}">${safe(s.code)}</strong> — ${safe(s.desc)}${alignedHtml}</li>`;
        })
        .join("");
      citationsHtml = `<div class="ws-page" style="max-width:760px;margin:0 auto;padding:52px 64px;font-family:'Nunito',sans-serif">
        <h2 style="font-family:'Fredoka One',cursive;color:${gv2.color};font-size:${gv2.fontSize + 4}px;margin:0 0 6px;border-bottom:3px solid ${gv2.color}25;padding-bottom:8px">📚 Standards Citations</h2>
        <p style="font-size:12.5px;color:#666;margin:0 0 16px">Aligned to the ${getActiveStateInfo().standardsName}.</p>
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
    if (!w) return;
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
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-modal-title"
        aria-describedby="export-modal-desc"
        tabIndex={-1}
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
          outline: "none",
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
            <h2
              id="export-modal-title"
              style={{ margin: 0, fontFamily: FF, color: gv.color, fontSize: 22 }}
            >
              📤 Export Worksheet
            </h2>
            <p
              id="export-modal-desc"
              style={{ margin: "5px 0 0", fontSize: 12, color: "#999", fontFamily: F }}
            >
              Choose how you'd like to save or share this worksheet.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close export dialog"
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

function HelpModal({ onClose, gv }: { onClose: (...a: any[]) => void; gv: GlobalView }) {
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
      icon: getActiveStateInfo().flag,
      title: `${getActiveStateInfo().standardsShort} Picker`,
      body: `Click '${getActiveStateInfo().flag} ${getActiveStateInfo().standardsShort}' in the left panel to browse ${getActiveStateInfo().name} standards. Filter by Subject and Grade Band. Search by keyword. Click any standard to add it as a header at the top of your worksheet.`,
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

function AlignmentModal({
  gv,
  ws,
  onClose,
  onSetMapping,
}: {
  gv: GlobalView;
  ws: any;
  onClose: (...a: any[]) => void;
  onSetMapping?: (...a: any[]) => void;
}) {
  const stateInfo = getActiveStateInfo();
  const standards = ws.standards || [];
  const items = (ws.elements || []).filter((e: WorksheetElement) => !["divider"].includes(e.type));

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
              See which {stateInfo.standardsShort.replace(" Standards", "")} standard each worksheet
              item maps to. Click a standard chip to assign or remove it.
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
              No standards have been added yet. Use the{" "}
              <strong>
                {stateInfo.flag} {stateInfo.standardsShort}
              </strong>{" "}
              button in the left panel to add one or more standards. Items will then map to those
              standards here.
            </div>
          )}

          {standards.length > 0 && (
            <>
              <div style={{ marginBottom: 16 }}>
                <p style={{ ...LBL, marginTop: 0 }}>Cited Standards ({standards.length})</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {standards.map((s: { code: string; desc: string }) => (
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
              {items.map((el: WorksheetElement, i: number) => {
                const mapped = (el.stdCodes as string[]) || [];
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
                      {standards.map((s: { code: string; desc: string }) => {
                        const on = mapped.includes(s.code);
                        return (
                          <button
                            key={s.code}
                            onClick={() => {
                              const next = on
                                ? mapped.filter((c: string) => c !== s.code)
                                : [...mapped, s.code];
                              onSetMapping?.(el.id, next);
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

export { StandardsModal, VersionsModal, ExportModal, HelpModal, AlignmentModal };
