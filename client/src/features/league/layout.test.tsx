import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LeagueLayout } from "./layout.tsx";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    className,
  }: {
    children: React.ReactNode;
    to: string;
    className?: string;
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  Outlet: () => <div data-testid="outlet">outlet content</div>,
  useParams: () => ({ leagueId: "1" }),
}));

vi.mock("../../lib/auth-client.ts", () => ({
  authClient: {
    useSession: () => ({
      data: {
        user: {
          id: "u1",
          name: "Test User",
          email: "test@example.com",
          image: null,
        },
        session: { id: "s1" },
      },
      isPending: false,
    }),
    signOut: vi.fn(),
  },
}));

const mockTouch = vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  json: () => Promise.resolve({ id: 1 }),
});

let mockPhase = "offseason_review";
const mockClockGet = vi.fn();

vi.mock("../../api.ts", () => ({
  api: {
    api: {
      users: {
        me: {
          $delete: vi.fn(),
        },
      },
      leagues: {
        [":id"]: {
          $get: vi.fn().mockResolvedValue({
            json: () =>
              Promise.resolve({
                id: 1,
                name: "My League",
                userTeamId: "team-1",
              }),
          }),
          touch: {
            $post: (...args: unknown[]) => mockTouch(...args),
          },
        },
      },
      "league-clock": {
        [":leagueId"]: {
          $get: (...args: unknown[]) => mockClockGet(...args),
          advance: {
            $post: vi.fn().mockResolvedValue({
              ok: true,
              json: () => Promise.resolve({}),
            }),
          },
        },
      },
    },
  },
}));

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LeagueLayout />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockPhase = "offseason_review";
  mockClockGet.mockImplementation(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          leagueId: "1",
          seasonYear: 2026,
          phase: mockPhase,
          stepIndex: 0,
          slug: "awards_ceremony",
          kind: "event",
          flavorDate: "Feb 8",
          advancedAt: "2026-01-01T00:00:00Z",
        }),
    })
  );
});

afterEach(() => {
  cleanup();
});

