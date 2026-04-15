import { assertEquals, assertRejects } from "@std/assert";
import pino from "pino";
import type { Executor } from "../../db/connection.ts";
import type { TransactionRunner } from "../../db/transaction-runner.ts";
import type {
  ClockRow,
  LeagueClockRepository,
  PhaseStepRow,
  TeamRosterSummary,
} from "./league-clock.repository.interface.ts";
import type { Actor, Blocker } from "./league-clock.types.ts";
import { createLeagueClockService } from "./league-clock.service.ts";
import { DEFAULT_PHASE_STEPS } from "./default-phase-steps.ts";

const TX_MARKER = Symbol("tx") as unknown as Executor;

function createTestLogger() {
  return pino({ level: "silent" });
}

function createMockTxRunner(): TransactionRunner {
  return {
    run: <T>(fn: (tx: Executor) => Promise<T>) => fn(TX_MARKER),
  };
}

function createMockClock(
  overrides: Partial<ClockRow> = {},
): ClockRow {
  return {
    leagueId: "league-1",
    seasonYear: 2026,
    phase: "preseason",
    stepIndex: 0,
    advancedAt: new Date("2026-01-01"),
    advancedByUserId: "user-1",
    overrideReason: null,
    overrideBlockers: null,
    ...overrides,
  };
}

function compliantTeams(count = 2): TeamRosterSummary[] {
  return Array.from({ length: count }, (_, i) => ({
    teamId: `team-${i}`,
    rosterCount: 53,
    totalCap: 200_000_000,
  }));
}

function defaultActor(overrides: Partial<Actor> = {}): Actor {
  return {
    userId: "user-1",
    isCommissioner: true,
    ...overrides,
  };
}

function stepsForPhase(phase: string): PhaseStepRow[] {
  return DEFAULT_PHASE_STEPS
    .filter((s) => s.phase === phase)
    .map((s) => ({
      phase: s.phase,
      stepIndex: s.stepIndex,
      slug: s.slug,
      kind: s.kind,
    }));
}

interface RepoOverrides {
  getClock?: (id: string) => Promise<ClockRow | undefined>;
  getPhaseSteps?: (phase: string) => Promise<PhaseStepRow[]>;
  getAllPhaseSteps?: () => Promise<PhaseStepRow[]>;
  writeClock?: (...args: unknown[]) => Promise<ClockRow>;
  getTeamRosterSummaries?: (id: string) => Promise<TeamRosterSummary[]>;
  getLeagueSalaryCap?: (
    id: string,
  ) => Promise<
    {
      salaryCap: number;
      rosterSize: number;
      capGrowthRate: number;
      userTeamId: string | null;
    }
  >;
  expireContracts?: (...args: unknown[]) => Promise<void>;
  rollCapForward?: (...args: unknown[]) => Promise<void>;
  incrementSeasonYear?: (...args: unknown[]) => Promise<void>;
}

function createMockRepo(overrides: RepoOverrides = {}): LeagueClockRepository {
  return {
    getClock: overrides.getClock ?? (() => Promise.resolve(createMockClock())),
    getPhaseSteps: overrides.getPhaseSteps ??
      ((phase: string) => Promise.resolve(stepsForPhase(phase))),
    getAllPhaseSteps: overrides.getAllPhaseSteps ??
      (() =>
        Promise.resolve(
          DEFAULT_PHASE_STEPS.map((s) => ({
            phase: s.phase,
            stepIndex: s.stepIndex,
            slug: s.slug,
            kind: s.kind,
          })),
        )),
    writeClock: overrides.writeClock as LeagueClockRepository["writeClock"] ??
      (((row: Record<string, unknown>) =>
        Promise.resolve(
          createMockClock({
            phase: row.phase as string,
            stepIndex: row.stepIndex as number,
            advancedByUserId: row.advancedByUserId as string,
          }),
        )) as LeagueClockRepository["writeClock"]),
    getTeamRosterSummaries: overrides.getTeamRosterSummaries ??
      (() => Promise.resolve(compliantTeams())),
    expireContracts:
      overrides.expireContracts as LeagueClockRepository["expireContracts"] ??
        (() => Promise.resolve()),
    rollCapForward:
      overrides.rollCapForward as LeagueClockRepository["rollCapForward"] ??
        (() => Promise.resolve()),
    incrementSeasonYear: overrides
      .incrementSeasonYear as LeagueClockRepository["incrementSeasonYear"] ??
      (() => Promise.resolve()),
  };
}

function createService(
  repoOverrides: RepoOverrides = {},
  txRunner?: TransactionRunner,
  leagueConfig?: {
    getLeagueConfig?: (id: string) => Promise<{
      salaryCap: number;
      rosterSize: number;
      capGrowthRate: number;
      userTeamId: string | null;
    }>;
  },
) {
  return createLeagueClockService({
    repo: createMockRepo(repoOverrides),
    txRunner: txRunner ?? createMockTxRunner(),
    getLeagueConfig: leagueConfig?.getLeagueConfig ?? (() =>
      Promise.resolve({
        salaryCap: 255_000_000,
        rosterSize: 53,
        capGrowthRate: 5,
        userTeamId: "team-0",
      })),
    log: createTestLogger(),
  });
}

