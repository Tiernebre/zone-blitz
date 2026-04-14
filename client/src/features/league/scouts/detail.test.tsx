import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScoutDetail } from "./detail.tsx";

const mockDetailGet = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ scoutId: "s1", leagueId: "1" }),
  Link: ({
    children,
    params,
  }: {
    children: React.ReactNode;
    to?: string;
    params?: { leagueId: string; scoutId: string };
    className?: string;
  }) => (
    <a
      href={params
        ? `/leagues/${params.leagueId}/scouts/${params.scoutId}`
        : "#"}
    >
      {children}
    </a>
  ),
}));

vi.mock("../../../api.ts", () => ({
  api: {
    api: {
      scouts: {
        [":scoutId"]: {
          $get: (...args: unknown[]) => mockDetailGet(...args),
        },
      },
    },
  },
}));

function renderDetail() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ScoutDetail />
    </QueryClientProvider>,
  );
}

const baseDetail = {
  id: "s1",
  leagueId: "1",
  teamId: "t1",
  firstName: "Alex",
  lastName: "Stone",
  role: "DIRECTOR",
  coverage: null as string | null,
  age: 58,
  yearsWithTeam: 3,
  contractYearsRemaining: 4,
  contractSalary: 1_500_000,
  contractBuyout: 2_000_000,
  workCapacity: 200,
  isVacancy: false,
  reputationLabels: [] as string[],
  careerStops: [] as unknown[],
  evaluations: [] as unknown[],
  crossChecks: [] as unknown[],
  externalTrackRecord: [] as unknown[],
  connections: [] as unknown[],
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ScoutDetail", () => {
  it("renders header, empty sections, and work capacity", async () => {
    mockDetailGet.mockResolvedValue({
      json: () => Promise.resolve(baseDetail),
    });

    renderDetail();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Alex Stone/ })).toBeDefined();
    });
    expect(screen.getByText(/Scouting Director/)).toBeDefined();
    expect(screen.getByText(/200 pts \/ cycle/)).toBeDefined();
    expect(screen.getByText(/No prior stops on record/)).toBeDefined();
    expect(screen.getByText(/No league reputation yet/)).toBeDefined();
    expect(screen.getByText(/No evaluations on file/)).toBeDefined();
    expect(screen.getByText(/No secondhand record on file/)).toBeDefined();
    expect(screen.getByText(/No known connections/)).toBeDefined();
  });

  it("renders reputation, resume, evaluations, cross-checks, external record, and connections", async () => {
    mockDetailGet.mockResolvedValue({
      json: () =>
        Promise.resolve({
          ...baseDetail,
          coverage: "Southeast",
          reputationLabels: ["respected ACC evaluator"],
          careerStops: [
            {
              id: "cs1",
              orgName: "Lions",
              role: "Area Scout",
              startYear: 2018,
              endYear: null,
              coverageNotes: "SEC",
            },
          ],
          evaluations: [
            {
              id: "e1",
              prospectId: null,
              prospectName: "Rookie Back",
              draftYear: 2029,
              positionGroup: "RB",
              roundTier: "4-5",
              grade: "late-round flyer",
              evaluationLevel: "standard",
              outcome: "contributor",
              outcomeDetail: "3rd-string RB",
            },
          ],
          crossChecks: [
            {
              id: "cc1",
              evaluationId: "e1",
              otherScout: {
                id: "s2",
                firstName: "Peer",
                lastName: "Buddy",
                role: "AREA_SCOUT",
              },
              otherGrade: "UDFA",
              winner: "this",
            },
            {
              id: "cc2",
              evaluationId: "e1",
              otherScout: null,
              otherGrade: "day 3",
              winner: "pending",
            },
          ],
          externalTrackRecord: [
            {
              id: "ex1",
              orgName: "Tigers",
              startYear: 2015,
              endYear: null,
              noisyHitRateLabel: "above-average on Day 3 picks",
            },
          ],
          connections: [
            {
              relation: "peer",
              scout: {
                id: "s3",
                firstName: "Pat",
                lastName: "Friend",
                role: "AREA_SCOUT",
              },
            },
          ],
        }),
    });

    renderDetail();

    await waitFor(() => {
      expect(screen.getByText(/respected ACC evaluator/)).toBeDefined();
    });
    expect(screen.getByText(/Lions — Area Scout/)).toBeDefined();
    expect(screen.getByText(/Rookie Back/)).toBeDefined();
    expect(screen.getByText(/late-round flyer/)).toBeDefined();
    expect(screen.getByText(/Peer Buddy/)).toBeDefined();
    expect(screen.getByText(/Lower confidence/)).toBeDefined();
    expect(screen.getByText(/Tigers/)).toBeDefined();
    const connectionLink = screen.getByRole("link", { name: /Pat Friend/ });
    expect(connectionLink.getAttribute("href")).toBe(
      "/leagues/1/scouts/s3",
    );
  });

  it("shows an error alert when the request fails", async () => {
    mockDetailGet.mockRejectedValue(new Error("boom"));
    renderDetail();

    await waitFor(() => {
      expect(screen.getByText(/Failed to load scout detail/)).toBeDefined();
    });
  });
});
