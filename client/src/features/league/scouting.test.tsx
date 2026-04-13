import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Scouting } from "./scouting.tsx";

afterEach(() => {
  cleanup();
});

describe("Scouting", () => {
  it("renders the Scouting heading", () => {
    render(<Scouting />);
    expect(screen.getByRole("heading", { name: "Scouting" })).toBeDefined();
  });
});
