import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TheTechSavvyTeacherApp } from "../components/TheTechSavvyTeacherApp";

/**
 * DOK horizontal-only resize: the per-level boxes inside a DOK Questions
 * element must keep their original tight spacing when the element is resized
 * horizontally. Previously, after a horizontal-only resize the level boxes
 * spread apart vertically because leftover heightOverride was being
 * distributed as gap (justify-content: space-around). Horizontal resize must
 * leave vertical spacing untouched.
 *
 * Also verifies the same property for Success Criteria and Exit Ticket which
 * share the same "distribute extra vertical space" code path.
 */

function setViewport(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: height, configurable: true });
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
}

function openBuilder() {
  render(<TheTechSavvyTeacherApp />);
  fireEvent.click(screen.getByRole("tab", { name: /worksheet builder/i }));
}

function getLastElement(): HTMLElement {
  const els = document.querySelectorAll<HTMLElement>(".ws-element");
  expect(els.length).toBeGreaterThan(0);
  return els[els.length - 1];
}

function addElement(label: RegExp): HTMLElement {
  fireEvent.click(screen.getByRole("listitem", { name: label }));
  const wrapper = getLastElement();
  fireEvent.click(wrapper);
  return getLastElement();
}

function getHandles(wrapper: HTMLElement) {
  const handles = wrapper.querySelectorAll<HTMLElement>("[data-resize-handle]");
  // Source order: bottom, top, right, left, corner
  return { bottom: handles[0], top: handles[1], right: handles[2], left: handles[3], corner: handles[4] };
}

async function dragHandle(handle: HTMLElement, dx: number, dy: number) {
  await act(async () => {
    fireEvent.pointerDown(handle, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { clientX: 100 + dx, clientY: 100 + dy });
    fireEvent.pointerUp(window, { clientX: 100 + dx, clientY: 100 + dy });
  });
}

/**
 * Returns the inline `gap` (px) of the flex column that lays out the per-level
 * boxes inside a DOK element, plus the `justify-content` of that column.
 */
function getDokLevelLayout(wrapper: HTMLElement): { gap: number; justify: string; rowCount: number } {
  // Structure: ws-element > outer card div > [title?][intro?][levelsContainer]
  const card = wrapper.querySelector<HTMLElement>(":scope > div");
  expect(card, "DOK card container").toBeTruthy();
  // The level container is a flex column with multiple child level boxes.
  const candidates = Array.from(card!.querySelectorAll<HTMLElement>(":scope > div"));
  const levelsContainer = candidates.find(d => d.style.flexDirection === "column" && d.children.length >= 2);
  expect(levelsContainer, "DOK levels flex container").toBeTruthy();
  const gapStr = levelsContainer!.style.gap || "0";
  const gap = parseFloat(gapStr);
  return {
    gap: isNaN(gap) ? 0 : gap,
    justify: levelsContainer!.style.justifyContent || "flex-start",
    rowCount: levelsContainer!.children.length,
  };
}

function getDokCard(wrapper: HTMLElement): HTMLElement {
  const card = wrapper.querySelector<HTMLElement>(":scope > div");
  expect(card, "DOK card container").toBeTruthy();
  return card!;
}

function getDokQuestionTextNodes(wrapper: HTMLElement): HTMLElement[] {
  const nodes = Array.from(wrapper.querySelectorAll<HTMLElement>("li span"))
    .filter(node => (node.textContent || "").trim().length > 0);
  expect(nodes.length, "DOK question text nodes").toBeGreaterThan(0);
  return nodes;
}

function getDokItemGaps(wrapper: HTMLElement): number[] {
  return Array.from(wrapper.querySelectorAll<HTMLElement>("ul"))
    .map(ul => parseFloat(ul.style.gap || "0"))
    .filter(Number.isFinite);
}

function getListLayout(wrapper: HTMLElement): { gap: number; justify: string } {
  const ul = wrapper.querySelector<HTMLElement>("ul");
  expect(ul, "list element").toBeTruthy();
  const gap = parseFloat(ul!.style.gap || "0");
  return { gap: isNaN(gap) ? 0 : gap, justify: ul!.style.justifyContent || "flex-start" };
}

