import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

  it("renders a toggle button for the sidebar", () => {
    renderWithProviders();
    const toggleButton = screen.getByRole("button", {
      name: /toggle sidebar/i,
    });
    expect(toggleButton).toBeDefined();
  });

  it("collapses the sidebar when toggle is clicked", () => {
    renderWithProviders();
    const sidebar = document.querySelector('[data-slot="sidebar"]');
    expect(sidebar?.getAttribute("data-state")).toBe("expanded");

    const toggleButton = screen.getByRole("button", {
      name: /toggle sidebar/i,
    });
    fireEvent.click(toggleButton);

    expect(sidebar?.getAttribute("data-state")).toBe("collapsed");
  });

  it("expands the sidebar when the toggle is clicked again", () => {
    renderWithProviders();
    const toggleButton = screen.getByRole("button", {
      name: /toggle sidebar/i,
    });

    fireEvent.click(toggleButton);
    const sidebar = document.querySelector('[data-slot="sidebar"]');
    expect(sidebar?.getAttribute("data-state")).toBe("collapsed");

    fireEvent.click(toggleButton);
    expect(sidebar?.getAttribute("data-state")).toBe("expanded");
  });

  it("renders a Profile button at the bottom of the sidebar", () => {
    renderWithProviders();
    expect(screen.getByRole("button", { name: /profile/i })).toBeDefined();
  });
});
