import { assertEquals, assertNotEquals } from "@std/assert";
import { archetypesForBucket, PLAYER_ARCHETYPES } from "./player-archetypes.ts";
import { NEUTRAL_BUCKETS } from "./neutral-bucket.ts";

Deno.test("every neutral bucket has at least one archetype", () => {
  for (const bucket of NEUTRAL_BUCKETS) {
    const archetypes = archetypesForBucket(bucket);
    assertEquals(
      archetypes.length > 0,
      true,
      `bucket ${bucket} has no archetypes`,
    );
  }
});

Deno.test("every archetype has a unique name", () => {
  const names = PLAYER_ARCHETYPES.map((a) => a.name);
  assertEquals(names.length, new Set(names).size);
});

Deno.test("every archetype has at least one primary attribute", () => {
  for (const archetype of PLAYER_ARCHETYPES) {
    assertEquals(
      archetype.primaryAttributes.length > 0,
      true,
      `${archetype.name} has no primary attributes`,
    );
  }
});

Deno.test("every archetype has valid height and weight ranges", () => {
  for (const archetype of PLAYER_ARCHETYPES) {
    assertEquals(
      archetype.heightRange[0] <= archetype.heightRange[1],
      true,
      `${archetype.name} has invalid height range`,
    );
    assertEquals(
      archetype.weightRange[0] <= archetype.weightRange[1],
      true,
      `${archetype.name} has invalid weight range`,
    );
  }
});

Deno.test("no archetype has overlapping primary and secondary attributes", () => {
  for (const archetype of PLAYER_ARCHETYPES) {
    const primarySet = new Set(archetype.primaryAttributes);
    for (const attr of archetype.secondaryAttributes) {
      assertEquals(
        primarySet.has(attr),
        false,
        `${archetype.name} has ${attr} in both primary and secondary`,
      );
    }
  }
});

Deno.test("archetypesForBucket returns only archetypes for that bucket", () => {
  for (const bucket of NEUTRAL_BUCKETS) {
    const archetypes = archetypesForBucket(bucket);
    for (const archetype of archetypes) {
      assertEquals(archetype.bucket, bucket);
    }
  }
});

Deno.test("archetypes within the same bucket have distinct attribute profiles", () => {
  for (const bucket of NEUTRAL_BUCKETS) {
    const archetypes = archetypesForBucket(bucket);
    if (archetypes.length <= 1) continue;
    for (let i = 0; i < archetypes.length; i++) {
      for (let j = i + 1; j < archetypes.length; j++) {
        const a = new Set(archetypes[i].primaryAttributes);
        const b = new Set(archetypes[j].primaryAttributes);
        const overlap = [...a].filter((x) => b.has(x));
        assertNotEquals(
          overlap.length,
          a.size,
          `${archetypes[i].name} and ${
            archetypes[j].name
          } have identical primaries`,
        );
      }
    }
  }
});
