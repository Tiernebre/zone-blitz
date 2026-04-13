import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { useLeague } from "./use-league.ts";
import { createElement } from "react";

const mockGet = vi.fn();

vi.mock("../api.ts", () => ({
  api: {
    api: {
      leagues: {
        [":id"]: {
          $get: (...args: unknown[]) => mockGet(...args),
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

describe("useLeague", () => {
  it("fetches a league by id", async () => {
    const league = { id: 1, name: "Test League" };
    mockGet.mockResolvedValue({ json: () => Promise.resolve(league) });

    const { result } = renderHook(() => useLeague("1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(league);
    expect(mockGet).toHaveBeenCalledWith({ param: { id: "1" } });
  });
});
