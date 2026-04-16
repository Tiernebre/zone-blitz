import { z } from "zod";
import type {
  ZodArray,
  ZodEnum,
  ZodNumber,
  ZodObject,
  ZodOptional,
  ZodString,
} from "zod";

export const hiringStaffTypeSchema: ZodEnum<["coach", "scout"]> = z.enum([
  "coach",
  "scout",
]);

export const listCandidatesQuerySchema: ZodObject<{
  role: ZodOptional<ZodString>;
  staffType: ZodOptional<typeof hiringStaffTypeSchema>;
}> = z.object({
  role: z.string().min(1).optional(),
  staffType: hiringStaffTypeSchema.optional(),
});

export const expressInterestsSchema: ZodObject<{
  candidateIds: ZodArray<ZodString>;
}> = z.object({
  candidateIds: z.array(z.string().uuid()).min(1),
});

export const requestInterviewsSchema: ZodObject<{
  candidateIds: ZodArray<ZodString>;
}> = z.object({
  candidateIds: z.array(z.string().uuid()).min(1),
});

export const hiringIncentiveSchema: ZodObject<{
  type: ZodString;
  value: ZodNumber;
}> = z.object({
  type: z.string().min(1),
  value: z.number().int().nonnegative(),
});

export const hiringOfferInputSchema: ZodObject<{
  candidateId: ZodString;
  salary: ZodNumber;
  contractYears: ZodNumber;
  buyoutMultiplier: ZodString;
  incentives: ZodOptional<ZodArray<typeof hiringIncentiveSchema>>;
}> = z.object({
  candidateId: z.string().uuid(),
  salary: z.number().int().positive(),
  contractYears: z.number().int().positive(),
  buyoutMultiplier: z.string().regex(/^\d+(\.\d+)?$/),
  incentives: z.array(hiringIncentiveSchema).optional(),
});

export const submitOffersSchema: ZodObject<{
  offers: ZodArray<typeof hiringOfferInputSchema>;
}> = z.object({
  offers: z.array(hiringOfferInputSchema).min(1),
});

export const resolveBlockerSchema: ZodObject<{
  candidateId: ZodString;
}> = z.object({
  candidateId: z.string().uuid(),
});

export type ExpressInterestsInput = z.infer<typeof expressInterestsSchema>;
export type RequestInterviewsInput = z.infer<typeof requestInterviewsSchema>;
export type SubmitOffersInput = z.infer<typeof submitOffersSchema>;
export type ResolveBlockerInput = z.infer<typeof resolveBlockerSchema>;
