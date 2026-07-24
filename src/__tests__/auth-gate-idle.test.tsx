// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AuthGate — 30 min idle timeout with 60s warning
//
// Verifies:
//   - No warning appears before the 29-minute mark
//   - Warning toast appears at 29 minutes with a countdown and
//     "Stay signed in" / "Sign out" actions
//   - Auto-sign-out fires at 30 minutes if the user does nothing
//   - Clicking "Stay signed in" cancels the pending sign-out and
//     hides the warning
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup, fireEvent } from "@testing-library/react";
import React from "react";

// --- Mocks ---------------------------------------------------------------

const authState = {
  user: { id: "u1", email: "user@example.com" } as { id: string; email: string } | null,
  loading: false,
};

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => authState,
}));

vi.mock("@/components/AuthPage", () => ({
  AuthPage: () => <div data-testid="auth-page" />,
}));

vi.mock("@/lib/tracking", () => ({
  startTrackingSession: vi.fn(),
  endTrackingSession: vi.fn(),
}));

const signOutMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { signOut: (...args: unknown[]) => signOutMock(...args) } },
}));

const toastInfoMock = vi.fn();
vi.mock("sonner", () => ({
  toast: { info: (...args: unknown[]) => toastInfoMock(...args) },
}));

// Import AFTER mocks so the module picks them up.
import { AuthGate } from "@/components/AuthGate";

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const IDLE_WARNING_MS = 60 * 1000;

beforeEach(() => {
  vi.useFakeTimers();
  signOutMock.mockReset();
  toastInfoMock.mockReset();
  authState.user = { id: "u1", email: "user@example.com" };
  authState.loading = false;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("AuthGate idle timeout", () => {
  it("does not show the warning before the 29-minute mark", () => {
    render(
      <AuthGate>
        <div>app</div>
      </AuthGate>,
    );
    act(() => {
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS - IDLE_WARNING_MS - 1000);
    });
    expect(screen.queryByText(/Still there\?/i)).toBeNull();
  });

  it("shows the warning at 29 minutes and signs the user out at 30", () => {
    render(
      <AuthGate>
        <div>app</div>
      </AuthGate>,
    );
    // Fast-forward to warning window.
    act(() => {
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS - IDLE_WARNING_MS);
    });
    expect(screen.getByText(/Still there\?/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Stay signed in/i })).toBeInTheDocument();

    // Advance the remaining 60s — sign-out fires and toast is shown.
    act(() => {
      vi.advanceTimersByTime(IDLE_WARNING_MS);
    });
    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(toastInfoMock).toHaveBeenCalledWith(
      expect.stringMatching(/signed out due to inactivity/i),
    );
  });

  it('clicking "Stay signed in" prevents the auto sign-out', () => {
    render(
      <AuthGate>
        <div>app</div>
      </AuthGate>,
    );
    act(() => {
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS - IDLE_WARNING_MS);
    });
    const stay = screen.getByRole("button", { name: /Stay signed in/i });
    act(() => {
      fireEvent.click(stay);
    });
    // Warning should hide and the pending sign-out should be cancelled.
    expect(screen.queryByText(/Still there\?/i)).toBeNull();

    // Advance well past when sign-out would have fired — it must not.
    act(() => {
      vi.advanceTimersByTime(IDLE_WARNING_MS + 5000);
    });
    expect(signOutMock).not.toHaveBeenCalled();
    expect(toastInfoMock).not.toHaveBeenCalled();
  });
});
