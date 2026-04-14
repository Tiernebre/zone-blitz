import type {
  CoachesGenerator,
  CoachesGeneratorInput,
  GeneratedCoach,
} from "./coaches.generator.interface.ts";

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

const COACHES_PER_TEAM = 5;

function randomName(index: number) {
  const firstName = FIRST_NAMES[index % FIRST_NAMES.length];
  const lastName =
    LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length];
  return { firstName, lastName };
}

export function createStubCoachesGenerator(): CoachesGenerator {
  return {
    generate(input: CoachesGeneratorInput): GeneratedCoach[] {
      let nameIndex = 0;
      const coaches: GeneratedCoach[] = [];
      for (const teamId of input.teamIds) {
        for (let i = 0; i < COACHES_PER_TEAM; i++) {
          const { firstName, lastName } = randomName(nameIndex++);
          coaches.push({
            leagueId: input.leagueId,
            teamId,
            firstName,
            lastName,
          });
        }
      }
      return coaches;
    },
  };
}
