import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Schedule } from "./schedule.tsx";

afterEach(() => {
  cleanup();
});

describe("Schedule", () => {
  it("renders the Schedule heading", () => {
    render(<Schedule />);
    expect(
      screen.getByRole("heading", { name: "Schedule" }),
    ).toBeDefined();
  });
});
