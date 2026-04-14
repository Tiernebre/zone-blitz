import {
  PLAYER_ATTRIBUTE_KEYS,
  type PlayerAttributes,
} from "@zone-blitz/shared";
import type {
  ContractGeneratorInput,
  GeneratedContract,
  GeneratedPlayers,
  PlayersGenerator,
  PlayersGeneratorInput,
} from "./players.generator.interface.ts";

const STUB_CURRENT = 40;
const STUB_POTENTIAL = 60;
const STUB_HEIGHT_INCHES = 72;
const STUB_WEIGHT_POUNDS = 220;
const STUB_COLLEGE = "State University";
const STUB_BIRTH_DATE = "2000-01-01";

function stubAttributes(): PlayerAttributes {
  const attrs: Record<string, number> = {};
  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    attrs[key] = STUB_CURRENT;
    attrs[`${key}Potential`] = STUB_POTENTIAL;
  }
  return attrs as PlayerAttributes;
}

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
  "Daniel",
  "Matthew",
  "Anthony",
  "Mark",
  "Donald",
  "Steven",
  "Paul",
  "Andrew",
  "Joshua",
  "Kenneth",
  "Kevin",
  "Brian",
  "George",
  "Timothy",
  "Ronald",
  "Edward",
  "Jason",
  "Jeffrey",
  "Ryan",
  "Jacob",
  "Gary",
  "Nicholas",
  "Eric",
  "Jonathan",
  "Stephen",
  "Larry",
  "Justin",
  "Scott",
  "Brandon",
  "Benjamin",
  "Samuel",
  "Raymond",
  "Gregory",
  "Frank",
  "Alexander",
  "Patrick",
  "Jack",
  "Dennis",
  "Jerry",
  "Tyler",
  "Aaron",
  "Jose",
  "Adam",
  "Nathan",
  "Henry",
  "Douglas",
  "Peter",
  "Zachary",
  "Kyle",
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
  "Hernandez",
  "Lopez",
  "Gonzalez",
  "Wilson",
  "Anderson",
  "Thomas",
  "Taylor",
  "Moore",
  "Jackson",
  "Martin",
  "Lee",
  "Perez",
  "Thompson",
  "White",
  "Harris",
  "Sanchez",
  "Clark",
  "Ramirez",
  "Lewis",
  "Robinson",
  "Walker",
  "Young",
  "Allen",
  "King",
  "Wright",
  "Scott",
  "Torres",
  "Nguyen",
  "Hill",
  "Flores",
  "Green",
  "Adams",
  "Nelson",
  "Baker",
  "Hall",
  "Rivera",
  "Campbell",
  "Mitchell",
  "Carter",
  "Roberts",
  "Phillips",
  "Evans",
  "Turner",
  "Parker",
  "Collins",
  "Edwards",
  "Stewart",
  "Morris",
  "Murphy",
];

const FREE_AGENT_COUNT = 50;
const DRAFT_PROSPECT_COUNT = 250;

function randomName(index: number) {
  const firstName = FIRST_NAMES[index % FIRST_NAMES.length];
  const lastName =
    LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length];
  return { firstName, lastName };
}

export function createStubPlayersGenerator(): PlayersGenerator {
  return {
    generate(input: PlayersGeneratorInput): GeneratedPlayers {
      let nameIndex = 0;

      const players = [];
      for (const teamId of input.teamIds) {
        for (let i = 0; i < input.rosterSize; i++) {
          const { firstName, lastName } = randomName(nameIndex++);
          players.push({
            player: {
              leagueId: input.leagueId,
              teamId,
              firstName,
              lastName,
              heightInches: STUB_HEIGHT_INCHES,
              weightPounds: STUB_WEIGHT_POUNDS,
              college: STUB_COLLEGE,
              birthDate: STUB_BIRTH_DATE,
            },
            attributes: stubAttributes(),
          });
        }
      }

      for (let i = 0; i < FREE_AGENT_COUNT; i++) {
        const { firstName, lastName } = randomName(nameIndex++);
        players.push({
          player: {
            leagueId: input.leagueId,
            teamId: null,
            firstName,
            lastName,
            heightInches: STUB_HEIGHT_INCHES,
            weightPounds: STUB_WEIGHT_POUNDS,
            college: STUB_COLLEGE,
            birthDate: STUB_BIRTH_DATE,
          },
          attributes: stubAttributes(),
        });
      }

      const draftProspects = [];
      for (let i = 0; i < DRAFT_PROSPECT_COUNT; i++) {
        const { firstName, lastName } = randomName(nameIndex++);
        draftProspects.push({
          prospect: {
            seasonId: input.seasonId,
            firstName,
            lastName,
            heightInches: STUB_HEIGHT_INCHES,
            weightPounds: STUB_WEIGHT_POUNDS,
            college: STUB_COLLEGE,
            birthDate: STUB_BIRTH_DATE,
          },
          attributes: stubAttributes(),
        });
      }

      return { players, draftProspects };
    },

    generateContracts(input: ContractGeneratorInput): GeneratedContract[] {
      const rosteredPlayers = input.players.filter((p) => p.teamId !== null);
      const perPlayerSalary = Math.floor(
        input.salaryCap / Math.max(rosteredPlayers.length, 1),
      );

      return rosteredPlayers.map((player) => ({
        playerId: player.id,
        teamId: player.teamId!,
        totalYears: 3,
        currentYear: 1,
        totalSalary: perPlayerSalary * 3,
        annualSalary: perPlayerSalary,
        guaranteedMoney: perPlayerSalary,
        signingBonus: 0,
      }));
    },
  };
}
