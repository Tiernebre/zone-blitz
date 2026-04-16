import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LeagueHome } from "./index.tsx";

let mockPhase: string | undefined = "genesis_staff_hiring";
const mockClockGet = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ leagueId: "1" }),
}));

vi.mock("../../api.ts", () => ({
  api: {
    api: {
      "league-clock": {
        [":leagueId"]: {
          $get: (...args: unknown[]) => mockClockGet(...args),
        },
      },
    },
  },
}));

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LeagueHome />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockClockGet.mockImplementation(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          leagueId: "1",
          seasonYear: 2026,
          phase: mockPhase,
          stepIndex: 0,
          slug: "staff_hiring",
          kind: "phase",
        }),
    })
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("LeagueHome", () => {
  it("renders the staff-hiring view when phase is genesis_staff_hiring", async () => {
    mockPhase = "genesis_staff_hiring";
    renderWithProviders();
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Staff Hiring" }),
      ).toBeDefined();
    });
    expect(screen.getByText(/hire the head coaches/i)).toBeDefined();
  });

  it("renders the founding-pool view when phase is genesis_founding_pool", async () => {
    mockPhase = "genesis_founding_pool";
    renderWithProviders();
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Founding Pool" }),
      ).toBeDefined();
    });
  });

  it("renders the allocation-draft view when phase is genesis_allocation_draft", async () => {
    mockPhase = "genesis_allocation_draft";
    renderWithProviders();
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Allocation Draft" }),
      ).toBeDefined();
    });
  });

  it("renders the charter view when phase is genesis_charter", async () => {
    mockPhase = "genesis_charter";
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Charter" })).toBeDefined();
    });
  });

  it("falls back to League Home for non-genesis phases", async () => {
    mockPhase = "regular_season";
    renderWithProviders();
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "League Home" }),
      ).toBeDefined();
    });
  });

  it("falls back to League Home before the clock has loaded", () => {
    mockClockGet.mockImplementation(() => new Promise(() => {}));
    renderWithProviders();
    expect(
      screen.getByRole("heading", { name: "League Home" }),
    ).toBeDefined();
  });
});
