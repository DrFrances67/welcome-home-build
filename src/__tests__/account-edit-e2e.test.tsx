import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act, waitFor } from "@testing-library/react";
import React from "react";

// --- In-memory profile row that the mocked supabase client reads/writes ---
const profileRow: Record<string, string | null> = {
  id: "user-1",
  full_name: "Old Name",
  username: "oldname",
  email: "user@example.com",
  home_address: null,
  school_name: null,
  school_address: null,
  school_info: null,
};

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  updateUser: vi.fn().mockResolvedValue({ error: null }),
  updateEq: vi.fn(),
}));

// Mock supabase: profiles.update().eq() persists into our in-memory row.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { updateUser: mocks.updateUser },
    from: (_table: string) => ({
      update: (patch: Record<string, string | null>) => ({
        eq: (_col: string, _val: string) => {
          mocks.updateEq(patch);
          Object.assign(profileRow, patch);
          return Promise.resolve({ error: null });
        },
      }),
    }),
  },
}));

// Mock useAuth so AccountPage gets a user + profile without AuthProvider.
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
    profile: profileRow,
    loading: false,
    refreshProfile: vi.fn().mockResolvedValue(undefined),
  }),
}));

// Mock the router so the route file's createFileRoute call works in isolation.
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: (_path: string) => (config: { component: React.ComponentType }) => ({
    options: config,
  }),
  useNavigate: () => mocks.navigate,
}));

// Import AFTER mocks are registered.
import { Route } from "../routes/account";

const AccountPage = (Route as unknown as { options: { component: React.ComponentType } }).options.component;

function setByLabel(labelText: RegExp, value: string) {
  const field = screen.getByLabelText(labelText) as HTMLInputElement | HTMLTextAreaElement;
  fireEvent.change(field, { target: { value } });
  return field;
}

beforeEach(() => {
  mocks.updateEq.mockClear();
  mocks.updateUser.mockClear();
  // reset row
  Object.assign(profileRow, {
    id: "user-1",
    full_name: "Old Name",
    username: "oldname",
    email: "user@example.com",
    home_address: null,
    school_name: null,
    school_address: null,
    school_info: null,
  });
});
afterEach(() => cleanup());

describe("Account edit (E2E)", () => {
  it("edits required + optional fields, saves, and persists the changes", async () => {
    const { rerender } = render(<AccountPage />);

    // Form pre-fills from the loaded profile.
    const nameInput = setByLabel(/^name$/i, "New Teacher Name");
    const usernameInput = setByLabel(/^username$/i, "newteacher");
    const homeInput = setByLabel(/home address/i, "123 Main St");
    const schoolNameInput = setByLabel(/school name/i, "Lincoln High");
    const schoolAddrInput = setByLabel(/school address/i, "456 Oak Ave");
    const schoolInfoInput = setByLabel(/additional school info/i, "Room 12, Grade 9 Math");

    expect((nameInput as HTMLInputElement).value).toBe("New Teacher Name");
    expect((usernameInput as HTMLInputElement).value).toBe("newteacher");

    await act(async () => {
      fireEvent.click(screen.getByText(/save changes/i));
    });

    // The update call carried all edited fields.
    expect(mocks.updateEq).toHaveBeenCalledTimes(1);
    expect(mocks.updateEq.mock.calls[0][0]).toEqual({
      full_name: "New Teacher Name",
      username: "newteacher",
      home_address: "123 Main St",
      school_name: "Lincoln High",
      school_address: "456 Oak Ave",
      school_info: "Room 12, Grade 9 Math",
    });

    // No password change attempted when password field is blank.
    expect(mocks.updateUser).not.toHaveBeenCalled();

    // Success message appears.
    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toMatch(/saved/i);
    });

    // The in-memory row was mutated, simulating persistence.
    expect(profileRow.full_name).toBe("New Teacher Name");
    expect(profileRow.username).toBe("newteacher");
    expect(profileRow.home_address).toBe("123 Main St");
    expect(profileRow.school_name).toBe("Lincoln High");
    expect(profileRow.school_address).toBe("456 Oak Ave");
    expect(profileRow.school_info).toBe("Room 12, Grade 9 Math");

    // Re-mounting the page (e.g. after a navigation back) shows the persisted values.
    cleanup();
    render(<AccountPage />);
    expect((screen.getByLabelText(/^name$/i) as HTMLInputElement).value).toBe("New Teacher Name");
    expect((screen.getByLabelText(/^username$/i) as HTMLInputElement).value).toBe("newteacher");
    expect((screen.getByLabelText(/home address/i) as HTMLInputElement).value).toBe("123 Main St");
    expect((screen.getByLabelText(/school name/i) as HTMLInputElement).value).toBe("Lincoln High");
    expect((screen.getByLabelText(/school address/i) as HTMLInputElement).value).toBe("456 Oak Ave");
    expect((screen.getByLabelText(/additional school info/i) as HTMLTextAreaElement).value).toBe(
      "Room 12, Grade 9 Math",
    );
  });

  it("blocks saving when required fields are missing", async () => {
    render(<AccountPage />);
    // Use a whitespace-only name: it satisfies the native `required` attribute
    // but fails the component's trim() check, so we exercise the JS guard.
    setByLabel(/^name$/i, "   ");

    await act(async () => {
      fireEvent.click(screen.getByText(/save changes/i));
    });

    expect(mocks.updateEq).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toMatch(/name is required/i);
  });
});
