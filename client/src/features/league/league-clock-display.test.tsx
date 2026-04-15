import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LeagueClockDisplay } from "./league-clock-display.tsx";

const mockGetClock = vi.fn();
const mockAdvance = vi.fn();

vi.mock("../../api.ts", () => ({
  api: {
    api: {
      "league-clock": {
        [":leagueId"]: {
          $get: (...args: unknown[]) => mockGetClock(...args),
          advance: {
            $post: (...args: unknown[]) => mockAdvance(...args),
          },
        },
      },
    },
  },
}));

function renderWithProviders(props: {
  leagueId: string;
  isCommissioner: boolean;
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LeagueClockDisplay {...props} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("LeagueClockDisplay", () => {
  it("renders the phase and step name with flavor date", async () => {
    mockGetClock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          leagueId: "lg-1",
          seasonYear: 2026,
          phase: "regular_season",
          stepIndex: 3,
          slug: "week_4",
          kind: "week",
          flavorDate: "Sep 28",
          advancedAt: "2026-01-01T00:00:00Z",
        }),
    });

    renderWithProviders({ leagueId: "lg-1", isCommissioner: true });

    await waitFor(() => {
      expect(screen.getByText("Week 4")).toBeDefined();
    });
    expect(screen.getByText("Sep 28")).toBeDefined();
    expect(screen.getByText(/Regular Season/)).toBeDefined();
  });

  it("renders Advance button for commissioner", async () => {
    mockGetClock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          leagueId: "lg-1",
          seasonYear: 2026,
          phase: "offseason_review",
          stepIndex: 0,
          slug: "awards_ceremony",
          kind: "event",
          flavorDate: "Feb 8",
          advancedAt: "2026-01-01T00:00:00Z",
        }),
    });

    renderWithProviders({ leagueId: "lg-1", isCommissioner: true });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /advance/i }),
      ).toBeDefined();
    });
  });

  it("does not render Advance button for non-commissioner", async () => {
    mockGetClock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          leagueId: "lg-1",
          seasonYear: 2026,
          phase: "offseason_review",
          stepIndex: 0,
          slug: "awards_ceremony",
          kind: "event",
          flavorDate: "Feb 8",
          advancedAt: "2026-01-01T00:00:00Z",
        }),
    });

    renderWithProviders({ leagueId: "lg-1", isCommissioner: false });

    await waitFor(() => {
      expect(screen.getByText("Awards Ceremony")).toBeDefined();
    });
    expect(screen.queryByRole("button", { name: /advance/i })).toBeNull();
  });

  it("renders blocker warnings when advance fails with GATE_BLOCKED", async () => {
    mockGetClock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          leagueId: "lg-1",
          seasonYear: 2026,
          phase: "preseason",
          stepIndex: 3,
          slug: "final_cuts",
          kind: "event",
          flavorDate: "Aug 27",
          advancedAt: "2026-01-01T00:00:00Z",
        }),
    });

    mockAdvance.mockResolvedValue({
      ok: false,
      status: 400,
      json: () =>
        Promise.resolve({
          error: "GATE_BLOCKED",
          message:
            "Cannot advance to regular_season: Team is not cap-compliant",
        }),
    });

    renderWithProviders({ leagueId: "lg-1", isCommissioner: true });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /advance/i }),
      ).toBeDefined();
    });

    fireEvent.click(screen.getByRole("button", { name: /advance/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined();
    });
    expect(screen.getByText(/not cap-compliant/i)).toBeDefined();
  });

  it("advances successfully when Advance button is clicked", async () => {
    mockGetClock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          leagueId: "lg-1",
          seasonYear: 2026,
          phase: "offseason_review",
          stepIndex: 0,
          slug: "awards_ceremony",
          kind: "event",
          flavorDate: "Feb 8",
          advancedAt: "2026-01-01T00:00:00Z",
        }),
    });

    mockAdvance.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          leagueId: "lg-1",
          seasonYear: 2026,
          phase: "offseason_review",
          stepIndex: 1,
          advancedAt: "2026-01-01T00:00:00Z",
          overrideReason: null,
          overrideBlockers: null,
          autoResolved: [],
          looped: false,
        }),
    });

    renderWithProviders({ leagueId: "lg-1", isCommissioner: true });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /advance/i }),
      ).toBeDefined();
    });

    fireEvent.click(screen.getByRole("button", { name: /advance/i }));

    await waitFor(() => {
      expect(mockAdvance).toHaveBeenCalled();
    });
  });

  it("renders the season year", async () => {
    mockGetClock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          leagueId: "lg-1",
          seasonYear: 2026,
          phase: "draft",
          stepIndex: 0,
          slug: "round_1",
          kind: "event",
          flavorDate: "Apr 24",
          advancedAt: "2026-01-01T00:00:00Z",
          hasCompletedGenesis: true,
        }),
    });

    renderWithProviders({ leagueId: "lg-1", isCommissioner: true });

    await waitFor(() => {
      expect(screen.getByText("2026")).toBeDefined();
    });
  });

  it("renders 'No preseason (inaugural year)' note in Year 1", async () => {
    mockGetClock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          leagueId: "lg-1",
          seasonYear: 1,
          phase: "regular_season",
          stepIndex: 0,
          slug: "week_1",
          kind: "week",
          flavorDate: "Sep 7",
          advancedAt: "2026-01-01T00:00:00Z",
          hasCompletedGenesis: false,
        }),
    });

    renderWithProviders({ leagueId: "lg-1", isCommissioner: false });

    await waitFor(() => {
      expect(screen.getByText("Week 1")).toBeDefined();
    });
    expect(
      screen.getByText("No preseason (inaugural year)"),
    ).toBeDefined();
  });

  it("does not render inaugural year note when hasCompletedGenesis is true", async () => {
    mockGetClock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          leagueId: "lg-1",
          seasonYear: 2,
          phase: "preseason",
          stepIndex: 0,
          slug: "preseason_week_1",
          kind: "week",
          flavorDate: "Aug 10",
          advancedAt: "2026-01-01T00:00:00Z",
          hasCompletedGenesis: true,
        }),
    });

    renderWithProviders({ leagueId: "lg-1", isCommissioner: false });

    await waitFor(() => {
      expect(screen.getByText("Preseason Week 1")).toBeDefined();
    });
    expect(
      screen.queryByText("No preseason (inaugural year)"),
    ).toBeNull();
  });

  it("does not render inaugural year note during genesis phases", async () => {
    mockGetClock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          leagueId: "lg-1",
          seasonYear: 1,
          phase: "genesis_kickoff",
          stepIndex: 0,
          slug: "kickoff",
          kind: "event",
          flavorDate: null,
          advancedAt: "2026-01-01T00:00:00Z",
          hasCompletedGenesis: false,
        }),
    });

    renderWithProviders({ leagueId: "lg-1", isCommissioner: false });

    await waitFor(() => {
      expect(screen.getByText("Kickoff")).toBeDefined();
    });
    expect(
      screen.queryByText("No preseason (inaugural year)"),
    ).toBeNull();
  });
});
