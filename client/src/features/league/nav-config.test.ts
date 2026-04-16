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

function visibleGroupLabels(phase: LeaguePhase): string[] {
  return navGroups
    .filter((g) => g.items.some((item) => item.visibleInPhases(phase)))
    .map((g) => g.label);
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

  it("shows only genesis-appropriate items in genesis_charter", () => {
    const visible = visibleLabels("genesis_charter");
    expect(visible).toContain("Home");
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

  it("shows Charter only in genesis_charter", () => {
    expect(visibleLabels("genesis_charter")).toContain("Charter");
    expect(visibleLabels("genesis_franchise_establishment")).not.toContain(
      "Charter",
    );
    expect(visibleLabels("regular_season")).not.toContain("Charter");
  });

  it("does not include a Staff Hiring nav item", () => {
    for (const phase of LEAGUE_PHASES) {
      expect(visibleLabels(phase)).not.toContain("Staff Hiring");
    }
  });

  it("shows Founding Pool only in genesis_founding_pool", () => {
    expect(visibleLabels("genesis_founding_pool")).toContain("Founding Pool");
    expect(visibleLabels("genesis_charter")).not.toContain("Founding Pool");
    expect(visibleLabels("genesis_allocation_draft")).not.toContain(
      "Founding Pool",
    );
    expect(visibleLabels("regular_season")).not.toContain("Founding Pool");
  });

  it("shows Allocation Draft only in genesis_allocation_draft", () => {
    expect(visibleLabels("genesis_allocation_draft")).toContain(
      "Allocation Draft",
    );
    expect(visibleLabels("genesis_charter")).not.toContain("Allocation Draft");
    expect(visibleLabels("genesis_free_agency")).not.toContain(
      "Allocation Draft",
    );
    expect(visibleLabels("regular_season")).not.toContain("Allocation Draft");
  });

  it("every item is visible in at least one phase", () => {
    for (const group of navGroups) {
      for (const item of group.items) {
        const visibleInAny = LEAGUE_PHASES.some((p) => item.visibleInPhases(p));
        expect(visibleInAny, `${item.label} is never visible`).toBe(true);
      }
    }
  });

  describe("exact visible set per representative phase", () => {
    it.each<[LeaguePhase, string[]]>([
      ["genesis_charter", ["Home", "Charter"]],
      [
        "genesis_staff_hiring",
        ["Home", "Coaches", "Scouts", "Media"],
      ],
      [
        "genesis_allocation_draft",
        [
          "Home",
          "Roster",
          "Coaches",
          "Scouts",
          "Draft",
          "Allocation Draft",
          "Salary Cap",
          "Media",
        ],
      ],
      [
        "genesis_free_agency",
        [
          "Home",
          "Roster",
          "Coaches",
          "Scouts",
          "Free Agency",
          "Salary Cap",
          "Media",
        ],
      ],
      [
        "preseason",
        [
          "Home",
          "Roster",
          "Coaches",
          "Scouts",
          "Trades",
          "Salary Cap",
          "Schedule",
          "Opponents",
          "Media",
        ],
      ],
      [
        "regular_season",
        [
          "Home",
          "Roster",
          "Coaches",
          "Scouts",
          "Trades",
          "Free Agency",
          "Salary Cap",
          "Standings",
          "Schedule",
          "Opponents",
          "Media",
        ],
      ],
      [
        "offseason_review",
        [
          "Home",
          "Roster",
          "Coaches",
          "Scouts",
          "Salary Cap",
          "Media",
        ],
      ],
    ])(
      "shows exactly the expected nav items in %s",
      (phase, expectedLabels) => {
        expect(visibleLabels(phase)).toEqual(expectedLabels);
      },
    );
  });

  describe("NavGroup visibility per phase", () => {
    it("hides Team Building group in genesis_charter", () => {
      expect(visibleGroupLabels("genesis_charter")).toEqual(["Team", "League"]);
    });

    it("hides Team Building group in genesis_staff_hiring", () => {
      expect(visibleGroupLabels("genesis_staff_hiring")).toEqual([
        "Team",
        "League",
      ]);
    });

    it("shows all groups in genesis_allocation_draft", () => {
      expect(visibleGroupLabels("genesis_allocation_draft")).toEqual([
        "Team",
        "Team Building",
        "League",
      ]);
    });

    it("shows all groups in regular_season", () => {
      expect(visibleGroupLabels("regular_season")).toEqual([
        "Team",
        "Team Building",
        "League",
      ]);
    });
  });
});