describe("worksheet builder: horizontal-only resize keeps inner box spacing tight", () => {
  beforeEach(() => {
    (globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    setViewport(1440, 900);
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it("DOK Questions: horizontal-only resize does NOT spread the per-level boxes apart", async () => {
    openBuilder();
    const wrapper = addElement(/add dok questions element/i);

    const before = getDokLevelLayout(wrapper);
    expect(before.rowCount).toBeGreaterThanOrEqual(2);

    // Right-handle drag → horizontal-only resize.
    await dragHandle(getHandles(wrapper).right, 220, 0);
    const after = getDokLevelLayout(wrapper);

    // Spacing must stay essentially unchanged (allow a small tolerance for
    // the base scale factor) and must NOT switch to space-around.
    expect(after.justify).toBe("flex-start");
    expect(after.gap).toBeCloseTo(before.gap, 0);
    expect(after.gap).toBeLessThan(before.gap + 4);

    // Left-handle drag also horizontal-only — same expectation.
    await dragHandle(getHandles(wrapper).left, -120, 0);
    const after2 = getDokLevelLayout(wrapper);
    expect(after2.justify).toBe("flex-start");
    expect(after2.gap).toBeLessThan(before.gap + 4);
  });

  it("DOK Questions: vertical resize keeps spacing compact and content readable", async () => {
    openBuilder();
    const wrapper = addElement(/add dok questions element/i);
    const before = getDokLevelLayout(wrapper);

    await dragHandle(getHandles(wrapper).bottom, 0, 240);
    const after = getDokLevelLayout(wrapper);

    // Vertical resize must not distribute leftover height into huge gaps.
    expect(after.justify).toBe("flex-start");
    expect(after.gap).toBeLessThanOrEqual(before.gap + 4);

    const card = wrapper.querySelector<HTMLElement>(":scope > div");
    expect(card?.style.overflowY).toBe("auto");
    const questionText = Array.from(wrapper.querySelectorAll<HTMLElement>("span"))
      .find(node => node.textContent?.includes("?"));
    expect(questionText?.style.whiteSpace).toBe("normal");
    expect(questionText?.style.wordBreak).toBe("break-word");
  });

  it("DOK Questions: extreme narrow and wide resize keeps questions wrapped and gaps bounded", async () => {
    openBuilder();
    const wrapper = addElement(/add dok questions element/i);

    await dragHandle(getHandles(wrapper).right, -1200, 0);
    expect(wrapper.style.width).toBe("20%");
    let layout = getDokLevelLayout(wrapper);
    expect(layout.justify).toBe("flex-start");
    expect(layout.gap).toBeLessThanOrEqual(10);
    expect(Math.max(...getDokItemGaps(wrapper))).toBeLessThanOrEqual(6);
    for (const node of getDokQuestionTextNodes(wrapper)) {
      expect(node.style.whiteSpace).toBe("normal");
      expect(node.style.wordBreak).toBe("break-word");
      expect(node.style.overflow).toBe("visible");
    }

    await dragHandle(getHandles(wrapper).right, 2400, 0);
    expect(wrapper.style.width).toBe("100%");
    layout = getDokLevelLayout(wrapper);
    expect(layout.justify).toBe("flex-start");
    expect(layout.gap).toBeLessThanOrEqual(10);
    expect(Math.max(...getDokItemGaps(wrapper))).toBeLessThanOrEqual(6);
  });

  it("DOK Questions: extreme short and tall heights use scrolling instead of spreading levels", async () => {
    openBuilder();
    const wrapper = addElement(/add dok questions element/i);

    await dragHandle(getHandles(wrapper).bottom, 0, -1200);
    expect(wrapper.style.height).toBe("48px");
    expect(getDokCard(wrapper).style.overflowY).toBe("auto");
    let layout = getDokLevelLayout(wrapper);
    expect(layout.justify).toBe("flex-start");
    expect(layout.gap).toBeLessThanOrEqual(10);

    await dragHandle(getHandles(wrapper).bottom, 0, 1200);
    expect(getDokCard(wrapper).style.overflowY).toBe("auto");
    layout = getDokLevelLayout(wrapper);
    expect(layout.justify).toBe("flex-start");
    expect(layout.gap).toBeLessThanOrEqual(10);
    expect(Math.max(...getDokItemGaps(wrapper))).toBeLessThanOrEqual(6);
  });

  it("DOK Questions: multi-line and long questions remain visible after extreme resizing", async () => {
    openBuilder();
    const wrapper = addElement(/add dok questions element/i);

    fireEvent.change(screen.getByLabelText(/DOK Level 1 questions/i), {
      target: {
        value: [
          "What details from the text help you identify the main character, setting, and problem in complete sentences?",
          "Which evidence would you underline, circle, or annotate to prove your answer when explaining your thinking?",
        ].join("\n"),
      },
    });

    await dragHandle(getHandles(wrapper).corner, -1200, -1200);

    const rendered = getDokQuestionTextNodes(wrapper).map(node => node.textContent || "").join(" ");
    expect(rendered).toContain("What details from the text");
    expect(rendered).toContain("Which evidence would you underline");
    expect(getDokCard(wrapper).style.overflowY).toBe("auto");
    expect(getDokLevelLayout(wrapper).justify).toBe("flex-start");
    for (const node of getDokQuestionTextNodes(wrapper)) {
      expect(node.style.whiteSpace).toBe("normal");
      expect(node.style.textOverflow).not.toBe("ellipsis");
      expect(node.style.wordBreak).toBe("break-word");
    }
  });

  it("Success Criteria: horizontal-only resize keeps list item gap tight", async () => {
    openBuilder();
    const wrapper = addElement(/add success criteria element/i);
    const before = getListLayout(wrapper);

    await dragHandle(getHandles(wrapper).right, 220, 0);
    const after = getListLayout(wrapper);

    expect(after.justify).toBe("flex-start");
    expect(after.gap).toBeLessThan(before.gap + 4);
  });

  it("Exit Ticket: horizontal-only resize keeps list item gap tight", async () => {
    openBuilder();
    const wrapper = addElement(/add exit ticket element/i);
    const before = getListLayout(wrapper);

    await dragHandle(getHandles(wrapper).right, 220, 0);
    const after = getListLayout(wrapper);

    expect(after.justify).toBe("flex-start");
    expect(after.gap).toBeLessThan(before.gap + 4);
  });
});
