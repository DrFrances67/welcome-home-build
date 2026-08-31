import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

/**
 * Regression: a worksheet left open with no user edits must not keep creating
 * new `worksheet_versions` rows every debounce tick. Historically each
 * successful save bumped state that re-armed the auto-save timer, so an idle
 * page generated thousands of junk versions.
 */

const saveSpy = vi.fn();
const getSpy = vi.fn();

vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: unknown) => fn,
}));

vi.mock("@/lib/worksheets.functions", () => ({
  saveWorksheet: (args: { data: unknown }) => saveSpy(args),
  getWorksheet: (args: { data: unknown }) => getSpy(args),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

import { useWorksheetCloudDraft } from "@/hooks/useWorksheetCloudDraft";

const DEBOUNCE = 5000;

describe("worksheet cloud draft — idle page", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    let version = 0;
    saveSpy.mockReset();
    saveSpy.mockImplementation(async () => {
      version += 1;
      return { id: "ws-1", current: { id: `v${version}`, version_no: version } };
    });
    getSpy.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setup(initial: Record<string, unknown>) {
    return renderHook(
      ({ data }: { data: Record<string, unknown> }) =>
        useWorksheetCloudDraft({
          data,
          title: "My worksheet",
          isEmpty: (d) => Object.keys(d).length === 0,
          debounceMs: DEBOUNCE,
        }),
      { initialProps: { data: initial } },
    );
  }

  it("saves once for a change, then stops while the page sits idle", async () => {
    const { rerender } = setup({ items: ["a"] });

    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE + 50);
    });
    expect(saveSpy).toHaveBeenCalledTimes(1);

    // Idle for a long time with re-renders but no content changes.
    for (let i = 0; i < 12; i++) {
      rerender({ data: { items: ["a"] } });
      await act(async () => {
        vi.advanceTimersByTime(DEBOUNCE + 50);
      });
    }

    expect(saveSpy).toHaveBeenCalledTimes(1);
  });

  it("still saves exactly one new version per real edit", async () => {
    const { rerender } = setup({ items: ["a"] });

    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE + 50);
    });
    expect(saveSpy).toHaveBeenCalledTimes(1);

    rerender({ data: { items: ["a", "b"] } });
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE + 50);
    });
    expect(saveSpy).toHaveBeenCalledTimes(2);

    // Idle again — no further versions.
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE * 5);
    });
    expect(saveSpy).toHaveBeenCalledTimes(2);

    // The second save carried the version observed after the first one.
    const second = saveSpy.mock.calls[1][0] as { data: { expectedVersionNo?: number } };
    expect(second.data.expectedVersionNo).toBe(1);
  });

  it("does not save at all while the worksheet is still empty", async () => {
    setup({});
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE * 4);
    });
    expect(saveSpy).not.toHaveBeenCalled();
  });
});
