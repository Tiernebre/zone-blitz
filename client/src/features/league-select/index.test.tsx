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
const mockDelete = vi.fn();
const mockNavigate = vi.fn();

vi.mock("../../api.ts", () => ({
  api: {
    api: {
      leagues: {
        $get: (...args: unknown[]) => mockGet(...args),
        ":id": {
          $delete: (...args: unknown[]) => mockDelete(...args),
        },
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

  it("renders a grid of leagues with config and status columns", async () => {
    mockGet.mockReturnValue(
      Promise.resolve({
        json: () =>
          Promise.resolve([
            {
              id: 1,
              name: "NFL League",
              numberOfTeams: 32,
              seasonLength: 17,
              createdAt: "2026-01-15T00:00:00Z",
              currentSeason: { year: 1, phase: "preseason", week: 1 },
            },
            {
              id: 2,
              name: "XFL League",
              numberOfTeams: 8,
              seasonLength: 10,
              createdAt: "2026-02-20T00:00:00Z",
              currentSeason: { year: 3, phase: "regular_season", week: 5 },
            },
          ]),
      }),
    );
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText("NFL League")).toBeDefined();
    });
    expect(screen.getByText("XFL League")).toBeDefined();
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeDefined();
    expect(screen.getByRole("columnheader", { name: "Teams" })).toBeDefined();
    expect(screen.getByRole("columnheader", { name: "Season Length" }))
      .toBeDefined();
    expect(screen.getByRole("columnheader", { name: "Status" })).toBeDefined();
    expect(screen.getByRole("columnheader", { name: "Created" })).toBeDefined();
    expect(screen.getByText("32")).toBeDefined();
    expect(screen.getByText("17")).toBeDefined();
    expect(screen.getByText(/Season 1 · Preseason/)).toBeDefined();
    expect(screen.getByText(/Season 3 · Regular Season/)).toBeDefined();
  });

  it("renders a dash when a league has no current season", async () => {
    mockGet.mockReturnValue(
      Promise.resolve({
        json: () =>
          Promise.resolve([
            {
              id: 1,
              name: "Stale League",
              numberOfTeams: 32,
              seasonLength: 17,
              createdAt: "2026-01-15T00:00:00Z",
              currentSeason: null,
            },
          ]),
      }),
    );
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText("Stale League")).toBeDefined();
    });
    expect(screen.getByText("—")).toBeDefined();
  });

  it.each([
    ["playoffs", "Playoffs"],
    ["offseason", "Offseason"],
  ])("renders %s phase label", async (phase, label) => {
    mockGet.mockReturnValue(
      Promise.resolve({
        json: () =>
          Promise.resolve([
            {
              id: 1,
              name: "League",
              numberOfTeams: 32,
              seasonLength: 17,
              createdAt: "2026-01-15T00:00:00Z",
              currentSeason: { year: 2, phase, week: 1 },
            },
          ]),
      }),
    );
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText(new RegExp(label))).toBeDefined();
    });
  });

  it("navigates to a league when clicking a league row", async () => {
    mockGet.mockReturnValue(
      Promise.resolve({
        json: () =>
          Promise.resolve([
            {
              id: 42,
              name: "My League",
              numberOfTeams: 32,
              seasonLength: 17,
              createdAt: "2026-01-15T00:00:00Z",
              currentSeason: { year: 1, phase: "preseason", week: 1 },
            },
          ]),
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

  it("navigates to /leagues/new when the header Create League button is clicked", async () => {
    mockGet.mockReturnValue(
      Promise.resolve({
        json: () =>
          Promise.resolve([
            {
              id: 1,
              name: "League",
              numberOfTeams: 32,
              seasonLength: 17,
              createdAt: "2026-01-15T00:00:00Z",
              currentSeason: { year: 1, phase: "preseason", week: 1 },
            },
          ]),
      }),
    );
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText("League")).toBeDefined();
    });

    fireEvent.click(
      screen.getAllByRole("button", { name: /create league/i })[0],
    );
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/leagues/new" });
  });

  it("navigates to /leagues/new when the empty-state Create League button is clicked", async () => {
    mockGet.mockReturnValue(
      Promise.resolve({ json: () => Promise.resolve([]) }),
    );
    renderWithProviders();
    await waitFor(() => {
      expect(
        screen.getByText("No leagues yet. Create one to get started."),
      ).toBeDefined();
    });

    const buttons = screen.getAllByRole("button", { name: /create league/i });
    fireEvent.click(buttons[buttons.length - 1]);
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/leagues/new" });
  });

  it("renders a profile button in the top right", () => {
    mockGet.mockReturnValue(
      Promise.resolve({ json: () => Promise.resolve([]) }),
    );
    renderWithProviders();
    expect(screen.getByRole("button", { name: /profile/i })).toBeDefined();
  });

  it(
    "confirms and deletes a league when the row delete action is used",
    async () => {
      mockGet.mockReturnValue(
        Promise.resolve({
          json: () =>
            Promise.resolve([
              {
                id: 7,
                name: "Doomed League",
                numberOfTeams: 32,
                seasonLength: 17,
                createdAt: "2026-01-15T00:00:00Z",
                currentSeason: { year: 1, phase: "preseason", week: 1 },
              },
            ]),
        }),
      );
      mockDelete.mockReturnValue(Promise.resolve({}));
      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText("Doomed League")).toBeDefined();
      });

      fireEvent.click(
        screen.getByRole("button", { name: "Delete Doomed League" }),
      );

      expect(mockNavigate).not.toHaveBeenCalled();

      const confirm = await screen.findByRole("button", {
        name: "Confirm Delete",
      });
      fireEvent.click(confirm);

      await waitFor(() => {
        expect(mockDelete).toHaveBeenCalledWith({ param: { id: "7" } });
      });
    },
  );

  it(
    "does not delete when the delete dialog is cancelled",
    async () => {
      mockGet.mockReturnValue(
        Promise.resolve({
          json: () =>
            Promise.resolve([
              {
                id: 7,
                name: "Safe League",
                numberOfTeams: 32,
                seasonLength: 17,
                createdAt: "2026-01-15T00:00:00Z",
                currentSeason: { year: 1, phase: "preseason", week: 1 },
              },
            ]),
        }),
      );
      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText("Safe League")).toBeDefined();
      });

      fireEvent.click(
        screen.getByRole("button", { name: "Delete Safe League" }),
      );
      const cancel = await screen.findByRole("button", { name: "Cancel" });
      fireEvent.click(cancel);

      expect(mockDelete).not.toHaveBeenCalled();
    },
  );
});
