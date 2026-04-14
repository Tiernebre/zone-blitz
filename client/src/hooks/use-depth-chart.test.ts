import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { useDepthChart } from "./use-depth-chart.ts";

const mockGet = vi.fn();

vi.mock("../api.ts", () => ({
  api: {
    api: {
      roster: {
        leagues: {
          [":leagueId"]: {
            teams: {
              [":teamId"]: {
                "depth-chart": {
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

describe("useDepthChart", () => {
  it("fetches a depth chart for a league and team", async () => {
    const chart = {
      leagueId: "L1",
      teamId: "T1",
      slots: [],
      inactives: [],
      lastUpdatedAt: null,
      lastUpdatedBy: null,
    };
    mockGet.mockResolvedValue({ json: () => Promise.resolve(chart) });

    const { result } = renderHook(() => useDepthChart("L1", "T1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(chart);
    expect(mockGet).toHaveBeenCalledWith({
      param: { leagueId: "L1", teamId: "T1" },
    });
  });

  it("does not fetch when teamId is missing", () => {
    mockGet.mockClear();
    const { result } = renderHook(() => useDepthChart("L1", null), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockGet).not.toHaveBeenCalled();
  });
});
