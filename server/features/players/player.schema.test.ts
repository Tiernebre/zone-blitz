import { assertEquals, assertExists } from "@std/assert";
import { getTableConfig } from "drizzle-orm/pg-core";
import { PLAYER_STATUSES } from "@zone-blitz/shared";
import { players, playerStatusEnum } from "./player.schema.ts";

Deno.test("players has a status column backed by the player_status enum", () => {
  const config = getTableConfig(players);
  const status = config.columns.find((c) => c.name === "status");
  assertExists(status);
  assertEquals(status.notNull, true);
  assertEquals(status.hasDefault, true);
  assertEquals(status.default, "active");
});

Deno.test("player_status enum carries all defined lifecycle values", () => {
  assertEquals([...playerStatusEnum.enumValues], [...PLAYER_STATUSES]);
});

Deno.test("players declares a partial index on status for prospects only", () => {
  const config = getTableConfig(players);
  const prospectIdx = config.indexes.find(
    (idx) => idx.config.name === "players_prospect_idx",
  );
  assertExists(prospectIdx);
  assertEquals(prospectIdx.config.columns.length, 1);
  assertEquals(
    (prospectIdx.config.columns[0] as { name: string }).name,
    "status",
  );
  assertExists(prospectIdx.config.where);
});
