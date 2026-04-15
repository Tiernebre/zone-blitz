import { z } from "zod";
import type { ZodObject, ZodString } from "zod";

export const createLeagueSchema: ZodObject<{ name: ZodString }> = z.object({
  name: z.string().min(1).max(100),
});

export const assignUserTeamSchema: ZodObject<{ userTeamId: ZodString }> = z
  .object({
    userTeamId: z.string().uuid(),
  });

export const castAdvanceVoteSchema: ZodObject<{ teamId: ZodString }> = z
  .object({
    teamId: z.string().uuid(),
  });
