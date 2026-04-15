import { assertEquals, assertRejects } from "@std/assert";
import { DomainError } from "@zone-blitz/shared";
import pino from "pino";
import type { Executor } from "../../db/connection.ts";
import type { TransactionRunner } from "../../db/transaction-runner.ts";
import type {
  LeagueClockRepository,
  LeagueClockRow,
} from "./league-clock.repository.ts";
import type { LeagueAdvanceVoteRepository } from "./league-advance-vote.repository.ts";
import {
  type Actor,
  type AdvanceOptions,
  createLeagueClockService,
} from "./league-clock.service.ts";
import type { LeagueGateState, TeamGateState } from "./gates.ts";

const TX_MARKER = { __tx: true };

function createMockTxRunner(): TransactionRunner {
  return {
    run: (fn) => fn(TX_MARKER as unknown as Executor),
  };
}

function createTestLogger() {
  return pino({ level: "silent" });
}

function createMockClock(
  overrides: Partial<LeagueClockRow> = {},
): LeagueClockRow {
  return {
    leagueId: "league-1",
    seasonYear: 2026,
    phase: "offseason_review",
    stepIndex: 0,
    advancedAt: new Date(),
    advancedByUserId: null,
    overrideReason: null,
    overrideBlockers: null,
    ...overrides,
  };
}

function createMockRepo(
  overrides: Partial<LeagueClockRepository> = {},
): LeagueClockRepository {
  return {
    getByLeagueId: () => Promise.resolve(createMockClock()),
    upsert: (row) =>
      Promise.resolve(
        createMockClock({
          leagueId: row.leagueId,
          seasonYear: row.seasonYear,
          phase: row.phase,
          stepIndex: row.stepIndex,
          advancedByUserId: row.advancedByUserId,
          overrideReason: row.overrideReason ?? null,
          overrideBlockers: row.overrideBlockers ?? null,
        }),
      ),
    ...overrides,
  };
}

function createActor(overrides: Partial<Actor> = {}): Actor {
  return {
    userId: "user-1",
    isCommissioner: false,
    ...overrides,
  };
}

function createTeam(overrides: Partial<TeamGateState> = {}): TeamGateState {
  return {
    teamId: "team-1",
    isNpc: false,
    autoPilot: false,
    capCompliant: true,
    activeRosterCount: 53,
    rosterLimit: 53,
    ...overrides,
  };
}

function createGateState(
  overrides: Partial<LeagueGateState> = {},
): LeagueGateState {
  return {
    teams: [createTeam()],
    draftOrderResolved: true,
    superBowlPlayed: true,
    priorPhaseComplete: true,
    ...overrides,
  };
}

function createMockVoteRepo(
  overrides: Partial<LeagueAdvanceVoteRepository> = {},
): LeagueAdvanceVoteRepository {
  return {
    castVote: (vote) =>
      Promise.resolve({
        leagueId: vote.leagueId,
        teamId: vote.teamId,
        phase: vote.phase,
        stepIndex: vote.stepIndex,
        readyAt: new Date(),
      }),
    getVotesForStep: () => Promise.resolve([]),
    ...overrides,
  };
}

function createService(overrides: {
  txRunner?: TransactionRunner;
  leagueClockRepo?: Partial<LeagueClockRepository>;
  voteRepo?: Partial<LeagueAdvanceVoteRepository>;
} = {}) {
  return createLeagueClockService({
    txRunner: overrides.txRunner ?? createMockTxRunner(),
    leagueClockRepo: createMockRepo(overrides.leagueClockRepo),
    voteRepo: createMockVoteRepo(overrides.voteRepo),
    log: createTestLogger(),
  });
}

function createAdvanceOptions(
  overrides: Partial<AdvanceOptions> = {},
): AdvanceOptions {
  return {
    advancePolicy: "commissioner",
    teamVoteStates: [],
    ...overrides,
  };
}

