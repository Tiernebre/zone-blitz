import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { useRosterFit } from "./use-roster-fit.ts";
import { createElement } from "react";

const mockGet = vi.fn();

vi.mock("../api.ts", () => ({
  api: {
    api: {
      roster: {
        leagues: {
          [":leagueId"]: {
            teams: {
              [":teamId"]: {
                fit: {
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

describe("useRosterFit", () => {
  it("fetches the fit map for a team scoped to a league", async () => {
    const fits = { "p-1": "fits", "p-2": "neutral" };
    mockGet.mockResolvedValue({ json: () => Promise.resolve(fits) });

    const { result } = renderHook(() => useRosterFit("l1", "t1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual(fits);
    expect(mockGet).toHaveBeenCalledWith({
      param: { leagueId: "l1", teamId: "t1" },
    });
  });

  it("does not fetch when teamId is null", () => {
    mockGet.mockClear();
    const { result } = renderHook(() => useRosterFit("l1", null), {
      wrapper: createWrapper(),
    });
    expect(result.current.isFetching).toBe(false);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("does not fetch when leagueId is empty", () => {
    mockGet.mockClear();
    const { result } = renderHook(() => useRosterFit("", "t1"), {
      wrapper: createWrapper(),
    });
    expect(result.current.isFetching).toBe(false);
    expect(mockGet).not.toHaveBeenCalled();
  });
});
