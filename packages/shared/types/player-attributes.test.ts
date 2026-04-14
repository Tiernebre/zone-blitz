import { assertEquals } from "@std/assert";
import {
  MENTAL_ATTRIBUTE_KEYS,
  PERSONALITY_ATTRIBUTE_KEYS,
  PHYSICAL_ATTRIBUTE_KEYS,
  PLAYER_ATTRIBUTE_KEYS,
  TECHNICAL_ATTRIBUTE_KEYS,
} from "./player-attributes.ts";

Deno.test("attribute key groups match PRD counts", () => {
  assertEquals(PHYSICAL_ATTRIBUTE_KEYS.length, 7);
  assertEquals(TECHNICAL_ATTRIBUTE_KEYS.length, 26);
  assertEquals(MENTAL_ATTRIBUTE_KEYS.length, 9);
  assertEquals(PERSONALITY_ATTRIBUTE_KEYS.length, 6);
});

Deno.test("combined attribute keys have no duplicates", () => {
  const unique = new Set(PLAYER_ATTRIBUTE_KEYS);
  assertEquals(unique.size, PLAYER_ATTRIBUTE_KEYS.length);
});

Deno.test("combined attribute keys equal the sum of category keys", () => {
  assertEquals(
    PLAYER_ATTRIBUTE_KEYS.length,
    PHYSICAL_ATTRIBUTE_KEYS.length +
      TECHNICAL_ATTRIBUTE_KEYS.length +
      MENTAL_ATTRIBUTE_KEYS.length +
      PERSONALITY_ATTRIBUTE_KEYS.length,
  );
});
