import { assertEquals } from "@std/assert";
import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { PLAYER_ATTRIBUTE_KEYS } from "@zone-blitz/shared";
import { playerSeasonRatings } from "./player-season-ratings.schema.ts";

Deno.test("player_season_ratings is keyed by (player_id, season_id)", () => {
  const config = getTableConfig(playerSeasonRatings);
  assertEquals(config.primaryKeys.length, 1);
  const pkColumns = config.primaryKeys[0].columns.map((c) => c.name).sort();
  assertEquals(pkColumns, ["player_id", "season_id"]);
});

Deno.test("player_season_ratings captures the full attribute snapshot", () => {
  const config = getTableConfig(playerSeasonRatings);
  const names = new Set(config.columns.map((c) => c.name));
  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    const snake = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    assertEquals(names.has(snake), true);
    assertEquals(names.has(`${snake}_potential`), true);
  }
});

Deno.test("player_season_ratings cascades from players and seasons", () => {
  const config = getTableConfig(playerSeasonRatings);
  const fkTargets = config.foreignKeys
    .map((fk) => getTableName(fk.reference().foreignTable))
    .sort();
  assertEquals(fkTargets, ["players", "seasons"]);
});
