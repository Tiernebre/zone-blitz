import { describe, expect, it } from "vitest";
import { coachBackgroundLabel, roleLabel } from "./role-labels.ts";

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

describe("coachBackgroundLabel", () => {
  it.each([
    ["offense", "Offensive background"],
    ["defense", "Defensive background"],
    ["ceo", "CEO / manager"],
    ["special_teams", "Special teams background"],
    ["quarterbacks", "Quarterbacks background"],
    ["running_backs", "Running backs background"],
    ["wide_receivers", "Wide receivers background"],
    ["tight_ends", "Tight ends background"],
    ["offensive_line", "Offensive line background"],
    ["defensive_line", "Defensive line background"],
    ["linebackers", "Linebackers background"],
    ["defensive_backs", "Defensive backs background"],
  ])("maps %s specialty to %s", (specialty, label) => {
    expect(coachBackgroundLabel(specialty)).toBe(label);
  });

  it("returns em dash when specialty is null", () => {
    expect(coachBackgroundLabel(null)).toBe("—");
  });

  it("returns em dash for unknown specialties", () => {
    expect(coachBackgroundLabel("hovercraft_pilot")).toBe("—");
  });
});
