import { describe, expect, it } from "vitest";
import { navGroups } from "./nav-config.ts";
import type { LeaguePhase } from "../../types/league-phase.ts";
import { LEAGUE_PHASES } from "../../types/league-phase.ts";

function visibleLabels(phase: LeaguePhase): string[] {
  return navGroups
    .flatMap((g) => g.items)
    .filter((item) => item.visibleInPhases(phase))
    .map((item) => item.label);
}

describe("navGroups", () => {
  it("every nav item has a visibleInPhases function", () => {
    for (const group of navGroups) {
      for (const item of group.items) {
        expect(typeof item.visibleInPhases).toBe("function");
      }
    }
  });

  it("Home is visible in all phases", () => {
    for (const phase of LEAGUE_PHASES) {
      expect(visibleLabels(phase)).toContain("Home");
    }
  });

  it("Owner is visible in all phases", () => {
    for (const phase of LEAGUE_PHASES) {
      expect(visibleLabels(phase)).toContain("Owner");
    }
  });

  it("shows only genesis-appropriate items in genesis_charter", () => {
    const visible = visibleLabels("genesis_charter");
    expect(visible).toContain("Home");
    expect(visible).toContain("Owner");
    expect(visible).not.toContain("Roster");
    expect(visible).not.toContain("Coaches");
    expect(visible).not.toContain("Draft");
    expect(visible).not.toContain("Standings");
    expect(visible).not.toContain("Schedule");
  });

  it("shows Coaches and Scouts from genesis_staff_hiring onward", () => {
    expect(visibleLabels("genesis_charter")).not.toContain("Coaches");
    expect(visibleLabels("genesis_franchise_establishment")).not.toContain(
      "Coaches",
    );
    expect(visibleLabels("genesis_staff_hiring")).toContain("Coaches");
    expect(visibleLabels("genesis_staff_hiring")).toContain("Scouts");
    expect(visibleLabels("regular_season")).toContain("Coaches");
    expect(visibleLabels("regular_season")).toContain("Scouts");
  });

  it("shows Roster from genesis_allocation_draft onward", () => {
    expect(visibleLabels("genesis_staff_hiring")).not.toContain("Roster");
    expect(visibleLabels("genesis_allocation_draft")).toContain("Roster");
    expect(visibleLabels("regular_season")).toContain("Roster");
  });

  it("shows Salary Cap from genesis_allocation_draft onward", () => {
    expect(visibleLabels("genesis_founding_pool")).not.toContain("Salary Cap");
    expect(visibleLabels("genesis_allocation_draft")).toContain("Salary Cap");
  });

  it("shows Media from genesis_franchise_establishment onward", () => {
    expect(visibleLabels("genesis_charter")).not.toContain("Media");
    expect(visibleLabels("genesis_franchise_establishment")).toContain("Media");
    expect(visibleLabels("regular_season")).toContain("Media");
  });

  it("shows Draft only in draft-relevant phases", () => {
    expect(visibleLabels("genesis_allocation_draft")).toContain("Draft");
    expect(visibleLabels("pre_draft")).toContain("Draft");
    expect(visibleLabels("draft")).toContain("Draft");
    expect(visibleLabels("udfa")).toContain("Draft");
    expect(visibleLabels("regular_season")).not.toContain("Draft");
    expect(visibleLabels("preseason")).not.toContain("Draft");
  });

  it("shows Free Agency in free-agency-relevant phases", () => {
    expect(visibleLabels("genesis_free_agency")).toContain("Free Agency");
    expect(visibleLabels("legal_tampering")).toContain("Free Agency");
    expect(visibleLabels("free_agency")).toContain("Free Agency");
    expect(visibleLabels("udfa")).toContain("Free Agency");
    expect(visibleLabels("regular_season")).toContain("Free Agency");
    expect(visibleLabels("genesis_charter")).not.toContain("Free Agency");
  });

  it("shows Trades from preseason onward", () => {
    expect(visibleLabels("genesis_free_agency")).not.toContain("Trades");
    expect(visibleLabels("preseason")).toContain("Trades");
    expect(visibleLabels("regular_season")).toContain("Trades");
  });

  it("shows Standings from regular_season onward", () => {
    expect(visibleLabels("preseason")).not.toContain("Standings");
    expect(visibleLabels("regular_season")).toContain("Standings");
    expect(visibleLabels("playoffs")).toContain("Standings");
  });

  it("shows Schedule from preseason onward", () => {
    expect(visibleLabels("offseason_program")).not.toContain("Schedule");
    expect(visibleLabels("preseason")).toContain("Schedule");
    expect(visibleLabels("regular_season")).toContain("Schedule");
  });

  it("shows Opponents from preseason onward", () => {
    expect(visibleLabels("offseason_program")).not.toContain("Opponents");
    expect(visibleLabels("preseason")).toContain("Opponents");
    expect(visibleLabels("regular_season")).toContain("Opponents");
  });

  it("every item is visible in at least one phase", () => {
    for (const group of navGroups) {
      for (const item of group.items) {
        const visibleInAny = LEAGUE_PHASES.some((p) => item.visibleInPhases(p));
        expect(visibleInAny, `${item.label} is never visible`).toBe(true);
      }
    }
  });
});
