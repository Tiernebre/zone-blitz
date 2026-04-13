import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UserMenu } from "./user-menu.tsx";

const mockSignOut = vi.fn();
const mockDelete = vi.fn();

vi.mock("../lib/auth-client.ts", () => ({
  authClient: {
    useSession: () => ({
      data: {
        user: {
          id: "u1",
          name: "Jane Doe",
          email: "jane@example.com",
          image: null,
        },
        session: { id: "s1" },
      },
      isPending: false,
    }),
    signOut: (...args: unknown[]) => mockSignOut(...args),
  },
}));

vi.mock("../api.ts", () => ({
  api: {
    api: {
      users: {
        me: {
          $delete: (...args: unknown[]) => mockDelete(...args),
        },
      },
    },
  },
}));

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <UserMenu />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("UserMenu", () => {
  it("renders a button to open the menu", () => {
    renderWithProviders();
    expect(screen.getByRole("button", { name: /profile/i })).toBeDefined();
  });

  it("shows user name and email when menu is open", () => {
    renderWithProviders();
    fireEvent.click(screen.getByRole("button", { name: /profile/i }));
    expect(screen.getByText("Jane Doe")).toBeDefined();
    expect(screen.getByText("jane@example.com")).toBeDefined();
  });

  it("shows sign out button when menu is open", () => {
    renderWithProviders();
    fireEvent.click(screen.getByRole("button", { name: /profile/i }));
    expect(screen.getByRole("button", { name: /sign out/i })).toBeDefined();
  });

  it("shows delete account button when menu is open", () => {
    renderWithProviders();
    fireEvent.click(screen.getByRole("button", { name: /profile/i }));
    expect(screen.getByRole("button", { name: /delete account/i }))
      .toBeDefined();
  });

  it("calls signOut when sign out button is clicked", () => {
    mockSignOut.mockResolvedValue({});
    renderWithProviders();
    fireEvent.click(screen.getByRole("button", { name: /profile/i }));
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    expect(mockSignOut).toHaveBeenCalled();
  });

  it("shows a confirmation before deleting account", () => {
    renderWithProviders();
    fireEvent.click(screen.getByRole("button", { name: /profile/i }));
    fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
    expect(screen.getByText(/are you sure/i)).toBeDefined();
  });

  it("calls delete endpoint when deletion is confirmed", async () => {
    mockDelete.mockResolvedValue({ ok: true });
    mockSignOut.mockResolvedValue({});
    renderWithProviders();
    fireEvent.click(screen.getByRole("button", { name: /profile/i }));
    fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
    fireEvent.click(screen.getByRole("button", { name: /yes, delete/i }));

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalled();
    });
  });

  it("closes confirmation when cancel is clicked", () => {
    renderWithProviders();
    fireEvent.click(screen.getByRole("button", { name: /profile/i }));
    fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
    expect(screen.getByText(/are you sure/i)).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByText(/are you sure/i)).toBeNull();
  });

  it("closes the menu when clicking the profile button again", () => {
    renderWithProviders();
    const btn = screen.getByRole("button", { name: /profile/i });
    fireEvent.click(btn);
    expect(screen.getByText("Jane Doe")).toBeDefined();

    fireEvent.click(btn);
    expect(screen.queryByText("Jane Doe")).toBeNull();
  });
});
