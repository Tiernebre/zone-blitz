import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { useDeleteAccount } from "./use-delete-account.ts";
import { createElement } from "react";

const mockDelete = vi.fn();
const mockSignOut = vi.fn();

vi.mock("../api.ts", () => ({
  api: {
    api: {
      users: {
        me: {
          $delete: (...args: unknown[]) => mockDelete(...args),
        },
      },
    },
  },
}));

vi.mock("../lib/auth-client.ts", () => ({
  authClient: {
    signOut: (...args: unknown[]) => mockSignOut(...args),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useDeleteAccount", () => {
  it("calls the delete endpoint and signs out on success", async () => {
    mockDelete.mockResolvedValue({ ok: true });
    mockSignOut.mockResolvedValue({});

    const { result } = renderHook(() => useDeleteAccount(), {
      wrapper: createWrapper(),
    });

    result.current.mutate();

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockDelete).toHaveBeenCalled();
    expect(mockSignOut).toHaveBeenCalled();
  });
});
