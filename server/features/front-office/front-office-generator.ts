import {
  createNameGenerator,
  type NameGenerator,
} from "../../shared/name-generator.ts";
import type {
  FrontOfficeGenerator,
  FrontOfficeGeneratorInput,
  GeneratedFrontOfficeStaff,
} from "./front-office.generator.interface.ts";

const FRONT_OFFICE_PER_TEAM = 2;

// Front office "graduation" is necessarily limited at this layer. The
// `front_office_staff` schema currently exposes only `firstName` and
// `lastName` beyond the league/team identifiers — there's no role, title,
// philosophy, salary, or contract column to vary per generated staff
// member. Until the schema grows (see the backlog entry for adding GM /
// President of Football Ops / Capologist titles), the only meaningful
// variance to inject here is the name pool itself, which is now wired
// through the shared `NameGenerator` dependency just like the players,
// coaches, and scouts generators.
//
// The factory is renamed away from the `stub` prefix even though the
// behavior change is small. Keeping `stub` would imply a placeholder
// implementation slated for replacement, but the bottleneck is the schema,
// not this generator. When the schema lands, this file is the natural
// place to add role / title / age distributions on the same injection
// pattern used elsewhere.

export type { NameGenerator };

export interface FrontOfficeGeneratorOptions {
  /**
   * Injected name generator. Defaults to the shared server-wide
   * `createNameGenerator()`; tests pass a seeded generator for determinism.
   */
  nameGenerator?: NameGenerator;
}

export function createFrontOfficeGenerator(
  options: FrontOfficeGeneratorOptions = {},
): FrontOfficeGenerator {
  const nameGenerator = options.nameGenerator ?? createNameGenerator();
  return {
    generate(input: FrontOfficeGeneratorInput): GeneratedFrontOfficeStaff[] {
      const staff: GeneratedFrontOfficeStaff[] = [];
      for (const teamId of input.teamIds) {
        for (let i = 0; i < FRONT_OFFICE_PER_TEAM; i++) {
          const { firstName, lastName } = nameGenerator.next();
          staff.push({
            leagueId: input.leagueId,
            teamId,
            firstName,
            lastName,
          });
        }
      }
      return staff;
    },
  };
}
