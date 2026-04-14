import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppRouter, createTestRouter } from "./router.tsx";

const mockGet = vi.fn();
const mockTeamsGet = vi.fn();
const mockStaffGet = vi.fn();
const mockUseSession = vi.fn();

vi.mock("./api.ts", () => ({
  api: {
    api: {
      leagues: {
        $get: (...args: unknown[]) => mockGet(...args),
        $post: vi.fn(),
      },
      teams: {
        $get: (...args: unknown[]) => mockTeamsGet(...args),
      },
      coaches: {
        leagues: {
          [":leagueId"]: {
            teams: {
              [":teamId"]: {
                staff: {
                  $get: (...args: unknown[]) => mockStaffGet(...args),
                },
              },
            },
          },
        },
      },
    },
  },
}));

vi.mock("./lib/auth-client.ts", () => ({
  authClient: {
    useSession: () => mockUseSession(),
    signIn: {
      social: vi.fn(),
    },
  },
}));

function renderRouter(initialPath = "/") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createTestRouter(initialPath);
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("createAppRouter", () => {
  it("creates a router instance", () => {
    const router = createAppRouter();
    expect(router).toBeDefined();
  });
});

describe("Router", () => {
  it("renders the login page at /login", async () => {
    renderRouter("/login");
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /sign in with google/i }),
      ).toBeDefined();
    });
  });

  it("redirects to /login when unauthenticated at /", async () => {
    mockUseSession.mockReturnValue({ data: null, isPending: false });
    renderRouter("/");
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /sign in with google/i }),
      ).toBeDefined();
    });
  });

  it("shows loading state while session is pending", async () => {
    mockUseSession.mockReturnValue({ data: null, isPending: true });
    renderRouter("/");
    await waitFor(() => {
      expect(screen.getByText("Loading...")).toBeDefined();
    });
  });

  it("renders the league select page at / when authenticated", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "1", name: "Test" }, session: { id: "s1" } },
      isPending: false,
    });
    mockGet.mockReturnValue(
      Promise.resolve({ json: () => Promise.resolve([]) }),
    );
    renderRouter("/");
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Zone Blitz" }),
      ).toBeDefined();
    });
  });

  it("renders the create league page at /leagues/new when authenticated", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "1", name: "Test" }, session: { id: "s1" } },
      isPending: false,
    });
    renderRouter("/leagues/new");
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Create a new league" }),
      ).toBeDefined();
    });
  });

  it("renders the team select page at /leagues/:leagueId/team-select when authenticated", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "1", name: "Test" }, session: { id: "s1" } },
      isPending: false,
    });
    mockTeamsGet.mockReturnValue(
      Promise.resolve({
        json: () =>
          Promise.resolve([
            {
              id: "t1",
              name: "Minutemen",
              city: "Boston",
              abbreviation: "BOS",
              primaryColor: "#000",
              secondaryColor: "#FFF",
              conference: "AFC",
              division: "AFC East",
            },
          ]),
      }),
    );
    renderRouter("/leagues/1/team-select");
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Choose Your Team" }),
      ).toBeDefined();
    });
  });

  it("renders the league layout and home page at /leagues/:leagueId when authenticated", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "1", name: "Test" }, session: { id: "s1" } },
      isPending: false,
    });
    renderRouter("/leagues/1");
    await waitFor(() => {
      expect(
        document.querySelector('[data-slot="sidebar-wrapper"]'),
      ).toBeDefined();
      expect(
        screen.getByRole("heading", { name: "League Home" }),
      ).toBeDefined();
    });
  });

  const stubRoutes: Array<[string, string]> = [
    ["roster", "Roster"],
    ["coaches", "Coaches"],
    ["schemes", "Schemes"],
    ["scouting", "Scouting"],
    ["draft", "Draft"],
    ["trades", "Trades"],
    ["free-agency", "Free Agency"],
    ["salary-cap", "Salary Cap"],
    ["standings", "Standings"],
    ["schedule", "Schedule"],
    ["media", "Media"],
    ["owner", "Owner"],
  ];

  for (const [path, heading] of stubRoutes) {
    it(`renders the ${heading} stub page at /leagues/:leagueId/${path}`, async () => {
      mockUseSession.mockReturnValue({
        data: { user: { id: "1", name: "Test" }, session: { id: "s1" } },
        isPending: false,
      });
      renderRouter(`/leagues/1/${path}`);
      await waitFor(() => {
        expect(screen.getByRole("heading", { name: heading })).toBeDefined();
      });
    });
  }
});
