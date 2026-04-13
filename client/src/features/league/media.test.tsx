import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Media } from "./media.tsx";

afterEach(() => {
  cleanup();
});

describe("Media", () => {
  it("renders the Media heading", () => {
    render(<Media />);
    expect(screen.getByRole("heading", { name: "Media" })).toBeDefined();
  });
});
