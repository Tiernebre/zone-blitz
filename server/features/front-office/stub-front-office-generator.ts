import type {
  FrontOfficeGenerator,
  FrontOfficeGeneratorInput,
  GeneratedFrontOfficeStaff,
} from "./front-office.generator.interface.ts";

const FIRST_NAMES = [
  "James",
  "John",
  "Robert",
  "Michael",
  "William",
  "David",
  "Richard",
  "Joseph",
  "Thomas",
  "Charles",
];

const LAST_NAMES = [
  "Smith",
  "Johnson",
  "Williams",
  "Brown",
  "Jones",
  "Garcia",
  "Miller",
  "Davis",
  "Rodriguez",
  "Martinez",
];

const FRONT_OFFICE_PER_TEAM = 2;

function randomName(index: number) {
  const firstName = FIRST_NAMES[index % FIRST_NAMES.length];
  const lastName =
    LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length];
  return { firstName, lastName };
}

export function createStubFrontOfficeGenerator(): FrontOfficeGenerator {
  return {
    generate(input: FrontOfficeGeneratorInput): GeneratedFrontOfficeStaff[] {
      let nameIndex = 0;
      const staff: GeneratedFrontOfficeStaff[] = [];
      for (const teamId of input.teamIds) {
        for (let i = 0; i < FRONT_OFFICE_PER_TEAM; i++) {
          const { firstName, lastName } = randomName(nameIndex++);
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
