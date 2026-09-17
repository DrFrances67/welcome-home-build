import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act, cleanup } from "@testing-library/react";

/**
 * Coverage for the Lesson Plan Generator's account-saving surface: explicit
 * saves, the browser draft, and conflict recovery ("Load newest" / "Keep
 * mine"). The AI calls and server functions are stubbed so the test exercises
 * the component's own logic only.
 */

const saveSpy = vi.fn();
const getSpy = vi.fn();

vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));

vi.mock("@/lib/lesson-plans.functions", () => ({
  saveLessonPlan: (args: { data: unknown }) => saveSpy(args),
  getLessonPlan: (args: { data: unknown }) => getSpy(args),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-1" }, session: null, loading: false }),
}));

vi.mock("@/lib/aiFetch", () => ({
  callAiRaw: vi.fn().mockResolvedValue("{}"),
  generateImage: vi.fn().mockResolvedValue(null),
}));

import { LessonPlanGenerator } from "@/components/teacher/LessonPlanGenerator";

const LP_DRAFT_KEY = "tts.lessonPlanDraft.v1";

function typeTopic(value: string) {
  const topic = screen.getByLabelText("Lesson Topic / Title");
  fireEvent.change(topic, { target: { value } });
  return topic;
}

describe("LessonPlanGenerator — saving to the account", () => {
  beforeEach(() => {
    window.localStorage.clear();
    saveSpy.mockReset();
    getSpy.mockReset();
    saveSpy.mockResolvedValue({ id: "plan-1", current: { version_no: 1 } });
  });

  afterEach(() => cleanup());

  it("restores the in-progress plan from the browser draft", () => {
    window.localStorage.setItem(
      LP_DRAFT_KEY,
      JSON.stringify({ topic: "Water cycle", subject: "Science", diff: [] }),
    );
    render(<LessonPlanGenerator />);
    expect(screen.getByDisplayValue("Water cycle")).toBeTruthy();
  });

  it("'Save draft' writes a version to the account and confirms it", async () => {
    render(<LessonPlanGenerator />);
    typeTopic("Fractions");

    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));

    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));
    const payload = (saveSpy.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(payload.status).toBe("draft");
    expect(payload.title).toBe("Fractions");
    expect(await screen.findByText(/saved to your account/i)).toBeTruthy();
  });

  it("'Save to account' saves with the saved status", async () => {
    render(<LessonPlanGenerator />);
    typeTopic("Photosynthesis");

    fireEvent.click(screen.getByRole("button", { name: /save to account/i }));

    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));
    expect((saveSpy.mock.calls[0][0] as { data: { status: string } }).data.status).toBe("saved");
  });

  it("shows a conflict warning with recovery choices when another device saved first", async () => {
    saveSpy.mockRejectedValueOnce(new Error("LESSON_PLAN_CONFLICT: newer version exists"));
    render(<LessonPlanGenerator />);
    typeTopic("Volcanoes");

    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));

    expect(await screen.findByText(/newer version of this lesson plan/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /load newest/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /keep mine/i })).toBeTruthy();
  });

  it("'Keep mine' overwrites the server copy without the version guard", async () => {
    saveSpy.mockRejectedValueOnce(new Error("LESSON_PLAN_CONFLICT: newer version exists"));
    render(<LessonPlanGenerator />);
    typeTopic("Weather");

    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    const keepMine = await screen.findByRole("button", { name: /keep mine/i });

    await act(async () => {
      fireEvent.click(keepMine);
    });

    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(2));
    const second = (saveSpy.mock.calls[1][0] as { data: { expectedVersionNo?: number } }).data;
    expect(second.expectedVersionNo).toBeUndefined();
  });

  it("'Load newest' replaces the form with the newest saved version", async () => {
    saveSpy.mockResolvedValueOnce({ id: "plan-1", current: { version_no: 1 } });
    getSpy.mockResolvedValue({
      current: { version_no: 7, form: { topic: "Server topic", subject: "Math", diff: [] } },
    });
    render(<LessonPlanGenerator />);
    typeTopic("Local topic");

    // First save establishes the account row, then force a conflict.
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));

    saveSpy.mockRejectedValueOnce(new Error("LESSON_PLAN_CONFLICT: newer version exists"));
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    const loadNewest = await screen.findByRole("button", { name: /load newest/i });

    await act(async () => {
      fireEvent.click(loadNewest);
    });

    await waitFor(() => expect(screen.getByDisplayValue("Server topic")).toBeTruthy());
  });
});
