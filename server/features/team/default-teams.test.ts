import { assertEquals } from "@std/assert";
import { DEFAULT_TEAMS } from "./default-teams.ts";

Deno.test("DEFAULT_TEAMS has exactly 32 teams", () => {
  assertEquals(DEFAULT_TEAMS.length, 32);
});

Deno.test("DEFAULT_TEAMS has unique abbreviations", () => {
  const abbreviations = DEFAULT_TEAMS.map((t) => t.abbreviation);
  const unique = new Set(abbreviations);
  assertEquals(unique.size, abbreviations.length);
});

Deno.test("DEFAULT_TEAMS has 2 conferences with 16 teams each", () => {
  const conferences = new Map<string, number>();
  for (const team of DEFAULT_TEAMS) {
    conferences.set(
      team.conference,
      (conferences.get(team.conference) ?? 0) + 1,
    );
  }
  assertEquals(conferences.size, 2);
  for (const [, count] of conferences) {
    assertEquals(count, 16);
  }
});

Deno.test("DEFAULT_TEAMS has 8 divisions with 4 teams each", () => {
  const divisions = new Map<string, number>();
  for (const team of DEFAULT_TEAMS) {
    divisions.set(team.division, (divisions.get(team.division) ?? 0) + 1);
  }
  assertEquals(divisions.size, 8);
  for (const [, count] of divisions) {
    assertEquals(count, 4);
  }
});

Deno.test("DEFAULT_TEAMS all have valid hex colors", () => {
  const hexRegex = /^#[0-9A-Fa-f]{6}$/;
  for (const team of DEFAULT_TEAMS) {
    assertEquals(
      hexRegex.test(team.primaryColor),
      true,
      `${team.name} has invalid primaryColor: ${team.primaryColor}`,
    );
    assertEquals(
      hexRegex.test(team.secondaryColor),
      true,
      `${team.name} has invalid secondaryColor: ${team.secondaryColor}`,
    );
    assertEquals(
      hexRegex.test(team.accentColor),
      true,
      `${team.name} has invalid accentColor: ${team.accentColor}`,
    );
  }
});

Deno.test("DEFAULT_TEAMS all have non-empty required fields", () => {
  for (const team of DEFAULT_TEAMS) {
    assertEquals(team.name.length > 0, true, `Team has empty name`);
    assertEquals(team.city.length > 0, true, `${team.name} has empty city`);
    assertEquals(
      team.abbreviation.length >= 2 && team.abbreviation.length <= 3,
      true,
      `${team.name} abbreviation must be 2-3 chars: ${team.abbreviation}`,
    );
  }
});
