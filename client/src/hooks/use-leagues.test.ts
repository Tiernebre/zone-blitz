import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { useCreateLeague } from "./use-leagues.ts";
import { createElement } from "react";

const mockPost = vi.fn();

vi.mock("../api.ts", () => ({
  api: {
    api: {
      leagues: {
        $post: (...args: unknown[]) => mockPost(...args),
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
  it("returns the created league on success", async () => {
    const league = { id: "abc", name: "Test League" };
    mockPost.mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve(league),
    });

    const { result } = renderHook(() => useCreateLeague(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ name: "Test League" });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(league);
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
