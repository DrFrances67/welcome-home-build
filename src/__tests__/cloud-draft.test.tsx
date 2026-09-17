import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

/**
 * Tests for the shared cloud-draft engine now used by BOTH the worksheet
 * builder and the lesson plan generator. The worksheet-specific idle
 * regression lives in worksheet-cloud-draft-idle.test.tsx; this suite covers
 * the engine's contract directly: debounce, per-user isolation, recovery from
 * a deleted row, conflict detection and force-overwrite.
 */

vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));

let currentUser: { id: string } | null = { id: "user-1" };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: currentUser }) }));

import { useCloudDraft } from "@/hooks/useCloudDraft";

const DEBOUNCE = 5000;
const isConflict = (e: unknown) => e instanceof Error && e.message.startsWith("TEST_CONFLICT");

function setup(opts: {
  data?: Record<string, unknown>;
  save: ReturnType<typeof vi.fn>;
  load?: ReturnType<typeof vi.fn>;
  prefix?: string;
}) {
  return renderHook(
    ({ data }: { data: Record<string, unknown> }) =>
      useCloudDraft<Record<string, unknown>>({
        data,
        title: "Doc",
        isEmpty: (d) => Object.keys(d).length === 0,
        isConflict,
        storagePrefix: opts.prefix ?? "test.draft",
        debounceMs: DEBOUNCE,
        missingPattern: /not found/i,
        save: opts.save as never,
        load: (opts.load ?? vi.fn()) as never,
      }),
    { initialProps: { data: opts.data ?? { a: 1 } } },
  );
}

describe("useCloudDraft", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    currentUser = { id: "user-1" };
  });
  afterEach(() => vi.useRealTimers());

  it("auto-saves once after the debounce and remembers the row per user", async () => {
    const save = vi.fn().mockResolvedValue({ id: "doc-1", current: { version_no: 1 } });
    const { result } = setup({ save });

    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE + 50);
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(result.current.documentId).toBe("doc-1");
    expect(window.localStorage.getItem("test.draft:user-1")).toBe("doc-1");
  });

  it("never reuses another account's row", async () => {
    window.localStorage.setItem("test.draft:user-2", "doc-of-other-teacher");
    const save = vi.fn().mockResolvedValue({ id: "doc-1", current: { version_no: 1 } });
    setup({ save });

    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE + 50);
    });

    expect((save.mock.calls[0][0] as { id?: string }).id).toBeUndefined();
  });

  it("starts a fresh row when the remembered one was deleted", async () => {
    window.localStorage.setItem("test.draft:user-1", "gone-doc");
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("Worksheet not found"))
      .mockResolvedValue({ id: "doc-2", current: { version_no: 1 } });
    const { result } = setup({ save });

    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE + 50);
    });

    expect(save).toHaveBeenCalledTimes(2);
    expect((save.mock.calls[1][0] as { id?: string }).id).toBeUndefined();
    expect(result.current.documentId).toBe("doc-2");
  });

  it("surfaces a conflict and pauses auto-saving until it is resolved", async () => {
    const save = vi.fn().mockRejectedValue(new Error("TEST_CONFLICT: newer version"));
    const { result, rerender } = setup({ save });

    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE + 50);
    });
    expect(result.current.conflict).toMatch(/newer version/i);

    rerender({ data: { a: 2 } });
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE * 3);
    });
    expect(save).toHaveBeenCalledTimes(1); // paused
  });

  it("force-saving after a conflict drops the version guard and overwrites", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("TEST_CONFLICT: newer version"))
      .mockResolvedValue({ id: "doc-1", current: { version_no: 9 } });
    const { result } = setup({ save });

    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE + 50);
    });
    expect(result.current.conflict).not.toBeNull();

    await act(async () => {
      await result.current.save("draft", { force: true });
    });

    expect(
      (save.mock.calls[1][0] as { expectedVersionNo?: number }).expectedVersionNo,
    ).toBeUndefined();
    expect(result.current.conflict).toBeNull();
  });

  it("pull() returns the newest server version and clears the conflict", async () => {
    window.localStorage.setItem("test.draft:user-1", "doc-1");
    const save = vi.fn().mockRejectedValue(new Error("TEST_CONFLICT: newer version"));
    const load = vi.fn().mockResolvedValue({ current: { version_no: 4, form: { a: 42 } } });
    const { result } = setup({ save, load });

    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE + 50);
    });
    expect(result.current.conflict).not.toBeNull();

    let pulled: unknown;
    await act(async () => {
      pulled = await result.current.pull();
    });

    expect(pulled).toEqual({ version_no: 4, form: { a: 42 } });
    expect(result.current.conflict).toBeNull();
  });

  it("does nothing while signed out", async () => {
    currentUser = null;
    const save = vi.fn();
    setup({ save });
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE * 3);
    });
    expect(save).not.toHaveBeenCalled();
  });
});
