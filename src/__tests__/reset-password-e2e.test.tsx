import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act, waitFor } from "@testing-library/react";
import React from "react";

// --- Mock the Supabase client used by the reset-password route ---
// A single onAuthStateChange listener is captured so tests can emit events.
const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  setSession: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
  updateUser: vi.fn().mockResolvedValue({ error: null }),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      setSession: mocks.setSession,
      exchangeCodeForSession: mocks.exchangeCodeForSession,
      verifyOtp: mocks.verifyOtp,
      updateUser: mocks.updateUser,
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
    },
  },
}));

// Mock the router so the route file's createFileRoute call works in isolation.
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: (_path: string) => (config: { component: React.ComponentType }) => ({
    options: config,
  }),
  useNavigate: () => mocks.navigate,
}));

// Import AFTER mocks are registered.
import { Route } from "../routes/reset-password";

const ResetPasswordPage = (Route as unknown as { options: { component: React.ComponentType } })
  .options.component;

const FAKE_SESSION = { access_token: "a", refresh_token: "r", user: { id: "u1" } };

function setRecoveryUrl(hashOrQuery: string) {
  window.history.replaceState({}, "", `/reset-password${hashOrQuery}`);
}

function getPasswordInput() {
  return document.querySelector('input[type="password"]') as HTMLInputElement;
}

beforeEach(() => {
  mocks.navigate.mockClear();
  mocks.setSession.mockClear().mockResolvedValue({ error: null });
  mocks.exchangeCodeForSession.mockClear().mockResolvedValue({ error: null });
  mocks.verifyOtp.mockClear().mockResolvedValue({ error: null });
  mocks.updateUser.mockClear().mockResolvedValue({ error: null });
  mocks.getSession.mockClear().mockResolvedValue({ data: { session: FAKE_SESSION } });
  mocks.onAuthStateChange.mockClear().mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
});
afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});

describe("Forgot-password → set new password (E2E)", () => {
  it("implicit link (#access_token): establishes session, then updates password with no missing-session error", async () => {
    setRecoveryUrl("#access_token=abc&refresh_token=def&type=recovery");

    await act(async () => {
      render(<ResetPasswordPage />);
    });

    // The recovery tokens are exchanged for a session.
    await waitFor(() => expect(mocks.setSession).toHaveBeenCalledTimes(1));
    expect(mocks.setSession.mock.calls[0][0]).toMatchObject({
      access_token: "abc",
      refresh_token: "def",
    });

    // The input becomes enabled once the session is ready.
    await waitFor(() => expect(getPasswordInput().disabled).toBe(false));

    // No missing-session / invalid-link error is shown.
    expect(screen.queryByText(/session missing/i)).toBeNull();
    expect(screen.queryByText(/invalid or has expired/i)).toBeNull();

    // Set a new password and submit.
    fireEvent.change(getPasswordInput(), { target: { value: "BrandNewPass123!" } });
    await act(async () => {
      fireEvent.click(screen.getByText(/update password/i));
    });

    // Password is updated and the user is redirected home — no error surfaced.
    expect(mocks.updateUser).toHaveBeenCalledTimes(1);
    expect(mocks.updateUser.mock.calls[0][0]).toMatchObject({ password: "BrandNewPass123!" });
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: "/" }));
    expect(screen.queryByText(/session missing/i)).toBeNull();
  });

  it("PKCE link (?code=): exchanges the code for a session before allowing an update", async () => {
    setRecoveryUrl("?code=pkce-code-123");

    await act(async () => {
      render(<ResetPasswordPage />);
    });

    await waitFor(() => expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("pkce-code-123"));
    await waitFor(() => expect(getPasswordInput().disabled).toBe(false));

    fireEvent.change(getPasswordInput(), { target: { value: "AnotherPass456!" } });
    await act(async () => {
      fireEvent.click(screen.getByText(/update password/i));
    });

    expect(mocks.updateUser).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: "/" }));
  });

  it("token_hash link (?token_hash=): verifies the OTP before allowing an update", async () => {
    setRecoveryUrl("?token_hash=hash-xyz&type=recovery");

    await act(async () => {
      render(<ResetPasswordPage />);
    });

    await waitFor(() =>
      expect(mocks.verifyOtp).toHaveBeenCalledWith({ token_hash: "hash-xyz", type: "recovery" }),
    );
    await waitFor(() => expect(getPasswordInput().disabled).toBe(false));

    fireEvent.change(getPasswordInput(), { target: { value: "OneMorePass789!" } });
    await act(async () => {
      fireEvent.click(screen.getByText(/update password/i));
    });

    expect(mocks.updateUser).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: "/" }));
  });

  it("expired/invalid link: shows an error and never lets the user submit without a session", async () => {
    // No tokens in the URL and no session comes back.
    setRecoveryUrl("");
    mocks.getSession.mockResolvedValue({ data: { session: null } });

    await act(async () => {
      render(<ResetPasswordPage />);
    });

    await waitFor(() =>
      expect(screen.getByText(/invalid or has expired/i)).toBeInTheDocument(),
    );

    // Input stays disabled and no password update is attempted.
    expect(getPasswordInput().disabled).toBe(true);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
});
