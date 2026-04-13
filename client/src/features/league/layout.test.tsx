import { cleanup, render, screen } from "@testing-library/react";
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

afterEach(() => {
  cleanup();
});

describe("LeagueLayout", () => {
  it("renders a sidebar with a Home nav link", () => {
    render(<LeagueLayout />);
    const homeLink = screen.getByRole("link", { name: /home/i });
    expect(homeLink).toBeDefined();
  });

  it("renders the Outlet for child routes", () => {
    render(<LeagueLayout />);
    expect(screen.getByTestId("outlet")).toBeDefined();
  });

  it("renders the sidebar as a nav element", () => {
    render(<LeagueLayout />);
    expect(screen.getByRole("navigation")).toBeDefined();
  });

  it("renders a link back to the league select page", () => {
    render(<LeagueLayout />);
    const backLink = screen.getByRole("link", { name: /leagues/i });
    expect(backLink).toBeDefined();
    expect(backLink.getAttribute("href")).toBe("/");
  });

  it("renders icons in the nav links", () => {
    render(<LeagueLayout />);
    const nav = screen.getByRole("navigation");
    const svgs = nav.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThanOrEqual(2);
  });

  it("renders a Settings nav link", () => {
    render(<LeagueLayout />);
    const settingsLink = screen.getByRole("link", { name: /settings/i });
    expect(settingsLink).toBeDefined();
    expect(settingsLink.getAttribute("href")).toBe("/leagues/1/settings");
  });
});
