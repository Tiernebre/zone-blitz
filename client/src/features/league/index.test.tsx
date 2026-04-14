import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LeagueHome } from "./index.tsx";

afterEach(() => {
  cleanup();
});

describe("LeagueHome", () => {
  it("renders the League Home heading", () => {
    render(<LeagueHome />);
    expect(
      screen.getByRole("heading", { name: "League Home" }),
    ).toBeDefined();
  });

  it("renders a coming soon badge", () => {
    render(<LeagueHome />);
    expect(screen.getByText(/coming soon/i)).toBeDefined();
  });
});
