import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { Hiring } from "./index.tsx";

const mockUseParams = vi.fn();
const mockUseLeagueClock = vi.fn();
const mockUseLeague = vi.fn();
const mockUseTeamHiringState = vi.fn();
const mockUseHiringCandidates = vi.fn();
const mockUseStaffTree = vi.fn();
const mockUseScoutStaffTree = vi.fn();

const expressInterestMutate = vi.fn();
const requestInterviewsMutate = vi.fn();
const submitOffersMutate = vi.fn();

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
}));

vi.mock("../../../hooks/use-staff-tree.ts", () => ({
  useStaffTree: (...args: unknown[]) => mockUseStaffTree(...args),
}));

vi.mock("../../../hooks/use-scout-staff-tree.ts", () => ({
  useScoutStaffTree: (...args: unknown[]) => mockUseScoutStaffTree(...args),
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
  mockUseHiringCandidates.mockReturnValue({ data: [], isLoading: false });
  mockUseStaffTree.mockReturnValue({ data: [], isLoading: false });
  mockUseScoutStaffTree.mockReturnValue({ data: [], isLoading: false });
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

  it("toasts on express-interest success and error callbacks", () => {
    renderPage();
    fireEvent.click(screen.getByTestId("express-interest-c1"));
    const opts = expressInterestMutate.mock.calls[0][1] as {
      onSuccess: () => void;
      onError: (e: Error) => void;
    };
    opts.onSuccess();
    opts.onError(new Error("nope"));
    expect(toast.success).toHaveBeenCalledWith("Interest noted");
    expect(toast.error).toHaveBeenCalledWith("nope");
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
    const opts = requestInterviewsMutate.mock.calls[0][1] as {
      onSuccess: () => void;
      onError: (e: Error) => void;
    };
    opts.onSuccess();
    opts.onError(new Error("declined"));
    expect(toast.success).toHaveBeenCalledWith("Interview requested");
    expect(toast.error).toHaveBeenCalledWith("declined");
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
    const opts = submitOffersMutate.mock.calls[0][1] as {
      onSuccess: () => void;
      onError: (e: Error) => void;
    };
    opts.onSuccess();
    opts.onError(new Error("over budget"));
    expect(toast.success).toHaveBeenCalledWith("Offer submitted");
    expect(toast.error).toHaveBeenCalledWith("over budget");
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

describe("Staff result view", () => {
  beforeEach(() => {
    mockUseLeagueClock.mockReturnValue({
      data: { slug: "hiring_finalization" },
      isLoading: false,
    });
  });

  it("shows loading skeleton while staff trees load", () => {
    mockUseStaffTree.mockReturnValue({ data: undefined, isLoading: true });
    mockUseScoutStaffTree.mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    renderPage();
    expect(screen.getByTestId("staff-result-loading")).toBeTruthy();
  });

  it("renders coaches and scouts grouped after assembly", () => {
    mockUseStaffTree.mockReturnValue({
      data: [
        {
          id: "hc1",
          firstName: "Andy",
          lastName: "Reid",
          role: "HC",
          reportsToId: null,
          playCaller: null,
          specialty: null,
          age: 60,
          yearsWithTeam: 1,
          contractYearsRemaining: 4,
          isVacancy: false,
        },
        {
          id: "oc1",
          firstName: "Matt",
          lastName: "Nagy",
          role: "OC",
          reportsToId: "hc1",
          playCaller: null,
          specialty: null,
          age: 45,
          yearsWithTeam: 1,
          contractYearsRemaining: 3,
          isVacancy: false,
        },
      ],
      isLoading: false,
    });
    mockUseScoutStaffTree.mockReturnValue({
      data: [
        {
          id: "ds1",
          firstName: "Brett",
          lastName: "Veach",
          role: "DIRECTOR",
          reportsToId: null,
          coverage: null,
          age: 50,
          yearsWithTeam: 1,
          contractYearsRemaining: 4,
          workCapacity: 10,
          isVacancy: false,
        },
      ],
      isLoading: false,
    });
    renderPage();
    expect(screen.getByTestId("staff-result-view")).toBeTruthy();
    expect(screen.getByTestId("staff-row-hc1").textContent).toContain("Andy");
    expect(screen.getByTestId("staff-row-oc1").textContent).toContain("Nagy");
    expect(screen.getByTestId("staff-row-ds1").textContent).toContain("Brett");
  });

  it("renders empty messages when no staff is on either tree", () => {
    renderPage();
    expect(screen.getByTestId("staff-result-coaches").textContent).toContain(
      "No coaches",
    );
    expect(screen.getByTestId("staff-result-scouts").textContent).toContain(
      "No scouts",
    );
  });

  it("treats undefined staff trees as empty after loading completes", () => {
    mockUseStaffTree.mockReturnValue({ data: undefined, isLoading: false });
    mockUseScoutStaffTree.mockReturnValue({
      data: undefined,
      isLoading: false,
    });
    renderPage();
    expect(screen.getByTestId("staff-result-coaches").textContent).toContain(
      "No coaches",
    );
    expect(screen.getByTestId("staff-result-scouts").textContent).toContain(
      "No scouts",
    );
  });

  it("marks vacancies with a Vacant badge", () => {
    mockUseStaffTree.mockReturnValue({
      data: [
        {
          id: "v1",
          firstName: "",
          lastName: "",
          role: "OC",
          reportsToId: null,
          playCaller: null,
          specialty: null,
          age: 0,
          yearsWithTeam: 0,
          contractYearsRemaining: 0,
          isVacancy: true,
        },
      ],
      isLoading: false,
    });
    renderPage();
    expect(screen.getByTestId("staff-row-v1").textContent).toContain("Vacant");
  });

  it("falls back to empty state when team id is missing", () => {
    mockUseTeamHiringState.mockReturnValue({
      data: undefined,
      isLoading: false,
    });
    renderPage();
    expect(screen.getByTestId("staff-result-view")).toBeTruthy();
  });
});
