import { assertEquals, assertThrows } from "@std/assert";
import { deriveDefaultSeasonLength } from "./derive-default-season-length.ts";

Deno.test("deriveDefaultSeasonLength", async (t) => {
  await t.step("returns 10 for an 8-team league", () => {
    assertEquals(deriveDefaultSeasonLength(8), 10);
  });

  await t.step("returns 11 for a 12-team league", () => {
    assertEquals(deriveDefaultSeasonLength(12), 11);
  });

  await t.step("returns 12 for a 16-team league", () => {
    assertEquals(deriveDefaultSeasonLength(16), 12);
  });

  await t.step("returns 17 for a 32-team league", () => {
    assertEquals(deriveDefaultSeasonLength(32), 17);
  });

  await t.step("clamps to minimum of 10 for very small leagues", () => {
    assertEquals(deriveDefaultSeasonLength(4), 10);
  });

  await t.step("scales beyond 32 teams", () => {
    const result = deriveDefaultSeasonLength(40);
    assertEquals(result, 19);
  });

  await t.step("throws for non-positive franchise count", () => {
    assertThrows(
      () => deriveDefaultSeasonLength(0),
      Error,
      "positive",
    );
    assertThrows(
      () => deriveDefaultSeasonLength(-1),
      Error,
      "positive",
    );
  });
});
