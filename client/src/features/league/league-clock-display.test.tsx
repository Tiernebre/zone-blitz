import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Toaster } from "@/components/ui/sonner";
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
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LeagueClockDisplay {...props} />
      <Toaster />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("LeagueClockDisplay", () => {
  it("renders the full temporal context: phase, slug, year, and flavor date", async () => {
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
      expect(
        screen.getByText("Regular Season — Week 4, Year 2026"),
      ).toBeDefined();
    });
    expect(screen.getByText("Sep 28")).toBeDefined();
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
      expect(
        screen.getByText("Offseason Review — Awards Ceremony, Year 2026"),
      ).toBeDefined();
    });
    expect(screen.queryByRole("button", { name: /advance/i })).toBeNull();
  });

  it("shows confirmation dialog when Advance button is clicked", async () => {
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

    fireEvent.click(screen.getByRole("button", { name: /advance/i }));

    await waitFor(() => {
      expect(screen.getByText("Advance league?")).toBeDefined();
      expect(
        screen.getByText(/this will move the league forward/i),
      ).toBeDefined();
      expect(
        screen.getByRole("button", { name: "Confirm Advance" }),
      ).toBeDefined();
      expect(
        screen.getByRole("button", { name: "Cancel" }),
      ).toBeDefined();
    });

    expect(mockAdvance).not.toHaveBeenCalled();
  });

  it("does not advance when Cancel is clicked in confirmation dialog", async () => {
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

    fireEvent.click(screen.getByRole("button", { name: /advance/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Cancel" })).toBeDefined();
    });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByText("Advance league?")).toBeNull();
    });

    expect(mockAdvance).not.toHaveBeenCalled();
  });

  it("shows a success toast when advance is confirmed", async () => {
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
          slug: "end_of_year_recap",
          flavorDate: "Feb 10",
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
      expect(
        screen.getByRole("button", { name: "Confirm Advance" }),
      ).toBeDefined();
    });

    fireEvent.click(screen.getByRole("button", { name: "Confirm Advance" }));

    await waitFor(() => {
      expect(screen.getByText(/Advanced to End Of Year Recap/)).toBeDefined();
    });
  });

  it("shows a success toast with flavor date when present", async () => {
    mockGetClock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          leagueId: "lg-1",
          seasonYear: 2026,
          phase: "regular_season",
          stepIndex: 0,
          slug: "week_1",
          kind: "week",
          flavorDate: "Sep 7",
          advancedAt: "2026-01-01T00:00:00Z",
        }),
    });

    mockAdvance.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          leagueId: "lg-1",
          seasonYear: 2026,
          phase: "regular_season",
          stepIndex: 1,
          slug: "week_2",
          flavorDate: "Sep 14",
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
      expect(
        screen.getByRole("button", { name: "Confirm Advance" }),
      ).toBeDefined();
    });

    fireEvent.click(screen.getByRole("button", { name: "Confirm Advance" }));

    await waitFor(() => {
      expect(screen.getByText(/Advanced to Week 2/)).toBeDefined();
    });
    expect(screen.getByText(/Sep 14/)).toBeDefined();
  });

  it("shows a success toast without flavor date when absent", async () => {
    mockGetClock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          leagueId: "lg-1",
          seasonYear: 2026,
          phase: "genesis_charter",
          stepIndex: 0,
          slug: "ratify_league_charter",
          kind: "event",
          flavorDate: null,
          advancedAt: "2026-01-01T00:00:00Z",
          hasCompletedGenesis: false,
        }),
    });

    mockAdvance.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          leagueId: "lg-1",
          seasonYear: 2026,
          phase: "genesis_franchise_establishment",
          stepIndex: 0,
          slug: "establish_franchises",
          flavorDate: null,
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
      expect(
        screen.getByRole("button", { name: "Confirm Advance" }),
      ).toBeDefined();
    });

    fireEvent.click(screen.getByRole("button", { name: "Confirm Advance" }));

    await waitFor(() => {
      expect(
        screen.getByText(/Advanced to Establish Franchises/),
      ).toBeDefined();
    });
  });

  it("shows an error toast when advance fails after confirmation", async () => {
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
      expect(
        screen.getByRole("button", { name: "Confirm Advance" }),
      ).toBeDefined();
    });

    fireEvent.click(screen.getByRole("button", { name: "Confirm Advance" }));

    await waitFor(() => {
      expect(screen.getByText(/Cannot Advance/)).toBeDefined();
    });
  });

  it("renders year as part of the full temporal context string", async () => {
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
      expect(
        screen.getByText("Draft — Round 1, Year 2026"),
      ).toBeDefined();
    });
  });

  it("renders 'No preseason (inaugural year)' note in inaugural season", async () => {
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
      expect(
        screen.getByText("Regular Season — Week 1, Year 1"),
      ).toBeDefined();
    });
    expect(
      screen.getByText("No preseason (inaugural year)"),
    ).toBeDefined();
  });

  it("does not render inaugural year note after inaugural season", async () => {
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
      expect(
        screen.getByText("Preseason — Preseason Week 1, Year 2"),
      ).toBeDefined();
    });
    expect(
      screen.queryByText("No preseason (inaugural year)"),
    ).toBeNull();
  });

  it("does not render inaugural year note during setup phases", async () => {
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
      expect(
        screen.getByText("Genesis Kickoff — Kickoff, Year 1"),
      ).toBeDefined();
    });
    expect(
      screen.queryByText("No preseason (inaugural year)"),
    ).toBeNull();
  });
});
