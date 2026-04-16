import { assertEquals, assertExists } from "@std/assert";
import type { PlayEvent, PlayTag } from "./events.ts";
import {
  determineScoringOutcome,
  resolveConversion,
} from "./resolve-scoring.ts";
import type { ConversionContext } from "./resolve-scoring.ts";
import type { MutableGameState } from "./game-clock.ts";
import { QUARTER_SECONDS, TIMEOUTS_PER_HALF } from "./game-clock.ts";
import type { PlayerRuntime, TeamRuntime } from "./resolve-play.ts";
import {
  PLAYER_ATTRIBUTE_KEYS,
  type PlayerAttributes,
  type SchemeFingerprint,
} from "@zone-blitz/shared";
import type { SimTeam } from "./simulate-game.ts";
import type { ActiveRosters } from "./simulate-game.ts";
import { createSeededRng } from "./rng.ts";

function makeEvent(
  overrides: Partial<PlayEvent> = {},
): PlayEvent {
  return {
    gameId: "test",
    driveIndex: 0,
    playIndex: 0,
    quarter: 1,
    clock: "15:00",
    situation: { down: 1, distance: 10, yardLine: 35 },
    offenseTeamId: "team-home",
    defenseTeamId: "team-away",
    call: {
      concept: "dropback",
      personnel: "11",
      formation: "shotgun",
      motion: "none",
    },
    coverage: { front: "4-3", coverage: "cover_3", pressure: "none" },
    participants: [],
    outcome: "rush",
    yardage: 5,
    tags: [],
    ...overrides,
  };
}

function makeState(
  overrides: Partial<MutableGameState> = {},
): MutableGameState {
  return {
    quarter: 1,
    clock: QUARTER_SECONDS,
    homeScore: 0,
    awayScore: 0,
    possession: "home",
    yardLine: 35,
    down: 1,
    distance: 10,
    driveIndex: 0,
    playIndex: 0,
    globalPlayIndex: 0,
    driveStartYardLine: 35,
    drivePlays: 0,
    driveYards: 0,
    homeTimeouts: TIMEOUTS_PER_HALF,
    awayTimeouts: TIMEOUTS_PER_HALF,
    ...overrides,
  };
}

function makeAttributes(
  overrides: Partial<PlayerAttributes> = {},
): PlayerAttributes {
  const base: Partial<PlayerAttributes> = {};
  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    (base as Record<string, number>)[key] = 50;
    (base as Record<string, number>)[`${key}Potential`] = 50;
  }
  return { ...base, ...overrides } as PlayerAttributes;
}

function makePlayer(
  id: string,
  bucket: PlayerRuntime["neutralBucket"],
): PlayerRuntime {
  return {
    playerId: id,
    neutralBucket: bucket,
    attributes: makeAttributes(),
  };
}

function makeFingerprint(): SchemeFingerprint {
  return {
    offense: {
      runPassLean: 50,
      tempo: 50,
      personnelWeight: 50,
      formationUnderCenterShotgun: 50,
      preSnapMotionRate: 50,
      passingStyle: 50,
      passingDepth: 50,
      runGameBlocking: 50,
      rpoIntegration: 50,
    },
    defense: {
      frontOddEven: 50,
      gapResponsibility: 50,
      subPackageLean: 50,
      coverageManZone: 50,
      coverageShell: 50,
      cornerPressOff: 50,
      pressureRate: 50,
      disguiseRate: 50,
    },
    overrides: {},
  };
}

function makeTeam(prefix: string): SimTeam {
  return {
    teamId: `team-${prefix}`,
    starters: [
      makePlayer(`${prefix}-qb`, "QB"),
      makePlayer(`${prefix}-rb`, "RB"),
      makePlayer(`${prefix}-wr1`, "WR"),
      makePlayer(`${prefix}-wr2`, "WR"),
      makePlayer(`${prefix}-te`, "TE"),
      makePlayer(`${prefix}-k`, "K"),
    ],
    bench: [],
    fingerprint: makeFingerprint(),
    coachingMods: {
      schemeFitBonus: 2,
      situationalBonus: 1,
      aggressiveness: 50,
    },
  };
}

