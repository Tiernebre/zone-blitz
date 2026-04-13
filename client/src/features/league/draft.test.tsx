import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Draft } from "./draft.tsx";

afterEach(() => {
  cleanup();
});

describe("Draft", () => {
  it("renders the Draft heading", () => {
    render(<Draft />);
    expect(screen.getByRole("heading", { name: "Draft" })).toBeDefined();
  });
});