describe("LeagueLayout", () => {
  it("touches the league to record last-played on mount", async () => {
    mockTouch.mockClear();
    renderWithProviders();
    await waitFor(() => {
      expect(mockTouch).toHaveBeenCalledWith({ param: { id: "1" } });
    });
  });

  it("renders a sidebar with a Home nav link", () => {
    renderWithProviders();
    const homeLink = screen.getByRole("link", { name: /home/i });
    expect(homeLink).toBeDefined();
  });

  it("renders the Outlet for child routes", () => {
    renderWithProviders();
    expect(screen.getByTestId("outlet")).toBeDefined();
  });

  it("renders a sidebar element", () => {
    renderWithProviders();
    expect(
      document.querySelector('[data-slot="sidebar-wrapper"]'),
    ).toBeDefined();
  });

  it("renders a link back to the league select page", () => {
    renderWithProviders();
    const backLink = screen.getByRole("link", { name: /leagues/i });
    expect(backLink).toBeDefined();
    expect(backLink.getAttribute("href")).toBe("/");
  });

  it("renders icons in the nav links", () => {
    renderWithProviders();
    const sidebar = document.querySelector('[data-slot="sidebar-inner"]');
    const svgs = sidebar?.querySelectorAll("svg");
    expect(svgs?.length).toBeGreaterThanOrEqual(2);
  });

  it("renders a Settings nav link", () => {
    renderWithProviders();
    const settingsLink = screen.getByRole("link", { name: /settings/i });
    expect(settingsLink).toBeDefined();
    expect(settingsLink.getAttribute("href")).toBe("/leagues/1/settings");
  });

  it("renders exactly one toggle button for the sidebar", () => {
    renderWithProviders();
    const toggleButtons = screen.getAllByRole("button", {
      name: /toggle sidebar/i,
    });
    expect(toggleButtons.length).toBe(1);
  });

  it("collapses the sidebar when toggle is clicked", () => {
    renderWithProviders();
    const sidebar = document.querySelector('[data-slot="sidebar"]');
    expect(sidebar?.getAttribute("data-state")).toBe("expanded");

    const toggleButtons = screen.getAllByRole("button", {
      name: /toggle sidebar/i,
    });
    fireEvent.click(toggleButtons[0]);

    expect(sidebar?.getAttribute("data-state")).toBe("collapsed");
  });

  it("expands the sidebar when the toggle is clicked again", () => {
    renderWithProviders();

    const toggleButtons = screen.getAllByRole("button", {
      name: /toggle sidebar/i,
    });
    fireEvent.click(toggleButtons[0]);
    const sidebar = document.querySelector('[data-slot="sidebar"]');
    expect(sidebar?.getAttribute("data-state")).toBe("collapsed");

    fireEvent.click(
      screen.getAllByRole("button", { name: /toggle sidebar/i })[0],
    );
    expect(sidebar?.getAttribute("data-state")).toBe("expanded");
  });

  it("renders a Profile button at the bottom of the sidebar", () => {
    renderWithProviders();
    expect(screen.getByRole("button", { name: /profile/i })).toBeDefined();
  });

  it("renders the league name in the sidebar header", async () => {
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText("My League")).toBeDefined();
    });
  });

  it("renders the All Leagues back link in the sidebar footer", () => {
    renderWithProviders();
    const footer = document.querySelector('[data-slot="sidebar-footer"]');
    expect(footer?.textContent).toContain("All Leagues");
  });

  it.each([
    ["Team"],
    ["Team Building"],
    ["League"],
  ])("renders the %s sidebar group label", (label) => {
    renderWithProviders();
    const labels = Array.from(
      document.querySelectorAll('[data-sidebar="group-label"]'),
    ).map((el) => el.textContent);
    expect(labels).toContain(label);
  });

  it.each([
    ["Roster", "/leagues/1/roster"],
    ["Coaches", "/leagues/1/coaches"],
    ["Scouts", "/leagues/1/scouts"],
    ["Salary Cap", "/leagues/1/salary-cap"],
    ["Media", "/leagues/1/media"],
  ])(
    "renders a %s nav link pointing to %s in offseason_review phase",
    (name, href) => {
      renderWithProviders();
      const link = screen.getByRole("link", { name });
      expect(link.getAttribute("href")).toBe(href);
    },
  );

  it("renders all nav links in regular_season phase", async () => {
    mockPhase = "regular_season";
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Roster" })).toBeDefined();
    });

    for (
      const [name, href] of [
        ["Roster", "/leagues/1/roster"],
        ["Coaches", "/leagues/1/coaches"],
        ["Scouts", "/leagues/1/scouts"],
        ["Trades", "/leagues/1/trades"],
        ["Free Agency", "/leagues/1/free-agency"],
        ["Salary Cap", "/leagues/1/salary-cap"],
        ["Standings", "/leagues/1/standings"],
        ["Schedule", "/leagues/1/schedule"],
        ["Opponents", "/leagues/1/opponents"],
        ["Media", "/leagues/1/media"],
      ]
    ) {
      const link = screen.getByRole("link", { name });
      expect(link.getAttribute("href")).toBe(href);
    }
  });

  it("hides phase-gated nav items in genesis_charter", async () => {
    mockPhase = "genesis_charter";
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Home" })).toBeDefined();
    });

    expect(screen.getByRole("link", { name: "Charter" })).toBeDefined();
    expect(screen.queryByRole("link", { name: "Roster" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Draft" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Standings" })).toBeNull();
  });

  it("shows genesis-only items only in their respective phases", async () => {
    mockPhase = "genesis_staff_hiring";
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Coaches" })).toBeDefined();
    });

    expect(screen.queryByRole("link", { name: "Staff Hiring" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Charter" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Founding Pool" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Allocation Draft" })).toBeNull();
  });

  it("shows Founding Pool only during genesis_founding_pool", async () => {
    mockPhase = "genesis_founding_pool";
    renderWithProviders();

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: "Founding Pool" }),
      ).toBeDefined();
    });

    expect(screen.queryByRole("link", { name: "Charter" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Staff Hiring" })).toBeNull();
  });

  it("shows Allocation Draft only during genesis_allocation_draft", async () => {
    mockPhase = "genesis_allocation_draft";
    renderWithProviders();

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: "Allocation Draft" }),
      ).toBeDefined();
    });

    expect(screen.queryByRole("link", { name: "Charter" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Staff Hiring" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Founding Pool" })).toBeNull();
  });

  it("hides all genesis-only items in regular_season", async () => {
    mockPhase = "regular_season";
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Roster" })).toBeDefined();
    });

    expect(screen.queryByRole("link", { name: "Charter" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Staff Hiring" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Founding Pool" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Allocation Draft" })).toBeNull();
  });

  it("shows all nav items when phase is loading", () => {
    mockClockGet.mockImplementation(() => new Promise(() => {}));
    renderWithProviders();

    expect(screen.getByRole("link", { name: "Home" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Roster" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Draft" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Standings" })).toBeDefined();
  });

  it("collapses empty nav groups in early genesis phases", async () => {
    mockPhase = "genesis_charter";
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Home" })).toBeDefined();
    });

    const labels = Array.from(
      document.querySelectorAll('[data-sidebar="group-label"]'),
    ).map((el) => el.textContent);
    expect(labels).toContain("Team");
    expect(labels).not.toContain("Team Building");
  });
});
