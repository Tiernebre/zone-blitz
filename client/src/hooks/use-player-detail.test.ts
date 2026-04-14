import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { usePlayerDetail } from "./use-player-detail.ts";

const mockGet = vi.fn();

vi.mock("../api.ts", () => ({
  api: {
    api: {
      players: {
        [":playerId"]: {
          $get: (...args: unknown[]) => mockGet(...args),
        },
      },
    },
  },
}));

afterEach(() => {
  vi.clearAllMocks();
});

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

describe("usePlayerDetail", () => {
  it("fetches the player detail when a playerId is provided", async () => {
    mockGet.mockResolvedValue({ json: () => Promise.resolve({ id: "p1" }) });
    const { result } = renderHook(() => usePlayerDetail("p1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.data).toEqual({ id: "p1" }));
    expect(mockGet).toHaveBeenCalledWith({ param: { playerId: "p1" } });
  });

  it("does not fetch when playerId is null", () => {
    renderHook(() => usePlayerDetail(null), { wrapper: createWrapper() });
    expect(mockGet).not.toHaveBeenCalled();
  });
});
