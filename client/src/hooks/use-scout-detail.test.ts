import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { useScoutDetail } from "./use-scout-detail.ts";
import { createElement } from "react";

const mockGet = vi.fn();

vi.mock("../api.ts", () => ({
  api: {
    api: {
      scouts: {
        [":scoutId"]: {
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

describe("useScoutDetail", () => {
  it("fetches the scout detail by id", async () => {
    const detail = { id: "s1", firstName: "A", lastName: "B" };
    mockGet.mockResolvedValue({ json: () => Promise.resolve(detail) });

    const { result } = renderHook(() => useScoutDetail("s1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(detail);
    expect(mockGet).toHaveBeenCalledWith({ param: { scoutId: "s1" } });
  });

  it("skips fetching when scoutId is empty", () => {
    mockGet.mockClear();
    const { result } = renderHook(() => useScoutDetail(""), {
      wrapper: createWrapper(),
    });
    expect(result.current.isFetching).toBe(false);
    expect(mockGet).not.toHaveBeenCalled();
  });
});
