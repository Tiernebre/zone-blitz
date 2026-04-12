import { assertEquals } from "@std/assert";
import { createGMStrategy } from "./gm-strategy.ts";

Deno.test("gm strategy", async (t) => {
  const gm = createGMStrategy();

  await t.step("evaluateTrade accepts favorable trades", () => {
    const decision = gm.evaluateTrade({
      offeredPlayerIds: ["p1", "p2"],
      requestedPlayerIds: ["p3"],
      offeredPickIds: [],
      requestedPickIds: [],
    });
    assertEquals(decision.accept, true);
  });

  await t.step("evaluateTrade rejects unfavorable trades", () => {
    const decision = gm.evaluateTrade({
      offeredPlayerIds: [],
      requestedPlayerIds: ["p1", "p2"],
      offeredPickIds: [],
      requestedPickIds: [],
    });
    assertEquals(decision.accept, false);
  });

  await t.step("selectDraftPick picks highest-rated need position", () => {
    const selection = gm.selectDraftPick(
      [
        { playerId: "a", position: "WR", rating: 90 },
        { playerId: "b", position: "QB", rating: 95 },
        { playerId: "c", position: "QB", rating: 85 },
      ],
      { positions: ["QB"], strategy: "win-now" },
    );
    assertEquals(selection.playerId, "b");
  });

  await t.step(
    "selectDraftPick falls back to best available",
    () => {
      const selection = gm.selectDraftPick(
        [
          { playerId: "a", position: "WR", rating: 90 },
          { playerId: "b", position: "RB", rating: 95 },
        ],
        { positions: ["QB"], strategy: "rebuild" },
      );
      assertEquals(selection.playerId, "b");
    },
  );
});
