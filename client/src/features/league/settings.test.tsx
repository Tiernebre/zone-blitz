import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LeagueSettings } from "./settings.tsx";

const mockDelete = vi.fn();
const mockNavigate = vi.fn();

vi.mock("../../api.ts", () => ({
  api: {
    api: {
      leagues: {
        ":id": {
          $delete: (...args: unknown[]) => mockDelete(...args),
        },
      },
    },
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ leagueId: "league-1" }),
  useNavigate: () => mockNavigate,
}));

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LeagueSettings />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("LeagueSettings", () => {
  it("renders the Settings heading", () => {
    renderWithProviders();
    expect(
      screen.getByRole("heading", { name: "Settings" }),
    ).toBeDefined();
  });

  it("renders the Danger Zone section", () => {
    renderWithProviders();
    expect(screen.getByText(/danger zone/i)).toBeDefined();
  });

  it("renders a Delete League button", () => {
    renderWithProviders();
    expect(
      screen.getByRole("button", { name: "Delete League" }),
    ).toBeDefined();
  });

  it("shows alert dialog with confirmation after clicking Delete League", async () => {
    renderWithProviders();
    fireEvent.click(screen.getByRole("button", { name: "Delete League" }));
    await waitFor(() => {
      expect(screen.getByText("Delete this league?")).toBeDefined();
      expect(
        screen.getByText(
          /this action cannot be undone/i,
        ),
      ).toBeDefined();
      expect(
        screen.getByRole("button", { name: "Confirm Delete" }),
      ).toBeDefined();
      expect(
        screen.getByRole("button", { name: "Cancel" }),
      ).toBeDefined();
    });
  });

  it("closes dialog when Cancel is clicked", async () => {
    renderWithProviders();
    fireEvent.click(screen.getByRole("button", { name: "Delete League" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Cancel" })).toBeDefined();
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByText("Delete this league?")).toBeNull();
    });
  });

  it("calls delete API when Confirm Delete is clicked", async () => {
    mockDelete.mockReturnValue(Promise.resolve({ ok: true }));
    renderWithProviders();

    fireEvent.click(screen.getByRole("button", { name: "Delete League" }));
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Confirm Delete" }),
      ).toBeDefined();
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm Delete" }));

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith({ param: { id: "league-1" } });
    });
  });

  it("navigates to home after successful deletion", async () => {
    mockDelete.mockReturnValue(Promise.resolve({ ok: true }));
    renderWithProviders();

    fireEvent.click(screen.getByRole("button", { name: "Delete League" }));
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Confirm Delete" }),
      ).toBeDefined();
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm Delete" }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
    });
  });

  it("shows Deleting... text while mutation is pending", async () => {
    mockDelete.mockReturnValue(new Promise(() => {}));
    renderWithProviders();

    fireEvent.click(screen.getByRole("button", { name: "Delete League" }));
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Confirm Delete" }),
      ).toBeDefined();
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm Delete" }));

    await waitFor(() => {
      expect(screen.getByText("Deleting...")).toBeDefined();
    });
  });
});
