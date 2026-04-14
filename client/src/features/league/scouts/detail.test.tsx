import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScoutDetail } from "./detail.tsx";

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ scoutId: "abc" }),
}));

afterEach(() => cleanup());

describe("ScoutDetail placeholder", () => {
  it("renders the scout id as a placeholder message", () => {
    render(<ScoutDetail />);
    expect(screen.getByRole("heading", { name: "Scout" })).toBeDefined();
    expect(screen.getByText(/scout abc/)).toBeDefined();
  });
});
