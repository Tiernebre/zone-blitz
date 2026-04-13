import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SalaryCap } from "./salary-cap.tsx";

afterEach(() => {
  cleanup();
});

describe("SalaryCap", () => {
  it("renders the Salary Cap heading", () => {
    render(<SalaryCap />);
    expect(
      screen.getByRole("heading", { name: "Salary Cap" }),
    ).toBeDefined();
  });
});
