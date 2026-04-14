import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlayerDetail } from "./detail.tsx";

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ leagueId: "L1", playerId: "p1" }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PlayerDetail — placeholder", () => {
  it("renders the Player heading", () => {
    render(<PlayerDetail />);
    expect(screen.getByRole("heading", { name: "Player" })).toBeDefined();
  });

  it("renders a coming-soon placeholder with the player id", () => {
    render(<PlayerDetail />);
    expect(screen.getByTestId("player-detail-placeholder")).toBeDefined();
    expect(screen.getByTestId("player-detail-id-p1")).toBeDefined();
  });
});
