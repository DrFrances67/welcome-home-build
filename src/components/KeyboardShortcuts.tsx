/* eslint-disable react-refresh/only-export-components */
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Keyboard Shortcuts — global a11y helper
//
// Provides:
//   - useGlobalShortcuts(handlers): registers a single keydown listener and
//     dispatches based on a small declarative map. Skips when focus is in
//     an editable field (input/textarea/contenteditable/select) unless the
//     handler is marked allowInInput.
//   - ShortcutsHelpOverlay: a modal that lists every shortcut. Trapped focus,
//     Esc to close, fully labelled.
//
// All matching is case-insensitive. Modifier-aware (mod = Cmd on Mac, Ctrl
// elsewhere). Pure logic for the matcher is exported separately for tests.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useEffect, useRef } from "react";

export type ShortcutHandler = {
  /** key like "1", "?", "/", "k". Case-insensitive. */
  key: string;
  /** "mod" (Cmd/Ctrl), "shift", "alt". Combine in any order. */
  mods?: Array<"mod" | "shift" | "alt">;
  description: string;
  /** Group label for the help modal. */
  group?: string;
  /** Run handler even when focus is inside an editable field. */
  allowInInput?: boolean;
  run: (e: KeyboardEvent) => void;
};

// Pure matcher — exported so unit tests don't need a DOM.
export function matchesShortcut(
  e: { key: string; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; altKey?: boolean },
  s: { key: string; mods?: Array<"mod" | "shift" | "alt"> },
): boolean {
  if (e.key.toLowerCase() !== s.key.toLowerCase()) return false;
  const wantMod = s.mods?.includes("mod") ?? false;
  const wantShift = s.mods?.includes("shift") ?? false;
  const wantAlt = s.mods?.includes("alt") ?? false;
  const hasMod = !!(e.ctrlKey || e.metaKey);
  if (wantMod !== hasMod) return false;
  if (wantShift !== !!e.shiftKey) return false;
  if (wantAlt !== !!e.altKey) return false;
  return true;
}

/** Returns true when an editable element currently has focus. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

export function useGlobalShortcuts(handlers: ShortcutHandler[]) {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const editable = isEditableTarget(e.target);
      for (const s of ref.current) {
        if (!matchesShortcut(e, s)) continue;
        if (editable && !s.allowInInput) continue;
        e.preventDefault();
        s.run(e);
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

// ━━━ Help overlay ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const FONT = "'Inter', system-ui, sans-serif";

function formatKey(s: ShortcutHandler): string {
  const isMac = typeof navigator !== "undefined" && /Mac|iPad|iPhone/.test(navigator.platform);
  const parts: string[] = [];
  if (s.mods?.includes("mod")) parts.push(isMac ? "⌘" : "Ctrl");
  if (s.mods?.includes("alt")) parts.push(isMac ? "⌥" : "Alt");
  if (s.mods?.includes("shift")) parts.push("Shift");
  parts.push(s.key.length === 1 ? s.key.toUpperCase() : s.key);
  return parts.join(" + ");
}

export function ShortcutsHelpOverlay({
  open,
  onClose,
  shortcuts,
}: {
  open: boolean;
  onClose: () => void;
  shortcuts: ShortcutHandler[];
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    // Move focus into the dialog & trap it.
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Tab") {
        // simple focus trap — keep focus inside the dialog
        const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusables || focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  // Group shortcuts
  const groups = new Map<string, ShortcutHandler[]>();
  for (const s of shortcuts) {
    const g = s.group || "General";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(s);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-help-title"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        fontFamily: FONT,
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white",
          borderRadius: 14,
          padding: "22px 26px",
          maxWidth: 560,
          width: "100%",
          maxHeight: "85vh",
          overflow: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
          outline: "none",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <h2
            id="shortcuts-help-title"
            style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#111" }}
          >
            Keyboard Shortcuts
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
            style={{
              background: "transparent",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              padding: "4px 10px",
              cursor: "pointer",
              fontSize: 14,
              color: "#374151",
            }}
          >
            Close
          </button>
        </div>
        {[...groups.entries()].map(([group, items]) => (
          <div key={group} style={{ marginBottom: 16 }}>
            <h3
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: 1.2,
                color: "#6b7280",
                margin: "10px 0 8px",
                fontWeight: 700,
              }}
            >
              {group}
            </h3>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {items.map((s, i) => (
                <li
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "7px 0",
                    borderBottom: "1px solid #f3f4f6",
                    fontSize: 14,
                    color: "#1f2937",
                  }}
                >
                  <span>{s.description}</span>
                  <kbd
                    style={{
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      background: "#f3f4f6",
                      border: "1px solid #d1d5db",
                      borderRadius: 4,
                      padding: "2px 8px",
                      fontSize: 12,
                      color: "#111",
                      marginLeft: 12,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatKey(s)}
                  </kbd>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p style={{ fontSize: 12, color: "#6b7280", marginTop: 8 }}>
          Tip: shortcuts pause while you're typing in a field. Press <kbd>Esc</kbd> to close this
          dialog.
        </p>
      </div>
    </div>
  );
}
