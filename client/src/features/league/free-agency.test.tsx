import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FreeAgency } from "./free-agency.tsx";

afterEach(() => {
  cleanup();
});

describe("FreeAgency", () => {
  it("renders the Free Agency heading", () => {
    render(<FreeAgency />);
    expect(
      screen.getByRole("heading", { name: "Free Agency" }),
    ).toBeDefined();
  });
});
