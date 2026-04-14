import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { useActiveRoster } from "./use-active-roster.ts";

const mockGet = vi.fn();

vi.mock("../api.ts", () => ({
  api: {
    api: {
      roster: {
        leagues: {
          [":leagueId"]: {
            teams: {
              [":teamId"]: {
                active: {
                  $get: (...args: unknown[]) => mockGet(...args),
                },
              },
            },
          },
        },
      },
    },
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useActiveRoster", () => {
  it("fetches an active roster for a league and team", async () => {
    const roster = {
      leagueId: "L1",
      teamId: "T1",
      players: [],
      positionGroups: [],
      totalCap: 0,
      salaryCap: 255_000_000,
      capSpace: 255_000_000,
    };
    mockGet.mockResolvedValue({ json: () => Promise.resolve(roster) });

    const { result } = renderHook(() => useActiveRoster("L1", "T1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(roster);
    expect(mockGet).toHaveBeenCalledWith({
      param: { leagueId: "L1", teamId: "T1" },
    });
  });

  it("does not fetch when teamId is missing", () => {
    mockGet.mockClear();
    const { result } = renderHook(() => useActiveRoster("L1", null), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockGet).not.toHaveBeenCalled();
  });
});
