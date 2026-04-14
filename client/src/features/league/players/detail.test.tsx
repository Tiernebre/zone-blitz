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
  position: "QB",
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
      },
      isLoading: false,
      error: null,
    });
    renderDetail();
    expect(screen.getByTestId("player-no-current-contract")).toBeDefined();
    expect(screen.getByTestId("player-contract-history-empty")).toBeDefined();
  });

  it("does not leak attributes, overall, or scout grade", () => {
    renderDetail();
    const main = document.body;
    expect(main.textContent).not.toMatch(/overall/i);
    expect(main.textContent).not.toMatch(/scout grade/i);
    expect(main.textContent).not.toMatch(/potential/i);
  });
});
