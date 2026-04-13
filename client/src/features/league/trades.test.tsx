import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Trades } from "./trades.tsx";

afterEach(() => {
  cleanup();
});

describe("Trades", () => {
  it("renders the Trades heading", () => {
    render(<Trades />);
    expect(screen.getByRole("heading", { name: "Trades" })).toBeDefined();
  });
});
