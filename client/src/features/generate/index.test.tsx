import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Generate, MILESTONE_COPY } from "./index.tsx";

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

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.clearAllMocks();
});

describe("Generate", () => {
  it("shows the first ADR-0030 milestone copy on mount", () => {
    mockFoundPost.mockReturnValue(new Promise(() => {}));
    renderWithProviders();
    expect(
      screen.getByText("Creating coaches and league foundation…"),
    ).toBeDefined();
  });

  it("cycles through narrative milestones while generation is pending", () => {
    mockFoundPost.mockReturnValue(new Promise(() => {}));
    renderWithProviders();

    expect(screen.getByText(MILESTONE_COPY[0])).toBeDefined();

    for (let i = 1; i < MILESTONE_COPY.length; i++) {
      act(() => {
        vi.advanceTimersByTime(2500);
      });
      expect(screen.getByText(MILESTONE_COPY[i])).toBeDefined();
    }
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

    await vi.waitFor(() => {
      expect(mockFoundPost).toHaveBeenCalledWith({
        param: { id: "league-1" },
      });
    });
    await vi.waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/leagues/$leagueId",
        params: { leagueId: "league-1" },
      });
    });
  });

  it("only calls the found endpoint once across re-renders", async () => {
    mockFoundPost.mockReturnValue(new Promise(() => {}));
    const { rerender } = renderWithProviders();

    await vi.waitFor(() => {
      expect(mockFoundPost).toHaveBeenCalledTimes(1);
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    rerender(
      <QueryClientProvider client={queryClient}>
        <Generate />
      </QueryClientProvider>,
    );

    expect(mockFoundPost).toHaveBeenCalledTimes(1);
  });

  it("shows error alert with retry control when founding fails", async () => {
    mockFoundPost.mockReturnValue(
      Promise.resolve({ ok: false, status: 500 }),
    );
    renderWithProviders();

    await vi.waitFor(() => {
      expect(screen.getByText("Generation failed")).toBeDefined();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /try again/i })).toBeDefined();
  });

  it("retries the found call when the user clicks Try again", async () => {
    mockFoundPost.mockReturnValueOnce(
      Promise.resolve({ ok: false, status: 500 }),
    );
    renderWithProviders();

    await vi.waitFor(() => {
      expect(screen.getByText("Generation failed")).toBeDefined();
    });

    mockFoundPost.mockReturnValueOnce(
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ leagueId: "league-1" }),
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    await vi.waitFor(() => {
      expect(mockFoundPost).toHaveBeenCalledTimes(2);
    });
    await vi.waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/leagues/$leagueId",
        params: { leagueId: "league-1" },
      });
    });
  });
});
