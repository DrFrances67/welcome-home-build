import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { matchesShortcut, isEditableTarget } from "../components/KeyboardShortcuts";

describe("matchesShortcut", () => {
  it("matches a plain key, case-insensitive", () => {
    expect(matchesShortcut({ key: "k" }, { key: "K" })).toBe(true);
    expect(matchesShortcut({ key: "K" }, { key: "k" })).toBe(true);
  });
  it("rejects when modifier requirements differ", () => {
    expect(matchesShortcut({ key: "k", ctrlKey: true }, { key: "k" })).toBe(false);
    expect(matchesShortcut({ key: "k" }, { key: "k", mods: ["mod"] })).toBe(false);
  });
  it("matches mod via either Ctrl or Meta", () => {
    expect(matchesShortcut({ key: "k", ctrlKey: true }, { key: "k", mods: ["mod"] })).toBe(true);
    expect(matchesShortcut({ key: "k", metaKey: true }, { key: "k", mods: ["mod"] })).toBe(true);
  });
  it("respects shift requirement", () => {
    expect(matchesShortcut({ key: "?", shiftKey: true }, { key: "?", mods: ["shift"] })).toBe(true);
    expect(matchesShortcut({ key: "?", shiftKey: false }, { key: "?", mods: ["shift"] })).toBe(
      false,
    );
  });
});

describe("isEditableTarget", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });
  it("returns true for INPUT, TEXTAREA, SELECT", () => {
    const i = document.createElement("input");
    document.body.appendChild(i);
    const t = document.createElement("textarea");
    document.body.appendChild(t);
    const s = document.createElement("select");
    document.body.appendChild(s);
    expect(isEditableTarget(i)).toBe(true);
    expect(isEditableTarget(t)).toBe(true);
    expect(isEditableTarget(s)).toBe(true);
  });
  it("returns true for contenteditable elements", () => {
    const d = document.createElement("div");
    d.setAttribute("contenteditable", "true");
    document.body.appendChild(d);
    expect(isEditableTarget(d)).toBe(true);
  });
  it("returns false for buttons / divs / null", () => {
    const b = document.createElement("button");
    document.body.appendChild(b);
    const d = document.createElement("div");
    document.body.appendChild(d);
    expect(isEditableTarget(b)).toBe(false);
    expect(isEditableTarget(d)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

// ━━━ Integration: render the hook in a tiny component and dispatch keys ━━━
import { renderHook } from "@testing-library/react";
import { useGlobalShortcuts } from "../components/KeyboardShortcuts";

function fireKey(opts: KeyboardEventInit & { key: string }, target?: EventTarget) {
  const ev = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...opts });
  (target ?? window).dispatchEvent(ev);
  return ev;
}

describe("useGlobalShortcuts", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("invokes the matching handler and prevents default", () => {
    const run = vi.fn();
    renderHook(() => useGlobalShortcuts([{ key: "1", description: "go", run }]));
    const ev = fireKey({ key: "1" });
    expect(run).toHaveBeenCalledTimes(1);
    expect(ev.defaultPrevented).toBe(true);
  });

  it("does not fire when no shortcut matches", () => {
    const run = vi.fn();
    renderHook(() => useGlobalShortcuts([{ key: "1", description: "x", run }]));
    fireKey({ key: "2" });
    expect(run).not.toHaveBeenCalled();
  });

  it("ignores the shortcut when focus is inside an input (default)", () => {
    const run = vi.fn();
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    renderHook(() => useGlobalShortcuts([{ key: "1", description: "x", run }]));
    // dispatch from the input element
    fireKey({ key: "1" }, input);
    expect(run).not.toHaveBeenCalled();
  });

  it("still fires inside an input when allowInInput is true", () => {
    const run = vi.fn();
    const input = document.createElement("input");
    document.body.appendChild(input);
    renderHook(() =>
      useGlobalShortcuts([{ key: "Escape", description: "x", allowInInput: true, run }]),
    );
    fireKey({ key: "Escape" }, input);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("matches modifier combinations", () => {
    const run = vi.fn();
    renderHook(() => useGlobalShortcuts([{ key: "k", mods: ["mod"], description: "search", run }]));
    fireKey({ key: "k" }); // no mod
    expect(run).not.toHaveBeenCalled();
    fireKey({ key: "k", ctrlKey: true });
    expect(run).toHaveBeenCalledTimes(1);
    fireKey({ key: "k", metaKey: true });
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("removes its listener on unmount", () => {
    const run = vi.fn();
    const { unmount } = renderHook(() => useGlobalShortcuts([{ key: "1", description: "x", run }]));
    fireKey({ key: "1" });
    expect(run).toHaveBeenCalledTimes(1);
    unmount();
    fireKey({ key: "1" });
    expect(run).toHaveBeenCalledTimes(1); // unchanged
  });

  it("re-reads the latest handler list without re-binding the listener", () => {
    const a = vi.fn();
    const b = vi.fn();
    let handlers = [{ key: "1", description: "a", run: a }];
    const { rerender } = renderHook(() => useGlobalShortcuts(handlers));
    fireKey({ key: "1" });
    expect(a).toHaveBeenCalledTimes(1);
    handlers = [{ key: "1", description: "b", run: b }];
    rerender();
    fireKey({ key: "1" });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("simulates the full app shortcut surface (1-4 + ? + g + Esc)", () => {
    const setTool = vi.fn();
    const help = vi.fn();
    const top = vi.fn();
    renderHook(() =>
      useGlobalShortcuts([
        { key: "1", description: "lesson", run: () => setTool("lesson") },
        { key: "2", description: "danielson", run: () => setTool("danielson") },
        { key: "3", description: "worksheet", run: () => setTool("worksheet") },
        { key: "4", description: "email", run: () => setTool("email") },
        { key: "?", mods: ["shift"], description: "help", run: help },
        { key: "g", description: "top", run: top },
        { key: "Escape", description: "close", allowInInput: true, run: help },
      ]),
    );
    fireKey({ key: "1" });
    fireKey({ key: "3" });
    fireKey({ key: "?", shiftKey: true });
    fireKey({ key: "g" });
    fireKey({ key: "Escape" });
    expect(setTool).toHaveBeenNthCalledWith(1, "lesson");
    expect(setTool).toHaveBeenNthCalledWith(2, "worksheet");
    expect(help).toHaveBeenCalledTimes(2);
    expect(top).toHaveBeenCalledTimes(1);
  });
});
