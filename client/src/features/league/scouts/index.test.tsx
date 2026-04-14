import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Scouts } from "./index.tsx";

afterEach(() => {
  cleanup();
});

describe("Scouts", () => {
  it("renders the Scouts heading", () => {
    render(<Scouts />);
    expect(screen.getByRole("heading", { name: "Scouts" })).toBeDefined();
  });
});
