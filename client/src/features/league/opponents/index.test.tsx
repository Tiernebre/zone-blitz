import { cleanup, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Opponents } from "./index.tsx";

const mockUseParams = vi.fn();
const mockUseLeague = vi.fn();
const mockUseTeams = vi.fn();

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

vi.mock("../../../hooks/use-league.ts", () => ({
  useLeague: (...args: unknown[]) => mockUseLeague(...args),
}));

vi.mock("../../../hooks/use-teams.ts", () => ({
  useTeams: (...args: unknown[]) => mockUseTeams(...args),
}));

function renderOpponents() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <Opponents />
    </QueryClientProvider>,
  );
}

const teams = [
  {
    id: "t1",
    name: "Ravens",
    city: "Baltimore",
    conference: "AFC",
    division: "North",
    abbreviation: "BAL",
  },
  {
    id: "t2",
    name: "Bengals",
    city: "Cincinnati",
    conference: "AFC",
    division: "North",
    abbreviation: "CIN",
  },
  {
    id: "t3",
    name: "Cowboys",
    city: "Dallas",
    conference: "NFC",
    division: "East",
    abbreviation: "DAL",
  },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  mockUseParams.mockReturnValue({ leagueId: "L1" });
  mockUseLeague.mockReturnValue({
    data: { id: "L1", userTeamId: "t1", name: "Test League" },
  });
  mockUseTeams.mockReturnValue({ data: teams, isLoading: false, error: null });
});

describe("Opponents — team picker", () => {
  it("renders the Opponents heading", () => {
    renderOpponents();
    expect(screen.getByRole("heading", { name: "Opponents" })).toBeDefined();
  });

  it("shows a loading skeleton while teams load", () => {
    mockUseTeams.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });
    renderOpponents();
    expect(screen.getByTestId("opponents-skeleton")).toBeDefined();
  });

  it("excludes the user's team from the picker", () => {
    renderOpponents();
    expect(screen.queryByTestId("opponents-team-t1")).toBeNull();
    expect(screen.getByTestId("opponents-team-t2")).toBeDefined();
    expect(screen.getByTestId("opponents-team-t3")).toBeDefined();
  });

  it("groups teams by conference and division", () => {
    renderOpponents();
    const afc = screen.getByTestId("opponents-conference-AFC");
    expect(within(afc).getByTestId("opponents-division-AFC-North"))
      .toBeDefined();
    expect(within(afc).getByTestId("opponents-team-t2")).toBeDefined();
    const nfc = screen.getByTestId("opponents-conference-NFC");
    expect(within(nfc).getByTestId("opponents-division-NFC-East"))
      .toBeDefined();
  });

  it("links each team to its opponent detail route", () => {
    renderOpponents();
    const link = screen.getByTestId("opponents-team-t2") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/leagues/L1/opponents/t2");
  });

  it("shows an empty-state message when no opposing teams exist", () => {
    mockUseTeams.mockReturnValue({
      data: [teams[0]],
      isLoading: false,
      error: null,
    });
    renderOpponents();
    expect(screen.getByText(/no opposing teams found/i)).toBeDefined();
  });

  it("shows an error when teams fail to load", () => {
    mockUseTeams.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("boom"),
    });
    renderOpponents();
    expect(screen.getByText(/failed to load/i)).toBeDefined();
  });
});
