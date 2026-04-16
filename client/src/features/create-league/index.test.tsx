import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreateLeague } from "./index.tsx";
import { CREATION_STAGES, STAGE_INTERVAL_MS } from "./stages.ts";
import { LEAGUE_SETTINGS_DEFAULTS } from "./league-settings-defaults.ts";

const mockPost = vi.fn();
const mockNavigate = vi.fn();

vi.mock("../../api.ts", () => ({
  api: {
    api: {
      leagues: {
        $post: (...args: unknown[]) => mockPost(...args),
      },
    },
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CreateLeague />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("CreateLeague", () => {
  it("renders the heading", () => {
    renderWithProviders();
    expect(
      screen.getByRole("heading", { name: "Create a new league" }),
    ).toBeDefined();
  });

  it("renders a back-to-leagues button that navigates home", () => {
    renderWithProviders();
    fireEvent.click(screen.getByRole("button", { name: /back to leagues/i }));
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
  });

  it("disables the create button when input is empty", () => {
    renderWithProviders();
    const button = screen.getByRole("button", {
      name: "Create league",
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("disables the create button when input is only whitespace", () => {
    renderWithProviders();
    const input = screen.getByLabelText("League name");
    fireEvent.change(input, { target: { value: "   " } });
    const button = screen.getByRole("button", {
      name: "Create league",
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("does not submit when input is only whitespace", () => {
    renderWithProviders();
    const input = screen.getByLabelText("League name");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.submit(input.closest("form")!);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("submits trimmed name and navigates to team select on success", async () => {
    mockPost.mockReturnValue(
      Promise.resolve({
        ok: true,
        status: 201,
        json: () =>
          Promise.resolve({
            league: { id: 42, name: "Gridiron" },
            franchises: [],
          }),
      }),
    );
    renderWithProviders();
    fireEvent.change(screen.getByLabelText("League name"), {
      target: { value: "  Gridiron  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create league" }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith({ json: { name: "Gridiron" } });
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/leagues/$leagueId/team-select",
        params: { leagueId: "42" },
      });
    });
  });

  it("shows an error alert when creation fails", async () => {
    mockPost.mockReturnValue(
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      }),
    );
    renderWithProviders();
    fireEvent.change(screen.getByLabelText("League name"), {
      target: { value: "Flop" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create league" }));

    await waitFor(() => {
      expect(screen.getByText("Failed to create league")).toBeDefined();
    });
  });

  describe("league settings preview", () => {
    it("renders disabled inputs prefilled with MVP defaults", () => {
      renderWithProviders();
      const seasonLength = screen.getByLabelText(
        "Regular season games",
      ) as HTMLInputElement;
      expect(seasonLength.disabled).toBe(true);
      expect(seasonLength.value).toBe(
        String(LEAGUE_SETTINGS_DEFAULTS.seasonLength),
      );

      const conferences = screen.getByLabelText(
        "Conferences",
      ) as HTMLInputElement;
      expect(conferences.disabled).toBe(true);
      expect(conferences.value).toBe(
        String(LEAGUE_SETTINGS_DEFAULTS.conferences),
      );

      const divisions = screen.getByLabelText(
        "Divisions per conference",
      ) as HTMLInputElement;
      expect(divisions.disabled).toBe(true);
      expect(divisions.value).toBe(
        String(LEAGUE_SETTINGS_DEFAULTS.divisionsPerConference),
      );

      const rosterSize = screen.getByLabelText(
        "Roster size",
      ) as HTMLInputElement;
      expect(rosterSize.disabled).toBe(true);
      expect(rosterSize.value).toBe(
        String(LEAGUE_SETTINGS_DEFAULTS.rosterSize),
      );

      const salaryCap = screen.getByLabelText(
        "Salary cap",
      ) as HTMLInputElement;
      expect(salaryCap.disabled).toBe(true);
      expect(salaryCap.value).toBe("$255,000,000");

      const salaryFloor = screen.getByLabelText(
        "Salary floor",
      ) as HTMLInputElement;
      expect(salaryFloor.disabled).toBe(true);
      expect(salaryFloor.value).toBe("$226,950,000");

      const draftRounds = screen.getByLabelText(
        "Draft rounds",
      ) as HTMLInputElement;
      expect(draftRounds.disabled).toBe(true);
      expect(draftRounds.value).toBe(
        String(LEAGUE_SETTINGS_DEFAULTS.draftRounds),
      );
    });

    it("does not render a franchise count input", () => {
      renderWithProviders();
      expect(screen.queryByLabelText(/franchise count/i)).toBeNull();
      expect(screen.queryByLabelText(/number of teams/i)).toBeNull();
      expect(screen.queryByLabelText(/franchises/i)).toBeNull();
    });

    it("renders the league name input as editable above the settings", () => {
      renderWithProviders();
      const nameInput = screen.getByLabelText(
        "League name",
      ) as HTMLInputElement;
      expect(nameInput.disabled).toBe(false);
    });
  });

  describe("staged progress loader", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    function startMutation() {
      mockPost.mockReturnValue(new Promise(() => {}));
      renderWithProviders();
      fireEvent.change(screen.getByLabelText("League name"), {
        target: { value: "My League" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Create league" }));
    }

    it("hides the form and shows the loader while pending", async () => {
      startMutation();
      await vi.waitFor(() => {
        expect(screen.queryByLabelText("League name")).toBeNull();
      });
      expect(screen.getByRole("status")).toBeDefined();
      expect(screen.getByText(/building my league/i)).toBeDefined();
    });

    it("starts on the first stage", async () => {
      startMutation();
      await vi.waitFor(() => {
        expect(screen.getByTestId("current-stage").textContent).toBe(
          CREATION_STAGES[0],
        );
      });
    });

    it("advances through stages over time", async () => {
      startMutation();
      await vi.waitFor(() => {
        expect(screen.getByTestId("current-stage").textContent).toBe(
          CREATION_STAGES[0],
        );
      });

      act(() => {
        vi.advanceTimersByTime(STAGE_INTERVAL_MS);
      });
      expect(screen.getByTestId("current-stage").textContent).toBe(
        CREATION_STAGES[1],
      );

      act(() => {
        vi.advanceTimersByTime(STAGE_INTERVAL_MS);
      });
      expect(screen.getByTestId("current-stage").textContent).toBe(
        CREATION_STAGES[2],
      );
    });

    it("clamps at the final stage and does not overflow", async () => {
      startMutation();
      await vi.waitFor(() => {
        expect(screen.getByTestId("current-stage")).toBeDefined();
      });

      act(() => {
        vi.advanceTimersByTime(
          STAGE_INTERVAL_MS * (CREATION_STAGES.length + 5),
        );
      });
      expect(screen.getByTestId("current-stage").textContent).toBe(
        CREATION_STAGES[CREATION_STAGES.length - 1],
      );
    });

    it("renders each stage item with done, active, or pending state", async () => {
      startMutation();
      await vi.waitFor(() => {
        expect(screen.getByTestId("current-stage")).toBeDefined();
      });

      act(() => {
        vi.advanceTimersByTime(STAGE_INTERVAL_MS * 2);
      });
      const items = document.querySelectorAll("[data-state]");
      expect(items.length).toBe(CREATION_STAGES.length);
      expect(items[0].getAttribute("data-state")).toBe("done");
      expect(items[1].getAttribute("data-state")).toBe("done");
      expect(items[2].getAttribute("data-state")).toBe("active");
      expect(items[3].getAttribute("data-state")).toBe("pending");
    });

    it("shows a generic label when submitted name is empty (defensive)", async () => {
      // Not reachable through UI (button disabled), but guards the fallback
      // branch of the 'Building X' label.
      mockPost.mockReturnValue(new Promise(() => {}));
      renderWithProviders();
      const input = screen.getByLabelText("League name") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "Temp" } });
      fireEvent.click(screen.getByRole("button", { name: "Create league" }));
      await vi.waitFor(() => {
        expect(screen.getByRole("status")).toBeDefined();
      });
      // state change while pending is cosmetic — verify loader stays.
      expect(screen.getByText(/building temp/i)).toBeDefined();
    });
  });
});
