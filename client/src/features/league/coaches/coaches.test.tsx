import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestRouter } from "../../../router.tsx";

const mockLeaguesGet = vi.fn();
const mockTeamsGet = vi.fn();
const mockStaffGet = vi.fn();
const mockFingerprintGet = vi.fn();

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
                  $get: (...args: unknown[]) => mockStaffGet(...args),
                },
                fingerprint: {
                  $get: (...args: unknown[]) => mockFingerprintGet(...args),
                },
              },
            },
          },
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

const baseCoach = {
  reportsToId: null as string | null,
  playCaller: null as string | null,
  specialty: null as string | null,
  age: 45,
  yearsWithTeam: 2,
  contractYearsRemaining: 2,
  isVacancy: false,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Coaches page", () => {
  it("renders the staff tree returned by the API", async () => {
    mockLeaguesGet.mockResolvedValue({
      json: () => Promise.resolve({ id: "1", name: "League" }),
    });
    mockTeamsGet.mockResolvedValue({
      json: () => Promise.resolve([baseTeam]),
    });
    mockFingerprintGet.mockResolvedValue({
      json: () =>
        Promise.resolve({ offense: null, defense: null, overrides: {} }),
    });
    mockStaffGet.mockResolvedValue({
      json: () =>
        Promise.resolve([
          {
            ...baseCoach,
            id: "hc",
            firstName: "Alex",
            lastName: "Stone",
            role: "HC",
            playCaller: "offense",
          },
          {
            ...baseCoach,
            id: "oc",
            firstName: "Sam",
            lastName: "Rivers",
            role: "OC",
            reportsToId: "hc",
            specialty: "offense",
          },
        ]),
    });

    renderAt("/leagues/1/coaches");

    await waitFor(() => {
      expect(screen.getByText("Alex Stone")).toBeDefined();
      expect(screen.getByText("Sam Rivers")).toBeDefined();
      expect(screen.getByText(/Calls offense/i)).toBeDefined();
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
    mockFingerprintGet.mockResolvedValue({
      json: () =>
        Promise.resolve({ offense: null, defense: null, overrides: {} }),
    });
    mockStaffGet.mockResolvedValue({
      json: () => Promise.resolve([]),
    });

    renderAt("/leagues/1/coaches");

    await waitFor(() => {
      expect(screen.getByText(/No coaches on staff/i)).toBeDefined();
    });
  });

  it("shows the error alert when the request fails", async () => {
    mockLeaguesGet.mockResolvedValue({
      json: () => Promise.resolve({ id: "1", name: "League" }),
    });
    mockTeamsGet.mockResolvedValue({
      json: () => Promise.resolve([baseTeam]),
    });
    mockFingerprintGet.mockResolvedValue({
      json: () =>
        Promise.resolve({ offense: null, defense: null, overrides: {} }),
    });
    mockStaffGet.mockRejectedValue(new Error("boom"));

    renderAt("/leagues/1/coaches");

    await waitFor(() => {
      expect(screen.getByText(/Failed to load coaching staff/i)).toBeDefined();
    });
  });
});
