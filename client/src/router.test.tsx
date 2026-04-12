import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppRouter, createTestRouter } from "./router.tsx";

const mockGet = vi.fn();

vi.mock("./api.ts", () => ({
  api: {
    api: {
      leagues: {
        $get: (...args: unknown[]) => mockGet(...args),
        $post: vi.fn(),
      },
    },
  },
}));

function renderRouter(initialPath = "/") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createTestRouter(initialPath);
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("createAppRouter", () => {
  it("creates a router instance", () => {
    const router = createAppRouter();
    expect(router).toBeDefined();
  });
});

describe("Router", () => {
  it("renders the league select page at /", async () => {
    mockGet.mockReturnValue(
      Promise.resolve({ json: () => Promise.resolve([]) }),
    );
    renderRouter("/");
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Zone Blitz" }),
      ).toBeDefined();
    });
  });

  it("renders the league layout and home page at /leagues/:leagueId", async () => {
    renderRouter("/leagues/1");
    await waitFor(() => {
      expect(screen.getByRole("navigation")).toBeDefined();
      expect(
        screen.getByRole("heading", { name: "League Home" }),
      ).toBeDefined();
    });
  });
});
