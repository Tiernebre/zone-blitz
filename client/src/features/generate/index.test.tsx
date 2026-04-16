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

const mockGeneratePost = vi.fn();
const mockNavigate = vi.fn();

vi.mock("../../api.ts", () => ({
  api: {
    api: {
      leagues: {
        ":id": {
          generate: {
            $post: (...args: unknown[]) => mockGeneratePost(...args),
          },
        },
      },
    },
  },
}));

const mockUseParams = vi.fn(() => ({ leagueId: "league-1" }));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => mockUseParams(),
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
  mockUseParams.mockReturnValue({ leagueId: "league-1" });
});

describe("Generate", () => {
  it("shows the first milestone copy on mount", () => {
    mockGeneratePost.mockReturnValue(new Promise(() => {}));
    renderWithProviders();
    expect(
      screen.getByText("Creating coaches and league structure…"),
    ).toBeDefined();
  });

  it("cycles through narrative milestones while generation is pending", () => {
    mockGeneratePost.mockReturnValue(new Promise(() => {}));
    renderWithProviders();

    expect(screen.getByText(MILESTONE_COPY[0])).toBeDefined();

    for (let i = 1; i < MILESTONE_COPY.length; i++) {
      act(() => {
        vi.advanceTimersByTime(2500);
      });
      expect(screen.getByText(MILESTONE_COPY[i])).toBeDefined();
    }
  });

  it("calls the generate endpoint and navigates to dashboard on success", async () => {
    mockGeneratePost.mockReturnValue(
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
      expect(mockGeneratePost).toHaveBeenCalledWith({
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

  it("only calls the generate endpoint once across re-renders", async () => {
    mockGeneratePost.mockReturnValue(new Promise(() => {}));
    const { rerender } = renderWithProviders();

    await vi.waitFor(() => {
      expect(mockGeneratePost).toHaveBeenCalledTimes(1);
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    rerender(
      <QueryClientProvider client={queryClient}>
        <Generate />
      </QueryClientProvider>,
    );

    expect(mockGeneratePost).toHaveBeenCalledTimes(1);
  });

  it("shows error alert with retry control when generation fails", async () => {
    mockGeneratePost.mockReturnValue(
      Promise.resolve({ ok: false, status: 500 }),
    );
    renderWithProviders();

    await vi.waitFor(() => {
      expect(screen.getByText("Generation failed")).toBeDefined();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /try again/i })).toBeDefined();
  });

  it("does not call generate when no leagueId is present", () => {
    mockUseParams.mockReturnValue(
      {} as unknown as { leagueId: string },
    );
    renderWithProviders();
    expect(mockGeneratePost).not.toHaveBeenCalled();
  });

  it("does nothing when retry is clicked without a leagueId", async () => {
    mockGeneratePost.mockReturnValueOnce(
      Promise.resolve({ ok: false, status: 500 }),
    );
    renderWithProviders();
    await vi.waitFor(() => {
      expect(screen.getByText("Generation failed")).toBeDefined();
    });
    mockUseParams.mockReturnValue(
      {} as unknown as { leagueId: string },
    );
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(mockGeneratePost).toHaveBeenCalledTimes(1);
  });

  it("retries the generate call when the user clicks Try again", async () => {
    mockGeneratePost.mockReturnValueOnce(
      Promise.resolve({ ok: false, status: 500 }),
    );
    renderWithProviders();

    await vi.waitFor(() => {
      expect(screen.getByText("Generation failed")).toBeDefined();
    });

    mockGeneratePost.mockReturnValueOnce(
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ leagueId: "league-1" }),
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    await vi.waitFor(() => {
      expect(mockGeneratePost).toHaveBeenCalledTimes(2);
    });
    await vi.waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/leagues/$leagueId",
        params: { leagueId: "league-1" },
      });
    });
  });
});
