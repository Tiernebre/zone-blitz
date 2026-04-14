import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Roster } from "./roster.tsx";

const mockUseParams = vi.fn();
const mockUseLeague = vi.fn();
const mockUseActiveRoster = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useParams: (...args: unknown[]) => mockUseParams(...args),
}));

vi.mock("../../hooks/use-league.ts", () => ({
  useLeague: (...args: unknown[]) => mockUseLeague(...args),
}));

vi.mock("../../hooks/use-active-roster.ts", () => ({
  useActiveRoster: (...args: unknown[]) => mockUseActiveRoster(...args),
}));

function renderRoster() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <Roster />
    </QueryClientProvider>,
  );
}

const baseRoster = {
  leagueId: "L1",
  teamId: "T1",
  players: [
    {
      id: "p1",
      firstName: "Patrick",
      lastName: "Quarterback",
      position: "QB",
      positionGroup: "offense",
      age: 28,
      capHit: 45_000_000,
      contractYearsRemaining: 3,
      injuryStatus: "healthy",
    },
    {
      id: "p2",
      firstName: "Derrick",
      lastName: "Runback",
      position: "RB",
      positionGroup: "offense",
      age: 26,
      capHit: 12_000_000,
      contractYearsRemaining: 2,
      injuryStatus: "questionable",
    },
    {
      id: "p3",
      firstName: "Aaron",
      lastName: "Rusher",
      position: "EDGE",
      positionGroup: "defense",
      age: 24,
      capHit: 8_000_000,
      contractYearsRemaining: 4,
      injuryStatus: "out",
    },
    {
      id: "p4",
      firstName: "Kyle",
      lastName: "Kicker",
      position: "K",
      positionGroup: "special_teams",
      age: 30,
      capHit: 3_000_000,
      contractYearsRemaining: 1,
      injuryStatus: "healthy",
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

function rosterRowIds() {
  return Array.from(document.querySelectorAll("tbody tr"))
    .map((row) => row.getAttribute("data-testid"))
    .filter((id): id is string => Boolean(id));
}

describe("Roster", () => {
  it("renders the Roster heading", () => {
    renderRoster();
    expect(screen.getByRole("heading", { name: "Roster" })).toBeDefined();
  });

  it("shows a loading skeleton while data is fetching", () => {
    mockUseActiveRoster.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });
    renderRoster();
    expect(screen.getByTestId("roster-loading")).toBeDefined();
  });

  it("shows an error message when the roster fails to load", () => {
    mockUseActiveRoster.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });
    renderRoster();
    expect(screen.getByText(/failed to load roster/i)).toBeDefined();
  });

  it("shows a message when the league has no selected team", () => {
    mockUseLeague.mockReturnValue({
      data: { id: "L1", userTeamId: null, name: "Test League" },
    });
    mockUseActiveRoster.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    });
    renderRoster();
    expect(screen.getByText(/select a team/i)).toBeDefined();
  });

  it("renders the cap summary with total cap, salary cap, and cap space", () => {
    renderRoster();
    const summary = screen.getByTestId("roster-cap-summary");
    expect(within(summary).getByText("$68,000,000")).toBeDefined();
    expect(within(summary).getByText("$255,000,000")).toBeDefined();
    expect(within(summary).getByText("$187,000,000")).toBeDefined();
  });

  it("renders every player in a single combined table", () => {
    renderRoster();
    expect(screen.queryByTestId("position-group-offense")).toBeNull();
    expect(screen.queryByTestId("position-group-defense")).toBeNull();
    expect(rosterRowIds()).toEqual([
      "roster-row-p1",
      "roster-row-p2",
      "roster-row-p3",
      "roster-row-p4",
    ]);
  });

  it("renders a player row with name, position, group, age, cap hit, contract years, and injury status", () => {
    renderRoster();
    const row = screen.getByTestId("roster-row-p1");
    expect(within(row).getByText("Patrick Quarterback")).toBeDefined();
    expect(within(row).getByText("QB")).toBeDefined();
    expect(within(row).getByText("Offense")).toBeDefined();
    expect(within(row).getByText("28")).toBeDefined();
    expect(within(row).getByText("$45,000,000")).toBeDefined();
    expect(within(row).getByText("3 yrs")).toBeDefined();
    expect(within(row).getByText(/healthy/i)).toBeDefined();
  });

  it("filters rows by the position group filter", () => {
    renderRoster();
    fireEvent.click(screen.getByTestId("roster-group-filter-defense"));
    expect(rosterRowIds()).toEqual(["roster-row-p3"]);
    fireEvent.click(screen.getByTestId("roster-group-filter-all"));
    expect(rosterRowIds()).toHaveLength(4);
  });

  it("filters rows by the global search input", () => {
    renderRoster();
    fireEvent.change(screen.getByLabelText("Search roster"), {
      target: { value: "Kicker" },
    });
    expect(rosterRowIds()).toEqual(["roster-row-p4"]);
  });

  it("sorts rows when the Cap Hit header is clicked", () => {
    renderRoster();
    fireEvent.click(screen.getByRole("button", { name: /cap hit/i }));
    expect(rosterRowIds()).toEqual([
      "roster-row-p4",
      "roster-row-p3",
      "roster-row-p2",
      "roster-row-p1",
    ]);
    fireEvent.click(screen.getByRole("button", { name: /cap hit/i }));
    expect(rosterRowIds()).toEqual([
      "roster-row-p1",
      "roster-row-p2",
      "roster-row-p3",
      "roster-row-p4",
    ]);
  });
});
