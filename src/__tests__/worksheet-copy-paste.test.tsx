import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { WorksheetBuilder } from "@/components/TheTechSavvyTeacherApp";

// Helpers
const isMac = /Mac|iPad|iPhone/.test(typeof navigator !== "undefined" ? navigator.platform : "");
const modKey = isMac ? { metaKey: true } : { ctrlKey: true };

function addInstruction() {
  const btns = screen.getAllByRole("listitem", { name: /Add Instructions element/i });
  fireEvent.click(btns[0]);
}

describe("Worksheet element copy / paste / duplicate", () => {
  beforeEach(() => {
    // jsdom doesn't implement scrollTo and the app calls it on some flows.
    Object.defineProperty(window, "scrollTo", { value: () => {}, writable: true });
    // localStorage starts clean
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Duplicate button creates a second element of the same type", () => {
    render(<WorksheetBuilder />);
    addInstruction();

    // After adding one instruction, exactly one preview element should exist.
    const previewBefore = document.querySelectorAll(".ws-element");
    expect(previewBefore.length).toBe(1);

    // Edit panel should now show a Duplicate button.
    const dup = screen.getByRole("button", { name: /Duplicate element/i });
    fireEvent.click(dup);

    const previewAfter = document.querySelectorAll(".ws-element");
    expect(previewAfter.length).toBe(2);
  });

  it("Cmd/Ctrl+C then Cmd/Ctrl+V pastes a clone of the selected element", () => {
    render(<WorksheetBuilder />);
    addInstruction();

    expect(document.querySelectorAll(".ws-element").length).toBe(1);

    // Copy then paste via keyboard (focus is on the document body, not an input).
    fireEvent.keyDown(window, { key: "c", ...modKey });
    fireEvent.keyDown(window, { key: "v", ...modKey });

    expect(document.querySelectorAll(".ws-element").length).toBe(2);
  });

  it("Cmd/Ctrl+D duplicates the selected element", () => {
    render(<WorksheetBuilder />);
    addInstruction();

    fireEvent.keyDown(window, { key: "d", ...modKey });

    expect(document.querySelectorAll(".ws-element").length).toBe(2);
  });

  it("paste with empty clipboard is a no-op (no element added, no crash)", () => {
    render(<WorksheetBuilder />);
    // Nothing added yet → nothing selected, clipboard empty.
    fireEvent.keyDown(window, { key: "v", ...modKey });
    expect(document.querySelectorAll(".ws-element").length).toBe(0);
  });

  it("duplicated element preserves edited text content", () => {
    render(<WorksheetBuilder />);
    addInstruction();

    // Edit the text content of the selected instruction.
    const ta = screen.getByLabelText(/Text content/i) as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: "Read carefully ✏️" } });

    // Duplicate via keyboard.
    fireEvent.keyDown(window, { key: "d", ...modKey });

    // Both rendered elements should contain the edited string.
    const allText = document.body.textContent || "";
    const matches = allText.match(/Read carefully ✏️/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});
