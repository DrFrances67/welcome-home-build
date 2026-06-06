// Drop-in <textarea>/<input> replacements that add real-time, offline
// spell + grammar checking with an overlay of wavy underlines and a
// click-to-apply suggestion popup. Non-intrusive: checking is debounced and
// never blocks typing, focus, or form submission.
//
// Alignment strategy: the underline overlay is rendered with the EXACT same
// style object as the real field (same font, padding, border width, width,
// line-height), so the mirrored text lines up perfectly without measuring.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { checkText, ensureSpeller, type Issue } from "@/lib/spellcheck";

type PopupState = { issue: Issue; x: number; y: number } | null;

interface CommonProps {
  value: string;
  onChange: (e: { target: { value: string } }) => void;
}

type SpellFieldProps = CommonProps &
  React.TextareaHTMLAttributes<HTMLTextAreaElement> &
  React.InputHTMLAttributes<HTMLInputElement> & { multiline: boolean };

function SpellField({ multiline, value, onChange, className, style, ...rest }: SpellFieldProps) {
  const elRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [popup, setPopup] = useState<PopupState>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Warm up the dictionary once (cached across all fields).
  useEffect(() => {
    void ensureSpeller();
  }, []);

  // Debounced re-check whenever the value changes.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!value || !value.trim()) {
      setIssues([]);
      return;
    }
    timer.current = setTimeout(() => {
      const snapshot = value;
      void checkText(snapshot).then((res) => {
        if (elRef.current && elRef.current.value === snapshot) setIssues(res);
      });
    }, 400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value]);

  // Keep overlay scroll in sync with the field.
  useEffect(() => {
    const el = elRef.current;
    const ov = overlayRef.current;
    if (!el || !ov) return;
    const onScroll = () => {
      ov.scrollTop = el.scrollTop;
      ov.scrollLeft = el.scrollLeft;
    };
    onScroll();
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  });

  const openPopup = useCallback((issue: Issue, target: HTMLElement) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (!issue.suggestions.length) return;
    const r = target.getBoundingClientRect();
    setPopup({ issue, x: r.left, y: r.bottom + 4 });
  }, []);

  const scheduleClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setPopup(null), 250);
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const applySuggestion = useCallback(
    (issue: Issue, suggestion: string) => {
      const replacement = suggestion === "(remove duplicate)" ? "" : suggestion;
      let start = issue.start;
      if (suggestion === "(remove duplicate)") {
        while (start > 0 && /\s/.test(value[start - 1])) start -= 1;
      }
      const next = value.slice(0, start) + replacement + value.slice(issue.end);
      onChange({ target: { value: next } });
      setPopup(null);
      setIssues((prev) => prev.filter((i) => i !== issue));
    },
    [value, onChange],
  );

  // Mirrored content with error spans.
  const segments = useMemo(() => {
    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    issues.forEach((issue, idx) => {
      if (issue.start > cursor) nodes.push(value.slice(cursor, issue.start));
      const isSpelling = issue.type === "spelling";
      nodes.push(
        <span
          key={idx}
          data-spell-error={issue.type}
          title={issue.message}
          style={{
            pointerEvents: "auto",
            cursor: "pointer",
            textDecorationLine: "underline",
            textDecorationStyle: "wavy",
            textDecorationColor: isSpelling ? "#ef4444" : "#2563eb",
            textDecorationThickness: "1.5px",
            textUnderlineOffset: "2px",
          }}
          onMouseEnter={(e) => openPopup(issue, e.currentTarget)}
          onMouseLeave={scheduleClose}
          onClick={(e) => {
            e.preventDefault();
            openPopup(issue, e.currentTarget);
          }}
        >
          {value.slice(issue.start, issue.end)}
        </span>,
      );
      cursor = issue.end;
    });
    if (cursor < value.length) nodes.push(value.slice(cursor));
    nodes.push("\u200b"); // trailing zero-width char keeps height in sync
    return nodes;
  }, [issues, value, openPopup, scheduleClose]);

  // The field and overlay share this base style for perfect alignment.
  const baseStyle: React.CSSProperties = { ...(style as React.CSSProperties), margin: 0 };

  const fieldStyle: React.CSSProperties = {
    ...baseStyle,
    position: "relative",
    background: "transparent",
    zIndex: 1,
  };

  const overlayStyle: React.CSSProperties = {
    ...baseStyle,
    position: "absolute",
    top: 0,
    left: 0,
    height: "100%",
    pointerEvents: "none",
    userSelect: "none",
    overflow: "hidden",
    color: "transparent",
    borderColor: "transparent",
    background: "transparent",
    zIndex: 2,
    whiteSpace: multiline ? "pre-wrap" : "pre",
    wordWrap: "break-word",
    overflowWrap: "break-word",
  };

  const commonEl = {
    ...rest,
    value,
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => onChange(e),
    spellCheck: false,
    className,
  };

  return (
    <span style={{ position: "relative", display: "block" }}>
      {multiline ? (
        <textarea
          ref={elRef as React.Ref<HTMLTextAreaElement>}
          style={fieldStyle}
          {...(commonEl as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <input
          ref={elRef as React.Ref<HTMLInputElement>}
          style={fieldStyle}
          {...(commonEl as React.InputHTMLAttributes<HTMLInputElement>)}
        />
      )}
      <div ref={overlayRef} aria-hidden style={overlayStyle}>
        {segments}
      </div>

      {popup && (
        <div
          style={{
            position: "fixed",
            left: Math.min(popup.x, window.innerWidth - 240),
            top: popup.y,
            zIndex: 9999,
            background: "#fff",
            border: "1px solid #E5E7EB",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            padding: 4,
            minWidth: 180,
            maxWidth: 240,
            fontFamily: "'Inter',system-ui,sans-serif",
            fontSize: 13,
          }}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <div
            style={{
              padding: "4px 8px",
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 0.4,
              color: popup.issue.type === "spelling" ? "#ef4444" : "#2563eb",
            }}
          >
            {popup.issue.message}
          </div>
          {popup.issue.suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => applySuggestion(popup.issue, s)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "6px 8px",
                border: "none",
                background: "transparent",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 13,
                color: "#111827",
                fontWeight: s === "(remove duplicate)" ? 500 : 600,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#F3F4F6")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {s === "(remove duplicate)" ? "Remove duplicate word" : s}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setIssues((prev) => prev.filter((i) => i !== popup.issue));
              setPopup(null);
            }}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "6px 8px",
              border: "none",
              borderTop: "1px solid #F3F4F6",
              background: "transparent",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
              color: "#9CA3AF",
              marginTop: 2,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#F9FAFB")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            Dismiss
          </button>
        </div>
      )}
    </span>
  );
}

export function SpellTextarea(
  props: CommonProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return <SpellField {...(props as SpellFieldProps)} multiline />;
}

export function SpellInput(props: CommonProps & React.InputHTMLAttributes<HTMLInputElement>) {
  return <SpellField {...(props as SpellFieldProps)} multiline={false} />;
}
