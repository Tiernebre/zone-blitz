import { z } from "zod";
import type { ZodObject, ZodString } from "zod";

export const createLeagueSchema: ZodObject<{ name: ZodString }> = z.object({
  name: z.string().min(1).max(100),
});