Deno.test("league-clock.service", async (t) => {
  await t.step("advance", async (t) => {
    await t.step("throws NOT_FOUND when clock does not exist", async () => {
      const service = createService({
        leagueClockRepo: {
          getByLeagueId: () => Promise.resolve(undefined),
        },
      });

      await assertRejects(
        () =>
          service.advance(
            "missing",
            createActor(),
            createGateState(),
            createAdvanceOptions(),
          ),
        DomainError,
        "not found",
      );
    });

    await t.step("advances within same phase (happy path)", async () => {
      const service = createService({
        leagueClockRepo: {
          getByLeagueId: () =>
            Promise.resolve(
              createMockClock({ phase: "offseason_review", stepIndex: 0 }),
            ),
        },
      });

      const result = await service.advance(
        "league-1",
        createActor(),
        createGateState(),
      );
      assertEquals(result.phase, "offseason_review");
      assertEquals(result.stepIndex, 1);
      assertEquals(result.looped, false);
    });

    await t.step("advances to next phase when at last step", async () => {
      const service = createService({
        leagueClockRepo: {
          getByLeagueId: () =>
            Promise.resolve(
              createMockClock({ phase: "offseason_review", stepIndex: 1 }),
            ),
        },
      });

      const result = await service.advance(
        "league-1",
        createActor(),
        createGateState(),
      );
      assertEquals(result.phase, "coaching_carousel");
      assertEquals(result.stepIndex, 0);
    });

    await t.step(
      "throws GATE_BLOCKED when gate fails and actor is not commissioner",
      async () => {
        const service = createService({
          leagueClockRepo: {
            getByLeagueId: () =>
              Promise.resolve(
                createMockClock({ phase: "preseason", stepIndex: 3 }),
              ),
          },
        });

        await assertRejects(
          () =>
            service.advance(
              "league-1",
              createActor(),
              createGateState({
                teams: [
                  createTeam({ teamId: "t1", capCompliant: false }),
                ],
              }),
            ),
          DomainError,
          "Cannot advance to regular_season",
        );
      },
    );

    await t.step(
      "throws GATE_BLOCKED when commissioner has no overrideReason",
      async () => {
        const service = createService({
          leagueClockRepo: {
            getByLeagueId: () =>
              Promise.resolve(
                createMockClock({ phase: "preseason", stepIndex: 3 }),
              ),
          },
        });

        await assertRejects(
          () =>
            service.advance(
              "league-1",
              createActor({ isCommissioner: true }),
              createGateState({
                teams: [
                  createTeam({ teamId: "t1", capCompliant: false }),
                ],
              }),
            ),
          DomainError,
          "Cannot advance to regular_season",
        );
      },
    );

    await t.step(
      "commissioner can override gate with reason",
      async () => {
        let upsertedRow:
          | Parameters<LeagueClockRepository["upsert"]>[0]
          | undefined;

        const service = createService({
          leagueClockRepo: {
            getByLeagueId: () =>
              Promise.resolve(
                createMockClock({ phase: "preseason", stepIndex: 3 }),
              ),
            upsert: (row) => {
              upsertedRow = row;
              return Promise.resolve(
                createMockClock({
                  phase: row.phase,
                  stepIndex: row.stepIndex,
                  overrideReason: row.overrideReason ?? null,
                  overrideBlockers: row.overrideBlockers ?? null,
                }),
              );
            },
          },
        });

        const result = await service.advance(
          "league-1",
          createActor({
            isCommissioner: true,
            overrideReason: "Testing override",
          }),
          createGateState({
            teams: [
              createTeam({ teamId: "t1", capCompliant: false }),
            ],
          }),
        );

        assertEquals(result.phase, "regular_season");
        assertEquals(result.stepIndex, 0);
        assertEquals(result.overrideReason, "Testing override");
        assertEquals(upsertedRow?.overrideReason, "Testing override");
        assertEquals(Array.isArray(upsertedRow?.overrideBlockers), true);
      },
    );

    await t.step(
      "NPC team blockers are auto-resolved",
      async () => {
        const service = createService({
          leagueClockRepo: {
            getByLeagueId: () =>
              Promise.resolve(
                createMockClock({ phase: "preseason", stepIndex: 3 }),
              ),
          },
        });

        const result = await service.advance(
          "league-1",
          createActor(),
          createGateState({
            teams: [
              createTeam({ teamId: "t1", isNpc: true, capCompliant: false }),
              createTeam({ teamId: "t2" }),
            ],
          }),
        );

        assertEquals(result.phase, "regular_season");
        assertEquals(result.stepIndex, 0);
        assertEquals(result.autoResolved.length, 1);
        assertEquals(result.autoResolved[0].teamId, "t1");
      },
    );

    await t.step(
      "autoPilot team blockers are auto-resolved",
      async () => {
        const service = createService({
          leagueClockRepo: {
            getByLeagueId: () =>
              Promise.resolve(
                createMockClock({ phase: "preseason", stepIndex: 3 }),
              ),
          },
        });

        const result = await service.advance(
          "league-1",
          createActor(),
          createGateState({
            teams: [
              createTeam({
                teamId: "t1",
                autoPilot: true,
                capCompliant: false,
              }),
            ],
          }),
        );

        assertEquals(result.phase, "regular_season");
        assertEquals(result.autoResolved.length, 1);
      },
    );

    await t.step(
      "mixed NPC and human blockers: NPC auto-resolved, human blocks",
      async () => {
        const service = createService({
          leagueClockRepo: {
            getByLeagueId: () =>
              Promise.resolve(
                createMockClock({ phase: "preseason", stepIndex: 3 }),
              ),
          },
        });

        await assertRejects(
          () =>
            service.advance(
              "league-1",
              createActor(),
              createGateState({
                teams: [
                  createTeam({
                    teamId: "t1",
                    isNpc: true,
                    capCompliant: false,
                  }),
                  createTeam({
                    teamId: "t2",
                    isNpc: false,
                    capCompliant: false,
                  }),
                ],
              }),
            ),
          DomainError,
          "Cannot advance to regular_season",
        );
      },
    );

    await t.step(
      "draft gate blocks when prior phase not complete",
      async () => {
        const service = createService({
          leagueClockRepo: {
            getByLeagueId: () =>
              Promise.resolve(
                createMockClock({ phase: "pre_draft", stepIndex: 1 }),
              ),
          },
        });

        await assertRejects(
          () =>
            service.advance(
              "league-1",
              createActor(),
              createGateState({ priorPhaseComplete: false }),
            ),
          DomainError,
          "Cannot advance to draft",
        );
      },
    );

    await t.step(
      "offseason_rollover gate blocks when Super Bowl not played",
      async () => {
        const service = createService({
          leagueClockRepo: {
            getByLeagueId: () =>
              Promise.resolve(
                createMockClock({ phase: "playoffs", stepIndex: 3 }),
              ),
          },
        });

        await assertRejects(
          () =>
            service.advance(
              "league-1",
              createActor(),
              createGateState({ superBowlPlayed: false }),
            ),
          DomainError,
          "Cannot advance to offseason_rollover",
        );
      },
    );

    await t.step(
      "offseason_rollover at season_advance loops to offseason_review with incremented year",
      async () => {
        const service = createService({
          leagueClockRepo: {
            getByLeagueId: () =>
              Promise.resolve(
                createMockClock({
                  phase: "offseason_rollover",
                  stepIndex: 2,
                  seasonYear: 2026,
                }),
              ),
          },
        });

        const result = await service.advance(
          "league-1",
          createActor(),
          createGateState(),
        );

        assertEquals(result.phase, "offseason_review");
        assertEquals(result.stepIndex, 0);
        assertEquals(result.seasonYear, 2027);
        assertEquals(result.looped, true);
      },
    );

    await t.step(
      "offseason_rollover before final step does not loop",
      async () => {
        const service = createService({
          leagueClockRepo: {
            getByLeagueId: () =>
              Promise.resolve(
                createMockClock({
                  phase: "offseason_rollover",
                  stepIndex: 0,
                  seasonYear: 2026,
                }),
              ),
          },
        });

        const result = await service.advance(
          "league-1",
          createActor(),
          createGateState(),
        );

        assertEquals(result.phase, "offseason_rollover");
        assertEquals(result.stepIndex, 1);
        assertEquals(result.seasonYear, 2026);
        assertEquals(result.looped, false);
      },
    );

    await t.step(
      "passes transaction to repository upsert",
      async () => {
        let receivedTx: unknown;
        const service = createService({
          leagueClockRepo: {
            getByLeagueId: () => Promise.resolve(createMockClock()),
            upsert: (row, tx) => {
              receivedTx = tx;
              return Promise.resolve(
                createMockClock({
                  phase: row.phase,
                  stepIndex: row.stepIndex,
                }),
              );
            },
          },
        });

        await service.advance(
          "league-1",
          createActor(),
          createGateState(),
        );

        assertEquals(receivedTx, TX_MARKER);
      },
    );

    await t.step(
      "sets advancedByUserId from actor",
      async () => {
        let upsertedUserId: string | null = null;
        const service = createService({
          leagueClockRepo: {
            getByLeagueId: () => Promise.resolve(createMockClock()),
            upsert: (row) => {
              upsertedUserId = row.advancedByUserId;
              return Promise.resolve(
                createMockClock({
                  phase: row.phase,
                  stepIndex: row.stepIndex,
                }),
              );
            },
          },
        });

        await service.advance(
          "league-1",
          createActor({ userId: "user-42" }),
          createGateState(),
        );

        assertEquals(upsertedUserId, "user-42");
      },
    );

    await t.step(
      "ungated phase transition passes without gate check",
      async () => {
        const service = createService({
          leagueClockRepo: {
            getByLeagueId: () =>
              Promise.resolve(
                createMockClock({
                  phase: "coaching_carousel",
                  stepIndex: 1,
                }),
              ),
          },
        });

        const result = await service.advance(
          "league-1",
          createActor(),
          createGateState(),
        );

        assertEquals(result.phase, "tag_window");
        assertEquals(result.stepIndex, 0);
        assertEquals(result.autoResolved, []);
      },
    );

    await t.step(
      "clears override fields on non-override advance",
      async () => {
        let upsertedRow:
          | Parameters<LeagueClockRepository["upsert"]>[0]
          | undefined;
        const service = createService({
          leagueClockRepo: {
            getByLeagueId: () =>
              Promise.resolve(
                createMockClock({
                  phase: "offseason_review",
                  stepIndex: 0,
                  overrideReason: "old override",
                  overrideBlockers: [{
                    teamId: "t1",
                    reason: "old",
                    autoResolvable: false,
                  }],
                }),
              ),
            upsert: (row) => {
              upsertedRow = row;
              return Promise.resolve(
                createMockClock({
                  phase: row.phase,
                  stepIndex: row.stepIndex,
                }),
              );
            },
          },
        });

        await service.advance(
          "league-1",
          createActor(),
          createGateState(),
        );

        assertEquals(upsertedRow?.overrideReason, null);
        assertEquals(upsertedRow?.overrideBlockers, null);
      },
    );

    await t.step(
      "commissioner policy allows advance without votes",
      async () => {
        const service = createService({
          leagueClockRepo: {
            getByLeagueId: () =>
              Promise.resolve(
                createMockClock({ phase: "offseason_review", stepIndex: 0 }),
              ),
          },
        });

        const result = await service.advance(
          "league-1",
          createActor(),
          createGateState(),
          createAdvanceOptions({ advancePolicy: "commissioner" }),
        );

        assertEquals(result.phase, "offseason_review");
        assertEquals(result.stepIndex, 1);
      },
    );

    await t.step(
      "ready_check policy rejects non-commissioner when votes are missing",
      async () => {
        const service = createService({
          leagueClockRepo: {
            getByLeagueId: () =>
              Promise.resolve(
                createMockClock({ phase: "offseason_review", stepIndex: 0 }),
              ),
          },
          voteRepo: {
            getVotesForStep: () => Promise.resolve([]),
          },
        });

        await assertRejects(
          () =>
            service.advance(
              "league-1",
              createActor({ isCommissioner: false }),
              createGateState(),
              createAdvanceOptions({
                advancePolicy: "ready_check",
                teamVoteStates: [
                  { teamId: "team-1", isHuman: true, autoPilot: false },
                ],
              }),
            ),
          DomainError,
          "Not all teams have voted ready",
        );
      },
    );

    await t.step(
      "ready_check policy allows advance when all human teams voted",
      async () => {
        const service = createService({
          leagueClockRepo: {
            getByLeagueId: () =>
              Promise.resolve(
                createMockClock({ phase: "offseason_review", stepIndex: 0 }),
              ),
          },
          voteRepo: {
            getVotesForStep: () =>
              Promise.resolve([
                {
                  leagueId: "league-1",
                  teamId: "team-1",
                  phase: "offseason_review",
                  stepIndex: 0,
                  readyAt: new Date(),
                },
              ]),
          },
        });

        const result = await service.advance(
          "league-1",
          createActor({ isCommissioner: false }),
          createGateState(),
          createAdvanceOptions({
            advancePolicy: "ready_check",
            teamVoteStates: [
              { teamId: "team-1", isHuman: true, autoPilot: false },
            ],
          }),
        );

        assertEquals(result.phase, "offseason_review");
        assertEquals(result.stepIndex, 1);
      },
    );

    await t.step(
      "ready_check treats autoPilot teams as having voted ready",
      async () => {
        const service = createService({
          leagueClockRepo: {
            getByLeagueId: () =>
              Promise.resolve(
                createMockClock({ phase: "offseason_review", stepIndex: 0 }),
              ),
          },
          voteRepo: {
            getVotesForStep: () =>
              Promise.resolve([
                {
                  leagueId: "league-1",
                  teamId: "team-human",
                  phase: "offseason_review",
                  stepIndex: 0,
                  readyAt: new Date(),
                },
              ]),
          },
        });

        const result = await service.advance(
          "league-1",
          createActor({ isCommissioner: false }),
          createGateState(),
          createAdvanceOptions({
            advancePolicy: "ready_check",
            teamVoteStates: [
              { teamId: "team-human", isHuman: true, autoPilot: false },
              { teamId: "team-auto", isHuman: true, autoPilot: true },
            ],
          }),
        );

        assertEquals(result.phase, "offseason_review");
        assertEquals(result.stepIndex, 1);
      },
    );

    await t.step(
      "ready_check rejects when some human non-autopilot teams have not voted",
      async () => {
        const service = createService({
          leagueClockRepo: {
            getByLeagueId: () =>
              Promise.resolve(
                createMockClock({ phase: "offseason_review", stepIndex: 0 }),
              ),
          },
          voteRepo: {
            getVotesForStep: () =>
              Promise.resolve([
                {
                  leagueId: "league-1",
                  teamId: "team-1",
                  phase: "offseason_review",
                  stepIndex: 0,
                  readyAt: new Date(),
                },
              ]),
          },
        });

        await assertRejects(
          () =>
            service.advance(
              "league-1",
              createActor({ isCommissioner: false }),
              createGateState(),
              createAdvanceOptions({
                advancePolicy: "ready_check",
                teamVoteStates: [
                  { teamId: "team-1", isHuman: true, autoPilot: false },
                  { teamId: "team-2", isHuman: true, autoPilot: false },
                ],
              }),
            ),
          DomainError,
          "Not all teams have voted ready",
        );
      },
    );

    await t.step(
      "commissioner can force-advance under ready_check regardless of votes",
      async () => {
        const service = createService({
          leagueClockRepo: {
            getByLeagueId: () =>
              Promise.resolve(
                createMockClock({ phase: "offseason_review", stepIndex: 0 }),
              ),
          },
          voteRepo: {
            getVotesForStep: () => Promise.resolve([]),
          },
        });

        const result = await service.advance(
          "league-1",
          createActor({ isCommissioner: true }),
          createGateState(),
          createAdvanceOptions({
            advancePolicy: "ready_check",
            teamVoteStates: [
              { teamId: "team-1", isHuman: true, autoPilot: false },
            ],
          }),
        );

        assertEquals(result.phase, "offseason_review");
        assertEquals(result.stepIndex, 1);
      },
    );
  });

  await t.step("castReadyVote", async (t) => {
    await t.step("casts a vote and returns the row", async () => {
      const castVoteCalls: unknown[] = [];
      const service = createService({
        leagueClockRepo: {
          getByLeagueId: () =>
            Promise.resolve(
              createMockClock({ phase: "offseason_review", stepIndex: 0 }),
            ),
        },
        voteRepo: {
          castVote: (vote) => {
            castVoteCalls.push(vote);
            return Promise.resolve({
              leagueId: vote.leagueId,
              teamId: vote.teamId,
              phase: vote.phase,
              stepIndex: vote.stepIndex,
              readyAt: new Date(),
            });
          },
        },
      });

      const result = await service.castReadyVote(
        "league-1",
        "team-1",
      );

      assertEquals(result.leagueId, "league-1");
      assertEquals(result.teamId, "team-1");
      assertEquals(result.phase, "offseason_review");
      assertEquals(result.stepIndex, 0);
      assertEquals(castVoteCalls.length, 1);
    });

    await t.step(
      "throws NOT_FOUND when clock does not exist",
      async () => {
        const service = createService({
          leagueClockRepo: {
            getByLeagueId: () => Promise.resolve(undefined),
          },
        });

        await assertRejects(
          () => service.castReadyVote("missing", "team-1"),
          DomainError,
          "not found",
        );
      },
    );
  });
});
