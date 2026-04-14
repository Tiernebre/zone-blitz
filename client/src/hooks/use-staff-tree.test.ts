import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { useStaffTree } from "./use-staff-tree.ts";
import { createElement } from "react";

const mockGet = vi.fn();

vi.mock("../api.ts", () => ({
  api: {
    api: {
      coaches: {
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
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useStaffTree", () => {
  it("fetches the staff tree for a team", async () => {
    const staff = [{ id: "c1", firstName: "A", lastName: "B", role: "HC" }];
    mockGet.mockResolvedValue({ json: () => Promise.resolve(staff) });

    const { result } = renderHook(() => useStaffTree("team-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(staff);
    expect(mockGet).toHaveBeenCalledWith({ param: { teamId: "team-1" } });
  });

  it("skips fetching when teamId is empty", () => {
    mockGet.mockClear();
    const { result } = renderHook(() => useStaffTree(""), {
      wrapper: createWrapper(),
    });
    expect(result.current.isFetching).toBe(false);
    expect(mockGet).not.toHaveBeenCalled();
  });
});
