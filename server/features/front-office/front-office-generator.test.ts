import { assertEquals } from "@std/assert";
import {
  createFrontOfficeGenerator,
  type NameGenerator,
} from "./front-office-generator.ts";

const TEAM_IDS = ["team-1", "team-2", "team-3"];
const INPUT = {
  leagueId: "league-1",
  teamIds: TEAM_IDS,
};

function fixedNameGenerator(): NameGenerator {
  let i = 0;
  return {
    next() {
      i++;
      return { firstName: `First${i}`, lastName: `Last${i}` };
    },
  };
}

function makeGenerator() {
  return createFrontOfficeGenerator({ nameGenerator: fixedNameGenerator() });
}

Deno.test("generates front office staff for each team", () => {
  const result = makeGenerator().generate(INPUT);

  assertEquals(result.length, TEAM_IDS.length * 2);
  for (const teamId of TEAM_IDS) {
    const teamStaff = result.filter((s) => s.teamId === teamId);
    assertEquals(teamStaff.length, 2);
  }
});

Deno.test("all staff have the correct leagueId and non-empty names", () => {
  const result = makeGenerator().generate(INPUT);

  for (const person of result) {
    assertEquals(person.leagueId, INPUT.leagueId);
    assertEquals(person.firstName.length > 0, true);
    assertEquals(person.lastName.length > 0, true);
  }
});

Deno.test("generates no staff when no teams provided", () => {
  const result = makeGenerator().generate({ leagueId: "l1", teamIds: [] });
  assertEquals(result.length, 0);
});

Deno.test("each generated staff member gets a unique name from the injected generator", () => {
  const result = makeGenerator().generate(INPUT);
  const fullNames = new Set(
    result.map((p) => `${p.firstName} ${p.lastName}`),
  );
  // The injected fixedNameGenerator returns a fresh name on every call;
  // the generator must consume it once per staff member rather than reusing.
  assertEquals(fullNames.size, result.length);
});

Deno.test("default factory wires up a real name generator without explicit options", () => {
  // No options => uses createNameGenerator() under the hood. We don't assert
  // specific names (the shared generator is randomized), but we do require
  // that names are populated.
  const result = createFrontOfficeGenerator().generate(INPUT);
  assertEquals(result.length, TEAM_IDS.length * 2);
  for (const person of result) {
    assertEquals(person.firstName.length > 0, true);
    assertEquals(person.lastName.length > 0, true);
  }
});
