// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AuthGate — idle warning with REAL timers
//
// The main idle test drives virtual time. This one exercises the same code
// path with real wall-clock timers by shrinking the idle window through the
// local-only override (`tts.idleTimeoutMs.test`), which the component honours
// on localhost only. That closes the loop the fake-timer test cannot: the
// warning really does appear on its own, and the sign-out really does fire.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

const authState = {
  user: { id: "u1", email: "user@example.com" } as { id: string; email: string } | null,
  loading: false,
};

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => authState }));
vi.mock("@/components/AuthPage", () => ({ AuthPage: () => <div data-testid="auth-page" /> }));
vi.mock("@/lib/tracking", () => ({
  startTrackingSession: vi.fn(),
  endTrackingSession: vi.fn(),
}));

const signOutMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { signOut: (...args: unknown[]) => signOutMock(...args) } },
}));

const toastInfoMock = vi.fn();
vi.mock("sonner", () => ({ toast: { info: (...args: unknown[]) => toastInfoMock(...args) } }));

import { AuthGate } from "@/components/AuthGate";

beforeEach(() => {
  signOutMock.mockReset();
  toastInfoMock.mockReset();
  authState.user = { id: "u1", email: "user@example.com" };
  authState.loading = false;
  window.localStorage.setItem("tts.idleTimeoutMs.test", "900"); // warn at 600ms, out at 900ms
});

afterEach(() => {
  window.localStorage.removeItem("tts.idleTimeoutMs.test");
  cleanup();
});

describe("AuthGate idle warning (real timers)", () => {
  it("shows the warning on its own and signs the user out if ignored", async () => {
    render(
      <AuthGate>
        <div>app</div>
      </AuthGate>,
    );

    expect(screen.queryByRole("alertdialog")).toBeNull();

    await waitFor(() => expect(screen.getByRole("alertdialog")).toBeTruthy(), { timeout: 3000 });
    expect(screen.getByText(/Still there\?/i)).toBeTruthy();

    await waitFor(() => expect(signOutMock).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(toastInfoMock).toHaveBeenCalled();
  });

  it("cancels the pending sign-out when the user chooses to stay", async () => {
    render(
      <AuthGate>
        <div>app</div>
      </AuthGate>,
    );

    await waitFor(() => expect(screen.getByRole("alertdialog")).toBeTruthy(), { timeout: 3000 });
    fireEvent.click(screen.getByText(/Stay signed in/i));

    expect(screen.queryByRole("alertdialog")).toBeNull();
    await new Promise((r) => setTimeout(r, 400));
    expect(signOutMock).not.toHaveBeenCalled();
  });
});
