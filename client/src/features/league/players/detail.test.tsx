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
  status: "active",
  jerseyNumber: 9,
  neutralBucket: "QB",
  schemeArchetype: null,
  age: 28,
  birthDate: "1998-03-10",
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
    signedYear: 2024,
    totalYears: 4,
    realYears: 4,
    signingBonus: 10_000_000,
    isRookieDeal: false,
    tagType: null,
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
  contractLedger: [
    {
      id: "cl-current",
      team: {
        id: "t2",
        name: "Bengals",
        city: "Cincinnati",
        abbreviation: "CIN",
      },
      contractType: "rookie_scale",
      signedInYear: 2024,
      totalYears: 4,
      totalValue: 80_000_000,
      guaranteedAtSigning: 40_000_000,
      signingBonus: 10_000_000,
      years: [
        {
          yearNumber: 1,
          baseSalary: 17_500_000,
          signingBonusProration: 2_500_000,
          rosterBonus: 0,
          workoutBonus: 0,
          capHit: 20_000_000,
          deadCap: 10_000_000,
          cashPaid: 27_500_000,
          isVoid: false,
        },
        {
          yearNumber: 2,
          baseSalary: 17_500_000,
          signingBonusProration: 2_500_000,
          rosterBonus: 0,
          workoutBonus: 0,
          capHit: 20_000_000,
          deadCap: 7_500_000,
          cashPaid: 17_500_000,
          isVoid: false,
        },
        {
          yearNumber: 3,
          baseSalary: 17_500_000,
          signingBonusProration: 2_500_000,
          rosterBonus: 0,
          workoutBonus: 0,
          capHit: 20_000_000,
          deadCap: 5_000_000,
          cashPaid: 17_500_000,
          isVoid: false,
        },
        {
          yearNumber: 4,
          baseSalary: 17_500_000,
          signingBonusProration: 2_500_000,
          rosterBonus: 0,
          workoutBonus: 0,
          capHit: 20_000_000,
          deadCap: 2_500_000,
          cashPaid: 17_500_000,
          isVoid: false,
        },
      ],
      isCurrent: true,
    },
    {
      id: "cl-prior",
      team: {
        id: "t2",
        name: "Bengals",
        city: "Cincinnati",
        abbreviation: "CIN",
      },
      contractType: "veteran",
      signedInYear: 2020,
      totalYears: 4,
      totalValue: 16_000_000,
      guaranteedAtSigning: 8_000_000,
      signingBonus: 2_000_000,
      years: [
        {
          yearNumber: 1,
          baseSalary: 3_500_000,
          signingBonusProration: 500_000,
          rosterBonus: 0,
          workoutBonus: 0,
          capHit: 4_000_000,
          deadCap: 2_000_000,
          cashPaid: 5_500_000,
          isVoid: false,
        },
        {
          yearNumber: 2,
          baseSalary: 3_500_000,
          signingBonusProration: 500_000,
          rosterBonus: 0,
          workoutBonus: 0,
          capHit: 4_000_000,
          deadCap: 1_500_000,
          cashPaid: 3_500_000,
          isVoid: false,
        },
        {
          yearNumber: 3,
          baseSalary: 3_500_000,
          signingBonusProration: 500_000,
          rosterBonus: 0,
          workoutBonus: 0,
          capHit: 4_000_000,
          deadCap: 1_000_000,
          cashPaid: 3_500_000,
          isVoid: false,
        },
        {
          yearNumber: 4,
          baseSalary: 3_500_000,
          signingBonusProration: 500_000,
          rosterBonus: 0,
          workoutBonus: 0,
          capHit: 4_000_000,
          deadCap: 500_000,
          cashPaid: 3_500_000,
          isVoid: false,
        },
      ],
      isCurrent: false,
      terminationReason: "expired",
      endedInYear: 2024,
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
      tradeId: null,
      counterpartyPlayer: null,
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
      tradeId: null,
      counterpartyPlayer: null,
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

describe("PlayerDetail — loading and error states", () => {
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
});

describe("PlayerDetail — breadcrumb", () => {
  it("shows Team > Roster > Player for a rostered player", () => {
    renderDetail();
    const breadcrumb = screen.getByLabelText("breadcrumb");
    expect(breadcrumb.textContent).toContain("Cincinnati Bengals");
    expect(breadcrumb.textContent).toContain("Roster");
    expect(breadcrumb.textContent).toContain("Sam Stone");
  });

  it("links the team breadcrumb to the opponent roster page", () => {
    renderDetail();
    const breadcrumb = screen.getByLabelText("breadcrumb");
    const links = breadcrumb.querySelectorAll("a");
    const teamLink = Array.from(links).find((l) =>
      l.textContent?.includes("Cincinnati Bengals")
    );
    expect(teamLink?.getAttribute("href")).toBe("/leagues/L1/opponents/t2");
  });

  it("shows Free Agents > Player for a free agent", () => {
    mockUsePlayerDetail.mockReturnValue({
      data: {
        ...draftedPlayer,
        status: "active",
        currentTeam: null,
      },
      isLoading: false,
      error: null,
    });
    renderDetail();
    const breadcrumb = screen.getByLabelText("breadcrumb");
    expect(breadcrumb.textContent).toContain("Free Agents");
    expect(breadcrumb.textContent).toContain("Sam Stone");
    expect(breadcrumb.textContent).not.toContain("Roster");
  });

  it("shows Draft year > Player for a pre-draft prospect", () => {
    mockUsePlayerDetail.mockReturnValue({
      data: {
        ...draftedPlayer,
        status: "prospect",
        currentTeam: null,
        preDraftEvaluation: {
          draftClassYear: 2026,
          projectedRound: 1,
          scoutingNotes: null,
        },
      },
      isLoading: false,
      error: null,
    });
    renderDetail();
    const breadcrumb = screen.getByLabelText("breadcrumb");
    expect(breadcrumb.textContent).toContain("Draft 2026");
    expect(breadcrumb.textContent).toContain("Sam Stone");
  });
});

describe("PlayerDetail — biography header", () => {
  it("renders a generic silhouette headshot", () => {
    renderDetail();
    expect(screen.getByTestId("player-headshot")).toBeDefined();
  });

  it("renders name, jersey number, position, team, and status", () => {
    renderDetail();
    const header = screen.getByTestId("player-header");
    expect(header.textContent).toContain("Sam Stone");
    expect(header.textContent).toContain("#9");
    expect(header.textContent).toContain("QB");
    expect(header.textContent).toContain("Cincinnati Bengals");
    expect(header.textContent).toMatch(/active/i);
  });

  it("renders injury status badge when not healthy", () => {
    mockUsePlayerDetail.mockReturnValue({
      data: { ...draftedPlayer, injuryStatus: "ir" },
      isLoading: false,
      error: null,
    });
    renderDetail();
    const header = screen.getByTestId("player-header");
    expect(header.textContent).toMatch(/ir/i);
  });

  it("renders physical measurements: height and weight", () => {
    renderDetail();
    const header = screen.getByTestId("player-header");
    expect(header.textContent).toContain("6'2\"");
    expect(header.textContent).toContain("225 lbs");
  });

  it("renders background: age, birthdate, hometown, college", () => {
    renderDetail();
    const header = screen.getByTestId("player-header");
    expect(header.textContent).toContain("Age 28");
    expect(header.textContent).toContain("1998");
    expect(header.textContent).toContain("Dallas, TX");
    expect(header.textContent).toContain("State University");
  });

  it("renders experience: years, draft info, Pro Bowl count", () => {
    renderDetail();
    const header = screen.getByTestId("player-header");
    expect(header.textContent).toContain("5 yr exp");
    expect(header.textContent).toContain("2020");
    expect(header.textContent).toContain("Rd 1");
    expect(header.textContent).toContain("Pick 3");
    expect(header.textContent).toContain("1× Pro Bowl");
  });

  it("renders All-Pro count when present", () => {
    mockUsePlayerDetail.mockReturnValue({
      data: {
        ...draftedPlayer,
        accolades: [
          ...draftedPlayer.accolades,
          { id: "acc3", seasonYear: 2023, type: "all_pro_first", detail: null },
          {
            id: "acc4",
            seasonYear: 2022,
            type: "all_pro_second",
            detail: null,
          },
        ],
      },
      isLoading: false,
      error: null,
    });
    renderDetail();
    const header = screen.getByTestId("player-header");
    expect(header.textContent).toContain("2× All-Pro");
  });

  it("shows Unsigned free agent for a player with no team", () => {
    mockUsePlayerDetail.mockReturnValue({
      data: {
        ...draftedPlayer,
        currentTeam: null,
        status: "active",
      },
      isLoading: false,
      error: null,
    });
    renderDetail();
    const header = screen.getByTestId("player-header");
    expect(header.textContent).toContain("Free Agent");
  });

  it("shows undrafted for a player with no draft info", () => {
    mockUsePlayerDetail.mockReturnValue({
      data: {
        ...draftedPlayer,
        origin: {
          ...draftedPlayer.origin,
          draftYear: null,
          draftRound: null,
          draftPick: null,
          draftingTeam: null,
        },
      },
      isLoading: false,
      error: null,
    });
    renderDetail();
    const header = screen.getByTestId("player-header");
    expect(header.textContent).toMatch(/undrafted/i);
  });

  it("omits jersey number when null", () => {
    mockUsePlayerDetail.mockReturnValue({
      data: { ...draftedPlayer, jerseyNumber: null },
      isLoading: false,
      error: null,
    });
    renderDetail();
    const header = screen.getByTestId("player-header");
    expect(header.textContent).not.toContain("#");
  });
});

describe("PlayerDetail — contract ledger", () => {
  it("renders the current contract block with year-by-year rows", () => {
    renderDetail();
    const card = screen.getByTestId("player-current-contract");
    expect(card.textContent).toContain("Rookie Scale");
    expect(card.textContent).toContain("4 years");
    expect(card.textContent).toContain("Signed 2024");
    expect(card.textContent).toContain("Cincinnati Bengals");
    expect(screen.getByTestId("player-current-contract-year-1")).toBeDefined();
    expect(screen.getByTestId("player-current-contract-year-4")).toBeDefined();
  });

  it("renders per-year cap hit and dead cap values", () => {
    renderDetail();
    const y1 = screen.getByTestId("player-current-contract-year-1");
    expect(y1.textContent).toContain("$17,500,000");
    expect(y1.textContent).toContain("$2,500,000");
    expect(y1.textContent).toContain("$20,000,000");
    expect(y1.textContent).toContain("$10,000,000");
  });

  it("renders totals row with total value, guaranteed, and cash to date", () => {
    renderDetail();
    const totals = screen.getByTestId("player-current-contract-totals");
    expect(totals.textContent).toContain("$80,000,000");
    expect(totals.textContent).toContain("$40,000,000");
  });

  it("renders the rookie-scale label on rookie contracts", () => {
    renderDetail();
    expect(
      screen.getByTestId("player-current-contract-rookie-label"),
    ).toBeDefined();
  });

  it("renders prior contracts collapsed by default", () => {
    renderDetail();
    expect(screen.getByTestId("player-prior-contracts")).toBeDefined();
    expect(
      screen.getByTestId("player-prior-contract-trigger-cl-prior"),
    ).toBeDefined();
  });

  it("renders void years flagged as void", () => {
    mockUsePlayerDetail.mockReturnValue({
      data: {
        ...draftedPlayer,
        contractLedger: [
          {
            ...draftedPlayer.contractLedger[0],
            years: [
              ...draftedPlayer.contractLedger[0].years,
              {
                yearNumber: 5,
                baseSalary: 0,
                signingBonusProration: 2_000_000,
                rosterBonus: 0,
                workoutBonus: 0,
                capHit: 2_000_000,
                deadCap: 2_000_000,
                cashPaid: 0,
                isVoid: true,
              },
            ],
          },
        ],
      },
      isLoading: false,
      error: null,
    });
    renderDetail();
    const voidRow = screen.getByTestId("player-current-contract-void-5");
    expect(voidRow.textContent).toContain("Void");
  });

  it("shows 'Not under contract' when the player has no deals", () => {
    mockUsePlayerDetail.mockReturnValue({
      data: {
        ...draftedPlayer,
        currentContract: null,
        contractHistory: [],
        contractLedger: [],
        transactions: [],
        seasonStats: [],
        accolades: [],
      },
      isLoading: false,
      error: null,
    });
    renderDetail();
    expect(screen.getByTestId("player-no-current-contract")).toBeDefined();
    expect(screen.getByTestId("player-transactions-empty")).toBeDefined();
    expect(screen.getByTestId("player-career-log-empty")).toBeDefined();
    expect(screen.getByText("Statistics")).toBeDefined();
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

  it("renders a trade transaction with both teams, counterparty player link, and a missing-team row", () => {
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
            tradeId: "trade-001",
            counterpartyPlayer: {
              id: "p-other",
              firstName: "Jake",
              lastName: "Rival",
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
            tradeId: null,
            counterpartyPlayer: null,
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
    expect(trade.textContent).toContain("Jake Rival");
    const playerLink = screen.getByTestId("trade-link-p-other");
    expect(playerLink.getAttribute("href")).toBe("/leagues/L1/players/p-other");
    const released = screen.getByTestId("player-transaction-row-tx-released");
    expect(released.textContent).toContain("Released");
  });

  it("renders two-sided trade linking: both directions resolve to the same trade", () => {
    const sharedTradeId = "trade-shared-001";
    mockUsePlayerDetail.mockReturnValue({
      data: {
        ...draftedPlayer,
        transactions: [
          {
            id: "tx-side-a",
            type: "traded",
            seasonYear: 2025,
            occurredAt: "2025-10-15T12:00:00.000Z",
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
            tradeId: sharedTradeId,
            counterpartyPlayer: {
              id: "p-beta",
              firstName: "Beta",
              lastName: "Swap",
            },
            detail: "Traded for Beta Swap and a 3rd-round pick",
          },
        ],
      },
      isLoading: false,
      error: null,
    });
    renderDetail();
    const row = screen.getByTestId("player-transaction-row-tx-side-a");
    expect(row.textContent).toContain("Traded");
    expect(row.textContent).toContain("Beta Swap");
    const link = screen.getByTestId("trade-link-p-beta");
    expect(link.getAttribute("href")).toBe("/leagues/L1/players/p-beta");
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

  it("renders each transaction type with the correct label", () => {
    const types = [
      { type: "drafted", label: "Drafted" },
      { type: "signed", label: "Signed" },
      { type: "released", label: "Released" },
      { type: "traded", label: "Traded" },
      { type: "extended", label: "Extended" },
      { type: "franchise_tagged", label: "Franchise tagged" },
      { type: "claimed_on_waivers", label: "Claimed on waivers" },
      { type: "placed_on_ir", label: "Placed on IR" },
      { type: "activated", label: "Activated" },
      { type: "suspended", label: "Suspended" },
      { type: "retired", label: "Retired" },
    ] as const;

    mockUsePlayerDetail.mockReturnValue({
      data: {
        ...draftedPlayer,
        transactions: types.map((t, i) => ({
          id: `tx-type-${i}`,
          type: t.type,
          seasonYear: 2025,
          occurredAt: `2025-01-${String(i + 1).padStart(2, "0")}T12:00:00.000Z`,
          team: {
            id: "t2",
            name: "Bengals",
            city: "Cincinnati",
            abbreviation: "CIN",
          },
          counterpartyTeam: null,
          tradeId: null,
          counterpartyPlayer: null,
          detail: null,
        })),
      },
      isLoading: false,
      error: null,
    });
    renderDetail();
    for (const [i, t] of types.entries()) {
      const row = screen.getByTestId(`player-transaction-row-tx-type-${i}`);
      expect(row.textContent).toContain(t.label);
    }
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

describe("PlayerDetail — career statistics", () => {
  it("renders position-appropriate stat column headers for a QB", () => {
    renderDetail();
    const regular = screen.getByTestId("player-career-log-regular");
    expect(regular.textContent).toContain("CMP");
    expect(regular.textContent).toContain("ATT");
    expect(regular.textContent).toContain("YDS");
    expect(regular.textContent).toContain("TD");
    expect(regular.textContent).toContain("INT");
    expect(regular.textContent).toContain("RTG");
    expect(regular.textContent).not.toContain("TKL");
    expect(regular.textContent).not.toContain("REC");
  });

  it("renders rushing columns for an RB", () => {
    mockUsePlayerDetail.mockReturnValue({
      data: {
        ...draftedPlayer,
        neutralBucket: "RB",
        seasonStats: [
          {
            id: "ss-rb1",
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
            stats: { rushingYards: 1200, rushingTouchdowns: 10 },
          },
        ],
      },
      isLoading: false,
      error: null,
    });
    renderDetail();
    const regular = screen.getByTestId("player-career-log-regular");
    expect(regular.textContent).toContain("YDS");
    expect(regular.textContent).toContain("YPC");
    expect(regular.textContent).toContain("FUM");
    expect(regular.textContent).not.toContain("CMP");
    expect(regular.textContent).not.toContain("RTG");
  });

  it("renders receiving columns for a WR", () => {
    mockUsePlayerDetail.mockReturnValue({
      data: {
        ...draftedPlayer,
        neutralBucket: "WR",
        seasonStats: [
          {
            id: "ss-wr1",
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
            stats: { receptions: 90, receivingYards: 1100 },
          },
        ],
      },
      isLoading: false,
      error: null,
    });
    renderDetail();
    const regular = screen.getByTestId("player-career-log-regular");
    expect(regular.textContent).toContain("TGT");
    expect(regular.textContent).toContain("REC");
    expect(regular.textContent).toContain("Y/R");
  });

  it("renders defensive columns for a CB", () => {
    mockUsePlayerDetail.mockReturnValue({
      data: {
        ...draftedPlayer,
        neutralBucket: "CB",
        seasonStats: [
          {
            id: "ss-cb1",
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
            stats: { tackles: 55, interceptions: 4 },
          },
        ],
      },
      isLoading: false,
      error: null,
    });
    renderDetail();
    const regular = screen.getByTestId("player-career-log-regular");
    expect(regular.textContent).toContain("TKL");
    expect(regular.textContent).toContain("SCK");
    expect(regular.textContent).toContain("PD");
    expect(regular.textContent).toContain("FF");
  });

  it("renders a Career Totals row aggregating all regular-season stats", () => {
    mockUsePlayerDetail.mockReturnValue({
      data: {
        ...draftedPlayer,
        seasonStats: [
          {
            id: "ss-a",
            seasonYear: 2023,
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
            id: "ss-b",
            seasonYear: 2024,
            team: {
              id: "t2",
              name: "Bengals",
              city: "Cincinnati",
              abbreviation: "CIN",
            },
            playoffs: false,
            gamesPlayed: 16,
            gamesStarted: 16,
            stats: { passingYards: 3800, passingTouchdowns: 28 },
          },
        ],
      },
      isLoading: false,
      error: null,
    });
    renderDetail();
    const totals = screen.getByTestId("player-career-log-regular-totals");
    expect(totals.textContent).toContain("Career Totals");
    expect(totals.textContent).toContain("33");
    expect(totals.textContent).toContain("8,000");
    expect(totals.textContent).toContain("60");
  });

  it("aggregates Career Totals across multiple teams (mid-season trade)", () => {
    mockUsePlayerDetail.mockReturnValue({
      data: {
        ...draftedPlayer,
        neutralBucket: "RB",
        seasonStats: [
          {
            id: "ss-trade1",
            seasonYear: 2024,
            team: {
              id: "t2",
              name: "Bengals",
              city: "Cincinnati",
              abbreviation: "CIN",
            },
            playoffs: false,
            gamesPlayed: 8,
            gamesStarted: 8,
            stats: { rushingYards: 500, rushingTouchdowns: 4 },
          },
          {
            id: "ss-trade2",
            seasonYear: 2024,
            team: {
              id: "t3",
              name: "Eagles",
              city: "Philadelphia",
              abbreviation: "PHI",
            },
            playoffs: false,
            gamesPlayed: 9,
            gamesStarted: 9,
            stats: { rushingYards: 600, rushingTouchdowns: 6 },
          },
        ],
      },
      isLoading: false,
      error: null,
    });
    renderDetail();
    const regular = screen.getByTestId("player-career-log-regular");
    expect(regular.textContent).toContain("CIN");
    expect(regular.textContent).toContain("PHI");
    const totals = screen.getByTestId("player-career-log-regular-totals");
    expect(totals.textContent).toContain("Career Totals");
    expect(totals.textContent).toContain("17");
    expect(totals.textContent).toContain("1,100");
    expect(totals.textContent).toContain("10");
  });

  it("renders a splits link on current-season rows only", () => {
    mockUsePlayerDetail.mockReturnValue({
      data: {
        ...draftedPlayer,
        seasonStats: [
          {
            id: "ss-old",
            seasonYear: 2023,
            team: {
              id: "t2",
              name: "Bengals",
              city: "Cincinnati",
              abbreviation: "CIN",
            },
            playoffs: false,
            gamesPlayed: 17,
            gamesStarted: 17,
            stats: { passingYards: 4000, passingTouchdowns: 30 },
          },
          {
            id: "ss-cur",
            seasonYear: 2024,
            team: {
              id: "t2",
              name: "Bengals",
              city: "Cincinnati",
              abbreviation: "CIN",
            },
            playoffs: false,
            gamesPlayed: 16,
            gamesStarted: 16,
            stats: { passingYards: 3800, passingTouchdowns: 28 },
          },
        ],
      },
      isLoading: false,
      error: null,
    });
    renderDetail();
    expect(screen.getByTestId("player-splits-link-ss-cur")).toBeDefined();
    expect(screen.queryByTestId("player-splits-link-ss-old")).toBeNull();
  });

  it("renders the section title as Statistics", () => {
    renderDetail();
    expect(screen.getByText("Statistics")).toBeDefined();
  });
});

describe("PlayerDetail — no rating/grade leaks", () => {
  it("does not leak attributes, overall rating, or scout grade", () => {
    renderDetail();
    const main = document.body;
    expect(main.textContent).not.toMatch(/overall rating/i);
    expect(main.textContent).not.toMatch(/\bOVR\b/);
    expect(main.textContent).not.toMatch(/scout grade/i);
    expect(main.textContent).not.toMatch(/potential/i);
    expect(main.textContent).not.toMatch(/attribute/i);
  });
});
