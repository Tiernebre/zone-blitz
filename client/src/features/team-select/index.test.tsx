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

const mockTeamsGet = vi.fn();
const mockNavigate = vi.fn();

vi.mock("../../api.ts", () => ({
  api: {
    api: {
      teams: {
        $get: (...args: unknown[]) => mockTeamsGet(...args),
      },
    },
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ leagueId: "league-1" }),
}));

const MOCK_TEAMS = [
  {
    id: "t1",
    name: "Minutemen",
    city: "Boston",
    abbreviation: "BOS",
    primaryColor: "#0B2240",
    secondaryColor: "#C41230",
    conference: "AFC",
    division: "AFC East",
  },
  {
    id: "t2",
    name: "Sharks",
    city: "Miami",
    abbreviation: "MIA",
    primaryColor: "#006B70",
    secondaryColor: "#FF6B35",
    conference: "AFC",
    division: "AFC East",
  },
  {
    id: "t3",
    name: "Lumberjacks",
    city: "Green Bay",
    abbreviation: "GBL",
    primaryColor: "#204E32",
    secondaryColor: "#FFB612",
    conference: "NFC",
    division: "NFC North",
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
  it("renders the Choose Your Team heading", async () => {
    mockTeamsGet.mockReturnValue(
      Promise.resolve({ json: () => Promise.resolve(MOCK_TEAMS) }),
    );
    renderWithProviders();
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Choose Your Team" }),
      ).toBeDefined();
    });
  });

  it("shows loading state while fetching teams", () => {
    mockTeamsGet.mockReturnValue(new Promise(() => {}));
    renderWithProviders();
    expect(screen.getByText("Loading teams...")).toBeDefined();
  });

  it("shows error state when fetch fails", async () => {
    mockTeamsGet.mockReturnValue(Promise.reject(new Error("network error")));
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText("Failed to load teams")).toBeDefined();
    });
  });

  it("renders teams grouped by conference", async () => {
    mockTeamsGet.mockReturnValue(
      Promise.resolve({ json: () => Promise.resolve(MOCK_TEAMS) }),
    );
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText("AFC")).toBeDefined();
      expect(screen.getByText("NFC")).toBeDefined();
    });
  });

  it("renders teams with city and name", async () => {
    mockTeamsGet.mockReturnValue(
      Promise.resolve({ json: () => Promise.resolve(MOCK_TEAMS) }),
    );
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText("Boston Minutemen")).toBeDefined();
      expect(screen.getByText("Miami Sharks")).toBeDefined();
      expect(screen.getByText("Green Bay Lumberjacks")).toBeDefined();
    });
  });

  it("renders division headings", async () => {
    mockTeamsGet.mockReturnValue(
      Promise.resolve({ json: () => Promise.resolve(MOCK_TEAMS) }),
    );
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText("AFC East")).toBeDefined();
      expect(screen.getByText("NFC North")).toBeDefined();
    });
  });

  it("navigates to league dashboard when a team is selected", async () => {
    mockTeamsGet.mockReturnValue(
      Promise.resolve({ json: () => Promise.resolve(MOCK_TEAMS) }),
    );
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText("Boston Minutemen")).toBeDefined();
    });

    fireEvent.click(screen.getByText("Boston Minutemen"));
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/leagues/$leagueId",
      params: { leagueId: "league-1" },
    });
  });
});
