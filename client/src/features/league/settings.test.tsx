import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LeagueSettings } from "./settings.tsx";

const mockDelete = vi.fn();
const mockNavigate = vi.fn();
const mockUseLeague = vi.fn();

vi.mock("../../api.ts", () => ({
  api: {
    api: {
      leagues: {
        ":id": {
          $delete: (...args: unknown[]) => mockDelete(...args),
        },
      },
    },
  },
}));

const mockUseParams = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useParams: (...args: unknown[]) => mockUseParams(...args),
  useNavigate: () => mockNavigate,
}));

vi.mock("../../hooks/use-league.ts", () => ({
  useLeague: (...args: unknown[]) => mockUseLeague(...args),
}));

const baseLeague = {
  id: "league-1",
  name: "Test League",
  numberOfTeams: 8,
  seasonLength: 17,
  salaryCap: 255_000_000,
  capFloorPercent: 89,
  capGrowthRate: 5,
  rosterSize: 53,
  advancePolicy: "commissioner" as const,
  staffBudget: 50_000_000,
  interestCap: 10,
  interviewsPerWeek: 4,
  maxConcurrentOffers: 5,
};

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LeagueSettings />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  mockUseParams.mockReturnValue({ leagueId: "league-1" });
  mockUseLeague.mockReturnValue({ data: baseLeague, isLoading: false });
});

describe("LeagueSettings", () => {
  it("renders the Settings heading", () => {
    renderWithProviders();
    expect(
      screen.getByRole("heading", { name: "Settings" }),
    ).toBeDefined();
  });

  it("renders the Danger Zone section", () => {
    renderWithProviders();
    expect(screen.getByText(/danger zone/i)).toBeDefined();
  });

  it("renders a Delete League button", () => {
    renderWithProviders();
    expect(
      screen.getByRole("button", { name: "Delete League" }),
    ).toBeDefined();
  });

  it("shows alert dialog with confirmation after clicking Delete League", async () => {
    renderWithProviders();
    fireEvent.click(screen.getByRole("button", { name: "Delete League" }));
    await waitFor(() => {
      expect(screen.getByText("Delete this league?")).toBeDefined();
      expect(
        screen.getByText(
          /this action cannot be undone/i,
        ),
      ).toBeDefined();
      expect(
        screen.getByRole("button", { name: "Confirm Delete" }),
      ).toBeDefined();
      expect(
        screen.getByRole("button", { name: "Cancel" }),
      ).toBeDefined();
    });
  });

  it("closes dialog when Cancel is clicked", async () => {
    renderWithProviders();
    fireEvent.click(screen.getByRole("button", { name: "Delete League" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Cancel" })).toBeDefined();
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByText("Delete this league?")).toBeNull();
    });
  });

  it("calls delete API when Confirm Delete is clicked", async () => {
    mockDelete.mockReturnValue(Promise.resolve({ ok: true }));
    renderWithProviders();

    fireEvent.click(screen.getByRole("button", { name: "Delete League" }));
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Confirm Delete" }),
      ).toBeDefined();
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm Delete" }));

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith({ param: { id: "league-1" } });
    });
  });

  it("navigates to home after successful deletion", async () => {
    mockDelete.mockReturnValue(Promise.resolve({ ok: true }));
    renderWithProviders();

    fireEvent.click(screen.getByRole("button", { name: "Delete League" }));
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Confirm Delete" }),
      ).toBeDefined();
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm Delete" }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
    });
  });

  it("does not call delete when leagueId is missing", async () => {
    mockUseParams.mockReturnValue({ leagueId: undefined });
    mockUseLeague.mockReturnValue({ data: undefined, isLoading: false });
    renderWithProviders();
    fireEvent.click(screen.getByRole("button", { name: "Delete League" }));
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Confirm Delete" }),
      ).toBeDefined();
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm Delete" }));
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("shows Deleting... text while mutation is pending", async () => {
    mockDelete.mockReturnValue(new Promise(() => {}));
    renderWithProviders();

    fireEvent.click(screen.getByRole("button", { name: "Delete League" }));
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Confirm Delete" }),
      ).toBeDefined();
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm Delete" }));

    await waitFor(() => {
      expect(screen.getByText("Deleting...")).toBeDefined();
    });
  });
});

