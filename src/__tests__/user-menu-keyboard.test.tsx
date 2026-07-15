// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UserMenu — keyboard navigation, focus trap, ARIA
//
// Verifies the account dropdown's a11y contract:
//   - trigger has correct aria-haspopup / aria-expanded / aria-controls
//   - Enter / Space / ArrowDown open the menu focused on the first item
//   - ArrowUp opens focused on the last item
//   - Arrow keys cycle items; Home/End jump to endpoints
//   - Tab / Shift+Tab cycle within items (focus trap)
//   - Escape closes and restores focus to the trigger
//   - Outside click closes without stealing focus
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import React from "react";

// --- Mocks ---------------------------------------------------------------

const authState = {
  user: { id: "u1", email: "user@example.com" } as { id: string; email: string } | null,
  profile: { username: "alice" } as { username: string } | null,
  isAdmin: false,
  signOut: vi.fn(),
  loading: false,
};

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => authState,
}));

// Stub Link as a plain <a> so we can render outside a router.
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    ...rest
  }: React.PropsWithChildren<
    { to: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>
  >) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

// Import AFTER mocks.
import { UserMenu } from "../components/UserMenu";

// --- Helpers -------------------------------------------------------------

function openMenuWith(key: "Enter" | " " | "ArrowDown" | "ArrowUp") {
  const trigger = screen.getByRole("button", { name: /account menu/i });
  act(() => trigger.focus());
  fireEvent.keyDown(trigger, { key });
  return trigger;
}

function getItems() {
  return screen.getAllByRole("menuitem") as HTMLElement[];
}

// --- Tests ---------------------------------------------------------------

describe("UserMenu — signed in", () => {
  beforeEach(() => {
    authState.user = { id: "u1", email: "user@example.com" };
    authState.profile = { username: "alice" };
    authState.isAdmin = false;
    authState.loading = false;
  });
  afterEach(() => cleanup());

  it("trigger exposes correct ARIA attributes", () => {
    render(<UserMenu />);
    const trigger = screen.getByRole("button", { name: /account menu/i });
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.getAttribute("aria-controls")).toBeTruthy();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("Enter opens the menu focused on the first item", () => {
    render(<UserMenu />);
    const trigger = openMenuWith("Enter");
    const menu = screen.getByRole("menu");
    expect(menu.getAttribute("aria-orientation")).toBe("vertical");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const items = getItems();
    expect(items).toHaveLength(2);
    expect(document.activeElement).toBe(items[0]);
    expect(items[0].getAttribute("tabindex")).toBe("0");
    expect(items[1].getAttribute("tabindex")).toBe("-1");
  });

  it("Space opens the menu focused on the first item", () => {
    render(<UserMenu />);
    openMenuWith(" ");
    expect(document.activeElement).toBe(getItems()[0]);
  });

  it("ArrowDown from the trigger opens focused on the first item", () => {
    render(<UserMenu />);
    openMenuWith("ArrowDown");
    expect(document.activeElement).toBe(getItems()[0]);
  });

  it("ArrowUp from the trigger opens focused on the last item", () => {
    render(<UserMenu />);
    openMenuWith("ArrowUp");
    const items = getItems();
    expect(document.activeElement).toBe(items[items.length - 1]);
  });

  it("ArrowDown / ArrowUp cycle items within the menu", () => {
    render(<UserMenu />);
    openMenuWith("Enter");
    const menu = screen.getByRole("menu");
    const items = getItems();
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[1]);
    // wraps forward
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[0]);
    // wraps backward
    fireEvent.keyDown(menu, { key: "ArrowUp" });
    expect(document.activeElement).toBe(items[1]);
  });

  it("Home / End jump to first / last item", () => {
    render(<UserMenu />);
    openMenuWith("ArrowUp"); // starts on last
    const menu = screen.getByRole("menu");
    const items = getItems();
    fireEvent.keyDown(menu, { key: "Home" });
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(menu, { key: "End" });
    expect(document.activeElement).toBe(items[items.length - 1]);
  });

  it("Tab traps focus and cycles forward", () => {
    render(<UserMenu />);
    openMenuWith("Enter");
    const items = getItems();
    // Tab is captured globally while the menu is open.
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(items[0]); // wraps to first
  });

  it("Shift+Tab traps focus and cycles backward", () => {
    render(<UserMenu />);
    openMenuWith("Enter");
    const items = getItems();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(items[items.length - 1]); // wraps to last
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(items[0]);
  });

  it("Escape closes the menu and restores focus to the trigger", async () => {
    render(<UserMenu />);
    const trigger = openMenuWith("Enter");
    expect(screen.getByRole("menu")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    // Focus restore is deferred via requestAnimationFrame.
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("Outside click closes the menu without stealing focus", () => {
    render(
      <>
        <UserMenu />
        <button data-testid="outside">outside</button>
      </>,
    );
    openMenuWith("Enter");
    expect(screen.getByRole("menu")).toBeTruthy();
    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("clicking the trigger toggles the menu open and closed", () => {
    render(<UserMenu />);
    const trigger = screen.getByRole("button", { name: /account menu/i });
    fireEvent.click(trigger);
    expect(screen.getByRole("menu")).toBeTruthy();
    fireEvent.click(trigger);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("menu items expose role=menuitem with roving tabindex", () => {
    render(<UserMenu />);
    openMenuWith("Enter");
    const items = getItems();
    expect(items.map((i) => i.getAttribute("role"))).toEqual(["menuitem", "menuitem"]);
    // Move active to second item and confirm tabindex swap.
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    expect(items[0].getAttribute("tabindex")).toBe("-1");
    expect(items[1].getAttribute("tabindex")).toBe("0");
  });
});

describe("UserMenu — signed out", () => {
  beforeEach(() => {
    authState.user = null;
    authState.profile = null;
  });
  afterEach(() => cleanup());

  it("shows Sign in / Sign up links and no account menu", () => {
    render(<UserMenu />);
    expect(screen.getByText(/sign in/i)).toBeTruthy();
    expect(screen.getByText(/sign up/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /account menu/i })).toBeNull();
  });
});
