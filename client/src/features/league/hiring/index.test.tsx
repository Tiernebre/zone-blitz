import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import {
  Hiring,
  positionFilterLabel,
  regionFilterLabel,
  schemeOptionLabel,
} from "./index.tsx";

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

describe("positionFilterLabel", () => {
  it("polishes a known position group", () => {
    expect(positionFilterLabel("QB")).toBe("Quarterbacks");
  });

  it("echoes back unknown position keys so missing labels surface", () => {
    expect(positionFilterLabel("MASCOT")).toBe("MASCOT");
  });

  it("falls back to the raw value when the shared label resolver returns null", () => {
    // positionGroupLabel returns null for an empty string — the wrapper's
    // `?? value` keeps the dropdown rendering something instead of "null".
    expect(positionFilterLabel("")).toBe("");
  });
});

describe("regionFilterLabel", () => {
  it("polishes a known region", () => {
    expect(regionFilterLabel("MIDWEST")).toBe("Midwest");
  });

  it("echoes back unknown region keys", () => {
    expect(regionFilterLabel("MARS")).toBe("MARS");
  });

  it("falls back to the raw value when the shared label resolver returns null", () => {
    expect(regionFilterLabel("")).toBe("");
  });
});

describe("schemeOptionLabel", () => {
  it("labels the CEO bucket distinctly", () => {
    expect(schemeOptionLabel("ceo")).toBe("Defers to coordinators");
  });

  it("returns a polished label for known offensive and defensive schemes", () => {
    expect(schemeOptionLabel("shanahan_wide_zone")).toBe("Wide Zone");
    expect(schemeOptionLabel("fangio_two_high")).toBe("Fangio Two-High");
  });

  it("echoes back unknown scheme keys so missing labels surface visibly", () => {
    expect(schemeOptionLabel("smashmouth_2026")).toBe("smashmouth_2026");
  });
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
          specialty: "offense",
          offensiveArchetype: "pro_style_timing",
          defensiveArchetype: null,
          age: 54,
          yearsExperience: 28,
          positionBackground: "QB",
        },
        {
          id: "c2",
          leagueId: "lg",
          staffType: "coach",
          firstName: "Kyle",
          lastName: "Shanahan",
          role: "OC",
          specialty: "offense",
          offensiveArchetype: "shanahan_wide_zone",
          defensiveArchetype: null,
          age: 44,
          yearsExperience: 18,
        },
        {
          id: "c3",
          leagueId: "lg",
          staffType: "coach",
          firstName: "Bill",
          lastName: "Belichick",
          role: "HC",
          specialty: "defense",
          offensiveArchetype: null,
          defensiveArchetype: "fangio_two_high",
          age: 60,
          yearsExperience: 35,
          positionBackground: "DB",
        },
        {
          id: "c4",
          leagueId: "lg",
          staffType: "coach",
          firstName: "Andy",
          lastName: "Manager",
          role: "HC",
          specialty: "ceo",
          offensiveArchetype: null,
          defensiveArchetype: null,
          age: 50,
          yearsExperience: 1,
          positionBackground: "GENERALIST",
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

  it("does not render a search bar in the market survey", () => {
    renderPage();
    expect(screen.queryByLabelText("Search candidates")).toBeNull();
  });

  it("shows an offensive HC's background and scheme", () => {
    renderPage();
    expect(
      screen.getByTestId("candidate-background-c1").textContent,
    ).toBe("Offensive background");
    expect(
      screen.getByTestId("candidate-scheme-c1").textContent,
    ).toBe("Pro Style");
  });

  it("shows a defensive HC's background and scheme", () => {
    renderPage();
    expect(
      screen.getByTestId("candidate-background-c3").textContent,
    ).toBe("Defensive background");
    expect(
      screen.getByTestId("candidate-scheme-c3").textContent,
    ).toBe("Fangio Two-High");
  });

  it("calls out CEO HCs as deferring to coordinators", () => {
    renderPage();
    expect(
      screen.getByTestId("candidate-background-c4").textContent,
    ).toBe("CEO / manager");
    expect(
      screen.getByTestId("candidate-scheme-c4").textContent,
    ).toBe("Defers to coordinators");
  });

  it("shows age and years of experience so vets and first-timers are distinguishable", () => {
    renderPage();
    expect(
      screen.getByTestId("candidate-age-c1").textContent,
    ).toBe("54");
    expect(
      screen.getByTestId("candidate-experience-c1").textContent,
    ).toBe("28 yrs");
    // Grammar for the single-year case — a first-time first-year HC.
    expect(
      screen.getByTestId("candidate-experience-c4").textContent,
    ).toBe("1 yr");
  });

  it("shows a coach's position background so tl;dr career roots are scannable", () => {
    renderPage();
    expect(
      screen.getByTestId("candidate-position-c1").textContent,
    ).toBe("Quarterbacks");
    expect(
      screen.getByTestId("candidate-position-c3").textContent,
    ).toBe("Defensive Backs");
    expect(
      screen.getByTestId("candidate-position-c4").textContent,
    ).toBe("Generalist");
  });

  it("does not render a Role column — every leadership candidate is HC or DIRECTOR", () => {
    renderPage();
    expect(
      screen.queryByRole("columnheader", { name: /^Role$/ }),
    ).toBeNull();
  });

  it("labels the position column 'Position Specialty' on the coach tab", () => {
    renderPage();
    expect(
      screen.getByRole("columnheader", { name: /Position Specialty/i }),
    ).toBeTruthy();
  });

  it("filters coach candidates by background", async () => {
    renderPage();
    fireEvent.change(
      screen.getByTestId("market-coach-table-filter-background"),
      { target: { value: "defense" } },
    );
    await waitFor(() => {
      expect(screen.queryByTestId("candidate-row-c1")).toBeNull();
      expect(screen.getByTestId("candidate-row-c3")).toBeTruthy();
    });
  });

  it("filters coach candidates by scheme", async () => {
    renderPage();
    fireEvent.change(
      screen.getByTestId("market-coach-table-filter-scheme"),
      { target: { value: "shanahan_wide_zone" } },
    );
    await waitFor(() => {
      expect(screen.queryByTestId("candidate-row-c1")).toBeNull();
      expect(screen.getByTestId("candidate-row-c2")).toBeTruthy();
    });
  });

  it("filters coach candidates by position specialty", async () => {
    renderPage();
    fireEvent.change(
      screen.getByTestId("market-coach-table-filter-position"),
      { target: { value: "DB" } },
    );
    await waitFor(() => {
      expect(screen.getByTestId("candidate-row-c3")).toBeTruthy();
      expect(screen.queryByTestId("candidate-row-c1")).toBeNull();
    });
  });

  it("filters coach candidates by CEO scheme bucket", async () => {
    renderPage();
    fireEvent.change(
      screen.getByTestId("market-coach-table-filter-scheme"),
      { target: { value: "ceo" } },
    );
    await waitFor(() => {
      expect(screen.getByTestId("candidate-row-c4")).toBeTruthy();
      expect(screen.queryByTestId("candidate-row-c1")).toBeNull();
    });
  });

  it("clears a filter back to all candidates when 'All' is selected", async () => {
    renderPage();
    fireEvent.change(
      screen.getByTestId("market-coach-table-filter-background"),
      { target: { value: "defense" } },
    );
    await waitFor(() => {
      expect(screen.queryByTestId("candidate-row-c1")).toBeNull();
    });
    fireEvent.change(
      screen.getByTestId("market-coach-table-filter-background"),
      { target: { value: "all" } },
    );
    await waitFor(() => {
      expect(screen.getByTestId("candidate-row-c1")).toBeTruthy();
    });
  });

  it("shows a scouting director's region and position focus on the scout tab", () => {
    mockUseHiringCandidates.mockReturnValue({
      data: [
        {
          id: "s1",
          leagueId: "lg",
          staffType: "scout",
          firstName: "Ron",
          lastName: "Wolf",
          role: "DIRECTOR",
          specialty: null,
          offensiveArchetype: null,
          defensiveArchetype: null,
          age: 58,
          yearsExperience: 30,
          positionBackground: null,
          positionFocus: "GENERALIST",
          regionFocus: "SOUTHEAST",
        },
      ],
      isLoading: false,
    });
    renderPage();
    fireEvent.click(screen.getByTestId("market-tab-scout"));
    expect(
      screen.getByTestId("candidate-region-s1").textContent,
    ).toBe("Southeast");
    expect(
      screen.getByTestId("candidate-position-s1").textContent,
    ).toBe("Generalist");
  });

  it("filters scout candidates by region", async () => {
    mockUseHiringCandidates.mockReturnValue({
      data: [
        {
          id: "s1",
          leagueId: "lg",
          staffType: "scout",
          firstName: "Ron",
          lastName: "Wolf",
          role: "DIRECTOR",
          specialty: null,
          offensiveArchetype: null,
          defensiveArchetype: null,
          age: 58,
          yearsExperience: 30,
          positionBackground: null,
          positionFocus: "GENERALIST",
          regionFocus: "SOUTHEAST",
        },
        {
          id: "s2",
          leagueId: "lg",
          staffType: "scout",
          firstName: "Bill",
          lastName: "Polian",
          role: "DIRECTOR",
          specialty: null,
          offensiveArchetype: null,
          defensiveArchetype: null,
          age: 60,
          yearsExperience: 32,
          positionBackground: null,
          positionFocus: "QB",
          regionFocus: "MIDWEST",
        },
      ],
      isLoading: false,
    });
    renderPage();
    fireEvent.click(screen.getByTestId("market-tab-scout"));
    fireEvent.change(
      screen.getByTestId("market-scout-table-filter-region"),
      { target: { value: "MIDWEST" } },
    );
    await waitFor(() => {
      expect(screen.queryByTestId("candidate-row-s1")).toBeNull();
      expect(screen.getByTestId("candidate-row-s2")).toBeTruthy();
    });
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
