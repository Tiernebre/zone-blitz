import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { useSchemeFingerprint } from "./use-scheme-fingerprint.ts";
import { createElement } from "react";

const mockGet = vi.fn();

vi.mock("../api.ts", () => ({
  api: {
    api: {
      coaches: {
        leagues: {
          [":leagueId"]: {
            teams: {
              [":teamId"]: {
                fingerprint: {
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

describe("useSchemeFingerprint", () => {
  it("fetches the fingerprint for a team scoped to a league", async () => {
    const fingerprint = {
      offense: {
        runPassLean: 40,
        tempo: 55,
        personnelWeight: 50,
        formationUnderCenterShotgun: 30,
        preSnapMotionRate: 80,
        passingStyle: 30,
        passingDepth: 45,
        runGameBlocking: 25,
        rpoIntegration: 30,
      },
      defense: null,
      overrides: {},
    };
    mockGet.mockResolvedValue({ json: () => Promise.resolve(fingerprint) });

    const { result } = renderHook(
      () => useSchemeFingerprint("league-1", "team-1"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual(fingerprint);
    expect(mockGet).toHaveBeenCalledWith({
      param: { leagueId: "league-1", teamId: "team-1" },
    });
  });

  it("skips fetching when teamId is empty", () => {
    mockGet.mockClear();
    const { result } = renderHook(
      () => useSchemeFingerprint("league-1", ""),
      { wrapper: createWrapper() },
    );
    expect(result.current.isFetching).toBe(false);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("skips fetching when leagueId is empty", () => {
    mockGet.mockClear();
    const { result } = renderHook(
      () => useSchemeFingerprint("", "team-1"),
      { wrapper: createWrapper() },
    );
    expect(result.current.isFetching).toBe(false);
    expect(mockGet).not.toHaveBeenCalled();
  });
});