Deno.test("resolve-scoring", async (t) => {
  await t.step("determineScoringOutcome", async (t) => {
    await t.step("identifies offensive touchdown", () => {
      const result = determineScoringOutcome(
        makeEvent({ outcome: "touchdown", offenseTeamId: "team-home" }),
        "team-home",
      );
      assertEquals(result.scored, true);
      assertEquals(result.type, "touchdown");
      assertEquals(result.scoringTeamSide, "home");
      assertEquals(result.scoringTeamId, "team-home");
      assertEquals(result.points, 6);
      assertEquals(result.kickoffSide, "home");
    });

    await t.step("identifies away offensive touchdown", () => {
      const result = determineScoringOutcome(
        makeEvent({ outcome: "touchdown", offenseTeamId: "team-away" }),
        "team-home",
      );
      assertEquals(result.scored, true);
      assertEquals(result.type, "touchdown");
      assertEquals(result.scoringTeamSide, "away");
      assertEquals(result.scoringTeamId, "team-away");
      assertEquals(result.points, 6);
      assertEquals(result.kickoffSide, "away");
    });

    await t.step("identifies return touchdown", () => {
      const result = determineScoringOutcome(
        makeEvent({
          outcome: "interception",
          offenseTeamId: "team-home",
          defenseTeamId: "team-away",
          tags: ["turnover", "return_td", "touchdown"] as PlayTag[],
        }),
        "team-home",
      );
      assertEquals(result.scored, true);
      assertEquals(result.type, "return_td");
      assertEquals(result.scoringTeamSide, "away");
      assertEquals(result.scoringTeamId, "team-away");
      assertEquals(result.points, 6);
      assertEquals(result.kickoffSide, "away");
    });

    await t.step("identifies home defense return touchdown", () => {
      const result = determineScoringOutcome(
        makeEvent({
          outcome: "fumble",
          offenseTeamId: "team-away",
          defenseTeamId: "team-home",
          tags: ["turnover", "return_td", "touchdown"] as PlayTag[],
        }),
        "team-home",
      );
      assertEquals(result.scored, true);
      assertEquals(result.type, "return_td");
      assertEquals(result.scoringTeamSide, "home");
      assertEquals(result.scoringTeamId, "team-home");
    });

    await t.step("identifies safety (defense gets points)", () => {
      const result = determineScoringOutcome(
        makeEvent({
          outcome: "safety",
          offenseTeamId: "team-home",
          defenseTeamId: "team-away",
        }),
        "team-home",
      );
      assertEquals(result.scored, true);
      assertEquals(result.type, "safety");
      assertEquals(result.scoringTeamSide, "away");
      assertEquals(result.points, 2);
      assertEquals(result.kickoffSide, "home");
      assertEquals(result.safetyKick, true);
    });

    await t.step("returns not scored for normal plays", () => {
      assertEquals(
        determineScoringOutcome(makeEvent({ outcome: "rush" }), "team-home")
          .scored,
        false,
      );
      assertEquals(
        determineScoringOutcome(
          makeEvent({ outcome: "pass_complete" }),
          "team-home",
        ).scored,
        false,
      );
      assertEquals(
        determineScoringOutcome(makeEvent({ outcome: "sack" }), "team-home")
          .scored,
        false,
      );
    });

    await t.step("returns not scored for turnovers without return_td", () => {
      const result = determineScoringOutcome(
        makeEvent({
          outcome: "interception",
          tags: ["turnover"] as PlayTag[],
        }),
        "team-home",
      );
      assertEquals(result.scored, false);
    });
  });

  await t.step("resolveConversion", async (t) => {
    await t.step("produces XP event with kicker participant", () => {
      const state = makeState({ homeScore: 6 });
      const home = makeTeam("home");
      const away = makeTeam("away");
      const rosters: ActiveRosters = {
        homeActive: [...home.starters],
        awayActive: [...away.starters],
        homeBench: [],
        awayBench: [],
        injuredPlayerIds: new Set(),
      };

      const ctx: ConversionContext = {
        gameId: "test-game",
        state,
        scoringTeamId: "team-home",
        homeTeamId: "team-home",
        home,
        away,
        rosters,
        buildTeamRuntime: (team, _rosters, _side): TeamRuntime => ({
          fingerprint: team.fingerprint,
          onField: team.starters,
          coachingMods: team.coachingMods,
        }),
        buildGameState: () => ({
          gameId: "test-game",
          driveIndex: state.driveIndex,
          playIndex: state.playIndex,
          quarter: state.quarter,
          clock: "15:00",
          situation: {
            down: state.down,
            distance: state.distance,
            yardLine: state.yardLine,
          },
          offenseTeamId: "team-home",
          defenseTeamId: "team-away",
        }),
        findKicker: () => makePlayer("home-k", "K"),
      };

      const rng = createSeededRng(42);
      const events = resolveConversion(ctx, rng);
      assertEquals(events.length, 1);

      const xpEvent = events[0];
      assertEquals(xpEvent.outcome, "xp");
      const kicker = xpEvent.participants.find((p) => p.role === "kicker");
      assertExists(kicker);
      assertEquals(kicker.playerId, "home-k");
    });

    await t.step("increments playIndex and globalPlayIndex", () => {
      const state = makeState({
        homeScore: 6,
        playIndex: 3,
        globalPlayIndex: 20,
      });
      const home = makeTeam("home");
      const away = makeTeam("away");
      const rosters: ActiveRosters = {
        homeActive: [...home.starters],
        awayActive: [...away.starters],
        homeBench: [],
        awayBench: [],
        injuredPlayerIds: new Set(),
      };

      const ctx: ConversionContext = {
        gameId: "test-game",
        state,
        scoringTeamId: "team-home",
        homeTeamId: "team-home",
        home,
        away,
        rosters,
        buildTeamRuntime: (team, _rosters, _side): TeamRuntime => ({
          fingerprint: team.fingerprint,
          onField: team.starters,
          coachingMods: team.coachingMods,
        }),
        buildGameState: () => ({
          gameId: "test-game",
          driveIndex: state.driveIndex,
          playIndex: state.playIndex,
          quarter: state.quarter,
          clock: "15:00",
          situation: {
            down: state.down,
            distance: state.distance,
            yardLine: state.yardLine,
          },
          offenseTeamId: "team-home",
          defenseTeamId: "team-away",
        }),
        findKicker: () => makePlayer("home-k", "K"),
      };

      const rng = createSeededRng(42);
      resolveConversion(ctx, rng);
      assertEquals(state.playIndex, 4);
      assertEquals(state.globalPlayIndex, 21);
    });

    await t.step(
      "chooses 2PT when trailing by 2 in Q4",
      () => {
        const state = makeState({
          quarter: 4,
          homeScore: 12,
          awayScore: 14,
        });
        const home = makeTeam("home");
        const away = makeTeam("away");
        const rosters: ActiveRosters = {
          homeActive: [...home.starters],
          awayActive: [...away.starters],
          homeBench: [],
          awayBench: [],
          injuredPlayerIds: new Set(),
        };

        const ctx: ConversionContext = {
          gameId: "test-game",
          state,
          scoringTeamId: "team-home",
          homeTeamId: "team-home",
          home,
          away,
          rosters,
          buildTeamRuntime: (team, _rosters, _side): TeamRuntime => ({
            fingerprint: team.fingerprint,
            onField: team.starters,
            coachingMods: team.coachingMods,
          }),
          buildGameState: () => ({
            gameId: "test-game",
            driveIndex: state.driveIndex,
            playIndex: state.playIndex,
            quarter: state.quarter,
            clock: "15:00",
            situation: {
              down: state.down,
              distance: state.distance,
              yardLine: state.yardLine,
            },
            offenseTeamId: "team-home",
            defenseTeamId: "team-away",
          }),
          findKicker: () => makePlayer("home-k", "K"),
        };

        const rng = createSeededRng(42);
        const events = resolveConversion(ctx, rng);
        assertEquals(events.length, 1);
        assertEquals(events[0].outcome, "two_point");
      },
    );
  });
});
