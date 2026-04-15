import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
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
          $get: vi.fn().mockResolvedValue({
            ok: true,
            json: () =>
              Promise.resolve({
                leagueId: "1",
                seasonYear: 2026,
                phase: "offseason_review",
                stepIndex: 0,
                slug: "awards_ceremony",
                kind: "event",
                flavorDate: "Feb 8",
                advancedAt: "2026-01-01T00:00:00Z",
              }),
          }),
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

  it("renders toggle buttons for the sidebar", () => {
    renderWithProviders();
    const toggleButtons = screen.getAllByRole("button", {
      name: /toggle sidebar/i,
    });
    expect(toggleButtons.length).toBeGreaterThanOrEqual(1);
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
    ["Draft", "/leagues/1/draft"],
    ["Trades", "/leagues/1/trades"],
    ["Free Agency", "/leagues/1/free-agency"],
    ["Salary Cap", "/leagues/1/salary-cap"],
    ["Standings", "/leagues/1/standings"],
    ["Schedule", "/leagues/1/schedule"],
    ["Media", "/leagues/1/media"],
    ["Owner", "/leagues/1/owner"],
  ])("renders a %s nav link pointing to %s", (name, href) => {
    renderWithProviders();
    const link = screen.getByRole("link", { name });
    expect(link.getAttribute("href")).toBe(href);
  });
});
