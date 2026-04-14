import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestRouter } from "../../../router.tsx";

const mockLeaguesGet = vi.fn();
const mockTeamsGet = vi.fn();
const mockStaffGet = vi.fn();
const mockCoachesStaffGet = vi.fn();

vi.mock("../../../api.ts", () => ({
  api: {
    api: {
      leagues: {
        $get: (...args: unknown[]) => mockLeaguesGet(...args),
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
                  $get: (...args: unknown[]) => mockCoachesStaffGet(...args),
                },
              },
            },
          },
        },
      },
      scouts: {
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
        [":scoutId"]: {
          $get: vi.fn(),
        },
      },
    },
  },
}));

vi.mock("../../../lib/auth-client.ts", () => ({
  authClient: {
    useSession: () => ({
      data: { user: { id: "1", name: "Test" }, session: { id: "s1" } },
      isPending: false,
    }),
    signIn: { social: vi.fn() },
  },
}));

function renderAt(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createTestRouter(path);
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

const baseTeam = {
  id: "team-1",
  name: "Team",
  city: "City",
  abbreviation: "TST",
  primaryColor: "#000000",
  secondaryColor: "#FFFFFF",
  conference: "AFC",
  division: "AFC East",
};

const baseScout = {
  reportsToId: null as string | null,
  coverage: null as string | null,
  age: 45,
  yearsWithTeam: 2,
  contractYearsRemaining: 2,
  workCapacity: 120,
  isVacancy: false,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Scouts page", () => {
  it("renders the staff tree returned by the API", async () => {
    mockLeaguesGet.mockResolvedValue({
      json: () => Promise.resolve({ id: "1", name: "League" }),
    });
    mockTeamsGet.mockResolvedValue({
      json: () => Promise.resolve([baseTeam]),
    });
    mockStaffGet.mockResolvedValue({
      json: () =>
        Promise.resolve([
          {
            ...baseScout,
            id: "dir",
            firstName: "Alex",
            lastName: "Stone",
            role: "DIRECTOR",
            workCapacity: 200,
          },
          {
            ...baseScout,
            id: "cc",
            firstName: "Sam",
            lastName: "Rivers",
            role: "NATIONAL_CROSS_CHECKER",
            reportsToId: "dir",
            coverage: "East",
          },
        ]),
    });

    renderAt("/leagues/1/scouts");

    await waitFor(() => {
      expect(screen.getByText("Alex Stone")).toBeDefined();
      expect(screen.getByText("Sam Rivers")).toBeDefined();
      expect(screen.getByText(/200 pts \/ cycle/)).toBeDefined();
    });

    expect(mockStaffGet).toHaveBeenCalledWith({
      param: { leagueId: "1", teamId: "team-1" },
    });
  });

  it("renders the empty-state message when the team has no staff", async () => {
    mockLeaguesGet.mockResolvedValue({
      json: () => Promise.resolve({ id: "1", name: "League" }),
    });
    mockTeamsGet.mockResolvedValue({
      json: () => Promise.resolve([baseTeam]),
    });
    mockStaffGet.mockResolvedValue({
      json: () => Promise.resolve([]),
    });

    renderAt("/leagues/1/scouts");

    await waitFor(() => {
      expect(screen.getByText(/No scouts on staff/i)).toBeDefined();
    });
  });

  it("shows the error alert when the request fails", async () => {
    mockLeaguesGet.mockResolvedValue({
      json: () => Promise.resolve({ id: "1", name: "League" }),
    });
    mockTeamsGet.mockResolvedValue({
      json: () => Promise.resolve([baseTeam]),
    });
    mockStaffGet.mockRejectedValue(new Error("boom"));

    renderAt("/leagues/1/scouts");

    await waitFor(() => {
      expect(screen.getByText(/Failed to load scouting staff/i)).toBeDefined();
    });
  });
});
