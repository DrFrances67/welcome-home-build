import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { TheTechSavvyTeacherApp } from "../components/TheTechSavvyTeacherApp";

const worksheetOptions = [
  "Instructions",
  "Text Block",
  "Image",
  "Write Lines",
  "Word Bank",
  "Matching",
  "Multiple Choice",
  "True / False",
  "Short Answer",
  "Fill in Blank",
  "Essay Prompt",
  "Table / Chart",
  "Custom Shapes",
  "Success Criteria",
  "Exit Ticket",
  "DOK Questions",
  "Section Break",
];

function setViewport(width: number, height: number, pointer: "fine" | "coarse" = "fine") {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: height, configurable: true });
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches:
      query.includes("pointer: coarse") ? pointer === "coarse" :
      query.includes("max-width: 768px") ? width <= 768 :
      query.includes("max-width: 1024px") ? width <= 1024 :
      false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function openWorksheetBuilder() {
  render(<TheTechSavvyTeacherApp />);
  fireEvent.click(screen.getByRole("tab", { name: /worksheet builder/i }));
  return screen.getByRole("navigation", { name: /worksheet tools/i }) as HTMLElement;
}

describe("worksheet builder responsive sidebar", () => {
  beforeEach(() => {
    setViewport(1440, 900);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("keeps the left sidebar independently scrollable on desktop/Mac-sized screens", () => {
    const sidebar = openWorksheetBuilder();

    expect(sidebar.style.overflowY).toBe("auto");
    expect(sidebar.style.maxHeight).toBe("100%");
    expect(sidebar.style.minHeight).toBe("0");
    expect(sidebar.style.overscrollBehavior).toBe("contain");

    Object.defineProperty(sidebar, "clientHeight", { value: 360, configurable: true });
    Object.defineProperty(sidebar, "scrollHeight", { value: 920, configurable: true });
    sidebar.scrollTop = sidebar.scrollHeight - sidebar.clientHeight;
    fireEvent.scroll(sidebar);

    expect(sidebar.scrollTop).toBe(560);
    expect(within(sidebar).getByRole("button", { name: /add section break element/i })).toBeTruthy();
  });

  it("keeps every worksheet section and option reachable in the mobile stacked layout", () => {
    setViewport(390, 844, "coarse");
    const sidebar = openWorksheetBuilder();

    expect(within(sidebar).getByRole("button", { name: /browse ny state standards/i })).toBeTruthy();
    expect(within(sidebar).getByLabelText(/upload reference worksheet/i)).toBeTruthy();
    expect(within(sidebar).getByLabelText(/upload worksheet file to recreate/i)).toBeTruthy();

    for (const option of worksheetOptions) {
      const button = within(sidebar).getByRole("listitem", { name: new RegExp(`add ${option} element`, "i") });
      button.focus();
      expect(document.activeElement).toBe(button);
    }

    const css = Array.from(document.querySelectorAll("style")).map((style) => style.textContent || "").join("\n");
    expect(css).toContain("@media (max-width: 768px)");
    expect(css).toContain(".ws-body { flex-direction: column !important; overflow: visible !important; height: auto !important; }");
    expect(css).toContain(".ws-sidebar-left, .ws-sidebar-right");
    expect(css).toContain("overflow: visible !important");
  });
});