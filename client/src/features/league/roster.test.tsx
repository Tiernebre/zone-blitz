import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Roster } from "./roster.tsx";

afterEach(() => {
  cleanup();
});

describe("Roster", () => {
  it("renders the Roster heading", () => {
    render(<Roster />);
    expect(screen.getByRole("heading", { name: "Roster" })).toBeDefined();
  });
});
