import { assertEquals } from "@std/assert";
import { coachRatings } from "./coach-ratings.schema.ts";

Deno.test("coach_ratings exposes hidden attribute + ceiling columns", () => {
  const columns = Object.keys(coachRatings);
  for (
    const col of [
      "coachId",
      "leadership",
      "leadershipCeiling",
      "gameManagement",
      "gameManagementCeiling",
      "schemeMastery",
      "schemeMasteryCeiling",
      "playerDevelopment",
      "playerDevelopmentCeiling",
      "adaptability",
      "adaptabilityCeiling",
      "growthRate",
    ]
  ) {
    assertEquals(columns.includes(col), true, `missing ${col}`);
  }
});

Deno.test("coach_ratings rating columns are NOT NULL integers", () => {
  for (
    const col of [
      coachRatings.leadership,
      coachRatings.leadershipCeiling,
      coachRatings.gameManagement,
      coachRatings.gameManagementCeiling,
      coachRatings.schemeMastery,
      coachRatings.schemeMasteryCeiling,
      coachRatings.playerDevelopment,
      coachRatings.playerDevelopmentCeiling,
      coachRatings.adaptability,
      coachRatings.adaptabilityCeiling,
      coachRatings.growthRate,
    ]
  ) {
    assertEquals(col.notNull, true);
    assertEquals(col.columnType, "PgInteger");
  }
});

Deno.test("coach_ratings primary key is coach_id FK", () => {
  assertEquals(coachRatings.coachId.primary, true);
  assertEquals(coachRatings.coachId.columnType, "PgUUID");
});
