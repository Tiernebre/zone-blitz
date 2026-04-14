import type {
  GeneratedScout,
  ScoutsGenerator,
  ScoutsGeneratorInput,
} from "./scouts.generator.interface.ts";

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

const SCOUTS_PER_TEAM = 3;

function randomName(index: number) {
  const firstName = FIRST_NAMES[index % FIRST_NAMES.length];
  const lastName =
    LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length];
  return { firstName, lastName };
}

export function createStubScoutsGenerator(): ScoutsGenerator {
  return {
    generate(input: ScoutsGeneratorInput): GeneratedScout[] {
      let nameIndex = 0;
      const scouts: GeneratedScout[] = [];
      for (const teamId of input.teamIds) {
        for (let i = 0; i < SCOUTS_PER_TEAM; i++) {
          const { firstName, lastName } = randomName(nameIndex++);
          scouts.push({
            leagueId: input.leagueId,
            teamId,
            firstName,
            lastName,
          });
        }
      }
      return scouts;
    },
  };
}
