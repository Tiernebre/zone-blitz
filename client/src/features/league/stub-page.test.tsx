import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StubPage } from "./stub-page.tsx";

afterEach(() => {
  cleanup();
});

describe("StubPage", () => {
  it("renders the title as a heading", () => {
    render(<StubPage title="Scouting" description="desc" />);
    expect(
      screen.getByRole("heading", { name: "Scouting" }),
    ).toBeDefined();
  });

  it("renders the description", () => {
    render(<StubPage title="Scouting" description="the info engine" />);
    expect(screen.getByText("the info engine")).toBeDefined();
  });

  it("renders a coming soon badge", () => {
    render(<StubPage title="Scouting" description="desc" />);
    expect(screen.getByText(/coming soon/i)).toBeDefined();
  });
});
