import type {
  GeneratedPersonnel,
  PersonnelGenerator,
  PersonnelGeneratorInput,
} from "@zone-blitz/shared";

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
const COACHES_PER_TEAM = 5;
const SCOUTS_PER_TEAM = 3;
const FRONT_OFFICE_PER_TEAM = 2;
const DRAFT_PROSPECT_COUNT = 250;

function randomName(index: number) {
  const firstName = FIRST_NAMES[index % FIRST_NAMES.length];
  const lastName =
    LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length];
  return { firstName, lastName };
}

export function createStubPersonnelGenerator(): PersonnelGenerator {
  return {
    generate(input: PersonnelGeneratorInput): GeneratedPersonnel {
      let nameIndex = 0;

      const players = [];
      for (const teamId of input.teamIds) {
        for (let i = 0; i < input.rosterSize; i++) {
          const { firstName, lastName } = randomName(nameIndex++);
          players.push({
            leagueId: input.leagueId,
            teamId,
            firstName,
            lastName,
          });
        }
      }

      for (let i = 0; i < FREE_AGENT_COUNT; i++) {
        const { firstName, lastName } = randomName(nameIndex++);
        players.push({
          leagueId: input.leagueId,
          teamId: null,
          firstName,
          lastName,
        });
      }

      const coaches = [];
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

      const scouts = [];
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

      const frontOfficeStaff = [];
      for (const teamId of input.teamIds) {
        for (let i = 0; i < FRONT_OFFICE_PER_TEAM; i++) {
          const { firstName, lastName } = randomName(nameIndex++);
          frontOfficeStaff.push({
            leagueId: input.leagueId,
            teamId,
            firstName,
            lastName,
          });
        }
      }

      const draftProspects = [];
      for (let i = 0; i < DRAFT_PROSPECT_COUNT; i++) {
        const { firstName, lastName } = randomName(nameIndex++);
        draftProspects.push({
          seasonId: input.seasonId,
          firstName,
          lastName,
        });
      }

      return { players, coaches, scouts, frontOfficeStaff, draftProspects };
    },
  };
}
