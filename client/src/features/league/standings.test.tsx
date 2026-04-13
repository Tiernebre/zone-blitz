import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Standings } from "./standings.tsx";

afterEach(() => {
  cleanup();
});

describe("Standings", () => {
  it("renders the Standings heading", () => {
    render(<Standings />);
    expect(
      screen.getByRole("heading", { name: "Standings" }),
    ).toBeDefined();
  });
});
