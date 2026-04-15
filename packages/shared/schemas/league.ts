import { z } from "zod";
import type { ZodNumber, ZodObject, ZodOptional, ZodString } from "zod";

export const createLeagueSchema: ZodObject<{
  name: ZodString;
  seasonLength: ZodOptional<ZodNumber>;
}> = z.object({
  name: z.string().min(1).max(100),
  seasonLength: z.number().int().min(1).optional(),
});

export const assignUserTeamSchema: ZodObject<{ userTeamId: ZodString }> = z
  .object({
    userTeamId: z.string().uuid(),
  });

export const castAdvanceVoteSchema: ZodObject<{ teamId: ZodString }> = z
  .object({
    teamId: z.string().uuid(),
  });
