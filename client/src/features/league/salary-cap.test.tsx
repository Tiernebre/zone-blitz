import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SalaryCap } from "./salary-cap.tsx";

const mockUseParams = vi.fn();
const mockUseLeague = vi.fn();
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

vi.mock("../../hooks/use-league.ts", () => ({
  useLeague: (...args: unknown[]) => mockUseLeague(...args),
}));

vi.mock("../../hooks/use-active-roster.ts", () => ({
  useActiveRoster: (...args: unknown[]) => mockUseActiveRoster(...args),
}));

const baseRoster = {
  leagueId: "L1",
  teamId: "T1",
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
      schemeFit: "ideal",
      schemeArchetype: null,
      depthChartSlot: null,
    },
    {
      id: "p2",
      firstName: "Derrick",
      lastName: "Runback",
      neutralBucket: "RB",
      neutralBucketGroup: "offense",
      age: 26,
      capHit: 12_000_000,
      contractYearsRemaining: 2,
      injuryStatus: "questionable",
      schemeFit: "poor",
      schemeArchetype: null,
      depthChartSlot: null,
    },
    {
      id: "p3",
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
      depthChartSlot: null,
    },
    {
      id: "p4",
      firstName: "Kyle",
      lastName: "Kicker",
      neutralBucket: "K",
      neutralBucketGroup: "special_teams",
      age: 30,
      capHit: 3_000_000,
      contractYearsRemaining: 1,
      injuryStatus: "healthy",
      schemeFit: "fits",
      schemeArchetype: null,
      depthChartSlot: null,
    },
  ],
  positionGroups: [
    { group: "offense", headcount: 2, totalCap: 57_000_000 },
    { group: "defense", headcount: 1, totalCap: 8_000_000 },
    { group: "special_teams", headcount: 1, totalCap: 3_000_000 },
  ],
  totalCap: 68_000_000,
  salaryCap: 255_000_000,
  capSpace: 187_000_000,
};

function renderSalaryCap() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SalaryCap />
    </QueryClientProvider>,
  );
}

function capRowIds() {
  return Array.from(document.querySelectorAll("tbody tr"))
    .map((row) => row.getAttribute("data-testid"))
    .filter((id): id is string =>
      Boolean(id) && id!.startsWith("salary-cap-row-")
    );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  mockUseParams.mockReturnValue({ leagueId: "L1" });
  mockUseLeague.mockReturnValue({
    data: { id: "L1", userTeamId: "T1", name: "Test League" },
  });
  mockUseActiveRoster.mockReturnValue({
    data: baseRoster,
    isLoading: false,
    isError: false,
  });
});

describe("SalaryCap — page", () => {
  it("renders the Salary Cap heading", () => {
    renderSalaryCap();
    expect(
      screen.getByRole("heading", { name: "Salary Cap" }),
    ).toBeDefined();
  });

  it("shows a message when the league has no selected team", () => {
    mockUseLeague.mockReturnValue({
      data: { id: "L1", userTeamId: null, name: "Test League" },
    });
    renderSalaryCap();
    expect(screen.getByText(/select a team/i)).toBeDefined();
  });

  it("shows a loading skeleton while data is fetching", () => {
    mockUseActiveRoster.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });
    renderSalaryCap();
    expect(screen.getByTestId("salary-cap-loading")).toBeDefined();
  });

  it("shows an error message when the data fails to load", () => {
    mockUseActiveRoster.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });
    renderSalaryCap();
    expect(screen.getByText(/failed to load salary cap/i)).toBeDefined();
  });

  it("renders the cap summary with total cap, salary cap, and cap space", () => {
    renderSalaryCap();
    const summary = screen.getByTestId("salary-cap-summary");
    expect(within(summary).getByText("$68,000,000")).toBeDefined();
    expect(within(summary).getByText("$255,000,000")).toBeDefined();
    expect(within(summary).getByText("$187,000,000")).toBeDefined();
  });

  it("renders a position group breakdown with headcount and total cap", () => {
    renderSalaryCap();
    const groups = screen.getByTestId("salary-cap-position-groups");
    const offense = within(groups).getByTestId(
      "salary-cap-group-offense",
    );
    expect(within(offense).getByText("Offense")).toBeDefined();
    expect(within(offense).getByText("$57,000,000")).toBeDefined();
    expect(within(offense).getByText(/2 players/i)).toBeDefined();

    const defense = within(groups).getByTestId(
      "salary-cap-group-defense",
    );
    expect(within(defense).getByText("$8,000,000")).toBeDefined();

    const st = within(groups).getByTestId(
      "salary-cap-group-special_teams",
    );
    expect(within(st).getByText("Special Teams")).toBeDefined();
  });

  it("renders every player in the cap hit table, sorted by cap hit desc", () => {
    renderSalaryCap();
    expect(capRowIds()).toEqual([
      "salary-cap-row-p1",
      "salary-cap-row-p2",
      "salary-cap-row-p3",
      "salary-cap-row-p4",
    ]);
  });

  it("renders a player row with name, position, cap hit, and contract years", () => {
    renderSalaryCap();
    const row = screen.getByTestId("salary-cap-row-p1");
    expect(within(row).getByText("Patrick Quarterback")).toBeDefined();
    expect(within(row).getByText("QB")).toBeDefined();
    expect(within(row).getByText("$45,000,000")).toBeDefined();
    expect(within(row).getByText("3 yrs")).toBeDefined();
  });

  it("renders a scheme fit badge when the player has a fit value", () => {
    renderSalaryCap();
    const row = screen.getByTestId("salary-cap-row-p1");
    expect(
      within(row).getByTestId("salary-cap-scheme-fit-p1").textContent,
    ).toBe("Ideal fit");
  });

  it("renders a dash for scheme fit when the value is null", () => {
    renderSalaryCap();
    const row = screen.getByTestId("salary-cap-row-p3");
    expect(
      within(row).getByTestId("salary-cap-scheme-fit-p3").textContent,
    ).toBe("—");
  });

  it("links each player name to their detail page", () => {
    renderSalaryCap();
    const link = screen.getByTestId(
      "salary-cap-player-link-p1",
    ) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/leagues/L1/players/p1");
    expect(link.textContent).toBe("Patrick Quarterback");
  });

  it("filters rows by the global search input", () => {
    renderSalaryCap();
    fireEvent.change(screen.getByLabelText("Search players"), {
      target: { value: "Kicker" },
    });
    expect(capRowIds()).toEqual(["salary-cap-row-p4"]);
  });
});
