import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CandidateDetail } from "./candidate-detail.tsx";

const mockUseParams = vi.fn();
const mockUseHiringCandidateDetail = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useParams: (...args: unknown[]) => mockUseParams(...args),
  Link: (
    { children, ...rest }: {
      children: React.ReactNode;
    } & Record<string, unknown>,
  ) => <a {...rest}>{children}</a>,
}));

vi.mock("../../../hooks/use-hiring.ts", () => ({
  useHiringCandidateDetail: (...args: unknown[]) =>
    mockUseHiringCandidateDetail(...args),
}));

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CandidateDetail />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockUseParams.mockReturnValue({ leagueId: "lg", candidateId: "c1" });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CandidateDetail", () => {
  it("renders loading skeleton", () => {
    mockUseHiringCandidateDetail.mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    renderPage();
    expect(screen.getByTestId("candidate-loading")).toBeTruthy();
  });

  it("renders not-found alert when candidate is null", () => {
    mockUseHiringCandidateDetail.mockReturnValue({
      data: null,
      isLoading: false,
    });
    renderPage();
    expect(screen.getByText(/no longer in the hiring pool/i)).toBeTruthy();
  });

  it("renders not-found alert on error", () => {
    mockUseHiringCandidateDetail.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("boom"),
    });
    renderPage();
    expect(screen.getByText(/no longer in the hiring pool/i)).toBeTruthy();
  });

  it("renders detail with locked reveal when interview not completed", () => {
    mockUseHiringCandidateDetail.mockReturnValue({
      data: {
        id: "c1",
        leagueId: "lg",
        staffType: "coach",
        firstName: "Andy",
        lastName: "Reid",
        role: "HC",
        marketTierPref: 55,
        philosophyFitPref: 80,
        staffFitPref: 70,
        compensationPref: 40,
        minimumThreshold: 50,
        interviewReveal: null,
      },
      isLoading: false,
    });
    renderPage();
    expect(screen.getByTestId("candidate-detail")).toBeTruthy();
    expect(screen.getByTestId("preferences-card")).toBeTruthy();
    expect(screen.getByTestId("reveal-locked")).toBeTruthy();
    expect(screen.getByText("Andy Reid")).toBeTruthy();
  });

  it("renders unlocked interview reveal when available", () => {
    mockUseHiringCandidateDetail.mockReturnValue({
      data: {
        id: "c1",
        leagueId: "lg",
        staffType: "coach",
        firstName: "Andy",
        lastName: "Reid",
        role: "HC",
        marketTierPref: 55,
        philosophyFitPref: 80,
        staffFitPref: 70,
        compensationPref: 40,
        minimumThreshold: 50,
        interviewReveal: {
          philosophyReveal: { approach: "west coast" },
          staffFitReveal: { conflictsWith: [] },
        },
      },
      isLoading: false,
    });
    renderPage();
    expect(screen.getByTestId("reveal-unlocked")).toBeTruthy();
    expect(screen.getByTestId("philosophy-reveal").textContent).toContain(
      "west coast",
    );
    expect(screen.getByTestId("staff-fit-reveal").textContent).toContain(
      "conflictsWith",
    );
  });

  it("renders a dash when a preference value is null", () => {
    mockUseHiringCandidateDetail.mockReturnValue({
      data: {
        id: "c1",
        leagueId: "lg",
        staffType: "coach",
        firstName: "A",
        lastName: "B",
        role: "HC",
        marketTierPref: null,
        philosophyFitPref: null,
        staffFitPref: null,
        compensationPref: null,
        minimumThreshold: null,
        interviewReveal: null,
      },
      isLoading: false,
    });
    renderPage();
    const prefs = screen.getByTestId("preferences-card");
    expect(prefs.textContent).toContain("—");
  });
});
