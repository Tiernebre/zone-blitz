import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlayerDetail } from "./detail.tsx";

const mockUseParams = vi.fn();
const mockUsePlayerDetail = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useParams: (...args: unknown[]) => mockUseParams(...args),
  Link: (
    { to, params, children, ...rest }: {
      to: string;
      params: Record<string, string>;
      children: React.ReactNode;
    } & Record<string, unknown>,
  ) => {
    let href = to;
    for (const [k, v] of Object.entries(params ?? {})) {
      href = href.replace(`$${k}`, v);
    }
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  },
}));

vi.mock("../../../hooks/use-player-detail.ts", () => ({
  usePlayerDetail: (...args: unknown[]) => mockUsePlayerDetail(...args),
}));

function renderDetail() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PlayerDetail />
    </QueryClientProvider>,
  );
}

const draftedPlayer = {
  id: "p1",
  firstName: "Sam",
  lastName: "Stone",
  neutralBucket: "QB",
  age: 28,
  heightInches: 74,
  weightPounds: 225,
  yearsOfExperience: 5,
  injuryStatus: "healthy",
  currentTeam: {
    id: "t2",
    name: "Bengals",
    city: "Cincinnati",
    abbreviation: "CIN",
  },
  origin: {
    draftYear: 2020,
    draftRound: 1,
    draftPick: 3,
    draftingTeam: {
      id: "t2",
      name: "Bengals",
      city: "Cincinnati",
      abbreviation: "CIN",
    },
    college: "State University",
    hometown: "Dallas, TX",
  },
  currentContract: {
    teamId: "t2",
    totalYears: 4,
    currentYear: 2,
    yearsRemaining: 3,
    annualSalary: 20_000_000,
    totalSalary: 80_000_000,
    guaranteedMoney: 40_000_000,
    signingBonus: 10_000_000,
  },
  contractHistory: [
    {
      id: "h1",
      team: {
        id: "t2",
        name: "Bengals",
        city: "Cincinnati",
        abbreviation: "CIN",
      },
      signedInYear: 2020,
      totalYears: 4,
      totalSalary: 16_000_000,
      guaranteedMoney: 8_000_000,
      terminationReason: "expired",
      endedInYear: 2024,
    },
    {
      id: "h2",
      team: {
        id: "t2",
        name: "Bengals",
        city: "Cincinnati",
        abbreviation: "CIN",
      },
      signedInYear: 2024,
      totalYears: 4,
      totalSalary: 80_000_000,
      guaranteedMoney: 40_000_000,
      terminationReason: "active",
      endedInYear: null,
    },
  ],
  transactions: [
    {
      id: "tx1",
      type: "drafted",
      seasonYear: 2020,
      occurredAt: "2020-04-25T20:00:00.000Z",
      team: {
        id: "t2",
        name: "Bengals",
        city: "Cincinnati",
        abbreviation: "CIN",
      },
      counterpartyTeam: null,
      detail: "Round 1, pick 3 overall",
    },
    {
      id: "tx2",
      type: "extended",
      seasonYear: 2024,
      occurredAt: "2024-08-01T15:00:00.000Z",
      team: {
        id: "t2",
        name: "Bengals",
        city: "Cincinnati",
        abbreviation: "CIN",
      },
      counterpartyTeam: null,
      detail: null,
    },
  ],
  preDraftEvaluation: {
    draftClassYear: 2020,
    projectedRound: 1,
    scoutingNotes: "Franchise-caliber arm talent with strong pocket poise.",
  },
  seasonStats: [
    {
      id: "ss1",
      seasonYear: 2024,
      team: {
        id: "t2",
        name: "Bengals",
        city: "Cincinnati",
        abbreviation: "CIN",
      },
      playoffs: false,
      gamesPlayed: 17,
      gamesStarted: 17,
      stats: { passingYards: 4200, passingTouchdowns: 32 },
    },
    {
      id: "ss2",
      seasonYear: 2024,
      team: {
        id: "t2",
        name: "Bengals",
        city: "Cincinnati",
        abbreviation: "CIN",
      },
      playoffs: true,
      gamesPlayed: 2,
      gamesStarted: 2,
      stats: { passingYards: 480, passingTouchdowns: 4 },
    },
  ],
  accolades: [
    {
      id: "acc1",
      seasonYear: 2024,
      type: "pro_bowl",
      detail: null,
    },
    {
      id: "acc2",
      seasonYear: 2024,
      type: "statistical_milestone",
      detail: "4,000+ passing yards",
    },
  ],
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  mockUseParams.mockReturnValue({ leagueId: "L1", playerId: "p1" });
  mockUsePlayerDetail.mockReturnValue({
    data: draftedPlayer,
    isLoading: false,
    error: null,
  });
});

