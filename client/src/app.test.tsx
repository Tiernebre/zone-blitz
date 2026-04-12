import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "./app.tsx";

afterEach(cleanup);

describe("App", () => {
  it("renders the Zone Blitz heading", () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { name: "Zone Blitz" }),
    ).toBeDefined();
  });

  it("renders the tagline", () => {
    render(<App />);
    expect(screen.getByText(/football franchise simulation/i)).toBeDefined();
  });
});