Deno.test("leagueClockService", async (t) => {
  await t.step("advance", async (t) => {
    await t.step("throws when no clock exists", async () => {
      const service = createService({
        getClock: () => Promise.resolve(undefined),
      });
      await assertRejects(
        () => service.advance("league-1", defaultActor()),
        Error,
        "not found",
      );
    });

    await t.step("advances to next step within same phase", async () => {
      let written: Record<string, unknown> = {};
      const service = createService({
        getClock: () =>
          Promise.resolve(
            createMockClock({ phase: "preseason", stepIndex: 0 }),
          ),
        writeClock: ((row: Record<string, unknown>) => {
          written = row;
          return Promise.resolve(
            createMockClock({ phase: "preseason", stepIndex: 1 }),
          );
        }) as unknown as LeagueClockRepository["writeClock"],
      });

      const result = await service.advance("league-1", defaultActor());
      assertEquals(result.phase, "preseason");
      assertEquals(result.stepIndex, 1);
      assertEquals(written.phase, "preseason");
      assertEquals(written.stepIndex, 1);
    });

    await t.step("advances to next phase when at last step", async () => {
      let written: Record<string, unknown> = {};
      const service = createService({
        getClock: () =>
          Promise.resolve(
            createMockClock({ phase: "preseason", stepIndex: 3 }),
          ),
        writeClock: ((row: Record<string, unknown>) => {
          written = row;
          return Promise.resolve(
            createMockClock({ phase: "regular_season", stepIndex: 0 }),
          );
        }) as unknown as LeagueClockRepository["writeClock"],
        getTeamRosterSummaries: () => Promise.resolve(compliantTeams()),
      });

      const result = await service.advance("league-1", defaultActor());
      assertEquals(result.phase, "regular_season");
      assertEquals(result.stepIndex, 0);
      assertEquals(written.phase, "regular_season");
      assertEquals(written.stepIndex, 0);
    });

    await t.step("runs gate when entering a gated phase", async () => {
      const service = createService({
        getClock: () =>
          Promise.resolve(
            createMockClock({ phase: "preseason", stepIndex: 3 }),
          ),
        getTeamRosterSummaries: () =>
          Promise.resolve([
            { teamId: "team-0", rosterCount: 53, totalCap: 200_000_000 },
            { teamId: "team-1", rosterCount: 53, totalCap: 200_000_000 },
          ]),
      });

      const result = await service.advance("league-1", defaultActor());
      assertEquals(result.phase, "regular_season");
    });

    await t.step(
      "blocks advance when gate fails and actor is not commissioner override",
      async () => {
        const service = createService({
          getClock: () =>
            Promise.resolve(
              createMockClock({ phase: "preseason", stepIndex: 3 }),
            ),
          getTeamRosterSummaries: () =>
            Promise.resolve([
              { teamId: "team-0", rosterCount: 50, totalCap: 200_000_000 },
              { teamId: "team-1", rosterCount: 53, totalCap: 200_000_000 },
            ]),
        });

        await assertRejects(
          () =>
            service.advance(
              "league-1",
              defaultActor({ isCommissioner: false }),
            ),
          Error,
          "blocked",
        );
      },
    );

    await t.step(
      "NPC auto-resolve: non-human team blockers are auto-resolved",
      async () => {
        let written: Record<string, unknown> = {};
        const npcTeamId = "team-npc";
        const humanTeamId = "team-human";

        const service = createService(
          {
            getClock: () =>
              Promise.resolve(
                createMockClock({ phase: "preseason", stepIndex: 3 }),
              ),
            getTeamRosterSummaries: () =>
              Promise.resolve([
                {
                  teamId: humanTeamId,
                  rosterCount: 53,
                  totalCap: 200_000_000,
                },
                {
                  teamId: npcTeamId,
                  rosterCount: 50,
                  totalCap: 200_000_000,
                },
              ]),
            writeClock: ((row: Record<string, unknown>) => {
              written = row;
              return Promise.resolve(
                createMockClock({
                  phase: "regular_season",
                  stepIndex: 0,
                }),
              );
            }) as unknown as LeagueClockRepository["writeClock"],
          },
          undefined,
          {
            getLeagueConfig: () =>
              Promise.resolve({
                salaryCap: 255_000_000,
                rosterSize: 53,
                capGrowthRate: 5,
                userTeamId: humanTeamId,
              }),
          },
        );

        const result = await service.advance("league-1", defaultActor());
        assertEquals(result.phase, "regular_season");
        assertEquals(written.phase, "regular_season");
      },
    );

    await t.step(
      "blocks advance when human team has blocker even if NPC resolved",
      async () => {
        const humanTeamId = "team-human";
        const service = createService(
          {
            getClock: () =>
              Promise.resolve(
                createMockClock({ phase: "preseason", stepIndex: 3 }),
              ),
            getTeamRosterSummaries: () =>
              Promise.resolve([
                {
                  teamId: humanTeamId,
                  rosterCount: 50,
                  totalCap: 200_000_000,
                },
                {
                  teamId: "team-npc",
                  rosterCount: 50,
                  totalCap: 200_000_000,
                },
              ]),
          },
          undefined,
          {
            getLeagueConfig: () =>
              Promise.resolve({
                salaryCap: 255_000_000,
                rosterSize: 53,
                capGrowthRate: 5,
                userTeamId: humanTeamId,
              }),
          },
        );

        await assertRejects(
          () =>
            service.advance(
              "league-1",
              defaultActor({ isCommissioner: false }),
            ),
          Error,
          "blocked",
        );
      },
    );

    await t.step(
      "commissioner override: force-advances past blockers",
      async () => {
        let written: Record<string, unknown> = {};
        const humanTeamId = "team-human";
        const service = createService(
          {
            getClock: () =>
              Promise.resolve(
                createMockClock({ phase: "preseason", stepIndex: 3 }),
              ),
            getTeamRosterSummaries: () =>
              Promise.resolve([
                {
                  teamId: humanTeamId,
                  rosterCount: 50,
                  totalCap: 200_000_000,
                },
              ]),
            writeClock: ((row: Record<string, unknown>) => {
              written = row;
              return Promise.resolve(
                createMockClock({
                  phase: "regular_season",
                  stepIndex: 0,
                  overrideReason: "Testing override",
                  overrideBlockers: row.overrideBlockers as Blocker[],
                }),
              );
            }) as unknown as LeagueClockRepository["writeClock"],
          },
          undefined,
          {
            getLeagueConfig: () =>
              Promise.resolve({
                salaryCap: 255_000_000,
                rosterSize: 53,
                capGrowthRate: 5,
                userTeamId: humanTeamId,
              }),
          },
        );

        const result = await service.advance(
          "league-1",
          defaultActor({
            isCommissioner: true,
            forceAdvance: true,
            overrideReason: "Testing override",
          }),
        );

        assertEquals(result.phase, "regular_season");
        assertEquals(written.overrideReason, "Testing override");
        assertEquals(Array.isArray(written.overrideBlockers), true);
        assertEquals(
          (written.overrideBlockers as Blocker[]).length > 0,
          true,
        );
      },
    );

    await t.step(
      "commissioner override: fails if not flagged as commissioner",
      async () => {
        const humanTeamId = "team-human";
        const service = createService(
          {
            getClock: () =>
              Promise.resolve(
                createMockClock({ phase: "preseason", stepIndex: 3 }),
              ),
            getTeamRosterSummaries: () =>
              Promise.resolve([
                {
                  teamId: humanTeamId,
                  rosterCount: 50,
                  totalCap: 200_000_000,
                },
              ]),
          },
          undefined,
          {
            getLeagueConfig: () =>
              Promise.resolve({
                salaryCap: 255_000_000,
                rosterSize: 53,
                capGrowthRate: 5,
                userTeamId: humanTeamId,
              }),
          },
        );

        await assertRejects(
          () =>
            service.advance(
              "league-1",
              defaultActor({
                isCommissioner: false,
                forceAdvance: true,
              }),
            ),
          Error,
          "blocked",
        );
      },
    );

    await t.step(
      "offseason_rollover wraps to offseason_review and increments season",
      async () => {
        let written: Record<string, unknown> = {};
        let expiredCalled = false;
        let rollCapCalled = false;
        let incrementCalled = false;

        const service = createService({
          getClock: () =>
            Promise.resolve(
              createMockClock({
                phase: "offseason_rollover",
                stepIndex: 2,
                seasonYear: 2026,
              }),
            ),
          writeClock: ((row: Record<string, unknown>) => {
            written = row;
            return Promise.resolve(
              createMockClock({
                phase: "offseason_review",
                stepIndex: 0,
                seasonYear: 2027,
              }),
            );
          }) as unknown as LeagueClockRepository["writeClock"],
          expireContracts: () => {
            expiredCalled = true;
            return Promise.resolve();
          },
          rollCapForward: () => {
            rollCapCalled = true;
            return Promise.resolve();
          },
          incrementSeasonYear: () => {
            incrementCalled = true;
            return Promise.resolve();
          },
        });

        const result = await service.advance("league-1", defaultActor());
        assertEquals(result.phase, "offseason_review");
        assertEquals(result.seasonYear, 2027);
        assertEquals(written.phase, "offseason_review");
        assertEquals(written.stepIndex, 0);
        assertEquals(expiredCalled, true);
        assertEquals(rollCapCalled, true);
        assertEquals(incrementCalled, true);
      },
    );

    await t.step("no override fields when gate passes cleanly", async () => {
      let written: Record<string, unknown> = {};
      const service = createService({
        getClock: () =>
          Promise.resolve(
            createMockClock({ phase: "preseason", stepIndex: 0 }),
          ),
        writeClock: ((row: Record<string, unknown>) => {
          written = row;
          return Promise.resolve(
            createMockClock({ phase: "preseason", stepIndex: 1 }),
          );
        }) as unknown as LeagueClockRepository["writeClock"],
      });

      await service.advance("league-1", defaultActor());
      assertEquals(written.overrideReason, undefined);
      assertEquals(written.overrideBlockers, undefined);
    });
  });
});
