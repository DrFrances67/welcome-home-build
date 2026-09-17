/* eslint-disable */
import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  lazy,
  Suspense,
  type CSSProperties,
} from "react";
import { shouldShowScrollTop, scrollEverythingToTop } from "@/lib/scroll-top";
import { useGlobalShortcuts, ShortcutsHelpOverlay } from "@/components/KeyboardShortcuts";
import { setActiveTool as setActiveToolName } from "@/lib/tracking";

// Each tool is a heavy, self-contained screen. They are code-split so a first
// visit only downloads the tool that is actually being opened.
const WorksheetBuilder = lazy(() =>
  import("./teacher/WorksheetBuilder").then((m) => ({ default: m.WorksheetBuilder })),
);
const LessonPlanGenerator = lazy(() =>
  import("./teacher/LessonPlanGenerator").then((m) => ({ default: m.LessonPlanGenerator })),
);
const EmailAssistant = lazy(() =>
  import("./teacher/EmailAssistant").then((m) => ({ default: m.EmailAssistant })),
);
const DanielsonReview = lazy(() =>
  import("./teacher/DanielsonReview").then((m) => ({ default: m.DanielsonReview })),
);

/** Warm the chunk for a tool before the user commits to opening it. */
const PRELOADERS: Record<string, () => Promise<unknown>> = {
  worksheet: () => import("./teacher/WorksheetBuilder"),
  lesson: () => import("./teacher/LessonPlanGenerator"),
  email: () => import("./teacher/EmailAssistant"),
  danielson: () => import("./teacher/DanielsonReview"),
};

function ToolLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 48,
        color: "#6b7280",
        fontFamily: "'Inter',sans-serif",
        fontSize: 14,
        fontWeight: 600,
      }}
    >
      Loading…
    </div>
  );
}
import { AppStateProvider, useAppState } from "@/contexts/AppStateContext";
import { STATES, type StateCode } from "@/data/state-standards";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SITE SHELL — The Tech Savvy Teacher
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const TOOLS = [
  {
    id: "lesson",
    label: "Lesson Plan Generator",
    icon: "📋",
    desc: "Generate complete, differentiated lesson plans instantly",
  },
  {
    id: "danielson",
    label: "Danielson Review",
    icon: "🧭",
    desc: "Score a lesson plan against the Danielson rubric",
  },
  {
    id: "worksheet",
    label: "Worksheet Builder",
    icon: "📄",
    desc: "Build print-ready worksheets aligned to NY Standards",
  },
  {
    id: "email",
    label: "Professional Communication",
    icon: "✉️",
    desc: "Transform rough notes into polished professional communication",
  },
];

const SITE_COLOR = "#CF27F5";
const SITE_DARK = "#8B0AB0";

