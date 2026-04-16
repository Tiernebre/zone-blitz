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

  it("shows Coaches and Scouts from initial_staff_hiring onward", () => {
    expect(visibleLabels("initial_staff_hiring")).toContain("Coaches");
    expect(visibleLabels("initial_staff_hiring")).toContain("Scouts");
    expect(visibleLabels("regular_season")).toContain("Coaches");
    expect(visibleLabels("regular_season")).toContain("Scouts");
  });

  it("shows Roster from initial_draft onward", () => {
    expect(visibleLabels("initial_staff_hiring")).not.toContain("Roster");
    expect(visibleLabels("initial_draft")).toContain("Roster");
    expect(visibleLabels("regular_season")).toContain("Roster");
  });

  it("shows Salary Cap from initial_draft onward", () => {
    expect(visibleLabels("initial_pool")).not.toContain("Salary Cap");
    expect(visibleLabels("initial_draft")).toContain("Salary Cap");
  });

  it("shows Media from initial_staff_hiring onward", () => {
    expect(visibleLabels("initial_staff_hiring")).toContain("Media");
    expect(visibleLabels("regular_season")).toContain("Media");
  });

  it("shows Draft only in draft-relevant phases", () => {
    expect(visibleLabels("initial_draft")).toContain("Draft");
    expect(visibleLabels("pre_draft")).toContain("Draft");
    expect(visibleLabels("draft")).toContain("Draft");
    expect(visibleLabels("udfa")).toContain("Draft");
    expect(visibleLabels("regular_season")).not.toContain("Draft");
    expect(visibleLabels("preseason")).not.toContain("Draft");
  });

  it("shows Free Agency in free-agency-relevant phases", () => {
    expect(visibleLabels("initial_free_agency")).toContain("Free Agency");
    expect(visibleLabels("legal_tampering")).toContain("Free Agency");
    expect(visibleLabels("free_agency")).toContain("Free Agency");
    expect(visibleLabels("udfa")).toContain("Free Agency");
    expect(visibleLabels("regular_season")).toContain("Free Agency");
    expect(visibleLabels("initial_staff_hiring")).not.toContain("Free Agency");
  });

  it("shows Trades from preseason onward", () => {
    expect(visibleLabels("initial_free_agency")).not.toContain("Trades");
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

  it("does not include a Staff Hiring nav item", () => {
    for (const phase of LEAGUE_PHASES) {
      expect(visibleLabels(phase)).not.toContain("Staff Hiring");
    }
  });

  it("shows Initial Pool only in initial_pool", () => {
    expect(visibleLabels("initial_pool")).toContain("Initial Pool");
    expect(visibleLabels("initial_staff_hiring")).not.toContain(
      "Initial Pool",
    );
    expect(visibleLabels("initial_draft")).not.toContain(
      "Initial Pool",
    );
    expect(visibleLabels("regular_season")).not.toContain("Initial Pool");
  });

  it("shows Allocation Draft only in initial_draft", () => {
    expect(visibleLabels("initial_draft")).toContain(
      "Allocation Draft",
    );
    expect(visibleLabels("initial_staff_hiring")).not.toContain(
      "Allocation Draft",
    );
    expect(visibleLabels("initial_free_agency")).not.toContain(
      "Allocation Draft",
    );
    expect(visibleLabels("regular_season")).not.toContain("Allocation Draft");
  });

  it("accommodates initial_scouting without showing Initial Pool or Allocation Draft", () => {
    const labels = visibleLabels("initial_scouting");
    expect(labels).toContain("Home");
    expect(labels).toContain("Scouts");
    expect(labels).not.toContain("Initial Pool");
    expect(labels).not.toContain("Allocation Draft");
    expect(labels).not.toContain("Roster");
    expect(labels).not.toContain("Salary Cap");
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
      [
        "initial_staff_hiring",
        ["Home", "Coaches", "Scouts", "Hiring", "Media"],
      ],
      [
        "initial_draft",
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
        "initial_free_agency",
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
    it("hides Team Building group in initial_staff_hiring", () => {
      expect(visibleGroupLabels("initial_staff_hiring")).toEqual([
        "Team",
        "League",
      ]);
    });

    it("shows all groups in initial_draft", () => {
      expect(visibleGroupLabels("initial_draft")).toEqual([
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

describe("Hiring nav item", () => {
  it("is visible in initial_staff_hiring and coaching_carousel phases", () => {
    const hiringPhases = new Set(["initial_staff_hiring", "coaching_carousel"]);
    for (const phase of LEAGUE_PHASES) {
      const visible = visibleLabels(phase).includes("Hiring");
      expect(visible).toBe(hiringPhases.has(phase));
    }
  });
});
