import { z } from "zod";
import type { ZodNumber, ZodObject } from "zod";
import { PLAYER_ATTRIBUTE_KEYS } from "../types/player-attributes.ts";

export const attributeRatingSchema: ZodNumber = z.number().int().min(0).max(
  100,
);

const shape: Record<string, ZodNumber> = {};
for (const key of PLAYER_ATTRIBUTE_KEYS) {
  shape[key] = attributeRatingSchema;
  shape[`${key}Potential`] = attributeRatingSchema;
}

export const playerAttributesSchema: ZodObject<Record<string, ZodNumber>> = z
  .object(shape)
  .strict();
