import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { useScoutStaffTree } from "./use-scout-staff-tree.ts";
import { createElement } from "react";

const mockGet = vi.fn();

vi.mock("../api.ts", () => ({
  api: {
    api: {
      scouts: {
        leagues: {
          [":leagueId"]: {
            teams: {
              [":teamId"]: {
                staff: {
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

describe("useScoutStaffTree", () => {
  it("fetches the staff tree for a team scoped to a league", async () => {
    const staff = [{
      id: "s1",
      firstName: "A",
      lastName: "B",
      role: "DIRECTOR",
    }];
    mockGet.mockResolvedValue({ json: () => Promise.resolve(staff) });

    const { result } = renderHook(
      () => useScoutStaffTree("league-1", "team-1"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(staff);
    expect(mockGet).toHaveBeenCalledWith({
      param: { leagueId: "league-1", teamId: "team-1" },
    });
  });

  it("skips fetching when teamId is empty", () => {
    mockGet.mockClear();
    const { result } = renderHook(() => useScoutStaffTree("league-1", ""), {
      wrapper: createWrapper(),
    });
    expect(result.current.isFetching).toBe(false);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("skips fetching when leagueId is empty", () => {
    mockGet.mockClear();
    const { result } = renderHook(() => useScoutStaffTree("", "team-1"), {
      wrapper: createWrapper(),
    });
    expect(result.current.isFetching).toBe(false);
    expect(mockGet).not.toHaveBeenCalled();
  });
});
