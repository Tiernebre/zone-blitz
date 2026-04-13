import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Owner } from "./owner.tsx";

afterEach(() => {
  cleanup();
});

describe("Owner", () => {
  it("renders the Owner heading", () => {
    render(<Owner />);
    expect(screen.getByRole("heading", { name: "Owner" })).toBeDefined();
  });
});
