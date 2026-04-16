import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hiring } from "./index.tsx";

const mockUseParams = vi.fn();
const mockUseLeagueClock = vi.fn();
const mockUseLeague = vi.fn();
const mockUseTeamHiringState = vi.fn();
const mockUseHiringCandidates = vi.fn();
const mockUseHiringBlockers = vi.fn();

const expressInterestMutate = vi.fn();
const requestInterviewsMutate = vi.fn();
const submitOffersMutate = vi.fn();
const resolveBlockerMutate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useParams: (...args: unknown[]) => mockUseParams(...args),
  Link: (
    { children, ...rest }: {
      children: React.ReactNode;
    } & Record<string, unknown>,
  ) => <a {...rest}>{children}</a>,
}));

vi.mock("../../../hooks/use-league-clock.ts", () => ({
  useLeagueClock: (...args: unknown[]) => mockUseLeagueClock(...args),
}));

vi.mock("../../../hooks/use-league.ts", () => ({
  useLeague: (...args: unknown[]) => mockUseLeague(...args),
}));

vi.mock("../../../hooks/use-hiring.ts", () => ({
  useTeamHiringState: (...args: unknown[]) => mockUseTeamHiringState(...args),
  useHiringCandidates: (...args: unknown[]) => mockUseHiringCandidates(...args),
  useHiringBlockers: (...args: unknown[]) => mockUseHiringBlockers(...args),
  useExpressInterest: () => ({
    mutate: expressInterestMutate,
    isPending: false,
  }),
  useRequestInterviews: () => ({
    mutate: requestInterviewsMutate,
    isPending: false,
  }),
  useSubmitOffers: () => ({
    mutate: submitOffersMutate,
    isPending: false,
  }),
  useResolveBlocker: () => ({
    mutate: resolveBlockerMutate,
    isPending: false,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <Hiring />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockUseParams.mockReturnValue({ leagueId: "lg" });
  mockUseHiringBlockers.mockReturnValue({
    data: { missingCoachRoles: [], missingScoutRoles: [] },
    isLoading: false,
  });
  mockUseHiringCandidates.mockReturnValue({ data: [], isLoading: false });
  mockUseTeamHiringState.mockReturnValue({
    data: {
      leagueId: "lg",
      teamId: "tm",
      staffBudget: 50_000_000,
      remainingBudget: 30_000_000,
      interests: [],
      interviews: [],
      offers: [],
      decisions: [],
    },
    isLoading: false,
  });
  mockUseLeagueClock.mockReturnValue({
    data: { slug: "hiring_market_survey" },
    isLoading: false,
  });
  mockUseLeague.mockReturnValue({
    data: {
      interestCap: 10,
      interviewsPerWeek: 5,
      maxConcurrentOffers: 3,
    },
    isLoading: false,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Hiring page", () => {
  it("shows loading skeleton while data loads", () => {
    mockUseLeagueClock.mockReturnValue({ data: undefined, isLoading: true });
    mockUseTeamHiringState.mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    renderPage();
    expect(screen.getByTestId("hiring-loading")).toBeTruthy();
  });

  it("shows not-in-phase message when current step is not a hiring slug", () => {
    mockUseLeagueClock.mockReturnValue({
      data: { slug: "regular_season_week_1" },
      isLoading: false,
    });
    renderPage();
    expect(screen.getByText(/hiring market is closed/i)).toBeTruthy();
  });

  it("renders the step badge with the current step name", () => {
    renderPage();
    expect(screen.getByTestId("hiring-step-badge").textContent).toContain(
      "Market Survey",
    );
  });

  it("displays remaining staff budget", () => {
    renderPage();
    expect(screen.getByTestId("hiring-budget").textContent).toContain("$30M");
  });

  it("hides the interest counter when the league has no interest cap", () => {
    mockUseLeague.mockReturnValue({ data: undefined, isLoading: false });
    renderPage();
    expect(screen.queryByTestId("hiring-interest-counter")).toBeNull();
  });
});

describe("Market survey view", () => {
  beforeEach(() => {
    mockUseHiringCandidates.mockReturnValue({
      data: [
        {
          id: "c1",
          leagueId: "lg",
          staffType: "coach",
          firstName: "Andy",
          lastName: "Reid",
          role: "HC",
        },
        {
          id: "c2",
          leagueId: "lg",
          staffType: "coach",
          firstName: "Kyle",
          lastName: "Shanahan",
          role: "OC",
        },
      ],
      isLoading: false,
    });
  });

  it("renders the candidate table", () => {
    renderPage();
    expect(screen.getByTestId("market-survey")).toBeTruthy();
    expect(screen.getByTestId("candidate-row-c1")).toBeTruthy();
    expect(screen.getByTestId("candidate-row-c2")).toBeTruthy();
  });

  it("filters candidates by search", () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("Search candidates"), {
      target: { value: "Reid" },
    });
    expect(screen.getByTestId("candidate-row-c1")).toBeTruthy();
    expect(screen.queryByTestId("candidate-row-c2")).toBeNull();
  });

  it("invokes expressInterest on Express Interest click", () => {
    renderPage();
    fireEvent.click(screen.getByTestId("express-interest-c1"));
    expect(expressInterestMutate).toHaveBeenCalledWith(
      { leagueId: "lg", candidateIds: ["c1"] },
      expect.any(Object),
    );
  });

  it("disables the Express Interest button when already interested", () => {
    mockUseTeamHiringState.mockReturnValue({
      data: {
        leagueId: "lg",
        teamId: "tm",
        staffBudget: 0,
        remainingBudget: 0,
        interests: [
          {
            id: "i1",
            leagueId: "lg",
            teamId: "tm",
            staffType: "coach",
            staffId: "c1",
            stepSlug: "hiring_market_survey",
            status: "active",
          },
        ],
        interviews: [],
        offers: [],
        decisions: [],
      },
      isLoading: false,
    });
    renderPage();
    expect(
      screen.getByTestId("express-interest-c1").hasAttribute("disabled"),
    ).toBe(true);
  });

  it("shows candidate loading skeleton", () => {
    mockUseHiringCandidates.mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    renderPage();
    expect(screen.getByTestId("candidates-loading")).toBeTruthy();
  });
});

describe("Interview view", () => {
  beforeEach(() => {
    mockUseLeagueClock.mockReturnValue({
      data: { slug: "hiring_interview_1" },
      isLoading: false,
    });
  });

  it("shows empty state when no interests are active", () => {
    renderPage();
    expect(screen.getByTestId("interview-empty")).toBeTruthy();
  });

  it("hides the interview counter when interviewsPerWeek is unknown", () => {
    mockUseLeague.mockReturnValue({ data: undefined, isLoading: false });
    mockUseHiringCandidates.mockReturnValue({
      data: [
        {
          id: "c1",
          leagueId: "lg",
          staffType: "coach",
          firstName: "Andy",
          lastName: "Reid",
          role: "HC",
        },
      ],
      isLoading: false,
    });
    mockUseTeamHiringState.mockReturnValue({
      data: {
        leagueId: "lg",
        teamId: "tm",
        staffBudget: 0,
        remainingBudget: 0,
        interests: [
          {
            id: "i1",
            leagueId: "lg",
            teamId: "tm",
            staffType: "coach",
            staffId: "c1",
            stepSlug: "hiring_market_survey",
            status: "active",
          },
        ],
        interviews: [],
        offers: [],
        decisions: [],
      },
      isLoading: false,
    });
    renderPage();
    expect(screen.queryByTestId("hiring-interview-counter")).toBeNull();
  });

  it("shows loading state while candidates are loading", () => {
    mockUseHiringCandidates.mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    renderPage();
    expect(screen.getByTestId("interview-view-loading")).toBeTruthy();
  });

  it("requests an interview for an interested candidate", () => {
    mockUseHiringCandidates.mockReturnValue({
      data: [
        {
          id: "c1",
          leagueId: "lg",
          staffType: "coach",
          firstName: "Andy",
          lastName: "Reid",
          role: "HC",
        },
      ],
      isLoading: false,
    });
    mockUseTeamHiringState.mockReturnValue({
      data: {
        leagueId: "lg",
        teamId: "tm",
        staffBudget: 0,
        remainingBudget: 0,
        interests: [
          {
            id: "i1",
            leagueId: "lg",
            teamId: "tm",
            staffType: "coach",
            staffId: "c1",
            stepSlug: "hiring_market_survey",
            status: "active",
          },
        ],
        interviews: [],
        offers: [],
        decisions: [],
      },
      isLoading: false,
    });
    renderPage();
    fireEvent.click(screen.getByTestId("request-interview-c1"));
    expect(requestInterviewsMutate).toHaveBeenCalledWith(
      { leagueId: "lg", candidateIds: ["c1"] },
      expect.any(Object),
    );
  });

  it.each([
    ["requested", "Pending"],
    ["completed", "Interviewed"],
    ["declined", "Declined"],
  ])("renders %s status as %s", (status, expected) => {
    mockUseHiringCandidates.mockReturnValue({
      data: [
        {
          id: "c1",
          leagueId: "lg",
          staffType: "coach",
          firstName: "A",
          lastName: "B",
          role: "HC",
        },
      ],
      isLoading: false,
    });
    mockUseTeamHiringState.mockReturnValue({
      data: {
        leagueId: "lg",
        teamId: "tm",
        staffBudget: 0,
        remainingBudget: 0,
        interests: [
          {
            id: "i1",
            leagueId: "lg",
            teamId: "tm",
            staffType: "coach",
            staffId: "c1",
            stepSlug: "hiring_market_survey",
            status: "active",
          },
        ],
        interviews: [
          {
            id: "iv1",
            leagueId: "lg",
            teamId: "tm",
            staffType: "coach",
            staffId: "c1",
            stepSlug: "hiring_interview_1",
            status,
          },
        ],
        offers: [],
        decisions: [],
      },
      isLoading: false,
    });
    renderPage();
    expect(screen.getByText(expected)).toBeTruthy();
  });
});

describe("Offers view", () => {
  beforeEach(() => {
    mockUseLeagueClock.mockReturnValue({
      data: { slug: "hiring_offers" },
      isLoading: false,
    });
  });

  it("shows empty state when no interviews completed", () => {
    renderPage();
    expect(screen.getByTestId("offers-empty")).toBeTruthy();
  });

  it("shows candidate loading skeleton while fetching", () => {
    mockUseHiringCandidates.mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    renderPage();
    expect(screen.getByTestId("offers-loading")).toBeTruthy();
  });

  it("submits an offer with the default salary", () => {
    mockUseHiringCandidates.mockReturnValue({
      data: [
        {
          id: "c1",
          leagueId: "lg",
          staffType: "coach",
          firstName: "Andy",
          lastName: "Reid",
          role: "HC",
        },
      ],
      isLoading: false,
    });
    mockUseTeamHiringState.mockReturnValue({
      data: {
        leagueId: "lg",
        teamId: "tm",
        staffBudget: 50_000_000,
        remainingBudget: 40_000_000,
        interests: [],
        interviews: [
          {
            id: "iv1",
            leagueId: "lg",
            teamId: "tm",
            staffType: "coach",
            staffId: "c1",
            stepSlug: "hiring_interview_1",
            status: "completed",
          },
        ],
        offers: [],
        decisions: [],
      },
      isLoading: false,
    });
    renderPage();
    fireEvent.click(screen.getByTestId("submit-offer-c1"));
    expect(submitOffersMutate).toHaveBeenCalledWith(
      {
        leagueId: "lg",
        offers: [
          expect.objectContaining({
            candidateId: "c1",
            contractYears: 3,
            buyoutMultiplier: "0.50",
          }),
        ],
      },
      expect.any(Object),
    );
  });

  it("warns when the salary exceeds remaining budget", () => {
    mockUseHiringCandidates.mockReturnValue({
      data: [
        {
          id: "c1",
          leagueId: "lg",
          staffType: "coach",
          firstName: "Andy",
          lastName: "Reid",
          role: "HC",
        },
      ],
      isLoading: false,
    });
    mockUseTeamHiringState.mockReturnValue({
      data: {
        leagueId: "lg",
        teamId: "tm",
        staffBudget: 10_000_000,
        remainingBudget: 1_000_000,
        interests: [],
        interviews: [
          {
            id: "iv1",
            leagueId: "lg",
            teamId: "tm",
            staffType: "coach",
            staffId: "c1",
            stepSlug: "hiring_interview_1",
            status: "completed",
          },
        ],
        offers: [],
        decisions: [],
      },
      isLoading: false,
    });
    renderPage();
    expect(screen.getByTestId("offer-warning-c1").textContent).toContain(
      "exceeds",
    );
    expect(
      screen.getByTestId("submit-offer-c1").hasAttribute("disabled"),
    ).toBe(true);
  });

  it("renders an existing accepted offer read-only", () => {
    mockUseHiringCandidates.mockReturnValue({
      data: [
        {
          id: "c1",
          leagueId: "lg",
          staffType: "coach",
          firstName: "A",
          lastName: "B",
          role: "HC",
        },
      ],
      isLoading: false,
    });
    mockUseTeamHiringState.mockReturnValue({
      data: {
        leagueId: "lg",
        teamId: "tm",
        staffBudget: 0,
        remainingBudget: 0,
        interests: [],
        interviews: [
          {
            id: "iv1",
            leagueId: "lg",
            teamId: "tm",
            staffType: "coach",
            staffId: "c1",
            stepSlug: "hiring_interview_1",
            status: "completed",
          },
        ],
        offers: [
          {
            id: "o1",
            leagueId: "lg",
            teamId: "tm",
            staffType: "coach",
            staffId: "c1",
            stepSlug: "hiring_offers",
            status: "accepted",
            salary: 8_000_000,
            contractYears: 3,
            buyoutMultiplier: "0.50",
          },
        ],
        decisions: [],
      },
      isLoading: false,
    });
    renderPage();
    expect(screen.getByTestId("offer-row-c1").textContent).toContain("$8");
  });

  it("warns when salary is above the band but within budget", () => {
    mockUseHiringCandidates.mockReturnValue({
      data: [
        {
          id: "c1",
          leagueId: "lg",
          staffType: "coach",
          firstName: "A",
          lastName: "B",
          role: "HC",
        },
      ],
      isLoading: false,
    });
    mockUseTeamHiringState.mockReturnValue({
      data: {
        leagueId: "lg",
        teamId: "tm",
        staffBudget: 50_000_000,
        remainingBudget: 50_000_000,
        interests: [],
        interviews: [
          {
            id: "iv1",
            leagueId: "lg",
            teamId: "tm",
            staffType: "coach",
            staffId: "c1",
            stepSlug: "hiring_interview_1",
            status: "completed",
          },
        ],
        offers: [],
        decisions: [],
      },
      isLoading: false,
    });
    renderPage();
    fireEvent.change(screen.getByTestId("offer-salary-c1"), {
      target: { value: "30000000" },
    });
    expect(screen.getByTestId("offer-warning-c1").textContent).toContain(
      "Above",
    );
  });

  it("warns when salary is below the band", () => {
    mockUseHiringCandidates.mockReturnValue({
      data: [
        {
          id: "c1",
          leagueId: "lg",
          staffType: "coach",
          firstName: "A",
          lastName: "B",
          role: "HC",
        },
      ],
      isLoading: false,
    });
    mockUseTeamHiringState.mockReturnValue({
      data: {
        leagueId: "lg",
        teamId: "tm",
        staffBudget: 50_000_000,
        remainingBudget: 50_000_000,
        interests: [],
        interviews: [
          {
            id: "iv1",
            leagueId: "lg",
            teamId: "tm",
            staffType: "coach",
            staffId: "c1",
            stepSlug: "hiring_interview_1",
            status: "completed",
          },
        ],
        offers: [],
        decisions: [],
      },
      isLoading: false,
    });
    renderPage();
    fireEvent.change(screen.getByTestId("offer-salary-c1"), {
      target: { value: "100" },
    });
    expect(screen.getByTestId("offer-warning-c1").textContent).toContain(
      "Below",
    );
  });
});

describe("Decisions view", () => {
  beforeEach(() => {
    mockUseLeagueClock.mockReturnValue({
      data: { slug: "hiring_decisions" },
      isLoading: false,
    });
  });

  it("shows empty state when there are no offers", () => {
    renderPage();
    expect(
      screen.getByText(/didn't have any active offers/i),
    ).toBeTruthy();
  });

  it("renders pending offer with outline status badge", () => {
    mockUseTeamHiringState.mockReturnValue({
      data: {
        leagueId: "lg",
        teamId: "tm",
        staffBudget: 0,
        remainingBudget: 0,
        interests: [],
        interviews: [],
        offers: [
          {
            id: "op",
            leagueId: "lg",
            teamId: "tm",
            staffType: "coach",
            staffId: "pendingabc123",
            stepSlug: "hiring_offers",
            status: "pending",
            salary: 1_000_000,
            contractYears: 2,
            buyoutMultiplier: "0.50",
          },
        ],
        decisions: [],
      },
      isLoading: false,
    });
    renderPage();
    expect(screen.getByTestId("decision-row-op")).toBeTruthy();
  });

  it("renders each offer row with status", () => {
    mockUseTeamHiringState.mockReturnValue({
      data: {
        leagueId: "lg",
        teamId: "tm",
        staffBudget: 0,
        remainingBudget: 0,
        interests: [],
        interviews: [],
        offers: [
          {
            id: "o1",
            leagueId: "lg",
            teamId: "tm",
            staffType: "coach",
            staffId: "abcdef1234567",
            stepSlug: "hiring_offers",
            status: "accepted",
            salary: 8_000_000,
            contractYears: 3,
            buyoutMultiplier: "0.50",
          },
          {
            id: "o2",
            leagueId: "lg",
            teamId: "tm",
            staffType: "coach",
            staffId: "rejected12345",
            stepSlug: "hiring_offers",
            status: "rejected",
            salary: 3_000_000,
            contractYears: 2,
            buyoutMultiplier: "0.50",
          },
        ],
        decisions: [
          {
            id: "d1",
            leagueId: "lg",
            staffType: "coach",
            staffId: "abcdef1234567",
            chosenOfferId: "o1",
            wave: 1,
          },
        ],
      },
      isLoading: false,
    });
    renderPage();
    expect(screen.getByTestId("decision-row-o1")).toBeTruthy();
    expect(screen.getByTestId("decision-row-o2")).toBeTruthy();
  });
});

describe("Finalize view", () => {
  beforeEach(() => {
    mockUseLeagueClock.mockReturnValue({
      data: { slug: "hiring_finalization" },
      isLoading: false,
    });
  });

  it("shows loading state while blockers load", () => {
    mockUseHiringBlockers.mockReturnValue({ data: undefined, isLoading: true });
    renderPage();
    expect(screen.getByTestId("finalize-loading")).toBeTruthy();
  });

  it("shows complete state when no blockers", () => {
    renderPage();
    expect(screen.getByTestId("finalize-complete")).toBeTruthy();
  });

  it("lists blockers and allows hiring a leftover candidate", () => {
    mockUseHiringBlockers.mockReturnValue({
      data: { missingCoachRoles: ["HC"], missingScoutRoles: [] },
      isLoading: false,
    });
    mockUseHiringCandidates.mockReturnValue({
      data: [
        {
          id: "c1",
          leagueId: "lg",
          staffType: "coach",
          firstName: "Leftover",
          lastName: "HC",
          role: "HC",
        },
      ],
      isLoading: false,
    });
    renderPage();
    expect(screen.getByTestId("blocker-coach-HC")).toBeTruthy();
    fireEvent.click(screen.getByTestId("fill-c1"));
    expect(resolveBlockerMutate).toHaveBeenCalledWith(
      { leagueId: "lg", candidateId: "c1" },
      expect.any(Object),
    );
  });

  it("lists missing coach and scout roles with human-readable labels in the alert", () => {
    mockUseHiringBlockers.mockReturnValue({
      data: { missingCoachRoles: ["HC"], missingScoutRoles: ["DIRECTOR"] },
      isLoading: false,
    });
    mockUseHiringCandidates.mockReturnValue({ data: [], isLoading: false });
    renderPage();
    expect(
      screen.getByText(/Head Coach, Director of Scouting/),
    ).toBeTruthy();
  });

  it("defaults to empty blocker and candidate lists when hooks return undefined", () => {
    mockUseHiringBlockers.mockReturnValue({
      data: undefined,
      isLoading: false,
    });
    mockUseHiringCandidates.mockReturnValue({
      data: undefined,
      isLoading: false,
    });
    renderPage();
    expect(screen.getByTestId("finalize-complete")).toBeTruthy();
  });

  it("renders blocker section with undefined candidates list", () => {
    mockUseHiringBlockers.mockReturnValue({
      data: { missingCoachRoles: ["HC"], missingScoutRoles: [] },
      isLoading: false,
    });
    mockUseHiringCandidates.mockReturnValue({
      data: undefined,
      isLoading: false,
    });
    renderPage();
    expect(screen.getByTestId("blocker-coach-HC")).toBeTruthy();
  });

  it("indicates when no leftover candidates are available for a role", () => {
    mockUseHiringBlockers.mockReturnValue({
      data: { missingCoachRoles: [], missingScoutRoles: ["DIRECTOR"] },
      isLoading: false,
    });
    mockUseHiringCandidates.mockReturnValue({ data: [], isLoading: false });
    renderPage();
    expect(screen.getByTestId("blocker-scout-DIRECTOR")).toBeTruthy();
    expect(screen.getAllByText(/No unsigned candidates available/i).length)
      .toBeGreaterThan(0);
  });
});
