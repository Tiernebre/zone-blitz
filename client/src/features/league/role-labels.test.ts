import { describe, expect, it } from "vitest";
import { coachArchetypeLabel, roleLabel } from "./role-labels.ts";

describe("roleLabel", () => {
  it("returns the coach label for known coach roles", () => {
    expect(roleLabel("coach", "HC")).toBe("Head Coach");
  });

  it("falls back to the raw role when the coach role is unknown", () => {
    expect(roleLabel("coach", "UNKNOWN")).toBe("UNKNOWN");
  });

  it("returns the scout label for known scout roles", () => {
    expect(roleLabel("scout", "AREA_SCOUT")).toBe("Area Scout");
  });

  it("falls back to the raw role when the scout role is unknown", () => {
    expect(roleLabel("scout", "UNKNOWN")).toBe("UNKNOWN");
  });
});

describe("coachArchetypeLabel", () => {
  it.each([
    ["offense", "Offensive Oriented"],
    ["defense", "Defensive Oriented"],
    ["ceo", "On-Field CEO"],
    ["special_teams", "Special Teams Oriented"],
    ["quarterbacks", "Quarterbacks Oriented"],
    ["running_backs", "Running Backs Oriented"],
    ["wide_receivers", "Wide Receivers Oriented"],
    ["tight_ends", "Tight Ends Oriented"],
    ["offensive_line", "Offensive Line Oriented"],
    ["defensive_line", "Defensive Line Oriented"],
    ["linebackers", "Linebackers Oriented"],
    ["defensive_backs", "Defensive Backs Oriented"],
  ])("maps %s specialty to %s", (specialty, label) => {
    expect(coachArchetypeLabel(specialty)).toBe(label);
  });

  it("returns em dash when specialty is null", () => {
    expect(coachArchetypeLabel(null)).toBe("—");
  });

  it("returns em dash for unknown specialties", () => {
    expect(coachArchetypeLabel("hovercraft_pilot")).toBe("—");
  });
});
