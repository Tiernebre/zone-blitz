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

  it("shows user name and email when menu is open", async () => {
    renderWithProviders();
    fireEvent.click(screen.getByRole("button", { name: /profile/i }));
    await waitFor(() => {
      expect(screen.getByText("Jane Doe")).toBeDefined();
      expect(screen.getByText("jane@example.com")).toBeDefined();
    });
  });

  it("shows sign out option when menu is open", async () => {
    renderWithProviders();
    fireEvent.click(screen.getByRole("button", { name: /profile/i }));
    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: /sign out/i })).toBeDefined();
    });
  });

  it("shows delete account option when menu is open", async () => {
    renderWithProviders();
    fireEvent.click(screen.getByRole("button", { name: /profile/i }));
    await waitFor(() => {
      expect(
        screen.getByRole("menuitem", { name: /delete account/i }),
      ).toBeDefined();
    });
  });

  it("calls signOut when sign out is selected", async () => {
    mockSignOut.mockResolvedValue({});
    renderWithProviders();
    fireEvent.click(screen.getByRole("button", { name: /profile/i }));
    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: /sign out/i })).toBeDefined();
    });
    fireEvent.click(screen.getByRole("menuitem", { name: /sign out/i }));
    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  it("calls delete endpoint when delete account is selected", async () => {
    mockDelete.mockResolvedValue({ ok: true });
    mockSignOut.mockResolvedValue({});
    renderWithProviders();
    fireEvent.click(screen.getByRole("button", { name: /profile/i }));
    await waitFor(() => {
      expect(
        screen.getByRole("menuitem", { name: /delete account/i }),
      ).toBeDefined();
    });
    fireEvent.click(
      screen.getByRole("menuitem", { name: /delete account/i }),
    );
    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalled();
    });
  });
});