describe("LeagueSettings — league configuration", () => {
  it("renders the League Configuration heading", () => {
    renderWithProviders();
    expect(screen.getByText("League Configuration")).toBeDefined();
  });

  it("displays the number of teams", () => {
    renderWithProviders();
    const section = screen.getByTestId("league-config");
    expect(within(section).getByText("8")).toBeDefined();
    expect(within(section).getByText("Teams")).toBeDefined();
  });

  it("displays the season length", () => {
    renderWithProviders();
    const section = screen.getByTestId("league-config");
    expect(within(section).getByText("17")).toBeDefined();
    expect(within(section).getByText("Season Games")).toBeDefined();
  });

  it("displays the roster size", () => {
    renderWithProviders();
    const section = screen.getByTestId("league-config");
    expect(within(section).getByText("53")).toBeDefined();
    expect(within(section).getByText("Roster Size")).toBeDefined();
  });

  it("displays the salary cap formatted as currency", () => {
    renderWithProviders();
    const section = screen.getByTestId("league-config");
    expect(within(section).getByText("$255,000,000")).toBeDefined();
    expect(within(section).getByText("Salary Cap")).toBeDefined();
  });

  it("displays the salary floor derived from cap and floor percent", () => {
    renderWithProviders();
    const section = screen.getByTestId("league-config");
    expect(within(section).getByText("$226,950,000")).toBeDefined();
    expect(within(section).getByText("Salary Floor")).toBeDefined();
  });

  it("displays the cap growth rate as a percentage", () => {
    renderWithProviders();
    const section = screen.getByTestId("league-config");
    expect(within(section).getByText("5%")).toBeDefined();
    expect(within(section).getByText("Cap Growth Rate")).toBeDefined();
  });

  it("displays the advance policy", () => {
    renderWithProviders();
    const section = screen.getByTestId("league-config");
    expect(within(section).getByText("Commissioner")).toBeDefined();
    expect(within(section).getByText("Advance Policy")).toBeDefined();
  });

  it("displays the staff budget formatted as currency", () => {
    renderWithProviders();
    const section = screen.getByTestId("league-config");
    expect(within(section).getByText("$50,000,000")).toBeDefined();
    expect(within(section).getByText("Staff Budget")).toBeDefined();
  });

  it("displays the interest cap", () => {
    renderWithProviders();
    const section = screen.getByTestId("league-config");
    expect(within(section).getByText("10")).toBeDefined();
    expect(within(section).getByText("Interest Cap")).toBeDefined();
  });

  it("displays the interviews per week", () => {
    renderWithProviders();
    const section = screen.getByTestId("league-config");
    expect(within(section).getByText("4")).toBeDefined();
    expect(within(section).getByText("Interviews / Week")).toBeDefined();
  });

  it("displays the max concurrent offers", () => {
    renderWithProviders();
    const section = screen.getByTestId("league-config");
    expect(within(section).getByText("5")).toBeDefined();
    expect(within(section).getByText("Max Concurrent Offers")).toBeDefined();
  });

  it("displays ready check advance policy when set", () => {
    mockUseLeague.mockReturnValue({
      data: { ...baseLeague, advancePolicy: "ready_check" },
      isLoading: false,
    });
    renderWithProviders();
    const section = screen.getByTestId("league-config");
    expect(within(section).getByText("Ready Check")).toBeDefined();
  });

  it("shows a loading state while league data is loading", () => {
    mockUseLeague.mockReturnValue({ data: undefined, isLoading: true });
    renderWithProviders();
    expect(screen.getByTestId("league-config-loading")).toBeDefined();
  });

  it("does not render the config card when league data is unavailable", () => {
    mockUseLeague.mockReturnValue({ data: undefined, isLoading: false });
    renderWithProviders();
    expect(screen.queryByTestId("league-config")).toBeNull();
    expect(screen.queryByTestId("league-config-loading")).toBeNull();
  });

  it("passes empty string to useLeague when leagueId is missing", () => {
    mockUseParams.mockReturnValue({ leagueId: undefined });
    mockUseLeague.mockReturnValue({ data: undefined, isLoading: false });
    renderWithProviders();
    expect(mockUseLeague).toHaveBeenCalledWith("");
  });

  it("falls back to raw advance policy value for unknown policies", () => {
    mockUseLeague.mockReturnValue({
      data: { ...baseLeague, advancePolicy: "some_unknown" },
      isLoading: false,
    });
    renderWithProviders();
    const section = screen.getByTestId("league-config");
    expect(within(section).getByText("some_unknown")).toBeDefined();
  });
});
