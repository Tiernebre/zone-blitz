import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Coaches } from "./coaches.tsx";

afterEach(() => {
  cleanup();
});

describe("Coaches", () => {
  it("renders the Coaches heading", () => {
    render(<Coaches />);
    expect(screen.getByRole("heading", { name: "Coaches" })).toBeDefined();
  });
});
