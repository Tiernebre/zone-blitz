import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LeagueLayout } from "./layout.tsx";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
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
    const homeLink = screen.getByRole("link", { name: "Home" });
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
});
