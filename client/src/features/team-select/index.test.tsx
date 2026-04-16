import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TeamSelect } from "./index.tsx";

const mockFranchisesGet = vi.fn();
const mockAssignTeam = vi.fn();
const mockNavigate = vi.fn();

vi.mock("../../api.ts", () => ({
  api: {
    api: {
      leagues: {
        ":id": {
          "user-team": {
            $patch: (...args: unknown[]) => mockAssignTeam(...args),
          },
        },
      },
      teams: {
        league: {
          ":leagueId": {
            $get: (...args: unknown[]) => mockFranchisesGet(...args),
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

const MOCK_FRANCHISES = [
  {
    id: "f1",
    name: "Aces",
    city: "Reno",
    abbreviation: "RNO",
    primaryColor: "#1A1A2E",
    secondaryColor: "#C9A227",
    accentColor: "#E74C3C",
    backstory:
      "Born from the neon glow and high-stakes spirit of the Biggest Little City.",
    conference: "Mountain",
  },
  {
    id: "f2",
    name: "Riveters",
    city: "Portland",
    abbreviation: "PDX",
    primaryColor: "#2D4A3E",
    secondaryColor: "#D4856B",
    accentColor: "#F5F0E1",
    backstory:
      "Forged in Portland's shipyard heritage, the Riveters honor the workers who built the West.",
    conference: "Pacific",
  },
  {
    id: "f3",
    name: "Admirals",
    city: "San Diego",
    abbreviation: "SDG",
    primaryColor: "#003459",
    secondaryColor: "#D4AF37",
    accentColor: "#FFFFFF",
    backstory:
      "With a naval heritage stretching back generations, the Admirals command San Diego's waterfront.",
    conference: "Pacific",
  },
];

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TeamSelect />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TeamSelect", () => {
  it("renders the Choose Your Franchise heading", async () => {
    mockFranchisesGet.mockReturnValue(
      Promise.resolve({ json: () => Promise.resolve(MOCK_FRANCHISES) }),
    );
    renderWithProviders();
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Choose Your Franchise" }),
      ).toBeDefined();
    });
  });

  it("shows skeleton loading state while fetching franchises", () => {
    mockFranchisesGet.mockReturnValue(new Promise(() => {}));
    renderWithProviders();
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows alert error state when fetch fails", async () => {
    mockFranchisesGet.mockReturnValue(
      Promise.reject(new Error("network error")),
    );
    renderWithProviders();
    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toBeDefined();
      expect(screen.getByText("Failed to load franchises")).toBeDefined();
    });
  });

  it("renders franchise cards with city and team name", async () => {
    mockFranchisesGet.mockReturnValue(
      Promise.resolve({ json: () => Promise.resolve(MOCK_FRANCHISES) }),
    );
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText("Reno")).toBeDefined();
      expect(screen.getByText("Aces")).toBeDefined();
      expect(screen.getByText("Portland")).toBeDefined();
      expect(screen.getByText("Riveters")).toBeDefined();
      expect(screen.getByText("San Diego")).toBeDefined();
      expect(screen.getByText("Admirals")).toBeDefined();
    });
  });

  it("renders color swatches for each franchise", async () => {
    mockFranchisesGet.mockReturnValue(
      Promise.resolve({ json: () => Promise.resolve(MOCK_FRANCHISES) }),
    );
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText("Aces")).toBeDefined();
    });
    const swatches = document.querySelectorAll("span.rounded-full.size-4");
    expect(swatches.length).toBe(MOCK_FRANCHISES.length * 3);
  });

  it("assigns team and navigates to generate on selection", async () => {
    mockFranchisesGet.mockReturnValue(
      Promise.resolve({ json: () => Promise.resolve(MOCK_FRANCHISES) }),
    );
    mockAssignTeam.mockReturnValue(
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: "league-1", userTeamId: "f1" }),
      }),
    );
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText("Aces")).toBeDefined();
    });

    fireEvent.click(screen.getByText("Aces"));

    await waitFor(() => {
      expect(mockAssignTeam).toHaveBeenCalledWith({
        param: { id: "league-1" },
        json: { userTeamId: "f1" },
      });
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/leagues/$leagueId/generate",
        params: { leagueId: "league-1" },
      });
    });
  });

  it("surfaces an error alert when assignment fails", async () => {
    mockFranchisesGet.mockReturnValue(
      Promise.resolve({ json: () => Promise.resolve(MOCK_FRANCHISES) }),
    );
    mockAssignTeam.mockReturnValue(
      Promise.resolve({ ok: false, status: 500 }),
    );
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText("Aces")).toBeDefined();
    });

    fireEvent.click(screen.getByText("Aces"));

    await waitFor(() => {
      expect(screen.getByText("Failed to assign team")).toBeDefined();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("renders backstory text for each franchise", async () => {
    mockFranchisesGet.mockReturnValue(
      Promise.resolve({ json: () => Promise.resolve(MOCK_FRANCHISES) }),
    );
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText("Aces")).toBeDefined();
    });
    for (const franchise of MOCK_FRANCHISES) {
      expect(screen.getByText(franchise.backstory)).toBeDefined();
    }
  });

  it("groups teams into Pacific and Mountain conference cards", async () => {
    mockFranchisesGet.mockReturnValue(
      Promise.resolve({ json: () => Promise.resolve(MOCK_FRANCHISES) }),
    );
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText("Aces")).toBeDefined();
    });
    expect(screen.getByText("Pacific")).toBeDefined();
    expect(screen.getByText("Mountain")).toBeDefined();
  });

  it("renders conferences in Pacific-then-Mountain order with cities alphabetical within each", async () => {
    mockFranchisesGet.mockReturnValue(
      Promise.resolve({ json: () => Promise.resolve(MOCK_FRANCHISES) }),
    );
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText("Aces")).toBeDefined();
    });
    const conferenceHeadings = [
      ...document.querySelectorAll('[data-slot="card-title"]'),
    ].map((el) => el.textContent);
    expect(conferenceHeadings).toEqual(["Pacific", "Mountain"]);

    const cityOrder = ["Portland", "San Diego", "Reno"];
    const cityPositions = cityOrder.map((city) => {
      const el = screen.getByText(city);
      return Array.from(document.querySelectorAll("*")).indexOf(el);
    });
    expect(cityPositions).toEqual([...cityPositions].sort((a, b) => a - b));
  });

  it("does not expose identity-override controls", async () => {
    mockFranchisesGet.mockReturnValue(
      Promise.resolve({ json: () => Promise.resolve(MOCK_FRANCHISES) }),
    );
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText("Aces")).toBeDefined();
    });
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByText(/rename/i)).toBeNull();
    expect(screen.queryByText(/recolor/i)).toBeNull();
  });
});