function TheTechSavvyTeacherAppRoot() {
  const { stateCode, setStateCode, info: stateInfo } = useAppState();
  const [activeTool, setActiveTool] = useState("lesson");
  const [swipeDir, setSwipeDir] = useState<"left" | "right" | null>(null);
  const [swipeHint, setSwipeHint] = useState<string | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);
  const touchStart = useRef<{ x: number; y: number; t: number; valid: boolean } | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Keep the tracking layer's active tool in sync with the visible tool so AI
  // calls are attributed to the real tool in the admin dashboard.
  useEffect(() => {
    const map = {
      lesson: "Lesson Plan Generator",
      danielson: "Danielson Rubric Builder",
      worksheet: "Worksheet Builder",
      email: "Professional Communication",
    } as const;
    setActiveToolName(map[activeTool as keyof typeof map] ?? null);
  }, [activeTool]);

  // Track scroll within the worksheet canvas (and the page itself when stacked
  // on mobile) to show a floating "back to top" button after meaningful scroll.
  useEffect(() => {
    const isCoarse =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(pointer: coarse)").matches;

    const compute = () => {
      const canvas = document.getElementById("worksheet-canvas");
      const canvasY = canvas ? canvas.scrollTop : 0;
      const winY = window.scrollY || document.documentElement.scrollTop || 0;
      setShowScrollTop(
        shouldShowScrollTop({
          activeTool,
          isCoarsePointer: !!isCoarse,
          canvasScrollTop: canvasY,
          windowScrollTop: winY,
        }),
      );
    };

    if (!isCoarse || activeTool !== "worksheet") {
      setShowScrollTop(false);
      return;
    }

    let cleanup: (() => void) | null = null;
    const timer = window.setTimeout(() => {
      const targets: (HTMLElement | Window)[] = [window];
      const canvas = document.getElementById("worksheet-canvas");
      if (canvas) targets.push(canvas);
      targets.forEach((t) => t.addEventListener("scroll", compute, { passive: true }));
      compute();
      cleanup = () => targets.forEach((t) => t.removeEventListener("scroll", compute));
    }, 60);
    return () => {
      window.clearTimeout(timer);
      cleanup?.();
    };
  }, [activeTool]);

  const scrollToTop = () => scrollEverythingToTop();

  // ━━ Global keyboard shortcuts ━━
  const shortcuts = [
    {
      key: "?",
      mods: ["shift"] as const,
      description: "Show keyboard shortcuts",
      group: "General",
      run: () => setHelpOpen((o) => !o),
    },
    {
      key: "1",
      description: "Switch to Lesson Plan Generator",
      group: "Navigation",
      run: () => setActiveTool("lesson"),
    },
    {
      key: "2",
      description: "Switch to Danielson Review",
      group: "Navigation",
      run: () => setActiveTool("danielson"),
    },
    {
      key: "3",
      description: "Switch to Worksheet Builder",
      group: "Navigation",
      run: () => setActiveTool("worksheet"),
    },
    {
      key: "4",
      description: "Switch to Professional Communication",
      group: "Navigation",
      run: () => setActiveTool("email"),
    },
    {
      key: "g",
      description: "Go to top of page",
      group: "Navigation",
      run: () => scrollEverythingToTop(),
    },
    {
      key: "Escape",
      description: "Close dialogs / cancel",
      group: "General",
      allowInInput: true,
      run: () => setHelpOpen(false),
    },
  ].map((s) => ({ ...s, mods: s.mods ? [...s.mods] : undefined })) as Parameters<
    typeof useGlobalShortcuts
  >[0];

  useGlobalShortcuts(shortcuts);

  // Online/offline awareness
  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setIsOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  // Change tools by swipe direction. dir="left" means user swiped left → next tool.
  const changeToolByDir = (dir: "left" | "right") => {
    const ids = TOOLS.map((t) => t.id);
    const idx = ids.indexOf(activeTool);
    if (idx === -1) return;
    const nextIdx = dir === "left" ? idx + 1 : idx - 1;
    if (nextIdx < 0 || nextIdx >= ids.length) {
      // Edge — show a brief hint and bail
      setSwipeHint(dir === "left" ? "You're on the last tool" : "You're on the first tool");
      window.setTimeout(() => setSwipeHint(null), 1600);
      return;
    }
    const nextId = ids[nextIdx];
    const label = TOOLS.find((t) => t.id === nextId)?.label || nextId;
    setSwipeDir(dir === "left" ? "right" : "left"); // incoming-from direction
    setActiveTool(nextId);
    setSwipeHint(`→ ${label}`);
    window.setTimeout(() => setSwipeHint(null), 1400);
  };

  // Swipe gesture detection on the main content area.
  // Only active on coarse-pointer devices and ignores swipes starting on
  // form fields, the worksheet canvas (which has its own pan/zoom), or
  // controls that need horizontal interaction.
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const isCoarse =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(pointer: coarse)").matches;
    if (!isCoarse) return;

    const SHOULD_IGNORE = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false;
      // Ignore swipes that start inside form controls or the worksheet canvas
      // (the canvas needs its own pan/scroll). Also ignore inside any element
      // marked with data-no-swipe.
      return !!target.closest(
        'input,textarea,select,button,[role="slider"],[role="tab"],[contenteditable="true"],' +
          "#worksheet-canvas,.canvas-area,.ws-sidebar-left,.ws-sidebar-right,[data-no-swipe]",
      );
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        touchStart.current = null;
        return;
      }
      const t = e.touches[0];
      touchStart.current = {
        x: t.clientX,
        y: t.clientY,
        t: Date.now(),
        valid: !SHOULD_IGNORE(e.target),
      };
    };
    const onEnd = (e: TouchEvent) => {
      const start = touchStart.current;
      touchStart.current = null;
      if (!start || !start.valid) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      const dt = Date.now() - start.t;
      const absX = Math.abs(dx),
        absY = Math.abs(dy);
      // Require: mostly horizontal, decent distance, reasonable speed
      if (absX < 60) return;
      if (absX < absY * 1.6) return; // too vertical → likely a scroll
      if (dt > 700) return;
      changeToolByDir(dx < 0 ? "left" : "right");
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchend", onEnd);
    };
  }, [activeTool]);

  // Clear the slide animation class once it has played
  useEffect(() => {
    if (!swipeDir) return;
    const id = window.setTimeout(() => setSwipeDir(null), 260);
    return () => window.clearTimeout(id);
  }, [swipeDir, activeTool]);

  return (
    <div
      className="site-shell"
      style={{
        display: "flex",
        flexDirection: "column",
        height: activeTool === "email" || activeTool === "worksheet" ? "auto" : "100vh",
        minHeight: activeTool === "email" || activeTool === "worksheet" ? "100vh" : 0,
        overflow: activeTool === "email" || activeTool === "worksheet" ? "visible" : "hidden",
        background: "#F8F9FA",
        fontFamily: "'Inter','Segoe UI',sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; }
        @keyframes spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-9px)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        :focus-visible { outline: 3px solid #CF27F5 !important; outline-offset: 2px !important; border-radius: 4px; box-shadow: 0 0 0 5px rgba(207,39,245,0.18) !important; }
        button:focus-visible, [role="button"]:focus-visible, [role="tab"]:focus-visible, [role="radio"]:focus-visible { outline: 3px solid #CF27F5 !important; outline-offset: 3px !important; }
        input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 3px solid #CF27F5 !important; outline-offset: 1px !important; border-color: #CF27F5 !important; }
        @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration:0.01ms !important; transition-duration:0.01ms !important; } }
        @media print { .site-header { display:none !important; } }
        .skip-nav { position:absolute; top:-100px; left:8px; z-index:9999; background:#CF27F5; color:white; padding:8px 16px; border-radius:6px; font-family:'Inter',sans-serif; font-weight:700; font-size:14px; text-decoration:none; transition:top 0.2s; }
        .skip-nav:focus { top:8px; }
        .sr-only { position:absolute !important; width:1px !important; height:1px !important; padding:0 !important; margin:-1px !important; overflow:hidden !important; clip:rect(0,0,0,0) !important; white-space:nowrap !important; border:0 !important; }
        .worksheet-paper { background:white; }
        .canvas-area { background:#F1F3F5; }
        .ws-element:hover .el-delete-btn { opacity: 1 !important; }
        .el-delete-btn { opacity: 0; transition: opacity 0.15s; }
        .app-shell { background:#F8F9FA; }
        .tool-tab { transition: background 0.15s, border-color 0.15s !important; }
        .tool-tab:hover { background: rgba(255,255,255,0.15) !important; }

        /* ━━ Responsive layout for phones & tablets ━━ */
        .tool-tabs-row { overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: thin; }
        .tool-tabs-row::-webkit-scrollbar { height: 3px; }
        .tool-tabs-row::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.3); border-radius: 3px; }

        /* Tablets (iPad portrait & smaller) */
        @media (max-width: 1024px) {
          .two-col-grid { grid-template-columns: 1fr !important; gap: 18px !important; padding: 18px !important; }
          .lesson-grid { grid-template-columns: 1fr !important; gap: 18px !important; padding: 18px !important; }
          .ws-sidebar-left { width: 170px !important; max-height: 100% !important; overflow-y: auto !important; -webkit-overflow-scrolling: touch !important; }
          .ws-sidebar-right { width: 240px !important; }
          .ws-topbar { flex-wrap: wrap !important; height: auto !important; padding: 8px 12px !important; gap: 8px !important; }
          .ws-topbar > * { flex-shrink: 1 !important; }
          .powered-badge { top: 8px !important; right: 8px !important; padding: 3px 10px 3px 8px !important; font-size: 10px !important; }
        }

        /* Phones */
        @media (max-width: 768px) {
          .site-brand { padding: 16px 14px 0 !important; }
          .site-brand h1 { font-size: 22px !important; }
          .site-brand p { font-size: 9px !important; letter-spacing: 2px !important; }
          .site-brand-emoji { font-size: 28px !important; margin-bottom: 6px !important; }
          .powered-badge { position: static !important; margin: 8px auto 0 !important; align-self: center !important; }
          .powered-badge-wrap { display: flex; justify-content: center; padding: 0 8px; }
          .tool-tabs-row { justify-content: flex-start !important; padding: 0 8px; margin-top: 12px !important; }
          .tool-tab { padding: 10px 14px !important; font-size: 12px !important; }
          .tool-tab span { font-size: 14px !important; }

          /* Worksheet builder: stack the 3-column body */
          .ws-body { flex-direction: column !important; overflow: visible !important; height: auto !important; }
          .site-shell, .app-main { height: auto !important; min-height: 100vh !important; overflow: visible !important; }
          .ws-sidebar-left, .ws-sidebar-right {
            width: 100% !important;
            max-height: none !important;
            height: auto !important;
            overflow: visible !important;
            border-right: none !important;
            border-left: none !important;
            border-bottom: 1px solid #E5E7EB !important;
            flex-shrink: 0 !important;
          }
          /* Make any inner scroll containers in the sidebars expand naturally */
          .ws-sidebar-left > *, .ws-sidebar-right > * { overflow: visible !important; }
          .ws-canvas-wrap { height: auto !important; min-height: 60vh; overflow: visible !important; }
          .app-shell { height: auto !important; min-height: 100vh !important; overflow: visible !important; }
          html, body { overflow-x: hidden; overflow-y: auto; }

          /* Worksheet topbar — compact */
          .ws-topbar { padding: 8px !important; gap: 6px !important; }
          .ws-topbar input { font-size: 13px !important; min-width: 120px !important; flex-basis: 100% !important; order: 99; }
          .ws-topbar fieldset { display: none !important; }

          /* Two-column form grids inside cards collapse */
          .form-2col { grid-template-columns: 1fr !important; }

          /* Modals fit phone screens */
          .modal-card { max-width: 96vw !important; max-height: 92vh !important; }

          /* Larger touch targets */
          button, select, input[type="checkbox"] { touch-action: manipulation; }
        }

        /* Very small phones */
        @media (max-width: 420px) {
          .site-brand h1 { font-size: 19px !important; }
          .tool-tab { padding: 9px 10px !important; font-size: 11px !important; }
          .ws-topbar button { padding: 5px 8px !important; font-size: 11px !important; }
        }

        /* ━━ Touch-device UX: bigger tap targets, swipe spacing ━━ */
        /* Applied to coarse pointers (touch screens) regardless of width
           so iPads in landscape also benefit. Desktop stays compact. */
        @media (hover: none) and (pointer: coarse) {
          /* Prevent iOS auto-zoom on focus by ensuring inputs are >= 16px */
          input, select, textarea { font-size: 16px !important; }

          /* Generous minimum tap target (Apple HIG: 44px, Material: 48px) */
          button, [role="button"], [role="tab"], [role="radio"], [role="checkbox"], select, a.skip-nav, .tool-tab, label > input[type="checkbox"] + *, summary {
            min-height: 44px;
          }
          button, [role="button"], .tool-tab { min-width: 44px; padding-top: 10px; padding-bottom: 10px; }

          /* Larger checkboxes & radios */
          input[type="checkbox"], input[type="radio"] { width: 20px !important; height: 20px !important; }

          /* Swipe-friendly spacing between adjacent controls */
          .tool-tabs-row { gap: 6px !important; padding: 4px 8px !important; }
          .ws-topbar { gap: 10px !important; }

          /* Removes the 300ms tap delay & sticky hover */
          a, button, [role="button"], select, input, textarea, .tool-tab { touch-action: manipulation; -webkit-tap-highlight-color: rgba(207,39,245,0.18); }

          /* Smoother momentum scrolling for any scrollable region */
          .tool-tabs-row, .ws-body, .canvas-area, .app-shell, main, .ws-sidebar-left { -webkit-overflow-scrolling: touch; }

          /* Stronger focus ring on touch devices */
          :focus-visible { outline-width: 4px !important; outline-offset: 3px !important; }
        }

        /* ━━ Swipe-tab transitions & hint toast ━━ */
        @keyframes slideInFromRight { from { opacity:0; transform:translateX(28px); } to { opacity:1; transform:translateX(0); } }
        @keyframes slideInFromLeft  { from { opacity:0; transform:translateX(-28px); } to { opacity:1; transform:translateX(0); } }
        @keyframes swipeHintFade { 0%{opacity:0;transform:translate(-50%,12px)} 12%{opacity:1;transform:translate(-50%,0)} 80%{opacity:1;transform:translate(-50%,0)} 100%{opacity:0;transform:translate(-50%,-6px)} }
        .swipe-anim-right { animation: slideInFromRight 0.22s ease-out; }
        .swipe-anim-left  { animation: slideInFromLeft  0.22s ease-out; }
        .swipe-hint-toast {
          position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%);
          background: rgba(17,17,30,0.92); color: white; font-family:'Inter',sans-serif;
          font-size: 13px; font-weight: 600; padding: 10px 16px; border-radius: 22px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.35); z-index: 9998; pointer-events: none;
          animation: swipeHintFade 1.6s ease-out forwards; display:flex; align-items:center; gap:8px;
        }
        @media (prefers-reduced-motion: reduce) {
          .swipe-anim-right, .swipe-anim-left { animation: none !important; }
          .swipe-hint-toast { animation: none !important; opacity: 1 !important; }
        }

        /* ━━ Floating "back to top" FAB ━━ */
        @keyframes fabPop { from { opacity:0; transform:translateY(10px) scale(0.85);} to { opacity:1; transform:translateY(0) scale(1);} }
        .scroll-top-fab {
          position: fixed; right: 16px; bottom: 20px;
          width: 52px; height: 52px; border-radius: 50%;
          background: #CF27F5; color: white; border: none;
          box-shadow: 0 8px 24px rgba(207,39,245,0.45), 0 2px 6px rgba(0,0,0,0.18);
          font-size: 22px; font-weight: 800; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          z-index: 9997; animation: fabPop 0.2s ease-out;
          touch-action: manipulation;
        }
        .scroll-top-fab:hover { background: #B21FD6; }
        .scroll-top-fab:active { transform: scale(0.92); }
        @media (prefers-reduced-motion: reduce) { .scroll-top-fab { animation: none !important; } }

        /* ━━ Offline banner ━━ */
        .offline-banner {
          position: fixed; left: 50%; top: 12px; transform: translateX(-50%);
          background: #1F2937; color: white; font-family:'Inter',sans-serif;
          font-size: 13px; font-weight: 600; padding: 10px 16px; border-radius: 22px;
          box-shadow: 0 8px 28px rgba(0,0,0,0.35); z-index: 9999;
          display: flex; align-items: center; gap: 10px; max-width: calc(100vw - 24px);
        }

        /* ━━ Readable error & warning text on small screens ━━ */
        @media (max-width: 768px) {
          /* All explicit alert/status panels */
          [role="alert"], [role="status"] {
            font-size: 14px !important;
            line-height: 1.5 !important;
          }
          /* Inline DC2626 error text used throughout the app */
          [style*="color:\"#DC2626\""], [style*="color: \"#DC2626\""],
          [style*="color:\"#B91C1C\""], [style*="color: \"#B91C1C\""] {
            font-size: 14px !important;
          }
          /* Validation suggestion buttons & cap notices remain tappable */
          .scroll-top-fab { right: 14px; bottom: 16px; width: 56px; height: 56px; }
        }

        /* ━━ Bigger dropdown / option hit areas ━━ */
        select { line-height: 1.5; padding-top: 8px; padding-bottom: 8px; }
        select option { padding: 8px 10px; min-height: 36px; }
        select optgroup { font-weight: 800; padding: 6px 0; }
        @media (hover: none) and (pointer: coarse) {
          select { padding-top: 12px !important; padding-bottom: 12px !important; padding-right: 30px !important; min-height: 44px !important; background-position: right 10px center; }
          select option { padding: 12px 12px !important; min-height: 44px !important; font-size: 16px !important; }
          /* Radio / checkbox option rows used as styled "buttons" */
          [role="radio"], [role="checkbox"], [role="option"] { min-height: 44px !important; padding: 10px 12px !important; }
          label { min-height: 36px; }
          /* Add a touch of breathing room between adjacent option chips */
          [role="radiogroup"], [role="group"] { row-gap: 10px; }
        }
      `}</style>

      <a href="#main-content" className="skip-nav">
        Skip to main content
      </a>

      {/* ━━ SITE HEADER ━━ */}
      <header
        className="site-header"
        style={{
          background: `linear-gradient(160deg, ${SITE_DARK} 0%, ${SITE_COLOR} 60%, #E05BFF 100%)`,
          flexShrink: 0,
          boxShadow: "0 3px 18px rgba(207,39,245,0.45)",
          position: "relative",
        }}
      >
        {/* State selector — top left */}
        <div
          style={{
            position: "absolute",
            top: 14,
            left: 20,
            display: "flex",
            alignItems: "center",
            gap: 8,
            zIndex: 2,
          }}
        >
          <label
            htmlFor="state-select"
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "rgba(255,255,255,0.85)",
              textTransform: "uppercase",
              letterSpacing: 1,
              fontFamily: "'Inter',sans-serif",
            }}
          >
            State
          </label>
          <select
            id="state-select"
            value={stateCode}
            onChange={(e) => setStateCode(e.target.value as StateCode)}
            aria-label="Select your state"
            style={{
              background: "rgba(255,255,255,0.16)",
              color: "white",
              border: "1px solid rgba(255,255,255,0.3)",
              borderRadius: 20,
              padding: "5px 12px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "'Inter',sans-serif",
              backdropFilter: "blur(6px)",
              outline: "none",
            }}
          >
            {STATES.map((s) => (
              <option key={s.code} value={s.code} style={{ color: "#111827" }}>
                {s.flag} {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Powered-by badge — top right */}
        <div
          style={{
            position: "absolute",
            top: 14,
            right: 20,
            display: "flex",
            alignItems: "center",
            gap: 8,
            zIndex: 2,
          }}
        >
          <div
            className="powered-badge"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              background: "rgba(255,255,255,0.14)",
              borderRadius: 20,
              padding: "5px 14px 5px 10px",
              backdropFilter: "blur(6px)",
            }}
          >
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#4ADE80",
                boxShadow: "0 0 0 2px rgba(74,222,128,0.35)",
              }}
            />
            <span
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.9)",
                fontWeight: 600,
                fontFamily: "'Inter',sans-serif",
                letterSpacing: 0.3,
              }}
            >
              Powered by Lovable AI
            </span>
          </div>
        </div>

        {/* Centered branding */}
        <div
          className="site-brand"
          style={{
            textAlign: "center",
            padding: "24px 32px 0",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div
            className="site-brand-emoji"
            style={{ fontSize: 38, lineHeight: 1, marginBottom: 10 }}
            aria-hidden="true"
          >
            💽
          </div>
          <h1
            style={{
              fontFamily: "'Playfair Display',serif",
              color: "white",
              fontSize: 30,
              fontWeight: 800,
              margin: "0 0 7px",
              letterSpacing: 0.3,
              lineHeight: 1.1,
            }}
          >
            The Tech Savvy Teacher
          </h1>
          <p
            style={{
              fontFamily: "'Inter',sans-serif",
              fontSize: 10.5,
              fontWeight: 700,
              color: "rgba(255,255,255,0.78)",
              letterSpacing: 3,
              textTransform: "uppercase",
              margin: "0 0 0",
            }}
          >
            Tools for {stateInfo.name} Educators
          </p>
        </div>

        {/* Nav tabs — centered row below title */}
        <div
          role="tablist"
          aria-label="Tool navigation"
          onKeyDown={(e) => {
            const ids = TOOLS.map((t) => t.id);
            const idx = ids.indexOf(activeTool);
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
              e.preventDefault();
              const next =
                e.key === "ArrowRight"
                  ? ids[(idx + 1) % ids.length]
                  : ids[(idx - 1 + ids.length) % ids.length];
              setActiveTool(next);
              const btn = document.getElementById(`tool-tab-${next}`);
              btn?.focus();
            } else if (e.key === "Home") {
              e.preventDefault();
              setActiveTool(ids[0]);
              document.getElementById(`tool-tab-${ids[0]}`)?.focus();
            } else if (e.key === "End") {
              e.preventDefault();
              setActiveTool(ids[ids.length - 1]);
              document.getElementById(`tool-tab-${ids[ids.length - 1]}`)?.focus();
            }
          }}
          className="tool-tabs-row"
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 2,
            marginTop: 16,
            background: "rgba(0,0,0,0.18)",
          }}
        >
          {TOOLS.map((t) => {
            const isActive = activeTool === t.id;
            return (
              <button
                key={t.id}
                id={`tool-tab-${t.id}`}
                type="button"
                onClick={() => setActiveTool(t.id)}
                onMouseEnter={() => void PRELOADERS[t.id]?.()}
                onFocus={() => void PRELOADERS[t.id]?.()}
                className="tool-tab"
                role="tab"
                aria-selected={isActive}
                aria-controls="main-content"
                tabIndex={isActive ? 0 : -1}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "13px 28px",
                  border: "none",
                  borderBottom: isActive ? "3px solid white" : "3px solid transparent",
                  background: isActive ? "rgba(255,255,255,0.2)" : "transparent",
                  color: "white",
                  fontFamily: "'Inter',sans-serif",
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 14,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  letterSpacing: 0.1,
                }}
              >
                <span style={{ fontSize: 17 }} aria-hidden="true">
                  {t.icon}
                </span>
                {t.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* ━━ MAIN CONTENT ━━ */}
      <main
        id="main-content"
        ref={mainRef}
        role="tabpanel"
        aria-labelledby={`tool-tab-${activeTool}`}
        tabIndex={-1}
        className={`app-main ${swipeDir === "right" ? "swipe-anim-right" : swipeDir === "left" ? "swipe-anim-left" : ""}`}
        style={{
          flex: 1,
          minHeight: 0,
          overflow:
            activeTool === "worksheet" ? "visible" : activeTool === "email" ? "visible" : "auto",
          display: "flex",
          flexDirection: "column",
          outline: "none",
          touchAction: "pan-y",
        }}
      >
        <Suspense fallback={<ToolLoading />}>
          {activeTool === "worksheet" && (
            <div className="ws-canvas-wrap" style={{ display: "flex", flexDirection: "column" }}>
              <WorksheetBuilder />
            </div>
          )}
          {activeTool === "lesson" && (
            <LessonPlanGenerator
              onBuildWorksheets={(payload) => {
                if (typeof window !== "undefined") {
                  (window as any).__pendingLessonForWorksheet = payload;
                }
                setActiveTool("worksheet");
              }}
            />
          )}
          {activeTool === "danielson" && <DanielsonReview />}
          {activeTool === "email" && <EmailAssistant />}
        </Suspense>
      </main>

      {/* Swipe hint toast (mobile) */}
      {swipeHint && (
        <div className="swipe-hint-toast" role="status" aria-live="polite">
          <span aria-hidden="true">👆</span>
          {swipeHint}
        </div>
      )}

      {/* Offline banner — only shown when the device loses connectivity.
          The previously visited app shell is served from the browser HTTP
          cache, so the UI still loads on weak connections. */}
      {isOffline && (
        <div role="status" aria-live="polite" className="offline-banner">
          <span aria-hidden="true">📡</span>
          <span>You're offline — using cached app. Some AI features need a connection.</span>
        </div>
      )}

      {/* Floating "scroll to top" — mobile worksheet view */}
      {showScrollTop && activeTool === "worksheet" && (
        <button
          type="button"
          onClick={scrollToTop}
          aria-label="Scroll to top of worksheet"
          className="scroll-top-fab"
        >
          <span aria-hidden="true">⬆</span>
        </button>
      )}

      {/* Keyboard shortcuts — floating bottom right */}
      <button
        type="button"
        onClick={() => setHelpOpen(true)}
        aria-label="Show keyboard shortcuts (press ? )"
        title="Keyboard shortcuts (?)"
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 900,
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: SITE_COLOR,
          color: "white",
          border: "1px solid rgba(255,255,255,0.35)",
          borderRadius: 22,
          padding: "8px 14px",
          fontSize: 12.5,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "'Inter',sans-serif",
          boxShadow: "0 6px 20px rgba(207,39,245,0.45)",
        }}
      >
        <kbd
          style={{
            background: "rgba(0,0,0,0.25)",
            borderRadius: 4,
            padding: "1px 6px",
            fontSize: 11,
          }}
        >
          ?
        </kbd>
        Shortcuts
      </button>

      {/* Keyboard shortcuts help overlay */}
      <ShortcutsHelpOverlay
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        shortcuts={shortcuts}
      />
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXPORT — wrapped to play nicely with TanStack Start route component
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function TheTechSavvyTeacherApp() {
  return (
    <AppStateProvider>
      <TheTechSavvyTeacherAppRoot />
    </AppStateProvider>
  );
}

