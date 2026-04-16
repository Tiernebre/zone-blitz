import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { useAdvanceLeagueClock, useLeagueClock } from "./use-league-clock.ts";
import { createElement } from "react";

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock("../api.ts", () => ({
  api: {
    api: {
      "league-clock": {
        ":leagueId": {
          $get: (...args: unknown[]) => mockGet(...args),
          advance: {
            $post: (...args: unknown[]) => mockPost(...args),
          },
        },
      },
    },
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useLeagueClock", () => {
  it("fetches the league clock by leagueId", async () => {
    const apiResponse = {
      phase: "regular-season",
      week: 3,
      hasCompletedInitial: true,
    };
    mockGet.mockResolvedValue({
      json: () => Promise.resolve(apiResponse),
    });

    const { result } = renderHook(() => useLeagueClock("league-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual({
      phase: "regular-season",
      week: 3,
      isInauguralSeason: false,
    });
    expect(mockGet).toHaveBeenCalledWith({ param: { leagueId: "league-1" } });
  });

  it("is disabled when leagueId is empty", () => {
    const { result } = renderHook(() => useLeagueClock(""), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("useAdvanceLeagueClock", () => {
  const advanceArgs = {
    leagueId: "league-1",
    isCommissioner: true,
    gateState: {
      teams: [
        {
          teamId: "t-1",
          isNpc: false,
          autoPilot: false,
          capCompliant: true,
          activeRosterCount: 53,
          rosterLimit: 53,
        },
      ],
      draftOrderResolved: true,
      superBowlPlayed: false,
      priorPhaseComplete: true,
      allTeamsHaveStaff: false,
    },
  };

  it("advances the league clock on success", async () => {
    const response = { phase: "playoffs", week: 1 };
    mockPost.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(response),
    });

    const { result } = renderHook(() => useAdvanceLeagueClock(), {
      wrapper: createWrapper(),
    });

    result.current.mutate(advanceArgs);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(response);
    expect(mockPost).toHaveBeenCalledWith({
      param: { leagueId: "league-1" },
      json: {
        isCommissioner: true,
        overrideReason: undefined,
        gateState: advanceArgs.gateState,
      },
    });
  });

  it("throws with server message when advance fails", async () => {
    mockPost.mockResolvedValue({
      ok: false,
      status: 422,
      json: () => Promise.resolve({ message: "Gate not satisfied" }),
    });

    const { result } = renderHook(() => useAdvanceLeagueClock(), {
      wrapper: createWrapper(),
    });

    result.current.mutate(advanceArgs);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("Gate not satisfied");
  });

  it("throws with fallback message when server has no message", async () => {
    mockPost.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    });

    const { result } = renderHook(() => useAdvanceLeagueClock(), {
      wrapper: createWrapper(),
    });

    result.current.mutate(advanceArgs);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe("Advance failed (500)");
  });
});
