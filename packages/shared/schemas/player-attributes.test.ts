import { assertEquals } from "@std/assert";
import {
  attributeRatingSchema,
  playerAttributesSchema,
} from "./player-attributes.ts";
import { PLAYER_ATTRIBUTE_KEYS } from "../types/player-attributes.ts";

Deno.test("attributeRatingSchema accepts integers 0..100", () => {
  for (const value of [0, 1, 50, 99, 100]) {
    assertEquals(attributeRatingSchema.parse(value), value);
  }
});

Deno.test("attributeRatingSchema rejects out-of-range values", () => {
  assertEquals(attributeRatingSchema.safeParse(-1).success, false);
  assertEquals(attributeRatingSchema.safeParse(101).success, false);
  assertEquals(attributeRatingSchema.safeParse(3.5).success, false);
});

Deno.test("playerAttributesSchema requires current and potential for every attribute", () => {
  const full: Record<string, number> = {};
  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    full[key] = 50;
    full[`${key}Potential`] = 75;
  }
  const parsed = playerAttributesSchema.parse(full);
  assertEquals(Object.keys(parsed).length, PLAYER_ATTRIBUTE_KEYS.length * 2);
});

Deno.test("playerAttributesSchema rejects missing potential", () => {
  const partial: Record<string, number> = {};
  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    partial[key] = 50;
  }
  assertEquals(playerAttributesSchema.safeParse(partial).success, false);
});
