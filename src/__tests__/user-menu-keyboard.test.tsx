// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UserMenu — keyboard navigation, focus management, ARIA
//
// The menu is a shadcn/Radix DropdownMenu, so these assertions target
// Radix's actual semantics:
//   - trigger has aria-haspopup=menu and toggles aria-expanded
//   - Enter / Space / ArrowDown open the menu focused on the first item
//   - ArrowUp opens focused on the last item
//   - Arrow keys move between items
//   - Escape closes and restores focus to the trigger
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  }: React.PropsWithChildren<{ to: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>>) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

// Radix relies on APIs jsdom doesn't implement.
beforeEach(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
});

// Import AFTER mocks.
import { UserMenu } from "../components/UserMenu";

// --- Helpers -------------------------------------------------------------

const getTrigger = () => screen.getByRole("button", { name: /account menu/i });
const getItems = () => screen.getAllByRole("menuitem") as HTMLElement[];

async function openWith(user: ReturnType<typeof userEvent.setup>, key: string) {
  const trigger = getTrigger();
  trigger.focus();
  await user.keyboard(key);
  await screen.findByRole("menu");
  return trigger;
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

  it("trigger exposes correct ARIA attributes when closed", () => {
    render(<UserMenu />);
    const trigger = getTrigger();
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("Enter opens the menu focused on the first item", async () => {
    const user = userEvent.setup();
    render(<UserMenu />);
    const trigger = await openWith(user, "{Enter}");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(trigger.getAttribute("aria-controls")).toBeTruthy();
    const items = getItems();
    expect(items).toHaveLength(4);
    await waitFor(() => expect(document.activeElement).toBe(items[0]));
  });

  it("Space opens the menu focused on the first item", async () => {
    const user = userEvent.setup();
    render(<UserMenu />);
    await openWith(user, "[Space]");
    await waitFor(() => expect(document.activeElement).toBe(getItems()[0]));
  });

  it("ArrowDown from the trigger opens focused on the first item", async () => {
    const user = userEvent.setup();
    render(<UserMenu />);
    await openWith(user, "{ArrowDown}");
    await waitFor(() => expect(document.activeElement).toBe(getItems()[0]));
  });

  it("ArrowUp from the trigger does not open the menu (Radix opens on Enter/Space/ArrowDown)", async () => {
    const user = userEvent.setup();
    render(<UserMenu />);
    getTrigger().focus();
    await user.keyboard("{ArrowUp}");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("ArrowDown / ArrowUp move focus between items", async () => {
    const user = userEvent.setup();
    render(<UserMenu />);
    await openWith(user, "{Enter}");
    const items = getItems();
    await waitFor(() => expect(document.activeElement).toBe(items[0]));
    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(document.activeElement).toBe(items[1]));
    await user.keyboard("{ArrowUp}");
    await waitFor(() => expect(document.activeElement).toBe(items[0]));
  });

  it("Home / End jump to first / last item", async () => {
    const user = userEvent.setup();
    render(<UserMenu />);
    await openWith(user, "{Enter}");
    const items = getItems();
    await user.keyboard("{End}");
    await waitFor(() => expect(document.activeElement).toBe(items[items.length - 1]));
    await user.keyboard("{Home}");
    await waitFor(() => expect(document.activeElement).toBe(items[0]));
  });

  it("focus stays trapped inside the menu items", async () => {
    const user = userEvent.setup();
    render(
      <>
        <UserMenu />
        <button data-testid="outside">outside</button>
      </>,
    );
    await openWith(user, "{Enter}");
    const items = getItems();
    await user.keyboard("{ArrowDown}{ArrowDown}");
    // Radix loops within the menu — focus never lands on the outside button.
    expect(items).toContain(document.activeElement);
    expect(document.activeElement).not.toBe(screen.getByTestId("outside"));
  });

  it("Escape closes the menu and restores focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<UserMenu />);
    const trigger = await openWith(user, "{Enter}");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("clicking the trigger toggles the menu open and closed", async () => {
    // Radix marks the rest of the document pointer-events:none while open.
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<UserMenu />);
    const trigger = getTrigger();
    await user.click(trigger);
    expect(await screen.findByRole("menu")).toBeTruthy();
    await user.click(trigger);
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });

  it("menu items expose role=menuitem and link to the account pages", async () => {
    const user = userEvent.setup();
    render(<UserMenu />);
    await openWith(user, "{Enter}");
    const items = getItems();
    expect(items.map((i) => i.getAttribute("role"))).toEqual([
      "menuitem",
      "menuitem",
      "menuitem",
      "menuitem",
    ]);
    expect(items.map((i) => i.getAttribute("href"))).toEqual([
      "/account",
      "/lesson-plans",
      "/worksheets",
      null,
    ]);
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
