import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpponentRoster } from "./detail.tsx";

const mockUseParams = vi.fn();
const mockUseTeams = vi.fn();
const mockUseActiveRoster = vi.fn();

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

vi.mock("../../../hooks/use-teams.ts", () => ({
  useTeams: (...args: unknown[]) => mockUseTeams(...args),
}));

vi.mock("../../../hooks/use-active-roster.ts", () => ({
  useActiveRoster: (...args: unknown[]) => mockUseActiveRoster(...args),
}));

function renderDetail() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <OpponentRoster />
    </QueryClientProvider>,
  );
}

const roster = {
  leagueId: "L1",
  teamId: "T2",
  players: [
    {
      id: "p1",
      firstName: "Patrick",
      lastName: "Quarterback",
      neutralBucket: "QB",
      neutralBucketGroup: "offense",
      age: 28,
      capHit: 45_000_000,
      contractYearsRemaining: 3,
      injuryStatus: "healthy",
      schemeFit: "fits",
      schemeArchetype: null,
    },
    {
      id: "p2",
      firstName: "Aaron",
      lastName: "Rusher",
      neutralBucket: "EDGE",
      neutralBucketGroup: "defense",
      age: 24,
      capHit: 8_000_000,
      contractYearsRemaining: 4,
      injuryStatus: "out",
      schemeFit: null,
      schemeArchetype: null,
    },
    {
      id: "p3",
      firstName: "Derrick",
      lastName: "Runback",
      neutralBucket: "RB",
      neutralBucketGroup: "offense",
      age: 26,
      capHit: 12_000_000,
      contractYearsRemaining: 2,
      injuryStatus: "questionable",
      schemeFit: "miscast",
      schemeArchetype: null,
    },
  ],
  positionGroups: [
    { group: "offense", headcount: 1, totalCap: 45_000_000 },
    { group: "defense", headcount: 1, totalCap: 8_000_000 },
    { group: "special_teams", headcount: 0, totalCap: 0 },
  ],
  totalCap: 53_000_000,
  salaryCap: 255_000_000,
  capSpace: 202_000_000,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  mockUseParams.mockReturnValue({ leagueId: "L1", teamId: "T2" });
  mockUseTeams.mockReturnValue({
    data: [
      {
        id: "T2",
        name: "Bengals",
        city: "Cincinnati",
        abbreviation: "CIN",
        primaryColor: "#FB4F14",
        secondaryColor: "#000000",
        conference: "AFC",
        division: "North",
      },
    ],
  });
  mockUseActiveRoster.mockReturnValue({
    data: roster,
    isLoading: false,
    isError: false,
  });
});

describe("OpponentRoster — page", () => {
  it("renders the opposing team's name in the heading", () => {
    renderDetail();
    expect(screen.getByTestId("opponent-heading").textContent).toContain(
      "Cincinnati Bengals",
    );
  });

  it("renders Roster and Statistics tabs", () => {
    renderDetail();
    expect(screen.getByRole("tab", { name: /roster/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /statistics/i })).toBeDefined();
  });

  it("shows a loading skeleton while the roster loads", () => {
    mockUseActiveRoster.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });
    renderDetail();
    expect(screen.getByTestId("opponent-roster-loading")).toBeDefined();
  });

  it("renders the cap summary and position-group breakdown", () => {
    renderDetail();
    const cap = screen.getByTestId("opponent-cap-summary");
    expect(within(cap).getByText("$53,000,000")).toBeDefined();
    const groups = screen.getByTestId("opponent-position-groups");
    expect(
      within(groups).getByTestId("opponent-position-group-offense"),
    ).toBeDefined();
  });

  it("renders player rows with public columns only (no overall)", () => {
    renderDetail();
    const row = screen.getByTestId("opponent-row-p1");
    expect(within(row).getByText("Patrick Quarterback")).toBeDefined();
    expect(within(row).getByText("QB")).toBeDefined();
    expect(within(row).getByText("$45,000,000")).toBeDefined();
    expect(within(row).queryByText(/overall/i)).toBeNull();
  });

  it("links each player to their detail page", () => {
    renderDetail();
    const link = screen.getByTestId(
      "opponent-player-link-p1",
    ) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/leagues/L1/players/p1");
  });

  it("filters by position group", () => {
    renderDetail();
    fireEvent.click(screen.getByTestId("opponent-group-filter-defense"));
    expect(screen.queryByTestId("opponent-row-p1")).toBeNull();
    expect(screen.getByTestId("opponent-row-p2")).toBeDefined();
  });

  it("shows a statistics placeholder since box scores aren't persisted yet", () => {
    renderDetail();
    fireEvent.click(screen.getByRole("tab", { name: /statistics/i }));
    expect(screen.getByTestId("opponent-statistics-placeholder")).toBeDefined();
  });

  it("renders a scheme fit badge when the player has a fit value", () => {
    renderDetail();
    const row = screen.getByTestId("opponent-row-p1");
    expect(
      within(row).getByTestId("opponent-scheme-fit-p1").textContent,
    ).toBe("Fits");
  });

  it("renders a dash for scheme fit when the value is null", () => {
    renderDetail();
    const row = screen.getByTestId("opponent-row-p2");
    expect(
      within(row).getByTestId("opponent-scheme-fit-p2").textContent,
    ).toBe("—");
  });

  it("shows an error state when the roster fails to load", () => {
    mockUseActiveRoster.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });
    renderDetail();
    expect(screen.getByText(/failed to load roster/i)).toBeDefined();
  });
});
