import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Generate } from "./index.tsx";

const mockFoundPost = vi.fn();
const mockNavigate = vi.fn();

vi.mock("../../api.ts", () => ({
  api: {
    api: {
      leagues: {
        ":id": {
          found: {
            $post: (...args: unknown[]) => mockFoundPost(...args),
          },
        },
      },
    },
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ leagueId: "league-1" }),
}));

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Generate />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Generate", () => {
  it("shows loading state with founding message", () => {
    mockFoundPost.mockReturnValue(new Promise(() => {}));
    renderWithProviders();
    expect(screen.getByText("Founding your league")).toBeDefined();
  });

  it("calls the found endpoint and navigates to dashboard on success", async () => {
    mockFoundPost.mockReturnValue(
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            leagueId: "league-1",
            seasonId: "s1",
            playerCount: 400,
            coachCount: 24,
            scoutCount: 16,
          }),
      }),
    );
    renderWithProviders();

    await waitFor(() => {
      expect(mockFoundPost).toHaveBeenCalledWith({
        param: { id: "league-1" },
      });
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/leagues/$leagueId",
        params: { leagueId: "league-1" },
      });
    });
  });

  it("shows error alert when founding fails", async () => {
    mockFoundPost.mockReturnValue(
      Promise.resolve({ ok: false, status: 500 }),
    );
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Generation failed")).toBeDefined();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
