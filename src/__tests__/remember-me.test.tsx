import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import React from "react";

// --- Mock the Supabase client used by useAuth ---
const mocks = vi.hoisted(() => {
  return {
    signOut: vi.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
    getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }),
      }),
    })),
  };
});
const { signOut, onAuthStateChange, getSession } = mocks;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signOut: mocks.signOut,
      onAuthStateChange: mocks.onAuthStateChange,
      getSession: mocks.getSession,
    },
    from: mocks.from,
  },
}));

// Imported after the mock is registered
import { AuthProvider } from "@/hooks/useAuth";

function Harness() {
  return <div data-testid="ok">ok</div>;
}

describe("Remember-me end-to-end behavior", () => {
  beforeEach(() => {
    signOut.mockClear();
    onAuthStateChange.mockClear();
    getSession.mockClear();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("signs the user out when 'Remember me' was unchecked and the tab is reopened", async () => {
    // Simulate a previous sign-in where Remember-me was UNCHECKED:
    // AuthPage writes the session-only flag to localStorage and an alive marker
    // to sessionStorage.
    localStorage.setItem("tst-session-only", "1");
    // Simulate the tab being closed and reopened: sessionStorage is cleared
    // automatically by the browser. We mirror that by NOT setting the alive
    // marker before mounting the provider.

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );

    // useAuth's mount effect should detect the missing alive marker and sign
    // the user out, clearing the session-only flag.
    await waitFor(() => {
      expect(signOut).toHaveBeenCalledTimes(1);
    });
    expect(localStorage.getItem("tst-session-only")).toBeNull();
  });

  it("keeps the user signed in across tab reopens when 'Remember me' was checked", async () => {
    // No session-only flag was ever written → behave as a normal persistent session.
    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );

    // Give the mount effect a tick to run.
    await waitFor(() => expect(getSession).toHaveBeenCalled());
    expect(signOut).not.toHaveBeenCalled();
  });

  it("preserves the session within the same tab across re-renders when Remember-me was unchecked", async () => {
    // First mount in the tab: session-only flag is set, alive marker is missing.
    localStorage.setItem("tst-session-only", "1");

    const { unmount } = render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));

    // Simulate a fresh sign-in inside the same tab restoring both markers.
    signOut.mockClear();
    localStorage.setItem("tst-session-only", "1");
    sessionStorage.setItem("tst-session-alive", "1");
    unmount();

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );
    // Same tab → alive marker is present → must NOT sign out.
    await waitFor(() => expect(getSession).toHaveBeenCalled());
    expect(signOut).not.toHaveBeenCalled();
  });
});
