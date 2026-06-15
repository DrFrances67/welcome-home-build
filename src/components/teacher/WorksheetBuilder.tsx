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

import { AIImageGen } from "./AIImageGen";
import { AIChat } from "./AIChat";
import {
  BANDS,
  GRADES,
  gInfo,
  PALETTE,
  uid,
  ROW_HEIGHT,
  nextSlot,
  mkEl,
  PRINT_CSS,
  F,
  FF,
  BASELINE_WIDTH_PCT,
  BASELINE_HEIGHT_PX,
  ScaledContent,
  ElView,
  ElEditor,
  StandardsModal,
  VersionsModal,
  ExportModal,
  HelpModal,
  AlignmentModal,
} from "./shared";
import { getActiveStateInfo } from "@/data/state-standards";
import { useAppState } from "@/contexts/AppStateContext";

export function WorksheetBuilder() {
  const [ws, setWs] = useState({
    title: "My Worksheet",
    showName: true,
    showDate: true,
    showGrade: true,
    gradeId: "k",
    elements: [],
    pageCount: 1,
    pageHeadersHidden: [],
    oneLineOnly: false,
    standards: [],
  });
  const [currentPage, setCurrentPage] = useState(0);
  const [viewMode, setViewMode] = useState("single"); // "single" | "scroll"
  const [selId, setSelId] = useState(null);
  const [rightTab, setRightTab] = useState("edit");
  const [showHelp, setShowHelp] = useState(false);
  const [showStds, setShowStds] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showAlignment, setShowAlignment] = useState(false);
  const [refImg, setRefImg] = useState(null);
  const [refDesc, setRefDesc] = useState("");
  const { hasStandards: stHasStandards, info: stInfo } = useAppState();
  const [analyzing, setAnalyzing] = useState(false);
  // Worksheet-file uploader (PDF/CSV) state
  const [wsFile, setWsFile] = useState(null); // { name, raw }
  const [wsFileBusy, setWsFileBusy] = useState(false);
  const [wsFileMsg, setWsFileMsg] = useState("");
  // Lesson Plan uploader → AI generates a worksheet
  const [lpFile, setLpFile] = useState<null | { name: string; raw: string }>(null);
  const [lpBusy, setLpBusy] = useState(false);
  const [lpMsg, setLpMsg] = useState("");
  const [lpType, setLpType] = useState("practice");
  const [lpNotes, setLpNotes] = useState("");

  // Lesson-plan generation history (persisted in localStorage)
  type LpHistoryEntry = {
    id: string;
    ts: number;
    fileName: string;
    fileRaw: string;
    typeId: string;
    typeLabel: string;
    notes: string;
    gradeId: string;
    elementCount: number;
    pageCount: number;
    snapshot: any; // full ws snapshot for restore
  };
  const LP_HISTORY_KEY = "tts.lpHistory.v1";
  const [lpHistory, setLpHistory] = useState<LpHistoryEntry[]>(() => {
    try {
      const raw =
        typeof window !== "undefined" ? window.localStorage.getItem(LP_HISTORY_KEY) : null;
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(LP_HISTORY_KEY, JSON.stringify(lpHistory.slice(0, 25)));
    } catch {}
  }, [lpHistory]);
  const [statusMsg, setStatusMsg] = useState(""); // aria-live announcements
  // Resize state
  const resizeRef = useRef(null);

  const gv = gInfo(ws.gradeId);
  const pageCount = Math.max(1, ws.pageCount || 1);
  const pageOf = (el) => Math.min(pageCount - 1, el.page || 0);
  const pageElements = ws.elements.filter((e) => pageOf(e) === currentPage);
  const selEl = ws.elements.find((e) => e.id === selId) || null;

  const announce = (msg) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(""), 3000);
  };

  const setF = (k, v) => setWs((p) => ({ ...p, [k]: v }));
  const addEl = (type) => {
    const onPage = ws.elements.filter((e) => (e.page || 0) === currentPage).length;
    const el = { ...mkEl(type, nextSlot(onPage)), page: currentPage };
    setWs((p) => ({ ...p, elements: [...p.elements, el] }));
    setSelId(el.id);
    setRightTab("edit");
    announce(`${PALETTE.find((p) => p.type === type)?.label || type} element added`);
  };
  const updEl = (id, u) =>
    setWs((p) => ({ ...p, elements: p.elements.map((e) => (e.id === id ? { ...e, ...u } : e)) }));
  const delEl = (id) => {
    setWs((p) => ({ ...p, elements: p.elements.filter((e) => e.id !== id) }));
    setSelId(null);
    announce("Element deleted");
  };

  // ━━ Copy / paste / duplicate ━━
  // Clipboard holds a deep copy of the source element's data (sans id/page/x/y).
  // Lives in a ref so React re-renders don't reset it; survives selection changes.
  const clipboardRef = useRef<any>(null);
  const stripPositional = (el) => {
    if (!el) return null;
    // Drop fields that must be unique or page/position-specific on paste.
    const { id, page, x, y, ...rest } = el;
    return JSON.parse(JSON.stringify(rest));
  };
  /** Place a clone of `data` on the current page, slightly offset from source. */
  const cloneOnto = (data, sourceEl, opts: { offset?: boolean } = { offset: true }) => {
    if (!data) return null;
    const onPage = ws.elements.filter((e) => (e.page || 0) === currentPage).length;
    const slot = nextSlot(onPage);
    // If source has a custom x/y, paste with a small +20/+20 offset so the new
    // element is visible (and not perfectly stacked on the original).
    const off = opts.offset !== false ? 20 : 0;
    const useSourcePos =
      sourceEl && (sourceEl.x != null || sourceEl.y != null) && sourceEl.page === currentPage;
    const pos = useSourcePos
      ? { x: (sourceEl.x || 0) + off, y: (sourceEl.y || 0) + off }
      : { x: slot.x, y: slot.y };
    const newEl = {
      ...mkEl(data.type, slot),
      ...data,
      id: uid(),
      page: currentPage,
      x: pos.x,
      y: pos.y,
      // Preserve user-resized dimensions from source if present.
      widthOverride: data.widthOverride ?? slot.widthOverride,
      heightOverride: data.heightOverride,
    };
    setWs((p) => ({ ...p, elements: [...p.elements, newEl] }));
    setSelId(newEl.id);
    setRightTab("edit");
    return newEl;
  };
  const copyEl = (id) => {
    const src = ws.elements.find((e) => e.id === id);
    if (!src) return;
    clipboardRef.current = stripPositional(src);
    announce("Element copied");
  };
  const pasteEl = () => {
    const data = clipboardRef.current;
    if (!data) {
      announce("Nothing to paste");
      return;
    }
    // For paste, we don't have a source element on the page necessarily; place
    // at the next free slot (no source-position offset).
    cloneOnto(data, null, { offset: false });
    announce("Element pasted");
  };
  const dupEl = (id) => {
    const src = ws.elements.find((e) => e.id === id);
    if (!src) return;
    const data = stripPositional(src);
    cloneOnto(data, src, { offset: true });
    announce("Element duplicated");
  };

  const addPage = () => {
    setWs((p) => ({ ...p, pageCount: (p.pageCount || 1) + 1 }));
    setCurrentPage(pageCount); // jump to the new page
    setSelId(null);
    announce(`Page ${pageCount + 1} added`);
  };
  const removePage = (idx) => {
    if (pageCount <= 1) return;
    if (!confirm(`Delete page ${idx + 1} and all its elements?`)) return;
    setWs((p) => {
      const remaining = p.elements
        .filter((e) => (e.page || 0) !== idx)
        .map((e) => ({ ...e, page: (e.page || 0) > idx ? (e.page || 0) - 1 : e.page || 0 }));
      const hidden = (p.pageHeadersHidden || [])
        .filter((h) => h !== idx)
        .map((h) => (h > idx ? h - 1 : h));
      return {
        ...p,
        elements: remaining,
        pageCount: Math.max(1, (p.pageCount || 1) - 1),
        pageHeadersHidden: hidden,
      };
    });
    setCurrentPage((c) => Math.max(0, Math.min(c, pageCount - 2)));
    setSelId(null);
  };
  const isPageHeaderHidden = (idx) => (ws.pageHeadersHidden || []).includes(idx);
  const togglePageHeader = (idx) =>
    setWs((p) => {
      const cur = p.pageHeadersHidden || [];
      return {
        ...p,
        pageHeadersHidden: cur.includes(idx) ? cur.filter((x) => x !== idx) : [...cur, idx],
      };
    });
  // Insert AI-generated worksheet elements onto the current page
  const insertAiElements = (parsed) => {
    if (!Array.isArray(parsed) || !parsed.length) return;
    const onPage = ws.elements.filter((e) => (e.page || 0) === currentPage).length;
    const newEls = parsed.map((el, i) => {
      const slot = nextSlot(onPage + i);
      return {
        ...mkEl(el.type, slot),
        ...el,
        id: uid(),
        x: slot.x,
        y: slot.y,
        widthOverride: slot.widthOverride,
        page: currentPage,
      };
    });
    setWs((p) => ({ ...p, elements: [...p.elements, ...newEls] }));
    setRightTab("edit");
    announce(`${newEls.length} elements added to page ${currentPage + 1}`);
  };
  const movEl = (id, d) =>
    setWs((p) => {
      const els = [...p.elements],
        i = els.findIndex((e) => e.id === id);
      if (d === "up" && i > 0) [els[i - 1], els[i]] = [els[i], els[i - 1]];
      else if (d === "down" && i < els.length - 1) [els[i], els[i + 1]] = [els[i + 1], els[i]];
      return { ...p, elements: els };
    });

  // Reset an element's size/position overrides back to the default 32%-wide
  // box with no height override, no resize axis lock, and no vertical scale
  // flag. Useful as an "undo my last resize" escape hatch when something
  // looks off after dragging — exposed via the ↻ button on the top-left of
  // every selected element.
  const handleResetElement = (elId) => {
    updEl(elId, {
      widthOverride: BASELINE_WIDTH_PCT,
      heightOverride: undefined,
      resizeAxis: undefined,
      verticalScale: false,
    });
  };

  // ── 4-sided drag-to-resize ─────────────────────────────────────────
  const handleResizeStart = (e, elId, direction) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const el = ws.elements.find((x) => x.id === elId);
    const measuredH =
      e.currentTarget?.closest?.(".ws-element")?.getBoundingClientRect?.().height || 0;
    const startH = el?.heightOverride || Math.max(BASELINE_HEIGHT_PX, Math.round(measuredH));
    const startW = el?.widthOverride ?? BASELINE_WIDTH_PCT; // percent of container
    const startElX = el?.x || 0;
    const startElY = el?.y || 0;
    // Get element DOM width in px for percentage calc
    const paperWidth = 632; // approx inner width of 760px paper with 64px padding each side

    resizeRef.current = {
      elId,
      startX,
      startY,
      startH,
      startW,
      startElX,
      startElY,
      paperWidth,
      direction,
    };

    // rAF-throttle pointermove so we commit at most one state update per
    // frame. Without this, multiple updEl calls per frame cause the
    // ResizeObserver inside ScaledContent to re-measure mid-frame and the
    // box visibly jumps during the drag.
    let pendingMv = null;
    let rafId = 0;
    const flush = () => {
      rafId = 0;
      const mv = pendingMv;
      pendingMv = null;
      if (!mv || !resizeRef.current) return;
      const { direction, startX, startY, startH, startW, startElX, startElY, paperWidth } =
        resizeRef.current;
      const dy = mv.clientY - startY;
      const dx = mv.clientX - startX;
      const dxPct = (dx / paperWidth) * 100;

      if (direction === "bottom") {
        updEl(elId, {
          heightOverride: Math.max(48, startH + dy),
          resizeAxis: "vertical",
          verticalScale: true,
        });
      } else if (direction === "top") {
        const nextH = Math.max(48, startH - dy);
        updEl(elId, {
          heightOverride: nextH,
          y: Math.max(0, startElY + (startH - nextH)),
          resizeAxis: "vertical",
          verticalScale: true,
        });
      } else if (direction === "right") {
        const newW = Math.min(100, Math.max(20, startW + dxPct));
        updEl(elId, {
          widthOverride: Math.round(newW),
          heightOverride: startH,
          resizeAxis: "horizontal",
          verticalScale: !!el?.verticalScale,
        });
      } else if (direction === "left") {
        const newW = Math.min(100, Math.max(20, startW - dxPct));
        updEl(elId, {
          widthOverride: Math.round(newW),
          heightOverride: startH,
          x: Math.max(0, startElX + startW - newW),
          resizeAxis: "horizontal",
          verticalScale: !!el?.verticalScale,
        });
      } else if (direction === "corner") {
        updEl(elId, {
          heightOverride: Math.max(48, startH + dy),
          widthOverride: Math.min(100, Math.max(20, startW + dxPct)),
          resizeAxis: "both",
          verticalScale: true,
        });
      }
    };
    const onMove = (mv) => {
      if (!resizeRef.current) return;
      pendingMv = mv;
      if (!rafId) rafId = requestAnimationFrame(flush);
    };
    const onUp = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      if (pendingMv) flush();
      resizeRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  // ── Free-position drag — move element anywhere on the page (mouse + touch) ─
  const dragRef = useRef(null);
  const handleDragStart = (e, elId) => {
    // Don't start drag from interactive children (resize handles, delete btn, inputs)
    const tgt = e.target;
    if (
      tgt.closest &&
      (tgt.closest("[data-resize-handle]") ||
        tgt.closest("[data-delete-btn]") ||
        tgt.closest("input,textarea,select,button,a"))
    )
      return;
    e.preventDefault();
    const el = ws.elements.find((x) => x.id === elId);
    if (!el) return;
    const paperWidth = 632;
    dragRef.current = {
      elId,
      startX: e.clientX,
      startY: e.clientY,
      startElX: el.x || 0, // %
      startElY: el.y || 0, // px
      paperWidth,
    };
    setSelId(elId);
    // rAF-throttle to one position update per frame for smooth movement
    // without layout jumps from queued state updates.
    let pendingMv = null;
    let rafId = 0;
    const flush = () => {
      rafId = 0;
      const mv = pendingMv;
      pendingMv = null;
      if (!mv || !dragRef.current) return;
      const { startX, startY, startElX, startElY, paperWidth } = dragRef.current;
      const dxPct = ((mv.clientX - startX) / paperWidth) * 100;
      const dyPx = mv.clientY - startY;
      const newX = Math.max(0, Math.min(100, startElX + dxPct));
      const newY = Math.max(0, startElY + dyPx);
      updEl(elId, { x: newX, y: newY });
    };
    const onMove = (mv) => {
      if (!dragRef.current) return;
      pendingMv = mv;
      if (!rafId) rafId = requestAnimationFrame(flush);
    };
    const onUp = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      if (pendingMv) flush();
      dragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const [generating, setGenerating] = useState(false);

  const insertStandard = (std, showHeader = true) => {
    setWs((p) => {
      const exists = (p.standards || []).some((s) => s.code === std.code);
      const standards = exists
        ? p.standards
        : [...(p.standards || []), { code: std.code, desc: std.desc }];
      if (!showHeader) return { ...p, standards };
      const el = {
        id: uid(),
        type: "instruction",
        text: `📌 NYS Standard ${std.code}: ${std.desc}`,
        x: 0,
        y: 0,
        widthOverride: 100,
        stdCodes: [std.code],
      };
      return {
        ...p,
        standards,
        elements: [el, ...p.elements.map((e) => ({ ...e, y: (e.y || 0) + ROW_HEIGHT }))],
      };
    });
  };

  const handleGenerateFromStd = async (std, showHeader) => {
    void trackToolUse("Worksheet Builder");
    setGenerating(true);
    if (showHeader) {
      insertStandard(std, true);
    } else {
      setWs((p) => {
        const exists = (p.standards || []).some((s) => s.code === std.code);
        return exists
          ? p
          : { ...p, standards: [...(p.standards || []), { code: std.code, desc: std.desc }] };
      });
    }
    const g = gInfo(ws.gradeId);
    const bandLabel = BANDS[g.band]?.label || g.name;
    try {
      const raw =
        (await callAiRaw({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `You are an expert curriculum designer creating complete, print-ready worksheets for ${getActiveStateInfo().name} teachers. Always respond with valid JSON only — no markdown, no preamble, no explanation outside the JSON array.`,
          messages: [
            {
              role: "user",
              content: `Design a complete, engaging worksheet for ${g.name} students (${bandLabel}) aligned to ${getActiveStateInfo().name} Standard ${std.code}: "${std.desc}".

Return ONLY a JSON array of 5–8 worksheet elements. Each element must use EXACTLY one of these types and shapes:

{"type":"instruction","text":"<directions string>"}
{"type":"text","text":"<passage or content string>"}
{"type":"blank","label":"<question or prompt>","lines":3}
{"type":"wordBank","title":"📚 Word Bank","words":["word1","word2","word3","word4","word5"]}
{"type":"matching","title":"<title>","left":["item1","item2","item3"],"right":["match1","match2","match3"]}
{"type":"multipleChoice","question":"<question>","note":"Circle the correct answer.","choices":["A. option","B. option","C. option","D. option"]}
{"type":"truefalse","statements":["statement1","statement2","statement3"]}
{"type":"shortAnswer","question":"<question>","lines":4}
{"type":"fillBlank","text":"<sentence with ______ for blanks>","note":"<optional hint>"}
{"type":"essay","prompt":"<essay prompt>","points":10,"lines":14}

Calibrate complexity to ${g.name}:
- Pre-K/K/Gr1-2: short words, simple sentences, pictures concepts, fun emoji, concrete tasks
- Gr3-5: 1-2 paragraph passages, multi-step activities, content-area vocabulary
- Gr6-8: analytical tasks, text evidence, abstract thinking, structured writing
- Gr9-12: sophisticated analysis, argument construction, primary source engagement

Include a variety of activity types. Make the content directly address the standard. Output ONLY the JSON array.`,
            },
          ],
        })) || "[]";
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      const startIdx = showHeader ? 1 : 0;
      const newEls = parsed.map((el, i) => {
        const slot = nextSlot(startIdx + i);
        return {
          ...mkEl(el.type, slot),
          ...el,
          id: uid(),
          x: slot.x,
          y: slot.y,
          widthOverride: slot.widthOverride,
          stdCodes: [std.code],
        };
      });
      setWs((p) => ({
        ...p,
        title: p.title === "My Worksheet" ? `${std.code} Worksheet` : p.title,
        elements: showHeader
          ? [{ ...p.elements[0], y: 0, x: 0, widthOverride: 100 }, ...newEls].filter(Boolean)
          : newEls,
      }));
      setSelId(null);
    } catch (err) {
      console.error("Generate error:", err);
    }
    setGenerating(false);
  };

  const addGeneratedImage = (url) => {
    const slot = nextSlot(ws.elements.length);
    const el = mkEl("image", slot);
    el.url = url;
    el.caption = "";
    el.size = "small";
    el.align = "left";
    setWs((p) => ({ ...p, elements: [...p.elements, el] }));
    setSelId(el.id);
    setRightTab("edit");
  };

  const handleRefUpload = async (file) => {
    if (!file.type.startsWith("image/")) {
      setRefDesc("PDF uploaded — describe it in AI Help to get suggestions!");
      setRefImg(URL.createObjectURL(file));
      return;
    }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const b64 = ev.target.result;
      setRefImg(b64);
      setAnalyzing(true);
      try {
        const refText = await callAiRaw({
          model: "claude-sonnet-4-20250514",
          max_tokens: 350,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: { type: "base64", media_type: file.type, data: b64.split(",")[1] },
                },
                {
                  type: "text",
                  text: "A teacher uploaded this reference worksheet. In 2–3 sentences, describe its structure, activity types, subject area, and approximate grade level so I can help recreate or build similar worksheets. Be concise and practical.",
                },
              ],
            },
          ],
        });
        setRefDesc(refText || "Reference uploaded.");
      } catch {
        setRefDesc("Reference uploaded (automatic analysis unavailable — describe it in AI Help).");
      }
      setAnalyzing(false);
    };
    reader.readAsDataURL(file);
  };

  // ── Worksheet file (PDF/CSV/TXT) → AI re-creates as editable blocks ──
  // Returns { text, pageImages: [dataUrl, ...] } so the AI can both READ the
  // text AND SEE images / layout from the original PDF pages.
  const extractPdfTextLocal = async (file) => {
    const pdfjs: any = await import("pdfjs-dist");
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const buf = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buf }).promise;
    const pages = Math.min(doc.numPages, 8);
    let text = "";
    const pageImages: string[] = [];
    for (let p = 1; p <= pages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      text += `\n\n--- PAGE ${p} ---\n` + content.items.map((it: any) => it.str).join(" ");
      // Render page to small canvas → JPEG data URL for AI vision
      try {
        const viewport = page.getViewport({ scale: 1.1 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.min(900, viewport.width);
        canvas.height = Math.round((canvas.width / viewport.width) * viewport.height);
        const ctx = canvas.getContext("2d");
        const scaledViewport = page.getViewport({ scale: canvas.width / viewport.width });
        await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
        pageImages.push(canvas.toDataURL("image/jpeg", 0.7));
      } catch (e) {
        /* image render is best-effort */
      }
    }
    return { text: text.trim(), pageImages };
  };

  const handleWsFileUpload = async (file: File) => {
    setWsFileMsg("");
    setWsFileBusy(true);
    try {
      let raw = "";
      let pageImages: string[] = [];
      const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      const isText =
        /\.(csv|txt|md)$/i.test(file.name) ||
        file.type === "text/csv" ||
        file.type === "text/plain";
      if (isPdf) {
        const r = await extractPdfTextLocal(file);
        raw = r.text;
        pageImages = r.pageImages;
      } else if (isText) raw = await file.text();
      else throw new Error("Unsupported file type. Use PDF, CSV, or TXT.");
      raw = (raw || "").slice(0, 16000);
      if (!raw.trim() && pageImages.length === 0)
        throw new Error("Could not read any text or images from that file.");
      setWsFile({ name: file.name, raw, pageImages });
      const imgNote = pageImages.length
        ? ` · saw ${pageImages.length} page image${pageImages.length === 1 ? "" : "s"}`
        : "";
      setWsFileMsg(
        `✓ Loaded${imgNote}. Click Recreate to build this worksheet, or Re-imagine for a fresh take.`,
      );
    } catch (e: any) {
      setWsFileMsg(`⚠ ${e?.message || "Failed to read file."}`);
      setWsFile(null);
    }
    setWsFileBusy(false);
  };

  // Generate real images for any element of type "image" with a missing url.
  // SEQUENTIAL with retry-on-429 to avoid rate limits from the image gateway.
  const fillImageElements = async (els: any[], styleHint = "cartoon") => {
    const targets = els.filter(
      (el) => el?.type === "image" && !el.url && (el.imagePrompt || el.caption || el.text),
    );
    let done = 0;
    for (const el of targets) {
      const prompt = (el.imagePrompt || el.caption || el.text || "").toString().trim();
      if (!prompt) continue;
      try {
        const url = await generateImage({ prompt, style: styleHint, retries: 2 });
        if (url) el.url = url;
      } catch (_) {
        /* skip image on failure */
      }
      done++;
      setWsFileMsg(`✓ Got blocks. Generating images… (${done}/${targets.length})`);
      // Pace requests to stay under the gateway's per-minute limit
      await new Promise((res) => setTimeout(res, 1200));
    }
  };

  // Insert AI-generated worksheet elements that may target multiple pages.
  // Each element may carry a `page` index (0-based). Auto-creates new pages
  // as needed and lays out blocks on each page using nextSlot().
  const insertAiElementsMultiPage = (parsed: any[]) => {
    if (!Array.isArray(parsed) || !parsed.length) return;
    // Normalize page indices
    let maxPage = 0;
    parsed.forEach((el) => {
      const p = Math.max(0, parseInt(el.page) || 0);
      el.__page = p;
      if (p > maxPage) maxPage = p;
    });

    // Group by page, lay out each page with nextSlot
    const startPage = currentPage;
    const newEls: any[] = [];
    for (let p = 0; p <= maxPage; p++) {
      const pageEls = parsed.filter((e) => e.__page === p);
      const targetPage = startPage + p;
      const existingOnPage = ws.elements.filter((e) => (e.page || 0) === targetPage).length;
      pageEls.forEach((el, i) => {
        const slot = nextSlot(existingOnPage + i);
        const { __page, page, ...rest } = el;
        newEls.push({
          ...mkEl(rest.type, slot),
          ...rest,
          id: uid(),
          x: slot.x,
          y: slot.y,
          widthOverride: slot.widthOverride,
          page: targetPage,
        });
      });
    }

    const requiredPageCount = startPage + maxPage + 1;
    setWs((p) => ({
      ...p,
      elements: [...p.elements, ...newEls],
      pageCount: Math.max(p.pageCount || 1, requiredPageCount),
    }));
    setRightTab("edit");
    announce(
      `${newEls.length} elements added across ${maxPage + 1} page${maxPage === 0 ? "" : "s"}`,
    );
  };

  const recreateWorksheetFromFile = async (reimagine: boolean) => {
    if (!wsFile?.raw && !wsFile?.pageImages?.length) return;
    setWsFileBusy(true);
    setWsFileMsg(reimagine ? "Re-imagining…" : "Recreating…");
    try {
      const g = gInfo(ws.gradeId);
      const intent = reimagine
        ? `Re-imagine the worksheet below as a fresh, improved, EXPANDED version for ${g.name} students. Keep the same topic and skill focus, but vary activity types, add new question styles, deepen practice, and produce MORE content than the original — never compress.`
        : `Faithfully recreate the worksheet below as editable blocks for ${g.name} students. Preserve the original questions, instructions, word banks, structure, AND any images / illustrations. If the original is short, EXPAND it with additional varied practice items so the result spans multiple pages.`;

      // Build multimodal user content: page images first, then text.
      const userContent: any[] = [];
      const imgs = (wsFile.pageImages || []).slice(0, 5);
      imgs.forEach((dataUrl: string, i: number) => {
        const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
        if (!m) return;
        userContent.push({
          type: "image",
          source: { type: "base64", media_type: m[1], data: m[2] },
        });
      });
      userContent.push({
        type: "text",
        text: `${intent}\n\nIMPORTANT pagination rules:\n- The original has ${imgs.length || "an unknown number of"} page(s).\n- The OUTPUT MUST SPAN AT LEAST 2 PAGES. Never compress everything onto page 0. If the source is short, expand it with additional varied items (more questions, deeper practice, extension activities, reflection) until you fill at least 2 full pages.\n- Output enough blocks to faithfully cover ALL the content. Do not drop questions to fit one page.\n- Tag each block with a 0-based "page" field (0,1,2,…). Keep ~6-9 blocks per page max so the worksheet is not crowded.\n- Vary activity types across pages (mix multipleChoice, shortAnswer, fillBlank, matching, truefalse, wordBank, essay) — prioritize depth and variety over brevity.\n- For every illustration, photo, or drawing in the original, output an {"type":"image", ...} block with a clear "imagePrompt" so we can generate a matching picture (e.g. "a friendly cartoon brown dog sitting", "line drawing of an apple"). Never drop images.\n- GROUPING: Place each image block IMMEDIATELY next to the question/prompt it illustrates (right before or right after). Never separate an image from its related content with unrelated blocks.\n\nWORKSHEET TEXT:\n${wsFile.raw}`,
      });

      const text =
        (await callAiRaw({
          model: "claude-sonnet-4-20250514",
          max_tokens: 5000,
          system: `You convert a teacher's existing worksheet into structured worksheet blocks for a ${g.name} class. Respond with VALID JSON ONLY — a single JSON array of element objects. No markdown, no preamble.

Allowed element shapes (use exactly these keys; add "page": 0|1|2 to every element to control pagination):
{"type":"instruction","text":"<directions>","page":0}
{"type":"text","text":"<passage or content>","page":0}
{"type":"blank","label":"<prompt>","lines":3,"page":0}
{"type":"wordBank","title":"📚 Word Bank","words":["w1","w2","w3"],"page":0}
{"type":"matching","title":"<title>","left":["a","b","c"],"right":["1","2","3"],"page":0}
{"type":"multipleChoice","question":"<q>","note":"Circle the correct answer.","choices":["A. …","B. …","C. …","D. …"],"page":0}
{"type":"truefalse","statements":["s1","s2","s3"],"page":0}
{"type":"shortAnswer","question":"<q>","lines":4,"page":0}
{"type":"fillBlank","text":"The ______ is a ______.","note":"<hint>","page":0}
{"type":"essay","prompt":"<prompt>","points":10,"lines":14,"page":0}
{"type":"table","title":"<title>","headers":["A","B","C"],"rows":[["","",""],["","",""]],"page":0}
{"type":"image","imagePrompt":"<short visual description for an AI image generator>","caption":"<optional caption>","size":"small","align":"center","page":0}

GROUPING RULE (MANDATORY): Keep related blocks contiguous in the array. Place each {"type":"image"} block IMMEDIATELY adjacent to the question/prompt/task that references it (right before or right after) — never split an image from its associated content with unrelated blocks. Likewise, keep instruction → activity and wordBank → fillBlank pairs together on the same page.

Output ONLY the JSON array.`,
          messages: [{ role: "user", content: userContent }],
        })) || "[]";
      const clean = text.replace(/```json|```/g, "").trim();
      const start = clean.indexOf("[");
      const end = clean.lastIndexOf("]");
      const slice = start >= 0 && end > start ? clean.slice(start, end + 1) : clean;
      const parsed = JSON.parse(slice);
      if (!Array.isArray(parsed) || !parsed.length) throw new Error("AI did not return any blocks");

      // Generate real images for any "image" blocks before insertion
      setWsFileMsg("✓ Got blocks. Generating images…");
      await fillImageElements(parsed, "cartoon");

      insertAiElementsMultiPage(parsed);
      const pageSpan = Math.max(...parsed.map((e: any) => parseInt(e.page) || 0)) + 1 || 1;
      setWsFileMsg(
        `✓ Added ${parsed.length} block${parsed.length === 1 ? "" : "s"} across ${pageSpan} page${pageSpan === 1 ? "" : "s"}.`,
      );
    } catch (e: any) {
      setWsFileMsg(`⚠ ${e?.message || "Failed to build worksheet."}`);
    }
    setWsFileBusy(false);
  };

  // ── Lesson Plan upload → generate worksheet ───────────────────────────
  const WORKSHEET_TYPES = [
    { id: "practice", label: "Practice / Skill Reinforcement" },
    { id: "assessment", label: "Assessment / Quiz" },
    { id: "exitTicket", label: "Exit Ticket" },
    { id: "review", label: "Review / Study Guide" },
    { id: "vocabulary", label: "Vocabulary Builder" },
    { id: "reading", label: "Reading Comprehension" },
    { id: "writing", label: "Writing Prompts" },
    { id: "graphicOrganizer", label: "Graphic Organizer" },
    { id: "homework", label: "Homework" },
    { id: "centers", label: "Centers / Stations" },
  ];

  const readLessonPlanFile = async (file: File): Promise<string> => {
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    const isDocx =
      /\.docx$/i.test(file.name) ||
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const isDoc = /\.doc$/i.test(file.name) && !isDocx;
    const isText =
      /\.(txt|md|rtf)$/i.test(file.name) ||
      file.type === "text/plain" ||
      file.type === "text/markdown";
    if (isPdf) {
      const r = await extractPdfTextLocal(file);
      return r.text;
    }
    if (isDocx) {
      const mod: any = await import("mammoth/mammoth.browser");
      const mammoth: any = mod?.default || mod;
      if (!mammoth || typeof mammoth.extractRawText !== "function") {
        throw new Error("DOCX reader failed to load. Try TXT or PDF.");
      }
      const buf = await file.arrayBuffer();
      const out = await mammoth.extractRawText({ arrayBuffer: buf });
      return (out?.value || "").trim();
    }
    if (isDoc)
      throw new Error("Legacy .doc files aren't supported — please save as .docx, PDF, or .txt.");
    if (isText) return await file.text();
    throw new Error("Unsupported file type. Use PDF, DOCX, TXT, or MD.");
  };

  const handleLessonPlanUpload = async (file: File) => {
    setLpMsg("");
    setLpBusy(true);
    try {
      const raw = ((await readLessonPlanFile(file)) || "").slice(0, 16000);
      if (!raw.trim()) throw new Error("Could not read any text from that file.");
      setLpFile({ name: file.name, raw });
      setLpMsg("✓ Lesson plan loaded. Choose a worksheet type below, then Generate.");
    } catch (e: any) {
      setLpMsg(`⚠ ${e?.message || "Failed to read file."}`);
      setLpFile(null);
    }
    setLpBusy(false);
  };

  const generateWorksheetFromLessonPlan = async () => {
    if (!lpFile?.raw) return;
    void trackToolUse("Worksheet Builder");
    setLpBusy(true);
    setLpMsg("Reading lesson plan…");
    try {
      const g = gInfo(ws.gradeId);
      const typeLabel = WORKSHEET_TYPES.find((t) => t.id === lpType)?.label || lpType;
      const userPrompt = `LESSON PLAN:\n${lpFile.raw}\n\nWORKSHEET TYPE: ${typeLabel}\nGRADE LEVEL: ${g.name}\n${lpNotes.trim() ? `\nADDITIONAL TEACHER INSTRUCTIONS:\n${lpNotes.trim()}\n` : ""}\nIMPORTANT pagination rules:\n- The OUTPUT MUST SPAN AT LEAST 2 PAGES (use page 0 and page 1, optionally page 2). Never compress everything onto one page.\n- Distribute content across distinct lesson sections: page 0 = warm-up + core practice, page 1 = extension / deeper practice / varied question types, optional page 2 = reflection / exit ticket / challenge.\n- Tag each block with a 0-based "page" field (0,1,2,…). Keep ~6-9 blocks per page max so each page is full but not crowded.\n- Output 12–20 total blocks covering the lesson's objectives, vocabulary, and key concepts in depth. Prioritize depth and variety over brevity.\n- Vary activity types across pages (mix multipleChoice, shortAnswer, fillBlank, matching, truefalse, wordBank, essay, table) — do not repeat the same format.\n- Where a visual would help learning (vocabulary cards, diagrams, picture-prompts), include {"type":"image", ...} blocks with a clear "imagePrompt".\n- GROUPING: Place each image block IMMEDIATELY adjacent to the question, prompt, or task it illustrates (right before or right after). Never separate an image from its associated content with unrelated blocks. Keep instruction → activity and wordBank → fillBlank pairs together on the same page.`;

      const text =
        (await callAiRaw({
          model: "claude-sonnet-4-20250514",
          max_tokens: 5000,
          system: `You are an expert curriculum designer. The teacher has uploaded a lesson plan and wants a "${typeLabel}" worksheet for ${g.name} students that is directly aligned to the lesson's objectives, vocabulary, and content. The worksheet MUST span AT LEAST 2 PAGES — distribute content across warm-up, practice, extension, and reflection sections. Respond with VALID JSON ONLY — a single JSON array of 12–20 worksheet element objects with a 0-based "page" field on every element. No markdown, no preamble.

Allowed element shapes (use exactly these keys; add "page": 0|1|2 to every element):
{"type":"instruction","text":"<directions>","page":0}
{"type":"text","text":"<passage or content>","page":0}
{"type":"blank","label":"<prompt>","lines":3,"page":0}
{"type":"wordBank","title":"📚 Word Bank","words":["w1","w2","w3"],"page":0}
{"type":"matching","title":"<title>","left":["a","b","c"],"right":["1","2","3"],"page":0}
{"type":"multipleChoice","question":"<q>","note":"Circle the correct answer.","choices":["A. …","B. …","C. …","D. …"],"page":0}
{"type":"truefalse","statements":["s1","s2","s3"],"page":0}
{"type":"shortAnswer","question":"<q>","lines":4,"page":0}
{"type":"fillBlank","text":"The ______ is a ______.","note":"<hint>","page":0}
{"type":"essay","prompt":"<prompt>","points":10,"lines":14,"page":0}
{"type":"table","title":"<title>","headers":["A","B","C"],"rows":[["","",""],["","",""]],"page":0}
{"type":"image","imagePrompt":"<short visual description>","caption":"<optional>","size":"small","align":"center","page":0}

Output ONLY the JSON array.`,
          messages: [{ role: "user", content: userPrompt }],
        })) || "[]";
      const clean = text.replace(/```json|```/g, "").trim();
      const start = clean.indexOf("[");
      const end = clean.lastIndexOf("]");
      const slice =
        start >= 0 && end > start
          ? clean.slice(start, end + 1)
          : start >= 0
            ? clean.slice(start)
            : clean;
      let parsed: any;
      try {
        parsed = JSON.parse(slice);
      } catch {
        parsed = repairAndParse(slice, { container: "array" });
      }
      if (!Array.isArray(parsed) || !parsed.length) throw new Error("AI did not return any blocks");

      setLpMsg("✓ Got blocks. Generating images…");
      await fillImageElements(parsed, "cartoon");
      insertAiElementsMultiPage(parsed);
      const pageSpan = Math.max(...parsed.map((e: any) => parseInt(e.page) || 0)) + 1 || 1;
      setLpMsg(
        `✓ Added ${parsed.length} block${parsed.length === 1 ? "" : "s"} across ${pageSpan} page${pageSpan === 1 ? "" : "s"}.`,
      );

      // Save run to history with a snapshot of the resulting worksheet (taken on next tick so setWs has applied)
      setTimeout(() => {
        setWs((curr) => {
          const entry: LpHistoryEntry = {
            id: uid(),
            ts: Date.now(),
            fileName: lpFile.name,
            fileRaw: lpFile.raw,
            typeId: lpType,
            typeLabel,
            notes: lpNotes,
            gradeId: ws.gradeId,
            elementCount: parsed.length,
            pageCount: pageSpan,
            snapshot: JSON.parse(JSON.stringify(curr)),
          };
          setLpHistory((h) => [entry, ...h].slice(0, 25));
          return curr;
        });
      }, 0);
    } catch (e: any) {
      setLpMsg(`⚠ ${e?.message || "Failed to build worksheet."}`);
    }
    setLpBusy(false);
  };

  // Restore a previous lesson-plan run (replaces the current worksheet with the saved snapshot).
  const restoreLpHistory = (entry: LpHistoryEntry) => {
    if (!entry?.snapshot) return;
    if (
      !window.confirm(
        `Switch to "${entry.fileName}" (${entry.typeLabel})? Your current worksheet will be replaced — previous runs stay in history.`,
      )
    )
      return;
    // Snapshot the current state too, so the user can switch back.
    setWs((curr) => {
      const backup: LpHistoryEntry = {
        id: uid(),
        ts: Date.now(),
        fileName: lpFile?.name || curr.title || "Current worksheet",
        fileRaw: lpFile?.raw || "",
        typeId: lpType,
        typeLabel: WORKSHEET_TYPES.find((t) => t.id === lpType)?.label || lpType,
        notes: lpNotes,
        gradeId: curr.gradeId,
        elementCount: curr.elements?.length || 0,
        pageCount: curr.pageCount || 1,
        snapshot: JSON.parse(JSON.stringify(curr)),
      };
      setLpHistory((h) => [backup, ...h.filter((x) => x.id !== entry.id)].slice(0, 25));
      return JSON.parse(JSON.stringify(entry.snapshot));
    });
    setLpFile({ name: entry.fileName, raw: entry.fileRaw });
    setLpType(entry.typeId);
    setLpNotes(entry.notes);
    setLpMsg(`✓ Restored "${entry.fileName}" (${entry.typeLabel}).`);
    setSelId(null);
  };

  // Re-run generation against the same lesson plan + settings.
  const regenerateLpHistory = (entry: LpHistoryEntry) => {
    setLpFile({ name: entry.fileName, raw: entry.fileRaw });
    setLpType(entry.typeId);
    setLpNotes(entry.notes);
    setLpMsg("Re-running generation…");
    setTimeout(() => {
      generateWorksheetFromLessonPlan();
    }, 50);
  };

  const removeLpHistory = (id: string) => setLpHistory((h) => h.filter((x) => x.id !== id));
  const clearLpHistory = () => {
    if (window.confirm("Clear all worksheet history?")) setLpHistory([]);
  };

  // ━━ Pending lesson handoff from Lesson Plan Generator ━━
  // When the user clicks "Build Worksheets" on a generated lesson, we stash a
  // payload on window and switch tabs. On mount, consume it, set state, and
  // flag a pending auto-run that fires once lpFile has actually committed.
  const [pendingAutoRun, setPendingAutoRun] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = (window as any).__pendingLessonForWorksheet;
    if (!payload?.raw) return;
    (window as any).__pendingLessonForWorksheet = null;
    const gradeId =
      payload.gradeId && GRADES.some((g) => g.id === payload.gradeId)
        ? payload.gradeId
        : ws.gradeId;
    setWs((p) => ({
      ...p,
      gradeId,
      title: payload.topic ? `${payload.topic} — Worksheet` : p.title,
    }));
    setLpFile({ name: payload.name || "Lesson Plan.txt", raw: payload.raw });
    setLpType("practice");
    setLpNotes("");
    setLpMsg("✓ Lesson plan received. Auto-generating worksheet…");
    setPendingAutoRun(true);
  }, []);
  useEffect(() => {
    if (!pendingAutoRun || !lpFile?.raw) return;
    setPendingAutoRun(false);
    generateWorksheetFromLessonPlan();
  }, [pendingAutoRun, lpFile]);

  // ━━ Worksheet-scoped keyboard shortcuts ━━
  // Cmd/Ctrl+C copies the selected element, Cmd/Ctrl+V pastes the clipboard,
  // Cmd/Ctrl+D duplicates the selected element. We deliberately skip when
  // focus is in an input/textarea so users keep native text copy/paste.
  useGlobalShortcuts([
    {
      key: "c",
      mods: ["mod"],
      description: "Copy selected element",
      group: "Worksheet",
      run: () => {
        if (selId) copyEl(selId);
      },
    },
    {
      key: "v",
      mods: ["mod"],
      description: "Paste copied element",
      group: "Worksheet",
      run: () => pasteEl(),
    },
    {
      key: "d",
      mods: ["mod"],
      description: "Duplicate selected element",
      group: "Worksheet",
      run: () => {
        if (selId) dupEl(selId);
      },
    },
  ]);

  return (
    <div
      className="app-shell"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        fontFamily: F,
        background: "#F8F9FA",
        overflow: "hidden",
      }}
    >
      <style>{PRINT_CSS}</style>

      {/* Skip navigation */}
      <a href="#worksheet-canvas" className="skip-nav no-print">
        Skip to worksheet
      </a>

      {/* Aria live region for screen reader announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="no-print"
        style={{ position: "absolute", left: -9999, width: 1, height: 1, overflow: "hidden" }}
      >
        {statusMsg}
      </div>

      {/* ── TOP BAR ── */}
      <header
        role="banner"
        className="no-print ws-topbar"
        style={{
          height: 56,
          background: "white",
          borderBottom: "1px solid #E5E7EB",
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 12,
          flexShrink: 0,
          zIndex: 20,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: gv.color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
            }}
            aria-hidden="true"
          >
            📄
          </div>
          <div style={{ lineHeight: 1.15 }}>
            <div style={{ fontFamily: FF, color: gv.color, fontSize: 15, fontWeight: 700 }}>
              WorksheetBuilder
            </div>
            <div
              style={{
                fontSize: 9.5,
                color: "#9CA3AF",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              {stHasStandards ? `${stInfo.standardsShort} · ` : ""}Pre-K–12
            </div>
          </div>
        </div>

        <div
          style={{ width: 1, height: 28, background: "#E5E7EB", margin: "0 2px", flexShrink: 0 }}
          aria-hidden="true"
        />

        <SpellInput
          value={ws.title}
          onChange={(e) => setF("title", e.target.value)}
          spellCheck
          aria-label="Worksheet title"
          style={{
            flex: 1,
            fontSize: 15,
            fontWeight: 600,
            fontFamily: F,
            border: "none",
            outline: "none",
            background: "transparent",
            color: "#111827",
            minWidth: 0,
          }}
          placeholder="Worksheet Title…"
        />

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <label
            htmlFor="grade-select"
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#6B7280",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Grade
          </label>
          <select
            id="grade-select"
            value={ws.gradeId}
            onChange={(e) => setF("gradeId", e.target.value)}
            aria-label="Select grade level"
            style={{
              padding: "5px 10px",
              borderRadius: 7,
              border: `1.5px solid ${gv.color}`,
              fontFamily: F,
              fontWeight: 700,
              fontSize: 13,
              color: gv.color,
              outline: "none",
              background: gv.light,
              cursor: "pointer",
            }}
          >
            <optgroup label="🌱 Early Childhood">
              <option value="pk">Pre-K</option>
              <option value="k">Kindergarten</option>
              <option value="1">Grade 1</option>
              <option value="2">Grade 2</option>
            </optgroup>
            <optgroup label="⭐ Elementary">
              <option value="3">Grade 3</option>
              <option value="4">Grade 4</option>
              <option value="5">Grade 5</option>
            </optgroup>
            <optgroup label="🏫 Middle School">
              <option value="6">Grade 6</option>
              <option value="7">Grade 7</option>
              <option value="8">Grade 8</option>
            </optgroup>
            <optgroup label="🎓 High School">
              <option value="9">Grade 9</option>
              <option value="10">Grade 10</option>
              <option value="11">Grade 11</option>
              <option value="12">Grade 12</option>
            </optgroup>
          </select>
        </div>

        <fieldset
          style={{
            margin: 0,
            padding: "4px 10px",
            background: "#F9FAFB",
            borderRadius: 7,
            border: "1px solid #E5E7EB",
            display: "flex",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <legend
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: "#9CA3AF",
              textTransform: "uppercase",
              padding: "0 2px",
              letterSpacing: 0.5,
            }}
          >
            Show
          </legend>
          {[
            ["showName", "Name"],
            ["showDate", "Date"],
            ["showGrade", "Grade"],
          ].map(([k, l]) => (
            <label
              key={k}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                fontWeight: 600,
                color: "#374151",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={ws[k]}
                onChange={(e) => setF(k, e.target.checked)}
                aria-label={`Show ${l} on worksheet`}
                style={{ accentColor: gv.color, width: 14, height: 14 }}
              />{" "}
              {l}
            </label>
          ))}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12,
              fontWeight: 600,
              color: "#374151",
              cursor: "pointer",
              borderLeft: "1px solid #E5E7EB",
              paddingLeft: 10,
            }}
            title="When on, list items in Success Criteria, Exit Ticket, DOK and other multi-item elements stay on a single line (resize the box wider to reveal more text). When off, items wrap to multiple lines."
          >
            <input
              type="checkbox"
              checked={!!ws.oneLineOnly}
              onChange={(e) => setF("oneLineOnly", e.target.checked)}
              aria-label="Force list items to a single line"
              style={{ accentColor: gv.color, width: 14, height: 14 }}
            />{" "}
            1-line items
          </label>
        </fieldset>

        <button
          onClick={() => setShowHelp(true)}
          aria-label="Open help documentation"
          style={{
            padding: "6px 12px",
            borderRadius: 7,
            border: "1.5px solid #E5E7EB",
            background: "white",
            cursor: "pointer",
            fontFamily: F,
            fontWeight: 600,
            fontSize: 13,
            color: "#374151",
          }}
        >
          Help
        </button>
        <button
          onClick={() => setShowVersions(true)}
          aria-label="Create quiz versions with randomized questions"
          style={{
            padding: "6px 12px",
            borderRadius: 7,
            border: "1.5px solid #E5E7EB",
            background: "white",
            cursor: "pointer",
            fontFamily: F,
            fontWeight: 600,
            fontSize: 13,
            color: "#374151",
          }}
        >
          🔀 Versions
        </button>
        <button
          onClick={() => setShowAlignment(true)}
          aria-label="View standards alignment for each question"
          style={{
            padding: "6px 12px",
            borderRadius: 7,
            border: "1.5px solid #E5E7EB",
            background: "white",
            cursor: "pointer",
            fontFamily: F,
            fontWeight: 600,
            fontSize: 13,
            color: "#374151",
          }}
        >
          🎯 Alignment
        </button>
        <button
          onClick={() => setShowExport(true)}
          aria-label="Export or print worksheet"
          style={{
            padding: "6px 14px",
            borderRadius: 7,
            border: "none",
            background: gv.color,
            color: "white",
            cursor: "pointer",
            fontFamily: F,
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          📤 Export
        </button>
      </header>

      {/* ── 3-COLUMN BODY ── */}
      <div
        className="ws-body"
        style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}
      >
        {/* LEFT PANEL */}
        <nav
          role="navigation"
          aria-label="Worksheet tools"
          className="no-print ws-sidebar-left"
          style={{
            width: 196,
            maxHeight: "100%",
            background: "white",
            borderRight: "1px solid #E5E7EB",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            overflowX: "hidden",
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
            scrollbarGutter: "stable",
            flexShrink: 0,
            minHeight: 0,
          }}
        >
          {/* Standards button */}
          <div style={{ padding: "10px 10px 8px", borderBottom: "1px solid #F3F4F6" }}>
            <button
              onClick={() => setShowStds(true)}
              aria-label="Browse NY State Standards"
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: `1.5px solid ${gv.color}`,
                background: gv.light,
                color: gv.color,
                fontFamily: F,
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = gv.color;
                e.currentTarget.style.color = "white";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = gv.light;
                e.currentTarget.style.color = gv.color;
              }}
            >
              🗽 NY Standards
            </button>
          </div>

          {/* Lesson Plan Upload — DOC/PDF/TXT → AI builds aligned worksheet */}
          <div style={{ padding: "8px 10px", borderBottom: "1px solid #F3F4F6" }}>
            <p
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#9CA3AF",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                margin: "0 0 6px 0",
                fontFamily: F,
              }}
            >
              Upload Lesson Plan
            </p>

            {!lpFile ? (
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  padding: "10px 8px",
                  borderRadius: 8,
                  border: `1.5px dashed ${gv.color}45`,
                  background: gv.light,
                  cursor: lpBusy ? "wait" : "pointer",
                  textAlign: "center",
                  opacity: lpBusy ? 0.6 : 1,
                }}
              >
                <span style={{ fontSize: 20 }} aria-hidden="true">
                  📘
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: gv.color,
                    lineHeight: 1.3,
                    fontFamily: F,
                  }}
                >
                  Upload Lesson Plan
                </span>
                <span style={{ fontSize: 10, color: "#9CA3AF", fontFamily: F }}>
                  PDF · DOCX · TXT · MD
                </span>
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
                  aria-label="Upload lesson plan"
                  disabled={lpBusy}
                  onChange={(e) => e.target.files?.[0] && handleLessonPlanUpload(e.target.files[0])}
                  style={{ display: "none" }}
                />
              </label>
            ) : (
              <div
                style={{
                  background: "#F9FAFB",
                  border: "1px solid #E5E7EB",
                  borderRadius: 7,
                  padding: 8,
                  position: "relative",
                }}
              >
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#374151",
                    margin: 0,
                    fontFamily: F,
                    paddingRight: 18,
                    wordBreak: "break-all",
                  }}
                >
                  📘 {lpFile.name}
                </p>
                <button
                  onClick={() => {
                    setLpFile(null);
                    setLpMsg("");
                    setLpNotes("");
                  }}
                  aria-label="Remove lesson plan"
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: 800,
                    color: "#9CA3AF",
                  }}
                >
                  ✕
                </button>

                <label
                  style={{
                    display: "block",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#6B7280",
                    textTransform: "uppercase",
                    letterSpacing: 0.4,
                    margin: "10px 0 4px",
                    fontFamily: F,
                  }}
                >
                  Worksheet Type
                </label>
                <select
                  value={lpType}
                  onChange={(e) => setLpType(e.target.value)}
                  disabled={lpBusy}
                  aria-label="Worksheet type"
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    borderRadius: 6,
                    border: "1.5px solid #E5E7EB",
                    background: "white",
                    fontFamily: F,
                    fontSize: 11,
                    color: "#374151",
                    cursor: "pointer",
                  }}
                >
                  {WORKSHEET_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>

                <label
                  style={{
                    display: "block",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#6B7280",
                    textTransform: "uppercase",
                    letterSpacing: 0.4,
                    margin: "10px 0 4px",
                    fontFamily: F,
                  }}
                >
                  Additional Info{" "}
                  <span
                    style={{
                      fontWeight: 500,
                      textTransform: "none",
                      letterSpacing: 0,
                      color: "#9CA3AF",
                    }}
                  >
                    (optional)
                  </span>
                </label>
                <SpellTextarea
                  value={lpNotes}
                  onChange={(e) => setLpNotes(e.target.value)}
                  disabled={lpBusy}
                  rows={3}
                  placeholder="e.g. focus on vocabulary, include 5 short answers, scaffold for ELL students…"
                  aria-label="Additional instructions"
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    borderRadius: 6,
                    border: "1.5px solid #E5E7EB",
                    background: "white",
                    fontFamily: F,
                    fontSize: 11,
                    color: "#374151",
                    resize: "vertical",
                    lineHeight: 1.4,
                  }}
                />

                <button
                  disabled={lpBusy}
                  onClick={generateWorksheetFromLessonPlan}
                  style={{
                    width: "100%",
                    marginTop: 8,
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: "none",
                    background: gv.color,
                    color: "white",
                    fontFamily: F,
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: lpBusy ? "wait" : "pointer",
                    opacity: lpBusy ? 0.7 : 1,
                  }}
                >
                  {lpBusy ? "Working…" : "✨ Generate Worksheet"}
                </button>
              </div>
            )}

            {lpMsg && (
              <p
                style={{
                  fontSize: 10,
                  color: lpMsg.startsWith("⚠") ? "#B91C1C" : "#6B7280",
                  margin: "6px 0 0",
                  lineHeight: 1.45,
                  fontFamily: F,
                }}
              >
                {lpMsg}
              </p>
            )}
          </div>

          {/* Lesson Plan History — saved generation runs */}
          {lpHistory.length > 0 && (
            <div style={{ padding: "8px 10px", borderBottom: "1px solid #F3F4F6" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  margin: "0 0 6px 0",
                }}
              >
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#9CA3AF",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    margin: 0,
                    fontFamily: F,
                  }}
                >
                  History ({lpHistory.length})
                </p>
                <button
                  onClick={clearLpHistory}
                  aria-label="Clear all history"
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 10,
                    color: "#9CA3AF",
                    fontFamily: F,
                    padding: 0,
                  }}
                >
                  Clear
                </button>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  maxHeight: 240,
                  overflowY: "auto",
                }}
              >
                {lpHistory.map((h) => {
                  const d = new Date(h.ts);
                  const when = `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
                  return (
                    <div
                      key={h.id}
                      style={{
                        background: "#F9FAFB",
                        border: "1px solid #E5E7EB",
                        borderRadius: 7,
                        padding: 7,
                        position: "relative",
                      }}
                    >
                      <button
                        onClick={() => removeLpHistory(h.id)}
                        aria-label="Remove from history"
                        style={{
                          position: "absolute",
                          top: 3,
                          right: 4,
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          fontSize: 11,
                          fontWeight: 800,
                          color: "#9CA3AF",
                          padding: 0,
                        }}
                      >
                        ✕
                      </button>
                      <p
                        title={h.fileName}
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          color: "#374151",
                          margin: 0,
                          fontFamily: F,
                          paddingRight: 14,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        📘 {h.fileName}
                      </p>
                      <p
                        style={{
                          fontSize: 9.5,
                          color: "#6B7280",
                          margin: "2px 0 0",
                          fontFamily: F,
                          lineHeight: 1.35,
                        }}
                      >
                        {h.typeLabel} · {h.elementCount} blk · {h.pageCount} pg
                      </p>
                      {h.notes && (
                        <p
                          title={h.notes}
                          style={{
                            fontSize: 9.5,
                            color: "#9CA3AF",
                            margin: "2px 0 0",
                            fontFamily: F,
                            lineHeight: 1.35,
                            fontStyle: "italic",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          “{h.notes}”
                        </p>
                      )}
                      <p
                        style={{
                          fontSize: 9,
                          color: "#9CA3AF",
                          margin: "2px 0 6px",
                          fontFamily: F,
                        }}
                      >
                        {when}
                      </p>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          onClick={() => restoreLpHistory(h)}
                          disabled={lpBusy}
                          aria-label="Switch to this version"
                          style={{
                            flex: 1,
                            padding: "5px 6px",
                            borderRadius: 5,
                            border: `1.5px solid ${gv.color}`,
                            background: gv.light,
                            color: gv.color,
                            fontFamily: F,
                            fontWeight: 700,
                            fontSize: 10.5,
                            cursor: lpBusy ? "wait" : "pointer",
                          }}
                        >
                          ↺ Switch
                        </button>
                        <button
                          onClick={() => regenerateLpHistory(h)}
                          disabled={lpBusy}
                          aria-label="Regenerate from this lesson plan"
                          style={{
                            flex: 1,
                            padding: "5px 6px",
                            borderRadius: 5,
                            border: "1.5px solid #E5E7EB",
                            background: "white",
                            color: "#374151",
                            fontFamily: F,
                            fontWeight: 700,
                            fontSize: 10.5,
                            cursor: lpBusy ? "wait" : "pointer",
                          }}
                        >
                          ✨ Regen
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Reference Worksheet — image upload for AI inspiration */}
          <div style={{ padding: "8px 10px", borderBottom: "1px solid #F3F4F6" }}>
            <p
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#9CA3AF",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                margin: "0 0 6px 0",
                fontFamily: F,
              }}
            >
              Reference Worksheet
            </p>
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                padding: "10px 8px",
                borderRadius: 8,
                border: `1.5px dashed ${gv.color}45`,
                background: "white",
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              <span style={{ fontSize: 20 }} aria-hidden="true">
                📎
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: gv.color,
                  lineHeight: 1.3,
                  fontFamily: F,
                }}
              >
                {refImg ? "Reference uploaded" : "Upload reference"}
              </span>
              <span style={{ fontSize: 10, color: "#9CA3AF", fontFamily: F }}>
                Image of a worksheet for AI to riff on
              </span>
              <input
                type="file"
                accept="image/*,application/pdf"
                aria-label="Upload reference worksheet image"
                onChange={(e) => e.target.files?.[0] && handleRefUpload(e.target.files[0])}
                style={{ display: "none" }}
              />
            </label>
            {refDesc && (
              <p
                style={{
                  fontSize: 10,
                  color: "#6B7280",
                  margin: "6px 0 0",
                  lineHeight: 1.4,
                  fontFamily: F,
                }}
              >
                {refDesc}
              </p>
            )}
          </div>

          {/* Worksheet Upload — PDF/CSV/TXT, AI recreates as editable blocks */}
          <div style={{ padding: "8px 10px", borderBottom: "1px solid #F3F4F6" }}>
            <p
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#9CA3AF",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                margin: "0 0 6px 0",
                fontFamily: F,
              }}
            >
              Upload Worksheet
            </p>
            {wsFile ? (
              <div
                style={{
                  background: "#F9FAFB",
                  border: "1px solid #E5E7EB",
                  borderRadius: 7,
                  padding: 8,
                  position: "relative",
                }}
              >
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#374151",
                    margin: 0,
                    fontFamily: F,
                    paddingRight: 18,
                    wordBreak: "break-all",
                  }}
                >
                  📄 {wsFile.name}
                </p>
                <button
                  onClick={() => {
                    setWsFile(null);
                    setWsFileMsg("");
                  }}
                  aria-label="Remove uploaded worksheet"
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: 800,
                    color: "#9CA3AF",
                  }}
                >
                  ✕
                </button>
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <button
                    disabled={wsFileBusy}
                    onClick={() => recreateWorksheetFromFile(false)}
                    style={{
                      flex: 1,
                      padding: "6px 8px",
                      borderRadius: 6,
                      border: "none",
                      background: gv.color,
                      color: "white",
                      fontFamily: F,
                      fontWeight: 700,
                      fontSize: 11,
                      cursor: wsFileBusy ? "wait" : "pointer",
                      opacity: wsFileBusy ? 0.6 : 1,
                    }}
                  >
                    {wsFileBusy ? "Working…" : "Recreate"}
                  </button>
                  <button
                    disabled={wsFileBusy}
                    onClick={() => recreateWorksheetFromFile(true)}
                    title="Build a fresh, improved version inspired by this worksheet"
                    style={{
                      flex: 1,
                      padding: "6px 8px",
                      borderRadius: 6,
                      border: `1.5px solid ${gv.color}`,
                      background: "white",
                      color: gv.color,
                      fontFamily: F,
                      fontWeight: 700,
                      fontSize: 11,
                      cursor: wsFileBusy ? "wait" : "pointer",
                      opacity: wsFileBusy ? 0.6 : 1,
                    }}
                  >
                    Re-imagine
                  </button>
                </div>
                {wsFileMsg && (
                  <p
                    style={{
                      fontSize: 10,
                      color: wsFileMsg.startsWith("⚠") ? "#B91C1C" : "#6B7280",
                      margin: "6px 0 0",
                      lineHeight: 1.4,
                      fontFamily: F,
                    }}
                  >
                    {wsFileMsg}
                  </p>
                )}
              </div>
            ) : (
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  padding: "10px 8px",
                  borderRadius: 8,
                  border: `1.5px dashed ${gv.color}45`,
                  background: "white",
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                <span style={{ fontSize: 20 }} aria-hidden="true">
                  📥
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: gv.color,
                    lineHeight: 1.3,
                    fontFamily: F,
                  }}
                >
                  Upload Worksheet
                </span>
                <span style={{ fontSize: 10, color: "#9CA3AF", fontFamily: F }}>
                  PDF · CSV · TXT
                </span>
                <input
                  type="file"
                  accept=".pdf,.csv,.txt,.md,text/csv,text/plain,application/pdf"
                  aria-label="Upload worksheet file to recreate"
                  onChange={(e) => e.target.files[0] && handleWsFileUpload(e.target.files[0])}
                  style={{ display: "none" }}
                />
              </label>
            )}
          </div>

          {/* Element palette */}
          <div style={{ padding: "6px 8px 2px" }}>
            <p
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#9CA3AF",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                margin: 0,
                fontFamily: F,
              }}
            >
              Add Element
            </p>
          </div>
          <div style={{ padding: "2px 6px 10px" }} role="list" aria-label="Worksheet elements">
            {PALETTE.map((p) => (
              <button
                key={p.type}
                onClick={() => addEl(p.type)}
                role="listitem"
                aria-label={`Add ${p.label} element`}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "6px 8px",
                  borderRadius: 7,
                  border: "1.5px solid transparent",
                  background: "transparent",
                  cursor: "pointer",
                  fontFamily: F,
                  fontWeight: 600,
                  fontSize: 12.5,
                  color: "#374151",
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  marginBottom: 1,
                  transition: "all 0.1s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = gv.light;
                  e.currentTarget.style.borderColor = gv.color + "35";
                  e.currentTarget.style.color = gv.color;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.borderColor = "transparent";
                  e.currentTarget.style.color = "#374151";
                }}
              >
                <span style={{ fontSize: 14, flexShrink: 0 }} aria-hidden="true">
                  {p.emoji}
                </span>
                <span>{p.label}</span>
              </button>
            ))}
          </div>

          <div
            style={{
              padding: "6px 12px",
              borderTop: "1px solid #F3F4F6",
              fontSize: 11,
              color: "#9CA3AF",
              fontWeight: 600,
              fontFamily: F,
            }}
            aria-live="polite"
          >
            {ws.elements.length} element{ws.elements.length !== 1 ? "s" : ""}
          </div>
        </nav>

        {/* CENTER: WORKSHEET CANVAS */}
        <main
          id="worksheet-canvas"
          role="main"
          aria-label="Worksheet canvas"
          className="canvas-area"
          style={{
            flex: 1,
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: viewMode === "scroll" ? "20px 18px 90px" : "28px 18px 90px",
            background: "#F1F3F5",
            position: "relative",
            gap: viewMode === "scroll" ? 22 : 0,
          }}
        >
          {/* Generating overlay */}
          {generating && (
            <div
              role="status"
              aria-label="Generating worksheet content"
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(241,243,245,0.9)",
                zIndex: 10,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: gv.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 26,
                  animation: "spin 2s linear infinite",
                }}
                aria-hidden="true"
              >
                ✨
              </div>
              <div style={{ textAlign: "center" }}>
                <p
                  style={{
                    fontFamily: FF,
                    fontSize: 18,
                    color: gv.color,
                    margin: "0 0 5px 0",
                    fontWeight: 700,
                  }}
                >
                  Designing your worksheet…
                </p>
                <p style={{ fontFamily: F, fontSize: 13, color: "#6B7280", margin: 0 }}>
                  AI is building activities aligned to the standard
                </p>
              </div>
            </div>
          )}

          {(() => {
            // Maximum y+height of inner content that fits cleanly on a single
            // page. The paper is 970px tall with 52px vertical padding on each
            // side (~866px inner). The Name/Date header consumes ~80px when
            // visible. We compare element bottoms against this threshold and
            // prompt the user to overflow content onto a new page.
            const PAGE_CONTENT_MAX = 770;

            const overflowToNewPage = (fromPage: number) => {
              setWs((p) => {
                const insertAt = fromPage + 1;
                const movedIds = new Set<string>();
                const overflowing = p.elements.filter((e) => {
                  if ((e.page || 0) !== fromPage) return false;
                  const bottom = (e.y || 0) + (e.heightOverride || 180);
                  return bottom > PAGE_CONTENT_MAX;
                });
                overflowing.forEach((e) => movedIds.add(e.id));
                const minY = overflowing.length ? Math.min(...overflowing.map((e) => e.y || 0)) : 0;
                const remapped = p.elements.map((e) => {
                  if (movedIds.has(e.id)) {
                    return { ...e, page: insertAt, y: Math.max(0, (e.y || 0) - minY) };
                  }
                  if ((e.page || 0) >= insertAt) {
                    return { ...e, page: (e.page || 0) + 1 };
                  }
                  return e;
                });
                return { ...p, elements: remapped, pageCount: (p.pageCount || 1) + 1 };
              });
              setCurrentPage(fromPage + 1);
              setSelId(null);
              announce(`Overflowing content moved to page ${fromPage + 2}`);
            };

            const renderPage = (pIdx) => {
              const els = ws.elements.filter((e) => pageOf(e) === pIdx);
              const hideHeader = isPageHeaderHidden(pIdx);
              const maxBottom = els.length
                ? Math.max(...els.map((e) => (e.y || 0) + (e.heightOverride || 180)))
                : 0;
              const overflows = maxBottom > PAGE_CONTENT_MAX;
              return (
                <div
                  key={pIdx}
                  className="worksheet-paper"
                  style={{
                    width: 760,
                    minHeight: 970,
                    background: "white",
                    boxShadow: "0 2px 20px rgba(0,0,0,0.1), 0 1px 4px rgba(0,0,0,0.06)",
                    borderRadius: 4,
                    padding: "52px 64px",
                    position: "relative",
                  }}
                >
                  {ws.showGrade && (
                    <div
                      aria-label={`Grade level: ${gv.name}`}
                      style={{
                        position: "absolute",
                        top: 14,
                        right: 18,
                        background: gv.light,
                        border: `1.5px solid ${gv.color}35`,
                        borderRadius: 20,
                        padding: "3px 12px",
                        fontSize: 11,
                        fontWeight: 700,
                        color: gv.color,
                        fontFamily: F,
                      }}
                    >
                      {gv.emoji} {gv.name}
                    </div>
                  )}

                  {/* Per-page header hide toggle */}
                  <button
                    className="no-print"
                    onClick={() => togglePageHeader(pIdx)}
                    title={
                      hideHeader
                        ? "Show title / name / date on this page"
                        : "Hide title / name / date on this page"
                    }
                    aria-label={
                      hideHeader
                        ? `Show header on page ${pIdx + 1}`
                        : `Hide header on page ${pIdx + 1}`
                    }
                    style={{
                      position: "absolute",
                      top: 14,
                      left: ws.pageCount > 1 ? 110 : 18,
                      background: hideHeader ? "#FEF3C7" : "white",
                      border: "1px solid #E5E7EB",
                      borderRadius: 999,
                      padding: "3px 10px",
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: "#6B7280",
                      fontFamily: F,
                      cursor: "pointer",
                    }}
                  >
                    {hideHeader ? "👁 Show header" : "🙈 Hide header"}
                  </button>

                  {/* Title + Name/Date header */}
                  {!hideHeader && (
                    <div style={{ marginBottom: 24 }}>
                      {pIdx === 0 ? (
                        <SpellInput
                          value={ws.title}
                          onChange={(e) => setF("title", e.target.value)}
                          spellCheck
                          aria-label="Worksheet title on page"
                          style={{
                            width: "100%",
                            fontSize: gv.fontSize + 5,
                            fontWeight: 700,
                            fontFamily: FF,
                            color: gv.color,
                            border: "none",
                            outline: "none",
                            background: "transparent",
                            borderBottom: `2px solid ${gv.color}20`,
                            paddingBottom: 8,
                            marginBottom: 16,
                            paddingRight: 120,
                          }}
                          placeholder="Worksheet Title"
                        />
                      ) : (
                        <h2
                          style={{
                            width: "100%",
                            fontSize: gv.fontSize + 5,
                            fontWeight: 700,
                            fontFamily: FF,
                            color: gv.color,
                            margin: 0,
                            borderBottom: `2px solid ${gv.color}20`,
                            paddingBottom: 8,
                            marginBottom: 16,
                            paddingRight: 120,
                          }}
                        >
                          {ws.title}{" "}
                          <span
                            style={{
                              fontFamily: F,
                              fontSize: Math.max(gv.fontSize - 4, 12),
                              fontWeight: 700,
                              color: "#9CA3AF",
                            }}
                          >
                            — Page {pIdx + 1}
                          </span>
                        </h2>
                      )}
                      <div style={{ display: "flex", gap: 44 }}>
                        {ws.showName && (
                          <div style={{ display: "flex", alignItems: "center", gap: 7, flex: 1 }}>
                            <span
                              style={{
                                fontSize: Math.max(gv.fontSize - 10, 11),
                                fontWeight: 600,
                                fontFamily: F,
                                color: "#374151",
                                whiteSpace: "nowrap",
                              }}
                            >
                              Name:
                            </span>
                            <div
                              style={{ flex: 1, borderBottom: "1.5px solid #D1D5DB", height: 22 }}
                              aria-hidden="true"
                            />
                          </div>
                        )}
                        {ws.showDate && (
                          <div style={{ display: "flex", alignItems: "center", gap: 7, flex: 1 }}>
                            <span
                              style={{
                                fontSize: Math.max(gv.fontSize - 10, 11),
                                fontWeight: 600,
                                fontFamily: F,
                                color: "#374151",
                                whiteSpace: "nowrap",
                              }}
                            >
                              Date:
                            </span>
                            <div
                              style={{ flex: 1, borderBottom: "1.5px solid #D1D5DB", height: 22 }}
                              aria-hidden="true"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Page indicator chip */}
                  {pageCount > 1 && (
                    <div
                      className="no-print"
                      style={{
                        position: "absolute",
                        top: 14,
                        left: 18,
                        background: gv.light,
                        border: `1.5px solid ${gv.color}35`,
                        borderRadius: 20,
                        padding: "3px 12px",
                        fontSize: 11,
                        fontWeight: 700,
                        color: gv.color,
                        fontFamily: F,
                      }}
                    >
                      Page {pIdx + 1} of {pageCount}
                    </div>
                  )}

                  {/* Page-overflow prompt: shown when any element extends past
                      the single-page content cap. Lets the user spill the
                      overflowing blocks onto a new page instead of letting
                      content silently fall off the printed sheet. */}
                  {overflows && (
                    <div
                      role="alert"
                      className="no-print"
                      style={{
                        background: "#FEF3C7",
                        border: "1.5px solid #F59E0B",
                        borderRadius: 10,
                        padding: "10px 14px",
                        margin: "0 0 14px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <span
                        style={{ fontFamily: F, fontSize: 12.5, fontWeight: 700, color: "#92400E" }}
                      >
                        ⚠ Content exceeds one page. Add a second page to keep everything in print.
                      </span>
                      <button
                        onClick={() => overflowToNewPage(pIdx)}
                        style={{
                          flexShrink: 0,
                          padding: "6px 12px",
                          borderRadius: 8,
                          border: "1.5px solid #B45309",
                          background: "#B45309",
                          color: "white",
                          fontFamily: F,
                          fontWeight: 800,
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                        aria-label="Add second page and move overflowing content"
                      >
                        + Add second page
                      </button>
                    </div>
                  )}

                  {/* Free-position canvas — elements absolutely positioned, draggable */}
                  {els.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "80px 30px" }} role="status">
                      <div
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 16,
                          background: "#F3F4F6",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          margin: "0 auto 16px",
                          fontSize: 28,
                        }}
                        aria-hidden="true"
                      >
                        📝
                      </div>
                      <p
                        style={{
                          fontFamily: FF,
                          fontSize: 16,
                          fontWeight: 700,
                          color: "#9CA3AF",
                          margin: "0 0 8px",
                        }}
                      >
                        {pageCount > 1 ? `Page ${pIdx + 1} is empty` : "Your worksheet is empty"}
                      </p>
                      <p
                        style={{
                          fontFamily: F,
                          fontSize: 13,
                          color: "#D1D5DB",
                          lineHeight: 1.7,
                          margin: 0,
                        }}
                      >
                        Add elements from the left panel · Drag blocks anywhere · Up to 3 across
                      </p>
                    </div>
                  ) : (
                    <div
                      style={{
                        position: "relative",
                        width: "100%",
                        minHeight: Math.max(
                          700,
                          ...els.map((e) => (e.y || 0) + (e.heightOverride || 180) + 40),
                        ),
                      }}
                    >
                      {els.map((el) => (
                        <ElView
                          key={el.id}
                          el={el}
                          gv={gv}
                          oneLineOnly={!!ws.oneLineOnly}
                          selected={selId === el.id}
                          onClick={() => {
                            setSelId(el.id);
                            setRightTab("edit");
                            if (viewMode === "scroll") setCurrentPage(pIdx);
                          }}
                          onResize={handleResizeStart}
                          onReset={handleResetElement}
                          onDragStart={handleDragStart}
                          onDelete={(id) => delEl(id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            };

            return viewMode === "scroll"
              ? Array.from({ length: pageCount }).map((_, i) => renderPage(i))
              : renderPage(currentPage);
          })()}

          {/* Page navigation strip — beneath the paper */}
          <div
            className="no-print"
            style={{
              position: "fixed",
              bottom: 14,
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "white",
              border: "1px solid #E5E7EB",
              borderRadius: 999,
              padding: "5px 8px",
              boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
              zIndex: 5,
            }}
          >
            <button
              onClick={() => setViewMode(viewMode === "single" ? "scroll" : "single")}
              aria-label={
                viewMode === "single"
                  ? "Switch to scroll view (all pages)"
                  : "Switch to single-page view"
              }
              title={viewMode === "single" ? "Scroll all pages" : "Single page view"}
              style={{
                height: 28,
                padding: "0 10px",
                borderRadius: 999,
                border: "1.5px solid " + gv.color + "55",
                background: gv.light,
                color: gv.color,
                fontFamily: F,
                fontWeight: 700,
                fontSize: 11,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                marginRight: 4,
              }}
            >
              {viewMode === "single" ? "📑 Scroll all" : "📄 Single page"}
            </button>
            {viewMode === "single" &&
              Array.from({ length: pageCount }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setCurrentPage(i);
                    setSelId(null);
                  }}
                  aria-label={`Go to page ${i + 1}`}
                  aria-current={i === currentPage ? "page" : undefined}
                  style={{
                    minWidth: 28,
                    height: 28,
                    padding: "0 8px",
                    borderRadius: 999,
                    border:
                      i === currentPage ? `1.5px solid ${gv.color}` : "1.5px solid transparent",
                    background: i === currentPage ? gv.light : "transparent",
                    color: i === currentPage ? gv.color : "#6B7280",
                    fontFamily: F,
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                  }}
                >
                  {i + 1}
                  {pageCount > 1 && i === currentPage && (
                    <span
                      role="button"
                      aria-label={`Delete page ${i + 1}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        removePage(i);
                      }}
                      style={{
                        marginLeft: 2,
                        fontSize: 11,
                        color: "#9CA3AF",
                        cursor: "pointer",
                        lineHeight: 1,
                      }}
                    >
                      ✕
                    </span>
                  )}
                </button>
              ))}
            {viewMode === "scroll" && (
              <span style={{ fontFamily: F, fontSize: 11, color: "#6B7280", padding: "0 8px" }}>
                {pageCount} page{pageCount === 1 ? "" : "s"}
              </span>
            )}
            <button
              onClick={addPage}
              aria-label="Add new page"
              title="Add new page"
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                border: "none",
                background: gv.color,
                color: "white",
                fontFamily: F,
                fontWeight: 800,
                fontSize: 16,
                cursor: "pointer",
                lineHeight: 1,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              +
            </button>
          </div>
        </main>

        {/* RIGHT PANEL */}
        <aside
          role="complementary"
          aria-label="Element editor and tools"
          className="no-print ws-sidebar-right"
          style={{
            width: 292,
            background: "white",
            borderLeft: "1px solid #E5E7EB",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", borderBottom: "1px solid #E5E7EB", flexShrink: 0 }}>
            {[
              ["edit", "✏️ Edit"],
              ["image", "🎨 Image"],
              ["ai", "🤖 AI Help"],
            ].map(([t, l]) => (
              <button
                key={t}
                onClick={() => setRightTab(t)}
                role="tab"
                aria-selected={rightTab === t}
                aria-controls={`panel-${t}`}
                style={{
                  flex: 1,
                  padding: "10px 4px",
                  border: "none",
                  borderBottom: rightTab === t ? `2px solid ${gv.color}` : "2px solid transparent",
                  background: rightTab === t ? gv.light : "transparent",
                  color: rightTab === t ? gv.color : "#9CA3AF",
                  fontFamily: F,
                  fontWeight: 700,
                  fontSize: 11.5,
                  cursor: "pointer",
                  marginBottom: -1,
                  transition: "all 0.12s",
                  whiteSpace: "nowrap",
                }}
              >
                {l}
              </button>
            ))}
          </div>
          <div
            style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}
            role="tabpanel"
          >
            {rightTab === "edit" && (
              <ElEditor
                el={selEl}
                gv={gv}
                onChange={(u) => selEl && updEl(selEl.id, u)}
                onDelete={() => selEl && delEl(selEl.id)}
                onMoveUp={() => selEl && movEl(selEl.id, "up")}
                onMoveDown={() => selEl && movEl(selEl.id, "down")}
                onDuplicate={() => selEl && dupEl(selEl.id)}
              />
            )}
            {rightTab === "image" && <AIImageGen gv={gv} onAddImage={addGeneratedImage} />}
            {rightTab === "ai" && (
              <AIChat
                gv={gv}
                wsTitle={ws.title}
                elCount={ws.elements.length}
                refDesc={refDesc}
                onInsertElements={insertAiElementsMultiPage}
              />
            )}
          </div>
        </aside>
      </div>

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} gv={gv} />}
      {showStds && (
        <StandardsModal
          gv={gv}
          gradeId={ws.gradeId}
          onClose={() => setShowStds(false)}
          onInsert={insertStandard}
          onGenerate={handleGenerateFromStd}
        />
      )}
      {showAlignment && (
        <AlignmentModal
          gv={gv}
          ws={ws}
          onClose={() => setShowAlignment(false)}
          onSetMapping={(elId, codes) => updEl(elId, { stdCodes: codes })}
        />
      )}
      {showVersions && <VersionsModal gv={gv} ws={ws} onClose={() => setShowVersions(false)} />}
      {showExport && <ExportModal gv={gv} ws={ws} onClose={() => setShowExport(false)} />}
    </div>
  );
}
