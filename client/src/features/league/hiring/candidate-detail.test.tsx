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
    expect(screen.getByTestId("reveal-locked")).toBeTruthy();
    expect(screen.getByText("Andy Reid")).toBeTruthy();
    expect(screen.getByText("Head Coach")).toBeTruthy();
    expect(screen.queryByTestId("preferences-card")).toBeNull();
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

  it("shows the unrevealed placeholder for reveal sections whose value is missing", () => {
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
        interviewReveal: {
          philosophyReveal: null,
          staffFitReveal: { conflictsWith: [] },
        },
      },
      isLoading: false,
    });
    renderPage();
    expect(screen.getByTestId("reveal-unlocked")).toBeTruthy();
    expect(screen.getByTestId("philosophy-reveal").textContent).toContain(
      "Not yet revealed",
    );
  });

  it("shows the role-experience breakdown for a first-time HC", () => {
    mockUseHiringCandidateDetail.mockReturnValue({
      data: {
        id: "c1",
        leagueId: "lg",
        staffType: "coach",
        firstName: "Andy",
        lastName: "Reid",
        role: "HC",
        age: 40,
        yearsExperience: 15,
        headCoachYears: 0,
        coordinatorYears: 6,
        positionCoachYears: 9,
        interviewReveal: null,
      },
      isLoading: false,
    });
    renderPage();
    const text = screen.getByTestId("candidate-experience-breakdown")
      .textContent ?? "";
    expect(text).toContain("15 yrs coaching");
    expect(text).toContain("first-time HC");
    expect(text).toContain("6 yrs as coordinator");
    expect(text).toContain("9 yrs as position coach");
  });

  it("shows proven-HC breakdown with role-specific tenure", () => {
    mockUseHiringCandidateDetail.mockReturnValue({
      data: {
        id: "c1",
        leagueId: "lg",
        staffType: "coach",
        firstName: "Bill",
        lastName: "B",
        role: "HC",
        age: 60,
        yearsExperience: 1,
        headCoachYears: 1,
        coordinatorYears: 0,
        positionCoachYears: 0,
        interviewReveal: null,
      },
      isLoading: false,
    });
    renderPage();
    const text = screen.getByTestId("candidate-experience-breakdown")
      .textContent ?? "";
    expect(text).toContain("1 yr coaching");
    expect(text).toContain("1 yr as HC");
    expect(screen.getByTestId("candidate-expected-salary").textContent)
      .toContain("$");
  });

  it("shows coordinator + position breakdown for an OC candidate", () => {
    mockUseHiringCandidateDetail.mockReturnValue({
      data: {
        id: "c1",
        leagueId: "lg",
        staffType: "coach",
        firstName: "Kyle",
        lastName: "Shan",
        role: "OC",
        age: 42,
        yearsExperience: 14,
        headCoachYears: 0,
        coordinatorYears: 4,
        positionCoachYears: 10,
        interviewReveal: null,
      },
      isLoading: false,
    });
    renderPage();
    const text = screen.getByTestId("candidate-experience-breakdown")
      .textContent ?? "";
    expect(text).toContain("14 yrs coaching");
    expect(text).toContain("4 yrs as coordinator");
    expect(text).toContain("10 yrs as position coach");
    expect(text).not.toContain("HC");
  });

  it("omits the experience breakdown for scouts", () => {
    mockUseHiringCandidateDetail.mockReturnValue({
      data: {
        id: "s1",
        leagueId: "lg",
        staffType: "scout",
        firstName: "Scout",
        lastName: "Director",
        role: "DIRECTOR",
        age: 50,
        yearsExperience: 20,
        interviewReveal: null,
      },
      isLoading: false,
    });
    renderPage();
    expect(screen.queryByTestId("candidate-experience-breakdown")).toBeNull();
  });

  it("keeps the reveal locked when the reveal object has only null fields", () => {
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
        interviewReveal: {
          philosophyReveal: null,
          staffFitReveal: null,
        },
      },
      isLoading: false,
    });
    renderPage();
    expect(screen.getByTestId("reveal-locked")).toBeTruthy();
  });
});
