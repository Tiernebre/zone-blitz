import { assertEquals } from "@std/assert";
import {
  createStubScoutsGenerator,
  SCOUTS_PER_TEAM,
} from "./stub-scouts-generator.ts";

const TEAM_IDS = ["team-1", "team-2", "team-3"];
const INPUT = {
  leagueId: "league-1",
  teamIds: TEAM_IDS,
};

Deno.test("generates the full staff blueprint for each team", () => {
  const generator = createStubScoutsGenerator();
  const result = generator.generate(INPUT);

  assertEquals(result.length, TEAM_IDS.length * SCOUTS_PER_TEAM);
  for (const teamId of TEAM_IDS) {
    const teamScouts = result.filter((s) => s.teamId === teamId);
    assertEquals(teamScouts.length, SCOUTS_PER_TEAM);

    const director = teamScouts.find((s) => s.role === "DIRECTOR");
    assertEquals(director?.reportsToId, null);

    const crossCheckers = teamScouts.filter(
      (s) => s.role === "NATIONAL_CROSS_CHECKER",
    );
    assertEquals(crossCheckers.length, 2);
    for (const cc of crossCheckers) {
      assertEquals(cc.reportsToId, director?.id);
    }

    const areaScouts = teamScouts.filter((s) => s.role === "AREA_SCOUT");
    assertEquals(areaScouts.length, 4);
    for (const scout of areaScouts) {
      const reportsTo = teamScouts.find((s) => s.id === scout.reportsToId);
      assertEquals(reportsTo?.role, "NATIONAL_CROSS_CHECKER");
    }
  }
});

Deno.test("all scouts have the correct leagueId, names, and work capacity", () => {
  const generator = createStubScoutsGenerator();
  const result = generator.generate(INPUT);

  for (const scout of result) {
    assertEquals(scout.leagueId, INPUT.leagueId);
    assertEquals(scout.firstName.length > 0, true);
    assertEquals(scout.lastName.length > 0, true);
    assertEquals(scout.workCapacity > 0, true);
    assertEquals(scout.isVacancy, false);
  }
});

Deno.test("generates no scouts when no teams provided", () => {
  const generator = createStubScoutsGenerator();
  const result = generator.generate({ leagueId: "l1", teamIds: [] });
  assertEquals(result.length, 0);
});
