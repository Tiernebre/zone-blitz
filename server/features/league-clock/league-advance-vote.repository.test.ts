import { assertEquals } from "@std/assert";
import type {
  LeagueAdvanceVoteRepository,
  VoteRow,
} from "./league-advance-vote.repository.ts";

Deno.test("league-advance-vote.repository", async (t) => {
  await t.step("interface exports correctly", () => {
    const repo: LeagueAdvanceVoteRepository = {
      castVote: () => Promise.resolve({} as VoteRow),
      getVotesForStep: () => Promise.resolve([]),
    };
    assertEquals(typeof repo.castVote, "function");
    assertEquals(typeof repo.getVotesForStep, "function");
  });
});
