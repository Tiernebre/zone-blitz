import {
  PLAYER_ATTRIBUTE_KEYS,
  type PlayerAttributes,
  type PlayerPosition,
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
const STUB_HOMETOWNS = [
  "Houston, TX",
  "Miami, FL",
  "Atlanta, GA",
  "Chicago, IL",
  "Los Angeles, CA",
  "Philadelphia, PA",
  "Dallas, TX",
  "Detroit, MI",
] as const;

export const ROSTER_POSITION_COMPOSITION: readonly {
  position: PlayerPosition;
  count: number;
}[] = [
  { position: "QB", count: 2 },
  { position: "RB", count: 3 },
  { position: "FB", count: 1 },
  { position: "WR", count: 6 },
  { position: "TE", count: 3 },
  { position: "OL", count: 9 },
  { position: "DL", count: 8 },
  { position: "LB", count: 7 },
  { position: "CB", count: 6 },
  { position: "S", count: 5 },
  { position: "K", count: 1 },
  { position: "P", count: 1 },
  { position: "LS", count: 1 },
];

const ROSTER_POSITION_SLOTS: readonly PlayerPosition[] =
  ROSTER_POSITION_COMPOSITION.flatMap(({ position, count }) =>
    Array.from({ length: count }, () => position)
  );

const FREE_AGENT_POSITION_CYCLE: readonly PlayerPosition[] =
  ROSTER_POSITION_COMPOSITION.map(({ position }) => position);

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

function stubOrigin(index: number, draftingTeamId: string | null) {
  const undrafted = index % 17 === 0;
  if (undrafted) {
    return {
      hometown: STUB_HOMETOWNS[index % STUB_HOMETOWNS.length],
      draftYear: null,
      draftRound: null,
      draftPick: null,
      draftingTeamId: null,
    };
  }
  const round = (index % 7) + 1;
  const pickInRound = (index % 32) + 1;
  const overallPick = (round - 1) * 32 + pickInRound;
  return {
    hometown: STUB_HOMETOWNS[index % STUB_HOMETOWNS.length],
    draftYear: 2020 + (index % 6),
    draftRound: round,
    draftPick: overallPick,
    draftingTeamId,
  };
}

export function createStubPlayersGenerator(): PlayersGenerator {
  return {
    generate(input: PlayersGeneratorInput): GeneratedPlayers {
      let nameIndex = 0;

      const players = [];
      for (const teamId of input.teamIds) {
        for (let i = 0; i < input.rosterSize; i++) {
          const { firstName, lastName } = randomName(nameIndex++);
          const position = ROSTER_POSITION_SLOTS[
            i % ROSTER_POSITION_SLOTS.length
          ];
          const origin = stubOrigin(nameIndex, teamId);
          players.push({
            player: {
              leagueId: input.leagueId,
              teamId,
              status: "active" as const,
              firstName,
              lastName,
              position,
              injuryStatus: "healthy" as const,
              heightInches: STUB_HEIGHT_INCHES,
              weightPounds: STUB_WEIGHT_POUNDS,
              college: STUB_COLLEGE,
              birthDate: STUB_BIRTH_DATE,
              ...origin,
            },
            attributes: stubAttributes(),
          });
        }
      }

      for (let i = 0; i < FREE_AGENT_COUNT; i++) {
        const { firstName, lastName } = randomName(nameIndex++);
        const position = FREE_AGENT_POSITION_CYCLE[
          i % FREE_AGENT_POSITION_CYCLE.length
        ];
        const origin = stubOrigin(nameIndex, null);
        players.push({
          player: {
            leagueId: input.leagueId,
            teamId: null,
            status: "active" as const,
            firstName,
            lastName,
            position,
            injuryStatus: "healthy" as const,
            heightInches: STUB_HEIGHT_INCHES,
            weightPounds: STUB_WEIGHT_POUNDS,
            college: STUB_COLLEGE,
            birthDate: STUB_BIRTH_DATE,
            ...origin,
          },
          attributes: stubAttributes(),
        });
      }

      const draftProspects = [];
      for (let i = 0; i < DRAFT_PROSPECT_COUNT; i++) {
        const { firstName, lastName } = randomName(nameIndex++);
        const position = FREE_AGENT_POSITION_CYCLE[
          i % FREE_AGENT_POSITION_CYCLE.length
        ];
        draftProspects.push({
          prospect: {
            seasonId: input.seasonId,
            firstName,
            lastName,
            position,
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
