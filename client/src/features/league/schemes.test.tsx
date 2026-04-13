import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Schemes } from "./schemes.tsx";

afterEach(() => {
  cleanup();
});

describe("Schemes", () => {
  it("renders the Schemes heading", () => {
    render(<Schemes />);
    expect(screen.getByRole("heading", { name: "Schemes" })).toBeDefined();
  });
});
