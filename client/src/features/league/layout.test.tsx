import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

  it("renders a toggle button to collapse the sidebar", () => {
    render(<LeagueLayout />);
    const toggleButton = screen.getByRole("button", {
      name: /collapse sidebar/i,
    });
    expect(toggleButton).toBeDefined();
  });

  it("hides nav link text labels when the sidebar is collapsed", () => {
    render(<LeagueLayout />);

    const toggleButton = screen.getByRole("button", {
      name: /collapse sidebar/i,
    });
    fireEvent.click(toggleButton);

    expect(screen.queryByText("Home")).toBeNull();
    expect(screen.queryByText("Settings")).toBeNull();
    expect(screen.queryByText("All Leagues")).toBeNull();
  });

  it("keeps nav link icons visible when the sidebar is collapsed", () => {
    render(<LeagueLayout />);

    const toggleButton = screen.getByRole("button", {
      name: /collapse sidebar/i,
    });
    fireEvent.click(toggleButton);

    const nav = screen.getByRole("navigation");
    const svgs = nav.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThanOrEqual(2);
  });

  it("expands the sidebar when the toggle is clicked again", () => {
    render(<LeagueLayout />);

    const toggleButton = screen.getByRole("button", {
      name: /collapse sidebar/i,
    });
    fireEvent.click(toggleButton);

    const expandButton = screen.getByRole("button", {
      name: /expand sidebar/i,
    });
    fireEvent.click(expandButton);

    expect(screen.getByText("Home")).toBeDefined();
    expect(screen.getByText("Settings")).toBeDefined();
    expect(screen.getByText("All Leagues")).toBeDefined();
  });
});
