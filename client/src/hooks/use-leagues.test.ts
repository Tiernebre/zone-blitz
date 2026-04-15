import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import {
  useAssignUserTeam,
  useCreateLeague,
  useTouchLeague,
} from "./use-leagues.ts";
import { createElement } from "react";

const mockPost = vi.fn();
const mockAssign = vi.fn();
const mockTouch = vi.fn();

vi.mock("../api.ts", () => ({
  api: {
    api: {
      leagues: {
        $post: (...args: unknown[]) => mockPost(...args),
        ":id": {
          "user-team": {
            $patch: (...args: unknown[]) => mockAssign(...args),
          },
          touch: {
            $post: (...args: unknown[]) => mockTouch(...args),
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

describe("useCreateLeague", () => {
  it("returns the created league with franchises on success", async () => {
    const response = {
      league: { id: "abc", name: "Test League" },
      franchises: [{ id: "f-1", leagueId: "abc", teamId: "t-1" }],
    };
    mockPost.mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve(response),
    });

    const { result } = renderHook(() => useCreateLeague(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ name: "Test League" });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(response);
  });

  it("rejects when the server responds with a non-ok status", async () => {
    mockPost.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "boom" }),
    });

    const { result } = renderHook(() => useCreateLeague(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ name: "Test League" });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });
});

describe("useAssignUserTeam", () => {
  it("returns the updated league on success", async () => {
    const league = { id: "abc", userTeamId: "t1" };
    mockAssign.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(league),
    });

    const { result } = renderHook(() => useAssignUserTeam(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ leagueId: "abc", userTeamId: "t1" });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockAssign).toHaveBeenCalledWith({
      param: { id: "abc" },
      json: { userTeamId: "t1" },
    });
    expect(result.current.data).toEqual(league);
  });

  it("rejects when the server responds with a non-ok status", async () => {
    mockAssign.mockResolvedValue({
      ok: false,
      status: 500,
    });

    const { result } = renderHook(() => useAssignUserTeam(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ leagueId: "abc", userTeamId: "t1" });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });
});

describe("useTouchLeague", () => {
  it("posts to the touch endpoint and returns the league", async () => {
    const league = { id: "abc", lastPlayedAt: "2026-04-14T00:00:00Z" };
    mockTouch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(league),
    });

    const { result } = renderHook(() => useTouchLeague(), {
      wrapper: createWrapper(),
    });

    result.current.mutate("abc");

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockTouch).toHaveBeenCalledWith({ param: { id: "abc" } });
    expect(result.current.data).toEqual(league);
  });

  it("rejects when the server responds with a non-ok status", async () => {
    mockTouch.mockResolvedValue({ ok: false, status: 500 });

    const { result } = renderHook(() => useTouchLeague(), {
      wrapper: createWrapper(),
    });

    result.current.mutate("abc");

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });
});