describe("PlayerDetail — header + origin", () => {
  it("renders a loading skeleton while fetching", () => {
    mockUsePlayerDetail.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });
    renderDetail();
    expect(screen.getByTestId("player-skeleton")).toBeDefined();
  });

  it("renders an error state when fetch fails", () => {
    mockUsePlayerDetail.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("boom"),
    });
    renderDetail();
    expect(screen.getByText(/failed to load player detail/i)).toBeDefined();
  });

  it("renders name, position, age, height/weight, and experience", () => {
    renderDetail();
    const header = screen.getByTestId("player-header");
    expect(header.textContent).toContain("Sam Stone");
    expect(header.textContent).toContain("QB");
    expect(header.textContent).toContain("Age 28");
    expect(header.textContent).toContain("6'2\"");
    expect(header.textContent).toContain("225 lbs");
    expect(header.textContent).toContain("5 yr exp");
    expect(header.textContent).toMatch(/healthy/i);
  });

  it("links the current team to its opponent roster page", () => {
    renderDetail();
    const link = screen.getByTestId(
      "player-current-team-link",
    ) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/leagues/L1/opponents/t2");
  });

  it("renders origin with draft pick, drafting team, college, and hometown", () => {
    renderDetail();
    const origin = screen.getByTestId("player-origin");
    expect(screen.getByTestId("player-origin-draft").textContent).toContain(
      "Round 1",
    );
    expect(screen.getByTestId("player-origin-draft").textContent).toContain(
      "3rd",
    );
    expect(origin.textContent).toContain("State University");
    expect(origin.textContent).toContain("Dallas, TX");
    const link = screen.getByTestId(
      "player-drafting-team-link",
    ) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/leagues/L1/opponents/t2");
  });

  it("shows Undrafted when the player was not drafted", () => {
    mockUsePlayerDetail.mockReturnValue({
      data: {
        ...draftedPlayer,
        currentTeam: null,
        origin: {
          ...draftedPlayer.origin,
          draftYear: null,
          draftRound: null,
          draftPick: null,
          draftingTeam: null,
          college: null,
          hometown: null,
        },
      },
      isLoading: false,
      error: null,
    });
    renderDetail();
    expect(screen.getByTestId("player-origin-undrafted")).toBeDefined();
    expect(screen.getByText(/unsigned free agent/i)).toBeDefined();
  });

  it("renders an 'out' badge in red when the player is out", () => {
    mockUsePlayerDetail.mockReturnValue({
      data: { ...draftedPlayer, injuryStatus: "out" },
      isLoading: false,
      error: null,
    });
    renderDetail();
    expect(screen.getByTestId("player-header").textContent).toMatch(/out/i);
  });

  it("renders a 'questionable' badge for intermediate statuses", () => {
    mockUsePlayerDetail.mockReturnValue({
      data: { ...draftedPlayer, injuryStatus: "questionable" },
      isLoading: false,
      error: null,
    });
    renderDetail();
    expect(screen.getByTestId("player-header").textContent).toMatch(
      /questionable/i,
    );
  });

  it("formats draft picks in the teens with 'th' suffix", () => {
    mockUsePlayerDetail.mockReturnValue({
      data: {
        ...draftedPlayer,
        origin: { ...draftedPlayer.origin, draftPick: 12 },
      },
      isLoading: false,
      error: null,
    });
    renderDetail();
    expect(screen.getByTestId("player-origin-draft").textContent).toContain(
      "12th",
    );
  });

  it("formats a 1st-overall pick correctly", () => {
    mockUsePlayerDetail.mockReturnValue({
      data: {
        ...draftedPlayer,
        origin: { ...draftedPlayer.origin, draftPick: 1 },
      },
      isLoading: false,
      error: null,
    });
    renderDetail();
    expect(screen.getByTestId("player-origin-draft").textContent).toContain(
      "1st",
    );
  });

  it("formats a 22nd-overall pick correctly", () => {
    mockUsePlayerDetail.mockReturnValue({
      data: {
        ...draftedPlayer,
        origin: { ...draftedPlayer.origin, draftPick: 22 },
      },
      isLoading: false,
      error: null,
    });
    renderDetail();
    expect(screen.getByTestId("player-origin-draft").textContent).toContain(
      "22nd",
    );
  });

  it("renders the current contract card with years, cap hit, total, and guaranteed", () => {
    renderDetail();
    const card = screen.getByTestId("player-current-contract");
    expect(card.textContent).toContain("3/4");
    expect(card.textContent).toContain("$20,000,000");
    expect(card.textContent).toContain("$80,000,000");
    expect(card.textContent).toContain("$40,000,000");
  });

  it("renders every contract history row with signed year and outcome", () => {
    renderDetail();
    expect(screen.getByTestId("player-contract-history-row-h1").textContent)
      .toContain("Expired");
    expect(screen.getByTestId("player-contract-history-row-h1").textContent)
      .toContain("2024");
    expect(screen.getByTestId("player-contract-history-row-h2").textContent)
      .toContain("Active");
  });

  it("shows 'Not under contract' when the player has no current deal", () => {
    mockUsePlayerDetail.mockReturnValue({
      data: {
        ...draftedPlayer,
        currentContract: null,
        contractHistory: [],
        transactions: [],
        seasonStats: [],
        accolades: [],
      },
      isLoading: false,
      error: null,
    });
    renderDetail();
    expect(screen.getByTestId("player-no-current-contract")).toBeDefined();
    expect(screen.getByTestId("player-contract-history-empty")).toBeDefined();
    expect(screen.getByTestId("player-transactions-empty")).toBeDefined();
    expect(screen.getByTestId("player-career-log-empty")).toBeDefined();
    expect(screen.getByTestId("player-accolades-empty")).toBeDefined();
  });

  it("renders the regular-season and playoff career log tables", () => {
    renderDetail();
    const regular = screen.getByTestId("player-career-log-regular");
    expect(regular.textContent).toContain("2024");
    expect(regular.textContent).toContain("4,200");
    expect(regular.textContent).toContain("32");
    const playoffs = screen.getByTestId("player-career-log-playoffs");
    expect(playoffs.textContent).toContain("480");
  });

  it("renders accolade rows with labelled honors", () => {
    renderDetail();
    expect(screen.getByTestId("player-accolade-acc1").textContent).toContain(
      "Pro Bowl",
    );
    expect(screen.getByTestId("player-accolade-acc2").textContent).toContain(
      "Milestone",
    );
    expect(screen.getByTestId("player-accolade-acc2").textContent).toContain(
      "4,000+ passing yards",
    );
  });

  it("renders a trade transaction with both teams and a missing-team row", () => {
    mockUsePlayerDetail.mockReturnValue({
      data: {
        ...draftedPlayer,
        transactions: [
          {
            id: "tx-trade",
            type: "traded",
            seasonYear: 2023,
            occurredAt: "2023-10-30T12:00:00.000Z",
            team: {
              id: "t3",
              name: "Eagles",
              city: "Philadelphia",
              abbreviation: "PHI",
            },
            counterpartyTeam: {
              id: "t4",
              name: "Cowboys",
              city: "Dallas",
              abbreviation: "DAL",
            },
            detail: "Traded for two picks",
          },
          {
            id: "tx-released",
            type: "released",
            seasonYear: 2024,
            occurredAt: "2024-03-01T12:00:00.000Z",
            team: null,
            counterpartyTeam: null,
            detail: null,
          },
        ],
      },
      isLoading: false,
      error: null,
    });
    renderDetail();
    const trade = screen.getByTestId("player-transaction-row-tx-trade");
    expect(trade.textContent).toContain("PHI");
    expect(trade.textContent).toContain("DAL");
    const released = screen.getByTestId("player-transaction-row-tx-released");
    expect(released.textContent).toContain("Released");
  });

  it("renders a transactions table with labelled events", () => {
    renderDetail();
    const drafted = screen.getByTestId("player-transaction-row-tx1");
    expect(drafted.textContent).toContain("Drafted");
    expect(drafted.textContent).toContain("2020");
    expect(drafted.textContent).toContain("Round 1, pick 3 overall");
    const extended = screen.getByTestId("player-transaction-row-tx2");
    expect(extended.textContent).toContain("Extended");
  });

  it("does not leak attributes, overall rating, or scout grade", () => {
    renderDetail();
    const main = document.body;
    expect(main.textContent).not.toMatch(/overall rating/i);
    expect(main.textContent).not.toMatch(/\bOVR\b/);
    expect(main.textContent).not.toMatch(/scout grade/i);
    expect(main.textContent).not.toMatch(/potential/i);
  });

  it("renders the pre-draft evaluation when present", () => {
    renderDetail();
    const panel = screen.getByTestId("player-pre-draft");
    expect(panel.textContent).toContain("Draft class");
    expect(screen.getByTestId("player-pre-draft-class").textContent).toBe(
      "2020",
    );
    expect(
      screen.getByTestId("player-pre-draft-projection").textContent,
    ).toContain("Round 1");
    expect(screen.getByTestId("player-pre-draft-notes").textContent).toContain(
      "Franchise-caliber",
    );
  });

  it("omits the pre-draft evaluation when the profile is missing", () => {
    mockUsePlayerDetail.mockReturnValue({
      data: { ...draftedPlayer, preDraftEvaluation: null },
      isLoading: false,
      error: null,
    });
    renderDetail();
    expect(screen.queryByTestId("player-pre-draft")).toBeNull();
  });

  it("shows Unprojected when the projected round is null", () => {
    mockUsePlayerDetail.mockReturnValue({
      data: {
        ...draftedPlayer,
        preDraftEvaluation: {
          draftClassYear: 2020,
          projectedRound: null,
          scoutingNotes: null,
        },
      },
      isLoading: false,
      error: null,
    });
    renderDetail();
    expect(screen.getByTestId("player-pre-draft").textContent).toContain(
      "Unprojected",
    );
    expect(screen.queryByTestId("player-pre-draft-notes")).toBeNull();
  });
});
