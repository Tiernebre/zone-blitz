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

export interface StubFrontOfficeGeneratorOptions {
  nameGenerator?: NameGenerator;
}

export function createStubFrontOfficeGenerator(
  options: StubFrontOfficeGeneratorOptions = {},
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
