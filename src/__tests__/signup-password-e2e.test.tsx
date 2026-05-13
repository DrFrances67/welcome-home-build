import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import React from "react";

// --- Mock the Supabase client used by AuthPage ---
const mocks = vi.hoisted(() => ({
  signUp: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } }, error: null }),
  signInWithPassword: vi.fn(),
  resend: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signUp: mocks.signUp,
      signInWithPassword: mocks.signInWithPassword,
      resend: mocks.resend,
      resetPasswordForEmail: mocks.resetPasswordForEmail,
    },
    rpc: mocks.rpc,
  },
}));

import { AuthPage } from "../components/AuthPage";

// scrollIntoView isn't implemented in happy-dom; spy on it.
const scrollSpy = vi.fn();
beforeEach(() => {
  mocks.signUp.mockClear();
  scrollSpy.mockClear();
  (Element.prototype as unknown as { scrollIntoView: typeof scrollSpy }).scrollIntoView = scrollSpy;
});
afterEach(() => cleanup());

function setInput(label: RegExp, value: string) {
  const el = screen.getByText(label).parentElement!.querySelector("input")!;
  fireEvent.change(el, { target: { value } });
}

async function gotoSignup() {
  fireEvent.click(screen.getByText(/create account/i));
}

describe("Sign-up flow: live checklist + weak-password highlight (E2E)", () => {
  it("updates the checklist to Good as the user types and allows submission", async () => {
    render(<AuthPage />);
    await gotoSignup();

    setInput(/full name/i, "Jane Teacher");
    setInput(/^username$/i, "janet");
    setInput(/^email$/i, "jane@example.com");

    // Type a weak password first → checklist should NOT show Good.
    setInput(/^password$/i, "abcdefghij");
    expect(screen.getByTestId("pw-requirements").textContent).not.toMatch(/Good or better/);
    expect(screen.getByTestId("pw-req-upper").getAttribute("data-met")).toBe("false");

    // Now type a Good password → checklist switches to "Good or better".
    setInput(/^password$/i, "Abcdef1!xyzQ");
    expect(screen.getByTestId("pw-requirements").textContent).toMatch(/Good or better/);
    for (const id of ["len10", "len12", "lower", "upper", "number", "symbol"]) {
      expect(screen.getByTestId(`pw-req-${id}`).getAttribute("data-met")).toBe("true");
    }

    // Accept the privacy notice and submit.
    const agree = screen.getByText(/i have read and agree/i).parentElement!.querySelector("input")!;
    fireEvent.click(agree);
    await act(async () => {
      fireEvent.click(screen.getByText(/^create account$/i));
    });

    expect(mocks.signUp).toHaveBeenCalledTimes(1);
    expect(mocks.signUp.mock.calls[0][0]).toMatchObject({
      email: "jane@example.com",
      password: "Abcdef1!xyzQ",
    });
  });

  it("highlights failing checklist items and scrolls to the checklist after a weak attempt", async () => {
    render(<AuthPage />);
    await gotoSignup();

    setInput(/full name/i, "Jane Teacher");
    setInput(/^username$/i, "janet");
    setInput(/^email$/i, "jane@example.com");
    setInput(/^password$/i, "abcdefghij"); // valid by schema, but Weak

    const agree = screen.getByText(/i have read and agree/i).parentElement!.querySelector("input")!;
    fireEvent.click(agree);

    await act(async () => {
      fireEvent.click(screen.getByText(/^create account$/i));
    });

    // signUp was NOT called — the weak guard fired.
    expect(mocks.signUp).not.toHaveBeenCalled();

    // Checklist switched into failing state.
    const region = screen.getByTestId("pw-requirements");
    expect(region.getAttribute("data-failing")).toBe("true");
    expect(region.textContent).toMatch(/Fix these to reach Good/i);

    // Each unmet requirement is flagged as failed.
    const upper = screen.getByTestId("pw-req-upper");
    expect(upper.getAttribute("data-failed")).toBe("true");
    expect(upper.textContent).toMatch(/missing/i);
    const symbol = screen.getByTestId("pw-req-symbol");
    expect(symbol.getAttribute("data-failed")).toBe("true");
    // Met items stay met (lowercase + len10).
    expect(screen.getByTestId("pw-req-lower").getAttribute("data-met")).toBe("true");
    expect(screen.getByTestId("pw-req-lower").getAttribute("data-failed")).toBe("false");

    // The checklist was scrolled into view.
    expect(scrollSpy).toHaveBeenCalled();

    // Fixing the password clears the failing state and allows submission.
    setInput(/^password$/i, "Abcdef1!xyzQ");
    expect(screen.getByTestId("pw-requirements").getAttribute("data-failing")).toBe("false");

    await act(async () => {
      fireEvent.click(screen.getByText(/^create account$/i));
    });
    expect(mocks.signUp).toHaveBeenCalledTimes(1);
  });
});
