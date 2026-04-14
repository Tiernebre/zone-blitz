import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CoachDetail } from "./detail.tsx";

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ coachId: "abc" }),
}));

afterEach(() => cleanup());

describe("CoachDetail placeholder", () => {
  it("renders the coach id as a placeholder message", () => {
    render(<CoachDetail />);
    expect(screen.getByRole("heading", { name: "Coach" })).toBeDefined();
    expect(screen.getByText(/coach abc/)).toBeDefined();
  });
});
