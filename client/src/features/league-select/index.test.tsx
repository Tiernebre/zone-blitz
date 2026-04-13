import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LeagueSelect } from "./index.tsx";

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockNavigate = vi.fn();

vi.mock("../../api.ts", () => ({
  api: {
    api: {
      leagues: {
        $get: (...args: unknown[]) => mockGet(...args),
        $post: (...args: unknown[]) => mockPost(...args),
      },
      users: {
        me: {
          $delete: vi.fn(),
        },
      },
    },
  },
}));

vi.mock("../../lib/auth-client.ts", () => ({
  authClient: {
    useSession: () => ({
      data: {
        user: {
          id: "u1",
          name: "Test User",
          email: "test@example.com",
          image: null,
        },
        session: { id: "s1" },
      },
      isPending: false,
    }),
    signOut: vi.fn(),
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LeagueSelect />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("LeagueSelect", () => {
  it("renders the Zone Blitz heading", () => {
    mockGet.mockReturnValue(
      Promise.resolve({ json: () => Promise.resolve([]) }),
    );
    renderWithProviders();
    expect(
      screen.getByRole("heading", { name: "Zone Blitz" }),
    ).toBeDefined();
  });

  it("renders the tagline", () => {
    mockGet.mockReturnValue(
      Promise.resolve({ json: () => Promise.resolve([]) }),
    );
    renderWithProviders();
    expect(screen.getByText(/football franchise simulation/i)).toBeDefined();
  });

  it("shows skeleton loading state while fetching leagues", () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    renderWithProviders();
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows alert error state when fetch fails", async () => {
    mockGet.mockReturnValue(Promise.reject(new Error("network error")));
    renderWithProviders();
    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toBeDefined();
      expect(screen.getByText("Failed to load leagues")).toBeDefined();
    });
  });

  it("shows empty state when no leagues exist", async () => {
    mockGet.mockReturnValue(
      Promise.resolve({ json: () => Promise.resolve([]) }),
    );
    renderWithProviders();
    await waitFor(() => {
      expect(
        screen.getByText("No leagues yet. Create one to get started."),
      ).toBeDefined();
    });
  });

  it("renders a table of leagues", async () => {
    mockGet.mockReturnValue(
      Promise.resolve({
        json: () =>
          Promise.resolve([
            { id: 1, name: "NFL League" },
            { id: 2, name: "XFL League" },
          ]),
      }),
    );
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText("NFL League")).toBeDefined();
      expect(screen.getByText("XFL League")).toBeDefined();
    });
  });

  it("navigates to a league when clicking a league row", async () => {
    mockGet.mockReturnValue(
      Promise.resolve({
        json: () => Promise.resolve([{ id: 42, name: "My League" }]),
      }),
    );
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText("My League")).toBeDefined();
    });

    fireEvent.click(screen.getByText("My League"));
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/leagues/$leagueId",
      params: { leagueId: "42" },
    });
  });

  it("submits the create league form and navigates to team select", async () => {
    mockGet.mockReturnValue(
      Promise.resolve({ json: () => Promise.resolve([]) }),
    );
    mockPost.mockReturnValue(
      Promise.resolve({
        json: () => Promise.resolve({ id: 3, name: "New League" }),
      }),
    );
    renderWithProviders();

    await waitFor(() => {
      expect(
        screen.getByText("No leagues yet. Create one to get started."),
      ).toBeDefined();
    });

    const input = screen.getByPlaceholderText("League name...");
    fireEvent.change(input, { target: { value: "New League" } });
    fireEvent.submit(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith({ json: { name: "New League" } });
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/leagues/$leagueId/team-select",
        params: { leagueId: "3" },
      });
    });
  });

  it("does not submit when input is empty", async () => {
    mockGet.mockReturnValue(
      Promise.resolve({ json: () => Promise.resolve([]) }),
    );
    renderWithProviders();

    await waitFor(() => {
      expect(
        screen.getByText("No leagues yet. Create one to get started."),
      ).toBeDefined();
    });

    fireEvent.submit(screen.getByRole("button", { name: "Create" }));
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("does not submit when input is only whitespace", async () => {
    mockGet.mockReturnValue(
      Promise.resolve({ json: () => Promise.resolve([]) }),
    );
    renderWithProviders();

    await waitFor(() => {
      expect(
        screen.getByText("No leagues yet. Create one to get started."),
      ).toBeDefined();
    });

    const input = screen.getByPlaceholderText("League name...");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.submit(screen.getByRole("button", { name: "Create" }));

    expect(mockPost).not.toHaveBeenCalled();
  });

  it("renders a profile button in the top right", () => {
    mockGet.mockReturnValue(
      Promise.resolve({ json: () => Promise.resolve([]) }),
    );
    renderWithProviders();
    expect(screen.getByRole("button", { name: /profile/i })).toBeDefined();
  });

  it("shows Creating... text while mutation is pending", async () => {
    mockGet.mockReturnValue(
      Promise.resolve({ json: () => Promise.resolve([]) }),
    );
    mockPost.mockReturnValue(new Promise(() => {}));
    renderWithProviders();

    await waitFor(() => {
      expect(
        screen.getByText("No leagues yet. Create one to get started."),
      ).toBeDefined();
    });

    const input = screen.getByPlaceholderText("League name...");
    fireEvent.change(input, { target: { value: "Test" } });
    fireEvent.submit(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(screen.getByText("Creating...")).toBeDefined();
    });
  });
});
