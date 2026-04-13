import { cleanup, render, screen } from "@testing-library/react";
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

vi.mock("../../api.ts", () => ({
  api: {
    api: {
      users: {
        me: {
          $delete: vi.fn(),
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
  it("renders a sidebar with a Home nav link", () => {
    renderWithProviders();
    const homeLink = screen.getByRole("link", { name: /home/i });
    expect(homeLink).toBeDefined();
  });

  it("renders the Outlet for child routes", () => {
    renderWithProviders();
    expect(screen.getByTestId("outlet")).toBeDefined();
  });

  it("renders the sidebar as a nav element", () => {
    renderWithProviders();
    expect(screen.getByRole("navigation")).toBeDefined();
  });

  it("renders a link back to the league select page", () => {
    renderWithProviders();
    const backLink = screen.getByRole("link", { name: /leagues/i });
    expect(backLink).toBeDefined();
    expect(backLink.getAttribute("href")).toBe("/");
  });

  it("renders icons in the nav links", () => {
    renderWithProviders();
    const nav = screen.getByRole("navigation");
    const svgs = nav.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThanOrEqual(2);
  });

  it("renders a Settings nav link", () => {
    renderWithProviders();
    const settingsLink = screen.getByRole("link", { name: /settings/i });
    expect(settingsLink).toBeDefined();
    expect(settingsLink.getAttribute("href")).toBe("/leagues/1/settings");
  });

  it("renders a Profile button at the bottom of the sidebar", () => {
    renderWithProviders();
    expect(screen.getByRole("button", { name: /profile/i })).toBeDefined();
  });
});
