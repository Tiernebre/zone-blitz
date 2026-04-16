import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUserTeam } from "./use-user-team.ts";

const mockLeagueGet = vi.fn();
const mockTeamsGet = vi.fn();

vi.mock("../api.ts", () => ({
  api: {
    api: {
      leagues: {
        ":id": {
          $get: (...args: unknown[]) => mockLeagueGet(...args),
        },
      },
      teams: {
        league: {
          ":leagueId": {
            $get: (...args: unknown[]) => mockTeamsGet(...args),
          },
        },
      },
    },
  },
}));

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  mockLeagueGet.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ id: "1", name: "L", userTeamId: "team-a" }),
  });
  mockTeamsGet.mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve([
        {
          id: "team-a",
          name: "Alphas",
          city: "Alpha City",
          abbreviation: "ALP",
          primaryColor: "#112233",
          secondaryColor: "#445566",
          accentColor: "#778899",
        },
        {
          id: "team-b",
          name: "Betas",
          city: "Beta",
          abbreviation: "BET",
          primaryColor: "#000000",
          secondaryColor: "#ffffff",
          accentColor: "#ff0000",
        },
      ]),
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useUserTeam", () => {
  it("returns the team matching the league's userTeamId", async () => {
    const { result } = renderHook(() => useUserTeam("1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current).toBeDefined());
    expect(result.current?.id).toBe("team-a");
    expect(result.current?.primaryColor).toBe("#112233");
    expect(result.current?.secondaryColor).toBe("#445566");
    expect(result.current?.accentColor).toBe("#778899");
  });

  it("returns undefined when the league has no userTeamId", async () => {
    mockLeagueGet.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "1", name: "L", userTeamId: null }),
    });
    const { result } = renderHook(() => useUserTeam("1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => {
      expect(mockTeamsGet).toHaveBeenCalled();
    });
    expect(result.current).toBeUndefined();
  });

  it("returns undefined when leagueId is empty", () => {
    const { result } = renderHook(() => useUserTeam(""), {
      wrapper: createWrapper(),
    });
    expect(result.current).toBeUndefined();
  });
});
